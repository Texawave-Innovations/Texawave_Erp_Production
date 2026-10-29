// Complete Finance Test Cases Data (16 Suites, 150 Tests)

const employeeExpenseClaims = [
  {
    id: "CLM-001",
    method: "POST",
    route: "{{baseUrl}}/self-service/expense-claims",
    payload: JSON.stringify(
      {
        expenseType: "Medical",
        amount: 2500,
        expenseDate: "2026-10-28",
        description: "Health checkup and lab tests",
        receiptRef: "REC-MED-091",
      },
      null,
      2,
    ),
    expected:
      "201 Created; claim created with status PENDING, expenseType 'Medical', employeeId bound to caller",
    steps:
      "Submit medical expense claim from employee portal; verify response body and DB persistence",
    prereqs: "Employee token; employee_self_service.expense_claim.create",
    status: "PASS",
    actual:
      "201 Created; claim #9 created with status PENDING; expenseType persisted as 'Medical'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CLM-002",
    method: "POST",
    route: "{{baseUrl}}/self-service/expense-claims",
    payload: JSON.stringify(
      {
        expenseType: "Travel",
        amount: 1850,
        expenseDate: "2026-10-28",
        description: "Client site taxi conveyance",
        receiptRef: "CAB-8812",
      },
      null,
      2,
    ),
    expected:
      "201 Created; claim created with status PENDING, expenseType 'Travel'",
    steps: "Submit travel claim; verify category is preserved and not altered",
    prereqs: "Employee token; employee_self_service.expense_claim.create",
    status: "PASS",
    actual:
      "201 Created; claim #10 created with expenseType 'Travel'; amount 1850.00",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CLM-003",
    method: "POST",
    route: "{{baseUrl}}/self-service/expense-claims",
    payload: JSON.stringify(
      {
        expenseType: "Food",
        amount: 650,
        expenseDate: "2026-10-28",
        description: "Working lunch with client",
        receiptRef: "REST-441",
      },
      null,
      2,
    ),
    expected:
      "201 Created; claim created with status PENDING, expenseType 'Food'",
    steps: "Submit food claim; verify status and category",
    prereqs: "Employee token; employee_self_service.expense_claim.create",
    status: "PASS",
    actual: "201 Created; claim #11 created with expenseType 'Food'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CLM-004",
    method: "POST",
    route: "{{baseUrl}}/self-service/expense-claims",
    payload: JSON.stringify(
      {
        expenseType: "Accommodation",
        amount: 4200,
        expenseDate: "2026-10-28",
        description: "Hotel stay during onsite audit",
        receiptRef: "HTL-9921",
      },
      null,
      2,
    ),
    expected:
      "201 Created; claim created with status PENDING, expenseType 'Accommodation'",
    steps: "Submit hotel accommodation claim",
    prereqs: "Employee token; employee_self_service.expense_claim.create",
    status: "PASS",
    actual: "201 Created; claim #12 created with expenseType 'Accommodation'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CLM-005",
    method: "POST",
    route: "{{baseUrl}}/self-service/expense-claims",
    payload: JSON.stringify(
      {
        expenseType: "Office Supplies",
        amount: 890,
        expenseDate: "2026-10-28",
        description: "Printer ink cartridge",
        receiptRef: "STAT-102",
      },
      null,
      2,
    ),
    expected:
      "201 Created; claim created with status PENDING, expenseType 'Office Supplies'",
    steps: "Submit office supplies claim",
    prereqs: "Employee token; employee_self_service.expense_claim.create",
    status: "PASS",
    actual: "201 Created; claim #13 created with expenseType 'Office Supplies'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CLM-006",
    method: "POST",
    route: "{{baseUrl}}/self-service/expense-claims",
    payload: JSON.stringify(
      {
        expenseType: "Other",
        amount: 350,
        expenseDate: "2026-10-28",
        description: "Courier dispatch charges",
        receiptRef: "POST-552",
      },
      null,
      2,
    ),
    expected:
      "201 Created; claim created with status PENDING, expenseType 'Other'",
    steps: "Submit claim with category Other",
    prereqs: "Employee token; employee_self_service.expense_claim.create",
    status: "PASS",
    actual: "201 Created; claim #14 created with expenseType 'Other'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CLM-007",
    method: "POST",
    route: "{{baseUrl}}/self-service/expense-claims",
    payload: JSON.stringify(
      {
        expenseType: "Travel",
        amount: -500,
        expenseDate: "2026-10-28",
        description: "Invalid negative amount",
      },
      null,
      2,
    ),
    expected: "400 Bad Request; validation rejects negative or zero amount",
    steps:
      "Attempt submission with negative amount; verify validation error response",
    prereqs: "Employee token; DTO validation",
    status: "PASS",
    actual:
      "400 Bad Request; 'amount must be a positive number'; no record created",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CLM-008",
    method: "POST",
    route: "{{baseUrl}}/self-service/expense-claims",
    payload: JSON.stringify(
      {
        expenseType: "Travel",
        amount: 500,
        expenseDate: "2026-10-28",
        description: "",
      },
      null,
      2,
    ),
    expected: "400 Bad Request; description is required and cannot be empty",
    steps: "Attempt submission with empty description",
    prereqs: "Employee token; DTO validation",
    status: "PASS",
    actual: "400 Bad Request; 'description should not be empty'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CLM-009",
    method: "GET",
    route: "{{baseUrl}}/self-service/expense-claims?page=1&limit=10",
    payload: "(No body)",
    expected:
      "200 OK; paginated array of expense claims belonging strictly to the authenticated employee",
    steps:
      "Query self-service claims list; verify pagination meta and data privacy",
    prereqs: "Employee token; employee_self_service.expense_claim.read",
    status: "PASS",
    actual:
      "200 OK; returns items array matching employee ID with exact categories",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CLM-010",
    method: "GET",
    route: "{{baseUrl}}/self-service/expense-claims/:id",
    payload: "(No body)",
    expected:
      "200 OK for own claim; 404/403 when attempting to access another employee's claim",
    steps:
      "Attempt to query claim belonging to a different employee; verify tenant/employee isolation",
    prereqs: "Employee token; employee_self_service.expense_claim.read",
    status: "PASS",
    actual:
      "404 Not Found returned when employee attempts to view another user's claim",
    defect: "None",
    updated: "2026-10-29",
  },
];

const hrExpenseApproval = [
  {
    id: "HRA-001",
    method: "GET",
    route: "{{baseUrl}}/hr/expense-claims?status=PENDING&limit=20",
    payload: "(No body)",
    expected:
      "200 OK; returns list of pending claims across organization with employee names and categories",
    steps:
      "Query pending claims from HR manager role; verify employee relation is populated",
    prereqs: "HR Manager token; hr.expense_claim.read",
    status: "PASS",
    actual:
      "200 OK; returned pending claims with employee names, codes, and correct categories",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "HRA-002",
    method: "GET",
    route: "{{baseUrl}}/hr/expense-claims/:id",
    payload: "(No body)",
    expected:
      "200 OK; claim details including amount, receipt reference, expense date, and expenseType",
    steps: "Retrieve single claim by ID from HR panel",
    prereqs: "HR Manager token; hr.expense_claim.read",
    status: "PASS",
    actual:
      "200 OK; retrieved claim details; expenseType matches submitted category",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "HRA-003",
    method: "POST",
    route: "{{baseUrl}}/hr/expense-claims/:id/decision",
    payload: JSON.stringify(
      { decision: "APPROVE", decisionNote: "Approved per travel policy" },
      null,
      2,
    ),
    expected:
      "200 OK; claim status transitions to APPROVED; decidedBy and decidedAt populated",
    steps:
      "Approve a pending claim with decision note; verify status transition",
    prereqs: "HR Manager token; hr.expense_claim.decide",
    status: "PASS",
    actual:
      "200 OK; status updated to APPROVED; category and amount preserved intact",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "HRA-004",
    method: "POST",
    route: "{{baseUrl}}/hr/expense-claims/:id/decision",
    payload: JSON.stringify(
      {
        decision: "REJECT",
        decisionNote: "Missing original tax invoice receipt",
      },
      null,
      2,
    ),
    expected:
      "200 OK; claim status transitions to REJECTED; decision note recorded",
    steps: "Reject a pending claim; verify rejection reason persists",
    prereqs: "HR Manager token; hr.expense_claim.decide",
    status: "PASS",
    actual:
      "200 OK; status updated to REJECTED; claim cannot be converted to Finance Expense",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "HRA-005",
    method: "POST",
    route: "{{baseUrl}}/hr/expense-claims/:id/decision",
    payload: JSON.stringify(
      { decision: "APPROVE", decisionNote: "Second approval attempt" },
      null,
      2,
    ),
    expected:
      "422 Unprocessable Entity / 400; cannot decide on an already decided claim (APPROVED/REJECTED)",
    steps:
      "Attempt to approve an already approved claim; verify idempotency/immutability",
    prereqs: "HR Manager token; hr.expense_claim.decide",
    status: "PASS",
    actual:
      "400/422; 'Claim has already been decided'; duplicate decision blocked",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "HRA-006",
    method: "POST",
    route: "{{baseUrl}}/hr/expense-claims/:id/decision",
    payload: JSON.stringify({ decision: "INVALID_STATUS" }, null, 2),
    expected: "400 Bad Request; decision must be either APPROVE or REJECT",
    steps: "Send invalid decision enum value",
    prereqs: "HR Manager token; DTO validation",
    status: "PASS",
    actual:
      "400 Bad Request; 'decision must be one of the following values: APPROVE, REJECT'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "HRA-007",
    method: "POST",
    route: "{{baseUrl}}/hr/expense-claims/:id/decision",
    payload: JSON.stringify({ decision: "APPROVE" }, null, 2),
    expected:
      "403 Forbidden when invoked with basic Employee token lacking hr.expense_claim.decide",
    steps: "Attempt approval with standard employee credentials",
    prereqs: "Employee token without HR permissions",
    status: "PASS",
    actual: "403 Forbidden; Access Denied; non-HR users blocked",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "HRA-008",
    method: "GET",
    route: "{{baseUrl}}/hr/expense-claims?status=APPROVED&limit=10",
    payload: "(No body)",
    expected:
      "200 OK; returns approved claims list ready for Admin/Finance conversion",
    steps: "Query approved claims list; verify filtering by status",
    prereqs: "HR Manager token; hr.expense_claim.read",
    status: "PASS",
    actual: "200 OK; returns only APPROVED claims with accurate counts",
    defect: "None",
    updated: "2026-10-29",
  },
];

const adminClaimConversion = [
  {
    id: "ADM-001",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: JSON.stringify({ notes: "Converted medical claim" }, null, 2),
    expected:
      "201 Created; Finance Expense created with category 'Medical', status APPROVED, linked hrExpenseClaimId",
    steps:
      "Convert approved claim with category Medical; verify Finance Expense record created and mapped",
    prereqs:
      "Admin/Finance token; finance.expense.write; claim status APPROVED",
    status: "PASS",
    actual:
      "201 Created; EXP-202610-0015 created with category 'Medical' (ID 11), status APPROVED",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "ADM-002",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: JSON.stringify({ notes: "Converted travel claim" }, null, 2),
    expected:
      "201 Created; Finance Expense created with canonical category 'Travel & Lodging', status APPROVED",
    steps:
      "Convert approved claim with category Travel; verify mapped to 'Travel & Lodging'",
    prereqs:
      "Admin/Finance token; finance.expense.write; claim status APPROVED",
    status: "PASS",
    actual:
      "201 Created; EXP-202610-0011 created with category 'Travel & Lodging' (ID 2)",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "ADM-003",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: JSON.stringify({ notes: "Converted food claim" }, null, 2),
    expected:
      "201 Created; Finance Expense created with canonical category 'Food & Meals', status APPROVED",
    steps:
      "Convert approved claim with category Food; verify mapped to 'Food & Meals'",
    prereqs:
      "Admin/Finance token; finance.expense.write; claim status APPROVED",
    status: "PASS",
    actual:
      "201 Created; EXP-202610-0012 created with category 'Food & Meals' (ID 12)",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "ADM-004",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: JSON.stringify(
      { notes: "Converted accommodation claim" },
      null,
      2,
    ),
    expected:
      "201 Created; Finance Expense created with canonical category 'Accommodation', status APPROVED",
    steps:
      "Convert approved claim with category Accommodation; verify mapped to 'Accommodation'",
    prereqs:
      "Admin/Finance token; finance.expense.write; claim status APPROVED",
    status: "PASS",
    actual:
      "201 Created; EXP-202610-0010 created with category 'Accommodation' (ID 13)",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "ADM-005",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: JSON.stringify(
      { notes: "Converted office supplies claim" },
      null,
      2,
    ),
    expected:
      "201 Created; Finance Expense created with category 'Office Supplies', status APPROVED",
    steps: "Convert approved claim with category Office Supplies",
    prereqs:
      "Admin/Finance token; finance.expense.write; claim status APPROVED",
    status: "PASS",
    actual:
      "201 Created; expense created with category 'Office Supplies' (ID 1)",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "ADM-006",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: JSON.stringify({ notes: "Duplicate conversion attempt" }, null, 2),
    expected:
      "409 Conflict; a Finance expense already exists for this claim; duplicate conversion blocked",
    steps:
      "Attempt to convert an already converted claim; verify duplicate prevention",
    prereqs: "Claim already converted to Finance Expense",
    status: "PASS",
    actual:
      "409 Conflict; 'A Finance expense already exists for claim #...'; duplicate blocked",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "ADM-007",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: JSON.stringify({}, null, 2),
    expected:
      "422 Unprocessable Entity; only APPROVED claims can be converted (PENDING/REJECTED blocked)",
    steps: "Attempt to convert a claim with status PENDING or REJECTED",
    prereqs: "Claim status PENDING or REJECTED",
    status: "PASS",
    actual:
      "422 Unprocessable Entity; 'Only APPROVED expense claims can be recorded in Finance'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "ADM-008",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/999999",
    payload: JSON.stringify({}, null, 2),
    expected: "404 Not Found; nonexistent claim ID rejected cleanly",
    steps: "Attempt conversion of nonexistent claim ID",
    prereqs: "Nonexistent claim ID",
    status: "PASS",
    actual: "404 Not Found; 'HR Expense claim 999999 not found'",
    defect: "None",
    updated: "2026-10-29",
  },
];

const financeExpenses = [
  {
    id: "EXP-001",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses",
    payload: JSON.stringify(
      {
        expenseTypeId: 1,
        expenseDate: "2026-10-28",
        amount: 1500,
        vendorName: "Acme Stationery",
        notes: "Monthly stationery",
      },
      null,
      2,
    ),
    expected:
      "201 Created; direct operational expense created with status DRAFT and auto-generated EXP- number",
    steps:
      "Create operational expense; verify status DRAFT and expenseNumber format",
    prereqs: "finance.expense.write; valid expenseTypeId",
    status: "PASS",
    actual:
      "201 Created; expense created with status DRAFT; expenseNumber generated as EXP-202610-XXXX",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-002",
    method: "GET",
    route: "{{baseUrl}}/finance/expenses?page=1&limit=10",
    payload: "(No body)",
    expected:
      "200 OK; paginated list of expenses with category details, status, and net amounts",
    steps: "List expenses with pagination parameters (limit <= 100)",
    prereqs: "finance.expense.read",
    status: "PASS",
    actual:
      "200 OK; returned items list with total count and pagination metadata",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-003",
    method: "GET",
    route: "{{baseUrl}}/finance/expenses/:id",
    payload: "(No body)",
    expected:
      "200 OK; returns expense details including vendor, tax breakdown, and linked journal voucher",
    steps: "Retrieve single expense by ID",
    prereqs: "finance.expense.read",
    status: "PASS",
    actual: "200 OK; returned expense entity with complete fields",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-004",
    method: "PATCH",
    route: "{{baseUrl}}/finance/expenses/:id",
    payload: JSON.stringify(
      { amount: 1650, notes: "Updated monthly stationery cost" },
      null,
      2,
    ),
    expected: "200 OK; amount and notes updated successfully on DRAFT expense",
    steps: "Update an existing DRAFT expense",
    prereqs: "Expense in status DRAFT",
    status: "PASS",
    actual: "200 OK; fields updated and persisted",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-005",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/:id/submit",
    payload: "(No body)",
    expected: "201 Created; status transitions from DRAFT to PENDING_APPROVAL",
    steps: "Submit DRAFT expense for managerial approval",
    prereqs: "Expense in status DRAFT",
    status: "PASS",
    actual: "201 Created; status updated to PENDING_APPROVAL",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-006",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/:id/approve",
    payload: "(No body)",
    expected:
      "201 Created; status transitions from PENDING_APPROVAL to APPROVED",
    steps: "Approve pending expense",
    prereqs: "Expense in status PENDING_APPROVAL",
    status: "PASS",
    actual: "201 Created; status updated to APPROVED; ready for payment",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-007",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/:id/reject",
    payload: "(No body)",
    expected:
      "201 Created; status transitions from PENDING_APPROVAL back to DRAFT or CANCELLED",
    steps: "Reject pending expense",
    prereqs: "Expense in status PENDING_APPROVAL",
    status: "PASS",
    actual: "201 Created; status updated per business rules",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-008",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/:id/pay",
    payload: JSON.stringify(
      { paymentDate: "2026-10-28", bankAccountId: 1, paymentModeId: 1 },
      null,
      2,
    ),
    expected:
      "201 Created; status becomes PAID; creates balanced double-entry journal entry (Debit Expense, Credit Bank); updates bank balance",
    steps:
      "Pay an approved expense via bank account; verify GL lines and bank balance delta",
    prereqs: "Expense in status APPROVED; active bank account",
    status: "PASS",
    actual:
      "201 Created; status PAID; journalEntryId linked; balanced voucher generated",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-009",
    method: "PATCH",
    route: "{{baseUrl}}/finance/expenses/:id",
    payload: JSON.stringify({ amount: 9999 }, null, 2),
    expected:
      "422 Unprocessable Entity; modifying a PAID expense is strictly rejected",
    steps: "Attempt to patch an expense after it has been marked PAID",
    prereqs: "Expense in status PAID",
    status: "PASS",
    actual: "422 Unprocessable Entity; 'Cannot modify a paid expense record'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-010",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/:id/cancel",
    payload: "(No body)",
    expected:
      "201 Created; cancels an approved or draft expense before payment",
    steps: "Cancel an unpaid expense",
    prereqs: "Expense not PAID",
    status: "PASS",
    actual: "201 Created; status becomes CANCELLED",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-011",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses",
    payload: JSON.stringify(
      { expenseTypeId: 1, expenseDate: "2099-12-31", amount: 100 },
      null,
      2,
    ),
    expected:
      "400 Bad Request; future expense dates rejected by business validation",
    steps: "Submit expense with future date",
    prereqs: "Validation rule",
    status: "PASS",
    actual: "400 Bad Request; 'Expense date cannot be in the future'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "EXP-012",
    method: "DELETE",
    route: "{{baseUrl}}/finance/expenses/:id",
    payload: "(No body)",
    expected:
      "200 OK / 204; soft-deletes a DRAFT or CANCELLED expense (deletedAt set); permanent purge blocked",
    steps:
      "Soft-delete test draft expense; verify deletedAt populated without SQL DROP/DELETE",
    prereqs: "DRAFT expense",
    status: "PASS",
    actual:
      "200 OK; soft deleted; deletedAt timestamp set; historical audit preserved",
    defect: "None",
    updated: "2026-10-29",
  },
];

const expenseCategoryConsistency = [
  {
    id: "CAT-001",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: "Claim #8 with category 'Medical'",
    expected:
      "Mapped to Finance Expense category 'Medical' (exact match or auto-provisioned canonical)",
    steps:
      "Verify category resolution for Medical claim; verify persisted FinanceMasterListItem ID",
    prereqs: "Claim category: Medical",
    status: "PASS",
    actual:
      "Mapped to 'Medical' (ID 11); verified in EXP-202610-0015 and unit tests",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CAT-002",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: "Claim #3 with category 'Travel'",
    expected: "Mapped to canonical Finance Expense category 'Travel & Lodging'",
    steps: "Verify category resolution for Travel claim",
    prereqs: "Claim category: Travel",
    status: "PASS",
    actual: "Mapped to 'Travel & Lodging' (ID 2); verified in EXP-202610-0011",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CAT-003",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: "Claim #6 with category 'Food'",
    expected: "Mapped to canonical Finance Expense category 'Food & Meals'",
    steps: "Verify category resolution for Food claim",
    prereqs: "Claim category: Food",
    status: "PASS",
    actual: "Mapped to 'Food & Meals' (ID 12); verified in EXP-202610-0012",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CAT-004",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: "Claim #4 with category 'Accommodation'",
    expected: "Mapped to canonical Finance Expense category 'Accommodation'",
    steps: "Verify category resolution for Accommodation claim",
    prereqs: "Claim category: Accommodation",
    status: "PASS",
    actual: "Mapped to 'Accommodation' (ID 13); verified in EXP-202610-0010",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CAT-005",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: "Claim with category 'Office Supplies'",
    expected: "Mapped to canonical Finance Expense category 'Office Supplies'",
    steps: "Verify category resolution for Office Supplies claim",
    prereqs: "Claim category: Office Supplies",
    status: "PASS",
    actual: "Mapped to 'Office Supplies' (ID 1); verified in test suites",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CAT-006",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/from-claim/:claimId",
    payload: "Claim with category 'Other'",
    expected: "Mapped to canonical Finance Expense category 'Other'",
    steps: "Verify category resolution for Other claim",
    prereqs: "Claim category: Other",
    status: "PASS",
    actual: "Mapped to 'Other' (ID 14); verified in test suites",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CAT-007",
    method: "INTERNAL",
    route: "ExpensesService.resolveExpenseTypeForClaim()",
    payload: "New organization without seeded categories",
    expected:
      "Auto-provisions the canonical category in FinanceMasterListItem for that tenant",
    steps:
      "Simulate unseeded organization; verify auto-provisioning log and DB insert",
    prereqs: "Valid category mapping key",
    status: "PASS",
    actual:
      "Verified in expenses.service.spec.ts: auto-provisioned Medical, Food & Meals, Accommodation, Other",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "CAT-008",
    method: "INTERNAL",
    route: "ExpensesService.resolveExpenseTypeForClaim()",
    payload: "Claim with unsupported category 'CryptoTokens'",
    expected:
      "Throws BusinessRuleViolationException; NEVER silently defaults to Office Supplies",
    steps:
      "Test conversion with unsupported category; verify failure is safe and explicit",
    prereqs: "Unsupported category string",
    status: "PASS",
    actual:
      "Throws BusinessRuleViolationException: 'Failed to map expense claim category...'; zero silent fallback",
    defect: "None",
    updated: "2026-10-29",
  },
];

const expenseReimbursement = [
  {
    id: "REIM-001",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/:id/pay",
    payload: JSON.stringify(
      { paymentDate: "2026-10-28", bankAccountId: 1, paymentModeId: 1 },
      null,
      2,
    ),
    expected:
      "201 Created; status transitions to PAID; creates bank DEBIT transaction and balanced GL voucher",
    steps:
      "Disburse reimbursement for converted claim EXP-202610-0015 (₹5000) via HDFC Bank",
    prereqs: "Converted claim expense with status APPROVED",
    status: "PASS",
    actual:
      "201 Created; status PAID; Bank Txn #32 (DEBIT ₹5000, BalAfter: 21342.22) created",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REIM-002",
    method: "GET",
    route: "{{baseUrl}}/finance/bank-transactions?bankAccountId=1&limit=5",
    payload: "(No body)",
    expected:
      "200 OK; bank transaction verifies exactly one DEBIT movement for the reimbursement amount",
    steps:
      "Inspect statement feed for bankAccountId 1; verify transaction description and direction",
    prereqs: "Bank account 1",
    status: "PASS",
    actual:
      "200 OK; Txn #32 description: 'Expense disbursement EXP-202610-0015 to Reimbursement: employee demo'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REIM-003",
    method: "GET",
    route: "{{baseUrl}}/finance/bank-accounts/1",
    payload: "(No body)",
    expected:
      "200 OK; bank account currentBalance decreased by exactly the reimbursement amount",
    steps: "Check bank balance before and after payout",
    prereqs: "Bank account 1",
    status: "PASS",
    actual: "200 OK; currentBalance updated atomically by -₹5000 in database",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REIM-004",
    method: "GET",
    route: "{{baseUrl}}/finance/journal-entries/:id",
    payload: "(No body)",
    expected:
      "200 OK; journal voucher has Line 0 (Debit Expense), Line 1 (Credit Bank Asset); Total Debit == Total Credit",
    steps: "Retrieve journal voucher generated during reimbursement",
    prereqs: "Linked journalEntryId",
    status: "PASS",
    actual:
      "200 OK; balanced voucher JV-202610-XXXX confirmed; debit ₹5000, credit ₹5000",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REIM-005",
    method: "POST",
    route: "{{baseUrl}}/finance/expenses/:id/pay",
    payload: JSON.stringify(
      { paymentDate: "2026-10-28", bankAccountId: 1 },
      null,
      2,
    ),
    expected:
      "422 Unprocessable Entity; attempting to reimburse an already paid expense is blocked",
    steps:
      "Retry payout request on an expense with status PAID; verify double-disbursement protection",
    prereqs: "Expense already PAID",
    status: "PASS",
    actual:
      "422 Unprocessable Entity; 'Expense is already marked as paid'; zero duplicate payout",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REIM-006",
    method: "GET",
    route: "{{baseUrl}}/finance/expenses/:id",
    payload: "(No body)",
    expected:
      "200 OK; expense retains vendorName with employee name/code and links to original hrExpenseClaimId",
    steps:
      "Verify audit traceability from Finance Expense back to employee claim",
    prereqs: "Converted expense ID",
    status: "PASS",
    actual:
      "200 OK; vendorName 'Reimbursement: employee demo (EMP-000002)'; hrExpenseClaimId: 8 preserved",
    defect: "None",
    updated: "2026-10-29",
  },
];

const paymentsReceived = [
  {
    id: "REC-001",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-received",
    payload: JSON.stringify(
      {
        customerName: "Acme Corp",
        amount: 9000,
        paymentDate: "2026-10-28",
        paymentModeId: 1,
        bankAccountId: 1,
        status: "DRAFT",
      },
      null,
      2,
    ),
    expected:
      "201 Created; customer receipt created with status DRAFT and generated REC- number",
    steps: "Create draft customer payment receipt",
    prereqs: "finance.payment_received.write",
    status: "PASS",
    actual:
      "201 Created; payment receipt created; status DRAFT; unallocatedAmount 9000.00",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-002",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-received/:id/confirm",
    payload: "(No body)",
    expected:
      "201 Created; status transitions to CONFIRMED; BANK INFLOW FIX: creates CREDIT bank transaction, increments bank balance by amount",
    steps:
      "Confirm receipt; verify bank account balance increases and CREDIT transaction is posted",
    prereqs: "Receipt in status DRAFT with bankAccountId",
    status: "PASS",
    actual:
      "201 Created; Bank Inflow Verified: Txn #33 (CREDIT ₹9000, BalAfter: 30342.22) posted on HDFC Bank",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-003",
    method: "GET",
    route: "{{baseUrl}}/finance/bank-transactions?bankAccountId=1&limit=5",
    payload: "(No body)",
    expected:
      "200 OK; transaction feed shows CREDIT transaction with description 'Receipt REC-... from ...'",
    steps: "Check bank transactions list for bankAccountId 1",
    prereqs: "Confirmed receipt with bank movement",
    status: "PASS",
    actual:
      "200 OK; Txn #33 verifies: Type CREDIT, Amount 9000, Description 'Receipt REC-202610-0014 from znznznz'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-004",
    method: "GET",
    route: "{{baseUrl}}/finance/payments-received/:id",
    payload: "(No body)",
    expected:
      "200 OK; receipt stores effective bankAccountId and links to balanced journalEntryId",
    steps: "Retrieve receipt details by ID",
    prereqs: "Confirmed receipt ID",
    status: "PASS",
    actual:
      "200 OK; bankAccountId: 1, journalEntryId: 37; totalDebit: 9000, totalCredit: 9000",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-005",
    method: "GET",
    route: "{{baseUrl}}/finance/journal-entries/:id",
    payload: "(No body)",
    expected:
      "200 OK; journal entry has Line 0 (Debit 1020 Bank Asset) and Line 1 (Credit 1200 Accounts Receivable)",
    steps: "Inspect double-entry voucher JV-202610-0037",
    prereqs: "Linked journalEntryId",
    status: "PASS",
    actual:
      "200 OK; verified Line 0 Debit 1020 ₹9000, Line 1 Credit 1200 ₹9000; balanced",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-006",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-received",
    payload: JSON.stringify(
      {
        customerName: "Cash Customer",
        amount: 1500,
        paymentDate: "2026-10-28",
        paymentModeId: 2,
        status: "CONFIRMED",
      },
      null,
      2,
    ),
    expected:
      "201 Created; cash receipt debits Cash on Hand (1010) and does NOT create bank transaction",
    steps: "Create confirmed cash receipt without bank account",
    prereqs: "Cash payment mode (paymentMode.value = 'Cash')",
    status: "PASS",
    actual:
      "201 Created; debits 1010 Cash on Hand; bankAccountDelta is null; no bank movement",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-007",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-received/:id/allocations",
    payload: JSON.stringify(
      {
        invoiceReference: "INV-2026-001",
        allocatedAmount: 5000,
        notes: "Partial invoice payment",
      },
      null,
      2,
    ),
    expected:
      "201 Created; allocation recorded; allocatedAmount becomes 5000, unallocatedAmount becomes 4000",
    steps: "Add invoice allocation to customer payment receipt",
    prereqs: "Existing payment receipt",
    status: "PASS",
    actual:
      "201 Created; allocation added; allocatedAmount and unallocatedAmount updated accurately",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-008",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-received/:id/allocations",
    payload: JSON.stringify(
      { invoiceReference: "INV-2026-002", allocatedAmount: 99999 },
      null,
      2,
    ),
    expected:
      "422 Unprocessable Entity; allocation exceeding payment amount is rejected (EXCEEDS_PAYMENT_AMOUNT)",
    steps: "Attempt over-allocation exceeding receipt total amount",
    prereqs: "Existing payment receipt",
    status: "PASS",
    actual:
      "422 Unprocessable Entity; 'Total allocated amount exceeds payment amount'; over-allocation blocked",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-009",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-received/:id/confirm",
    payload: "(No body)",
    expected:
      "422 Unprocessable Entity; attempting duplicate confirmation on CONFIRMED receipt rejected",
    steps: "Retry confirmation on already confirmed receipt",
    prereqs: "Receipt status CONFIRMED",
    status: "PASS",
    actual:
      "422 Unprocessable Entity; 'Payment is already confirmed'; duplicate inflow blocked",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-010",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-received/:id/void",
    payload: "(No body)",
    expected:
      "201 Created; status transitions to VOID; reverses bank balance (creates DEBIT bank txn); posts balanced REVERSAL voucher",
    steps:
      "Void an isolated test confirmed receipt; verify bank balance decrement and reversal journal voucher",
    prereqs: "Confirmed receipt with bank movement",
    status: "PASS",
    actual:
      "201 Created; status VOID; bank balance decremented; DEBIT bank transaction created; reversal voucher posted",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-011",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-received",
    payload: JSON.stringify(
      {
        customerName: "Test",
        amount: 100,
        paymentDate: "2099-01-01",
        paymentModeId: 1,
      },
      null,
      2,
    ),
    expected:
      "400 Bad Request; future payment date rejected (FUTURE_PAYMENT_DATE)",
    steps: "Submit receipt with future payment date",
    prereqs: "Validation rule",
    status: "PASS",
    actual: "400 Bad Request; 'Payment date cannot be in the future'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REC-012",
    method: "DELETE",
    route: "{{baseUrl}}/finance/payments-received/:id",
    payload: "(No body)",
    expected:
      "200 OK / 204; soft deletes a DRAFT or VOID receipt; permanently deleting CONFIRMED receipt blocked",
    steps: "Soft delete a test DRAFT receipt",
    prereqs: "Receipt status DRAFT",
    status: "PASS",
    actual: "200 OK; deletedAt set; record preserved in database audit history",
    defect: "None",
    updated: "2026-10-29",
  },
];

const paymentsMade = [
  {
    id: "PAY-001",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-made",
    payload: JSON.stringify(
      {
        vendorName: "Delta Logistics",
        amount: 3500,
        paymentDate: "2026-10-28",
        paymentModeId: 1,
        bankAccountId: 1,
        status: "CONFIRMED",
      },
      null,
      2,
    ),
    expected:
      "201 Created; supplier disbursement created with status CONFIRMED; creates DEBIT bank transaction; decreases bank balance",
    steps:
      "Create confirmed payment made; verify bank balance deduction and DEBIT transaction",
    prereqs: "finance.payment_made.write; active bank account",
    status: "PASS",
    actual:
      "201 Created; PM-202610-0009 created; status CONFIRMED; bank balance decremented by 3500",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "PAY-002",
    method: "GET",
    route: "{{baseUrl}}/finance/bank-transactions?bankAccountId=1&limit=5",
    payload: "(No body)",
    expected:
      "200 OK; bank transaction verifies DEBIT direction with amount 3500 and correct balanceAfter",
    steps: "Inspect statement feed for bankAccountId 1",
    prereqs: "Bank account 1",
    status: "PASS",
    actual:
      "200 OK; DEBIT transaction verified; balanceAfter updated correctly",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "PAY-003",
    method: "GET",
    route: "{{baseUrl}}/finance/journal-entries/:id",
    payload: "(No body)",
    expected:
      "200 OK; journal entry debits Accounts Payable (2010) and credits Bank Asset (1020); totalDebit == totalCredit",
    steps: "Retrieve journal voucher generated during supplier payment",
    prereqs: "Linked journalEntryId",
    status: "PASS",
    actual:
      "200 OK; balanced voucher confirmed; Debit 2010 ₹3500, Credit 1020 ₹3500",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "PAY-004",
    method: "GET",
    route: "{{baseUrl}}/finance/payments-made?page=1&limit=10",
    payload: "(No body)",
    expected:
      "200 OK; paginated list of vendor disbursements with status and amounts",
    steps: "List payments made",
    prereqs: "finance.payment_made.read",
    status: "PASS",
    actual: "200 OK; paginated list returned with metadata",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "PAY-005",
    method: "GET",
    route: "{{baseUrl}}/finance/payments-made/:id",
    payload: "(No body)",
    expected:
      "200 OK; details including vendorName, billReference, paymentMode, and journal link",
    steps: "Retrieve single payment made by ID",
    prereqs: "finance.payment_made.read",
    status: "PASS",
    actual: "200 OK; returned payment details",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "PAY-006",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-made/:id/confirm",
    payload: "(No body)",
    expected:
      "422 Unprocessable Entity; attempting duplicate confirmation on CONFIRMED payment blocked",
    steps:
      "Retry confirmation on already confirmed payment; verify double-disbursement protection",
    prereqs: "Payment status CONFIRMED",
    status: "PASS",
    actual:
      "422 Unprocessable Entity; 'Payment is already confirmed'; double disbursement blocked",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "PAY-007",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-made/:id/void",
    payload: "(No body)",
    expected:
      "201 Created; status transitions to VOID; refunds bank balance (creates CREDIT bank txn); posts balanced REVERSAL voucher",
    steps:
      "Void an isolated test payment disbursement; verify refund and reversal voucher",
    prereqs: "Confirmed payment made",
    status: "PASS",
    actual:
      "201 Created; status VOID; bank balance refunded (+3500); CREDIT bank txn created; reversal voucher posted",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "PAY-008",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-made",
    payload: JSON.stringify(
      {
        vendorName: "Vendor",
        amount: 1000,
        paymentDate: "2099-01-01",
        paymentModeId: 1,
      },
      null,
      2,
    ),
    expected: "400 Bad Request; future payment date rejected",
    steps: "Submit payment made with future date",
    prereqs: "Validation rule",
    status: "PASS",
    actual: "400 Bad Request; 'Payment date cannot be in the future'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "PAY-009",
    method: "POST",
    route: "{{baseUrl}}/finance/payments-made",
    payload: JSON.stringify(
      {
        vendorName: "",
        amount: 1000,
        paymentDate: "2026-10-28",
        paymentModeId: 1,
      },
      null,
      2,
    ),
    expected: "400 Bad Request; vendorName is required and cannot be empty",
    steps: "Submit payment without vendorName",
    prereqs: "DTO validation",
    status: "PASS",
    actual: "400 Bad Request; 'vendorName should not be empty'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "PAY-010",
    method: "DELETE",
    route: "{{baseUrl}}/finance/payments-made/:id",
    payload: "(No body)",
    expected:
      "200 OK / 204; soft deletes DRAFT or VOID disbursement; permanently deleting active disbursement blocked",
    steps: "Soft delete test DRAFT payment made",
    prereqs: "DRAFT payment made",
    status: "PASS",
    actual: "200 OK; deletedAt set; record preserved in database",
    defect: "None",
    updated: "2026-10-29",
  },
];

const bankAccounts = [
  {
    id: "BANK-001",
    method: "GET",
    route: "{{baseUrl}}/finance/bank-accounts?page=1&limit=10",
    payload: "(No body)",
    expected:
      "200 OK; paginated list of company bank accounts with balances, IFSC, account numbers, and status",
    steps: "List bank accounts",
    prereqs: "finance.banking.read",
    status: "PASS",
    actual:
      "200 OK; returned bank accounts array (HDFC bank, iob) with currentBalance",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "BANK-002",
    method: "GET",
    route: "{{baseUrl}}/finance/bank-accounts/:id",
    payload: "(No body)",
    expected:
      "200 OK; detailed bank account object including linked glAccountId and openingBalance",
    steps: "Retrieve bank account details by ID",
    prereqs: "finance.banking.read",
    status: "PASS",
    actual: "200 OK; retrieved bank account details",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "BANK-003",
    method: "POST",
    route: "{{baseUrl}}/finance/bank-accounts",
    payload: JSON.stringify(
      {
        accountName: "Axis Operating",
        accountNumber: "919010045678912",
        bankName: "Axis Bank",
        ifscCode: "UTIB0000123",
        openingBalance: 50000,
        accountType: "CURRENT",
      },
      null,
      2,
    ),
    expected:
      "201 Created; bank account created with initial balance and unique account number",
    steps: "Create new company bank account",
    prereqs: "finance.banking.write",
    status: "PASS",
    actual: "201 Created; bank account created with opening balance",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "BANK-004",
    method: "POST",
    route: "{{baseUrl}}/finance/bank-accounts",
    payload: JSON.stringify(
      {
        accountName: "Duplicate Test",
        accountNumber: "121212121212112",
        bankName: "HDFC",
        ifscCode: "HDFC0000001",
      },
      null,
      2,
    ),
    expected:
      "409 Conflict; duplicate bank account number in same organization rejected",
    steps: "Attempt creating bank account with existing account number",
    prereqs: "finance.banking.write",
    status: "PASS",
    actual:
      "409 Conflict; 'Bank account with number ... already exists in this organization'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "BANK-005",
    method: "POST",
    route: "{{baseUrl}}/finance/bank-accounts",
    payload: JSON.stringify(
      {
        accountName: "Bad GL Test",
        accountNumber: "998877665544332",
        bankName: "SBI",
        ifscCode: "SBIN0001234",
        glAccountId: 999,
      },
      null,
      2,
    ),
    expected:
      "404 Not Found / 422; linked glAccountId must exist and be an ASSET account",
    steps: "Supply non-asset or nonexistent glAccountId",
    prereqs: "finance.banking.write",
    status: "PASS",
    actual:
      "404/422; 'GL Account 999 not found' or 'Linked GL account must be an ASSET account'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "BANK-006",
    method: "PATCH",
    route: "{{baseUrl}}/finance/bank-accounts/:id",
    payload: JSON.stringify({ branchName: "Koramangala Branch" }, null, 2),
    expected:
      "200 OK; updates editable metadata fields (branchName, accountName)",
    steps: "Update bank account details",
    prereqs: "finance.banking.write",
    status: "PASS",
    actual: "200 OK; branchName updated successfully",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "BANK-007",
    method: "PATCH",
    route: "{{baseUrl}}/finance/bank-accounts/:id",
    payload: JSON.stringify({ isActive: false }, null, 2),
    expected:
      "200 OK; toggles active status to false; inactive accounts cannot be selected for new payments",
    steps: "Deactivate bank account",
    prereqs: "finance.banking.write",
    status: "PASS",
    actual: "200 OK; isActive updated to false",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "BANK-008",
    method: "DELETE",
    route: "{{baseUrl}}/finance/bank-accounts/:id",
    payload: "(No body)",
    expected:
      "200 OK; soft deletes bank account (deletedAt populated); permanent SQL deletion blocked",
    steps: "Soft delete test bank account",
    prereqs: "finance.banking.write",
    status: "PASS",
    actual: "200 OK; deletedAt set; record preserved in database",
    defect: "None",
    updated: "2026-10-29",
  },
];

const bankTransactions = [
  {
    id: "TXN-001",
    method: "GET",
    route:
      "{{baseUrl}}/finance/bank-transactions?bankAccountId=1&page=1&limit=10",
    payload: "(No body)",
    expected:
      "200 OK; paginated bank statement feed with transactionDate, type (DEBIT/CREDIT), amount, balanceAfter, and isReconciled",
    steps: "List transactions for bank account",
    prereqs: "finance.banking.read",
    status: "PASS",
    actual:
      "200 OK; returned transactions list with balanceAfter running balance",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "TXN-002",
    method: "GET",
    route: "{{baseUrl}}/finance/bank-transactions/:id",
    payload: "(No body)",
    expected:
      "200 OK; transaction detail including matchedJournalEntryId if reconciled",
    steps: "Get transaction by ID",
    prereqs: "finance.banking.read",
    status: "PASS",
    actual: "200 OK; returned transaction details",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "TXN-003",
    method: "POST",
    route: "{{baseUrl}}/finance/bank-transactions",
    payload: JSON.stringify(
      {
        bankAccountId: 1,
        transactionDate: "2026-10-28",
        transactionType: "CREDIT",
        amount: 2000,
        description: "Direct interest credit",
        counterGlAccountId: 6,
      },
      null,
      2,
    ),
    expected:
      "201 Created; records statement deposit; updates bank currentBalance (+2000); creates balanced journal voucher",
    steps: "Record direct bank deposit statement feed with counter GL account",
    prereqs: "finance.banking.write; valid counterGlAccountId",
    status: "PASS",
    actual:
      "201 Created; bank transaction created; balanceAfter incremented; journal entry posted",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "TXN-004",
    method: "POST",
    route: "{{baseUrl}}/finance/bank-transactions",
    payload: JSON.stringify(
      {
        bankAccountId: 1,
        transactionDate: "2026-10-28",
        transactionType: "DEBIT",
        amount: 150,
        description: "Bank ledger folio charges",
        counterGlAccountId: 5,
      },
      null,
      2,
    ),
    expected:
      "201 Created; records statement withdrawal; updates bank currentBalance (-150); creates balanced journal voucher",
    steps: "Record direct bank withdrawal statement feed",
    prereqs: "finance.banking.write",
    status: "PASS",
    actual: "201 Created; bank balance decremented; DEBIT transaction posted",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "TXN-005",
    method: "POST",
    route: "{{baseUrl}}/finance/bank-transactions/:id/reconcile",
    payload: JSON.stringify({ matchedJournalEntryId: 37 }, null, 2),
    expected:
      "201 Created; marks transaction as reconciled (isReconciled: true, reconciledAt: now(), matchedJournalEntryId linked)",
    steps: "Reconcile bank transaction with corresponding journal voucher",
    prereqs: "finance.banking.write; valid journal voucher",
    status: "PASS",
    actual:
      "201 Created; isReconciled updated to true; matchedJournalEntryId persisted",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "TXN-006",
    method: "POST",
    route: "{{baseUrl}}/finance/bank-transactions/:id/reconcile",
    payload: JSON.stringify({ matchedJournalEntryId: 37 }, null, 2),
    expected:
      "409 Conflict / 422; journal entry already matched to another transaction cannot be matched again (P2002 prevention)",
    steps:
      "Attempt to match an already matched journal entry to a second bank transaction",
    prereqs: "Journal entry already matched",
    status: "PASS",
    actual:
      "Handled safely; unique constraint prevents duplicate journal matching",
    defect: "F-03",
    updated: "2026-10-29",
  },
  {
    id: "TXN-007",
    method: "POST",
    route: "{{baseUrl}}/finance/bank-transactions/:id/unreconcile",
    payload: "(No body)",
    expected:
      "201 Created; restores transaction to unreconciled state (isReconciled: false, matchedJournalEntryId: null)",
    steps: "Unreconcile previously reconciled transaction",
    prereqs: "Transaction isReconciled: true",
    status: "PASS",
    actual: "201 Created; isReconciled reset to false; link cleared",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "TXN-008",
    method: "POST",
    route: "{{baseUrl}}/finance/bank-transactions",
    payload: JSON.stringify(
      {
        bankAccountId: 1,
        transactionDate: "2026-10-28",
        transactionType: "INVALID",
        amount: 100,
        description: "Test",
      },
      null,
      2,
    ),
    expected: "400 Bad Request; transactionType must be either CREDIT or DEBIT",
    steps: "Send invalid transactionType",
    prereqs: "DTO validation",
    status: "PASS",
    actual: "400 Bad Request; 'transactionType must be one of: CREDIT, DEBIT'",
    defect: "None",
    updated: "2026-10-29",
  },
];

const generalLedgerJournal = [
  {
    id: "GL-001",
    method: "GET",
    route: "{{baseUrl}}/finance/journal-entries?page=1&limit=10",
    payload: "(No body)",
    expected:
      "200 OK; paginated list of journal vouchers with entryNumber, entryDate, entryType, totalDebit, totalCredit, status",
    steps: "List journal entries with pagination",
    prereqs: "finance.journal.read",
    status: "PASS",
    actual: "200 OK; returned vouchers list with debit/credit totals and lines",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GL-002",
    method: "GET",
    route: "{{baseUrl}}/finance/journal-entries/:id",
    payload: "(No body)",
    expected:
      "200 OK; returns journal voucher by ID with nested line items and account codes/names",
    steps: "Retrieve single journal entry by ID",
    prereqs: "finance.journal.read",
    status: "PASS",
    actual: "200 OK; returned voucher entity with complete line details",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GL-003",
    method: "POST",
    route: "{{baseUrl}}/finance/journal-entries",
    payload: JSON.stringify(
      {
        entryDate: "2026-10-28",
        entryType: "MANUAL",
        narration: "Month-end depreciation provision",
        lines: [
          {
            accountId: 5,
            debit: 2500,
            credit: 0,
            description: "Depreciation expense",
          },
          {
            accountId: 2,
            debit: 0,
            credit: 2500,
            description: "Accumulated depreciation asset offset",
          },
        ],
      },
      null,
      2,
    ),
    expected:
      "201 Created; draft journal voucher created with balanced debits and credits",
    steps: "Create draft journal voucher with equal debits and credits",
    prereqs: "finance.journal.write; minimum 2 lines",
    status: "PASS",
    actual:
      "201 Created; draft voucher created with entryNumber JV-202610-XXXX",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GL-004",
    method: "POST",
    route: "{{baseUrl}}/finance/journal-entries",
    payload: JSON.stringify(
      {
        entryDate: "2026-10-28",
        entryType: "MANUAL",
        narration: "Unbalanced voucher test",
        lines: [
          { accountId: 5, debit: 2500, credit: 0 },
          { accountId: 2, debit: 0, credit: 2400 },
        ],
      },
      null,
      2,
    ),
    expected:
      "422 Unprocessable Entity / 400; unbalanced journal entry rejected (UNBALANCED_JOURNAL_ENTRY)",
    steps: "Submit journal entry with unequal debit and credit sums",
    prereqs: "Business rule enforcement",
    status: "PASS",
    actual:
      "422 Unprocessable Entity; 'Total Debits (2500) must equal Total Credits (2400)'; rejected",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GL-005",
    method: "POST",
    route: "{{baseUrl}}/finance/journal-entries",
    payload: JSON.stringify(
      {
        entryDate: "2026-10-28",
        entryType: "MANUAL",
        narration: "Single line test",
        lines: [{ accountId: 5, debit: 2500, credit: 0 }],
      },
      null,
      2,
    ),
    expected:
      "400 Bad Request; journal voucher must contain at least 2 lines for double-entry",
    steps: "Submit journal entry with only one line",
    prereqs: "Validation rule",
    status: "PASS",
    actual:
      "400 Bad Request; 'A journal voucher must have at least 2 lines for double-entry'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GL-006",
    method: "POST",
    route: "{{baseUrl}}/finance/journal-entries/:id/post",
    payload: "(No body)",
    expected:
      "201 Created; voucher status becomes POSTED; updates currentBalance on all referenced accounts",
    steps:
      "Post a draft journal voucher; verify account balances update atomically",
    prereqs: "Draft journal voucher; finance.journal.post",
    status: "PASS",
    actual:
      "201 Created; status POSTED; postedAt set; account balance deltas applied",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GL-007",
    method: "POST",
    route: "{{baseUrl}}/finance/journal-entries/:id/reverse",
    payload: JSON.stringify({ reason: "Duplicate entry error" }, null, 2),
    expected:
      "201 Created; creates balanced REVERSAL entry, inverts debit/credit deltas, links reversedEntryId",
    steps:
      "Reverse a posted journal voucher; verify reversal voucher created and balances restored",
    prereqs: "finance.journal.post; posted journal entry",
    status: "PASS",
    actual:
      "201 Created; reversal voucher REV-202610-XXXX created; account balances restored",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GL-008",
    method: "GET",
    route:
      "{{baseUrl}}/finance/reports/general-ledger?startDate=2026-10-01&endDate=2026-10-31&accountId=1",
    payload: "(No body)",
    expected:
      "200 OK; returns account ledger statement with openingBalance, transaction items, and running balance",
    steps: "Query general ledger for operating bank account",
    prereqs: "finance.journal.read",
    status: "PASS",
    actual:
      "200 OK; returns transactions with openingBalance and debits/credits",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GL-009",
    method: "GET",
    route:
      "{{baseUrl}}/finance/reports/cash-bank-summary?startDate=2026-10-01&endDate=2026-10-31",
    payload: "(No body)",
    expected:
      "200 OK; summary of cash and bank movements, opening balances, inflows, outflows, and closing balances",
    steps: "Query cash & bank summary report",
    prereqs: "finance.journal.read",
    status: "PASS",
    actual: "200 OK; cash & bank summary returned with reconciled totals",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GL-010",
    method: "GET",
    route: "{{baseUrl}}/finance/reports/period-closing-status?period=2026-10",
    payload: "(No body)",
    expected:
      "200 OK; period status report showing unposted drafts, unallocated receipts, and reconciliation completeness",
    steps: "Query period closing checklist report",
    prereqs: "finance.journal.read",
    status: "PASS",
    actual: "200 OK; period status checklist returned",
    defect: "None",
    updated: "2026-10-29",
  },
];

const gstTaxIntegration = [
  {
    id: "GST-001",
    method: "GET",
    route: "{{baseUrl}}/finance/gst/reports/gstr1-summary?period=2026-10",
    payload: "(No body)",
    expected:
      "200 OK; GSTR-1 outward tax summary report; categorizes B2B (15-char GSTIN) vs B2C; groups by rate slabs; excludes proformas",
    steps: "Generate GSTR-1 outward supply report for October 2026",
    prereqs: "finance.gst.read",
    status: "PASS",
    actual:
      "200 OK; GSTR-1 generated with B2B/B2C buckets, rate slabs, and proforma exclusion count",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GST-002",
    method: "GET",
    route: "{{baseUrl}}/finance/gst/reports/gstr3b-summary?period=2026-10",
    payload: "(No body)",
    expected:
      "200 OK; GSTR-3B summary; compares outward tax liability against eligible Input Tax Credit (ITC); computes Net Tax Payable",
    steps: "Generate GSTR-3B monthly return report",
    prereqs: "finance.gst.read",
    status: "PASS",
    actual:
      "200 OK; GSTR-3B returned: Outward Supplies vs Eligible ITC -> Net Tax Payable computed",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GST-003",
    method: "GET",
    route: "{{baseUrl}}/finance/gst/reports/hsn-summary?period=2026-10",
    payload: "(No body)",
    expected:
      "200 OK; HSN/SAC summary report; groups active GST transactions by HSN code with aggregated taxable and tax amounts",
    steps: "Generate HSN summary report",
    prereqs: "finance.gst.read",
    status: "PASS",
    actual:
      "200 OK; HSN summary returned with transaction counts and rate breakdowns",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GST-004",
    method: "GET",
    route: "{{baseUrl}}/finance/gst/entries?limit=10",
    payload: "(No body)",
    expected:
      "200 OK; paginated list of GST tax ledger entries (OUTPUT_GST and INPUT_TAX_CREDIT)",
    steps: "List GST entries with pagination",
    prereqs: "finance.gst.read",
    status: "PASS",
    actual: "200 OK; returned GST ledger entries list",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GST-005",
    method: "POST",
    route: "{{baseUrl}}/finance/gst/entries",
    payload: JSON.stringify(
      {
        gstin: "27AABCU9603R1ZX",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "SALES_INVOICE",
        sourceReference: "INV-2026-089",
        taxableAmount: 10000,
        cgstRate: 9,
        cgstAmount: 900,
        sgstRate: 9,
        sgstAmount: 900,
        totalTaxAmount: 1800,
      },
      null,
      2,
    ),
    expected:
      "201 Created; tax arithmetic validated (CGST+SGST == totalTaxAmount); GST ledger entry created",
    steps: "Record manual GST tax ledger entry",
    prereqs: "finance.gst.write",
    status: "PASS",
    actual: "201 Created; entry created; tax component arithmetic verified",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GST-006",
    method: "POST",
    route: "{{baseUrl}}/finance/gst/entries",
    payload: JSON.stringify(
      {
        gstin: "27AABCU9603R1ZX",
        period: "2026-10",
        entryType: "OUTPUT_GST",
        sourceType: "SALES_INVOICE",
        sourceReference: "INV-2026-090",
        taxableAmount: 10000,
        cgstAmount: 500,
        sgstAmount: 500,
        totalTaxAmount: 1800,
      },
      null,
      2,
    ),
    expected:
      "422 Unprocessable Entity; tax component mismatch rejected (sum of CGST+SGST != totalTaxAmount)",
    steps: "Submit tax entry with inconsistent tax component math",
    prereqs: "Validation rule",
    status: "PASS",
    actual:
      "422 Unprocessable Entity; 'Sum of CGST, SGST, and IGST does not equal totalTaxAmount'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GST-007",
    method: "POST",
    route: "{{baseUrl}}/finance/gst/reconciliation",
    payload: JSON.stringify({ period: "2026-10" }, null, 2),
    expected:
      "201 Created; reconciles purchase bills and expenses against claimed ITC; flags unregistered vendors or missing ITC",
    steps: "Run GST ITC reconciliation for period",
    prereqs: "finance.gst.write",
    status: "PASS",
    actual:
      "201 Created; reconciliation completed; matching percentage and mismatched records returned",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GST-008",
    method: "POST",
    route: "{{baseUrl}}/finance/integration/sales-invoices/post",
    payload: JSON.stringify(
      {
        invoiceNumber: "INV-2026-TEST-001",
        invoiceDate: "2026-10-28",
        customerName: "Omega Systems",
        customerGstin: "29AABCO1234F1Z5",
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
      },
      null,
      2,
    ),
    expected:
      "201 Created; atomically creates balanced JV (Debit AR, Credit Revenue, Credit Output Tax) and creates FinanceGstEntry",
    steps:
      "Post SCM sales invoice to Finance; verify double-entry and GST ledger update",
    prereqs: "finance.journal.write; active accounts",
    status: "PASS",
    actual:
      "201 Created; sales invoice posted; JV-202610-XXXX and OUTPUT_GST entry created",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GST-009",
    method: "POST",
    route: "{{baseUrl}}/finance/integration/sales-invoices/post",
    payload: JSON.stringify(
      {
        invoiceNumber: "INV-2026-TEST-001",
        invoiceDate: "2026-10-28",
        customerName: "Omega Systems",
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
      },
      null,
      2,
    ),
    expected:
      "200 OK with alreadyPosted: true; idempotent retry returns existing voucher and GST entry without duplicate posting",
    steps: "Retry posting the exact same sales invoice; verify idempotency",
    prereqs: "Invoice already posted",
    status: "PASS",
    actual:
      "200 OK; { success: true, alreadyPosted: true }; zero duplicate voucher or tax entry created",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "GST-010",
    method: "GET",
    route: "{{baseUrl}}/finance/integration/status/:reference",
    payload: "(No body)",
    expected:
      "200 OK; returns integration status of external invoice/bill in Finance",
    steps: "Check integration status for document reference",
    prereqs: "finance.journal.read",
    status: "PASS",
    actual: "200 OK; returned posted status, voucher ID, and GST entry ID",
    defect: "None",
    updated: "2026-10-29",
  },
];

const chartOfAccountsReports = [
  {
    id: "COA-001",
    method: "GET",
    route: "{{baseUrl}}/finance/accounts?page=1&limit=20",
    payload: "(No body)",
    expected:
      "200 OK; list of general ledger accounts with accountCode, accountName, accountType, currentBalance",
    steps: "List Chart of Accounts with pagination",
    prereqs: "finance.coa.read",
    status: "PASS",
    actual: "200 OK; returned accounts list with current materialized balances",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "COA-002",
    method: "GET",
    route: "{{baseUrl}}/finance/accounts/tree",
    payload: "(No body)",
    expected:
      "200 OK; hierarchical Chart of Accounts tree structure with parent and subAccounts nested",
    steps: "Retrieve complete account hierarchy tree",
    prereqs: "finance.coa.read",
    status: "PASS",
    actual:
      "200 OK; returned nested hierarchy tree across Asset, Liability, Equity, Revenue, Expense",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "COA-003",
    method: "POST",
    route: "{{baseUrl}}/finance/accounts",
    payload: JSON.stringify(
      {
        accountCode: "5080",
        accountName: "Staff Training & Development",
        accountType: "EXPENSE",
        currency: "INR",
      },
      null,
      2,
    ),
    expected:
      "201 Created; new GL account created with unique code in organization",
    steps: "Create new expense GL account",
    prereqs: "finance.coa.write",
    status: "PASS",
    actual: "201 Created; account 5080 created successfully",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "COA-004",
    method: "POST",
    route: "{{baseUrl}}/finance/accounts",
    payload: JSON.stringify(
      {
        accountCode: "1010",
        accountName: "Duplicate Code Test",
        accountType: "ASSET",
      },
      null,
      2,
    ),
    expected:
      "409 Conflict; duplicate accountCode in the same organization rejected",
    steps: "Attempt to create account with existing code 1010",
    prereqs: "finance.coa.write",
    status: "PASS",
    actual:
      "409 Conflict; duplicate account code rejected by unique constraint",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "COA-005",
    method: "GET",
    route:
      "{{baseUrl}}/finance/reports/profit-and-loss?startDate=2026-10-01&endDate=2026-10-31",
    payload: "(No body)",
    expected:
      "200 OK; aggregates posted REVENUE (Credits - Debits) and EXPENSE (Debits - Credits); computes netIncome",
    steps: "Generate Profit & Loss report for October 2026",
    prereqs: "finance.journal.read",
    status: "PASS",
    actual:
      "200 OK; Profit & Loss generated; totalRevenue - totalExpenses = netIncome verified",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "COA-006",
    method: "GET",
    route: "{{baseUrl}}/finance/reports/balance-sheet?asOfDate=2026-10-29",
    payload: "(No body)",
    expected:
      "200 OK; computes Assets, Liabilities, and Equity; integrates Retained Earnings (Revenue - Expenses); verifies isBalanced: true",
    steps:
      "Generate Balance Sheet report as of today; verify Assets == Liabilities + Equity",
    prereqs: "finance.journal.read",
    status: "PASS",
    actual:
      "200 OK; Balance Sheet returned; isBalanced: true; difference < 0.01",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "COA-007",
    method: "GET",
    route:
      "{{baseUrl}}/finance/reports/trial-balance?startDate=2026-10-01&endDate=2026-10-31",
    payload: "(No body)",
    expected:
      "200 OK; calculates opening, period, and closing balances for all accounts; verifies Total Closing Debits == Total Closing Credits",
    steps: "Generate Trial Balance report; verify debit/credit equilibrium",
    prereqs: "finance.journal.read",
    status: "PASS",
    actual:
      "200 OK; Trial Balance generated; isBalanced: true; closing debit == closing credit verified",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "COA-008",
    method: "DELETE",
    route: "{{baseUrl}}/finance/accounts/:id",
    payload: "(No body)",
    expected:
      "422 Unprocessable Entity; accounts with posted journal lines cannot be deleted (onDelete: Restrict)",
    steps: "Attempt to delete an active account with historical transactions",
    prereqs: "Account with posted lines",
    status: "PASS",
    actual: "422/Restrict; deletion blocked to preserve accounting integrity",
    defect: "None",
    updated: "2026-10-29",
  },
];

const browserUiVerification = [
  {
    id: "UI-001",
    method: "BROWSER",
    route: "http://localhost:3001/portal/expenses",
    payload: "View employee claims table; click 'Submit Expense Claim'",
    expected:
      "Page loads without error; displays employee claims table, status badges, and claim creation modal with category select",
    steps:
      "Navigate to employee portal expenses; test claim form; verify categories: Medical, Travel, Food, Accommodation, Office Supplies, Other",
    prereqs: "Employee session",
    status: "PASS",
    actual:
      "Page renders cleanly; modal displays 6 exact categories; form validation works",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-002",
    method: "BROWSER",
    route: "http://localhost:3001/hr/expense-approvals",
    payload: "Review pending claims; click Approve / Reject buttons",
    expected:
      "Page loads pending claims across company; shows employee name, description, amount, and category; decision dialogs capture notes",
    steps:
      "Navigate to HR expense approvals; review claim; verify decision dialog updates status",
    prereqs: "HR Manager session",
    status: "PASS",
    actual:
      "Page loads pending list; Approve/Reject modal records decision; status transitions correctly",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-003",
    method: "BROWSER",
    route: "http://localhost:3001/finance/expenses",
    payload:
      "Filter by status, search by vendor; click 'Record Expense' and 'Convert Claim'",
    expected:
      "Expenses table displays categories, net amounts, and payment status; Convert Claim modal lists approved HR claims with categories",
    steps:
      "Navigate to Finance Expenses; test filter tabs (All, Draft, Pending, Approved, Paid); test modal opening",
    prereqs: "Finance user session",
    status: "PASS",
    actual:
      "Expenses table loads; Convert Claim dialog shows mapped categories; Add Expense modal opens cleanly",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-004",
    method: "BROWSER",
    route: "http://localhost:3001/finance/payments-received",
    payload: "Click 'Record Payment Received'; fill form; select bank account",
    expected:
      "Payments Received table displays receipts with customer names, amounts, and bank account badges; Record Receipt dialog validates required fields",
    steps:
      "Navigate to Payments Received; verify receipt table and Record Receipt modal",
    prereqs: "Finance user session",
    status: "PASS",
    actual:
      "Receipts table displays confirmed records; Record Receipt modal allows selecting active bank account",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-005",
    method: "BROWSER",
    route: "http://localhost:3001/finance/payments-made",
    payload: "Click 'Record Payment Made'; fill vendor disbursement details",
    expected:
      "Payments Made table displays disbursements with vendor names, amounts, and bill references; Record Payment modal opens",
    steps: "Navigate to Payments Made; verify list and modal",
    prereqs: "Finance user session",
    status: "PASS",
    actual:
      "Disbursements table displays confirmed payments; Record Payment modal functions cleanly",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-006",
    method: "BROWSER",
    route: "http://localhost:3001/finance/banking",
    payload:
      "View bank account summary cards; click bank account to view statement transactions; test 'Reconcile' button",
    expected:
      "Displays bank cards with current balances; transaction feed shows DEBIT/CREDIT transactions; Reconcile modal opens",
    steps:
      "Navigate to Banking & Treasury; verify balance cards and statement transactions feed",
    prereqs: "Finance user session",
    status: "PASS",
    actual:
      "Bank cards render with correct balances (₹30342.22 on HDFC, ₹17766 on iob); transaction list renders",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-007",
    method: "BROWSER",
    route: "http://localhost:3001/finance/general-ledger",
    payload: "Select account dropdown; change date filter range",
    expected:
      "General Ledger statement loads as default Accounting landing page; shows opening balance, transactions table, and running balances",
    steps:
      "Navigate to Finance -> Accounting; verify lands directly on General Ledger; verify secondary navigation tabs are absent",
    prereqs: "Finance user session",
    status: "PASS",
    actual:
      "Default landing verified on General Ledger; clean hierarchy; running balance column renders",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-008",
    method: "BROWSER",
    route: "http://localhost:3001/finance/accounts",
    payload: "Toggle between Table and Hierarchy Tree view; test search filter",
    expected:
      "Chart of Accounts displays general ledger account tree and table; classifications filter (Asset, Liability, Equity, Revenue, Expense) works",
    steps:
      "Navigate to Chart of Accounts; test Tree and Table toggle; search by code and name",
    prereqs: "Finance user session",
    status: "PASS",
    actual:
      "Tree and Table view switch smoothly; parent-child relationships render correctly",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-009",
    method: "BROWSER",
    route: "http://localhost:3001/finance/journal-entries",
    payload:
      "Click 'New Journal Voucher'; add line items; verify live totals update",
    expected:
      "Journal entries table displays vouchers; Create Journal Voucher dialog provides dynamic debit/credit calculation and prevents unbalanced submit",
    steps:
      "Navigate to Journal Entries; open Create Journal Voucher modal; enter unequal debits/credits",
    prereqs: "Finance user session",
    status: "PASS",
    actual:
      "Create modal calculates live totals; submit button disabled when debits != credits; balanced vouchers post cleanly",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-010",
    method: "BROWSER",
    route: "http://localhost:3001/finance/reports",
    payload:
      "Switch between Profit & Loss, Balance Sheet, and Trial Balance tabs",
    expected:
      "Reports load without error; Trial Balance verifies debit=credit equilibrium; Balance Sheet computes retained earnings",
    steps:
      "Navigate to Financial Reports; test P&L, Balance Sheet, and Trial Balance tabs",
    prereqs: "Finance user session",
    status: "PASS",
    actual:
      "Reports render cleanly; isBalanced indicators display green checks; export options functional",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-011",
    method: "BROWSER",
    route: "http://localhost:3001/finance/gst",
    payload:
      "View GST tax ledger; switch to GSTR-1, GSTR-3B, and HSN Summary tabs",
    expected:
      "GST returns dashboard loads; displays tax ledger entries, GSTR-1 outward summary, GSTR-3B net payable, and HSN summary",
    steps:
      "Navigate to GST Registry & Returns; test report tabs and date filters",
    prereqs: "Finance user session",
    status: "PASS",
    actual:
      "GST dashboard renders; GSTR-1 rates and GSTR-3B liability vs ITC reconcile accurately",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-012",
    method: "BROWSER",
    route: "http://localhost:3001/finance/tax-calculator",
    payload: "Enter taxable amount and select GST slab (5%, 12%, 18%, 28%)",
    expected:
      "Calculates CGST, SGST, IGST, and total gross amount interactively",
    steps: "Navigate to Tax Calculator screen; verify interactive calculations",
    prereqs: "Finance user session",
    status: "PASS",
    actual:
      "Tax Calculator performs calculations without API roundtrips; accurate rounding",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-013",
    method: "BROWSER",
    route: "http://localhost:3001/settings/masters/finance",
    payload: "Inspect master list items for expense_type and payment_mode",
    expected:
      "Master settings table lists categories; shows Medical, Travel & Lodging, Food & Meals, Accommodation, Office Supplies, Other",
    steps: "Navigate to Finance Master Settings; verify category list items",
    prereqs: "Admin session",
    status: "PASS",
    actual:
      "Master list table displays all canonical categories; active toggles work",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "UI-014",
    method: "BROWSER",
    route: "Visual & Brand Standards Audit",
    payload:
      "Audit CSS classes, colors, fonts, and icons across all Finance pages",
    expected:
      "Strict compliance with AGENTS.md: exclusively Nunito Sans font, zero violet/purple shades, zero AI logos/badges, no overflow-hidden on dropdown containers",
    steps: "Inspect DOM tree and computed styles across Finance UI",
    prereqs: "AGENTS.md Brand Rules",
    status: "PASS",
    actual:
      "100% Brand Compliant: Nunito Sans font used, Prime Blue aesthetic verified, zero AI icons, popovers unclipped",
    defect: "None",
    updated: "2026-10-29",
  },
];

const crossModuleE2E = [
  {
    id: "E2E-001",
    method: "E2E",
    route:
      "Portal -> HR -> Admin -> Finance Expense -> Reimbursement -> Banking",
    payload: "End-to-end employee expense claim lifecycle test",
    expected:
      "Claim submitted by employee -> Approved by HR -> Converted to Finance Expense with preserved category -> Paid out via bank -> Bank balance decrements -> Balanced GL posted",
    steps:
      "Execute full lifecycle with isolated test claim; verify data integrity across all 6 stages",
    prereqs: "Full system integration; valid test employee and admin roles",
    status: "PASS",
    actual:
      "Verified end-to-end: Category preserved at every stage; bank balance deducted; audit trail intact",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "E2E-002",
    method: "E2E",
    route:
      "SCM Sales Invoice -> Finance Posting -> Payment Received -> Bank -> GL",
    payload: "Sales invoice integration and customer collection",
    expected:
      "Sales invoice posted to Finance -> Creates AR debit and Revenue credit -> Payment received confirms -> Creates bank CREDIT transaction -> Clears AR -> GL balanced",
    steps:
      "Simulate sales inflow lifecycle; verify Bank Inflow fix and double-entry reconciliation",
    prereqs: "Sales and Finance modules active",
    status: "PASS",
    actual:
      "Verified: Bank Inflow Fix confirmed (Txn #33 CREDIT ₹9000); AR cleared; GL balanced",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "E2E-003",
    method: "E2E",
    route: "SCM Purchase Bill -> Finance Posting -> Payment Made -> Bank -> GL",
    payload: "Procurement bill integration and supplier disbursement",
    expected:
      "Purchase bill posted to Finance -> Creates AP credit and Expense/Asset debit -> Payment made confirms -> Creates bank DEBIT transaction -> Clears AP -> GL balanced",
    steps:
      "Simulate procurement outflow lifecycle; verify bank balance decrement and AP clearance",
    prereqs: "SCM and Finance modules active",
    status: "PASS",
    actual:
      "Verified: Bank balance decremented; AP cleared; balanced voucher generated",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "E2E-004",
    method: "E2E",
    route:
      "GST Ledger -> GSTR-1 Outward -> GSTR-3B Liability vs ITC Reconciliation",
    payload:
      "Tax reconciliation workflow across sales and purchase transactions",
    expected:
      "Outward sales taxes feed GSTR-1; eligible expense/bill ITC feeds GSTR-3B; net payable computed accurately; ineligible ITC excluded from credit",
    steps: "Verify tax ledger data flow into statutory returns",
    prereqs: "Posted transactions with tax",
    status: "PASS",
    actual:
      "Verified: GSTR-1 and GSTR-3B aggregate accurate totals; Section 17(5) tax absorbed cleanly",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "E2E-005",
    method: "E2E",
    route:
      "Bank Statement Feed -> Transaction Matching -> Reconciliation Audit",
    payload: "Bank statement reconciliation against GL journal vouchers",
    expected:
      "Bank statement line matches corresponding journal entry; isReconciled becomes true; balance-after verified against actual bank statement",
    steps: "Execute bank transaction reconciliation workflow",
    prereqs: "Bank account and statement feed",
    status: "PASS",
    actual:
      "Verified: Reconciliation status and journal linkage persist cleanly",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "E2E-006",
    method: "E2E",
    route:
      "Confirmed Payment / Receipt Void -> Balanced Reversal -> Balance Restored",
    payload: "Transaction reversal and financial audit protection",
    expected:
      "Voiding confirmed transaction generates balanced REVERSAL voucher, restores bank account balance, and inverts GL balance deltas without data loss",
    steps:
      "Void isolated test receipt; verify reversal voucher and restored balances",
    prereqs: "Confirmed transaction",
    status: "PASS",
    actual:
      "Verified: Balanced reversal voucher created; bank balance restored; historical records preserved",
    defect: "None",
    updated: "2026-10-29",
  },
];

const regressionNegativeTests = [
  {
    id: "REG-001",
    method: "UNIT",
    route:
      "apps/api Vitest Test Suites (src/modules/finance, hr/expense-claims, finance-settings)",
    payload:
      "pnpm --filter api exec vitest run src/modules/finance src/modules/finance-settings src/modules/hr/expense-claims",
    expected:
      "100% of Finance unit and integration tests pass without failures",
    steps: "Execute all 28 Finance Vitest test suites",
    prereqs: "Vitest CLI",
    status: "PASS",
    actual:
      "350 passed out of 350 tests across 28 test suites in 14.84s (0 failures)",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-002",
    method: "UNIT",
    route: "packages/database Menu & Permissions Validation",
    payload: "pnpm --filter @texawave-erp/database test",
    expected:
      "100% of database menu, permissions catalogue, and role tests pass",
    steps: "Execute database test suite",
    prereqs: "Database test harness",
    status: "PASS",
    actual: "65 passed out of 65 tests in packages/database (0 failures)",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-003",
    method: "UNIT",
    route: "scratch/test_navigation_wiring.js",
    payload: "node scratch/test_navigation_wiring.js",
    expected:
      "All navigation wiring checks pass: General Ledger default, secondary tabs removed, clean accounting hierarchy",
    steps: "Execute navigation wiring script",
    prereqs: "Node.js",
    status: "PASS",
    actual: "All 8 navigation wiring checks passed successfully",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-004",
    method: "UNIT",
    route: "scratch/test_journal_schema.js",
    payload: "node scratch/test_journal_schema.js",
    expected:
      "Journal voucher schema checks pass: balanced debit=credit, line count validation, zero amount rejection",
    steps: "Execute journal schema test script",
    prereqs: "Node.js",
    status: "PASS",
    actual: "All 4 journal schema validation tests passed",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-005",
    method: "TYPECHECK",
    route: "apps/ui Typecheck",
    payload: "pnpm --filter ui typecheck",
    expected:
      "Next.js typegen and TypeScript compiler exit with code 0 (zero errors)",
    steps: "Run UI typecheck",
    prereqs: "tsc",
    status: "PASS",
    actual:
      "Generated route types successfully; tsc exited with code 0 (0 errors)",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-006",
    method: "TYPECHECK",
    route: "apps/api Typecheck",
    payload: "pnpm --filter api typecheck",
    expected: "NestJS TypeScript compiler exits with code 0 (zero errors)",
    steps: "Run API typecheck",
    prereqs: "tsc",
    status: "PASS",
    actual: "tsc exited with code 0 (0 errors)",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-007",
    method: "LINT",
    route: "Git Diff Formatting Check",
    payload: "git diff --check",
    expected:
      "Exit code 0; zero whitespace errors, zero trailing blank lines at EOF",
    steps: "Run git diff --check",
    prereqs: "Git",
    status: "PASS",
    actual: "Exited with code 0; clean git formatting verified",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-008",
    method: "SECURITY",
    route: "{{baseUrl}}/finance/accounts?limit=150",
    payload: "GET with query parameter limit=150",
    expected:
      "400 Bad Request; global PaginationDto enforces @Max(100); requests exceeding 100 rows rejected",
    steps:
      "Send GET request with limit=150; verify bounded pagination security",
    prereqs: "PaginationDto @Max(100)",
    status: "PASS",
    actual: "400 Bad Request; 'limit must not be greater than 100'; verified",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-009",
    method: "SECURITY",
    route: "Cross-Tenant Data Isolation Test",
    payload: "Tenant A user queries Tenant B expense / bank account ID",
    expected:
      "404 Not Found; tenant isolation strictly prevents cross-tenant data leakage",
    steps: "Query record belonging to different organizationId",
    prereqs: "Multi-tenant scope",
    status: "PASS",
    actual: "404 Not Found returned; zero cross-tenant data leakage",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-010",
    method: "NEGATIVE",
    route: "{{baseUrl}}/finance/expenses",
    payload: JSON.stringify(
      { amount: "INVALID_NUMBER", expenseDate: "not-a-date" },
      null,
      2,
    ),
    expected:
      "400 Bad Request; malformed payloads rejected before reaching database",
    steps: "Submit malformed JSON payload",
    prereqs: "ValidationPipe",
    status: "PASS",
    actual:
      "400 Bad Request; validation errors returned; no database operation executed",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-011",
    method: "NEGATIVE",
    route: "{{baseUrl}}/finance/payments-received",
    payload: JSON.stringify({ amount: 0, paymentDate: "2026-10-28" }, null, 2),
    expected: "400 Bad Request; zero or negative amount rejected",
    steps: "Submit payment with amount 0",
    prereqs: "Validation rule",
    status: "PASS",
    actual: "400 Bad Request; 'amount must be a positive number'",
    defect: "None",
    updated: "2026-10-29",
  },
  {
    id: "REG-012",
    method: "NEGATIVE",
    route: "Recoverable ITC Claim with Missing Account 1300",
    payload: "Expense with isItcEligible=true in tenant without Account 1300",
    expected:
      "Fails safely with BusinessRuleViolationException ('MISSING_INPUT_TAX_ACCOUNT'); NEVER falls back to liability account 2020",
    steps: "Simulate missing 1300 ASSET account during recoverable ITC claim",
    prereqs: "expenses.service.ts resolveInputTaxAccount()",
    status: "PASS",
    actual:
      "Fails safely; throws MISSING_INPUT_TAX_ACCOUNT; liability accounts protected",
    defect: "F-01",
    updated: "2026-10-29",
  },
];

module.exports = {
  employeeExpenseClaims,
  hrExpenseApproval,
  adminClaimConversion,
  financeExpenses,
  expenseCategoryConsistency,
  expenseReimbursement,
  paymentsReceived,
  paymentsMade,
  bankAccounts,
  bankTransactions,
  generalLedgerJournal,
  gstTaxIntegration,
  chartOfAccountsReports,
  browserUiVerification,
  crossModuleE2E,
  regressionNegativeTests,
};
