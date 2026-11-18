import { Injectable } from "@nestjs/common";
import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { UsersService } from "../../../platform/users/users.service.js";
import type {
  CreateProposalTemplateDto,
  UpdateProposalTemplateDto,
} from "./dto/template.dto.js";
import { ProposalsRepository } from "./proposals.repository.js";

/** Fields that define a template version's content. A published (`active`)
 * or archived version is immutable so proposals issued from it stay
 * reproducible — changes go into a new draft version. */
const CONTENT_FIELDS = [
  "name",
  "title",
  "code",
  "description",
  "department",
  "category",
  "schemaJson",
] as const;

const VALID_SECTION_TYPES = new Set([
  "short_text",
  "long_text",
  "bullet_list",
  "numbered_list",
  "key_value",
  "table",
  "checklist",
  "signature",
  "section_group",
  "page_break",
  "spacer",
]);

export function sanitizeFieldDefault(type: string, rawVal: unknown): string {
  if (rawVal === undefined || rawVal === null) return "";
  const trimmed = String(rawVal).trim();
  if (!trimmed) return "";
  switch (type) {
    case "number":
      return /^-?\d+(\.\d+)?$/.test(trimmed) && !isNaN(Number(trimmed))
        ? trimmed
        : "";
    case "currency":
      return /^\d+(\.\d{1,2})?$/.test(trimmed) && !isNaN(Number(trimmed))
        ? trimmed
        : "";
    case "date": {
      if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(trimmed)) {
        const parts = trimmed.split("/").map(Number);
        const d = parts[0]!;
        const m = parts[1]!;
        const y = parts[2]!;
        if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
          const days = [
            31,
            isLeap ? 29 : 28,
            31,
            30,
            31,
            30,
            31,
            31,
            30,
            31,
            30,
            31,
          ];
          if (d <= (days[m - 1] ?? 0)) return trimmed;
        }
      }
      return "";
    }
    case "phone": {
      if (/[a-zA-Z]/.test(trimmed)) return "";
      if (!/^(\+?[0-9\s\-()]+)$/.test(trimmed)) return "";
      let digits = trimmed.replace(/\D/g, "");
      if (
        trimmed.startsWith("+91") ||
        (trimmed.startsWith("+") && digits.startsWith("91"))
      ) {
        digits = digits.slice(2);
      }
      return digits.length === 10 ? trimmed : "";
    }
    default:
      return trimmed;
  }
}

export function normalizeSections(
  raw: unknown,
  usedIds: Set<string> = new Set(),
): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  const validSections: Record<string, unknown>[] = [];

  raw.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }
    const section = item as Record<string, unknown>;

    let id =
      typeof section.id === "string" && section.id.trim()
        ? section.id.trim()
        : `section-${Date.now()}-${index + 1}`;
    if (usedIds.has(id)) {
      id = `${id}-${index + 1}-${Math.floor(Math.random() * 1000)}`;
    }
    usedIds.add(id);

    const title =
      typeof section.title === "string" && section.title.trim()
        ? section.title.trim()
        : `Section ${index + 1}`;
    const type =
      typeof section.type === "string" && VALID_SECTION_TYPES.has(section.type)
        ? section.type
        : "short_text";
    const order =
      typeof section.order === "number" && !isNaN(section.order)
        ? section.order
        : index + 1;

    const normalized: Record<string, unknown> = {
      ...section,
      id,
      title,
      type,
      order,
    };

    if (typeof section.defaultContent === "string") {
      normalized.defaultContent = section.defaultContent;
    }

    if (Array.isArray(section.defaultItems)) {
      normalized.defaultItems = section.defaultItems
        .map((x) => String(x ?? ""))
        .filter((x) => x.trim().length > 0);
    }

    if (Array.isArray(section.keyValueFields)) {
      normalized.keyValueFields = section.keyValueFields
        .filter(
          (f): f is Record<string, unknown> =>
            Boolean(f) && typeof f === "object" && !Array.isArray(f),
        )
        .map((f, fi) => {
          const type = typeof f.type === "string" ? f.type : "text";
          const rawDefault =
            typeof f.defaultValue === "string"
              ? f.defaultValue
              : typeof f.value === "string"
                ? f.value
                : "";
          return {
            id:
              typeof f.id === "string" && f.id.trim()
                ? f.id.trim()
                : `kv-${fi + 1}`,
            label: typeof f.label === "string" ? f.label : "",
            defaultValue: sanitizeFieldDefault(type, rawDefault),
            type,
          };
        });
    }

    const colTypes = new Map<string, string>();
    if (Array.isArray(section.tableColumns)) {
      normalized.tableColumns = section.tableColumns
        .filter(
          (c): c is Record<string, unknown> =>
            Boolean(c) && typeof c === "object" && !Array.isArray(c),
        )
        .map((c, ci) => {
          const id =
            typeof c.id === "string" && c.id.trim()
              ? c.id.trim()
              : `col-${ci + 1}`;
          const type = typeof c.type === "string" ? c.type : "text";
          colTypes.set(id, type);
          return {
            id,
            name: typeof c.name === "string" ? c.name : "",
            type,
          };
        });
    }

    if (Array.isArray(section.defaultRows)) {
      normalized.defaultRows = section.defaultRows
        .filter(
          (r): r is Record<string, unknown> =>
            Boolean(r) && typeof r === "object" && !Array.isArray(r),
        )
        .map((r) => {
          const rowObj: Record<string, string> = {};
          for (const [k, v] of Object.entries(r)) {
            if (v !== undefined && v !== null) {
              const colType = colTypes.get(k) ?? "text";
              rowObj[k] = sanitizeFieldDefault(colType, v);
            }
          }
          return rowObj;
        });
    }

    if (Array.isArray(section.signatureFields)) {
      normalized.signatureFields = section.signatureFields
        .filter(
          (f): f is Record<string, unknown> =>
            Boolean(f) && typeof f === "object" && !Array.isArray(f),
        )
        .map((f, fi) => ({
          id:
            typeof f.id === "string" && f.id.trim()
              ? f.id.trim()
              : `sig-${fi + 1}`,
          label: typeof f.label === "string" ? f.label : "",
          type: typeof f.type === "string" ? f.type : "name",
        }));
    }

    if (Array.isArray(section.children)) {
      normalized.children = normalizeSections(section.children, usedIds);
    }

    validSections.push(normalized);
  });

  return validSections;
}

@Injectable()
export class ProposalTemplatesService {
  constructor(
    private readonly repository: ProposalsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly usersService: UsersService,
  ) {}

  findAll() {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.findTemplates(scope);
  }

  async findOne(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const template = await this.repository.findTemplateById(scope, id);
    if (!template) throw new ResourceNotFoundException("ProposalTemplate", id);
    return template;
  }

  async create(dto: CreateProposalTemplateDto) {
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    const code = dto.code?.trim().toUpperCase();
    const schemaJson =
      dto.schemaJson !== undefined
        ? normalizeSections(dto.schemaJson)
        : undefined;
    return this.repository.createTemplate(
      scope,
      {
        ...dto,
        ...(code ? { code } : {}),
        ...(schemaJson !== undefined ? { schemaJson } : {}),
      },
      userId,
      user.fullName,
    );
  }

  async update(id: number, dto: UpdateProposalTemplateDto) {
    const existing = await this.findOne(id);
    const touchesContent = CONTENT_FIELDS.some((f) => dto[f] !== undefined);
    if (touchesContent && existing.status !== "draft") {
      throw new InvalidStateTransitionException(
        "ProposalTemplate",
        existing.status,
        existing.status,
        "published or archived template versions are immutable — create a new version to change them",
      );
    }
    if (dto.status === "active" && existing.status === "draft") {
      // Publishing goes through publish() so the version chain is updated.
      const { status: _ignored, ...rest } = dto;
      if (Object.keys(rest).length > 0) await this.update(id, rest);
      return this.publish(id);
    }
    if (dto.isDefault && (dto.status ?? existing.status) !== "active") {
      throw new InvalidStateTransitionException(
        "ProposalTemplate",
        existing.status,
        "default",
        "only a published template can be the default",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const schemaJson =
      dto.schemaJson !== undefined
        ? normalizeSections(dto.schemaJson)
        : undefined;
    const updated = await this.repository.updateTemplate(scope, id, {
      ...dto,
      ...(dto.code !== undefined
        ? { code: dto.code.trim().toUpperCase() }
        : {}),
      ...(schemaJson !== undefined ? { schemaJson } : {}),
    });
    if (!updated) throw new ResourceNotFoundException("ProposalTemplate", id);
    return updated;
  }

  async publish(id: number) {
    const existing = await this.findOne(id);
    if (existing.status !== "draft") {
      throw new InvalidStateTransitionException(
        "ProposalTemplate",
        existing.status,
        "active",
      );
    }
    const sections = normalizeSections(existing.schemaJson);
    if (sections.length === 0) {
      throw new BusinessRuleViolationException(
        "cannot publish a template with no sections — add at least one section before publishing",
        "TEMPLATE_EMPTY_SECTIONS",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const published = await this.repository.publishTemplate(scope, id);
    if (!published) throw new ResourceNotFoundException("ProposalTemplate", id);
    return published;
  }

  async duplicate(id: number) {
    const source = await this.findOne(id);
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    const copy = await this.repository.cloneTemplate(
      scope,
      id,
      {
        name: `${source.name} (Copy)`,
        title: source.title,
        code: source.code ? `${source.code}-COPY` : null,
        version: 1,
        parentVersionId: null,
        isCurrent: true,
      },
      userId,
      user.fullName,
    );
    if (!copy) throw new ResourceNotFoundException("ProposalTemplate", id);
    return copy;
  }

  async createNewVersion(id: number) {
    const source = await this.findOne(id);
    if (source.status === "draft") {
      throw new InvalidStateTransitionException(
        "ProposalTemplate",
        source.status,
        "new version",
        "edit the draft directly — new versions are created from published templates",
      );
    }
    const scope = this.tenantContext.getOrgScope();
    const userId = this.tenantContext.getUserId();
    const user = await this.usersService.findOne(userId);
    const next = await this.repository.cloneTemplate(
      scope,
      id,
      {
        name: source.name,
        title: source.title,
        code: source.code,
        version: source.version + 1,
        parentVersionId: source.id,
        isCurrent: false,
      },
      userId,
      user.fullName,
    );
    if (!next) throw new ResourceNotFoundException("ProposalTemplate", id);
    return next;
  }

  async softDelete(id: number) {
    const scope = this.tenantContext.getOrgScope();
    const removed = await this.repository.softDeleteTemplate(scope, id);
    if (!removed) throw new ResourceNotFoundException("ProposalTemplate", id);
    return { success: true };
  }
}
