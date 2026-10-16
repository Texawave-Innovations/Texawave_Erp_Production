import {
  BusinessRuleConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { CustomersService } from "./customers.service.js";

const scope = { organizationId: 1 };

function makeService() {
  const repository = {
    findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: vi.fn(),
    findByGstin: vi.fn().mockResolvedValue(null),
    peekNextCode: vi.fn().mockResolvedValue("CUST-0003"),
    readBankAccountForReveal: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 10 }),
    update: vi.fn().mockResolvedValue({ id: 10 }),
    softDelete: vi.fn(),
    countByStatus: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(scope),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const encryption = {
    encrypt: vi.fn((v: string) => `enc(${v})`),
    decrypt: vi.fn((v: string) => v.replace(/^enc\((.*)\)$/, "$1")),
  };
  const codeFormats = {
    getFormat: vi.fn().mockResolvedValue({ prefix: "CUS", padding: 3 }),
  };
  const service = new CustomersService(
    repository as never,
    tenantContext as never,
    encryption as never,
    codeFormats as never,
  );
  return { service, repository, encryption, codeFormats };
}

const base = {
  companyName: "ABC Industries Pvt Ltd",
  contactPerson: "John Doe",
  email: "john@company.com",
  mobileNumber: "9876543210",
};

type CreateArgs = [unknown, Record<string, unknown>, number];
type UpdateArgs = [unknown, number, { data: Record<string, unknown> }];

describe("CustomersService", () => {
  it("create() encrypts and masks the bank account and never passes the plain number", async () => {
    const { service, repository } = makeService();
    await service.create({
      ...base,
      bankName: "HDFC Bank",
      bankAccountNumber: "50100234567890",
      bankIfsc: "HDFC0001234",
    });
    const [, data, actor] = repository.create.mock.calls[0] as CreateArgs;
    expect(actor).toBe(42);
    expect(data["bankAccountNumberEncrypted"]).toBe("enc(50100234567890)");
    expect(data["bankAccountNumberMasked"]).toBe("**********7890");
    expect(JSON.stringify(data)).not.toContain('"50100234567890"');
  });

  it("create() builds the code from the master-list format and the mobile country", async () => {
    const { service, repository, codeFormats } = makeService();
    await service.create(base);
    await service.create({ ...base, mobileCountryCode: "+971" });
    const [, first] = repository.create.mock.calls[0] as CreateArgs;
    const [, second] = repository.create.mock.calls[1] as CreateArgs;
    expect(codeFormats.getFormat).toHaveBeenCalledWith("customer");
    expect(first["code"]).toEqual({
      format: { prefix: "CUS", padding: 3 },
      country: "IN",
    });
    expect(second["code"]).toMatchObject({ country: "AE" });
    expect(second["mobileCountryCode"]).toBe("+971");
  });

  it("nextCode() previews per country", async () => {
    const { service, repository } = makeService();
    repository.peekNextCode.mockResolvedValue("CUS-AE-001");
    await expect(service.nextCode("+971")).resolves.toEqual({
      customerCode: "CUS-AE-001",
    });
    expect(repository.peekNextCode).toHaveBeenCalledWith(
      scope,
      { prefix: "CUS", padding: 3 },
      "AE",
    );
  });

  it("create() keeps manual tax rates as entered and has no defaults", async () => {
    const { service, repository } = makeService();
    await service.create(base);
    let [, data] = repository.create.mock.calls[0] as CreateArgs;
    expect(data).toMatchObject({
      cgstRate: null,
      sgstRate: null,
      igstRate: null,
      mobileCountryCode: "+91",
      status: "ACTIVE",
    });
    await service.create({
      ...base,
      cgstRate: 2.5,
      sgstRate: 2.5,
      igstRate: 5,
    });
    [, data] = repository.create.mock.calls[1] as CreateArgs;
    expect(data).toMatchObject({ cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 });
  });

  it("create() derives state and PAN from the GSTIN and refuses a duplicate GSTIN", async () => {
    const { service, repository } = makeService();
    await service.create({ ...base, gstin: "27AAAAA0000A1Z5" });
    const [, data] = repository.create.mock.calls[0] as CreateArgs;
    expect(data).toMatchObject({ stateCode: "27", pan: "AAAAA0000A" });

    repository.findByGstin.mockResolvedValue({
      id: 3,
      customerCode: "CUST-0001",
      companyName: "Other",
    });
    await expect(
      service.create({ ...base, gstin: "27AAAAA0000A1Z5" }),
    ).rejects.toBeInstanceOf(BusinessRuleConflictException);
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  describe("update()", () => {
    const stored = {
      id: 10,
      gstin: "33AAAAA0000A1Z5",
      stateCode: "33",
      pan: "AAAAA0000A",
    };

    it("sends only changed fields; null clears an optional one", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(stored);
      await service.update(10, { contactPerson: "Jane", cin: null });
      const [, , patch] = repository.update.mock.calls[0] as UpdateArgs;
      expect(patch.data).toEqual({ contactPerson: "Jane", cin: null });
    });

    it("a new GSTIN brings its own state and PAN", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(stored);
      await service.update(10, { gstin: "29BBBBB1111B1Z5" });
      const [, , patch] = repository.update.mock.calls[0] as UpdateArgs;
      expect(patch.data).toMatchObject({
        gstin: "29BBBBB1111B1Z5",
        stateCode: "29",
        pan: "BBBBB1111B",
      });
      expect(repository.findByGstin).toHaveBeenCalledWith(
        scope,
        "29BBBBB1111B1Z5",
        10,
      );
    });

    it("clearing the bank account clears both stored forms", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(stored);
      await service.update(10, { bankAccountNumber: null });
      const [, , patch] = repository.update.mock.calls[0] as UpdateArgs;
      expect(patch.data).toEqual({
        bankAccountNumberEncrypted: null,
        bankAccountNumberMasked: null,
      });
    });

    it("404 outside the organization", async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue(null);
      await expect(service.update(10, {})).rejects.toBeInstanceOf(
        ResourceNotFoundException,
      );
    });
  });

  it("revealBankAccount() decrypts, and returns null when no account is stored", async () => {
    const { service, repository } = makeService();
    repository.readBankAccountForReveal.mockResolvedValueOnce({
      encrypted: "enc(123456)",
    });
    await expect(service.revealBankAccount(1)).resolves.toEqual({
      bankAccountNumber: "123456",
    });
    repository.readBankAccountForReveal.mockResolvedValueOnce({
      encrypted: null,
    });
    await expect(service.revealBankAccount(1)).resolves.toEqual({
      bankAccountNumber: null,
    });
  });

  it("revealBankAccount() 404s for a customer outside the organization", async () => {
    const { service, repository } = makeService();
    repository.readBankAccountForReveal.mockResolvedValue(null);
    await expect(service.revealBankAccount(1)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("countByStatus() fills missing statuses with 0", async () => {
    const { service, repository } = makeService();
    repository.countByStatus.mockResolvedValue({ ACTIVE: 2 });
    await expect(service.countByStatus()).resolves.toEqual({
      ACTIVE: 2,
      INACTIVE: 0,
    });
  });
});
