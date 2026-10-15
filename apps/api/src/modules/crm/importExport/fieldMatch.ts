// Header -> CRM field matching + row validation for Bulk Import.
// Matching is intentionally conservative: exact (case/whitespace-insensitive) match against a
// field's label, key, or declared aliases only. No fuzzy/distance-based matching — an
// unrecognized header is left "Unmapped" for the user to pick manually rather than guessed.
import {
  DuplicateConfig,
  FieldSchema,
  HeaderMapping,
  MappedImportRow,
  ParsedWorkbook,
} from "./types";
import { validateEmail } from "@/utils/formValidators";

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

/** Auto-matches each Excel header to a field key via exact/alias match. Unmatched -> null (Unmapped). */
export function autoMatchHeaders<T>(
  headers: string[],
  fields: FieldSchema<T>[],
): HeaderMapping {
  const byNormalized = new Map<string, string>();
  fields.forEach((f) => {
    byNormalized.set(normalize(f.label), f.key);
    byNormalized.set(normalize(f.key), f.key);
    (f.aliases || []).forEach((a) => byNormalized.set(normalize(a), f.key));
  });

  const mapping: HeaderMapping = {};
  const usedKeys = new Set<string>();
  headers.forEach((h, idx) => {
    const match = byNormalized.get(normalize(h));
    if (match && !usedKeys.has(match)) {
      mapping[idx] = match;
      usedKeys.add(match);
    } else {
      mapping[idx] = null;
    }
  });
  return mapping;
}

function parseFieldValue(
  field: Pick<FieldSchema, "type" | "label" | "options">,
  raw: string,
): { value: unknown; error?: string } {
  const value = raw.trim();
  if (!value)
    return {
      value:
        field.type === "number" || field.type === "currency" ? undefined : "",
    };

  switch (field.type) {
    case "email":
      if (!validateEmail(value))
        return { value, error: `Invalid email in "${field.label}"` };
      return { value };
    case "number":
    case "currency": {
      const n = Number(value.replace(/[,₹$€£\s]/g, ""));
      if (!Number.isFinite(n))
        return {
          value: undefined,
          error: `Invalid number in "${field.label}"`,
        };
      return { value: n };
    }
    case "date": {
      const d = new Date(value);
      if (Number.isNaN(d.getTime()))
        return { value, error: `Invalid date in "${field.label}"` };
      return { value };
    }
    case "select": {
      const match = field.options?.find(
        (o) => o.toLowerCase() === value.toLowerCase(),
      );
      if (!match)
        return {
          value,
          error: `"${value}" is not a valid ${field.label} (expected one of: ${field.options?.join(", ")})`,
        };
      return { value: match };
    }
    case "boolean":
      return { value: /^(yes|true|1|y)$/i.test(value) };
    default:
      return { value };
  }
}

/** Maps + validates every parsed data row against the current header mapping and field schema. */
export function buildMappedRows<T>(
  parsed: ParsedWorkbook,
  mapping: HeaderMapping,
  fields: FieldSchema<T>[],
  duplicate?: DuplicateConfig,
): MappedImportRow[] {
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const mappedIndexes = Object.entries(mapping).filter(([, key]) => key) as [
    string,
    string,
  ][];

  return parsed.rows.map((row, i) => {
    const data: Record<string, unknown> = {};
    const errors: string[] = [];

    mappedIndexes.forEach(([idxStr, key]) => {
      const field = fieldByKey.get(key);
      if (!field) return;
      const raw = row[Number(idxStr)] ?? "";
      const { value, error } = parseFieldValue(field, raw);
      if (error) errors.push(error);
      data[key] = value;

      if (field.relation) {
        const trimmed = String(raw).trim();
        if (trimmed) {
          const resolvedId = field.relation.lookup(trimmed);
          if (resolvedId) {
            data[key] = resolvedId;
          } else if (field.relation.required) {
            errors.push(
              `Could not find matching ${field.relation.label} "${trimmed}" for "${field.label}" — check spelling or create it first`,
            );
          } else {
            data[key] = undefined;
          }
        } else if (field.relation.required) {
          errors.push(
            `Missing required ${field.relation.label} reference in "${field.label}"`,
          );
        }
      }
    });

    fields.forEach((f) => {
      if (f.required && !f.exportOnly) {
        const v = data[f.key];
        const isEmpty =
          v === undefined ||
          v === null ||
          (typeof v === "string" && v.trim() === "");
        if (isEmpty) errors.push(`Missing required field "${f.label}"`);
      }
    });

    let isDuplicate = false;
    let duplicateId: string | undefined;
    let duplicateLabel: string | undefined;
    if (duplicate) {
      const hasAllKeys = duplicate.keys.every((k) => {
        const v = data[k];
        return typeof v === "string" ? v.trim() : v !== undefined && v !== null;
      });
      if (hasAllKeys) {
        const existing = duplicate.findExisting(data);
        if (existing) {
          isDuplicate = true;
          duplicateId = existing.id;
          duplicateLabel = existing.label;
        }
      }
    }

    return {
      rowNumber: i + 1,
      data,
      errors,
      isDuplicate,
      duplicateId,
      duplicateLabel,
    };
  });
}
