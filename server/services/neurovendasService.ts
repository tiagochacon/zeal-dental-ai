/**
 * Neurovendas Analysis Service
 *
 * Extracts the neurovendas behavioral analysis logic from the consultations router
 * into a testable, reusable service layer.
 */
import { invokeAI } from "../ai/invokeAI";
import { EVIDENCE_REQUIRED_BLOCK, DISC_EVIDENCE_BLOCK, sanitizeUnsupportedClaims, enforceLowConfidenceWhenSparse } from "../helpers/antiHallucination";
import { getNeurovendasFallback, countPatientWords } from "../helpers/neurovendasFallback";
import { validateNeurovendasAnalysis } from "../helpers/validateNeurovendasAnalysis";
import { getMetodologiaContext } from "../_core/metodologiaLoader";
import { createLogger } from "../lib/logger";

const log = createLogger("services:neurovendas");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface AnalyzeNeurovendasInput {
  consultationId: number;
  transcript: string;
  patientId?: number | null;
}

export interface AnalyzeNeurovendasResult {
  success: true;
  analysis: Record<string, unknown>;
  fallback?: boolean;
  warnings?: number;
}

// --------------------------------------------------------------------------
// JSON Schema for strict LLM output
// --------------------------------------------------------------------------

const NEUROVENDAS_JSON_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "neurovendas_analysis",
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
// Prompts
// --------------------------------------------------------------------------

function buildSystemPrompt(patientWordCount: number): string {
  return `Você é um especialista em análise comportamental e neurovendas odontológicas, baseado na metodologia do Dr. Carlos Rodriguez. Sua função é EXCLUSIVAMENTE analisar transcrições de consultas odontológicas e extrair padrões de comportamento, motivações e técnicas de comunicação.

REGRAS ABSOLUTAS — NÃO NEGOCIÁVEIS:

1. FIDELIDADE AOS DADOS:
   - Extraia APENAS informações explicitamente presentes na transcrição.
   - Se uma informação não está na transcrição, retorne string vazia '' — NUNCA invente.
   - Não complete lacunas com conhecimento geral ou 'informações típicas'.
   - Use EXATAMENTE a nomenclatura e categorias definidas no schema de saída.

2. VALIDAÇÃO DE TAMANHO:
   - Se a transcrição do paciente tiver menos de 300 palavras, indique explicitamente: 'Análise de baixa confiança — transcrição insuficiente (X palavras do paciente). Recomenda-se consulta adicional para análise completa.'
   - Mesmo assim, preencha TODOS os campos com os dados disponíveis — não deixe campos vazios.

3. CAMPOS OBRIGATÓRIOS:
   - TODOS os campos do schema devem ser preenchidos (nunca deixe vazio ou null).
   - Campos de texto: use '' (string vazia) se não houver dados.
   - Campos de número: use 0 se não houver dados.
   - Campos de array: use [] se não houver dados.

4. ESTRUTURA JSON:
   - Sua saída DEVE ser JSON válido conforme o schema — sem texto livre fora do JSON.
   - Use exatamente os nomes de campos definidos no schema.

5. AMBIGUIDADE:
   - Em caso de ambiguidade, escolha a interpretação mais conservadora.
   - Prefira 'não identificado' a 'presumido'.

6. METODOLOGIA:
   - Aplique o framework de análise comportamental DISC como camada principal: dominancia, influencia, estabilidade e conformidade.
   - Mantenha o nível cerebral dominante (reptiliano, límbico, neocortex) como campo legado de compatibilidade.
   - Inclua motivações primárias, gatilhos mentais, objeções, rapport e scripts de objeção (LAER/PARE).
   - Use apenas os documentos de metodologia fornecidos — não use conhecimento externo.

${EVIDENCE_REQUIRED_BLOCK}

${DISC_EVIDENCE_BLOCK}`;
}

function buildUserPrompt(
  transcript: string,
  patientWordCount: number,
  patientId: number | null | undefined,
  metodologiaContext: string
): string {
  return `DOCUMENTOS DE METODOLOGIA (base obrigatória para toda análise):
${metodologiaContext}

--- FIM DOS DOCUMENTOS ---

CONTEXTO CLÍNICO:
- Paciente: ${patientId ? "ID " + patientId : "Não identificado"}
- Número de palavras do paciente: ~${patientWordCount} palavras
- Metodologia disponível: sim

TRANSCRIÇÃO DA CONSULTA:
${transcript}

INSTRUÇÕES ESPECÍFICAS:

1. Analise a transcrição acima e extraia os padrões de comportamento do PACIENTE (não do dentista).

2. Identifique:
   a) Perfil comportamental DISC do paciente (obrigatório): dominancia, influencia, estabilidade ou conformidade, com evidências textuais
   b) Nível cerebral dominante (reptiliano, limbico, neocortex) — campo legado, baseado em padrões de linguagem e preocupações
   c) Motivação primária (alivio_dor, estetica, status, saude)
   d) Gatilhos mentais (transformacao, saude_longevidade, status, conforto, exclusividade)
   e) Objeções verdadeiras e ocultas (categoria: financeira, medo, tempo, confianca, outra)
   f) Técnicas de objeção sugeridas (LAER ou redirecionamento)
   g) Nível de rapport (0-100) e breakdown de componentes
   h) Sinais de linguagem (positivos e negativos)

3. Preencha TODOS os campos do schema — nunca deixe vazio.

4. ${patientWordCount < 300 ? `ATENÇÃO: Transcrição com apenas ~${patientWordCount} palavras do paciente. Indique 'Análise de baixa confiança' na descrição do perfil, mas continue preenchendo todos os campos.` : "Transcrição com volume adequado para análise completa."}

5. Use EXATAMENTE os valores de enum definidos no schema — sem variações.

6. Para scriptPARE: crie um script COMPLETO e PERSONALIZADO baseado no contexto desta consulta. Cada campo (problema, amplificacao, resolucao, engajamento) deve conter pelo menos uma frase completa.

7. Para tecnicaObjecao: forneça passos ESPECÍFICOS e ACIONÁVEIS, não genéricos.

RETORNE APENAS O JSON, sem explicações adicionais.`;
}

// --------------------------------------------------------------------------
// Post-processing
// --------------------------------------------------------------------------

function postProcessAnalysis(analysis: Record<string, unknown>, transcript: string): Record<string, unknown> {
  const perfilPsicografico = analysis.perfilPsicografico as Record<string, unknown> | undefined;
  if (perfilPsicografico?.discProfile && transcript) {
    const disc = perfilPsicografico.discProfile as Record<string, unknown>;
    disc.motivadores = sanitizeUnsupportedClaims(transcript, (disc.motivadores as string[]) || []);
    disc.medosOuResistencias = sanitizeUnsupportedClaims(transcript, (disc.medosOuResistencias as string[]) || []);
    perfilPsicografico.discProfile = enforceLowConfidenceWhenSparse(
      disc as any,
      transcript
    );
  }
  return analysis;
}

// --------------------------------------------------------------------------
// Main service function
// --------------------------------------------------------------------------

export async function analyzeNeurovendas(input: AnalyzeNeurovendasInput): Promise<AnalyzeNeurovendasResult> {
  const { consultationId, transcript, patientId } = input;

  log.info("Starting neurovendas analysis", { consultationId, transcriptLength: transcript.length });

  const metodologiaContext = await getMetodologiaContext();
  const patientWordCount = countPatientWords(transcript);

  const response = await invokeAI("neurovendas_consultation", {
    messages: [
      { role: "system", content: buildSystemPrompt(patientWordCount) },
      { role: "user", content: buildUserPrompt(transcript, patientWordCount, patientId, metodologiaContext) },
    ],
    response_format: NEUROVENDAS_JSON_SCHEMA,
  }, { consultationId });

  if (!response.success) {
    log.error("All neurovendas attempts failed — using safe fallback", { consultationId });
    const fallback = getNeurovendasFallback();
    return { success: true, analysis: fallback, fallback: true };
  }

  const analysisContent = response.response.choices[0]?.message?.content;
  if (!analysisContent || typeof analysisContent !== "string") {
    log.error("Empty LLM response for neurovendas — using safe fallback", { consultationId });
    const fallback = getNeurovendasFallback();
    return { success: true, analysis: fallback, fallback: true };
  }

  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(analysisContent);
  } catch {
    log.error("Invalid JSON in neurovendas response — using safe fallback", { consultationId });
    const fallback = getNeurovendasFallback();
    return { success: true, analysis: fallback, fallback: true };
  }

  // Post-process: sanitize unsupported claims and enforce low confidence when sparse
  analysis = postProcessAnalysis(analysis, transcript);

  // Validate
  const warnings = validateNeurovendasAnalysis(analysis, "consulta");
  if (warnings.length > 0) {
    log.warn("Neurovendas validation warnings", { consultationId, warningCount: warnings.length });
  }

  log.info("Neurovendas analysis completed", { consultationId, fallback: false });

  return { success: true, analysis, warnings: warnings.length };
}
