/**
 * Pipeline Anti-Alucinação — Estágio 2: Interpretação
 *
 * Responsável por interpretar os fatos extraídos no Estágio 1,
 * usando RAG context da base de conhecimento para gerar análises
 * fundamentadas e rastreáveis.
 *
 * Cada conclusão DEVE referenciar os fatos do Estágio 1.
 */
import { invokeAI } from "../invokeAI";
import { getRAGContext } from "../../rag/retriever";
import { createLogger } from "../../lib/logger";
import type { ExtractedClinicalFacts, ExtractedBehavioralFacts } from "./extractionStage";

const log = createLogger("pipeline:interpretation");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface InterpretClinicalInput {
  consultationId: number;
  facts: ExtractedClinicalFacts;
  transcript: string;
}

export interface InterpretBehavioralInput {
  consultationId: number;
  facts: ExtractedBehavioralFacts;
  transcript: string;
  patientId?: number | null;
}

// --------------------------------------------------------------------------
// Prompts
// --------------------------------------------------------------------------

function buildClinicalInterpretationPrompt(facts: ExtractedClinicalFacts, ragContext: string): string {
  return `CONTEXTO DE METODOLOGIA (base de conhecimento):
${ragContext || "Nenhum contexto adicional disponível."}

--- FIM DO CONTEXTO ---

FATOS CLÍNICOS EXTRAÍDOS (Estágio 1 — fonte de verdade):
${JSON.stringify(facts, null, 2)}

--- FIM DOS FATOS ---

INSTRUÇÕES:
Você é um assistente de documentação odontológica. Com base EXCLUSIVAMENTE nos fatos extraídos acima, gere a nota SOAP estruturada.

REGRAS:
1. Use APENAS os fatos fornecidos — NÃO acesse a transcrição original diretamente.
2. Se um campo não tem fatos correspondentes, use string vazia ou array vazio.
3. Para diagnósticos não confirmados, prefixe com "Hipótese:".
4. Para classificação de dentes, use APENAS os dentes listados em "dentesReferenciados". Todos os demais são "not_evaluated".
5. Para urgência: "high" se há sinaisAlerta, "medium" se há tratamentos urgentes, "low" caso contrário.
6. Para patientProfile: NÃO gere aqui — será gerado pelo pipeline comportamental separadamente.
7. Nomenclatura FDI obrigatória para dentes.

IMPORTANTE: Cada campo preenchido deve ter correspondência direta com os fatos extraídos. Se não há fato, não preencha.`;
}

function buildBehavioralInterpretationPrompt(
  facts: ExtractedBehavioralFacts,
  ragContext: string,
  patientId: number | null | undefined
): string {
  return `CONTEXTO DE METODOLOGIA (base de conhecimento):
${ragContext || "Nenhum contexto adicional disponível."}

--- FIM DO CONTEXTO ---

FATOS COMPORTAMENTAIS EXTRAÍDOS (Estágio 1 — fonte de verdade):
${JSON.stringify(facts, null, 2)}

--- FIM DOS FATOS ---

CONTEXTO:
- Paciente: ${patientId ? "ID " + patientId : "Não identificado"}
- Palavras do paciente: ~${facts.metadados.palavrasPaciente}
- Turnos do paciente: ${facts.dinamicaConversa.turnosPaciente}

INSTRUÇÕES:
Você é um especialista em análise comportamental e neurovendas odontológicas. Com base EXCLUSIVAMENTE nos fatos comportamentais extraídos acima E no contexto de metodologia, gere a análise completa.

REGRAS:
1. Use APENAS os fatos fornecidos — NÃO acesse a transcrição original diretamente.
2. Cada conclusão deve ter base nos fatos extraídos. Se não há fato que suporte, não afirme.
3. Para DISC: baseie-se nas falasPaciente, perguntasPaciente, objecoesPaciente e expressoesEmocionais.
4. Para objeções: use APENAS as objeções listadas em "objecoesPaciente" — não invente novas.
5. Para rapport: baseie-se nos indicadoresRapport e dinamicaConversa.
6. Para gatilhos mentais: justifique cada um com referência a um fato extraído.
7. Se há menos de 5 falas do paciente, indique "Análise de baixa confiança" e use confiança <= 35.
8. sinaisDetectados do DISC devem ser citações DIRETAS das falasPaciente.

IMPORTANTE: Você interpreta fatos, não inventa. Se os fatos são insuficientes, reduza confiança — não complete com suposições.`;
}

// --------------------------------------------------------------------------
// Interpretation Functions
// --------------------------------------------------------------------------

const SOAP_INTERPRETATION_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "soap_interpretation",
    strict: true,
    schema: {
      type: "object",
      properties: {
        urgency: { type: "string", enum: ["high", "medium", "low"] },
        subjective: {
          type: "object",
          properties: {
            queixa_principal: { type: "string" },
            historia_doenca_atual: { type: "string" },
            historico_medico: { type: "array", items: { type: "string" } },
            medicacoes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  dose: { type: "string" },
                  frequencia: { type: "string" },
                },
                required: ["nome", "dose", "frequencia"],
                additionalProperties: false,
              },
            },
          },
          required: ["queixa_principal", "historia_doenca_atual", "historico_medico", "medicacoes"],
          additionalProperties: false,
        },
        objective: {
          type: "object",
          properties: {
            exame_clinico_geral: { type: "string" },
            exame_clinico_especifico: { type: "array", items: { type: "string" } },
            dentes_afetados: { type: "array", items: { type: "string" } },
            classificacoes_dentes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  numero: { type: "string" },
                  classificacao: {
                    type: "string",
                    enum: ["not_evaluated", "healthy", "cavity", "restored", "missing", "fractured", "root_canal", "crown", "extraction"],
                  },
                  notas: { type: "string" },
                },
                required: ["numero", "classificacao", "notas"],
                additionalProperties: false,
              },
            },
          },
          required: ["exame_clinico_geral", "exame_clinico_especifico", "dentes_afetados", "classificacoes_dentes"],
          additionalProperties: false,
        },
        assessment: {
          type: "object",
          properties: {
            diagnosticos: { type: "array", items: { type: "string" } },
            red_flags: { type: "array", items: { type: "string" } },
          },
          required: ["diagnosticos", "red_flags"],
          additionalProperties: false,
        },
        plan: {
          type: "object",
          properties: {
            tratamentos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  procedimento: { type: "string" },
                  dente: { type: "string" },
                  urgencia: { type: "string", enum: ["baixa", "media", "alta"] },
                  prazo: { type: "string" },
                },
                required: ["procedimento", "dente", "urgencia", "prazo"],
                additionalProperties: false,
              },
            },
            orientacoes: { type: "array", items: { type: "string" } },
            lembretes_clinicos: { type: "array", items: { type: "string" } },
          },
          required: ["tratamentos", "orientacoes", "lembretes_clinicos"],
          additionalProperties: false,
        },
      },
      required: ["urgency", "subjective", "objective", "assessment", "plan"],
      additionalProperties: false,
    },
  },
};

const NEUROVENDAS_INTERPRETATION_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "neurovendas_interpretation",
    strict: true,
    schema: {
      type: "object",
      properties: {
        perfilPsicografico: {
          type: "object",
          properties: {
            discProfile: {
              type: "object",
              properties: {
                perfilPrimario: { type: "string", enum: ["dominancia", "influencia", "estabilidade", "conformidade"] },
                perfilSecundario: { type: ["string", "null"], enum: ["dominancia", "influencia", "estabilidade", "conformidade", null] },
                confianca: { type: "number" },
                resumo: { type: "string" },
                sinaisDetectados: { type: "array", items: { type: "string" } },
                motivadores: { type: "array", items: { type: "string" } },
                medosOuResistencias: { type: "array", items: { type: "string" } },
                comoComunicar: { type: "array", items: { type: "string" } },
                oQueEvitar: { type: "array", items: { type: "string" } },
                fraseRecomendada: { type: "string" },
                justificativaTecnica: { type: "string" },
              },
              required: ["perfilPrimario", "perfilSecundario", "confianca", "resumo", "sinaisDetectados", "motivadores", "medosOuResistencias", "comoComunicar", "oQueEvitar", "fraseRecomendada", "justificativaTecnica"],
              additionalProperties: false,
            },
            nivelCerebralDominante: { type: "string", enum: ["neocortex", "limbico", "reptiliano"] },
            motivacaoPrimaria: { type: "string", enum: ["alivio_dor", "estetica", "status", "saude"] },
            nivelAnsiedade: { type: "number" },
            nivelReceptividade: { type: "number" },
            descricaoPerfil: { type: "string" },
          },
          required: ["discProfile", "nivelCerebralDominante", "motivacaoPrimaria", "nivelAnsiedade", "nivelReceptividade", "descricaoPerfil"],
          additionalProperties: false,
        },
        objecoes: {
          type: "object",
          properties: {
            verdadeiras: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  texto: { type: "string" },
                  categoria: { type: "string", enum: ["financeira", "medo", "tempo", "confianca", "outra"] },
                  tecnicaSugerida: { type: "string" },
                },
                required: ["texto", "categoria", "tecnicaSugerida"],
                additionalProperties: false,
              },
            },
            ocultas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  texto: { type: "string" },
                  sinaisDetectados: { type: "string" },
                  perguntaReveladora: { type: "string" },
                },
                required: ["texto", "sinaisDetectados", "perguntaReveladora"],
                additionalProperties: false,
              },
            },
          },
          required: ["verdadeiras", "ocultas"],
          additionalProperties: false,
        },
        sinaisLinguagem: {
          type: "object",
          properties: {
            positivos: { type: "array", items: { type: "string" } },
            negativos: { type: "array", items: { type: "string" } },
            palavrasChaveEmocionais: { type: "array", items: { type: "string" } },
          },
          required: ["positivos", "negativos", "palavrasChaveEmocionais"],
          additionalProperties: false,
        },
        gatilhosMentais: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nome: { type: "string", enum: ["transformacao", "saude_longevidade", "status", "conforto", "exclusividade"] },
              justificativa: { type: "string" },
              exemploFrase: { type: "string" },
            },
            required: ["nome", "justificativa", "exemploFrase"],
            additionalProperties: false,
          },
        },
        scriptPARE: {
          type: "object",
          properties: {
            problema: { type: "string" },
            amplificacao: { type: "string" },
            resolucao: { type: "string" },
            engajamento: { type: "string" },
          },
          required: ["problema", "amplificacao", "resolucao", "engajamento"],
          additionalProperties: false,
        },
        tecnicaObjecao: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["LAER", "redirecionamento"] },
            passos: { type: "array", items: { type: "string" } },
          },
          required: ["tipo", "passos"],
          additionalProperties: false,
        },
        rapport: {
          type: "object",
          properties: {
            nivel: { type: "number" },
            breakdown: {
              type: "object",
              properties: {
                validacaoEmocional: { type: "number" },
                espelhamentoLinguistico: { type: "number" },
                escutaAtiva: { type: "number" },
                equilibrioTurnos: { type: "number" },
                ausenciaInterrupcoes: { type: "number" },
              },
              required: ["validacaoEmocional", "espelhamentoLinguistico", "escutaAtiva", "equilibrioTurnos", "ausenciaInterrupcoes"],
              additionalProperties: false,
            },
            justificativa: { type: "string" },
            melhoria: { type: "string" },
            pontosFortesRelacionamento: { type: "array", items: { type: "string" } },
            acoesParaMelhorar: { type: "array", items: { type: "string" } },
          },
          required: ["nivel", "breakdown", "justificativa", "melhoria", "pontosFortesRelacionamento", "acoesParaMelhorar"],
          additionalProperties: false,
        },
        resumoExecutivo: { type: "string" },
      },
      required: ["perfilPsicografico", "objecoes", "sinaisLinguagem", "gatilhosMentais", "scriptPARE", "tecnicaObjecao", "rapport", "resumoExecutivo"],
      additionalProperties: false,
    },
  },
};

// --------------------------------------------------------------------------
// Interpretation Functions
// --------------------------------------------------------------------------

/**
 * Interpret extracted clinical facts into a structured SOAP note.
 * Stage 2 of the anti-hallucination pipeline.
 */
export async function interpretClinicalFacts(input: InterpretClinicalInput): Promise<Record<string, unknown> | null> {
  const { consultationId, facts } = input;

  log.info("Starting clinical interpretation", { consultationId });

  // Retrieve RAG context for SOAP methodology
  const ragContext = await getRAGContext({ query: "soap nota clínica odontológica documentação", category: "soap" });

  const response = await invokeAI("soap", {
    messages: [
      {
        role: "system",
        content: `Você é um assistente de documentação odontológica brasileira. Gere notas SOAP estruturadas com base EXCLUSIVAMENTE nos fatos extraídos fornecidos. NÃO invente dados. Se um campo não tem fatos correspondentes, use string vazia ou array vazio. Nomenclatura FDI obrigatória.`,
      },
      {
        role: "user",
        content: buildClinicalInterpretationPrompt(facts, ragContext),
      },
    ],
    temperature: 0,
    seed: 42,
    response_format: SOAP_INTERPRETATION_SCHEMA,
  }, { consultationId });

  if (!response.success) {
    log.error("Clinical interpretation failed", { consultationId, error: response.error });
    return null;
  }

  const content = response.response.choices[0]?.message?.content;
  if (!content) {
    log.error("Empty response from clinical interpretation", { consultationId });
    return null;
  }

  try {
    return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch {
    log.error("Invalid JSON from clinical interpretation", { consultationId });
    return null;
  }
}

/**
 * Interpret extracted behavioral facts into a neurovendas analysis.
 * Stage 2 of the anti-hallucination pipeline.
 */
export async function interpretBehavioralFacts(input: InterpretBehavioralInput): Promise<Record<string, unknown> | null> {
  const { consultationId, facts, patientId } = input;

  log.info("Starting behavioral interpretation", { consultationId });

  // Retrieve RAG context for neurovendas methodology
  const ragContext = await getRAGContext({
    query: "neurovendas DISC perfil comportamental objeções rapport gatilhos mentais",
    category: "neurovendas",
  });

  const response = await invokeAI("neurovendas_consultation", {
    messages: [
      {
        role: "system",
        content: `Você é um especialista em análise comportamental e neurovendas odontológicas. Interprete os fatos comportamentais extraídos usando a metodologia fornecida. Cada conclusão deve ter base nos fatos. Se os fatos são insuficientes, reduza confiança — não complete com suposições.`,
      },
      {
        role: "user",
        content: buildBehavioralInterpretationPrompt(facts, ragContext, patientId),
      },
    ],
    temperature: 0.2,
    response_format: NEUROVENDAS_INTERPRETATION_SCHEMA,
  }, { consultationId });

  if (!response.success) {
    log.error("Behavioral interpretation failed", { consultationId, error: response.error });
    return null;
  }

  const content = response.response.choices[0]?.message?.content;
  if (!content) {
    log.error("Empty response from behavioral interpretation", { consultationId });
    return null;
  }

  try {
    return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch {
    log.error("Invalid JSON from behavioral interpretation", { consultationId });
    return null;
  }
}
