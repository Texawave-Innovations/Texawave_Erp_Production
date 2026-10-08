import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PaginatedResponseDto } from "../../../../common/dto/paginated-response.dto.js";
import {
  InvalidStateTransitionException,
  ResourceNotFoundException,
} from "../../../../common/exceptions/business.exception.js";
import { QueryPaymentBatchDto } from "./dto/payment.dto.js";
import { PaymentsService } from "./payments.service.js";

const SCOPE = { organizationId: 1 };
const USER_ID = 42;

function bankDetail(deletedAt: Date | null = null) {
  return {
    bankName: "State Bank",
    accountNumberMasked: "********1234",
    ifsc: "SBIN0001234",
    deletedAt,
  };
}

function payment(overrides?: Record<string, unknown>) {
  return {
    id: 100,
    amount: 45000.5,
    paymentMethod: "BANK_TRANSFER",
    status: "PENDING",
    bankReference: null,
    employee: {
      id: 7,
      teamId: 3,
      userId: 70,
      employeeCode: "EMP-007",
      fullName: "Asha Rao",
      bankDetail: bankDetail(),
    },
    ...overrides,
  };
}

function makeService(overrides?: {
  level?: "own" | "team" | "all";
  teamIds?: number[];
  batch?: unknown;
  createdBatch?: unknown;
  processedBatch?: unknown;
  payment?: unknown;
  updated?: unknown;
  encrypted?: Map<number, string>;
}) {
  const has = (key: string) => overrides !== undefined && key in overrides;
  const defaultBatch = { id: 1, status: "PENDING", payments: [payment()] };

  const repository = {
    findBatches: vi.fn().mockResolvedValue({ items: [{ id: 1 }], total: 1 }),
    findBatchById: vi
      .fn()
      .mockResolvedValue(has("batch") ? overrides?.batch : defaultBatch),
    createBatch: vi
      .fn()
      .mockResolvedValue(
        has("createdBatch") ? overrides?.createdBatch : defaultBatch,
      ),
    processBatch: vi
      .fn()
      .mockResolvedValue(
        has("processedBatch")
          ? overrides?.processedBatch
          : { ...defaultBatch, status: "PROCESSED" },
      ),
    findEncryptedAccountNumbers: vi
      .fn()
      .mockResolvedValue(
        overrides?.encrypted ?? new Map([[7, "enc:123456781234"]]),
      ),
    findPaymentById: vi
      .fn()
      .mockResolvedValue(has("payment") ? overrides?.payment : payment()),
    updatePayment: vi
      .fn()
      .mockImplementation(
        (
          _scope: unknown,
          _id: number,
          _expected: string,
          dto: Record<string, unknown>,
        ) => (has("updated") ? overrides?.updated : payment({ ...dto })),
      ),
  };

  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(USER_ID),
  };

  const teamScope = {
    level: overrides?.level ?? "all",
    userId: USER_ID,
    organizationId: 1,
    teamIds: overrides?.teamIds ?? [],
  };
  const teamContext = {
    resolveScope: vi.fn().mockResolvedValue(teamScope),
  };

  const encryption = {
    decrypt: vi
      .fn()
      .mockImplementation((value: string) => value.replace("enc:", "")),
  };

  const service = new PaymentsService(
    repository as never,
    tenantContext as never,
    teamContext as never,
    encryption as never,
  );

  return { service, repository, teamContext, encryption };
}

describe("PaymentsService", () => {
  describe("batch operations require an organization-wide grant", () => {
    it("rejects viewing batches with a team grant", async () => {
      const { service, repository, teamContext } = makeService({
        level: "team",
        teamIds: [3],
      });

      await expect(
        service.findBatches(new QueryPaymentBatchDto()),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.payment.read");
      expect(repository.findBatches).not.toHaveBeenCalled();
    });

    it("rejects creating a batch with a team grant", async () => {
      const { service, repository, teamContext } = makeService({
        level: "team",
      });

      await expect(
        service.createBatch({ payrollPeriodId: 5 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.payment.write");
      expect(repository.createBatch).not.toHaveBeenCalled();
    });

    it("rejects processing and exporting with an own grant", async () => {
      const { service, repository } = makeService({ level: "own" });

      await expect(service.processBatch(1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.exportBatchCsv(1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.processBatch).not.toHaveBeenCalled();
      expect(repository.findBatchById).not.toHaveBeenCalled();
    });
  });

  describe("findBatches / findBatchById", () => {
    it("lists batches in the organization as a paginated response", async () => {
      const { service, repository } = makeService();
      const query = Object.assign(new QueryPaymentBatchDto(), {
        page: 1,
        limit: 20,
      });

      const result = await service.findBatches(query);

      expect(repository.findBatches).toHaveBeenCalledWith(SCOPE, query, query);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.items).toEqual([{ id: 1 }]);
    });

    it("returns a batch with bank details masked", async () => {
      const { service } = makeService();

      const result = await service.findBatchById(1);

      expect(result.payments[0]?.employee).not.toHaveProperty("bankDetail");
      expect(result.payments[0]?.employee.bankDetails).toEqual({
        bankName: "State Bank",
        accountNumber: "********1234",
        ifscCode: "SBIN0001234",
      });
    });

    it("reports an unknown batch as not found", async () => {
      const { service } = makeService({ batch: null });

      await expect(service.findBatchById(1)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("createBatch / processBatch", () => {
    it("creates a batch defaulting to bank transfer", async () => {
      const { service, repository } = makeService();

      const result = await service.createBatch({ payrollPeriodId: 5 });

      expect(repository.createBatch).toHaveBeenCalledWith(
        SCOPE,
        5,
        "BANK_TRANSFER",
        USER_ID,
      );
      expect(result.payments[0]?.employee.bankDetails?.accountNumber).toBe(
        "********1234",
      );
    });

    it("creates a batch with an explicit payment method", async () => {
      const { service, repository } = makeService();

      await service.createBatch({ payrollPeriodId: 5, paymentMethod: "CASH" });

      expect(repository.createBatch).toHaveBeenCalledWith(
        SCOPE,
        5,
        "CASH",
        USER_ID,
      );
    });

    it("reports a missing payroll period when no batch is created", async () => {
      const { service } = makeService({ createdBatch: null });

      const error = await service
        .createBatch({ payrollPeriodId: 5 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ResourceNotFoundException);
      expect((error as Error).message).toBe("Payroll period not found: 5");
    });

    it("processes a batch and masks its payments", async () => {
      const { service, repository } = makeService();

      const result = await service.processBatch(1);

      expect(repository.processBatch).toHaveBeenCalledWith(SCOPE, 1, USER_ID);
      expect(result.status).toBe("PROCESSED");
      expect(result.payments[0]?.employee).not.toHaveProperty("bankDetail");
    });

    it("reports an unknown batch when processing", async () => {
      const { service } = makeService({ processedBatch: null });

      await expect(service.processBatch(1)).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  describe("exportBatchCsv", () => {
    it("exports the decrypted account number with quoted cells", async () => {
      const { service, repository, encryption } = makeService();

      const csv = await service.exportBatchCsv(1);
      const lines = csv.split("\n");

      expect(repository.findEncryptedAccountNumbers).toHaveBeenCalledWith(
        SCOPE,
        [7],
      );
      expect(encryption.decrypt).toHaveBeenCalledWith("enc:123456781234");
      expect(lines[0]).toBe(
        "Employee Code,Employee Name,Bank Name,Account Number,IFSC Code,Amount,Payment Method,Status,Payment Reference",
      );
      expect(lines[1]).toBe(
        '"EMP-007","Asha Rao","State Bank","123456781234","SBIN0001234",45000.5,"BANK_TRANSFER","PENDING",""',
      );
    });

    it("neutralises spreadsheet formulas and quotes in employee names", async () => {
      const { service } = makeService({
        batch: {
          id: 1,
          payments: [
            payment({
              employee: {
                ...payment().employee,
                fullName: '=HYPERLINK("x")',
              },
            }),
          ],
        },
      });

      const csv = await service.exportBatchCsv(1);

      expect(csv.split("\n")[1]).toContain('"\'=HYPERLINK(""x"")"');
    });

    it("leaves bank columns empty for a soft-deleted bank detail", async () => {
      const { service, encryption } = makeService({
        batch: {
          id: 1,
          payments: [
            payment({
              employee: {
                ...payment().employee,
                bankDetail: bankDetail(new Date("2026-01-01")),
              },
            }),
          ],
        },
      });

      const csv = await service.exportBatchCsv(1);

      expect(encryption.decrypt).not.toHaveBeenCalled();
      expect(csv.split("\n")[1]).toBe(
        '"EMP-007","Asha Rao","","","",45000.5,"BANK_TRANSFER","PENDING",""',
      );
    });

    it("leaves the account number empty when no encrypted value exists", async () => {
      const { service, encryption } = makeService({ encrypted: new Map() });

      const csv = await service.exportBatchCsv(1);

      expect(encryption.decrypt).not.toHaveBeenCalled();
      expect(csv.split("\n")[1]).toBe(
        '"EMP-007","Asha Rao","State Bank","","SBIN0001234",45000.5,"BANK_TRANSFER","PENDING",""',
      );
    });

    it("exports only the header row for an empty batch", async () => {
      const { service } = makeService({ batch: { id: 1, payments: [] } });

      const csv = await service.exportBatchCsv(1);

      expect(csv.split("\n")).toHaveLength(1);
    });
  });

  describe("updatePayment", () => {
    it("marks a pending payment as paid", async () => {
      const { service, repository, teamContext } = makeService();
      const dto = { status: "PAID", bankReference: "UTR123" };

      const result = await service.updatePayment(100, dto);

      expect(teamContext.resolveScope).toHaveBeenCalledWith("hr.payment.write");
      expect(repository.updatePayment).toHaveBeenCalledWith(
        SCOPE,
        100,
        "PENDING",
        dto,
        USER_ID,
      );
      expect(result.status).toBe("PAID");
      expect(result.employee).not.toHaveProperty("bankDetail");
      expect(result.employee.bankDetails?.accountNumber).toBe("********1234");
    });

    it("allows a team grant to correct its own team's payment", async () => {
      const { service, repository } = makeService({
        level: "team",
        teamIds: [3],
      });

      await service.updatePayment(100, { bankReference: "UTR9" });

      expect(repository.updatePayment).toHaveBeenCalledOnce();
    });

    it("hides another team's payment as not found", async () => {
      const { service, repository } = makeService({
        level: "team",
        teamIds: [8],
      });

      const error = await service
        .updatePayment(100, { status: "PAID" })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ResourceNotFoundException);
      expect((error as Error).message).toBe("Payroll payment not found: 100");
      expect(repository.updatePayment).not.toHaveBeenCalled();
    });

    it("reports an unknown payment as not found", async () => {
      const { service } = makeService({ payment: null });

      await expect(
        service.updatePayment(100, { status: "PAID" }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it("lets a failed payment be retried", async () => {
      const { service, repository } = makeService({
        payment: payment({ status: "FAILED" }),
      });

      await service.updatePayment(100, { status: "PENDING" });

      expect(repository.updatePayment).toHaveBeenCalledWith(
        SCOPE,
        100,
        "FAILED",
        { status: "PENDING" },
        USER_ID,
      );
    });

    it.each([
      ["PAID", "PENDING"],
      ["CANCELLED", "PAID"],
    ])("rejects moving a terminal %s payment to %s", async (from, to) => {
      const { service, repository } = makeService({
        payment: payment({ status: from }),
      });

      await expect(
        service.updatePayment(100, { status: to }),
      ).rejects.toBeInstanceOf(InvalidStateTransitionException);
      expect(repository.updatePayment).not.toHaveBeenCalled();
    });

    it("treats an unknown current status as having no transitions", async () => {
      const { service } = makeService({
        payment: payment({ status: "LEGACY" }),
      });

      await expect(
        service.updatePayment(100, { status: "PAID" }),
      ).rejects.toBeInstanceOf(InvalidStateTransitionException);
    });

    it("allows a no-op status alongside other field changes on a terminal payment", async () => {
      const { service, repository } = makeService({
        payment: payment({ status: "PAID" }),
      });

      await service.updatePayment(100, {
        status: "PAID",
        bankReference: "UTR-fix",
      });

      expect(repository.updatePayment).toHaveBeenCalledOnce();
    });

    it("reports a concurrent status change when the guarded update misses", async () => {
      const { service } = makeService({ updated: null });

      const error = await service
        .updatePayment(100, { status: "PAID" })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InvalidStateTransitionException);
      expect((error as Error).message).toBe(
        "Payroll payment cannot move from PENDING to PAID: the payment was modified concurrently",
      );
    });

    it("reports a concurrent change without a status in the request", async () => {
      const { service } = makeService({ updated: null });

      const error = await service
        .updatePayment(100, { bankReference: "UTR1" })
        .catch((e: unknown) => e);

      expect((error as Error).message).toBe(
        "Payroll payment cannot move from PENDING to PENDING: the payment was modified concurrently",
      );
    });
  });
});
