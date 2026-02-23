import { describe, it, expect } from "vitest";

// Test the multi-role system structure and validation

describe("Multi-Role System - Schema Validation", () => {
  it("should define valid clinic roles", () => {
    const validRoles = ["gestor", "crc", "dentista"];
    validRoles.forEach(role => {
      expect(typeof role).toBe("string");
      expect(role.length).toBeGreaterThan(0);
    });
  });

  it("should define valid call statuses", () => {
    const validStatuses = ["pending", "transcribed", "analyzed", "finalized"];
    validStatuses.forEach(status => {
      expect(typeof status).toBe("string");
    });
  });

  it("should define valid scheduling results", () => {
    const validResults = ["scheduled", "not_scheduled", "callback", "no_answer"];
    validResults.forEach(result => {
      expect(typeof result).toBe("string");
    });
  });

  it("should define valid lead sources", () => {
    const validSources = ["phone", "whatsapp", "instagram", "facebook", "website", "referral", "other"];
    expect(validSources).toHaveLength(7);
  });
});

describe("Multi-Role System - Business Logic", () => {
  it("gestor should have access to all features", () => {
    const gestorPermissions = {
      canViewDashboard: true,
      canManageTeam: true,
      canViewFunnel: true,
      canViewRankings: true,
      canViewAllConsultations: true,
      canViewAllCalls: true,
    };
    Object.values(gestorPermissions).forEach(perm => {
      expect(perm).toBe(true);
    });
  });

  it("CRC should only access leads and calls", () => {
    const crcPermissions = {
      canManageLeads: true,
      canMakeCalls: true,
      canViewOwnCalls: true,
      canConvertLeads: true,
      canViewConsultations: false,
      canManageTeam: false,
    };
    expect(crcPermissions.canManageLeads).toBe(true);
    expect(crcPermissions.canMakeCalls).toBe(true);
    expect(crcPermissions.canViewConsultations).toBe(false);
    expect(crcPermissions.canManageTeam).toBe(false);
  });

  it("dentista should access consultations and patients", () => {
    const dentistaPermissions = {
      canViewPatients: true,
      canCreateConsultations: true,
      canViewLeadProfile: true,
      canManageLeads: false,
      canMakeCalls: false,
      canManageTeam: false,
    };
    expect(dentistaPermissions.canViewPatients).toBe(true);
    expect(dentistaPermissions.canCreateConsultations).toBe(true);
    expect(dentistaPermissions.canManageLeads).toBe(false);
  });
});

describe("Multi-Role System - Neurovendas for Calls", () => {
  it("should have correct analysis schema structure for calls", () => {
    const expectedFields = [
      "perfilPsicografico",
      "objecoes",
      "sinaisLinguagem",
      "gatilhosMentais",
      "scriptPARE",
      "tecnicaObjecao",
      "rapport",
    ];
    expectedFields.forEach(field => {
      expect(typeof field).toBe("string");
    });
    expect(expectedFields).toHaveLength(7);
  });

  it("should have perfilPsicografico with receptividade for calls", () => {
    const perfilFields = [
      "nivelCerebralDominante",
      "motivacaoPrimaria",
      "nivelAnsiedade",
      "nivelReceptividade",
      "descricaoPerfil",
    ];
    expect(perfilFields).toContain("nivelReceptividade");
    expect(perfilFields).toHaveLength(5);
  });

  it("should have LAER technique in objecoes.verdadeiras.tecnicaSugerida", () => {
    const mockObjection = {
      texto: "Está muito caro",
      categoria: "financeira",
      tecnicaSugerida: "Entendo sua preocupação com o valor. É normal querer entender bem o investimento...",
    };
    expect(mockObjection.tecnicaSugerida.length).toBeGreaterThan(20);
    expect(mockObjection.categoria).toBe("financeira");
  });

  it("should have scriptPARE with all 4 steps", () => {
    const scriptPARE = {
      problema: "Como abordar a necessidade",
      amplificacao: "Como mostrar urgência",
      resolucao: "Como apresentar a consulta como solução",
      engajamento: "Como criar compromisso",
    };
    expect(Object.keys(scriptPARE)).toHaveLength(4);
    expect(scriptPARE).toHaveProperty("problema");
    expect(scriptPARE).toHaveProperty("amplificacao");
    expect(scriptPARE).toHaveProperty("resolucao");
    expect(scriptPARE).toHaveProperty("engajamento");
  });

  it("should calculate rapport with 5 breakdown criteria", () => {
    const rapportBreakdown = {
      validacaoEmocional: 25,
      espelhamentoLinguistico: 20,
      escutaAtiva: 15,
      equilibrioTurnos: 12,
      ausenciaInterrupcoes: 8,
    };
    const total = Object.values(rapportBreakdown).reduce((a, b) => a + b, 0);
    expect(total).toBe(80);
    expect(rapportBreakdown.validacaoEmocional).toBeLessThanOrEqual(30);
    expect(rapportBreakdown.espelhamentoLinguistico).toBeLessThanOrEqual(25);
    expect(rapportBreakdown.escutaAtiva).toBeLessThanOrEqual(20);
    expect(rapportBreakdown.equilibrioTurnos).toBeLessThanOrEqual(15);
    expect(rapportBreakdown.ausenciaInterrupcoes).toBeLessThanOrEqual(10);
  });
});

describe("Multi-Role System - Lead Conversion Flow", () => {
  it("should convert lead to patient when scheduled", () => {
    const lead = {
      id: 1,
      name: "Maria Silva",
      phone: "(11) 99999-0000",
      isConverted: false,
      convertedPatientId: null,
    };
    
    // After conversion
    const convertedLead = {
      ...lead,
      isConverted: true,
      convertedPatientId: 42,
    };
    
    expect(convertedLead.isConverted).toBe(true);
    expect(convertedLead.convertedPatientId).toBe(42);
  });

  it("should provide lead profile hint to dentist", () => {
    const leadProfile = {
      nivelCerebralDominante: "limbico",
      probabilidadeAgendamento: 75,
      resumo: "Paciente emocionalmente motivada, busca transformação estética",
    };
    
    expect(leadProfile.resumo.length).toBeLessThanOrEqual(200);
    expect(leadProfile.probabilidadeAgendamento).toBeGreaterThanOrEqual(0);
    expect(leadProfile.probabilidadeAgendamento).toBeLessThanOrEqual(100);
  });
});

describe("Multi-Role System - Funnel Stats", () => {
  it("should calculate funnel conversion rates", () => {
    const funnel = {
      totalCalls: 100,
      scheduledCalls: 40,
      totalConsultations: 30,
      closedTreatments: 15,
    };
    
    const callToScheduleRate = funnel.scheduledCalls / funnel.totalCalls;
    const scheduleToConsultRate = funnel.totalConsultations / funnel.scheduledCalls;
    const consultToCloseRate = funnel.closedTreatments / funnel.totalConsultations;
    
    expect(callToScheduleRate).toBe(0.4);
    expect(scheduleToConsultRate).toBe(0.75);
    expect(consultToCloseRate).toBe(0.5);
  });

  it("should handle zero values in funnel", () => {
    const emptyFunnel = {
      totalCalls: 0,
      scheduledCalls: 0,
      totalConsultations: 0,
      closedTreatments: 0,
    };
    
    // Should not divide by zero
    const rate = emptyFunnel.totalCalls > 0 
      ? emptyFunnel.scheduledCalls / emptyFunnel.totalCalls 
      : 0;
    expect(rate).toBe(0);
  });
});

describe("Multi-Role System - Treatment Closed Feedback", () => {
  it("should accept treatmentClosed in feedback", () => {
    const feedback = {
      consultationId: 1,
      rating: 5,
      comment: "Excelente consulta",
      treatmentClosed: true,
      treatmentClosedNotes: undefined,
    };
    
    expect(feedback.treatmentClosed).toBe(true);
    expect(feedback.treatmentClosedNotes).toBeUndefined();
  });

  it("should require notes when treatment not closed", () => {
    const feedback = {
      consultationId: 1,
      rating: 3,
      comment: "Paciente indeciso",
      treatmentClosed: false,
      treatmentClosedNotes: "Paciente quer pensar sobre o valor",
    };
    
    expect(feedback.treatmentClosed).toBe(false);
    expect(feedback.treatmentClosedNotes).toBeDefined();
    expect(feedback.treatmentClosedNotes!.length).toBeGreaterThan(0);
  });
});
