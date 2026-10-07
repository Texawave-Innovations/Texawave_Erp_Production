import { OnboardingProgressService } from "./onboarding-progress.service.js";
import { ProfileService } from "./profile.service.js";

const EMPLOYEE = { id: 77, team: { id: 3, name: "Software" } };

function buildService(overrides: Partial<Record<string, unknown>> = {}) {
  const employees = {
    getCurrentEmployee: vi.fn().mockResolvedValue(EMPLOYEE),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue({ organizationId: 1 }),
    getUserId: vi.fn().mockReturnValue(99),
  };
  const repository = {
    getPersonal: vi.fn(),
    upsertPersonal: vi.fn().mockResolvedValue({ employeeId: 77 }),
    getAddress: vi.fn(),
    upsertAddress: vi.fn().mockResolvedValue({ employeeId: 77 }),
    deleteAddress: vi.fn().mockResolvedValue({ count: 1 }),
    getBank: vi.fn(),
    upsertBank: vi.fn(),
    getGovernmentIds: vi.fn(),
    upsertGovernmentIds: vi.fn().mockResolvedValue({ employeeId: 77 }),
    listDocuments: vi.fn().mockResolvedValue([]),
    getDocument: vi.fn().mockResolvedValue(null),
    upsertDocumentFile: vi
      .fn()
      .mockResolvedValue({ storageKey: "77/PAN/x.png", fileName: "a.png" }),
  };
  const encryption = {
    encrypt: vi.fn().mockReturnValue("iv:tag:cipher"),
    decrypt: vi.fn(),
    mask: vi.fn().mockReturnValue("XXXXXXXX9012"),
  };
  const loginState = {
    currentUserMustChangePassword: vi.fn().mockResolvedValue(false),
  };
  const files = {
    save: vi.fn().mockResolvedValue(undefined),
    read: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const progress = new OnboardingProgressService(repository as never);
  const service = new ProfileService(
    employees as never,
    tenantContext as never,
    repository as never,
    encryption as never,
    loginState as never,
    files as never,
    progress,
  );
  return {
    service,
    employees,
    tenantContext,
    repository,
    encryption,
    loginState,
    files,
    ...overrides,
  };
}

describe("ProfileService", () => {
  it("getMyProfile() resolves the employee from the login, taking no id", async () => {
    const { service, employees } = buildService();
    await expect(service.getMyProfile()).resolves.toEqual(EMPLOYEE);
    expect(employees.getCurrentEmployee).toHaveBeenCalledWith();
  });

  it("putPersonal() resolves identity from the login, not the request body", async () => {
    const { service, repository } = buildService();
    await service.putPersonal({ dateOfBirth: "1998-04-12" } as never);
    expect(repository.upsertPersonal).toHaveBeenCalledWith(
      { organizationId: 1, teamId: 3, employeeId: 77 },
      { dateOfBirth: "1998-04-12" },
    );
  });

  it("rejects an address type that is not PERMANENT or PRESENT", async () => {
    const { service } = buildService();
    await expect(service.getAddress("WORK")).rejects.toThrow(
      /must be one of PERMANENT, PRESENT/,
    );
  });

  it("putAddress() upserts the given, validated address type", async () => {
    const { service, repository } = buildService();
    await service.putAddress("PRESENT", { addressLine: "1 Main St" } as never);
    expect(repository.upsertAddress).toHaveBeenCalledWith(
      { organizationId: 1, teamId: 3, employeeId: 77 },
      "PRESENT",
      { addressLine: "1 Main St" },
    );
  });

  it("clearPresentAddress() deletes only the present row for the caller's own employee", async () => {
    const { service, repository } = buildService();
    await service.clearPresentAddress();
    expect(repository.deleteAddress).toHaveBeenCalledWith(77, "PRESENT");
  });

  it("putBank() encrypts and masks the account number before storing it, and never returns the ciphertext", async () => {
    const { service, repository, encryption } = buildService();
    repository.upsertBank.mockResolvedValue({
      employeeId: 77,
      accountHolderName: "Priya",
      accountNumberEncrypted: "iv:tag:cipher",
      accountNumberMasked: "XXXXXXXX9012",
    });
    const result = await service.putBank({
      accountHolderName: "Priya",
      accountNumber: "123456789012",
      ifsc: "HDFC0001234",
      bankName: "HDFC",
    } as never);
    expect(encryption.encrypt).toHaveBeenCalledWith("123456789012");
    expect(repository.upsertBank).toHaveBeenCalledWith(
      { organizationId: 1, teamId: 3, employeeId: 77 },
      expect.objectContaining({ accountNumber: "123456789012" }),
      "iv:tag:cipher",
      "XXXXXXXX9012",
    );
    expect(result).not.toHaveProperty("accountNumberEncrypted");
    expect(result).toMatchObject({ accountNumberMasked: "XXXXXXXX9012" });
  });

  it("getBank() returns null when no bank row exists yet", async () => {
    const { service, repository } = buildService();
    repository.getBank.mockResolvedValue(null);
    await expect(service.getBank()).resolves.toBeNull();
  });

  it("getBank() strips the encrypted column from an existing row", async () => {
    const { service, repository } = buildService();
    repository.getBank.mockResolvedValue({
      employeeId: 77,
      accountNumberEncrypted: "iv:tag:cipher",
      accountNumberMasked: "XXXXXXXX9012",
    });
    await expect(service.getBank()).resolves.toEqual({
      employeeId: 77,
      accountNumberMasked: "XXXXXXXX9012",
    });
  });

  describe("submit()", () => {
    it("blocks submission while the login still needs a password change, before checking completeness", async () => {
      const { service, loginState, repository } = buildService();
      loginState.currentUserMustChangePassword.mockResolvedValue(true);
      await expect(service.submit()).rejects.toMatchObject({
        errorCode: "PASSWORD_CHANGE_REQUIRED",
      });
      // Never even looked at completeness — the password gate comes first.
      expect(repository.getPersonal).not.toHaveBeenCalled();
    });

    it("returns the missing items once the password has been changed but the profile is incomplete", async () => {
      const { service, repository } = buildService();
      repository.getPersonal.mockResolvedValue(null);
      repository.getAddress.mockResolvedValue(null);
      repository.getBank.mockResolvedValue(null);
      repository.getGovernmentIds.mockResolvedValue(null);
      const result = await service.submit();
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });
});

describe("ProfileService document uploads", () => {
  const PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
  ]);
  const upload = (
    buffer: Buffer,
    extra: Partial<{ size: number; originalname: string }> = {},
  ) => ({
    buffer,
    size: extra.size ?? buffer.length,
    originalname: extra.originalname ?? "scan.png",
  });

  it("rejects an unknown document type before touching storage", async () => {
    const { service, files } = buildService();
    await expect(
      service.uploadDocument("PASSPORT", upload(PNG)),
    ).rejects.toThrow(/documentType must be one of/);
    expect(files.save).not.toHaveBeenCalled();
  });

  it("rejects a missing file", async () => {
    const { service } = buildService();
    await expect(service.uploadDocument("PAN", undefined)).rejects.toThrow(
      "Choose a file to upload.",
    );
  });

  it("rejects a file over 5 MB", async () => {
    const { service, files } = buildService();
    await expect(
      service.uploadDocument("PAN", upload(PNG, { size: 5 * 1024 * 1024 + 1 })),
    ).rejects.toThrow("File must be 5 MB or smaller.");
    expect(files.save).not.toHaveBeenCalled();
  });

  it("rejects a file whose content is not PDF, JPG or PNG, even if it is named .pdf", async () => {
    const { service, files } = buildService();
    const notAnImage = Buffer.from("<html>not a pdf</html>");
    await expect(
      service.uploadDocument(
        "PAN",
        upload(notAnImage, { originalname: "fake.pdf" }),
      ),
    ).rejects.toThrow("Only PDF, JPG, or PNG files are accepted.");
    expect(files.save).not.toHaveBeenCalled();
  });

  it("stores under a server-generated key, never the client file name", async () => {
    const { service, repository, files } = buildService();
    repository.getDocument.mockResolvedValue(null);
    repository.upsertDocumentFile.mockImplementation(
      async (_id: unknown, _t: string, data: Record<string, unknown>) => ({
        ...data,
        documentType: "PAN",
      }),
    );
    await service.uploadDocument(
      "PAN",
      upload(PNG, { originalname: "../../etc/passwd.png" }),
    );
    const [key] = files.save.mock.calls[0] as [string, Buffer];
    expect(key).toMatch(/^77\/PAN\/[0-9a-f-]{36}\.png$/);
    expect(repository.upsertDocumentFile).toHaveBeenCalledWith(
      expect.anything(),
      "PAN",
      expect.objectContaining({
        fileName: "passwd.png",
        mimeType: "image/png",
        sizeBytes: PNG.length,
      }),
    );
  });

  it("removes the previous file when a document is replaced, and never returns the storage key", async () => {
    const { service, repository, files } = buildService();
    repository.getDocument.mockResolvedValue({ storageKey: "77/PAN/old.png" });
    repository.upsertDocumentFile.mockResolvedValue({
      storageKey: "77/PAN/new.png",
      fileName: "a.png",
    });
    const result = await service.uploadDocument("PAN", upload(PNG));
    expect(files.remove).toHaveBeenCalledWith("77/PAN/old.png");
    expect(result).not.toHaveProperty("storageKey");
  });

  it("removes the freshly saved file if the database write fails", async () => {
    const { service, repository, files } = buildService();
    repository.getDocument.mockResolvedValue(null);
    repository.upsertDocumentFile.mockRejectedValue(new Error("db down"));
    await expect(service.uploadDocument("PAN", upload(PNG))).rejects.toThrow(
      "db down",
    );
    const [key] = files.save.mock.calls[0] as [string, Buffer];
    expect(files.remove).toHaveBeenCalledWith(key);
  });

  it("downloads only the caller's own document; a missing or deleted one is a 404", async () => {
    const { service, repository, files } = buildService();
    repository.getDocument.mockResolvedValue(null);
    await expect(service.downloadDocument("PAN")).rejects.toThrow(
      "Document not found",
    );

    repository.getDocument.mockResolvedValue({
      storageKey: "77/PAN/x.png",
      deletedAt: new Date(),
      fileName: "a.png",
    });
    await expect(service.downloadDocument("PAN")).rejects.toThrow(
      "Document not found",
    );

    repository.getDocument.mockResolvedValue({
      storageKey: "77/PAN/x.png",
      deletedAt: null,
      fileName: "a.png",
      mimeType: "image/png",
    });
    files.read.mockResolvedValue(PNG);
    await expect(service.downloadDocument("PAN")).resolves.toEqual({
      buffer: PNG,
      mimeType: "image/png",
      fileName: "a.png",
    });
  });
});
