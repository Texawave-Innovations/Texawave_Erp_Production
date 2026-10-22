import {
  ResourceConflictException,
  ResourceNotFoundException,
} from "../../../common/exceptions/business.exception.js";
import { SuppliersService } from "./suppliers.service.js";

const SCOPE = { organizationId: 1 };

function makeService() {
  const repository = {
    findMany: vi.fn(),
    findOne: vi.fn(),
    findByCode: vi.fn().mockResolvedValue(null),
    findByGstin: vi.fn().mockResolvedValue(null),
    findDistinctTypes: vi.fn(),
    nextCode: vi.fn().mockResolvedValue("VEND-0001"),
    create: vi.fn(),
    update: vi.fn(),
    findActivity: vi.fn(),
  };
  const tenantContext = {
    getOrgScope: vi.fn().mockReturnValue(SCOPE),
    getUserId: vi.fn().mockReturnValue(42),
  };
  const service = new SuppliersService(
    repository as never,
    tenantContext as never,
  );
  return { service, repository };
}

const dto = { companyName: "ABC Pvt Ltd", contactPerson: "Ravi" };
const uniqueViolation = Object.assign(new Error("unique"), { code: "P2002" });

describe("SuppliersService", () => {
  it("create() allocates the next code when none is supplied", async () => {
    const { service, repository } = makeService();
    repository.create.mockResolvedValue({ id: 1 });
    await service.create(dto);
    expect(repository.create).toHaveBeenCalledWith(SCOPE, "VEND-0001", dto, 42);
  });

  it("create() retries with a fresh code when the unique index rejects the allocated one", async () => {
    const { service, repository } = makeService();
    repository.nextCode
      .mockResolvedValueOnce("VEND-0003")
      .mockResolvedValueOnce("VEND-0004");
    repository.create
      .mockRejectedValueOnce(uniqueViolation)
      .mockResolvedValueOnce({ id: 9 });
    await expect(service.create(dto)).resolves.toEqual({ id: 9 });
    expect(repository.create).toHaveBeenLastCalledWith(
      SCOPE,
      "VEND-0004",
      dto,
      42,
    );
  });

  it("create() rejects an explicit code already used, naming the owner", async () => {
    const { service, repository } = makeService();
    repository.findByCode.mockResolvedValue({ id: 2, companyName: "Other Co" });
    await expect(
      service.create({ ...dto, supplierCode: "VEND-0002" }),
    ).rejects.toThrow(/already used by Other Co/);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("create() rejects a GSTIN already used by another supplier", async () => {
    const { service, repository } = makeService();
    repository.findByGstin.mockResolvedValue({ id: 3, companyName: "Gst Co" });
    await expect(
      service.create({ ...dto, gstin: "33AAAAA0000A1Z5" }),
    ).rejects.toBeInstanceOf(ResourceConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("create() maps a unique violation on an explicit code to a conflict", async () => {
    const { service, repository } = makeService();
    repository.create.mockRejectedValue(uniqueViolation);
    await expect(
      service.create({ ...dto, supplierCode: "VEND-0009" }),
    ).rejects.toBeInstanceOf(ResourceConflictException);
  });

  it("update() does not re-check the code when it is unchanged (case-insensitive)", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({ id: 7, supplierCode: "VEND-0007" });
    repository.update.mockResolvedValue({ id: 7 });
    await service.update(7, { supplierCode: "vend-0007", companyName: "New" });
    expect(repository.findByCode).not.toHaveBeenCalled();
  });

  it("update() rejects a code that belongs to a different supplier", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({ id: 7, supplierCode: "VEND-0007" });
    repository.findByCode.mockResolvedValue({ id: 8, companyName: "Rival" });
    await expect(
      service.update(7, { supplierCode: "VEND-0008" }),
    ).rejects.toBeInstanceOf(ResourceConflictException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("update() allows keeping the supplier's own GSTIN", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({ id: 7, supplierCode: "VEND-0007" });
    repository.findByGstin.mockResolvedValue({ id: 7, companyName: "Self" });
    repository.update.mockResolvedValue({ id: 7 });
    await expect(
      service.update(7, { gstin: "33AAAAA0000A1Z5" }),
    ).resolves.toEqual({ id: 7 });
  });

  it("findOne()/update() raise not-found for an unknown supplier", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.update(99, {})).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it("findActivity() 404s for an unknown supplier before reading the audit log", async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue(null);
    await expect(service.findActivity(99)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    expect(repository.findActivity).not.toHaveBeenCalled();
  });
});
