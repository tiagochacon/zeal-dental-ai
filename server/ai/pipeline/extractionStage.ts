/**
 * Pipeline Anti-Alucinação — Estágio 1: Extração
 *
 * Responsável por extrair APENAS fatos puros da transcrição sem interpretação.
 * Temperature = 0, sem RAG context, sem inferências.
 *
 * Output: Structured facts with direct transcript citations.
 */
import { invokeAI } from "../invokeAI";
import { createLogger } from "../../lib/logger";

const log = createLogger("pipeline:extraction");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/** A citation linking a fact to its source in the transcript */
export interface Citation {
  /** The exact or near-exact quote from the transcript */
  trecho: string;
  /** Who said it: 'paciente' or 'dentista' */
  falante: "paciente" | "dentista" | "desconhecido";
}

/** Extracted clinical facts (Stage 1 output for SOAP) */
export interface ExtractedClinicalFacts {
  /** Patient's chief complaint — exact words */
  queixaPrincipal: { texto: string; citacao: Citation } | null;
  /** History of present illness */
  historiaDoencaAtual: { texto: string; citacoes: Citation[] };
  /** Medical history items mentioned */
  historicoMedico: Array<{ item: string; citacao: Citation }>;
  /** Medications mentioned */
  medicacoes: Array<{ nome: string; detalhes: string; citacao: Citation }>;
  /** Clinical findings mentioned by dentist */
  achadosClinicos: Array<{ achado: string; dente?: string; citacao: Citation }>;
  /** Teeth mentioned with their status */
  dentesReferenciados: Array<{ numero: string; contexto: string; citacao: Citation }>;
  /** Diagnoses stated by dentist */
  diagnosticosMencionados: Array<{ diagnostico: string; confirmado: boolean; citacao: Citation }>;
  /** Treatments discussed */
  tratamentosDiscutidos: Array<{ procedimento: string; dente?: string; citacao: Citation }>;
  /** Patient instructions given */
  orientacoesDadas: Array<{ orientacao: string; citacao: Citation }>;
  /** Red flags identified */
  sinaisAlerta: Array<{ sinal: string; citacao: Citation }>;
  /** Transcript quality metrics */
  metadados: {
    totalPalavras: number;
    palavrasPaciente: number;
    palavrasDentista: number;
    qualidadeTranscricao: "boa" | "media" | "ruim";
  };
}

/** Extracted behavioral facts (Stage 1 output for Neurovendas) */
export interface ExtractedBehavioralFacts {
  /** Direct quotes showing patient behavior/personality */
  falasPaciente: Array<{
    texto: string;
    contexto: string;
    indicadorComportamental?: string;
  }>;
  /** Questions asked by the patient */
  perguntasPaciente: Array<{ texto: string; categoria: string }>;
  /** Objections or hesitations expressed */
  objecoesPaciente: Array<{
    texto: string;
    tipo: "financeira" | "medo" | "tempo" | "confianca" | "outra";
  }>;
  /** Emotional expressions detected */
  expressoesEmocionais: Array<{ texto: string; emocao: string }>;
  /** Rapport indicators (dentist behavior) */
  indicadoresRapport: {
    validacoesEmocionais: string[];
    espelhamentos: string[];
    perguntasAbertas: string[];
    interrupcoes: string[];
  };
  /** Turn-taking metrics */
  dinamicaConversa: {
    turnosPaciente: number;
    turnosDentista: number;
    mediaComprimentoTurnoPaciente: number;
    mediaComprimentoTurnoDentista: number;
  };
  /** Transcript quality metrics */
  metadados: {
    totalPalavras: number;
    palavrasPaciente: number;
    palavrasDentista: number;
  };
}

// --------------------------------------------------------------------------
// JSON Schemas for LLM output
// --------------------------------------------------------------------------

const CLINICAL_EXTRACTION_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "clinical_extraction",
    strict: true,
    schema: {
      type: "object",
      properties: {
        queixaPrincipal: {
          type: ["object", "null"],
          properties: {
            texto: { type: "string" },
            citacao: {
              type: "object",
              properties: {
                trecho: { type: "string" },
                falante: { type: "string", enum: ["paciente", "dentista", "desconhecido"] },
              },
              required: ["trecho", "falante"],
              additionalProperties: false,
            },
          },
          required: ["texto", "citacao"],
          additionalProperties: false,
        },
        historiaDoencaAtual: {
          type: "object",
          properties: {
            texto: { type: "string" },
            citacoes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  trecho: { type: "string" },
                  falante: { type: "string", enum: ["paciente", "dentista", "desconhecido"] },
                },
                required: ["trecho", "falante"],
                additionalProperties: false,
              },
            },
          },
          required: ["texto", "citacoes"],
          additionalProperties: false,
        },
        historicoMedico: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item: { type: "string" },
              citacao: {
                type: "object",
                properties: {
                  trecho: { type: "string" },
                  falante: { type: "string", enum: ["paciente", "dentista", "desconhecido"] },
                },
                required: ["trecho", "falante"],
                additionalProperties: false,
              },
            },
            required: ["item", "citacao"],
            additionalProperties: false,
          },
        },
        medicacoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nome: { type: "string" },
              detalhes: { type: "string" },
              citacao: {
                type: "object",
                properties: {
                  trecho: { type: "string" },
                  falante: { type: "string", enum: ["paciente", "dentista", "desconhecido"] },
                },
                required: ["trecho", "falante"],
                additionalProperties: false,
              },
            },
            required: ["nome", "detalhes", "citacao"],
            additionalProperties: false,
          },
        },
        achadosClinicos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              achado: { type: "string" },
              dente: { type: "string" },
              citacao: {
                type: "object",
                properties: {
                  trecho: { type: "string" },
                  falante: { type: "string", enum: ["paciente", "dentista", "desconhecido"] },
                },
                required: ["trecho", "falante"],
                additionalProperties: false,
              },
            },
            required: ["achado", "dente", "citacao"],
            additionalProperties: false,
          },
        },
        dentesReferenciados: {
          type: "array",
          items: {
            type: "object",
            properties: {
              numero: { type: "string" },
              contexto: { type: "string" },
              citacao: {
                type: "object",
                properties: {
                  trecho: { type: "string" },
                  falante: { type: "string", enum: ["paciente", "dentista", "desconhecido"] },
                },
                required: ["trecho", "falante"],
                additionalProperties: false,
              },
            },
            required: ["numero", "contexto", "citacao"],
            additionalProperties: false,
          },
        },
        diagnosticosMencionados: {
          type: "array",
          items: {
            type: "object",
            properties: {
              diagnostico: { type: "string" },
              confirmado: { type: "boolean" },
              citacao: {
                type: "object",
                properties: {
                  trecho: { type: "string" },
                  falante: { type: "string", enum: ["paciente", "dentista", "desconhecido"] },
                },
                required: ["trecho", "falante"],
                additionalProperties: false,
              },
            },
            required: ["diagnostico", "confirmado", "citacao"],
            additionalProperties: false,
          },
        },
        tratamentosDiscutidos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              procedimento: { type: "string" },
              dente: { type: "string" },
              citacao: {
                type: "object",
                properties: {
                  trecho: { type: "string" },
                  falante: { type: "string", enum: ["paciente", "dentista", "desconhecido"] },
                },
                required: ["trecho", "falante"],
                additionalProperties: false,
              },
            },
            required: ["procedimento", "dente", "citacao"],
            additionalProperties: false,
          },
        },
        orientacoesDadas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              orientacao: { type: "string" },
              citacao: {
                type: "object",
                properties: {
                  trecho: { type: "string" },
                  falante: { type: "string", enum: ["paciente", "dentista", "desconhecido"] },
                },
                required: ["trecho", "falante"],
                additionalProperties: false,
              },
            },
            required: ["orientacao", "citacao"],
            additionalProperties: false,
          },
        },
        sinaisAlerta: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sinal: { type: "string" },
              citacao: {
                type: "object",
                properties: {
                  trecho: { type: "string" },
                  falante: { type: "string", enum: ["paciente", "dentista", "desconhecido"] },
                },
                required: ["trecho", "falante"],
                additionalProperties: false,
              },
            },
            required: ["sinal", "citacao"],
            additionalProperties: false,
          },
        },
        metadados: {
          type: "object",
          properties: {
            totalPalavras: { type: "number" },
            palavrasPaciente: { type: "number" },
            palavrasDentista: { type: "number" },
            qualidadeTranscricao: { type: "string", enum: ["boa", "media", "ruim"] },
          },
          required: ["totalPalavras", "palavrasPaciente", "palavrasDentista", "qualidadeTranscricao"],
          additionalProperties: false,
        },
      },
      required: [
        "queixaPrincipal", "historiaDoencaAtual", "historicoMedico", "medicacoes",
        "achadosClinicos", "dentesReferenciados", "diagnosticosMencionados",
        "tratamentosDiscutidos", "orientacoesDadas", "sinaisAlerta", "metadados"
      ],
      additionalProperties: false,
    },
  },
};

const BEHAVIORAL_EXTRACTION_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "behavioral_extraction",
    strict: true,
    schema: {
      type: "object",
      properties: {
        falasPaciente: {
          type: "array",
          items: {
            type: "object",
            properties: {
              texto: { type: "string" },
              contexto: { type: "string" },
              indicadorComportamental: { type: "string" },
            },
            required: ["texto", "contexto", "indicadorComportamental"],
            additionalProperties: false,
          },
        },
        perguntasPaciente: {
          type: "array",
          items: {
            type: "object",
            properties: {
              texto: { type: "string" },
              categoria: { type: "string" },
            },
            required: ["texto", "categoria"],
            additionalProperties: false,
          },
        },
        objecoesPaciente: {
          type: "array",
          items: {
            type: "object",
            properties: {
              texto: { type: "string" },
              tipo: { type: "string", enum: ["financeira", "medo", "tempo", "confianca", "outra"] },
            },
            required: ["texto", "tipo"],
            additionalProperties: false,
          },
        },
        expressoesEmocionais: {
          type: "array",
          items: {
            type: "object",
            properties: {
              texto: { type: "string" },
              emocao: { type: "string" },
            },
            required: ["texto", "emocao"],
            additionalProperties: false,
          },
        },
        indicadoresRapport: {
          type: "object",
          properties: {
            validacoesEmocionais: { type: "array", items: { type: "string" } },
            espelhamentos: { type: "array", items: { type: "string" } },
            perguntasAbertas: { type: "array", items: { type: "string" } },
            interrupcoes: { type: "array", items: { type: "string" } },
          },
          required: ["validacoesEmocionais", "espelhamentos", "perguntasAbertas", "interrupcoes"],
          additionalProperties: false,
        },
        dinamicaConversa: {
          type: "object",
          properties: {
            turnosPaciente: { type: "number" },
            turnosDentista: { type: "number" },
            mediaComprimentoTurnoPaciente: { type: "number" },
            mediaComprimentoTurnoDentista: { type: "number" },
          },
          required: ["turnosPaciente", "turnosDentista", "mediaComprimentoTurnoPaciente", "mediaComprimentoTurnoDentista"],
          additionalProperties: false,
        },
        metadados: {
          type: "object",
          properties: {
            totalPalavras: { type: "number" },
            palavrasPaciente: { type: "number" },
            palavrasDentista: { type: "number" },
          },
          required: ["totalPalavras", "palavrasPaciente", "palavrasDentista"],
          additionalProperties: false,
        },
      },
      required: [
        "falasPaciente", "perguntasPaciente", "objecoesPaciente",
        "expressoesEmocionais", "indicadoresRapport", "dinamicaConversa", "metadados"
      ],
      additionalProperties: false,
    },
  },
};

// --------------------------------------------------------------------------
// Prompts
// --------------------------------------------------------------------------

const CLINICAL_EXTRACTION_SYSTEM = `Você é um extrator de dados clínicos. Sua ÚNICA função é identificar e citar FATOS presentes na transcrição.

REGRAS ABSOLUTAS:
1. EXTRAIA apenas o que está EXPLICITAMENTE na transcrição — NUNCA infira, complete ou invente.
2. Cada fato extraído DEVE ter uma citação (trecho literal ou quase-literal da transcrição).
3. Se algo não foi mencionado, NÃO inclua — arrays vazios são perfeitamente aceitáveis.
4. NÃO interprete, NÃO diagnostique, NÃO sugira — apenas EXTRAIA.
5. Identifique quem falou cada trecho: 'paciente' ou 'dentista'.
6. Para dentes: use APENAS números mencionados explicitamente (sistema FDI).
7. Para diagnósticos: marque 'confirmado: true' APENAS se o dentista afirmou categoricamente.
8. Qualidade da transcrição: 'boa' (>500 palavras, diálogo claro), 'media' (200-500 palavras), 'ruim' (<200 palavras ou confusa).

Você é um EXTRATOR, não um INTERPRETADOR. Não adicione contexto, não complete informações, não faça inferências clínicas.`;

const BEHAVIORAL_EXTRACTION_SYSTEM = `Você é um extrator de dados comportamentais. Sua ÚNICA função é identificar e citar comportamentos observáveis na transcrição.

REGRAS ABSOLUTAS:
1. EXTRAIA apenas comportamentos EXPLÍCITOS — palavras ditas, perguntas feitas, hesitações expressas.
2. Cada fato extraído DEVE ser uma citação direta ou paráfrase muito próxima do texto original.
3. NÃO interprete personalidade, NÃO classifique perfis, NÃO sugira técnicas — apenas EXTRAIA fatos comportamentais.
4. Para objeções: inclua APENAS objeções VERBALIZADAS pelo paciente (não inferidas).
5. Para emoções: inclua APENAS expressões emocionais EXPLÍCITAS (palavras que denotam emoção).
6. Para rapport: cite APENAS comportamentos observáveis do dentista (validações, perguntas, interrupções).
7. Dinâmica de conversa: conte turnos e estime comprimento médio baseado no texto.

Você é um EXTRATOR COMPORTAMENTAL, não um PSICÓLOGO. Não classifique, não diagnostique, não interprete — apenas DOCUMENTE comportamentos observáveis.`;

// --------------------------------------------------------------------------
// Extraction Functions
// --------------------------------------------------------------------------

/**
 * Extract clinical facts from a consultation transcript.
 * Stage 1 of the anti-hallucination pipeline for SOAP generation.
 */
export async function extractClinicalFacts(
  transcript: string,
  consultationId: number
): Promise<ExtractedClinicalFacts | null> {
  log.info("Starting clinical extraction", { consultationId, transcriptLength: transcript.length });

  const response = await invokeAI("soap_extraction", {
    messages: [
      { role: "system", content: CLINICAL_EXTRACTION_SYSTEM },
      { role: "user", content: `TRANSCRIÇÃO DA CONSULTA:\n\n${transcript}\n\nExtraia todos os fatos clínicos presentes nesta transcrição. Retorne APENAS o JSON estruturado.` },
    ],
    temperature: 0,
    seed: 42,
    response_format: CLINICAL_EXTRACTION_SCHEMA,
  }, { consultationId });

  if (!response.success) {
    log.error("Clinical extraction failed", { consultationId, error: response.error });
    return null;
  }

  const content = response.response.choices[0]?.message?.content;
  if (!content) {
    log.error("Empty response from clinical extraction", { consultationId });
    return null;
  }

  try {
    return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch {
    log.error("Invalid JSON from clinical extraction", { consultationId });
    return null;
  }
}

/**
 * Extract behavioral facts from a consultation transcript.
 * Stage 1 of the anti-hallucination pipeline for Neurovendas analysis.
 */
export async function extractBehavioralFacts(
  transcript: string,
  consultationId: number
): Promise<ExtractedBehavioralFacts | null> {
  log.info("Starting behavioral extraction", { consultationId, transcriptLength: transcript.length });

  const response = await invokeAI("neurovendas_extraction", {
    messages: [
      { role: "system", content: BEHAVIORAL_EXTRACTION_SYSTEM },
      { role: "user", content: `TRANSCRIÇÃO DA CONSULTA:\n\n${transcript}\n\nExtraia todos os fatos comportamentais observáveis nesta transcrição. Retorne APENAS o JSON estruturado.` },
    ],
    temperature: 0,
    seed: 42,
    response_format: BEHAVIORAL_EXTRACTION_SCHEMA,
  }, { consultationId });

  if (!response.success) {
    log.error("Behavioral extraction failed", { consultationId, error: response.error });
    return null;
  }

  const content = response.response.choices[0]?.message?.content;
  if (!content) {
    log.error("Empty response from behavioral extraction", { consultationId });
    return null;
  }

  try {
    return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch {
    log.error("Invalid JSON from behavioral extraction", { consultationId });
    return null;
  }
}
