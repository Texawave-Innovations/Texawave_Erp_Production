import { formatDateOnly } from "../../../common/dates/date-only.js";

/**
 * Pure rules for offer letters (legacy `OfferLetter.tsx`, `OfferLetterTemplate.ts`).
 * Legacy form prefills. The backend applies these only when a create request
 * omits the field, exactly as the revision-letter defaults are applied.
 */
export const OFFER_LETTER_DEFAULTS = {
  location: "Chennai",
  reportingManager: "Mr. Nithyanandan Ramaraj",
  workScheduleMonFri: "10:00 AM – 7:00 PM",
  workScheduleSat: "10:00 AM – 7:00 PM",
  workScheduleSun: "Week Off",
  signatoryName: "Amanullah Khan",
  signatoryDesignation: "Co-Founder",
  companyEmail: "contact@texawave.com",
  companyPhone: "+91 9361360821",
  companyWebsite: "www.texawave.com",
  companyAddress:
    "No. 93/206, Canal Bank Road, Indra Nagar, Adyar, Chennai – 600020",
} as const;

/** Legacy: the offer stays valid for 7 days from the offer date. */
export const OFFER_VALIDITY_DAYS = 7;

/** `YYYY-MM-DD` plus whole days, computed in UTC. */
export function addDays(date: Date, days: number): string {
  const shifted = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
    ),
  );
  return formatDateOnly(shifted);
}

/** Legacy default validity: offer date + 7 days. */
export function defaultValidityDate(offerDate: Date): string {
  return addDays(offerDate, OFFER_VALIDITY_DAYS);
}
