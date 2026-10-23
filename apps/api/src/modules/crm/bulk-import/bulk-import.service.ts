import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { TEAM_ACCESS_LEVELS } from "../../../common/tenancy/team-scope.js";
import { PermissionsService } from "../../../platform/roles-permissions/permissions.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { AccountsService } from "../accounts/accounts.service.js";
import { QueryAccountDto } from "../accounts/dto/account.dto.js";
import { ActivitiesService } from "../activities/activities.service.js";
import { QueryCrmColdCallingEntryDto } from "../cold-calling/dto/cold-calling.dto.js";
import { CrmColdCallingService } from "../cold-calling/cold-calling.service.js";
import { ContactsService } from "../contacts/contacts.service.js";
import { QueryContactDto } from "../contacts/dto/contact.dto.js";
import { QueryLeadDto } from "../leads/dto/lead.dto.js";
import { LeadsService } from "../leads/leads.service.js";
import { CreateMeetingDto } from "../meetings/dto/meeting.dto.js";
import { MeetingsService } from "../meetings/meetings.service.js";
import { OpportunitiesService } from "../opportunities/opportunities.service.js";
import { PipelineStagesRepository } from "../pipeline-stages/pipeline-stages.repository.js";
import { QueryCrmMiningRowDto } from "../mining-rows/dto/mining-row.dto.js";
import { CrmMiningRowsService } from "../mining-rows/mining-rows.service.js";
import { QueryOpportunityDto } from "../opportunities/dto/opportunity.dto.js";
import { QueryProductDto } from "../products/dto/product.dto.js";
import { ProductsService } from "../products/products.service.js";
import { QueryQuotationDto } from "../quotations/dto/quotation.dto.js";
import { QuotationsService } from "../quotations/quotations.service.js";
import {
  BulkImportRepository,
  type CustomFieldTarget,
} from "./bulk-import.repository.js";
import { ENTITY_DTO, page } from "./bulk-import.entities.js";
import {
  autoMatchHeaders,
  coerceRow,
  ENTITY_CUSTOM_MODULE,
  ENTITY_FIELD_SPECS,
  normalizeLabel,
  resolveMeetingStatus,
  slugifyHeaderToKey,
  type CustomFieldModule,
  type ImportEntity,
  type ImportFieldSpec,
} from "./bulk-import.fields.js";
import {
  MAX_EXPORT_ROWS,
  type CommitImportDto,
  type DuplicateStrategy,
  type QueryExportDto,
} from "./dto/bulk-import.dto.js";

type Dict = Record<string, unknown>;
interface Perm {
  code: string;
  scoped: boolean;
}
const exact = (code: string): Perm => ({ code, scoped: false });
const scoped = (code: string): Perm => ({ code, scoped: true });

interface Duplicate {
  id: number;
  label: string;
}

interface RowContext {
  accountIdByName: Map<string, number | null>;
}

interface Handler {
  readPerm: Perm;
  /** Every one of these is required (besides `crm.import.write`). */
  writePerms: Perm[];
  customTarget: CustomFieldTarget | null;
  /** Maps coerced data to the downstream DTO; may resolve relations. */
  toDto?(data: Dict, ctx: RowContext): Promise<{ dto: Dict; errors: string[] }>;
  findDuplicate(data: Dict, ctx: RowContext): Promise<Duplicate | undefined>;
  create(dto: Dict, data: Dict, ctx: RowContext): Promise<number>;
  update(id: number, dto: Dict, data: Dict, ctx: RowContext): Promise<void>;
}

export interface ImportRowResult {
  rowNumber: number;
  status:
    | "created"
    | "updated"
    | "skipped"
    | "failed"
    | "valid"
    | "duplicate"
    | "invalid";
  id?: number;
  duplicateId?: number;
  duplicateLabel?: string;
  errors: string[];
}

export interface ImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Dry run: rows that are valid (duplicates included). */
  valid: number;
  duplicates: number;
}

const lc = (v: unknown) =>
  typeof v === "string" ? v.trim().toLowerCase() : "";
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

function omitUndefined(o: Dict): Dict {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  );
}

async function dtoErrors(
  Dto: new () => object,
  plain: Dict,
): Promise<string[]> {
  const instance = plainToInstance(Dto, plain);
  const errs = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errs.flatMap((e) => Object.values(e.constraints ?? {}));
}

function cell(v: unknown): string | number {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number" || typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  const s = String(v);
  if (s !== "[object Object]") return Number.isNaN(Number(s)) ? s : Number(s);
  return JSON.stringify(v);
}

const QUOTATION_COLUMNS = [
  { key: "quotationNumber", label: "Quote #" },
  { key: "subject", label: "Subject" },
  { key: "accountName", label: "Account" },
  { key: "status", label: "Status" },
  { key: "quoteOwner", label: "Quote Owner" },
  { key: "currency", label: "Currency" },
  { key: "quoteDate", label: "Quote Date" },
  { key: "validUntil", label: "Valid Until" },
  { key: "subtotal", label: "Subtotal" },
  { key: "totalTax", label: "Total Tax" },
  { key: "grandTotal", label: "Grand Total" },
];

@Injectable()
export class BulkImportService {
  private readonly handlers: Record<ImportEntity, Handler>;

  constructor(
    private readonly repository: BulkImportRepository,
    private readonly tenantContext: TenantContextService,
    private readonly permissions: PermissionsService,
    private readonly leads: LeadsService,
    private readonly accounts: AccountsService,
    private readonly contacts: ContactsService,
    private readonly products: ProductsService,
    private readonly miningRows: CrmMiningRowsService,
    private readonly coldCalling: CrmColdCallingService,
    private readonly meetings: MeetingsService,
    private readonly activities: ActivitiesService,
    private readonly quotations: QuotationsService,
    private readonly opportunities: OpportunitiesService,
    private readonly pipelineStages: PipelineStagesRepository,
  ) {
    this.handlers = this.buildHandlers();
  }

  // --- Public API --------------------------------------------------------

  listCustomFields(module?: CustomFieldModule) {
    return this.repository.listDefs(this.tenantContext.getOrgScope(), module);
  }

  async fields(entity: ImportEntity) {
    await this.assertWritePermitted(entity);
    const module = ENTITY_CUSTOM_MODULE[entity];
    return {
      entity,
      customFieldModule: module,
      fields: ENTITY_FIELD_SPECS[entity],
      customFields: module ? await this.listCustomFields(module) : [],
    };
  }

  /** Exact/alias header matching only (no fuzzy). Unmatched -> null. */
  async matchHeaders(entity: ImportEntity, headers: string[]) {
    await this.assertWritePermitted(entity);
    const fields = ENTITY_FIELD_SPECS[entity];
    return { entity, fields, mapping: autoMatchHeaders(headers, fields) };
  }

  async commit(entity: ImportEntity, dto: CommitImportDto) {
    await this.assertWritePermitted(entity);
    const handler = this.handlers[entity];
    const fields = ENTITY_FIELD_SPECS[entity];
    const module = ENTITY_CUSTOM_MODULE[entity];
    const dryRun = dto.dryRun === true;
    const ctx: RowContext = { accountIdByName: new Map() };
    const scope = this.tenantContext.getOrgScope();

    const baseKeys = new Set(fields.map((f) => f.key));
    const headerKey = new Map<string, { key: string; label: string }>();
    const ignoredColumns = new Set<string>();
    for (const row of dto.rows) {
      for (const header of Object.keys(row.custom ?? {})) {
        if (headerKey.has(header) || ignoredColumns.has(header)) continue;
        const key = slugifyHeaderToKey(header);
        if (!module || !key) ignoredColumns.add(header);
        else headerKey.set(header, { key, label: header.trim() });
      }
    }

    // Idempotent definition upsert (skipped on a dry run — nothing written).
    const customKeyByHeader = new Map<string, string>();
    const newCustomFields: string[] = [];
    if (module && headerKey.size > 0) {
      const existing = await this.repository.listDefs(scope, module);
      const needed = [...headerKey.entries()].filter(
        ([, { key }]) => !baseKeys.has(key),
      );
      for (const [header, { key, label }] of needed) {
        const found = existing.find(
          (d) =>
            d.key === key || normalizeLabel(d.label) === normalizeLabel(label),
        );
        customKeyByHeader.set(header, found ? found.key : key);
        if (!found) newCustomFields.push(label);
      }
      if (!dryRun && newCustomFields.length > 0) {
        await this.repository.ensureDefs(
          scope,
          module,
          needed.map(([header, { key, label }]) => ({
            key: customKeyByHeader.get(header) ?? key,
            label,
            sourceHeader: header,
          })),
          this.tenantContext.getUserId(),
        );
      }
    }

    const results: ImportRowResult[] = [];
    for (const row of dto.rows) {
      results.push(
        await this.processRow(
          entity,
          handler,
          fields,
          row,
          dto.strategy,
          dryRun,
          ctx,
          headerKey,
          customKeyByHeader,
        ),
      );
    }

    const count = (...s: ImportRowResult["status"][]) =>
      results.filter((r) => s.includes(r.status)).length;
    const summary: ImportSummary = {
      totalRows: results.length,
      created: count("created"),
      updated: count("updated"),
      skipped: count("skipped"),
      failed: count("failed", "invalid"),
      valid: count("valid", "duplicate"),
      duplicates: results.filter((r) => r.duplicateId !== undefined).length,
    };
    return {
      entity,
      dryRun,
      strategy: dto.strategy,
      summary,
      rows: results,
      newCustomFields: [...new Set(newCustomFields)],
      ignoredColumns: [...ignoredColumns],
    };
  }

  async export(entity: string, query: QueryExportDto) {
    const isQuotations = entity === "quotations";
    if (!isQuotations && !(entity in ENTITY_FIELD_SPECS)) {
      throw new NotFoundException(`Unknown export entity "${entity}"`);
    }
    await this.assertExportPermitted(entity);
    const limit = Math.min(query.limit ?? MAX_EXPORT_ROWS, MAX_EXPORT_ROWS);
    const { rows, total } = await this.fetchExportRows(
      entity,
      query.search,
      limit,
    );
    const specColumns = isQuotations
      ? QUOTATION_COLUMNS
      : ENTITY_FIELD_SPECS[entity as ImportEntity].map((f) => ({
          key: f.key,
          label: f.label,
        }));
    const module = isQuotations
      ? null
      : ENTITY_CUSTOM_MODULE[entity as ImportEntity];
    const defs =
      query.includeCustomFields !== false && module
        ? await this.repository.listDefs(
            this.tenantContext.getOrgScope(),
            module,
          )
        : [];
    const columns = [
      ...specColumns,
      ...defs.map((d) => ({ key: `custom:${d.key}`, label: d.label })),
    ];
    const out = rows.map((row) => {
      const flat: Record<string, string | number> = {};
      for (const c of specColumns) flat[c.key] = cell(row[c.key]);
      const custom = (row.customFields ?? {}) as Dict;
      for (const d of defs) flat[`custom:${d.key}`] = cell(custom[d.key]);
      return flat;
    });
    return {
      entity,
      columns,
      rows: out,
      total,
      truncated: total > rows.length,
    };
  }

  // --- Row pipeline ------------------------------------------------------

  private async processRow(
    entity: ImportEntity,
    handler: Handler,
    fields: readonly ImportFieldSpec[],
    row: CommitImportDto["rows"][number],
    strategy: DuplicateStrategy,
    dryRun: boolean,
    ctx: RowContext,
    headerKey: Map<string, { key: string; label: string }>,
    customKeyByHeader: Map<string, string>,
  ): Promise<ImportRowResult> {
    const base = { rowNumber: row.rowNumber };
    try {
      // An unrecognised column whose header slug equals a built-in field's
      // own key fills that field when the sheet left it unmapped (legacy
      // `resolvedToBaseField`); every other one becomes a custom value.
      const values: Record<string, string> = {};
      for (const [k, v] of Object.entries(row.values)) {
        if (typeof v === "string") values[k] = v;
      }
      const customValues: Record<string, string> = {};
      for (const [header, raw] of Object.entries(row.custom ?? {})) {
        const value = typeof raw === "string" ? raw.trim() : "";
        const meta = headerKey.get(header);
        if (!meta || !value) continue;
        if (fields.some((f) => f.key === meta.key)) {
          if (!values[meta.key]?.trim()) values[meta.key] = value;
        } else {
          const key = customKeyByHeader.get(header);
          if (key) customValues[key] = value;
        }
      }

      const { data, errors } = coerceRow(fields, values);
      if (errors.length > 0) return { ...base, status: "invalid", errors };

      const mapped = handler.toDto
        ? await handler.toDto(data, ctx)
        : { dto: data, errors: [] as string[] };
      const Dto = ENTITY_DTO[entity];
      const dtoErrs =
        mapped.errors.length > 0
          ? mapped.errors
          : Dto
            ? await dtoErrors(Dto, mapped.dto)
            : [];
      if (dtoErrs.length > 0)
        return { ...base, status: "invalid", errors: dtoErrs };

      const dup = await handler.findDuplicate(data, ctx);
      const dupInfo = dup
        ? { duplicateId: dup.id, duplicateLabel: dup.label }
        : {};
      if (dryRun)
        return {
          ...base,
          ...dupInfo,
          status: dup ? "duplicate" : "valid",
          errors: [],
        };
      if (dup && strategy === "skip")
        return { ...base, ...dupInfo, status: "skipped", errors: [] };

      let id: number;
      let status: "created" | "updated";
      if (dup && strategy === "update") {
        await handler.update(dup.id, mapped.dto, data, ctx);
        id = dup.id;
        status = "updated";
      } else {
        id = await handler.create(mapped.dto, data, ctx);
        status = "created";
      }
      if (handler.customTarget && Object.keys(customValues).length > 0) {
        await this.repository.mergeCustomFields(
          this.tenantContext.getOrgScope(),
          handler.customTarget,
          id,
          customValues,
        );
      }
      return { ...base, ...dupInfo, status, id, errors: [] };
    } catch (err) {
      return {
        ...base,
        status: "failed",
        errors: [err instanceof Error ? err.message : "Import failed"],
      };
    }
  }

  // --- Permissions -------------------------------------------------------

  private satisfies(granted: string[], perm: Perm): boolean {
    return perm.scoped
      ? TEAM_ACCESS_LEVELS.some((l) => granted.includes(`${perm.code}.${l}`))
      : granted.includes(perm.code);
  }

  private granted(): Promise<string[]> {
    return this.permissions.getPermissionsForUser(
      this.tenantContext.getUserId(),
    );
  }

  private async assertWritePermitted(entity: ImportEntity) {
    const granted = await this.granted();
    const missing = this.handlers[entity].writePerms.find(
      (p) => !this.satisfies(granted, p),
    );
    if (missing)
      throw new ForbiddenException(`Missing permission: ${missing.code}`);
  }

  private async assertExportPermitted(entity: string) {
    const granted = await this.granted();
    const perm =
      entity === "quotations"
        ? exact("crm.quotation.read")
        : this.handlers[entity as ImportEntity].readPerm;
    if (!this.satisfies(granted, perm))
      throw new ForbiddenException(`Missing permission: ${perm.code}`);
  }

  // --- Lookups through owning services -----------------------------------

  private async findAccountByName(name: string, ctx?: RowContext) {
    const key = lc(name);
    if (ctx?.accountIdByName.has(key)) {
      const cached = ctx.accountIdByName.get(key);
      return cached === null || cached === undefined
        ? undefined
        : { id: cached, name };
    }
    let found: { id: number; name: string } | undefined;
    for (let p = 1; p <= 5 && !found; p++) {
      const res = await this.accounts.findAll(
        page(QueryAccountDto, { search: name, limit: 100, page: p }),
      );
      found = res.items.find((a) => lc(a.name) === key);
      if (res.items.length < 100) break;
    }
    ctx?.accountIdByName.set(key, found?.id ?? null);
    return found;
  }

  private async scan<T>(
    fetch: (p: number) => Promise<{ items: T[] }>,
    match: (row: T) => boolean,
  ): Promise<T | undefined> {
    for (let p = 1; p <= 5; p++) {
      const res = await fetch(p);
      const hit = res.items.find(match);
      if (hit) return hit;
      if (res.items.length < 100) return undefined;
    }
    return undefined;
  }

  // --- Entity handlers ---------------------------------------------------

  private buildHandlers(): Record<ImportEntity, Handler> {
    const statusSheet = (
      statusTag: "Call Back" | "Not Interested" | "Keep in Touch",
    ): Handler => {
      const finish = async (accountId: number, data: Dict) => {
        const statusReason = str(data.statusReason);
        const statusDate = str(data.statusDate);
        await this.accounts.changeStatusTag(accountId, {
          statusTag,
          ...(statusReason ? { statusReason } : {}),
          ...(statusDate ? { statusDate } : {}),
        });
        // Legacy keeps the sheet's free-text comments as an activity note
        // (Not Interested already uses them as its required reason).
        const notes = str(data.responseNotes);
        if (notes && statusTag !== "Not Interested") {
          await this.activities.create({
            relatedType: "account",
            relatedId: accountId,
            type: "Note",
            subject: "Imported note",
            notes,
            occurredAt: new Date().toISOString(),
          });
        }
      };
      return {
        readPerm: exact("crm.account.read"),
        writePerms: [exact("crm.account.write")],
        customTarget: "account",
        toDto: (data) =>
          Promise.resolve({
            dto: omitUndefined({
              name: data.companyName,
              website: data.domain,
              email: data.email,
            }),
            errors: [],
          }),
        findDuplicate: async (data, ctx) => {
          const a = await this.findAccountByName(String(data.companyName), ctx);
          return a ? { id: a.id, label: a.name } : undefined;
        },
        create: async (dto, data, ctx) => {
          const account = await this.accounts.create(dto as never);
          ctx.accountIdByName.set(lc(account.name), account.id);
          await finish(account.id, data);
          return account.id;
        },
        update: (id, _dto, data) => finish(id, data),
      };
    };

    return {
      leads: {
        readPerm: scoped("crm.lead.read"),
        writePerms: [scoped("crm.lead.write")],
        customTarget: "lead",
        findDuplicate: async (data) => {
          const company = lc(data.companyName);
          const email = lc(data.email);
          if (!company || !email) return undefined;
          const hit = await this.scan(
            (p) =>
              this.leads.findAll(
                page(QueryLeadDto, { q: email, limit: 100, page: p }),
              ),
            (l) => lc(l.companyName) === company && lc(l.email) === email,
          );
          return hit ? { id: hit.id, label: hit.companyName } : undefined;
        },
        create: async (dto) => (await this.leads.create(dto as never)).id,
        update: async (id, dto) => {
          await this.leads.update(id, dto as never);
        },
      },
      accounts: {
        readPerm: exact("crm.account.read"),
        writePerms: [exact("crm.account.write")],
        customTarget: "account",
        findDuplicate: async (data, ctx) => {
          const a = await this.findAccountByName(String(data.name), ctx);
          return a ? { id: a.id, label: a.name } : undefined;
        },
        create: async (dto, _data, ctx) => {
          const row = await this.accounts.create(dto as never);
          ctx.accountIdByName.set(lc(row.name), row.id);
          return row.id;
        },
        update: async (id, dto) => {
          await this.accounts.update(id, dto as never);
        },
      },
      contacts: {
        readPerm: scoped("crm.contact.read"),
        writePerms: [scoped("crm.contact.write")],
        customTarget: null,
        toDto: async (data, ctx) => {
          const { accountName, ...rest } = data;
          const account = await this.findAccountByName(
            String(accountName),
            ctx,
          );
          if (!account)
            return {
              dto: {},
              errors: [
                `Could not find matching Account "${String(accountName)}" for "Account" — check spelling or create it first`,
              ],
            };
          return { dto: { ...rest, accountId: account.id }, errors: [] };
        },
        // Legacy Contacts import defines no duplicate key.
        findDuplicate: () => Promise.resolve(undefined),
        create: async (dto) => (await this.contacts.create(dto as never)).id,
        update: async (id, dto) => {
          await this.contacts.update(id, dto as never);
        },
      },
      products: {
        readPerm: exact("crm.product.read"),
        writePerms: [exact("crm.product.write")],
        customTarget: null,
        toDto: (data) =>
          Promise.resolve({
            dto: { ...data, isActive: data.isActive ?? true },
            errors: [],
          }),
        findDuplicate: async (data) => {
          const code = lc(data.code);
          const hit = await this.scan(
            (p) =>
              this.products.findAll(
                page(QueryProductDto, {
                  q: String(data.code),
                  limit: 100,
                  page: p,
                }),
              ),
            (r) => lc(r.code) === code,
          );
          return hit ? { id: hit.id, label: hit.name } : undefined;
        },
        create: async (dto) => (await this.products.create(dto as never)).id,
        update: async (id, dto) => {
          await this.products.update(id, dto as never);
        },
      },
      "mining-rows": {
        readPerm: exact("crm.miningrow.read"),
        writePerms: [exact("crm.miningrow.write")],
        customTarget: "miningRow",
        findDuplicate: async (data) => {
          const company = lc(data.companyName);
          const email = lc(data.email);
          if (!company || !email) return undefined;
          const hit = await this.scan(
            (p) =>
              this.miningRows.findAll(
                page(QueryCrmMiningRowDto, {
                  search: String(data.companyName),
                  limit: 100,
                  page: p,
                }),
              ),
            (r) => lc(r.companyName) === company && lc(r.email) === email,
          );
          return hit ? { id: hit.id, label: hit.companyName } : undefined;
        },
        create: async (dto) => (await this.miningRows.create(dto as never)).id,
        update: async (id, dto) => {
          await this.miningRows.update(id, dto as never);
        },
      },
      "cold-calling": {
        readPerm: exact("crm.coldcalling.read"),
        writePerms: [exact("crm.coldcalling.write")],
        customTarget: "coldCalling",
        findDuplicate: async (data) => {
          const company = lc(data.companyName);
          if (!company) return undefined;
          const prospect = lc(data.prospectName);
          const date = str(data.callDate) ?? "";
          const hit = await this.scan(
            (p) =>
              this.coldCalling.findAll(
                page(QueryCrmColdCallingEntryDto, {
                  search: String(data.companyName),
                  limit: 100,
                  page: p,
                }),
              ),
            (r) =>
              lc(r.companyName) === company &&
              lc(r.prospectName) === prospect &&
              (r.callDate ? r.callDate.toISOString().slice(0, 10) : "") ===
                date,
          );
          return hit ? { id: hit.id, label: hit.companyName } : undefined;
        },
        create: async (dto) => (await this.coldCalling.create(dto as never)).id,
        update: async (id, dto) => {
          await this.coldCalling.update(id, dto as never);
        },
      },
      meetings: {
        readPerm: exact("crm.meeting.read"),
        // Creating a meeting may also create its Account + Contact (legacy).
        writePerms: [exact("crm.meeting.write"), exact("crm.account.write")],
        customTarget: "meeting",
        // Legacy Yet to Happen always creates a fresh meeting.
        findDuplicate: () => Promise.resolve(undefined),
        create: async (_dto, data, ctx) => {
          const companyName = String(data.companyName);
          let account = await this.findAccountByName(companyName, ctx);
          if (!account) {
            const created = await this.accounts.create(
              omitUndefined({
                name: companyName,
                website: data.domain,
                email: data.email,
              }) as never,
            );
            account = { id: created.id, name: created.name };
            ctx.accountIdByName.set(lc(created.name), created.id);
            if (str(data.prospectName)) {
              await this.contacts.create(
                omitUndefined({
                  accountId: created.id,
                  name: data.prospectName,
                  designation: data.title,
                  email: data.email,
                  phone: data.contactNumber,
                  isPrimary: true,
                  isDecisionMaker: false,
                }) as never,
              );
            }
          }
          const meetingPlain = omitUndefined({
            relatedType: "account",
            relatedId: account.id,
            mode: "Onsite",
            meetingDate: data.meetingScheduled ?? data.recordDate,
            participants: data.prospectName,
            agenda: data.areaOfInterest ?? data.comments,
          });
          const errs = await dtoErrors(CreateMeetingDto, meetingPlain);
          if (errs.length > 0) throw new Error(errs.join("; "));
          const meeting = await this.meetings.create(meetingPlain as never);
          const status = resolveMeetingStatus(str(data.meetingStatusRaw));
          if (status !== "REQUESTED") {
            await this.meetings.updateStatus(meeting.id, { status } as never);
          }
          return meeting.id;
        },
        update: () => Promise.resolve(),
      },
      opportunities: {
        readPerm: scoped("crm.opportunity.read"),
        writePerms: [scoped("crm.opportunity.write")],
        customTarget: null,
        toDto: async (data, ctx) => {
          const { accountName, contactName, ...rest } = data;
          const account = await this.findAccountByName(
            String(accountName),
            ctx,
          );
          if (!account)
            return {
              dto: {},
              errors: [
                `Could not find matching Account "${String(accountName)}" for "Account" — check spelling or create it first`,
              ],
            };
          let contactId: number | undefined;
          const cName = str(contactName);
          if (cName) {
            const hit = await this.scan(
              (p) =>
                this.contacts.findAll(
                  page(QueryContactDto, { q: cName, limit: 100, page: p }),
                ),
              (c) => lc(c.name) === lc(cName) && c.accountId === account.id,
            );
            if (!hit)
              return {
                dto: {},
                errors: [
                  `Could not find matching Contact "${cName}" for "Contact" — check spelling or create it first`,
                ],
              };
            contactId = hit.id;
          }
          const stage = (
            await this.pipelineStages.findAll(
              this.tenantContext.getOrgScope(),
              this.tenantContext.getUserId(),
            )
          ).find((s) => s.isActive && !s.isWon && !s.isLost && !s.isOnHold);
          if (!stage)
            return {
              dto: {},
              errors: ["No active pipeline stage to import deals into"],
            };
          return {
            dto: omitUndefined({
              ...rest,
              accountId: account.id,
              contactId,
              stageId: stage.id,
            }),
            errors: [],
          };
        },
        findDuplicate: async (data, ctx) => {
          const title = lc(data.title);
          const account = await this.findAccountByName(
            String(data.accountName),
            ctx,
          );
          if (!title || !account) return undefined;
          const hit = await this.scan(
            (p) =>
              this.opportunities.findAll(
                page(QueryOpportunityDto, {
                  q: String(data.title),
                  accountId: account.id,
                  limit: 100,
                  page: p,
                }),
              ),
            (o) => lc(o.title) === title,
          );
          return hit ? { id: hit.id, label: hit.title } : undefined;
        },
        create: async (dto) =>
          (await this.opportunities.create(dto as never)).id,
        update: async (id, dto) => {
          const { stageId: _stageId, ...rest } = dto;
          await this.opportunities.update(id, rest as never);
        },
      },
      "call-back-send-info": statusSheet("Call Back"),
      "not-interested": statusSheet("Not Interested"),
      "keep-in-touch": statusSheet("Keep in Touch"),
    };
  }

  private async fetchExportRows(
    entity: string,
    search: string | undefined,
    limit: number,
  ): Promise<{ rows: Dict[]; total: number }> {
    const pageSize = 100;
    const s = search || undefined;
    const fetchPage = async (
      p: number,
    ): Promise<{ items: Dict[]; total: number }> => {
      switch (entity) {
        case "leads":
          return (await this.leads.findAll(
            page(QueryLeadDto, {
              ...(s ? { q: s } : {}),
              limit: pageSize,
              page: p,
            }),
          )) as unknown as { items: Dict[]; total: number };
        case "accounts":
          return (await this.accounts.findAll(
            page(QueryAccountDto, {
              ...(s ? { search: s } : {}),
              limit: pageSize,
              page: p,
            }),
          )) as unknown as { items: Dict[]; total: number };
        case "contacts": {
          const res = await this.contacts.findAll(
            page(QueryContactDto, {
              ...(s ? { q: s } : {}),
              limit: pageSize,
              page: p,
            }),
          );
          const names = await this.accounts.namesByIds([
            ...new Set(res.items.map((c) => c.accountId)),
          ]);
          return {
            total: res.total,
            items: res.items.map((c) => ({
              ...c,
              accountName: names.get(c.accountId) ?? "",
            })) as unknown as Dict[],
          };
        }
        case "products":
          return (await this.products.findAll(
            page(QueryProductDto, {
              ...(s ? { q: s } : {}),
              limit: pageSize,
              page: p,
            }),
          )) as unknown as { items: Dict[]; total: number };
        case "mining-rows":
          return (await this.miningRows.findAll(
            page(QueryCrmMiningRowDto, {
              ...(s ? { search: s } : {}),
              limit: pageSize,
              page: p,
            }),
          )) as unknown as { items: Dict[]; total: number };
        case "cold-calling":
          return (await this.coldCalling.findAll(
            page(QueryCrmColdCallingEntryDto, {
              ...(s ? { search: s } : {}),
              limit: pageSize,
              page: p,
            }),
          )) as unknown as { items: Dict[]; total: number };
        case "opportunities": {
          const res = await this.opportunities.findAll(
            page(QueryOpportunityDto, {
              ...(s ? { q: s } : {}),
              limit: pageSize,
              page: p,
            }),
          );
          return {
            total: res.total,
            items: res.items.map((o) => ({
              ...o,
              accountName: o.account?.name ?? "",
              contactName: o.contact?.name ?? "",
            })) as unknown as Dict[],
          };
        }
        case "quotations": {
          const res = await this.quotations.findAll(
            page(QueryQuotationDto, {
              ...(s ? { q: s } : {}),
              limit: pageSize,
              page: p,
            }),
          );
          const names = await this.accounts.namesByIds([
            ...new Set(res.items.map((q) => q.accountId)),
          ]);
          return {
            total: res.total,
            items: res.items.map((q) => ({
              ...q,
              accountName: names.get(q.accountId) ?? "",
            })) as unknown as Dict[],
          };
        }
        default:
          throw new NotFoundException(`Entity "${entity}" is not exportable`);
      }
    };

    const rows: Dict[] = [];
    let total = 0;
    for (let p = 1; rows.length < limit; p++) {
      const res = await fetchPage(p);
      total = res.total;
      rows.push(...res.items);
      if (res.items.length < pageSize || rows.length >= res.total) break;
    }
    return { rows: rows.slice(0, limit), total };
  }
}
