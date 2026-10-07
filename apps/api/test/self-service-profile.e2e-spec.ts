import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * Employee self-service profile (e2e): each authenticated employee can read
 * and write only their own onboarding data (Docs/ARCHITECTURE.md section 7)
 * — the employee id is never taken from the request, only from the JWT via
 * the employee-user mapping. Also proves bank numbers are never returned
 * decrypted and validation rejects malformed government ids.
 */
interface Body<T> {
  data: T;
}

const PERMS = [
  "employee_self_service.profile.read",
  "employee_self_service.profile.write",
];

describe("self-service profile (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let org: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const employeeIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID().slice(0, 8);
  let passwordHash: string;
  let team: number;
  let desig: number;
  let empType: number;

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const put = (who: string, path: string, body: object) =>
    request(app.getHttpServer()).put(path).set(auth(who)).send(body);
  const PNG_BYTES = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("fake-image-data"),
  ]);
  const uploadDocument = (
    who: string,
    documentType: string,
    buffer: Buffer,
    name: string,
  ) =>
    request(app.getHttpServer())
      .put(`/employee/profile/documents/${documentType}/file`)
      .set(auth(who))
      .attach("file", buffer, name);
  const del = (who: string, path: string) =>
    request(app.getHttpServer()).delete(path).set(auth(who));

  let employeeCodeCounter = 0;

  async function mkEmployeeUser(
    key: string,
    codes: string[],
    withEmployee: boolean,
    onboardingStatus: string = "PENDING_ACTIVATION",
    mustChangePassword = false,
  ) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `role-${key}-${suffix}` },
    });
    if (codes.length) {
      await prisma.rolePermission.createMany({
        data: codes.map((c) => ({
          roleId: role.id,
          permissionId: perm.get(c) as number,
        })),
      });
    }
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `${key}-${suffix}@example.com`,
        passwordHash,
        fullName: `User ${key}`,
        mustChangePassword,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    if (withEmployee) {
      const employee = await prisma.employee.create({
        data: {
          organizationId: org.id,
          employeeCode: `EMP-9${String(Date.now()).slice(-5)}${employeeCodeCounter++}`,
          fullName: `Employee ${key}`,
          userId: user.id,
          teamId: team,
          designationId: desig,
          employmentTypeId: empType,
          dateOfJoining: new Date("2026-01-05"),
          onboardingStatus,
        },
      });
      employeeIds[key] = employee.id;
    }

    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        organizationSlug: org.slug,
        email: user.email,
        password: "Password123!",
      })
      .expect(201);
    tokens[key] = (res.body as Body<{ accessToken: string }>).data.accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    passwordHash = await bcrypt.hash("Password123!", 10);

    org = await prisma.organization.create({
      data: { name: `SS Org ${suffix}`, slug: `ss-org-${suffix}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    team = (
      await prisma.team.create({
        data: { organizationId: org.id, name: "T", code: `T${suffix}` },
      })
    ).id;
    const codeSuffix = suffix.toUpperCase();
    desig = (
      await prisma.designation.create({
        data: {
          organizationId: org.id,
          code: `D${codeSuffix}`,
          name: "Engineer",
        },
      })
    ).id;
    empType = (
      await prisma.employmentType.create({
        data: {
          organizationId: org.id,
          code: `FT${codeSuffix}`,
          name: "Full-time",
        },
      })
    ).id;

    await mkEmployeeUser("alice", PERMS, true);
    await mkEmployeeUser("bob", PERMS, true);
    await mkEmployeeUser("carol", PERMS, true);
    await mkEmployeeUser(
      "stillChangingPassword",
      PERMS,
      true,
      "PENDING_ACTIVATION",
      true,
    );
    await mkEmployeeUser("noPerm", [], true);
    await mkEmployeeUser("notAnEmployee", PERMS, false);
  });

  afterAll(async () => {
    await prisma.employeeFamilyMember.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.employeeExperience.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.employeeDocument.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.employeePersonalDetail.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.employeeAddress.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.employeeBankDetail.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.employeeGovernmentId.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.employee.deleteMany({ where: { organizationId: org.id } });
    await prisma.userRole.deleteMany({
      where: { user: { organizationId: org.id } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: org.id } },
    });
    await prisma.role.deleteMany({ where: { organizationId: org.id } });
    await prisma.user.deleteMany({ where: { organizationId: org.id } });
    await prisma.employmentType.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.designation.deleteMany({ where: { organizationId: org.id } });
    await prisma.team.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await app.close();
  });

  it("401s without a token", async () => {
    await request(app.getHttpServer())
      .get("/employee/profile/personal-details")
      .expect(401);
  });

  it("403s without employee_self_service.profile permissions", async () => {
    await get("noPerm", "/employee/profile/personal-details").expect(403);
  });

  it("403s a user with no linked employee record", async () => {
    await get("notAnEmployee", "/employee/profile/personal-details").expect(
      403,
    );
  });

  const validPersonal = {
    dateOfBirth: "1998-04-12",
    gender: "FEMALE",
    emergencyContactName: "Rajesh Sharma",
    emergencyContactRelation: "Father",
    emergencyContactPhone: "9841055667",
    fatherName: "Rajesh Sharma",
    fatherPhone: "9841055667",
    motherName: "Sunita Sharma",
    motherPhone: "9841055668",
  };

  it("saves and reads back personal details for the caller's own record", async () => {
    await put(
      "alice",
      "/employee/profile/personal-details",
      validPersonal,
    ).expect(200);
    const res = await get("alice", "/employee/profile/personal-details").expect(
      200,
    );
    expect(
      (res.body as Body<{ emergencyContactName: string }>).data,
    ).toMatchObject({
      emergencyContactName: "Rajesh Sharma",
    });
  });

  it("rejects an invalid mobile number with a specific message", async () => {
    const res = await put("alice", "/employee/profile/personal-details", {
      ...validPersonal,
      fatherPhone: "123",
    }).expect(400);
    expect((res.body as { message: string[] }).message).toContain(
      "Enter a valid 10-digit mobile number starting with 6 to 9.",
    );
  });

  const validAddress = {
    addressLine: "14, 3rd Cross",
    district: "Bengaluru Urban",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560034",
  };

  it("saves the permanent address, and present address is null until set", async () => {
    await put(
      "alice",
      "/employee/profile/address/PERMANENT",
      validAddress,
    ).expect(200);
    const present = await get(
      "alice",
      "/employee/profile/address/PRESENT",
    ).expect(200);
    expect((present.body as Body<unknown>).data).toBeNull();
  });

  it("rejects an address type other than PERMANENT or PRESENT", async () => {
    await get("alice", "/employee/profile/address/WORK").expect(400);
  });

  it("sets and then clears the present address (same as permanent)", async () => {
    await put("alice", "/employee/profile/address/PRESENT", {
      ...validAddress,
      city: "Chennai",
    }).expect(200);
    let present = await get(
      "alice",
      "/employee/profile/address/PRESENT",
    ).expect(200);
    expect((present.body as Body<{ city: string }>).data).toMatchObject({
      city: "Chennai",
    });

    await del("alice", "/employee/profile/address/present").expect(200);
    present = await get("alice", "/employee/profile/address/PRESENT").expect(
      200,
    );
    expect((present.body as Body<unknown>).data).toBeNull();
  });

  it("stores the bank account number encrypted and returns only the masked form", async () => {
    const res = await put("alice", "/employee/profile/bank-details", {
      accountHolderName: "Alice",
      accountNumber: "123456789012",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
    }).expect(200);
    const body = res.body as Body<Record<string, unknown>>;
    expect(body.data).not.toHaveProperty("accountNumberEncrypted");
    expect(body.data.accountNumberMasked).toBe("XXXXXXXX9012");

    const row = await prisma.employeeBankDetail.findUnique({
      where: { employeeId: employeeIds.alice as number },
    });
    expect(row?.accountNumberEncrypted).not.toBe("123456789012");
    expect(row?.accountNumberEncrypted).toMatch(
      /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/,
    );
  });

  it("rejects a malformed IFSC", async () => {
    await put("alice", "/employee/profile/bank-details", {
      accountHolderName: "Alice",
      accountNumber: "123456789012",
      ifsc: "not-an-ifsc",
      bankName: "HDFC Bank",
    }).expect(400);
  });

  it("validates Aadhaar and PAN, with ESI and PF optional", async () => {
    await put("alice", "/employee/profile/government-ids", {
      aadhaarNumber: "12345",
      panNumber: "ABCDE1234F",
    }).expect(400);

    const res = await put("alice", "/employee/profile/government-ids", {
      aadhaarNumber: "123456789012",
      panNumber: "ABCDE1234F",
    }).expect(200);
    expect(
      (res.body as Body<{ esiNumber: string | null }>).data.esiNumber,
    ).toBeNull();
  });

  it("keeps each employee's onboarding data separate from every other employee's", async () => {
    await put("bob", "/employee/profile/personal-details", {
      ...validPersonal,
      emergencyContactName: "Bob's Contact",
    }).expect(200);

    const aliceRes = await get(
      "alice",
      "/employee/profile/personal-details",
    ).expect(200);
    const bobRes = await get(
      "bob",
      "/employee/profile/personal-details",
    ).expect(200);
    expect(
      (aliceRes.body as Body<{ emergencyContactName: string }>).data
        .emergencyContactName,
    ).toBe("Rajesh Sharma");
    expect(
      (bobRes.body as Body<{ emergencyContactName: string }>).data
        .emergencyContactName,
    ).toBe("Bob's Contact");
  });

  it("adds, updates, and removes a family member", async () => {
    const created = await request(app.getHttpServer())
      .post("/employee/profile/family")
      .set(auth("alice"))
      .send({ name: "Sunita Sharma", relation: "Mother" })
      .expect(201);
    const familyId = (created.body as Body<{ id: number }>).data.id;

    await request(app.getHttpServer())
      .put(`/employee/profile/family/${familyId}`)
      .set(auth("alice"))
      .send({
        name: "Sunita Sharma",
        relation: "Mother",
        contactPhone: "9841055668",
      })
      .expect(204);

    let list = await get("alice", "/employee/profile/family").expect(200);
    expect((list.body as Body<{ contactPhone: string }[]>).data).toContainEqual(
      expect.objectContaining({ contactPhone: "9841055668" }),
    );

    await request(app.getHttpServer())
      .delete(`/employee/profile/family/${familyId}`)
      .set(auth("alice"))
      .expect(204);

    list = await get("alice", "/employee/profile/family").expect(200);
    expect((list.body as Body<unknown[]>).data).toHaveLength(0);
  });

  it("404s updating a family member that does not belong to the caller", async () => {
    const created = await request(app.getHttpServer())
      .post("/employee/profile/family")
      .set(auth("bob"))
      .send({ name: "Bob's Father", relation: "Father" })
      .expect(201);
    const bobsFamilyId = (created.body as Body<{ id: number }>).data.id;

    await request(app.getHttpServer())
      .put(`/employee/profile/family/${bobsFamilyId}`)
      .set(auth("alice"))
      .send({ name: "Hijacked", relation: "Father" })
      .expect(404);
  });

  it("adds and removes an experience entry", async () => {
    const created = await request(app.getHttpServer())
      .post("/employee/profile/experience")
      .set(auth("alice"))
      .send({
        employer: "Zoho Corp",
        designation: "Junior Developer",
        fromDate: "2022-06-01",
      })
      .expect(201);
    const experienceId = (created.body as Body<{ id: number }>).data.id;

    await request(app.getHttpServer())
      .delete(`/employee/profile/experience/${experienceId}`)
      .set(auth("alice"))
      .expect(204);
  });

  it("rejects an experience entry with an invalid date", async () => {
    await request(app.getHttpServer())
      .post("/employee/profile/experience")
      .set(auth("alice"))
      .send({
        employer: "Zoho Corp",
        designation: "Junior Developer",
        fromDate: "not-a-date",
      })
      .expect(400);
  });

  it("uploads a document, replaces it on re-upload, and never lists the storage key", async () => {
    await uploadDocument("alice", "PAN", PNG_BYTES, "pan.png").expect(200);
    // Re-upload replaces the row and file, not adds a second one.
    await uploadDocument("alice", "PAN", PNG_BYTES, "pan-v2.png").expect(200);

    const list = await get("alice", "/employee/profile/documents").expect(200);
    const rows = (
      list.body as Body<{ documentType: string; fileName: string }[]>
    ).data;
    const panRows = rows.filter((d) => d.documentType === "PAN");
    expect(panRows).toHaveLength(1);
    expect(panRows[0]?.fileName).toBe("pan-v2.png");
    expect(panRows[0]).not.toHaveProperty("storageKey");
  });

  it("rejects an unknown document type, a non-image file, and a file over 5 MB", async () => {
    await uploadDocument("alice", "PASSPORT", PNG_BYTES, "x.png").expect(400);
    await uploadDocument(
      "alice",
      "PAN",
      Buffer.from("<html>nope</html>"),
      "fake.pdf",
    ).expect(400);
    await uploadDocument(
      "alice",
      "PAN",
      Buffer.alloc(5 * 1024 * 1024 + 1, 0),
      "big.png",
    ).expect(413);
  });

  it("lets the owner download their document, and 404s for anyone else", async () => {
    await uploadDocument("bob", "AADHAAR", PNG_BYTES, "aadhaar.png").expect(
      200,
    );

    const own = await request(app.getHttpServer())
      .get("/employee/profile/documents/AADHAAR/file")
      .set(auth("bob"))
      .expect(200);
    expect(own.headers["content-type"]).toContain("image/png");
    expect(own.headers["content-length"]).toBe(String(PNG_BYTES.length));
    expect(own.headers["content-disposition"]).toContain("attachment");

    // Alice has no AADHAAR document: the route is keyed by the caller's own
    // identity, so she can never reach Bob's file.
    await request(app.getHttpServer())
      .get("/employee/profile/documents/AADHAAR/file")
      .set(auth("alice"))
      .expect(404);
  });

  it("blocks submit for an employee who has not changed their temporary password yet", async () => {
    const res = await request(app.getHttpServer())
      .post("/employee/profile/submit")
      .set(auth("stillChangingPassword"))
      .expect(422);
    expect((res.body as { error: string }).error).toBe(
      "PASSWORD_CHANGE_REQUIRED",
    );
  });

  it("reports missing items, then completes onboarding once everything required is filled in", async () => {
    const who = "carol";
    const incomplete = await request(app.getHttpServer())
      .post("/employee/profile/submit")
      .set(auth(who))
      .expect(201);
    const missing = (incomplete.body as Body<{ missing: string[] }>).data
      .missing;
    expect(missing).toEqual(
      expect.arrayContaining([
        "personal.dateOfBirth",
        "governmentIds.aadhaarNumber",
      ]),
    );

    await put(who, "/employee/profile/personal-details", validPersonal).expect(
      200,
    );
    await put(who, "/employee/profile/address/PERMANENT", validAddress).expect(
      200,
    );
    await put(who, "/employee/profile/bank-details", {
      accountHolderName: "Carol",
      accountNumber: "123456789012",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
    }).expect(200);
    await put(who, "/employee/profile/government-ids", {
      aadhaarNumber: "123456789012",
      panNumber: "ABCDE1234F",
    }).expect(200);
    for (const documentType of [
      "PROFILE_PHOTO",
      "AADHAAR",
      "PAN",
      "BANK_STATEMENT",
      "CERT_10TH",
      "CERT_12TH",
      "CERT_GRADUATION",
    ]) {
      await uploadDocument(
        who,
        documentType,
        PNG_BYTES,
        `${documentType}.png`,
      ).expect(200);
    }

    const complete = await request(app.getHttpServer())
      .post("/employee/profile/submit")
      .set(auth(who))
      .expect(201);
    expect((complete.body as Body<{ missing: string[] }>).data.missing).toEqual(
      [],
    );

    const employee = await prisma.employee.findUnique({
      where: { id: employeeIds[who] as number },
    });
    expect(employee?.onboardingStatus).toBe("COMPLETE");

    // Submitting again is a harmless no-op, not an error.
    const again = await request(app.getHttpServer())
      .post("/employee/profile/submit")
      .set(auth(who))
      .expect(201);
    expect((again.body as Body<{ missing: string[] }>).data.missing).toEqual(
      [],
    );
  });
});
