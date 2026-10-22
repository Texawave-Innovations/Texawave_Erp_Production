import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

describe("crm pipeline-stages + opportunities (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let accountA: { id: number };
  let accountB: { id: number };
  let tokenAll: string;
  let tokenOwnOther: string;
  let tokenNoPermission: string;
  let tokenB: string;

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
      data: { name: `Org A ${suffix}`, slug: `crm-opp-org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `crm-opp-org-b-${suffix}` },
    });
    accountA = await prisma.account.create({
      data: { organizationId: orgA.id, name: `Acme A ${suffix}` },
    });
    accountB = await prisma.account.create({
      data: { organizationId: orgB.id, name: `Acme B ${suffix}` },
    });

    async function permission(code: string) {
      return prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const stageRead = await permission("crm.pipeline_stage.read");
    const stageWrite = await permission("crm.pipeline_stage.write");
    const readAll = await permission("crm.opportunity.read.all");
    const writeAll = await permission("crm.opportunity.write.all");
    const readOwn = await permission("crm.opportunity.read.own");
    const writeOwn = await permission("crm.opportunity.write.own");
    const productRead = await permission("crm.product.read");
    const productWrite = await permission("crm.product.write");

    async function makeUser(
      orgId: number,
      email: string,
      permissionIds: number[],
    ) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `role-${randomUUID().slice(0, 8)}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
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
      return user;
    }

    await makeUser(orgA.id, "all-access@crm-opp-org-a.test", [
      stageRead.id,
      stageWrite.id,
      readAll.id,
      writeAll.id,
      productRead.id,
      productWrite.id,
    ]);
    await makeUser(orgA.id, "own-only@crm-opp-org-a.test", [
      stageRead.id,
      readOwn.id,
      writeOwn.id,
      productRead.id,
    ]);
    await makeUser(orgA.id, "no-permission@crm-opp-org-a.test", []);
    await makeUser(orgB.id, "all-access@crm-opp-org-b.test", [
      stageRead.id,
      stageWrite.id,
      readAll.id,
      writeAll.id,
    ]);

    async function login(
      organizationSlug: string,
      email: string,
    ): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }

    tokenAll = await login(orgA.slug, "all-access@crm-opp-org-a.test");
    tokenOwnOther = await login(orgA.slug, "own-only@crm-opp-org-a.test");
    tokenNoPermission = await login(
      orgA.slug,
      "no-permission@crm-opp-org-a.test",
    );
    tokenB = await login(orgB.slug, "all-access@crm-opp-org-b.test");
  });

  /** Unlike crm-contacts/crm-leads, nothing here is cleaned up: every
   * Opportunity gets a stage-history row at creation, `opportunity_stage_
   * history` is DB-trigger append-only (can never be DELETEd, even via a
   * cascade — a cascade is still a real per-row DELETE and still fires
   * the trigger), and `opportunities.stage_id`/`.account_id` are
   * `ON DELETE RESTRICT`. So an Opportunity can never be hard-deleted
   * once it has history (i.e. always), which transitively pins its
   * Account, PipelineStage, and Organization too — a stronger, intended
   * version of the same "audit_logs makes rows permanent" tradeoff the
   * other CRM e2e suites already document. Soft-delete (tested above via
   * the real API) is the only deletion path, by design
   * (Docs/ARCHITECTURE.md "never delete business records"). */
  afterAll(async () => {
    await app.close();
  });

  // --- Pipeline stages ---------------------------------------------------

  describe("pipeline stages", () => {
    it("rejects unauthenticated and no-permission requests", async () => {
      await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .expect(401);
      await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenNoPermission}`)
        .expect(403);
    });

    it("self-seeds the legacy 13-stage list on first read, with won/lost/on_hold flags set", async () => {
      const res = await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const stages = (
        res.body as {
          data: {
            code: string;
            isWon: boolean;
            isLost: boolean;
            isOnHold: boolean;
          }[];
        }
      ).data;
      expect(stages).toHaveLength(13);
      expect(stages.find((s) => s.code === "won")?.isWon).toBe(true);
      expect(stages.find((s) => s.code === "lost")?.isLost).toBe(true);
      expect(stages.find((s) => s.code === "on_hold")?.isOnHold).toBe(true);

      // Re-reading never re-seeds (would duplicate codes and violate the
      // (organizationId, code) unique constraint if it tried).
      const again = await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      expect((again.body as { data: unknown[] }).data).toHaveLength(13);
    });

    it("Org B gets its own independent seeded set (tenant isolation)", async () => {
      const res = await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      expect((res.body as { data: unknown[] }).data).toHaveLength(13);
    });

    it("creates a custom stage and reorders the full list", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ label: "Technical Evaluation", probability: 45 })
        .expect(201);
      const created = (
        createRes.body as { data: { id: number; code: string; order: number } }
      ).data;
      expect(created.code).toBe("technical_evaluation");

      const listRes = await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const ids = (listRes.body as { data: { id: number }[] }).data.map(
        (s) => s.id,
      );
      const reversed = [...ids].reverse();

      const reorderRes = await request(app.getHttpServer())
        .patch("/crm/pipeline-stages/reorder")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ orderedIds: reversed })
        .expect(200);
      const reordered = (
        reorderRes.body as { data: { id: number; order: number }[] }
      ).data;
      reversed.forEach((id, index) => {
        expect(reordered.find((s) => s.id === id)?.order).toBe(index + 1);
      });
    });

    it("rejects a reorder that omits or adds an id (422)", async () => {
      const listRes = await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const ids = (listRes.body as { data: { id: number }[] }).data.map(
        (s) => s.id,
      );

      await request(app.getHttpServer())
        .patch("/crm/pipeline-stages/reorder")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ orderedIds: ids.slice(1) })
        .expect(422);
    });
  });

  // --- Opportunities -------------------------------------------------------

  async function firstBoardStageId(token: string): Promise<number> {
    const res = await request(app.getHttpServer())
      .get("/crm/pipeline-stages")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const stages = (
      res.body as { data: { id: number; code: string; order: number }[] }
    ).data;
    return stages
      .filter(
        (s) => s.code !== "won" && s.code !== "lost" && s.code !== "on_hold",
      )
      .sort((a, b) => a.order - b.order)[0]!.id;
  }

  it("rejects unauthenticated and no-permission opportunity requests", async () => {
    await request(app.getHttpServer()).get("/crm/opportunities").expect(401);
    await request(app.getHttpServer())
      .get("/crm/opportunities")
      .set("Authorization", `Bearer ${tokenNoPermission}`)
      .expect(403);
  });

  it("rejects create without required fields (400) and with a cross-org account (422)", async () => {
    const stageId = await firstBoardStageId(tokenAll);
    await request(app.getHttpServer())
      .post("/crm/opportunities")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ title: "Missing fields" })
      .expect(400);

    await request(app.getHttpServer())
      .post("/crm/opportunities")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        accountId: accountB.id,
        title: "Cross Org",
        ownerName: "Rep",
        stageId,
        estimatedValue: 1000,
      })
      .expect(422);
  });

  it("creates, reads, updates, and soft-deletes an opportunity with tenant isolation, numbering it OPP-######", async () => {
    const stageId = await firstBoardStageId(tokenAll);
    const createRes = await request(app.getHttpServer())
      .post("/crm/opportunities")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        accountId: accountA.id,
        title: "Website Revamp",
        ownerName: "Rep A",
        stageId,
        estimatedValue: 50000,
        forecastCategory: "Best Case",
      })
      .expect(201);
    const created = (
      createRes.body as {
        data: {
          id: number;
          opportunityNumber: string;
          stageId: number;
          forecastCategory: string;
        };
      }
    ).data;
    expect(created.forecastCategory).toBe("Best Case");
    await request(app.getHttpServer())
      .patch(`/crm/opportunities/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ forecastCategory: "Whenever" })
      .expect(400);
    expect(created.opportunityNumber).toBe(
      `OPP-${String(created.id).padStart(6, "0")}`,
    );
    expect(created.stageId).toBe(stageId);

    await request(app.getHttpServer())
      .get(`/crm/opportunities/${created.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    const updateRes = await request(app.getHttpServer())
      .patch(`/crm/opportunities/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({ estimatedValue: 75000 })
      .expect(200);
    expect(
      (updateRes.body as { data: { estimatedValue: string } }).data
        .estimatedValue,
    ).toBe("75000");

    await request(app.getHttpServer())
      .delete(`/crm/opportunities/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/crm/opportunities/${created.id}`)
      .set("Authorization", `Bearer ${tokenAll}`)
      .expect(404);
  });

  it("'.own' scope cannot read, update, change-stage, or delete an opportunity it did not create (404)", async () => {
    const stageId = await firstBoardStageId(tokenAll);
    const createRes = await request(app.getHttpServer())
      .post("/crm/opportunities")
      .set("Authorization", `Bearer ${tokenAll}`)
      .send({
        accountId: accountA.id,
        title: "Not Mine",
        ownerName: "Rep A",
        stageId,
        estimatedValue: 1000,
      })
      .expect(201);
    const opp = (createRes.body as { data: { id: number } }).data;

    await request(app.getHttpServer())
      .get(`/crm/opportunities/${opp.id}`)
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/crm/opportunities/${opp.id}`)
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .send({ title: "Hijacked" })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/crm/opportunities/${opp.id}/stage`)
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .send({ stageId })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/crm/opportunities/${opp.id}`)
      .set("Authorization", `Bearer ${tokenOwnOther}`)
      .expect(404);
  });

  describe("stage transitions and history", () => {
    it("changes stage, is a no-op on the same stage, and records append-only history (DB rejects a direct UPDATE/DELETE on it)", async () => {
      const stagesRes = await request(app.getHttpServer())
        .get("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const boardStages = (
        stagesRes.body as {
          data: { id: number; code: string; order: number }[];
        }
      ).data
        .filter((s) => !["won", "lost", "on_hold"].includes(s.code))
        .sort((a, b) => a.order - b.order);
      const [stage1, stage2] = boardStages;

      const createRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: "Stage Test",
          ownerName: "Rep A",
          stageId: stage1!.id,
          estimatedValue: 1000,
        })
        .expect(201);
      const opp = (createRes.body as { data: { id: number } }).data;

      // No-op: same stage leaves history untouched (still just the
      // creation entry).
      await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/stage`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ stageId: stage1!.id })
        .expect(201);
      const afterNoop = await request(app.getHttpServer())
        .get(`/crm/opportunities/${opp.id}/stage-history`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      expect((afterNoop.body as { data: unknown[] }).data).toHaveLength(1);

      await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/stage`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ stageId: stage2!.id, remarks: "Moved forward" })
        .expect(201);

      const historyRes = await request(app.getHttpServer())
        .get(`/crm/opportunities/${opp.id}/stage-history`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const history = (
        historyRes.body as {
          data: {
            fromStageId: number | null;
            toStageId: number;
            remarks: string | null;
          }[];
        }
      ).data;
      expect(history).toHaveLength(2);
      expect(history[0]!.toStageId).toBe(stage2!.id);
      expect(history[0]!.fromStageId).toBe(stage1!.id);
      expect(history[0]!.remarks).toBe("Moved forward");

      // DB-level append-only proof: a direct Prisma UPDATE/DELETE against
      // the history table (bypassing the API entirely) must be rejected
      // by the migration's trigger, not just "the API never exposes an
      // endpoint for it".
      const anyHistoryId = (await prisma.opportunityStageHistory.findFirst({
        where: { opportunityId: opp.id },
      }))!.id;
      await expect(
        prisma.opportunityStageHistory.update({
          where: { id: anyHistoryId },
          data: { remarks: "tampered" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.opportunityStageHistory.delete({ where: { id: anyHistoryId } }),
      ).rejects.toThrow();
    });
  });

  describe("won / lost / on-hold / reopen / stuck-reason", () => {
    async function createOpportunity(stageId: number) {
      const res = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: `Deal ${randomUUID().slice(0, 8)}`,
          ownerName: "Rep A",
          stageId,
          estimatedValue: 20000,
          expectedCloseDate: "2027-01-15",
        })
        .expect(201);
      return (res.body as { data: { id: number; stageId: number } }).data;
    }

    it("marks Won, defaulting closingAmount/closingDate to estimatedValue/expectedCloseDate", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const opp = await createOpportunity(stageId);

      const res = await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/won`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({})
        .expect(201);
      const won = (
        res.body as {
          data: {
            status: string;
            closingAmount: string;
            closingDate: string;
            stage: { code: string };
          };
        }
      ).data;
      expect(won.status).toBe("WON");
      expect(won.closingAmount).toBe("20000");
      expect(won.stage.code).toBe("won");
    });

    it("marks Lost with a reason", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const opp = await createOpportunity(stageId);

      const res = await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/lost`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ reason: "Pricing", competitor: "RivalCo" })
        .expect(201);
      const lost = (
        res.body as {
          data: { status: string; lostReason: string; competitor: string };
        }
      ).data;
      expect(lost.status).toBe("LOST");
      expect(lost.lostReason).toBe("Pricing");
      expect(lost.competitor).toBe("RivalCo");
    });

    it("rejects an invalid lost reason (400)", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const opp = await createOpportunity(stageId);
      await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/lost`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ reason: "Not A Real Reason" })
        .expect(400);
    });

    it("puts On Hold WITHOUT moving stageId (legacy's observed quirk), but still logs a stage-history transition to the on-hold stage", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const opp = await createOpportunity(stageId);

      const res = await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/on-hold`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ reason: "Budget Freeze", notes: "Waiting on next FY budget" })
        .expect(201);
      const held = (
        res.body as {
          data: { status: string; stageId: number; holdReason: string };
        }
      ).data;
      expect(held.status).toBe("ON_HOLD");
      expect(held.stageId).toBe(stageId); // unchanged — the quirk

      const historyRes = await request(app.getHttpServer())
        .get(`/crm/opportunities/${opp.id}/stage-history`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const latest = (
        historyRes.body as { data: { toStage: { code: string } }[] }
      ).data[0]!;
      expect(latest.toStage.code).toBe("on_hold");
    });

    it("reopens a Lost opportunity back to OPEN in the given stage, clearing lost details", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const opp = await createOpportunity(stageId);
      await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/lost`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ reason: "No Budget" })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/reopen`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ stageId })
        .expect(201);
      const reopened = (
        res.body as {
          data: { status: string; stageId: number; lostReason: string | null };
        }
      ).data;
      expect(reopened.status).toBe("OPEN");
      expect(reopened.stageId).toBe(stageId);
      expect(reopened.lostReason).toBeNull();
    });

    it("sets a stuck reason without adding a stage-history entry", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const opp = await createOpportunity(stageId);
      const before = await request(app.getHttpServer())
        .get(`/crm/opportunities/${opp.id}/stage-history`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      const beforeCount = (before.body as { data: unknown[] }).data.length;

      const res = await request(app.getHttpServer())
        .patch(`/crm/opportunities/${opp.id}/stuck-reason`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ reason: "Waiting for Client" })
        .expect(200);
      expect(
        (res.body as { data: { stuckReason: string } }).data.stuckReason,
      ).toBe("Waiting for Client");

      const after = await request(app.getHttpServer())
        .get(`/crm/opportunities/${opp.id}/stage-history`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      expect((after.body as { data: unknown[] }).data).toHaveLength(
        beforeCount,
      );
    });
  });

  describe("deal line items (products)", () => {
    async function createProduct(
      overrides: Partial<{
        unitPrice: number;
        taxPercent: number;
        isActive: boolean;
      }> = {},
    ) {
      const res = await request(app.getHttpServer())
        .post("/crm/products")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          name: `Line Item Product ${randomUUID().slice(0, 6)}`,
          code: `SKU-LI-${randomUUID().slice(0, 6)}`,
          unitPrice: overrides.unitPrice ?? 100,
          taxPercent: overrides.taxPercent ?? 18,
          isActive: overrides.isActive ?? true,
        })
        .expect(201);
      return (
        res.body as {
          data: {
            id: number;
            name: string;
            unitPrice: string;
            taxPercent: string;
          };
        }
      ).data;
    }

    it("adds a product to a deal, snapshotting name/unitPrice/taxPercent and computing total via the shared formula", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const product = await createProduct({ unitPrice: 450.5, taxPercent: 18 });
      const oppRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: "Deal With Line Items",
          ownerName: "Rep A",
          stageId,
          estimatedValue: 0,
        })
        .expect(201);
      const opp = (oppRes.body as { data: { id: number } }).data;

      const addRes = await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/products`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          items: [{ productId: product.id, quantity: 3, discountPercent: 10 }],
        })
        .expect(201);
      const items = (
        addRes.body as {
          data: {
            id: number;
            productName: string;
            unitPrice: string;
            taxPercent: string;
            total: string;
          }[];
        }
      ).data;
      expect(items).toHaveLength(1);
      const line = items[0]!;
      expect(line.productName).toBe(product.name);
      expect(line.unitPrice).toBe("450.5");
      expect(line.taxPercent).toBe("18");

      // gross = 3 * 450.5 = 1351.5; discount 10% = 135.15; taxable = 1216.35;
      // tax 18% of 1216.35 = 218.943 -> round2 = 218.94; total = 1435.29
      expect(line.total).toBe("1435.29");

      const list = await request(app.getHttpServer())
        .get(`/crm/opportunities/${opp.id}/products`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      expect((list.body as { data: unknown[] }).data).toHaveLength(1);
    });

    it("rejects adding an inactive product (business rule, not just a UI filter)", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const inactiveProduct = await createProduct({ isActive: false });
      const oppRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: "Inactive Product Deal",
          ownerName: "Rep A",
          stageId,
          estimatedValue: 0,
        })
        .expect(201);
      const opp = (oppRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/products`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ items: [{ productId: inactiveProduct.id, quantity: 1 }] })
        .expect(422);
    });

    it("rejects a product id that does not exist in this organization (422)", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const oppRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: "Bad Product Deal",
          ownerName: "Rep A",
          stageId,
          estimatedValue: 0,
        })
        .expect(201);
      const opp = (oppRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/products`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ items: [{ productId: 999_999_999, quantity: 1 }] })
        .expect(422);
    });

    it("updates a line item's quantity/discount, recomputing total from the FROZEN unitPrice/taxPercent snapshot (never re-reading the live product)", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const product = await createProduct({ unitPrice: 100, taxPercent: 10 });
      const oppRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: "Update Line Item Deal",
          ownerName: "Rep A",
          stageId,
          estimatedValue: 0,
        })
        .expect(201);
      const opp = (oppRes.body as { data: { id: number } }).data;
      const addRes = await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/products`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ items: [{ productId: product.id, quantity: 1 }] })
        .expect(201);
      const lineId = (addRes.body as { data: { id: number }[] }).data[0]!.id;

      // Re-price the catalog product AFTER the line item was added — the
      // existing line's snapshot must not move.
      await request(app.getHttpServer())
        .patch(`/crm/products/${product.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ unitPrice: 9999 })
        .expect(200);

      const updateRes = await request(app.getHttpServer())
        .patch(`/crm/opportunities/${opp.id}/products/${lineId}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ quantity: 2 })
        .expect(200);
      const updated = (
        updateRes.body as { data: { unitPrice: string; total: string } }
      ).data;
      // Still 100, not 9999 — the snapshot is frozen.
      expect(updated.unitPrice).toBe("100");
      expect(updated.total).toBe("220"); // 2 * 100 * 1.10 tax, no discount
    });

    it("soft-deletes a line item, and '.own' scope cannot touch a deal it did not create", async () => {
      const stageId = await firstBoardStageId(tokenAll);
      const product = await createProduct();
      const oppRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: "Remove Line Item Deal",
          ownerName: "Rep A",
          stageId,
          estimatedValue: 0,
        })
        .expect(201);
      const opp = (oppRes.body as { data: { id: number } }).data;
      const addRes = await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/products`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ items: [{ productId: product.id, quantity: 1 }] })
        .expect(201);
      const lineId = (addRes.body as { data: { id: number }[] }).data[0]!.id;

      await request(app.getHttpServer())
        .post(`/crm/opportunities/${opp.id}/products`)
        .set("Authorization", `Bearer ${tokenOwnOther}`)
        .send({ items: [{ productId: product.id, quantity: 1 }] })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/crm/opportunities/${opp.id}/products/${lineId}`)
        .set("Authorization", `Bearer ${tokenOwnOther}`)
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/crm/opportunities/${opp.id}/products/${lineId}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(204);

      const list = await request(app.getHttpServer())
        .get(`/crm/opportunities/${opp.id}/products`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(200);
      expect((list.body as { data: unknown[] }).data).toHaveLength(0);
    });
  });

  describe("pipeline stage delete business rule", () => {
    it("refuses to delete a stage with an opportunity in it (422), succeeds once it's empty", async () => {
      const createStageRes = await request(app.getHttpServer())
        .post("/crm/pipeline-stages")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({ label: `Temp Stage ${randomUUID().slice(0, 6)}` })
        .expect(201);
      const stage = (createStageRes.body as { data: { id: number } }).data;

      const oppRes = await request(app.getHttpServer())
        .post("/crm/opportunities")
        .set("Authorization", `Bearer ${tokenAll}`)
        .send({
          accountId: accountA.id,
          title: "Occupant",
          ownerName: "Rep A",
          stageId: stage.id,
          estimatedValue: 100,
        })
        .expect(201);
      const opp = (oppRes.body as { data: { id: number } }).data;

      await request(app.getHttpServer())
        .delete(`/crm/pipeline-stages/${stage.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(422);

      await request(app.getHttpServer())
        .delete(`/crm/opportunities/${opp.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/crm/pipeline-stages/${stage.id}`)
        .set("Authorization", `Bearer ${tokenAll}`)
        .expect(204);
    });
  });
});
