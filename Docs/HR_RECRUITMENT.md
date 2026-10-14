# HR → Recruitment Module UI/UX Architecture & Documentation

## 1. Executive Summary

The **HR → Recruitment & Onboarding** module in TEXA ERP has been upgraded into a production-ready enterprise HR interface. The implementation balances three core tenets:

1. **Old ERP Parity:** Complete preservation of recruitment business content, form fields, document wording, and compensation calculations.
2. **Current ERP Architecture:** Zero breaking changes to API contracts (`/hr/interviews`, `/hr/offer-letters`, `/hr/revision-letters`, `/hr/employees`), permission gates, or database schema.
3. **TEXA ERP Design System:** Modern, calm enterprise SaaS aesthetic utilizing standard design tokens, brand palette (`#06ba32`), Nunito Sans typography, compact headers, and responsive split-pane workspaces.

---

## 2. Navigation & Module Structure

The recruitment module is located at `/hr/recruitment` (`RecruitmentView.tsx`).

### Breadcrumbs & Header

- **Breadcrumbs:** `Home › HR › Recruitment`
- **Accessible Heading:** `Recruitment & onboarding` (accessible for screen readers and Playwright E2E locators)
- **Subtitle:** Contextual summary of recruitment pipeline and document actions.

### Tab Navigation

The module features four tabs:

1. **Interview Schedule** (`InterviewsPanel.tsx`)
2. **Offer Letter** (`OffersPanel.tsx`)
3. **Revision Letter** (`RevisionsPanel.tsx`)
4. **Candidates** (`CandidatesPanel.tsx`)

#### Permission Gating

Tabs are conditionally rendered based on role permissions:

- `Interview Schedule`: requires `hr.interview.read`
- `Offer Letter`: requires `hr.offer_letter.read`
- `Revision Letter`: requires `hr.revision_letter.read.*`
- `Candidates`: requires full recruitment reading permissions (`canReadInterviews && canReadOffers && canReadRevisions`), preserving single-tab presentation for constrained users.

---

## 3. Workflows & Screen Architecture

### A. Screen 1 — Interview Schedule (List View)

- **Management Toolbar:**
  - Search input (`aria-label="Search interviews"`): debounced multi-field matching (candidate name, role title, interviewer name).
  - Role dropdown: dynamic list of roles extracted from interviews.
  - Status dropdown (`aria-label="Filter by status"`): `All statuses`, `SCHEDULED`, `COMPLETED`, `SELECTED`, `REJECTED`, `NO_SHOW`.
  - Date picker filter & quick "Reset" action.
  - Primary button: `+ Schedule Interview` (`aria-label` / name: `"Schedule interview"`).
- **Scheduled Interviews Table:**
  - **Candidate Identity:** Deterministic initials avatar circle (palette tokens), bold candidate name, notes/email snippet.
  - **Role / Position:** Position title.
  - **Interviewer:** Assigned tech lead or HR interviewer.
  - **Schedule:** Formatted date (`formatDate`) and time.
  - **Mode:** Badges with icons (`Video` for Online, `User` for In-person, `Phone` for Phone).
  - **Status:** Accessible `StatusBadge` paired with an inline status changer select (`aria-label="Change status for ${item.candidateName}"`).
  - **Actions:** View modal trigger.
- **Pagination Footer:** Displays `Showing X to Y of Z interviews` with page controls.

---

### B. Screen 2 — Interview Schedule (Create View)

When the user clicks `Schedule interview`, `InterviewsPanel` transitions into the dedicated multi-step creation view matching the reference:

- **Header:** Back button (`Back to interviews`), title `Schedule Interview`, subtitle `Enter the candidate and interview details.`
- **Step 1: Candidate Information (`FormSection stepNumber="1"`):**
  - Candidate name * (with validation: min 2 characters)
  - Email address
  - Phone number
  - Role / Position *
  - Apply for / Department dropdown (populated from `useDepartments`)
  - Source dropdown (Direct Application, Referral, LinkedIn, Campus, Job Portal)
- **Step 2: Interview Details (`FormSection stepNumber="2"`):**
  - Interviewer *
  - Interview date *
  - Start time *
  - End time
  - Interview mode * (Radio group: Online video call, On-site office, Phone call)
  - Location / Meeting link
- **Step 3: Additional Information (`FormSection stepNumber="3"`):**
  - Notes / Instructions textarea
- **Actions:**
  - `Cancel`: returns to list view without submitting.
  - `+ Save interview`: submits form data via `POST /hr/interviews`. Extended metadata (email, phone, department, meeting link) is serialized into notes to preserve the backend API contract.

---

### C. Screen 3 — Offer Letter Workspace (Split View)

`OffersPanel.tsx` presents a two-column workspace with live document synchronization:

#### Sub-Navigation

- `Generator & Preview`: Screen 3 live workspace.
- `Offer Letters History`: DataTable of generated offer letters with status badges and Edit/View actions.

#### Left Column: Offer Details & Configuration (`OfferForm.tsx`)

- **Step 1: Candidate Information:** Candidate name *, Designation *, Location *, Reporting manager, Offer date *, Date of joining *, Offer valid until.
- **Step 2: Compensation Details:**
  - Pay type selector (Monthly vs Annual).
  - Total CTC input: Automatically splits into statutory formula (Basic 35%, DA 15%, HRA 30%, CA 20%).
  - Manual overrides for Basic salary, HRA, Conveyance, Other allowances (DA).
  - Summary badges: Monthly Net and Gross Annual CTC.
- **Step 3: Working Schedule:** Mon – Fri hours, Saturday hours, Sunday weekly off.
- **Step 4: Signatory & Organization:** Authorized signatory name, designation, company contact and registered address.
- **Actions:** `Cancel` and `Save Offer Letter` (`POST /hr/offer-letters`).

#### Right Column: Live Document Preview (`OfferLetterDocument.tsx`)

- **Header:** "Document Preview" header with page switcher (`All`, `Page 1`, `Page 2`) and `Download PDF` action (triggers clean print output).
- **Exact High-Fidelity 2-Page Document Formatting (`Offer_Letter_kumar (4).pdf`):**
  - **Outer Frame:** Solid green border (`#5aa846`) surrounding each page.
  - **Company Header:** TEXA vector SVG logo and `TEXAWAVE INNOVATIONS PRIVATE LIMITED` in bold green (`#439234`).
  - **Title Banner:** Centered green banner (`#78b449`) with uppercase white text `OFFER LETTER`.
  - **Issue Date:** Right-aligned `Date: DD/MM/YYYY`.
  - **Framed Recipient Box:** Green-bordered rounded box with `TO`, candidate name (uppercase bold), and location.
  - **Subject & Salutation:** `Subject: Offer of Employment` and `Dear [First Name],`.
  - **Introductory Terms:** Formal appointment statement, role confirmation, and background acknowledgment.
  - **Numbered Clauses in Exact Reference Sequence:**
    1. `1. POSITION & REPORTING STRUCTURE` (appointed role, reporting manager, duties).
    2. `2. DATE OF JOINING` (joining date DD/MM/YYYY, management approval clause).
    3. `3. COMPENSATION STRUCTURE` (Annual CTC amount in Indian format `₹ X,XX,XXX per annum`).
    - **Compensation Table:**
      - Headers: `COMPONENT` | `AMOUNT (INR)` (white text on `#78b449`).
      - Rows: Basic, DA, HRA, CA (Conveyance Allowance), Net Monthly Salary, Gross Monthly CTC, and highlighted `GROSS ANNUAL CTC` row.
  - **Page 2 Continuation:** 4. `4. WORKING HOURS & EMPLOYMENT TYPE` (Full-Time employee text and working hours table for Mon–Fri, Saturday, Sunday). 5. `5. PROBATION PERIOD` (3 months probation, evaluation, extension, and written confirmation clauses). 6. `6. CODE OF CONDUCT & COMPANY POLICIES` (IT Usage, Attendance & Leave, Harassment Prevention, Data Protection, Confidentiality). 7. `7. CONFIDENTIALITY & IP OWNERSHIP` (Exclusive intellectual property clause). 8. `8. BACKGROUND VERIFICATION` (Education, identity, employment verification). 9. `9. NOTICE PERIOD & TERMINATION CLAUSE` (15 days during probation, 60 days after confirmation). 10. `10. OFFER VALIDITY` (Validity date DD/MM/YYYY and duplicate copy acceptance clause).
  - **Signatory & Acceptance Section:**
    - Left framed box: `For TexaWave Innovations Pvt Ltd,` signature script, signatory name, and designation.
    - Right framed box: `ACCEPTANCE OF OFFER` header with Signature and Date blanks.
  - **Footer (Both Pages):** Registered company email, phone, website, and physical address.

---

### D. Screen 4 — Revision Letter Workspace (Split View)

`RevisionsPanel.tsx` presents a two-column workspace for issuing salary revision letters:

#### Sub-Navigation & Directory

- `Issue Revision`: Workspace or Employee Directory.
- `Revision History`: Issued revision letters history table with document numbers.
- **Employee Directory Table:** Searchable employee listing with `Issue revision letter to ${emp.fullName}` action.

#### Left Column: Revision Details & Configuration (`RevisionForm.tsx`)

- **Step 1: Revision Details:**
  - Employee: read-only selected employee name and ID.
  - Designation *: prefilled with the employee's current role (`getByLabel(/^Designation/)`).
  - Department: auto-filled team/department.
  - Effective date *: date input (`getByLabel(/^Effective date/)`).
  - Revision type: dropdown (Annual Appraisal, Promotion, Market Correction, Performance Bonus, Off-cycle).
  - Location *.
- **Step 2: Compensation Adjustments:**
  - Current CTC (Annual) ₹.
  - Revised CTC (Annual) ₹.
  - Increment % and Increment amount ₹ (bi-directionally synchronized).
  - Monthly component breakdown inputs (Basic, HRA, CA, DA).
  - Revised monthly and annual totals.
- **Step 3: Remarks & Signatory:**
  - Remarks (optional).
  - Signatory name and designation.
- **Actions:** `Cancel` and `Issue revision letter` (exact accessible name matching e2e locator).

#### Right Column: Live Output Preview (`RevisionLetterDocument.tsx`)

- **Header:** Document Preview title with page switcher (`All`, `Page 1`, `Page 2`) and `Download PDF` button.
- **Exact High-Fidelity 2-Page Document Formatting (`Revision_Letter_Keerthivasan.pdf`):**
  - **Outer Frame:** Solid green border (`#5aa846`) surrounding each page.
  - **Company Header:** TEXA vector SVG logo and `TEXAWAVE INNOVATIONS PRIVATE LIMITED` in bold green (`#439234`).
  - **Title Banner:** Centered green banner (`#78b449`) with uppercase white text `SALARY REVISION LETTER`.
  - **Metadata Row:** Left-aligned `Document No: TW/HR/REV/...` and right-aligned `Date: DD/MM/YYYY`.
  - **Framed Recipient Box:** Green-bordered rounded box with `TO,`, employee name (uppercase bold), and designation.
  - **Introductory Text:** Formal salary revision approval based on performance, commitment, and contribution.
  - **Effective Date:** Explicit effective date in DD/MM/YYYY format.
  - **Confidentiality Clause:** Strict confidentiality terms regarding compensation details.
  - **Company Signatory Block:** `For TEXAWAVE INNOVATIONS PRIVATE LIMITED`, signatory name, and designation.
  - **Revised Compensation Structure Header:** Centered green banner (`#78b449`).
  - **Employee Information Table:** 4-row structured table with Name, Designation, Effective Date, and Location.
  - **Compensation Table:**
    - Headers: `COMPONENT` | `AMOUNT (INR)` (white text on `#78b449`).
    - Rows: Basic, DA, HRA, CA, Net Monthly Salary, Gross Monthly CTC, and highlighted `Gross Annual CTC` row.
  - **Page 2 Continuation:**
    - Top header and `SALARY REVISION LETTER` banner.
    - Left signatory block: `For TexaWave Innovations Pvt Ltd,`, signatory name, and designation.
    - `EMPLOYEE ACCEPTANCE` green banner.
    - Formal acknowledgment text: _"I acknowledge receipt of this Salary Revision Letter and accept the revised compensation structure and related terms and conditions."_
    - Name, Signature, and Date blank fields.
  - **Footer (Both Pages):** Registered company email, phone, website, and physical address.

---

### E. Tab 4 — Candidates Talent Pipeline (`CandidatesPanel.tsx`)

- Aggregates candidates from interview stages and generated offer letters.
- Search and stage filtering (Scheduled, Completed, Selected, Offered, Rejected).
- Candidate identity badges with quick shortcuts to schedule subsequent rounds or generate offer letters.

---

## 4. Design System Compliance & Visual Standards

| Element             | Specification                                                                                                                |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------- |
| **Color Palette**   | Brand green (`#06ba32`), calm gray card backgrounds (`#f9fafb` / dark `#111827`), brand accents. No garish gradient banners. |
| **Typography**      | Font family: Nunito Sans; clear heading hierarchy (h1 `text-theme-xl`, h2 `text-theme-lg`, h3 `text-theme-base`).            |
| **Spacers & Cards** | Consistent padding (`p-4`, `p-6`), rounded corners (`rounded-xl`, `rounded-2xl`), subtle shadows (`shadow-theme-xs`).        |
| **Form Sections**   | Numbered circular step badges (`stepNumber="1"`), step titles, clear descriptions, accessible labels.                        |
| **Transitions**     | Fast, subtle CSS transitions (`180ms – 250ms`). Respects `prefers-reduced-motion`.                                           |
| **Responsiveness**  | Mobile single-column stacking below `1024px`, no horizontal overflow at `375px`.                                             |

---

## 5. Verification & Testing Contracts

1. **E2E Test Compatibility (`apps/ui/e2e/hr-recruitment.spec.ts`):**
   - Heading: `Recruitment & onboarding` matches.
   - Tabs: `Interview Schedule`, `Offer Letter`, `Revision Letter` matched case-insensitively.
   - Search: `Search interviews` and `Filter by status` aria-labels preserved.
   - Interview Schedule: `Schedule interview` and `Save interview` button names preserved.
   - Status Change: `Change status for ${item.candidateName}` preserved.
   - Revision Letter: `Issue revision letter to ${emp.fullName}` and `Issue revision letter` preserved.
2. **Typecheck & Monorepo Health:**
   - `npx turbo run typecheck`: Passed (8 of 8 packages successful).
   - Zero ESLint or TypeScript compile errors.
