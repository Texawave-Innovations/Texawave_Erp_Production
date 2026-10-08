import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { ProfileService } from "./profile.service.js";

const EMPLOYEE = { id: 77, team: { id: 3, name: "Software" } };
const IDENTITY = { organizationId: 1, teamId: 3, employeeId: 77 };

function buildService() {
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue(EMPLOYEE),
    completeOnboarding: vi.fn().mockResolvedValue(undefined),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
    getUserId: vi.fn().mockReturnValue(99),
  };
  const repository = {
    getPersonal: vi.fn(),
    getAddress: vi.fn(),
    getGovernmentIds: vi.fn(),
    upsertGovernmentIds: vi.fn(),
    listFamilyMembers: vi.fn(),
    addFamilyMember: vi.fn(),
    updateFamilyMember: vi.fn(),
    removeFamilyMember: vi.fn(),
    listExperience: vi.fn(),
    addExperience: vi.fn(),
    updateExperience: vi.fn(),
    removeExperience: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    upsertDocumentFile: vi.fn(),
    removeDocument: vi.fn().mockResolvedValue(undefined),
  };
  const loginState = {
    currentUserMustChangePassword: vi.fn().mockResolvedValue(false),
  };
  const files = {
    save: vi.fn().mockResolvedValue(undefined),
    read: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const progress = { missingFor: vi.fn().mockResolvedValue([]) };
  const service = new ProfileService(
    employees as never,
    tenantContext as never,
    repository as never,
    {} as never,
    loginState as never,
    files as never,
    progress as never,
  );
  return { service, employees, repository, files, progress };
}

describe("ProfileService own-record reads", () => {
  it("getPersonal() reads the caller's own employee row", async () => {
    const { service, repository } = buildService();
    const row = { employeeId: 77, dateOfBirth: "1998-04-12" };
    repository.getPersonal.mockResolvedValue(row);

    await expect(service.getPersonal()).resolves.toBe(row);
    expect(repository.getPersonal).toHaveBeenCalledWith(77);
  });

  it("getAddress() reads the validated address type for the caller", async () => {
    const { service, repository } = buildService();
    repository.getAddress.mockResolvedValue({ addressLine: "1 Main St" });

    await service.getAddress("PERMANENT");

    expect(repository.getAddress).toHaveBeenCalledWith(77, "PERMANENT");
  });

  it("putAddress() rejects an invalid address type before resolving the employee", async () => {
    const { service, employees, repository } = buildService();

    await expect(
      service.putAddress("OFFICE", {} as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(employees.getCurrentEmployee).not.toHaveBeenCalled();
    expect(repository.getAddress).not.toHaveBeenCalled();
  });

  it("getGovernmentIds()/putGovernmentIds() are scoped to the caller", async () => {
    const { service, repository } = buildService();
    repository.getGovernmentIds.mockResolvedValue({ pan: "ABCDE1234F" });
    repository.upsertGovernmentIds.mockResolvedValue({ pan: "ABCDE1234F" });

    await expect(service.getGovernmentIds()).resolves.toEqual({
      pan: "ABCDE1234F",
    });
    await service.putGovernmentIds({ pan: "ABCDE1234F" } as never);

    expect(repository.getGovernmentIds).toHaveBeenCalledWith(77);
    expect(repository.upsertGovernmentIds).toHaveBeenCalledWith(IDENTITY, {
      pan: "ABCDE1234F",
    });
  });
});

describe("ProfileService family members", () => {
  it("lists and adds family members for the caller only", async () => {
    const { service, repository } = buildService();
    const members = [{ id: 1, name: "Asha" }];
    repository.listFamilyMembers.mockResolvedValue(members);
    repository.addFamilyMember.mockResolvedValue({ id: 2, name: "Ravi" });

    await expect(service.listFamilyMembers()).resolves.toBe(members);
    await expect(
      service.addFamilyMember({ name: "Ravi" } as never),
    ).resolves.toEqual({ id: 2, name: "Ravi" });

    expect(repository.listFamilyMembers).toHaveBeenCalledWith(77);
    expect(repository.addFamilyMember).toHaveBeenCalledWith(IDENTITY, {
      name: "Ravi",
    });
  });

  it("updateFamilyMember() updates by the caller's employee id and the given row id", async () => {
    const { service, repository } = buildService();
    repository.updateFamilyMember.mockResolvedValue({ count: 1 });

    await expect(
      service.updateFamilyMember(5, { name: "Asha" } as never),
    ).resolves.toBeUndefined();
    expect(repository.updateFamilyMember).toHaveBeenCalledWith(77, 5, {
      name: "Asha",
    });
  });

  it("updateFamilyMember() is a 404 when the row is not the caller's", async () => {
    const { service, repository } = buildService();
    repository.updateFamilyMember.mockResolvedValue({ count: 0 });

    await expect(service.updateFamilyMember(5, {} as never)).rejects.toThrow(
      "Family member not found: 5",
    );
  });

  it("removeFamilyMember() deletes by the caller's employee id, 404 when nothing matched", async () => {
    const { service, repository } = buildService();
    repository.removeFamilyMember.mockResolvedValueOnce({ count: 1 });
    await expect(service.removeFamilyMember(5)).resolves.toBeUndefined();
    expect(repository.removeFamilyMember).toHaveBeenCalledWith(77, 5);

    repository.removeFamilyMember.mockResolvedValueOnce({ count: 0 });
    await expect(service.removeFamilyMember(6)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});

describe("ProfileService experience", () => {
  it("lists and adds experience for the caller only", async () => {
    const { service, repository } = buildService();
    const rows = [{ id: 1, company: "Acme" }];
    repository.listExperience.mockResolvedValue(rows);
    repository.addExperience.mockResolvedValue({ id: 2 });

    await expect(service.listExperience()).resolves.toBe(rows);
    await service.addExperience({ company: "Globex" } as never);

    expect(repository.listExperience).toHaveBeenCalledWith(77);
    expect(repository.addExperience).toHaveBeenCalledWith(IDENTITY, {
      company: "Globex",
    });
  });

  it("updateExperience() updates the caller's row, 404 when nothing matched", async () => {
    const { service, repository } = buildService();
    repository.updateExperience.mockResolvedValueOnce({ count: 1 });
    await expect(
      service.updateExperience(3, { company: "Acme" } as never),
    ).resolves.toBeUndefined();
    expect(repository.updateExperience).toHaveBeenCalledWith(77, 3, {
      company: "Acme",
    });

    repository.updateExperience.mockResolvedValueOnce({ count: 0 });
    await expect(service.updateExperience(4, {} as never)).rejects.toThrow(
      "Experience not found: 4",
    );
  });

  it("removeExperience() removes the caller's row, 404 when nothing matched", async () => {
    const { service, repository } = buildService();
    repository.removeExperience.mockResolvedValueOnce({ count: 1 });
    await expect(service.removeExperience(3)).resolves.toBeUndefined();
    expect(repository.removeExperience).toHaveBeenCalledWith(77, 3);

    repository.removeExperience.mockResolvedValueOnce({ count: 0 });
    await expect(service.removeExperience(4)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});

describe("ProfileService documents", () => {
  const PDF = Buffer.from("%PDF-1.7\n%test");

  it("listDocuments() strips the internal storage key from every row", async () => {
    const { service, repository } = buildService();
    repository.listDocuments.mockResolvedValue([
      { documentType: "PAN", fileName: "pan.pdf", storageKey: "77/PAN/a.pdf" },
      { documentType: "RESUME", fileName: "cv.pdf", storageKey: null },
    ]);

    const rows = await service.listDocuments();

    expect(repository.listDocuments).toHaveBeenCalledWith(77);
    expect(rows).toEqual([
      { documentType: "PAN", fileName: "pan.pdf" },
      { documentType: "RESUME", fileName: "cv.pdf" },
    ]);
  });

  it("uploadDocument() removes nothing when the previous row had no stored file, and falls back to a default file name", async () => {
    const { service, repository, files } = buildService();
    repository.getDocument.mockResolvedValue({ storageKey: null });
    repository.upsertDocumentFile.mockImplementation(
      async (
        _identity: unknown,
        _type: string,
        data: Record<string, unknown>,
      ) => ({ ...data }),
    );

    const result = await service.uploadDocument("RESUME", {
      buffer: PDF,
      size: PDF.length,
      originalname: "\u0001\u0002 ",
    });

    expect(repository.upsertDocumentFile).toHaveBeenCalledWith(
      IDENTITY,
      "RESUME",
      expect.objectContaining({
        fileName: "document",
        mimeType: "application/pdf",
      }),
    );
    const [key] = files.save.mock.calls[0] as [string, Buffer];
    expect(key).toMatch(/^77\/RESUME\/[0-9a-f-]{36}\.pdf$/);
    expect(files.remove).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("storageKey");
  });

  it("downloadDocument() falls back to a generic mime type when none was stored", async () => {
    const { service, repository, files } = buildService();
    repository.getDocument.mockResolvedValue({
      storageKey: "77/PAN/x.bin",
      deletedAt: null,
      fileName: "x.bin",
      mimeType: null,
    });
    files.read.mockResolvedValue(PDF);

    await expect(service.downloadDocument("PAN")).resolves.toEqual({
      buffer: PDF,
      mimeType: "application/octet-stream",
      fileName: "x.bin",
    });
    expect(repository.getDocument).toHaveBeenCalledWith(77, "PAN");
    expect(files.read).toHaveBeenCalledWith("77/PAN/x.bin");
  });

  it("downloadDocument() is a 404 for a metadata-only row with no stored file", async () => {
    const { service, repository, files } = buildService();
    repository.getDocument.mockResolvedValue({
      storageKey: null,
      deletedAt: null,
      fileName: "x",
    });

    await expect(service.downloadDocument("PAN")).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(files.read).not.toHaveBeenCalled();
  });

  it("removeDocument() is a 404 for a missing or already-deleted document", async () => {
    const { service, repository } = buildService();
    repository.getDocument.mockResolvedValueOnce(null);
    await expect(service.removeDocument("PAN")).rejects.toThrow(
      "Document not found: PAN",
    );

    repository.getDocument.mockResolvedValueOnce({
      storageKey: "77/PAN/x.pdf",
      deletedAt: new Date(),
    });
    await expect(service.removeDocument("PAN")).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(repository.removeDocument).not.toHaveBeenCalled();
  });

  it("removeDocument() deletes the row and then the stored file", async () => {
    const { service, repository, files } = buildService();
    repository.getDocument.mockResolvedValue({
      storageKey: "77/PAN/x.pdf",
      deletedAt: null,
    });

    await service.removeDocument("PAN");

    expect(repository.removeDocument).toHaveBeenCalledWith(77, "PAN");
    expect(files.remove).toHaveBeenCalledWith("77/PAN/x.pdf");
  });

  it("removeDocument() skips file storage when the row has no stored file", async () => {
    const { service, repository, files } = buildService();
    repository.getDocument.mockResolvedValue({
      storageKey: null,
      deletedAt: null,
    });

    await service.removeDocument("PAN");

    expect(repository.removeDocument).toHaveBeenCalledWith(77, "PAN");
    expect(files.remove).not.toHaveBeenCalled();
  });
});

describe("ProfileService.submit() completion", () => {
  it("completes onboarding when nothing is missing", async () => {
    const { service, employees, progress } = buildService();
    progress.missingFor.mockResolvedValue([]);

    await expect(service.submit()).resolves.toEqual({ missing: [] });
    expect(progress.missingFor).toHaveBeenCalledWith(77);
    expect(employees.completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it("does not complete onboarding while items are missing", async () => {
    const { service, employees, progress } = buildService();
    progress.missingFor.mockResolvedValue(["bank", "PAN"]);

    await expect(service.submit()).resolves.toEqual({
      missing: ["bank", "PAN"],
    });
    expect(employees.completeOnboarding).not.toHaveBeenCalled();
  });
});
