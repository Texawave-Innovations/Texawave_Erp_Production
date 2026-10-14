import { describe, expect, it, vi } from "vitest";
import { ResourceNotFoundException } from "../../../../common/exceptions/business.exception.js";
import { PayslipPdfService } from "./payslip-pdf.service.js";

const PAYSLIP = {
  payslipNumber: "PS-202605-0001",
  netPayable: "1000.00",
  generatedAt: "2026-06-01T00:00:00.000Z",
  employee: {
    employeeCode: "EMP001",
    fullName: "Asha Rao",
    bankDetails: null,
  },
  payrollPeriod: { year: 2026, month: 5 },
  payrollEntry: {
    totalCalendarDays: 31,
    payableDays: "31",
    lopDays: "0",
    totalGrossEarnings: "1000",
    totalDeductions: "0",
    earnings: [],
    deductions: [],
  },
};

const SNAPSHOT = {
  ...PAYSLIP,
  employee: { ...PAYSLIP.employee, fullName: "Asha Rao (as issued)" },
  company: { name: "TexaWave Pvt Ltd", address: null, gstin: null },
};

function makeService(state: unknown) {
  const payslips = {
    findById: vi.fn().mockResolvedValue(PAYSLIP),
    findMineById: vi.fn().mockResolvedValue(PAYSLIP),
  };
  const repository = {
    findPdfState: vi.fn().mockResolvedValue(state),
    storePdf: vi.fn().mockResolvedValue(undefined),
  };
  const renderer = {
    render: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7")),
  };
  const service = new PayslipPdfService(
    payslips as never,
    repository as never,
    { getOrgScope: () => ({ organizationId: 1 }) } as never,
    renderer as never,
  );
  return { service, payslips, repository, renderer };
}

describe("PayslipPdfService", () => {
  it("returns the stored PDF bytes unchanged (a fixed document)", async () => {
    const { service, renderer, payslips } = makeService({
      pdfContent: new Uint8Array([1, 2, 3]),
      snapshot: SNAPSHOT,
      version: 1,
    });
    const file = await service.forHr(5);
    expect(payslips.findById).toHaveBeenCalledWith(5);
    expect(renderer.render).not.toHaveBeenCalled();
    expect(file).toEqual({
      buffer: Buffer.from([1, 2, 3]),
      fileName: "PS-202605-0001.pdf",
    });
  });

  it("renders the snapshot (not live data) the first time and stores it", async () => {
    const { service, renderer, repository } = makeService({
      payslipNumber: "PS-202605-0001",
      generatedAt: new Date("2026-06-01"),
      version: 2,
      snapshot: SNAPSHOT,
      pdfContent: null,
    });
    await service.forHr(5);
    const html = renderer.render.mock.calls[0]![0] as string;
    expect(html).toContain("Asha Rao (as issued)");
    expect(html).toContain("TexaWave Pvt Ltd");
    expect(html).toContain("version 2");
    expect(repository.storePdf).toHaveBeenCalledWith(
      { organizationId: 1 },
      5,
      2,
      Buffer.from("%PDF-1.7"),
    );
  });

  it("renders a payslip without a snapshot from its live rows and does not store it", async () => {
    const { service, renderer, repository } = makeService({
      snapshot: null,
      pdfContent: null,
      version: 1,
    });
    await service.forSelf(6);
    expect(renderer.render).toHaveBeenCalledWith(
      expect.stringContaining("Asha Rao"),
    );
    expect(repository.storePdf).not.toHaveBeenCalled();
  });

  it("reads the caller's own payslip through the self-service read", async () => {
    const { service, payslips } = makeService({ snapshot: null, version: 1 });
    await service.forSelf(6);
    expect(payslips.findMineById).toHaveBeenCalledWith(6);
    expect(payslips.findById).not.toHaveBeenCalled();
  });

  it("propagates not-found from the scoped read", async () => {
    const { service, payslips, renderer } = makeService(null);
    payslips.findById.mockRejectedValueOnce(
      new ResourceNotFoundException("Payslip", 9),
    );
    await expect(service.forHr(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(renderer.render).not.toHaveBeenCalled();
  });
});
