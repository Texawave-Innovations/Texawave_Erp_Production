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

function makeService() {
  const payslips = {
    findById: vi.fn().mockResolvedValue(PAYSLIP),
    findMineById: vi.fn().mockResolvedValue(PAYSLIP),
  };
  const renderer = {
    render: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7")),
  };
  const service = new PayslipPdfService(payslips as never, renderer as never);
  return { service, payslips, renderer };
}

describe("PayslipPdfService", () => {
  it("renders an HR payslip through the scoped read", async () => {
    const { service, payslips, renderer } = makeService();

    const file = await service.forHr(5);

    expect(payslips.findById).toHaveBeenCalledWith(5);
    expect(renderer.render).toHaveBeenCalledWith(
      expect.stringContaining("PS-202605-0001"),
    );
    expect(file).toEqual({
      buffer: Buffer.from("%PDF-1.7"),
      fileName: "PS-202605-0001.pdf",
    });
  });

  it("renders the caller's own payslip through the self-service read", async () => {
    const { service, payslips } = makeService();

    await service.forSelf(6);

    expect(payslips.findMineById).toHaveBeenCalledWith(6);
    expect(payslips.findById).not.toHaveBeenCalled();
  });

  it("does not render when the payslip is outside the caller's scope", async () => {
    const { service, payslips, renderer } = makeService();
    payslips.findById.mockRejectedValue(
      new ResourceNotFoundException("Payslip", 9),
    );

    await expect(service.forHr(9)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(renderer.render).not.toHaveBeenCalled();
  });
});
