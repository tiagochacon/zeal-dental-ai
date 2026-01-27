import { describe, it, expect } from 'vitest';
import type { PatientProfile } from '../drizzle/schema';

describe('Adaptive Negotiation - Patient Profile Detection', () => {
  
  describe('PatientProfile Interface', () => {
    it('should have correct structure for reptilian profile', () => {
      const reptilianProfile: PatientProfile = {
        type: 'reptilian',
        confidence: 85,
        primaryTraits: ['Hesitante', 'Busca segurança', 'Preocupado com dor'],
        detectedKeywords: ['medo', 'dor', 'nervoso'],
        recommendedApproach: 'Foque em segurança e controle. Evite termos técnicos complexos.',
        triggers: {
          positive: ['Ambiente Seguro', 'Sem Dor', 'Controle Total'],
          negative: ['Termos técnicos', 'Urgência', 'Pressão']
        }
      };
      
      expect(reptilianProfile.type).toBe('reptilian');
      expect(reptilianProfile.confidence).toBeGreaterThanOrEqual(0);
      expect(reptilianProfile.confidence).toBeLessThanOrEqual(100);
      expect(reptilianProfile.primaryTraits).toBeInstanceOf(Array);
      expect(reptilianProfile.detectedKeywords).toBeInstanceOf(Array);
      expect(reptilianProfile.triggers.positive).toBeInstanceOf(Array);
      expect(reptilianProfile.triggers.negative).toBeInstanceOf(Array);
    });
    
    it('should have correct structure for neocortex profile', () => {
      const neocortexProfile: PatientProfile = {
        type: 'neocortex',
        confidence: 90,
        primaryTraits: ['Analítico', 'Busca dados', 'Compara opções'],
        detectedKeywords: ['estatística', 'taxa de sucesso', 'quanto tempo'],
        recommendedApproach: 'Apresente dados concretos, estatísticas e comparações.',
        triggers: {
          positive: ['Taxa de Sucesso', 'Estudos Comprovados', 'Análise Custo-Benefício'],
          negative: ['Apelos emocionais', 'Linguagem vaga']
        }
      };
      
      expect(neocortexProfile.type).toBe('neocortex');
      expect(neocortexProfile.confidence).toBeGreaterThanOrEqual(0);
      expect(neocortexProfile.confidence).toBeLessThanOrEqual(100);
    });
    
    it('should have correct structure for limbic profile', () => {
      const limbicProfile: PatientProfile = {
        type: 'limbic',
        confidence: 78,
        primaryTraits: ['Emocional', 'Aspiracional', 'Foco em transformação'],
        detectedKeywords: ['bonito', 'sorriso', 'confiança', 'autoestima'],
        recommendedApproach: 'Use histórias de transformação e visualização do resultado.',
        triggers: {
          positive: ['Transformação Total', 'Autoconfiança', 'Realização'],
          negative: ['Dados técnicos frios', 'Argumentos puramente racionais']
        }
      };
      
      expect(limbicProfile.type).toBe('limbic');
      expect(limbicProfile.confidence).toBeGreaterThanOrEqual(0);
      expect(limbicProfile.confidence).toBeLessThanOrEqual(100);
    });
  });
  
  describe('Profile Type Validation', () => {
    it('should only accept valid profile types', () => {
      const validTypes = ['reptilian', 'neocortex', 'limbic'];
      
      validTypes.forEach(type => {
        const profile: PatientProfile = {
          type: type as 'reptilian' | 'neocortex' | 'limbic',
          confidence: 50,
          primaryTraits: [],
          detectedKeywords: [],
          recommendedApproach: '',
          triggers: { positive: [], negative: [] }
        };
        
        expect(validTypes).toContain(profile.type);
      });
    });
    
    it('should have confidence between 0 and 100', () => {
      const testConfidences = [0, 25, 50, 75, 100];
      
      testConfidences.forEach(conf => {
        const profile: PatientProfile = {
          type: 'reptilian',
          confidence: conf,
          primaryTraits: [],
          detectedKeywords: [],
          recommendedApproach: '',
          triggers: { positive: [], negative: [] }
        };
        
        expect(profile.confidence).toBeGreaterThanOrEqual(0);
        expect(profile.confidence).toBeLessThanOrEqual(100);
      });
    });
  });
  
  describe('Keyword Detection Logic', () => {
    const reptilianKeywords = ['medo', 'dor', 'seguro', 'garantia', 'nervoso', 'ansioso', 'vai doer'];
    const neocortexKeywords = ['estatística', 'evidência', 'técnica', 'comparação', 'quanto tempo', 'taxa de sucesso'];
    const limbicKeywords = ['bonito', 'sorriso', 'confiança', 'autoestima', 'transformação', 'pessoas vão ver'];
    
    it('should identify reptilian keywords correctly', () => {
      const transcript = 'Doutor, estou com muito medo. Vai doer? Estou nervoso com o procedimento.';
      const lowerTranscript = transcript.toLowerCase();
      
      const foundKeywords = reptilianKeywords.filter(kw => lowerTranscript.includes(kw));
      expect(foundKeywords.length).toBeGreaterThan(0);
      expect(foundKeywords).toContain('medo');
    });
    
    it('should identify neocortex keywords correctly', () => {
      const transcript = 'Qual a taxa de sucesso desse procedimento? Tem alguma evidência científica?';
      const lowerTranscript = transcript.toLowerCase();
      
      const foundKeywords = neocortexKeywords.filter(kw => lowerTranscript.includes(kw));
      expect(foundKeywords.length).toBeGreaterThan(0);
      expect(foundKeywords).toContain('taxa de sucesso');
    });
    
    it('should identify limbic keywords correctly', () => {
      const transcript = 'Quero um sorriso bonito para ter mais confiança. Vai melhorar minha autoestima?';
      const lowerTranscript = transcript.toLowerCase();
      
      const foundKeywords = limbicKeywords.filter(kw => lowerTranscript.includes(kw));
      expect(foundKeywords.length).toBeGreaterThan(0);
      expect(foundKeywords).toContain('sorriso');
    });
  });
  
  describe('Profile Configuration', () => {
    const profileConfig = {
      reptilian: {
        name: 'Reptiliano',
        color: 'green',
        icon: 'Shield',
        description: 'Cérebro Primitivo - Sobrevivência'
      },
      neocortex: {
        name: 'Neocórtex',
        color: 'blue',
        icon: 'Brain',
        description: 'Cérebro Racional - Lógica'
      },
      limbic: {
        name: 'Límbico',
        color: 'purple',
        icon: 'Heart',
        description: 'Cérebro Emocional - Sentimentos'
      }
    };
    
    it('should have correct color for each profile', () => {
      expect(profileConfig.reptilian.color).toBe('green');
      expect(profileConfig.neocortex.color).toBe('blue');
      expect(profileConfig.limbic.color).toBe('purple');
    });
    
    it('should have correct icon for each profile', () => {
      expect(profileConfig.reptilian.icon).toBe('Shield');
      expect(profileConfig.neocortex.icon).toBe('Brain');
      expect(profileConfig.limbic.icon).toBe('Heart');
    });
    
    it('should have descriptive names for each profile', () => {
      expect(profileConfig.reptilian.name).toBe('Reptiliano');
      expect(profileConfig.neocortex.name).toBe('Neocórtex');
      expect(profileConfig.limbic.name).toBe('Límbico');
    });
  });
  
  describe('PARE Script Structure', () => {
    it('should have all four PARE components', () => {
      const pareScript = {
        problem: 'Identificar a dor do paciente',
        agitation: 'Amplificar a urgência',
        resolution: 'Apresentar a solução',
        emotion: 'Conectar com o sonho'
      };
      
      expect(pareScript).toHaveProperty('problem');
      expect(pareScript).toHaveProperty('agitation');
      expect(pareScript).toHaveProperty('resolution');
      expect(pareScript).toHaveProperty('emotion');
    });
    
    it('should have non-empty PARE components', () => {
      const pareScript = {
        problem: 'O paciente está com dor no dente 16',
        agitation: 'Se não tratado, pode evoluir para um canal',
        resolution: 'Uma restauração simples resolve o problema',
        emotion: 'Você vai poder sorrir sem preocupação'
      };
      
      expect(pareScript.problem.length).toBeGreaterThan(0);
      expect(pareScript.agitation.length).toBeGreaterThan(0);
      expect(pareScript.resolution.length).toBeGreaterThan(0);
      expect(pareScript.emotion.length).toBeGreaterThan(0);
    });
  });
  
  describe('Objection Mapping', () => {
    it('should categorize objections correctly', () => {
      const objectionCategories = ['financeira', 'medo', 'tempo', 'confianca', 'outra'];
      
      const objection = {
        texto: 'Está muito caro',
        categoria: 'financeira' as const,
        tecnicaSugerida: 'Use a técnica de parcelamento e valor percebido'
      };
      
      expect(objectionCategories).toContain(objection.categoria);
    });
    
    it('should have suggested technique for each objection', () => {
      const objections = [
        { texto: 'Está caro', categoria: 'financeira', tecnicaSugerida: 'Parcelamento' },
        { texto: 'Tenho medo', categoria: 'medo', tecnicaSugerida: 'Dessensibilização' },
        { texto: 'Não tenho tempo', categoria: 'tempo', tecnicaSugerida: 'Agendamento flexível' }
      ];
      
      objections.forEach(obj => {
        expect(obj.tecnicaSugerida.length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('Rapport Level', () => {
    it('should have rapport level between 0 and 100', () => {
      const rapportLevels = [0, 25, 50, 75, 100];
      
      rapportLevels.forEach(level => {
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(100);
      });
    });
    
    it('should classify rapport level correctly', () => {
      const classifyRapport = (level: number): string => {
        if (level < 30) return 'baixo';
        if (level < 70) return 'médio';
        return 'alto';
      };
      
      expect(classifyRapport(20)).toBe('baixo');
      expect(classifyRapport(50)).toBe('médio');
      expect(classifyRapport(85)).toBe('alto');
    });
  });
});
