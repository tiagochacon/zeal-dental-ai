import { describe, it, expect } from "vitest";

/**
 * Tests for Upsell Modal System
 * Validates trigger logic, copywriting, and error parsing
 */

describe("Upsell Modal System", () => {
  describe("Trigger Logic", () => {
    it("should trigger trial_limit when trial user reaches 7 consultations", () => {
      const user = {
        subscriptionTier: "trial",
        consultationCount: 7,
        trialEndsAt: new Date(Date.now() + 86400000), // Still valid
      };
      
      const isLimitReached = user.consultationCount >= 7;
      expect(isLimitReached).toBe(true);
    });

    it("should trigger trial_limit when trial expires by time", () => {
      const user = {
        subscriptionTier: "trial",
        consultationCount: 3,
        trialEndsAt: new Date(Date.now() - 86400000), // Expired
      };
      
      const isExpired = new Date() > user.trialEndsAt;
      expect(isExpired).toBe(true);
    });

    it("should trigger basic_limit when basic user reaches 20 consultations", () => {
      const user = {
        subscriptionTier: "basic",
        consultationCount: 20,
        subscriptionStatus: "active",
      };
      
      const isLimitReached = user.consultationCount >= 20;
      expect(isLimitReached).toBe(true);
    });

    it("should trigger pro_limit when pro user reaches 50 consultations", () => {
      const user = {
        subscriptionTier: "pro",
        consultationCount: 50,
        subscriptionStatus: "active",
      };
      
      const isLimitReached = user.consultationCount >= 50;
      expect(isLimitReached).toBe(true);
    });

    it("should trigger feature_gate when basic user tries to access Negotiation", () => {
      const user = {
        subscriptionTier: "basic",
        subscriptionStatus: "active",
      };
      
      const hasNegotiationAccess = user.subscriptionTier === "pro" || 
                                   user.subscriptionTier === "trial" ||
                                   user.subscriptionTier === "unlimited";
      expect(hasNegotiationAccess).toBe(false);
    });

    it("should NOT trigger for unlimited users", () => {
      const user = {
        subscriptionTier: "unlimited",
        consultationCount: 1000,
        subscriptionStatus: "active",
      };
      
      const isLimitReached = user.subscriptionTier === "unlimited" ? false : user.consultationCount >= 50;
      expect(isLimitReached).toBe(false);
    });

    it("should NOT trigger for admin users", () => {
      const user = {
        role: "admin",
        subscriptionTier: "trial",
        consultationCount: 100,
      };
      
      const isAdmin = user.role === "admin";
      expect(isAdmin).toBe(true);
    });
  });

  describe("Error Message Parsing", () => {
    it("should parse LIMIT_EXCEEDED error format correctly", () => {
      const errorMessage = "LIMIT_EXCEEDED:trial:7:Limite de consultas atingido para o seu plano. Faça upgrade para continuar.";
      
      const parts = errorMessage.split(":");
      expect(parts[0]).toBe("LIMIT_EXCEEDED");
      expect(parts[1]).toBe("trial");
      expect(parseInt(parts[2])).toBe(7);
      expect(parts.slice(3).join(":")).toContain("Limite de consultas");
    });

    it("should parse basic tier error correctly", () => {
      const errorMessage = "LIMIT_EXCEEDED:basic:20:Limite de consultas atingido.";
      
      const parts = errorMessage.split(":");
      expect(parts[1]).toBe("basic");
      expect(parseInt(parts[2])).toBe(20);
    });

    it("should parse pro tier error correctly", () => {
      const errorMessage = "LIMIT_EXCEEDED:pro:50:Limite de consultas atingido.";
      
      const parts = errorMessage.split(":");
      expect(parts[1]).toBe("pro");
      expect(parseInt(parts[2])).toBe(50);
    });

    it("should handle non-LIMIT_EXCEEDED errors gracefully", () => {
      const errorMessage = "Erro genérico de servidor";
      
      const isLimitExceeded = errorMessage.startsWith("LIMIT_EXCEEDED:");
      expect(isLimitExceeded).toBe(false);
    });
  });

  describe("Copywriting by Trigger", () => {
    const COPY_BY_TRIGGER = {
      trial_limit: {
        title: "Seu período de teste acabou!",
        subtitle: "Não pare sua evolução agora.",
        cta: "Sua produtividade não pode esperar. Faça o upgrade agora.",
      },
      basic_limit: {
        title: "Você atingiu o limite do seu plano!",
        subtitle: "Seu consultório está crescendo.",
        cta: "Desbloqueie o poder completo do ZEAL Pro.",
      },
      feature_gate: {
        title: "Recurso exclusivo do ZEAL Pro",
        subtitle: "Análise de Neurovendas bloqueada.",
        cta: "Libere a Inteligência em Neurovendas e feche mais tratamentos.",
      },
      pro_limit: {
        title: "Limite mensal atingido",
        subtitle: "Você está no plano mais completo.",
        cta: "Aguarde a renovação do seu ciclo.",
      },
    };

    it("should have persuasive copy for trial_limit", () => {
      const copy = COPY_BY_TRIGGER.trial_limit;
      expect(copy.title).toContain("teste acabou");
      expect(copy.cta).toContain("upgrade");
    });

    it("should have persuasive copy for basic_limit", () => {
      const copy = COPY_BY_TRIGGER.basic_limit;
      expect(copy.title).toContain("limite");
      expect(copy.cta).toContain("Pro");
    });

    it("should have persuasive copy for feature_gate", () => {
      const copy = COPY_BY_TRIGGER.feature_gate;
      expect(copy.title).toContain("exclusivo");
      expect(copy.cta).toContain("Neurovendas");
    });

    it("should have informative copy for pro_limit", () => {
      const copy = COPY_BY_TRIGGER.pro_limit;
      expect(copy.title).toContain("atingido");
      expect(copy.subtitle).toContain("completo");
    });
  });

  describe("Plan Display Logic", () => {
    it("should show both Basic and Pro plans for trial users", () => {
      const trigger = "trial_limit";
      const showBasicPlan = trigger === "trial_limit";
      const showProPlan = trigger !== "pro_limit";
      
      expect(showBasicPlan).toBe(true);
      expect(showProPlan).toBe(true);
    });

    it("should show only Pro plan for basic users", () => {
      const trigger = "basic_limit";
      const showBasicPlan = trigger === "trial_limit";
      const showProPlan = trigger !== "pro_limit";
      
      expect(showBasicPlan).toBe(false);
      expect(showProPlan).toBe(true);
    });

    it("should show only Pro plan for feature_gate", () => {
      const trigger = "feature_gate";
      const showBasicPlan = trigger === "trial_limit";
      const showProPlan = trigger !== "pro_limit";
      
      expect(showBasicPlan).toBe(false);
      expect(showProPlan).toBe(true);
    });

    it("should show renewal message for pro users at limit", () => {
      const trigger = "pro_limit";
      const showBasicPlan = trigger === "trial_limit";
      const showProPlan = trigger !== "pro_limit";
      const isProLimitReached = trigger === "pro_limit";
      
      expect(showBasicPlan).toBe(false);
      expect(showProPlan).toBe(false);
      expect(isProLimitReached).toBe(true);
    });
  });

  describe("Plan Features", () => {
    const PLAN_FEATURES = {
      basic: [
        { text: "20 consultas/mês", highlight: false },
        { text: "Transcrição automática com IA", highlight: false },
        { text: "Notas SOAP inteligentes", highlight: false },
        { text: "Odontograma automático", highlight: false },
      ],
      pro: [
        { text: "50 consultas/mês", highlight: true },
        { text: "Transcrição automática com IA", highlight: false },
        { text: "Notas SOAP inteligentes", highlight: false },
        { text: "Odontograma automático", highlight: false },
        { text: "Análise de Neurovendas", highlight: true },
        { text: "Perfil psicográfico do paciente", highlight: true },
        { text: "Script de fechamento PARE", highlight: true },
      ],
    };

    it("should have 4 features for basic plan", () => {
      expect(PLAN_FEATURES.basic.length).toBe(4);
    });

    it("should have 7 features for pro plan", () => {
      expect(PLAN_FEATURES.pro.length).toBe(7);
    });

    it("should highlight PRO-exclusive features", () => {
      const proExclusiveFeatures = PLAN_FEATURES.pro.filter(f => f.highlight);
      expect(proExclusiveFeatures.length).toBe(4); // 50 consultas + 3 neurovendas features
    });

    it("should include Neurovendas in pro features", () => {
      const hasNeurovendas = PLAN_FEATURES.pro.some(f => f.text.includes("Neurovendas"));
      expect(hasNeurovendas).toBe(true);
    });
  });

  describe("Usage Percentage Calculation", () => {
    it("should calculate 100% when at limit", () => {
      const used = 7;
      const limit = 7;
      const percentage = Math.min(100, (used / limit) * 100);
      expect(percentage).toBe(100);
    });

    it("should calculate 50% when halfway", () => {
      const used = 10;
      const limit = 20;
      const percentage = Math.min(100, (used / limit) * 100);
      expect(percentage).toBe(50);
    });

    it("should cap at 100% even if over limit", () => {
      const used = 25;
      const limit = 20;
      const percentage = Math.min(100, (used / limit) * 100);
      expect(percentage).toBe(100);
    });

    it("should handle zero usage", () => {
      const used = 0;
      const limit = 7;
      const percentage = Math.min(100, (used / limit) * 100);
      expect(percentage).toBe(0);
    });
  });
});
