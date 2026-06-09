/**
 * SOAP Note Generation Service
 *
 * Extracts the SOAP note generation logic from the consultations router
 * into a testable, reusable service layer.
 */
import { invokeAI } from "../ai/invokeAI";
import { EVIDENCE_REQUIRED_BLOCK, DISC_EVIDENCE_BLOCK } from "../helpers/antiHallucination";
import { createLogger } from "../lib/logger";
import type { SOAPNote, Consultation } from "../../drizzle/schema";

const log = createLogger("services:soap");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface GenerateSOAPInput {
  consultationId: number;
  transcript: string;
}

export interface GenerateSOAPResult {
  success: true;
  soapNote: SOAPNote;
  hallucinationWarning?: boolean;
}

// --------------------------------------------------------------------------
// JSON Schema for strict LLM output
// --------------------------------------------------------------------------

const SOAP_JSON_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "soap_note",
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
        patientProfile: {
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
            type: { type: "string", enum: ["reptilian", "neocortex", "limbic"] },
            confidence: { type: "number" },
            primaryTraits: { type: "array", items: { type: "string" } },
            detectedKeywords: { type: "array", items: { type: "string" } },
            recommendedApproach: { type: "string" },
            triggers: {
              type: "object",
              properties: {
                positive: { type: "array", items: { type: "string" } },
                negative: { type: "array", items: { type: "string" } },
              },
              required: ["positive", "negative"],
              additionalProperties: false,
            },
          },
          required: ["discProfile", "type", "confidence", "primaryTraits", "detectedKeywords", "recommendedApproach", "triggers"],
          additionalProperties: false,
        },
      },
      required: ["urgency", "subjective", "objective", "assessment", "plan", "patientProfile"],
      additionalProperties: false,
    },
  },
};

// --------------------------------------------------------------------------
// Prompts
// --------------------------------------------------------------------------

const SYSTEM_PROMPT = `Você é um assistente especializado em documentação odontológica brasileira. REGRAS OBRIGATÓRIAS DE FIDELIDADE:
1. NUNCA invente, presuma ou complete dados que não aparecem literalmente na transcrição.
2. Se uma informação não foi mencionada na transcrição, use string vazia '' para campos de texto, [] para arrays, e para classificações de dentes use exclusivamente 'not_evaluated'.
3. Use aspas ou paráfrase próxima ao relatar queixas — não reescreva com suas próprias palavras.
4. Diagnósticos devem ser prefixados com 'Hipótese:' quando não confirmados explicitamente pelo dentista na transcrição.
5. Nunca adicione orientações, lembretes ou tratamentos que não foram discutidos na consulta.
6. Sua função é EXTRAIR e ESTRUTURAR, não interpretar ou complementar.`;

function buildUserPrompt(transcript: string): string {
  return `Você é um assistente de IA especializado em documentação odontológica brasileira.

TRANSCRIÇÃO DA CONSULTA:
${transcript}

INSTRUÇÕES CRÍTICAS:
1. NUNCA invente dados que não estejam na transcrição
2. Se uma informação não foi mencionada, indique claramente "Não informado" ou "Necessário preenchimento"
3. Seja conservador nos diagnósticos - indique como "hipótese diagnóstica" quando não houver certeza
4. Priorize a fidelidade clínica acima de tudo

EXTRAIA E ESTRUTURE:
1. Queixa principal (QP) - exatamente como o paciente relatou
2. História da doença atual (HDA) - cronologia e características
3. Histórico médico e odontológico - apenas o que foi mencionado
4. Medicações em uso - apenas as citadas
5. Exame clínico - apenas achados objetivos mencionados
6. Diagnóstico odontológico - como HIPÓTESE quando não confirmado
7. Plano de tratamento proposto COM PRAZO ESTIMADO para cada procedimento

NOMENCLATURA OBRIGATÓRIA:
- Sistema de numeração FDI (dente 16, 21, etc.)
- Faces: oclusal, mesial, distal, vestibular, lingual/palatina
- Diagnósticos: cárie classe I/II, gengivite localizada, periodontite, etc.

CLASSIFICAÇÕES DE DENTES (para o Odontograma):
Para cada dente mencionado, classifique com base ESTRITAMENTE no que foi dito:
- not_evaluated: dente não avaliado/não mencionado
- healthy: dente saudável, hígido, sem alterações
- cavity: cárie, lesão cariosa
- restored: restaurado, obturado, com resina/amálgama
- missing: ausente, extraído, perdido
- fractured: fraturado, quebrado, trincado
- root_canal: tratamento de canal, endodontia
- crown: coroa, prótese fixa
- extraction: indicação de extração

IMPORTANTE: NÃO invente classificações. Se o dente foi mencionado mas a condição não está clara, use a classificação mais provável baseada no contexto.

RED FLAGS (sinais de alerta) - identifique se presentes:
- Dor intensa ou persistente
- Sangramento excessivo
- Edema/tumefação
- Lesões suspeitas
- Contraindicações para procedimentos

ANÁLISE DE PERFIL COMPORTAMENTAL DO PACIENTE:
Baseado na transcrição, classifique o perfil predominante DISC do paciente (camada principal) e mantenha o tipo neurológico legado para compatibilidade:

0. DISC (camada principal):
   - dominancia: foco em resultado, rapidez, objetividade e controle
   - influencia: foco em transformação, autoestima, validação social, conexão emocional
   - estabilidade: foco em segurança, medo/ansiedade, previsibilidade e confiança
   - conformidade: foco em detalhes técnicos, dados, lógica, planejamento e critérios

1. REPTILIANO (Cérebro Primitivo - Sobrevivência):
   - Indicadores: Expressões de medo, ansiedade, preocupação com dor/risco
   - Palavras-chave: 'medo', 'dor', 'seguro', 'garantia', 'nervoso', 'ansioso', 'vai doer'
   - Comportamento: Hesitante, busca controle e segurança
   - Gatilhos positivos: Ambiente Seguro, Sem Dor, Controle Total, Reversível
   - Gatilhos negativos: Termos técnicos complexos, Urgência, Pressão de tempo

2. NEOCORTEX (Cérebro Racional - Lógica):
   - Indicadores: Perguntas técnicas, busca por dados, comparações
   - Palavras-chave: 'estatística', 'evidência', 'técnica', 'comparação', 'quanto tempo', 'taxa de sucesso'
   - Comportamento: Analítico, cético, quer informações concretas
   - Gatilhos positivos: Taxa de Sucesso, Estudos Comprovados, Análise Custo-Benefício
   - Gatilhos negativos: Apelos emocionais, Linguagem vaga, Falta de dados

3. LÍMBICO (Cérebro Emocional - Sentimentos):
   - Indicadores: Foco em transformação, estética, impacto social
   - Palavras-chave: 'bonito', 'sorriso', 'confiança', 'autoestima', 'transformação', 'pessoas vão ver'
   - Comportamento: Emocional, aspiracional, busca status/pertencimento
   - Gatilhos positivos: Transformação Total, Autoconfiança, Sorriso de Celebridade, Realização
   - Gatilhos negativos: Dados técnicos frios, Argumentos puramente racionais

Seja preciso, conciso e use terminologia clínica apropriada. NÃO INVENTE DADOS.

INSTRUÇÕES ANTI-ALUCINAÇÃO:
- Cada campo da resposta deve ter evidência direta na transcrição acima.
- Se a transcrição é curta ou incompleta, gere campos correspondentemente curtos/vazios.
- NÃO EXPANDA informações além do que foi dito.
- NÃO INFIRA condições clínicas a partir de sintomas sem que o dentista as tenha citado explicitamente.
- Para dentes: classifique APENAS os mencionados explicitamente. Os demais devem ser 'not_evaluated'.
- patientProfile: baseie-se APENAS em palavras literais do paciente na transcrição, não em inferências gerais.
- patientProfile.discProfile: é obrigatório e deve ser o perfil principal de exibição.

${EVIDENCE_REQUIRED_BLOCK}

${DISC_EVIDENCE_BLOCK}`;
}

// --------------------------------------------------------------------------
// Hallucination check
// --------------------------------------------------------------------------

function checkHallucination(soapNote: SOAPNote, transcript: string): boolean {
  const transcriptWords = transcript.toLowerCase().split(/\s+/);
  const queixaWords = (soapNote.subjective as { queixa_principal?: string })?.queixa_principal?.toLowerCase().split(/\s+/) || [];
  const sharedWords = queixaWords.filter(
    (w: string) => w.length > 4 && transcriptWords.some((tw: string) => tw.includes(w.slice(0, 5)))
  );
  return queixaWords.length > 3 && sharedWords.length === 0;
}

// --------------------------------------------------------------------------
// Main service function
// --------------------------------------------------------------------------

export async function generateSOAPNote(input: GenerateSOAPInput): Promise<GenerateSOAPResult> {
  const { consultationId, transcript } = input;

  log.info("Generating SOAP note", { consultationId, transcriptLength: transcript.length });

  const response = await invokeAI("soap", {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(transcript) },
    ],
    temperature: 0,
    seed: 42,
    response_format: SOAP_JSON_SCHEMA,
  }, { consultationId });

  if (!response.success) {
    log.error("SOAP generation failed", { consultationId, error: response.error });
    throw new Error(response.error);
  }

  const content = response.response.choices[0]?.message?.content;
  if (!content) {
    log.error("Empty LLM response for SOAP", { consultationId });
    throw new Error("Resposta vazia da IA");
  }

  let soapNote: SOAPNote;
  try {
    soapNote = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch {
    log.error("Invalid JSON from LLM for SOAP", { consultationId });
    throw new Error("Resposta da IA em formato inválido. Tente novamente.");
  }

  const hallucinationWarning = checkHallucination(soapNote, transcript);
  if (hallucinationWarning) {
    log.warn("Possible hallucination detected in SOAP queixa_principal", { consultationId });
  }

  log.info("SOAP note generated successfully", { consultationId, hallucinationWarning });

  return { success: true, soapNote, hallucinationWarning };
}
