import { Injectable } from "@nestjs/common";
import { AccountsRepository } from "../accounts/accounts.repository.js";
import { ActivitiesRepository } from "../activities/activities.repository.js";
import { CrmColdCallingRepository } from "../cold-calling/cold-calling.repository.js";
import { ContactsRepository } from "../contacts/contacts.repository.js";
import { CrmDocumentsRepository } from "../documents/documents.repository.js";
import { FollowUpsRepository } from "../follow-ups/follow-ups.repository.js";
import { LeadsRepository } from "../leads/leads.repository.js";
import { MeetingsRepository } from "../meetings/meetings.repository.js";
import { CrmMiningRowsRepository } from "../mining-rows/mining-rows.repository.js";
import { CrmNotesRepository } from "../notes/notes.repository.js";
import { OpportunitiesRepository } from "../opportunities/opportunities.repository.js";
import { OpportunityProductsRepository } from "../opportunities/opportunity-products.repository.js";
import { PipelineStagesRepository } from "../pipeline-stages/pipeline-stages.repository.js";
import { ProductsRepository } from "../products/products.repository.js";
import { CrmQuotasRepository } from "../quotas/quotas.repository.js";
import { QuotationsRepository } from "../quotations/quotations.repository.js";
import { CrmTasksRepository } from "../tasks/tasks.repository.js";
import { toItem, type RecycleBinHandler } from "./recycle-bin.registry.js";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** The registry of every CRM entity that soft-deletes. Each handler only
 * delegates to the owning module's repository - no Prisma here. */
@Injectable()
export class RecycleBinHandlers {
  readonly all: RecycleBinHandler[];

  constructor(
    accounts: AccountsRepository,
    leads: LeadsRepository,
    contacts: ContactsRepository,
    opportunities: OpportunitiesRepository,
    dealProducts: OpportunityProductsRepository,
    stages: PipelineStagesRepository,
    products: ProductsRepository,
    quotations: QuotationsRepository,
    meetings: MeetingsRepository,
    followUps: FollowUpsRepository,
    activities: ActivitiesRepository,
    tasks: CrmTasksRepository,
    documents: CrmDocumentsRepository,
    notes: CrmNotesRepository,
    coldCalling: CrmColdCallingRepository,
    miningRows: CrmMiningRowsRepository,
    quotas: CrmQuotasRepository,
  ) {
    this.all = [
      {
        entityType: "account",
        entityTypeLabel: "Account",
        list: async (s) =>
          (await accounts.findDeleted(s)).map((r) =>
            toItem("account", "Account", r, r.name, r.industry),
          ),
        restore: (s, id, a) => accounts.restoreDeleted(s, id, a),
        purge: (s, id) => accounts.purgeDeleted(s, id),
      },
      {
        entityType: "lead",
        entityTypeLabel: "Lead",
        list: async (s) =>
          (await leads.findDeleted(s)).map((r) =>
            toItem("lead", "Lead", r, r.companyName, r.prospectName),
          ),
        restore: (s, id, a) => leads.restoreDeleted(s, id, a),
        purge: (s, id) => leads.purgeDeleted(s, id),
      },
      {
        entityType: "contact",
        entityTypeLabel: "Contact",
        list: async (s) =>
          (await contacts.findDeleted(s)).map((r) =>
            toItem("contact", "Contact", r, r.name),
          ),
        restore: (s, id, a) => contacts.restoreDeleted(s, id, a),
        purge: (s, id) => contacts.purgeDeleted(s, id),
      },
      {
        entityType: "opportunity",
        entityTypeLabel: "Deal",
        list: async (s) =>
          (await opportunities.findDeleted(s)).map((r) =>
            toItem("opportunity", "Deal", r, r.title, r.opportunityNumber),
          ),
        restore: (s, id, a) => opportunities.restoreDeleted(s, id, a),
        purge: (s, id) => opportunities.purgeDeleted(s, id),
      },
      {
        entityType: "deal_product",
        entityTypeLabel: "Deal Product",
        list: async (s) =>
          (await dealProducts.findDeleted(s)).map((r) =>
            toItem("deal_product", "Deal Product", r, r.productName),
          ),
        restore: (s, id, a) => dealProducts.restoreDeleted(s, id, a),
        purge: (s, id) => dealProducts.purgeDeleted(s, id),
      },
      {
        entityType: "pipeline_stage",
        entityTypeLabel: "Pipeline Stage",
        list: async (s) =>
          (await stages.findDeleted(s)).map((r) =>
            toItem("pipeline_stage", "Pipeline Stage", r, r.label, r.code),
          ),
        restore: (s, id, a) => stages.restoreDeleted(s, id, a),
        purge: (s, id) => stages.purgeDeleted(s, id),
      },
      {
        entityType: "product",
        entityTypeLabel: "Product",
        list: async (s) =>
          (await products.findDeleted(s)).map((r) =>
            toItem("product", "Product", r, r.name, r.code),
          ),
        restore: (s, id, a) => products.restoreDeleted(s, id, a),
        purge: (s, id) => products.purgeDeleted(s, id),
      },
      {
        entityType: "quotation",
        entityTypeLabel: "Quotation",
        list: async (s) =>
          (await quotations.findDeleted(s)).map((r) =>
            toItem("quotation", "Quotation", r, r.quotationNumber, r.subject),
          ),
        restore: (s, id, a) => quotations.restoreDeleted(s, id, a),
        purge: (s, id) => quotations.purgeDeleted(s, id),
      },
      {
        entityType: "meeting",
        entityTypeLabel: "Meeting",
        list: async (s) =>
          (await meetings.findDeleted(s)).map((r) =>
            toItem(
              "meeting",
              "Meeting",
              r,
              `${r.mode} meeting - ${day(r.meetingDate)}`,
              r.agenda,
            ),
          ),
        restore: (s, id, a) => meetings.restoreDeleted(s, id, a),
        purge: (s, id) => meetings.purgeDeleted(s, id),
      },
      {
        entityType: "follow_up",
        entityTypeLabel: "Follow-up",
        list: async (s) =>
          (await followUps.findDeleted(s)).map((r) =>
            toItem(
              "follow_up",
              "Follow-up",
              r,
              `${r.type} follow-up - ${day(r.scheduledAt)}`,
              r.notes,
            ),
          ),
        restore: (s, id, a) => followUps.restoreDeleted(s, id, a),
        purge: (s, id) => followUps.purgeDeleted(s, id),
      },
      {
        entityType: "activity",
        entityTypeLabel: "Activity",
        list: async (s) =>
          (await activities.findDeleted(s)).map((r) =>
            toItem("activity", "Activity", r, r.subject, r.type),
          ),
        restore: (s, id, a) => activities.restoreDeleted(s, id, a),
        purge: (s, id) => activities.purgeDeleted(s, id),
      },
      {
        entityType: "task",
        entityTypeLabel: "Task",
        list: async (s) =>
          (await tasks.findDeleted(s)).map((r) =>
            toItem("task", "Task", r, r.title, r.assignedTo),
          ),
        restore: (s, id, a) => tasks.restoreDeleted(s, id, a),
        purge: (s, id) => tasks.purgeDeleted(s, id),
      },
      {
        entityType: "document",
        entityTypeLabel: "Document",
        list: async (s) =>
          (await documents.findDeleted(s)).map((r) =>
            toItem("document", "Document", r, r.name, r.link),
          ),
        restore: (s, id, a) => documents.restoreDeleted(s, id, a),
        purge: (s, id) => documents.purgeDeleted(s, id),
      },
      {
        entityType: "note",
        entityTypeLabel: "Note",
        list: async (s) =>
          (await notes.findDeleted(s)).map((r) =>
            toItem("note", "Note", r, r.content.slice(0, 80)),
          ),
        restore: (s, id, a) => notes.restoreDeleted(s, id, a),
        purge: (s, id) => notes.purgeDeleted(s, id),
      },
      {
        entityType: "cold_calling",
        entityTypeLabel: "Cold Calling",
        list: async (s) =>
          (await coldCalling.findDeleted(s)).map((r) =>
            toItem(
              "cold_calling",
              "Cold Calling",
              r,
              r.companyName,
              r.prospectName,
            ),
          ),
        restore: (s, id, a) => coldCalling.restoreDeleted(s, id, a),
        purge: (s, id) => coldCalling.purgeDeleted(s, id),
      },
      {
        entityType: "mining_row",
        entityTypeLabel: "Account Mining",
        list: async (s) =>
          (await miningRows.findDeleted(s)).map((r) =>
            toItem("mining_row", "Account Mining", r, r.companyName, r.domain),
          ),
        restore: (s, id, a) => miningRows.restoreDeleted(s, id, a),
        purge: (s, id) => miningRows.purgeDeleted(s, id),
      },
      {
        entityType: "quota",
        entityTypeLabel: "Quota",
        list: async (s) =>
          (await quotas.findDeleted(s)).map((r) =>
            toItem("quota", "Quota", r, `${r.periodKey} quota`, r.metric),
          ),
        restore: (s, id, a) => quotas.restoreDeleted(s, id, a),
        purge: (s, id) => quotas.purgeDeleted(s, id),
      },
    ];
  }
}
