# Employee self-onboarding: manual test guide

Written for: the tester running the module by hand in a browser (no code knowledge needed).

Scope: HR creates a new hire, the hire changes the temporary password, completes the five-part profile, and reaches the portal. Also covers the designations admin page and HR's read-only progress view. The approval flow for changes after completion is **not** part of this build.

## 0. Before you start

1. Start the database and Redis, then the API (port 3000) and the UI (port 3001).
2. Make sure the dev database is seeded (`pnpm --filter @texawave-erp/database run seed`).
3. Open the UI at http://localhost:3001/login.
4. Use a real mailbox you control for the new hire's email (for the password-reset check in section 8).

Test accounts:

| Role             | Organization slug    | Email              | Password     |
| ---------------- | -------------------- | ------------------ | ------------ |
| Super Admin (HR) | texawave-innovations | admin@texawave.com | ChangeMe123! |

Create the new hire with a different email from any existing account. Every email must be unique.

Test files for uploads (prepare these before you start):

- Two small valid files: one PDF and one JPG or PNG.
- One file bigger than 5 MB (any file, renamed to `.pdf`, is enough for the size check, but it must be a real PDF or image to test size alone).
- One text file renamed to `.pdf` (to test the file-type check).

## 1. Designations (Super Admin)

1. Log in as Super Admin.
2. In the sidebar, open **Admin → Designations**.
3. Click **New designation**. Enter code `SOFTWARE_ENGINEER`, name `Software Engineer`, and save.
   - Expected: a success message, and the row appears as Active.
4. Click **New designation** again and enter code `se` (too short, lowercase).
   - Expected: a code error appears, nothing is saved.
5. Click **Edit** on Software Engineer, change the name, save.
   - Expected: the code cannot be edited (it is not shown on the edit form).
6. Click **Deactivate**, then **Activate**.
   - Expected: status toggles, with a message each time.
7. Reactivate it before continuing, so it appears in the New hire form.

## 2. Create the new hire (Super Admin)

1. In the sidebar, open **New hire** (or go to http://localhost:3001/hr/employees/new).
2. Fill in:
   - First name and last name (required).
   - Mobile number: exactly 10 digits, starting with 6, 7, 8 or 9. Example: `9876543210`.
   - Email (sign-in): the new hire's email. Must be new.
   - Department, Team, Designation, Employment type, Role (all required). Designation should be Software Engineer.
   - Date of joining.
   - Temporary password: at least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character. Example: `Temp@1234`.
3. Submit.
   - Expected: a success screen shows the temporary password **once**. Copy it now.

### Negative checks

- Submit with a bad mobile number (e.g. `12345`) → error under the field: "Enter a valid 10-digit mobile number starting with 6 to 9."
- Submit with a weak temporary password (e.g. `weak`) → the password rule message appears.
- Reuse an existing email → an "email already in use" error. Nothing new is created.
- Known gap: the mobile field accepts letters and more than 10 digits while typing. It is rejected only on submit. Note it, but it is not a blocker.

## 3. First login and forced password change (New hire)

1. Log out as Super Admin (Sign out).
2. Log in with the new hire's email, the organization slug, and the temporary password.
   - Expected: the forced change-password screen opens. The admin area is not reachable.
3. Try to open http://localhost:3001/reference/tags directly.
   - Expected: you are sent back to the change-password screen.
4. Enter the temporary password as current, and a new password that meets the rules. Also enter a mismatch on purpose first.
   - Mismatch → an error, nothing changes.
5. Save the new password.
   - Expected: a confirmation with a button to go to login.
6. Try the **old** temporary password on the login page.
   - Expected: login fails.

## 4. Onboarding wizard (New hire)

1. Log in with the **new** password.
   - Expected: you land on the onboarding wizard ("Complete your profile"), not the admin area.
2. Confirm the header shows the step count "Step 1 of 6". Steps are: Personal, Address, Bank & IDs, Family & experience, Documents, Review & submit.

### Step 1: Personal

- Leave the required fields empty and click **Save and continue** → each required field shows its own error, and you stay on this step.
- Fill date of birth, gender, emergency contact (name, relation, phone), father's and mother's name and phone.
- Save → moves to Address.

### Step 2: Address

- Fill the permanent address (line, district, city, state, pincode). Area is optional.
- Leave "Present address is the same as permanent" ticked and save → moves to Bank & IDs.
- Re-run with the box unticked: a second address block appears and must be filled. Save → moves on.
- Use Back to confirm the earlier values are still there.

### Step 3: Bank & IDs

- Bank: account holder name, account number, IFSC code, bank name (required). Branch is optional.
- Government IDs: Aadhaar (12 digits) and PAN (required). ESI and PF are optional.
- Enter an invalid PAN (e.g. `ABCDE`) → an error appears and nothing is saved.
- Save → moves to Family & experience.

### Step 4: Family & experience (optional)

- Family: add one member (name and relation required; date of birth and phone optional). It appears in the list. Use **Remove** to delete it, then add it back.
- Experience: add one past employer (employer, designation, start date required; end date and reason optional). Leave the end date empty to mean "current".
- Click **Continue to documents** with none added → allowed. This step never blocks submission.

### Step 5: Documents

- Each row is one document type. Required: Profile photo, Aadhaar card, PAN card, Bank statement, 10th certificate, 12th certificate, Graduation certificate. Optional: Resume (PDF), Post-graduation certificate.
- Upload a valid PDF on one row → "Uploaded: <file name>" appears.
- Upload a valid JPG or PNG on another row → same.
- Upload a file bigger than 5 MB → the message "File must be 5 MB or smaller." Nothing is uploaded.
- Upload a text file renamed to `.pdf` → the message "Only PDF, JPG, or PNG files are accepted."
- Re-upload on a row that already has a file → the file name updates (the old file is replaced).
- Continue to review.

### Step 6: Review & submit

- Click **Submit profile** before everything is filled in.
  - Expected: no navigation. A "Still missing" list appears, with friendly names (e.g. "Date of birth", "PAN number", "Document: Profile photo").
- Fill whatever is missing (go Back to the right step), then submit again.
  - Expected: you are taken to the employee portal (`/portal`) and the wizard no longer opens when you visit `/onboarding`.

## 5. Employee portal (New hire)

1. Visit http://localhost:3001/portal.
   - Expected: the portal opens. Visiting `/onboarding` now redirects to `/portal`.
2. Use **Sign out** in the header.
   - Expected: you return to login.
3. Log in again as the new hire.
   - Expected: you land on `/portal`, not `/onboarding`.

## 6. HR progress view (Super Admin)

1. Log in as Super Admin.
2. Open http://localhost:3001/hr/employees/<employee id>/onboarding, with the new hire's employee id.
   - To find the id: call `GET /hr/employees` in the API (or ask the developer).
3. Before the new hire submits: status "In progress" with the missing items listed.
4. After the new hire submits: status "Complete" and "Nothing is missing."

Note: there is no HR employee list page yet. The progress page is reached by URL only.

## 7. Dashboard guard for incomplete hires

Run this on a new hire whose profile is **not yet** submitted:

1. Log in as that new hire.
2. Visit http://localhost:3001/reference/tags or any admin page.
   - Expected: you are sent to `/onboarding`.

Super Admin is not affected (no employee record).

## 8. Forgot password (any user)

1. Log out, then on the login page click **Forgot password**.
2. Enter the organization slug and the email of an existing account.
   - Expected: a generic message ("If that account exists, a reset link has been sent.").
3. Check the inbox (and Spam). Open the link within 30 minutes.
4. Enter a new password. A weak password must be rejected.
5. Log in with the new password. The old password must fail.

## 9. Permissions check (optional but recommended)

1. Log in as a user whose role lacks `hr.employee.write.all` and open http://localhost:3001/hr/employees/new.
   - Expected: access denied, and the menu item is not shown.
2. Log in as a user with no HR permissions and open the progress URL from section 6.
   - Expected: access denied (403) or not found (404).

## 10. Report template

For each section, note: **Pass / Fail / Not tested**, plus the exact message or screen you saw. For any fail, include the step number, what you clicked, and a screenshot.

## Known limitations in this build

- Approval flow for changes after completion: not built.
- Editing a family or experience entry: remove and re-add.
- Mobile number field: letters and extra digits are accepted while typing and rejected only on submit.
- Browser automation (Playwright) is not yet run.
