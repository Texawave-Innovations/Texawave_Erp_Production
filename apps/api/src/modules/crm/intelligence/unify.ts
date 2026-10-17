// CRM Intelligence Layer — read-only aggregation of the 9 company-level source tabs into a
// single unified shape (Feature 4/5's data backbone, also powering the Dashboard/Search/Calendar/
// Analytics). Pure functions only — never touches Firebase, never mutates source data.
import {
  AccountsMiningSheetData,
  CallBackSendInfoSheetData,
  ColdCallingSheetData,
  KeepInTouchSheetData,
  LeadsSheetData,
  LinkedInSheetData,
  NotInterestedSheetData,
  WhatsAppSheetData,
  YetToHappenSheetData,
} from "../types";
import { looksClosedOut, parseLooseDate } from "../notifications/dateUtils";
import { CompanyProfile, CrmSourceTabKey, UnifiedCrmActivity } from "./types";
import { slugifyCompanyKey, startOfToday } from "./shared";

export interface CrmAllSources {
  accountsMiningSheet: AccountsMiningSheetData;
  coldCalling: ColdCallingSheetData;
  leads: LeadsSheetData;
  yetToHappen: YetToHappenSheetData;
  callBackSendInfo: CallBackSendInfoSheetData;
  notInterested: NotInterestedSheetData;
  keepInTouch: KeepInTouchSheetData;
  whatsapp: WhatsAppSheetData;
  linkedin: LinkedInSheetData;
}

export const EMPTY_CRM_SOURCES: CrmAllSources = {
  accountsMiningSheet: {},
  coldCalling: {},
  leads: {},
  yetToHappen: {},
  callBackSendInfo: {},
  notInterested: {},
  keepInTouch: {},
  whatsapp: {},
  linkedin: {},
};

function mapRows<T extends Record<string, unknown>>(
  data: Record<string, T> | undefined,
  sourceTab: CrmSourceTabKey,
  toActivity: (id: string, row: T) => UnifiedCrmActivity,
): UnifiedCrmActivity[] {
  return Object.entries(data || {}).map(([id, row]) => toActivity(id, row));
}

export function buildActivities(sources: CrmAllSources): UnifiedCrmActivity[] {
  const out: UnifiedCrmActivity[] = [];

  out.push(
    ...mapRows(
      sources.accountsMiningSheet,
      "accountsMiningSheet",
      (id, row) => {
        const entryDate = parseLooseDate(row.date);
        return {
          id: `accountsMiningSheet_${id}`,
          companyKey: slugifyCompanyKey(
            row.companyName,
            `accountsMiningSheet_${id}`,
          ),
          sourceTab: "accountsMiningSheet",
          sourceRowId: id,
          activityKind: "mining",
          companyName: row.companyName || "",
          domain: row.domain || undefined,
          prospectName: row.keyDecisionMakers || undefined,
          title: row.title || undefined,
          email: row.email || undefined,
          contactNumber: row.contactNumber || undefined,
          statusText: row.followUpStatus || row.emailStatus || undefined,
          entryDateRaw: row.date,
          entryDate,
          dueRaw: undefined,
          dueDate: null,
          comments: undefined,
          isClosedOut: false,
          extra: {
            website: row.website,
            hq: row.hq,
            serialNo: row.serialNo,
            emailStatus: row.emailStatus,
          },
        };
      },
    ),
  );

  out.push(
    ...mapRows(sources.coldCalling, "coldCalling", (id, row) => {
      const entryDate = parseLooseDate(row.date);
      return {
        id: `coldCalling_${id}`,
        companyKey: slugifyCompanyKey(row.companyName, `coldCalling_${id}`),
        sourceTab: "coldCalling",
        sourceRowId: id,
        activityKind: "followup",
        companyName: row.companyName || "",
        domain: undefined,
        prospectName: row.prospectName || undefined,
        title: row.designation || undefined,
        email: undefined,
        contactNumber: undefined,
        // The original cold-calling outcome text, preserved exactly — never rewritten by a later
        // "Route Status" disposition (see `extra.dispositionTag` below).
        statusText: row.status || undefined,
        entryDateRaw: row.date,
        entryDate,
        dueRaw: undefined,
        dueDate: null,
        comments: undefined,
        // Only closed out once a person has explicitly routed it to the terminal Not Interested
        // disposition — an un-routed row (or one routed to a still-active queue) stays open.
        isClosedOut: row.dispositionTag === "Not Interested",
        extra: {
          serialNo: row.serialNo,
          dispositionTag: row.dispositionTag,
          linkedAccountId: row.linkedAccountId,
          linkedAccountName: row.linkedAccountName,
        },
      };
    }),
  );

  out.push(
    ...mapRows(sources.leads, "leads", (id, row) => {
      const entryDate = parseLooseDate(row.date);
      return {
        id: `leads_${id}`,
        companyKey: slugifyCompanyKey(row.companyName, `leads_${id}`),
        sourceTab: "leads",
        sourceRowId: id,
        activityKind: "meeting",
        companyName: row.companyName || "",
        domain: row.domain || undefined,
        prospectName: row.prospectName || undefined,
        title: row.title || undefined,
        email: row.email || undefined,
        contactNumber: row.contactNumber || undefined,
        statusText: row.meetingStatus || undefined,
        entryDateRaw: row.date,
        entryDate,
        dueRaw: row.meetingScheduled || row.date,
        // `meetingScheduled` is free text — when it's present but doesn't parse as a date (e.g.
        // "call first to confirm"), fall back to `entryDate` instead of losing the due date
        // entirely; that's what happened here whenever `row.date` was the only parseable field.
        dueDate:
          (row.meetingScheduled && parseLooseDate(row.meetingScheduled)) ||
          entryDate,
        comments: row.comments,
        isClosedOut: looksClosedOut(row.meetingStatus),
        extra: {
          hq: row.hq,
          areaOfInterest: row.areaOfInterest,
          month: row.month,
          meetingScheduled: row.meetingScheduled,
        },
      };
    }),
  );

  out.push(
    ...mapRows(sources.yetToHappen, "yetToHappen", (id, row) => {
      const entryDate = parseLooseDate(row.date);
      return {
        id: `yetToHappen_${id}`,
        companyKey: slugifyCompanyKey(row.companyName, `yetToHappen_${id}`),
        sourceTab: "yetToHappen",
        sourceRowId: id,
        activityKind: "meeting",
        companyName: row.companyName || "",
        domain: row.domain || undefined,
        prospectName: row.prospectName || undefined,
        title: row.title || undefined,
        email: row.email || undefined,
        contactNumber: row.contactNumber || undefined,
        statusText: row.meetingStatus || undefined,
        entryDateRaw: row.date,
        entryDate,
        dueRaw: row.meetingScheduled || row.date,
        // Same fallback as the `leads` mapping above — an unparseable `meetingScheduled` must not
        // drop the due date when `entryDate` is available.
        dueDate:
          (row.meetingScheduled && parseLooseDate(row.meetingScheduled)) ||
          entryDate,
        comments: row.comments,
        isClosedOut: looksClosedOut(row.meetingStatus),
        extra: {
          hq: row.hq,
          areaOfInterest: row.areaOfInterest,
          meetingScheduled: row.meetingScheduled,
        },
      };
    }),
  );

  out.push(
    ...mapRows(sources.callBackSendInfo, "callBackSendInfo", (id, row) => {
      const entryDate = parseLooseDate(row.date);
      const dueDate = parseLooseDate(row.nextFollowUp);
      return {
        id: `callBackSendInfo_${id}`,
        companyKey: slugifyCompanyKey(
          row.companyName,
          `callBackSendInfo_${id}`,
        ),
        sourceTab: "callBackSendInfo",
        sourceRowId: id,
        activityKind: "followup",
        companyName: row.companyName || "",
        domain: row.domain || undefined,
        prospectName: row.prospectName || undefined,
        title: row.title || undefined,
        email: row.email || undefined,
        contactNumber: undefined,
        statusText: undefined,
        entryDateRaw: row.date,
        entryDate,
        dueRaw: row.nextFollowUp,
        dueDate,
        comments: row.comments,
        isClosedOut: false,
        extra: { source: row.source },
      };
    }),
  );

  out.push(
    ...mapRows(sources.notInterested, "notInterested", (id, row) => {
      const entryDate = parseLooseDate(row.date);
      return {
        id: `notInterested_${id}`,
        companyKey: slugifyCompanyKey(row.companyName, `notInterested_${id}`),
        sourceTab: "notInterested",
        sourceRowId: id,
        activityKind: "closed",
        companyName: row.companyName || "",
        domain: row.domain || undefined,
        prospectName: row.prospectName || undefined,
        title: row.title || undefined,
        email: row.email || undefined,
        contactNumber: undefined,
        statusText: "Not Interested",
        entryDateRaw: row.date,
        entryDate,
        dueRaw: undefined,
        dueDate: null,
        comments: row.comments,
        isClosedOut: true,
        extra: { source: row.source },
      };
    }),
  );

  out.push(
    ...mapRows(sources.keepInTouch, "keepInTouch", (id, row) => {
      const entryDate = parseLooseDate(row.date);
      const dueDate = parseLooseDate(row.nextFollowUp);
      return {
        id: `keepInTouch_${id}`,
        companyKey: slugifyCompanyKey(row.companyName, `keepInTouch_${id}`),
        sourceTab: "keepInTouch",
        sourceRowId: id,
        activityKind: "followup",
        companyName: row.companyName || "",
        domain: undefined,
        prospectName: row.prospectName || undefined,
        title: row.title || undefined,
        email: row.email || undefined,
        contactNumber: undefined,
        statusText: undefined,
        entryDateRaw: row.date,
        entryDate,
        dueRaw: row.nextFollowUp,
        dueDate,
        comments: row.comments,
        isClosedOut: false,
        extra: { source: row.source },
      };
    }),
  );

  out.push(
    ...mapRows(sources.whatsapp, "whatsapp", (id, row) => {
      const entryDate = parseLooseDate(row.date);
      const dueDate = parseLooseDate(row.followUpDate);
      return {
        id: `whatsapp_${id}`,
        companyKey: slugifyCompanyKey(row.companyName, `whatsapp_${id}`),
        sourceTab: "whatsapp",
        sourceRowId: id,
        activityKind: "followup",
        companyName: row.companyName || "",
        domain: undefined,
        prospectName: row.prospectName || undefined,
        title: row.title || undefined,
        email: undefined,
        contactNumber: row.contactNumber || undefined,
        statusText: row.status || undefined,
        entryDateRaw: row.date,
        entryDate,
        dueRaw: row.followUpDate,
        dueDate,
        comments: row.comments,
        isClosedOut: looksClosedOut(row.status),
        extra: {
          source: row.source,
          message: row.message,
          response: row.response,
        },
      };
    }),
  );

  out.push(
    ...mapRows(sources.linkedin, "linkedin", (id, row) => {
      const entryDate = parseLooseDate(row.date);
      const dueDate = parseLooseDate(row.followUpDate);
      return {
        id: `linkedin_${id}`,
        companyKey: slugifyCompanyKey(row.companyName, `linkedin_${id}`),
        sourceTab: "linkedin",
        sourceRowId: id,
        activityKind: "followup",
        companyName: row.companyName || "",
        domain: row.domain || undefined,
        prospectName: row.prospectName || undefined,
        title: row.title || undefined,
        email: undefined,
        contactNumber: undefined,
        statusText: row.connectionStatus || undefined,
        entryDateRaw: row.date,
        entryDate,
        dueRaw: row.followUpDate,
        dueDate,
        comments: row.comments,
        isClosedOut: looksClosedOut(row.connectionStatus),
        extra: {
          source: row.source,
          profileUrl: row.profileUrl,
          message: row.message,
          response: row.response,
        },
      };
    }),
  );

  return out;
}

/** Groups unified activities into one CompanyProfile per `companyKey` (Feature 4 — Company 360 view). */
export function buildCompanyProfiles(
  activities: UnifiedCrmActivity[],
): Map<string, CompanyProfile> {
  const map = new Map<string, CompanyProfile>();

  for (const a of activities) {
    let profile = map.get(a.companyKey);
    if (!profile) {
      profile = {
        companyKey: a.companyKey,
        companyName: a.companyName || "Unknown Company",
        domains: [],
        activities: [],
        tabsPresent: [],
        contacts: [],
        lastActivity: null,
        nextMeeting: null,
        nextFollowUp: null,
      };
      map.set(a.companyKey, profile);
    }
    if (!profile.companyName && a.companyName)
      profile.companyName = a.companyName;
    if (a.domain && !profile.domains.includes(a.domain))
      profile.domains.push(a.domain);
    if (!profile.tabsPresent.includes(a.sourceTab))
      profile.tabsPresent.push(a.sourceTab);
    if (
      a.prospectName &&
      !profile.contacts.some(
        (c) => c.name === a.prospectName && c.sourceTab === a.sourceTab,
      )
    ) {
      profile.contacts.push({
        name: a.prospectName,
        title: a.title,
        email: a.email,
        contactNumber: a.contactNumber,
        sourceTab: a.sourceTab,
      });
    }
    profile.activities.push(a);
  }

  const today = startOfToday().getTime();
  map.forEach((profile) => {
    profile.activities.sort(
      (x, y) => (y.entryDate?.getTime() || 0) - (x.entryDate?.getTime() || 0),
    );
    profile.lastActivity = profile.activities[0] || null;

    const upcomingMeetings = profile.activities
      .filter(
        (a) =>
          a.activityKind === "meeting" &&
          a.dueDate &&
          !a.isClosedOut &&
          a.dueDate.getTime() >= today,
      )
      .sort((x, y) => x.dueDate!.getTime() - y.dueDate!.getTime());
    profile.nextMeeting = upcomingMeetings[0] || null;

    const upcomingFollowUps = profile.activities
      .filter(
        (a) => a.activityKind === "followup" && a.dueDate && !a.isClosedOut,
      )
      .sort((x, y) => x.dueDate!.getTime() - y.dueDate!.getTime());
    profile.nextFollowUp =
      upcomingFollowUps.find((a) => a.dueDate!.getTime() >= today) ||
      upcomingFollowUps[upcomingFollowUps.length - 1] ||
      null;
  });

  return map;
}
