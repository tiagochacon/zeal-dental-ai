import { describe, it, expect } from 'vitest';

describe('Rapport Algorithm with Neuroscience Criteria', () => {
  describe('Breakdown Weights Validation', () => {
    const weights = {
      validacaoEmocional: 30,
      espelhamentoLinguistico: 25,
      escutaAtiva: 20,
      equilibrioTurnos: 15,
      ausenciaInterrupcoes: 10,
    };

    it('should have weights that sum to 100', () => {
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
    });

    it('should have validacaoEmocional as highest weight (30)', () => {
      expect(weights.validacaoEmocional).toBe(30);
      expect(weights.validacaoEmocional).toBeGreaterThan(weights.espelhamentoLinguistico);
    });

    it('should have correct weight hierarchy', () => {
      expect(weights.validacaoEmocional).toBeGreaterThan(weights.espelhamentoLinguistico);
      expect(weights.espelhamentoLinguistico).toBeGreaterThan(weights.escutaAtiva);
      expect(weights.escutaAtiva).toBeGreaterThan(weights.equilibrioTurnos);
      expect(weights.equilibrioTurnos).toBeGreaterThan(weights.ausenciaInterrupcoes);
    });
  });

  describe('Rapport Score Calculation', () => {
    function calculateRapport(breakdown: {
      validacaoEmocional: number;
      espelhamentoLinguistico: number;
      escutaAtiva: number;
      equilibrioTurnos: number;
      ausenciaInterrupcoes: number;
    }) {
      return (
        breakdown.validacaoEmocional +
        breakdown.espelhamentoLinguistico +
        breakdown.escutaAtiva +
        breakdown.equilibrioTurnos +
        breakdown.ausenciaInterrupcoes
      );
    }

    it('should calculate perfect score as 100', () => {
      const perfectBreakdown = {
        validacaoEmocional: 30,
        espelhamentoLinguistico: 25,
        escutaAtiva: 20,
        equilibrioTurnos: 15,
        ausenciaInterrupcoes: 10,
      };
      expect(calculateRapport(perfectBreakdown)).toBe(100);
    });

    it('should calculate low score when dentist dominates conversation', () => {
      // Scenario: Dentist talks too much, poor turn balance
      const dominatingBreakdown = {
        validacaoEmocional: 10, // Some validation
        espelhamentoLinguistico: 15, // Moderate mirroring
        escutaAtiva: 5, // Poor active listening
        equilibrioTurnos: 3, // Very poor - patient talks <20%
        ausenciaInterrupcoes: 2, // Many interruptions
      };
      const score = calculateRapport(dominatingBreakdown);
      expect(score).toBeLessThan(50);
      expect(score).toBe(35);
    });

    it('should calculate high score when dentist validates emotions', () => {
      // Scenario: Excellent emotional validation
      const validatingBreakdown = {
        validacaoEmocional: 28, // Excellent validation
        espelhamentoLinguistico: 20, // Good mirroring
        escutaAtiva: 18, // Good active listening
        equilibrioTurnos: 12, // Good balance
        ausenciaInterrupcoes: 8, // Few interruptions
      };
      const score = calculateRapport(validatingBreakdown);
      expect(score).toBeGreaterThan(70);
      expect(score).toBe(86);
    });

    it('should penalize poor turn balance', () => {
      const goodBalance = { equilibrioTurnos: 15 }; // 30-50% patient talk
      const poorBalance = { equilibrioTurnos: 5 };  // <20% or >70% patient talk
      
      expect(goodBalance.equilibrioTurnos).toBe(15);
      expect(poorBalance.equilibrioTurnos).toBe(5);
      expect(goodBalance.equilibrioTurnos - poorBalance.equilibrioTurnos).toBe(10);
    });
  });

  describe('Profile-based Adjustments', () => {
    function applyProfileAdjustment(
      baseScore: number,
      profile: 'reptiliano' | 'limbico' | 'neocortex',
      factors: { mentionsSecurity?: boolean; pressuresDecision?: boolean; usesStories?: boolean; focusOnData?: boolean; presentsEvidence?: boolean; appealsToEmotion?: boolean }
    ): number {
      let adjustment = 0;

      if (profile === 'reptiliano') {
        if (factors.mentionsSecurity) adjustment += 10;
        if (factors.pressuresDecision) adjustment -= 15;
      } else if (profile === 'limbico') {
        if (factors.usesStories) adjustment += 15;
        if (factors.focusOnData) adjustment -= 10;
      } else if (profile === 'neocortex') {
        if (factors.presentsEvidence) adjustment += 10;
        if (factors.appealsToEmotion) adjustment -= 10;
      }

      return Math.max(0, Math.min(100, baseScore + adjustment));
    }

    it('should boost Reptiliano score when mentioning security', () => {
      const baseScore = 70;
      const adjusted = applyProfileAdjustment(baseScore, 'reptiliano', { mentionsSecurity: true });
      expect(adjusted).toBe(80);
    });

    it('should penalize Reptiliano score when pressuring decision', () => {
      const baseScore = 70;
      const adjusted = applyProfileAdjustment(baseScore, 'reptiliano', { pressuresDecision: true });
      expect(adjusted).toBe(55);
    });

    it('should boost Limbico score when using stories', () => {
      const baseScore = 70;
      const adjusted = applyProfileAdjustment(baseScore, 'limbico', { usesStories: true });
      expect(adjusted).toBe(85);
    });

    it('should penalize Limbico score when focusing only on data', () => {
      const baseScore = 70;
      const adjusted = applyProfileAdjustment(baseScore, 'limbico', { focusOnData: true });
      expect(adjusted).toBe(60);
    });

    it('should boost Neocortex score when presenting evidence', () => {
      const baseScore = 70;
      const adjusted = applyProfileAdjustment(baseScore, 'neocortex', { presentsEvidence: true });
      expect(adjusted).toBe(80);
    });

    it('should penalize Neocortex score when appealing only to emotion', () => {
      const baseScore = 70;
      const adjusted = applyProfileAdjustment(baseScore, 'neocortex', { appealsToEmotion: true });
      expect(adjusted).toBe(60);
    });

    it('should cap score at 100', () => {
      const baseScore = 95;
      const adjusted = applyProfileAdjustment(baseScore, 'limbico', { usesStories: true });
      expect(adjusted).toBe(100);
    });

    it('should floor score at 0', () => {
      const baseScore = 10;
      const adjusted = applyProfileAdjustment(baseScore, 'reptiliano', { pressuresDecision: true });
      expect(adjusted).toBe(0);
    });
  });

  describe('Breakdown Structure Validation', () => {
    it('should have all required breakdown fields', () => {
      const breakdown = {
        validacaoEmocional: 25,
        espelhamentoLinguistico: 20,
        escutaAtiva: 15,
        equilibrioTurnos: 10,
        ausenciaInterrupcoes: 8,
      };

      expect(breakdown).toHaveProperty('validacaoEmocional');
      expect(breakdown).toHaveProperty('espelhamentoLinguistico');
      expect(breakdown).toHaveProperty('escutaAtiva');
      expect(breakdown).toHaveProperty('equilibrioTurnos');
      expect(breakdown).toHaveProperty('ausenciaInterrupcoes');
    });

    it('should validate breakdown values are within bounds', () => {
      const breakdown = {
        validacaoEmocional: 25,
        espelhamentoLinguistico: 20,
        escutaAtiva: 15,
        equilibrioTurnos: 10,
        ausenciaInterrupcoes: 8,
      };

      expect(breakdown.validacaoEmocional).toBeGreaterThanOrEqual(0);
      expect(breakdown.validacaoEmocional).toBeLessThanOrEqual(30);
      
      expect(breakdown.espelhamentoLinguistico).toBeGreaterThanOrEqual(0);
      expect(breakdown.espelhamentoLinguistico).toBeLessThanOrEqual(25);
      
      expect(breakdown.escutaAtiva).toBeGreaterThanOrEqual(0);
      expect(breakdown.escutaAtiva).toBeLessThanOrEqual(20);
      
      expect(breakdown.equilibrioTurnos).toBeGreaterThanOrEqual(0);
      expect(breakdown.equilibrioTurnos).toBeLessThanOrEqual(15);
      
      expect(breakdown.ausenciaInterrupcoes).toBeGreaterThanOrEqual(0);
      expect(breakdown.ausenciaInterrupcoes).toBeLessThanOrEqual(10);
    });
  });

  describe('Rapport Output Format', () => {
    it('should have correct output structure', () => {
      const rapportOutput = {
        nivel: 75,
        breakdown: {
          validacaoEmocional: 25,
          espelhamentoLinguistico: 20,
          escutaAtiva: 15,
          equilibrioTurnos: 10,
          ausenciaInterrupcoes: 5,
        },
        justificativa: 'Rapport elevado devido à validação emocional consistente.',
        melhoria: 'Aumentar tempo de escuta - paciente falou apenas 22% do tempo.',
        pontosFortesRelacionamento: ['Validação emocional', 'Espelhamento'],
        acoesParaMelhorar: ['Permitir mais tempo de fala ao paciente'],
      };

      expect(rapportOutput.nivel).toBe(75);
      expect(rapportOutput.breakdown).toBeDefined();
      expect(rapportOutput.justificativa).toBeDefined();
      expect(rapportOutput.melhoria).toBeDefined();
      expect(Array.isArray(rapportOutput.pontosFortesRelacionamento)).toBe(true);
      expect(Array.isArray(rapportOutput.acoesParaMelhorar)).toBe(true);
    });

    it('should have breakdown sum equal to nivel', () => {
      const rapportOutput = {
        nivel: 75,
        breakdown: {
          validacaoEmocional: 25,
          espelhamentoLinguistico: 20,
          escutaAtiva: 15,
          equilibrioTurnos: 10,
          ausenciaInterrupcoes: 5,
        },
      };

      const breakdownSum = Object.values(rapportOutput.breakdown).reduce((a, b) => a + b, 0);
      expect(breakdownSum).toBe(rapportOutput.nivel);
    });
  });
});
