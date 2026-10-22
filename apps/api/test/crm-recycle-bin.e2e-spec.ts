import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/** CRM Recycle Bin: soft-delete -> listed -> restore round trip (incl. the
 * Account cascade), permanent delete (explicit confirm, irreversible), the
 * admin-only permission split and tenant isolation. */
describe("crm recycle bin (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenAdmin: string;
  let tokenReader: string;
  let tokenNone: string;
  let tokenB: string;
  let stageId: number;

  type Item = {
    entityType: string;
    id: number;
    label: string;
    deletedAt: string;
  };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  async function bin(token: string, qs = "") {
    const res = await http()
      .get(`/crm/recycle-bin?limit=100${qs}`)
      .set(auth(token))
      .expect(200);
    const body = res.body as { data: Item[]; meta: { total: number } };
    return { items: body.data, total: body.meta.total };
  }
  const has = (items: Item[], entityType: string, id: number) =>
    items.some((i) => i.entityType === entityType && i.id === id);

  async function seedAccountBundle(name: string, withDeal = true) {
    const account = await prisma.account.create({
      data: { organizationId: orgA.id, name },
    });
    const contact = await prisma.contact.create({
      data: {
        organizationId: orgA.id,
        accountId: account.id,
        name: `${name} C`,
      },
    });
    const opportunity = withDeal
      ? await prisma.opportunity.create({
          data: {
            organizationId: orgA.id,
            accountId: account.id,
            contactId: contact.id,
            opportunityNumber: `OPP-${randomUUID().slice(0, 6)}`,
            title: `${name} Deal`,
            ownerName: "Sam",
            stageId,
          },
        })
      : null;
    if (opportunity) {
      await prisma.opportunityStageHistory.create({
        data: {
          organizationId: orgA.id,
          opportunityId: opportunity.id,
          toStageId: stageId,
        },
      });
    }
    const quotation = await prisma.quotation.create({
      data: {
        organizationId: orgA.id,
        accountId: account.id,
        opportunityId: opportunity?.id ?? null,
        quotationNumber: `Q-${randomUUID().slice(0, 8)}`,
        subject: "Quote",
      },
    });
    const note = await prisma.crmNote.create({
      data: {
        organizationId: orgA.id,
        accountId: account.id,
        content: `${name} note`,
      },
    });
    return { account, contact, opportunity, quotation, note };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const suffix = randomUUID().slice(0, 8);
    orgA = await prisma.organization.create({
      data: { name: `Org A ${suffix}`, slug: `crm-rb-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-rb-b-${suffix}` },
    });

    const perm = (code: string) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    const rbRead = await perm("crm.recyclebin.read");
    const rbWrite = await perm("crm.recyclebin.write");
    const accDelete = await perm("crm.account.delete");

    async function makeUser(orgId: number, email: string, ids: number[]) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          email,
          passwordHash,
          fullName: "Test User",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }
    await makeUser(orgA.id, "admin@crm-rb-a.test", [
      rbRead.id,
      rbWrite.id,
      accDelete.id,
    ]);
    await makeUser(orgA.id, "reader@crm-rb-a.test", [rbRead.id]);
    await makeUser(orgA.id, "none@crm-rb-a.test", []);
    await makeUser(orgB.id, "admin@crm-rb-b.test", [rbRead.id, rbWrite.id]);

    const login = async (slug: string, email: string) => {
      const res = await http()
        .post("/auth/login")
        .send({ organizationSlug: slug, email, password: "Password123!" })
        .expect(201);
      return (res.body as { data: { accessToken: string } }).data.accessToken;
    };
    tokenAdmin = await login(orgA.slug, "admin@crm-rb-a.test");
    tokenReader = await login(orgA.slug, "reader@crm-rb-a.test");
    tokenNone = await login(orgA.slug, "none@crm-rb-a.test");
    tokenB = await login(orgB.slug, "admin@crm-rb-b.test");

    stageId = (
      await prisma.pipelineStage.create({
        data: { organizationId: orgA.id, code: "NEW", label: "New", order: 1 },
      })
    ).id;
  });

  afterAll(async () => {
    // opportunity_stage_history is append-only (DB trigger), so deals with
    // history - and the accounts/stage they pin - are left behind like other
    // audited test data; everything deletable is removed.
    const orgs = { in: [orgA.id, orgB.id] };
    const attempts = [
      () => prisma.quotation.deleteMany({ where: { organizationId: orgs } }),
      () => prisma.crmNote.deleteMany({ where: { organizationId: orgs } }),
      () => prisma.crmTask.deleteMany({ where: { organizationId: orgs } }),
      () => prisma.crmMeeting.deleteMany({ where: { organizationId: orgs } }),
      () => prisma.opportunity.deleteMany({ where: { organizationId: orgs } }),
      () => prisma.contact.deleteMany({ where: { organizationId: orgs } }),
      () => prisma.account.deleteMany({ where: { organizationId: orgs } }),
      () =>
        prisma.pipelineStage.deleteMany({ where: { organizationId: orgs } }),
    ];
    for (const attempt of attempts) {
      try {
        await attempt();
      } catch {
        /* pinned by append-only stage history */
      }
    }
    await app.close();
  });

  it("rejects unauthenticated users and enforces the read/write permission split", async () => {
    await http().get("/crm/recycle-bin").expect(401);
    await http().get("/crm/recycle-bin").set(auth(tokenNone)).expect(403);
    await http()
      .get("/crm/recycle-bin/summary")
      .set(auth(tokenNone))
      .expect(403);
    // Read-only: can view, cannot restore or purge.
    await http().get("/crm/recycle-bin").set(auth(tokenReader)).expect(200);
    await http()
      .post("/crm/recycle-bin/task/1/restore")
      .set(auth(tokenReader))
      .expect(403);
    await http()
      .post("/crm/recycle-bin/task/1/purge")
      .set(auth(tokenReader))
      .send({ confirm: true })
      .expect(403);
    await http()
      .post("/crm/recycle-bin/not_a_type/1/restore")
      .set(auth(tokenAdmin))
      .expect(400);
  });

  it("account soft-delete -> listed with its cascade -> restore round trip", async () => {
    const b = await seedAccountBundle("RoundTrip");
    // A contact deleted on its own, long before the account, must stay deleted.
    const earlier = await prisma.contact.create({
      data: {
        organizationId: orgA.id,
        accountId: b.account.id,
        name: "Deleted earlier",
        deletedAt: new Date(Date.now() - 86_400_000),
      },
    });

    // Polymorphic records on the account, its contact and its deal.
    const mk = (relatedType: string, relatedId: number, orgId = orgA.id) => ({
      organizationId: orgId,
      relatedType,
      relatedId,
    });
    const rel = [
      mk("account", b.account.id),
      mk("contact", b.contact.id),
      mk("opportunity", b.opportunity!.id),
    ];
    const meetings = await Promise.all(
      rel.map((r) =>
        prisma.crmMeeting.create({ data: { ...r, meetingDate: new Date() } }),
      ),
    );
    const followUps = await Promise.all(
      rel.map((r) =>
        prisma.crmFollowUp.create({
          data: {
            ...r,
            type: "Call",
            scheduledAt: new Date(),
            assignedTo: "Sam",
          },
        }),
      ),
    );
    const tasks = await Promise.all(
      rel.map((r) =>
        prisma.crmTask.create({
          data: { ...r, title: "T", dueDate: new Date(), assignedTo: "Sam" },
        }),
      ),
    );
    const docs = await Promise.all(
      rel.map((r) =>
        prisma.crmDocument.create({
          data: { ...r, name: "D", link: "https://x.test/d" },
        }),
      ),
    );
    const acts = await Promise.all(
      rel.map((r) =>
        prisma.crmActivity.create({
          data: {
            ...r,
            type: "Note",
            subject: "A",
            occurredAt: new Date(),
          },
        }),
      ),
    );
    // Unrelated: another account's meeting, a meeting deleted earlier, and
    // another tenant's meeting that reuses the same relatedId.
    const other = await prisma.account.create({
      data: { organizationId: orgA.id, name: "RoundTrip Other" },
    });
    const otherMeeting = await prisma.crmMeeting.create({
      data: { ...mk("account", other.id), meetingDate: new Date() },
    });
    const earlierMeeting = await prisma.crmMeeting.create({
      data: {
        ...mk("account", b.account.id),
        meetingDate: new Date(),
        deletedAt: new Date(Date.now() - 86_400_000),
      },
    });
    const orgBMeeting = await prisma.crmMeeting.create({
      data: {
        ...mk("account", b.account.id, orgB.id),
        meetingDate: new Date(),
      },
    });

    await http()
      .delete(`/crm/accounts/${b.account.id}`)
      .set(auth(tokenAdmin))
      .expect(204);

    const cascaded = [
      ...(await prisma.crmMeeting.findMany({
        where: { id: { in: meetings.map((x) => x.id) } },
      })),
      ...(await prisma.crmFollowUp.findMany({
        where: { id: { in: followUps.map((x) => x.id) } },
      })),
      ...(await prisma.crmTask.findMany({
        where: { id: { in: tasks.map((x) => x.id) } },
      })),
      ...(await prisma.crmDocument.findMany({
        where: { id: { in: docs.map((x) => x.id) } },
      })),
      ...(await prisma.crmActivity.findMany({
        where: { id: { in: acts.map((x) => x.id) } },
      })),
    ];
    expect(cascaded).toHaveLength(15);
    const instant = (
      await prisma.account.findUniqueOrThrow({ where: { id: b.account.id } })
    ).deletedAt!;
    for (const r of cascaded)
      expect(r.deletedAt?.getTime()).toBe(instant.getTime());
    expect(
      (await prisma.crmMeeting.findUnique({ where: { id: otherMeeting.id } }))
        ?.deletedAt,
    ).toBeNull();
    expect(
      (await prisma.crmMeeting.findUnique({ where: { id: orgBMeeting.id } }))
        ?.deletedAt,
    ).toBeNull();

    const listed = await bin(tokenAdmin);
    expect(has(listed.items, "meeting", meetings[1]!.id)).toBe(true);
    expect(has(listed.items, "task", tasks[2]!.id)).toBe(true);
    expect(has(listed.items, "document", docs[0]!.id)).toBe(true);
    expect(has(listed.items, "follow_up", followUps[0]!.id)).toBe(true);
    expect(has(listed.items, "activity", acts[2]!.id)).toBe(true);
    expect(has(listed.items, "account", b.account.id)).toBe(true);
    expect(has(listed.items, "contact", b.contact.id)).toBe(true);
    expect(has(listed.items, "opportunity", b.opportunity!.id)).toBe(true);
    expect(has(listed.items, "quotation", b.quotation.id)).toBe(true);
    expect(has(listed.items, "note", b.note.id)).toBe(true);

    const summary = await http()
      .get("/crm/recycle-bin/summary")
      .set(auth(tokenAdmin))
      .expect(200);
    const types = (
      summary.body as {
        data: { types: { entityType: string; count: number }[] };
      }
    ).data.types;
    expect(
      types.find((t) => t.entityType === "account")?.count,
    ).toBeGreaterThan(0);

    // Filter + search.
    const filtered = await bin(
      tokenAdmin,
      "&entityType=account&search=roundtrip",
    );
    expect(filtered.items.map((i) => i.id)).toEqual([b.account.id]);

    // Snapshot details + cascade child count ("+N related records").
    const entry = filtered.items[0] as unknown as {
      relatedCount: number;
      deletedByName: string | null;
      data: Record<string, unknown>;
    };
    expect(entry.relatedCount).toBe(4 + 15);
    expect(entry.data.name).toBe(b.account.name);
    expect(entry.data).not.toHaveProperty("organizationId");
    expect(typeof entry.deletedByName === "string").toBe(true);

    // A cascaded child cannot be restored while its account is still deleted.
    const blocked = await http()
      .post(`/crm/recycle-bin/contact/${b.contact.id}/restore`)
      .set(auth(tokenAdmin))
      .expect(422);
    expect(JSON.stringify(blocked.body)).toContain("PARENT_DELETED");

    await http()
      .post(`/crm/recycle-bin/account/${b.account.id}/restore`)
      .set(auth(tokenAdmin))
      .expect(200);

    const [account, contact, opp, quote, note, stillDeleted] =
      await Promise.all([
        prisma.account.findUnique({ where: { id: b.account.id } }),
        prisma.contact.findUnique({ where: { id: b.contact.id } }),
        prisma.opportunity.findUnique({ where: { id: b.opportunity!.id } }),
        prisma.quotation.findUnique({ where: { id: b.quotation.id } }),
        prisma.crmNote.findUnique({ where: { id: b.note.id } }),
        prisma.contact.findUnique({ where: { id: earlier.id } }),
      ]);
    expect(account?.deletedAt).toBeNull();
    expect(account?.isActive).toBe(true);
    expect(contact?.deletedAt).toBeNull();
    expect(opp?.deletedAt).toBeNull();
    expect(quote?.deletedAt).toBeNull();
    expect(note?.deletedAt).toBeNull();
    expect(stillDeleted?.deletedAt).not.toBeNull();
    const restored = [
      ...(await prisma.crmMeeting.findMany({
        where: { id: { in: meetings.map((x) => x.id) } },
      })),
      ...(await prisma.crmFollowUp.findMany({
        where: { id: { in: followUps.map((x) => x.id) } },
      })),
      ...(await prisma.crmTask.findMany({
        where: { id: { in: tasks.map((x) => x.id) } },
      })),
      ...(await prisma.crmDocument.findMany({
        where: { id: { in: docs.map((x) => x.id) } },
      })),
      ...(await prisma.crmActivity.findMany({
        where: { id: { in: acts.map((x) => x.id) } },
      })),
    ];
    expect(restored.every((r) => r.deletedAt === null)).toBe(true);
    expect(
      (await prisma.crmMeeting.findUnique({ where: { id: earlierMeeting.id } }))
        ?.deletedAt,
    ).not.toBeNull();

    // Restoring again 404s: it is no longer in the bin.
    await http()
      .post(`/crm/recycle-bin/account/${b.account.id}/restore`)
      .set(auth(tokenAdmin))
      .expect(404);

    // The restore left an audit trail.
    const audit = await prisma.auditLog.findFirst({
      where: {
        organizationId: orgA.id,
        entityType: "crm_account",
        entityId: BigInt(b.account.id),
        action: "restore",
      },
    });
    expect(audit).not.toBeNull();
  });

  it("permanent delete requires confirm, is irreversible and FK-safe for an account bundle", async () => {
    const b = await seedAccountBundle("Purge", false);
    await http()
      .delete(`/crm/accounts/${b.account.id}`)
      .set(auth(tokenAdmin))
      .expect(204);

    // Missing/false confirmation is rejected and nothing is deleted.
    await http()
      .post(`/crm/recycle-bin/account/${b.account.id}/purge`)
      .set(auth(tokenAdmin))
      .send({})
      .expect(400);
    await http()
      .post(`/crm/recycle-bin/account/${b.account.id}/purge`)
      .set(auth(tokenAdmin))
      .send({ confirm: false })
      .expect(422);
    expect(
      await prisma.account.findUnique({ where: { id: b.account.id } }),
    ).not.toBeNull();

    await http()
      .post(`/crm/recycle-bin/account/${b.account.id}/purge`)
      .set(auth(tokenAdmin))
      .send({ confirm: true })
      .expect(200);

    expect(
      await prisma.account.findUnique({ where: { id: b.account.id } }),
    ).toBeNull();
    expect(
      await prisma.contact.findUnique({ where: { id: b.contact.id } }),
    ).toBeNull();
    expect(
      await prisma.quotation.findUnique({ where: { id: b.quotation.id } }),
    ).toBeNull();
    expect(
      await prisma.crmNote.findUnique({ where: { id: b.note.id } }),
    ).toBeNull();
    expect(
      await prisma.pipelineStage.findUnique({ where: { id: stageId } }),
    ).not.toBeNull();

    // Gone for good: neither restorable nor purgeable again.
    await http()
      .post(`/crm/recycle-bin/account/${b.account.id}/restore`)
      .set(auth(tokenAdmin))
      .expect(404);
    await http()
      .post(`/crm/recycle-bin/account/${b.account.id}/purge`)
      .set(auth(tokenAdmin))
      .send({ confirm: true })
      .expect(404);

    const audit = await prisma.auditLog.findFirst({
      where: {
        organizationId: orgA.id,
        entityType: "crm_account",
        entityId: BigInt(b.account.id),
        action: "purge",
      },
    });
    expect(audit).not.toBeNull();
  });

  it("refuses to permanently delete a deal (or its account): stage history is append-only", async () => {
    const b = await seedAccountBundle("DealPurge");
    await http()
      .delete(`/crm/accounts/${b.account.id}`)
      .set(auth(tokenAdmin))
      .expect(204);

    const deal = await http()
      .post(`/crm/recycle-bin/opportunity/${b.opportunity!.id}/purge`)
      .set(auth(tokenAdmin))
      .send({ confirm: true })
      .expect(422);
    expect(JSON.stringify(deal.body)).toContain("HAS_IMMUTABLE_HISTORY");
    const account = await http()
      .post(`/crm/recycle-bin/account/${b.account.id}/purge`)
      .set(auth(tokenAdmin))
      .send({ confirm: true })
      .expect(422);
    expect(JSON.stringify(account.body)).toContain("HAS_IMMUTABLE_HISTORY");

    // Rolled back: nothing was removed or detached.
    expect(
      await prisma.account.findUnique({ where: { id: b.account.id } }),
    ).not.toBeNull();
    expect(
      await prisma.opportunity.findUnique({ where: { id: b.opportunity!.id } }),
    ).not.toBeNull();
    expect(
      (await prisma.quotation.findUnique({ where: { id: b.quotation.id } }))
        ?.opportunityId,
    ).toBe(b.opportunity!.id);
  });

  it("restores and purges other entity types (meeting, task) and refuses live rows", async () => {
    const account = await prisma.account.create({
      data: { organizationId: orgA.id, name: "Misc Account" },
    });
    const meeting = await prisma.crmMeeting.create({
      data: {
        organizationId: orgA.id,
        relatedType: "account",
        relatedId: account.id,
        meetingDate: new Date(),
        deletedAt: new Date(),
      },
    });
    const task = await prisma.crmTask.create({
      data: {
        organizationId: orgA.id,
        relatedType: "account",
        relatedId: account.id,
        title: "Deleted task",
        dueDate: new Date(),
        assignedTo: "Sam",
        deletedAt: new Date(),
      },
    });
    const liveTask = await prisma.crmTask.create({
      data: {
        organizationId: orgA.id,
        relatedType: "account",
        relatedId: account.id,
        title: "Live task",
        dueDate: new Date(),
        assignedTo: "Sam",
      },
    });

    const listed = await bin(tokenAdmin);
    expect(has(listed.items, "meeting", meeting.id)).toBe(true);
    expect(has(listed.items, "task", task.id)).toBe(true);
    expect(has(listed.items, "task", liveTask.id)).toBe(false);

    // A live (not deleted) record is not in the bin: restore/purge 404.
    await http()
      .post(`/crm/recycle-bin/task/${liveTask.id}/purge`)
      .set(auth(tokenAdmin))
      .send({ confirm: true })
      .expect(404);

    await http()
      .post(`/crm/recycle-bin/meeting/${meeting.id}/restore`)
      .set(auth(tokenAdmin))
      .expect(200);
    expect(
      (await prisma.crmMeeting.findUnique({ where: { id: meeting.id } }))
        ?.deletedAt,
    ).toBeNull();

    await http()
      .post(`/crm/recycle-bin/task/${task.id}/purge`)
      .set(auth(tokenAdmin))
      .send({ confirm: true })
      .expect(200);
    expect(
      await prisma.crmTask.findUnique({ where: { id: task.id } }),
    ).toBeNull();
    expect(
      await prisma.crmTask.findUnique({ where: { id: liveTask.id } }),
    ).not.toBeNull();
  });

  it("isolates tenants", async () => {
    const account = await prisma.account.create({
      data: {
        organizationId: orgA.id,
        name: "Isolated",
        deletedAt: new Date(),
      },
    });
    expect(has((await bin(tokenAdmin)).items, "account", account.id)).toBe(
      true,
    );
    expect(has((await bin(tokenB)).items, "account", account.id)).toBe(false);

    await http()
      .post(`/crm/recycle-bin/account/${account.id}/restore`)
      .set(auth(tokenB))
      .expect(404);
    await http()
      .post(`/crm/recycle-bin/account/${account.id}/purge`)
      .set(auth(tokenB))
      .send({ confirm: true })
      .expect(404);
    expect(
      await prisma.account.findUnique({ where: { id: account.id } }),
    ).not.toBeNull();
  });
});
