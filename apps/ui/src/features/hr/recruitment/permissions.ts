// Permission codes the Recruitment screens check. The backend is the
// security boundary; these only decide what the UI offers.
//
// Interviews and offers are organization-wide (exact codes). Revision letters
// are team-scoped through the employee, so the seeded `.own/.team/.all`
// variants are all accepted (see scopedPermission in the catalog).

function scoped(code: string): string[] {
  return [`${code}.own`, `${code}.team`, `${code}.all`];
}

export const RECRUITMENT_PERMISSIONS = {
  interviewRead: ["hr.interview.read"],
  interviewWrite: ["hr.interview.write"],
  offerRead: ["hr.offer_letter.read"],
  offerWrite: ["hr.offer_letter.write"],
  revisionRead: scoped("hr.revision_letter.read"),
  revisionWrite: scoped("hr.revision_letter.write"),
  // Promotion letters follow revision letters. Writing is offered only to
  // `.team`/`.all` holders: the API refuses `.own` writes outright.
  promotionRead: scoped("hr.promotion_letter.read"),
  promotionWrite: [
    "hr.promotion_letter.write.team",
    "hr.promotion_letter.write.all",
  ],
  // The promotion form's designation dropdown is the master list.
  designationRead: ["master.designation.read"],
  designationWrite: ["master.designation.write"],
  employeeRead: scoped("hr.employee.read"),
} as const;
