import { esc } from "../../../shared/pdf/html.js";
import type { AddressValue, toProfileView } from "./profiles.repository.js";

export type ProfilePdfView = ReturnType<typeof toProfileView>;

/**
 * HTML for the employee profile PDF (legacy "Download PDF" on the profile
 * page). A pure function of the profile view, so it is unit-testable without
 * a browser. It carries the profile only — never PAN, Aadhaar, ESI, PF or
 * bank details, which need the separate sensitive permission — so whoever
 * may read the profile may download it. Every value goes through `esc()`.
 */
export function renderProfileHtml(view: ProfilePdfView, generatedAt: Date) {
  const { employee: e, profile: p } = view;
  const row = (label: string, value: unknown) =>
    `<tr><th>${esc(label)}</th><td>${value === null || value === undefined || value === "" ? "—" : esc(value)}</td></tr>`;
  const address = (a: AddressValue | null) =>
    a
      ? [a.address, a.area, a.district, a.city, a.state, a.pincode, a.country]
          .filter((part) => part)
          .join(", ")
      : null;
  const section = (title: string, rows: string[]) =>
    `<h2>${esc(title)}</h2><table>${rows.join("")}</table>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(e.employeeCode)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #6b7280; margin: 0 0 16px; }
  h2 { font-size: 14px; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #d1d5db; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; width: 35%; font-weight: normal; color: #6b7280; padding: 4px 8px 4px 0; vertical-align: top; }
  td { padding: 4px 0; }
  footer { margin-top: 24px; color: #9ca3af; font-size: 10px; }
</style></head>
<body>
  <h1>${esc([p.title, e.fullName].filter(Boolean).join(" "))}</h1>
  <p class="sub">${esc(e.employeeCode)} · ${esc(e.status)}</p>
  ${section("Employment", [
    row("Date of joining", e.dateOfJoining),
    row("Work e-mail", e.workEmail),
    row("Phone", e.phone),
  ])}
  ${section("Personal", [
    row("Date of birth", p.dateOfBirth),
    row("Gender", p.gender),
    row("Marital status", p.maritalStatus),
    row("Blood group", p.bloodGroup),
    row("Languages", p.languages.join(", ")),
  ])}
  ${section("Family", [
    row("Father", p.fatherName),
    row("Mother", p.motherName),
    row("Spouse", p.spouseName),
  ])}
  ${section("Emergency contact", [
    row("Name", p.emergencyContact.name),
    row("Relation", p.emergencyContact.relation),
    row("Phone", p.emergencyContact.phone),
  ])}
  ${section("Addresses", [
    row("Permanent", address(p.permanentAddress)),
    row("Present", address(p.presentAddress) ?? "Same as permanent"),
  ])}
  ${section("Experience", [
    row("Fresher", p.isFresher ? "Yes" : "No"),
    row("Total experience (years)", p.experienceYears),
    row("Previous company", p.previousCompany),
    row("Previous role", p.previousRole),
  ])}
  <footer>Generated ${esc(generatedAt.toISOString().slice(0, 16).replace("T", " "))} UTC</footer>
</body></html>`;
}
