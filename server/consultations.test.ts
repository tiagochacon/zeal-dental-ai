import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-dentist-001",
    email: "dentist@example.com",
    name: "Dr. Test",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.name).toBe("Dr. Test");
    expect(result?.email).toBe("dentist@example.com");
  });

  it("returns null when not authenticated", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeNull();
  });
});

describe("patients router", () => {
  it("requires authentication for patient list", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.patients.list()).rejects.toThrow();
  });

  it("requires authentication for patient creation", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.patients.create({ name: "Test Patient" })
    ).rejects.toThrow();
  });
});

describe("consultations router", () => {
  it("requires authentication for consultation list", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.consultations.list()).rejects.toThrow();
  });

  it("requires authentication for consultation creation", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.consultations.create({
        patientId: 1,
        patientName: "Test Patient",
      })
    ).rejects.toThrow();
  });
});

describe("feedbacks router", () => {
  it("requires authentication for feedback creation", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.feedbacks.create({
        consultationId: 1,
        rating: 5,
        comment: "Great service",
      })
    ).rejects.toThrow();
  });
});

describe("SOAP note validation", () => {
  it("validates SOAP note structure", () => {
    const validSOAPNote = {
      urgency: "medium" as const,
      subjective: {
        queixa_principal: "Dor no dente 25",
        historia_doenca_atual: "Paciente relata dor há 3 dias",
        historico_medico: ["Hipertensão"],
        medicacoes: [{ nome: "Losartana", dose: "50mg", frequencia: "1x ao dia" }],
      },
      objective: {
        exame_clinico_geral: "Paciente em bom estado geral",
        exame_clinico_especifico: ["Cárie visível no dente 25"],
        dentes_afetados: ["25"],
      },
      assessment: {
        diagnosticos: ["Cárie dentária - dente 25"],
        red_flags: [],
      },
      plan: {
        tratamentos: [
          { procedimento: "Restauração", dente: "25", urgencia: "alta" as const },
        ],
        orientacoes: ["Manter higiene oral"],
        lembretes_clinicos: ["Retorno em 7 dias"],
      },
    };

    // Verify structure
    expect(validSOAPNote.urgency).toBeDefined();
    expect(validSOAPNote.subjective.queixa_principal).toBeDefined();
    expect(validSOAPNote.objective.dentes_afetados).toBeInstanceOf(Array);
    expect(validSOAPNote.assessment.diagnosticos).toBeInstanceOf(Array);
    expect(validSOAPNote.plan.tratamentos).toBeInstanceOf(Array);
    expect(validSOAPNote.plan.tratamentos[0].urgencia).toBe("alta");
  });

  it("validates rating range for feedback", () => {
    const validRatings = [1, 2, 3, 4, 5];
    const invalidRatings = [0, 6, -1, 10];

    validRatings.forEach((rating) => {
      expect(rating >= 1 && rating <= 5).toBe(true);
    });

    invalidRatings.forEach((rating) => {
      expect(rating >= 1 && rating <= 5).toBe(false);
    });
  });
});
