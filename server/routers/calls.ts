import { router, protectedProcedure, negotiationAccessProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createCall,
  getCallsByClinic,
  getCallsByCRC,
  getCallById,
  updateCall,
  finalizeCall,
  getUserById,
  getLeadById,
  updateLead,
} from "../db";
import { storagePut } from "../storage";
import { transcribeAudio } from "../_core/voiceTranscription";
import { invokeLLM } from "../_core/llm";
import { invokeLLMWithRetry } from "../helpers/invokeLLMWithRetry";
import { validateNeurovendasAnalysis } from "../helpers/validateNeurovendasAnalysis";
import { getNeurovendasFallback, countPatientWords } from "../helpers/neurovendasFallback";
import { enforceLowConfidenceWhenSparse, sanitizeUnsupportedClaims, EVIDENCE_REQUIRED_BLOCK, DISC_EVIDENCE_BLOCK } from "../helpers/antiHallucination";
import { getMetodologiaContext } from "../_core/metodologiaLoader";
import { nanoid } from "nanoid";

async function extractAndSaveCallInsights(callId: number, transcript: string): Promise<void> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Você é um assistente especializado em extrair informações objetivas de transcrições de ligações de clínicas odontológicas. " +
          "REGRAS: 1. Extraia APENAS o que foi dito explicitamente pelo lead na transcrição. " +
          "2. Se uma informação não foi mencionada, retorne string vazia ''. " +
          "3. Não infira, não suponha, não complete com informações típicas do setor.",
      },
      {
        role: "user",
        content:
          `Analise a transcrição de ligação abaixo e extraia as 3 informações solicitadas sobre o lead/prospect.\n\n` +
          `TRANSCRIÇÃO:\n${transcript}\n\n` +
          `EXTRAIA:\n` +
          `1. DOR: Qual é a queixa, dor ou problema de saúde bucal que o lead mencionou? ` +
          `Ex: 'dor de dente', 'quero fazer implante', 'estou com gengivite'. Se não mencionou, retorne string vazia.\n` +
          `2. BUSCA: Por que o lead está procurando a clínica? Qual foi a motivação? ` +
          `Ex: 'quer fazer clareamento para o casamento', 'foi indicado por amigo', 'viu anúncio sobre implantes'. Se não mencionou, retorne string vazia.\n` +
          `3. TRABALHA: O lead mencionou se trabalha? Em qual horário? ` +
          `Ex: 'Trabalha de segunda a sexta das 8h às 18h', 'Não trabalha', 'Prefere consultas aos sábados'. Se não mencionou, retorne string vazia.\n\n` +
          `Responda em JSON estruturado.`,
      },
    ],
    temperature: 0,
    seed: 42,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "call_insights",
        strict: true,
        schema: {
          type: "object",
          properties: {
            dor: { type: "string" },
            busca: { type: "string" },
            trabalha: { type: "string" },
          },
          required: ["dor", "busca", "trabalha"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response?.choices?.[0]?.message?.content;
  let parsed: { dor?: string; busca?: string; trabalha?: string };
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
  } catch {
    console.error("[CallInsights] JSON inválido na resposta da IA para call", callId, "— insights não salvos");
    return;
  }
  await updateCall(callId, {
    callInsights: {
      dor: parsed.dor ?? "",
      busca: parsed.busca ?? "",
      trabalha: parsed.trabalha ?? "",
      geradoEm: new Date().toISOString(),
    },
  });
  console.log("[CallInsights] Insights extraídos para call", callId);
}

// Max characters to send to LLM (~60k chars ≈ ~15k tokens, safe for most models)
const MAX_TRANSCRIPT_CHARS = 60000;

function truncateTranscript(text: string): string {
  if (text.length <= MAX_TRANSCRIPT_CHARS) return text;
  // Keep first 80% and last 20% to preserve beginning context and recent messages
  const headSize = Math.floor(MAX_TRANSCRIPT_CHARS * 0.8);
  const tailSize = MAX_TRANSCRIPT_CHARS - headSize;
  const head = text.slice(0, headSize);
  const tail = text.slice(-tailSize);
  return `${head}\n\n[... ${text.length - MAX_TRANSCRIPT_CHARS} caracteres omitidos por limite de contexto ...]\n\n${tail}`;
}

function getCallAnalysisTranscript(call: any): string {
  const sourceType = call?.sourceType ?? "phone_call";
  if (sourceType === "whatsapp_export") {
    const summary = call?.whatsappImportData?.largeTextSummary;
    if (typeof summary === "string" && summary.trim().length > 0) {
      return truncateTranscript(summary);
    }
  }
  const transcript = call?.transcript ?? "";
  return truncateTranscript(transcript);
}

const MAX_ANALYSIS_TRANSCRIPT_CHARS = 55_000;
function prepareTranscriptForLLM(rawTranscript: string): { transcript: string; truncated: boolean; originalLength: number } {
  const transcript = rawTranscript?.trim() ?? "";
  const originalLength = transcript.length;
  if (originalLength <= MAX_ANALYSIS_TRANSCRIPT_CHARS) {
    return { transcript, truncated: false, originalLength };
  }

  const reservedForMarker = 300;
  const sliceSize = Math.floor((MAX_ANALYSIS_TRANSCRIPT_CHARS - reservedForMarker) / 2);
  const head = transcript.slice(0, sliceSize);
  const tail = transcript.slice(-sliceSize);
  const omitted = originalLength - (head.length + tail.length);

  return {
    transcript:
      `${head}\n\n` +
      `[... trecho omitido para evitar timeout de inferência: ${omitted} caracteres ...]\n\n` +
      `${tail}`,
    truncated: true,
    originalLength,
  };
}

export const callsRouter = router({
  // Create a new call record
  create: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      leadName: z.string(),
      sourceType: z.enum(["phone_call", "audio_upload", "whatsapp_export"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você precisa estar vinculado a uma clínica" });
      }
      if (user.clinicRole !== "crc" && user.clinicRole !== "gestor") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas CRCs podem registrar ligações" });
      }

      // Verify lead belongs to same clinic
      const lead = await getLeadById(input.leadId);
      if (!lead || lead.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      }

      const call = await createCall({
        clinicId: user.clinicId,
        crcId: ctx.user.id,
        leadId: input.leadId,
        leadName: input.leadName,
        sourceType: input.sourceType ?? "phone_call",
      });

      return call;
    }),

  // List calls (CRC sees own, Gestor sees all from clinic)
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        return [];
      }

      if (user.clinicRole === "gestor") {
        return await getCallsByClinic(user.clinicId);
      } else if (user.clinicRole === "crc") {
        return await getCallsByCRC(ctx.user.id);
      }

      return [];
    }),

  // Get call by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const call = await getCallById(input.id);
      if (!call || call.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ligação não encontrada" });
      }

      if (user.clinicRole === "crc" && call.crcId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      return call;
    }),

  // Upload audio for a call
  uploadAudio: protectedProcedure
    .input(z.object({
      callId: z.number(),
      audioBase64: z.string(),
      mimeType: z.string().default("audio/webm"),
      durationSeconds: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const call = await getCallById(input.callId);
      if (!call || call.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ligação não encontrada" });
      }

      // Upload to S3
      const ext = input.mimeType.includes("webm") ? "webm" : input.mimeType.includes("mp3") || input.mimeType.includes("mpeg") ? "mp3" : input.mimeType.includes("mp4") || input.mimeType.includes("m4a") || input.mimeType.includes("aac") ? "m4a" : input.mimeType.includes("ogg") ? "ogg" : input.mimeType.includes("wav") ? "wav" : "webm";
      const fileKey = `calls/${ctx.user.id}/${input.callId}-${nanoid(8)}.${ext}`;
      const buffer = Buffer.from(input.audioBase64, "base64");
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      await updateCall(input.callId, {
        audioUrl: url,
        audioFileKey: fileKey,
        audioDurationSeconds: input.durationSeconds || null,
        sourceType: "audio_upload",
      });

      return { success: true, audioUrl: url };
    }),

  // Transcribe call audio
  transcribe: protectedProcedure
    .input(z.object({
      callId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const call = await getCallById(input.callId);
      if (!call || call.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ligação não encontrada" });
      }

      if (!call.audioUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum áudio encontrado para esta ligação" });
      }

      const result = await transcribeAudio({
        audioUrl: call.audioUrl,
        language: "pt",
        prompt: "Transcrição de ligação comercial odontológica. Vocabulário esperado: consulta, agendamento, avaliação gratuita, ortodontia, implante, clareamento, extração, limpeza, canal, prótese, dentista, CRC, clínica, paciente, plano de tratamento, urgência, dor de dente, sangramento. Nomes brasileiros. Tom informal de atendimento telefônico.",
      });

      if ('error' in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Falha na transcrição: ${(result as any).error}` });
      }

      const segments = (result as any).segments?.map((s: any, idx: number) => ({
        id: idx,
        start: s.start,
        end: s.end,
        text: s.text,
      })) || [];

      await updateCall(input.callId, {
        transcript: (result as any).text,
        transcriptSegments: segments,
        status: "transcribed",
      });

      // Extrair observações do lead automaticamente — operação não-bloqueante
      extractAndSaveCallInsights(input.callId, (result as any).text).catch((err) => {
        console.warn("[CallInsights] Falha ao extrair insights:", err);
      });

      return { success: true, transcript: (result as any).text, segments };
    }),

  // Analyze call with Neurovendas (adapted for CRC context)
  analyzeNeurovendas: negotiationAccessProcedure
    .input(z.object({
      callId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const startedAt = Date.now();
      const requestId = String(ctx.req.headers["x-request-id"] || `no-reqid-${nanoid(6)}`);
      console.log(`[Neurovendas][${requestId}] start callId=${input.callId}`);
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const call = await getCallById(input.callId);
      if (!call || call.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ligação não encontrada" });
      }

      const analysisSource = getCallAnalysisTranscript(call);
      if (!analysisSource) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ligação não possui transcrição para análise" });
      }
      const transcriptPayload = prepareTranscriptForLLM(analysisSource);
      const analysisTranscript = transcriptPayload.transcript;
      console.log(
        `[Neurovendas][${requestId}] transcript length=${transcriptPayload.originalLength} truncated=${transcriptPayload.truncated}`
      );

      // Return cached analysis if exists
      if (call.neurovendasAnalysis) {
        console.log(`[Neurovendas][${requestId}] cached=true durationMs=${Date.now() - startedAt}`);
        return { success: true, analysis: call.neurovendasAnalysis, cached: true };
      }

      const metodologiaContext = await getMetodologiaContext();
      const leadWordCount = countPatientWords(analysisTranscript);

      const sourceType = call.sourceType ?? "phone_call";
      const sourceLabel =
        sourceType === "whatsapp_export"
          ? "Conversa exportada do WhatsApp (mensagens assíncronas e áudios transcritos)"
          : "Ligação comercial CRC → Lead (prospecção/agendamento)";

      const systemMessage = `Você é um especialista em análise comportamental e neurovendas odontológicas, baseado na metodologia do Dr. Carlos Rodriguez. Sua função é EXCLUSIVAMENTE analisar transcrições de interações comerciais (CRC → Lead) e extrair padrões de comportamento, motivações e técnicas de comunicação.

REGRAS ABSOLUTAS — NÃO NEGOCIÁVEIS:

1. FIDELIDADE AOS DADOS:
   - Extraia APENAS informações explicitamente presentes na transcrição.
   - Se uma informação não está na transcrição, retorne string vazia '' — NUNCA invente.
   - Não suponha objeções por ser uma ligação de venda.
   - Use EXATAMENTE a nomenclatura e categorias definidas no schema de saída.

2. VALIDAÇÃO DE TAMANHO:
   - Se a transcrição do lead tiver menos de 100 palavras, indique: 'Amostra insuficiente — conclusões com baixa confiança' em descricaoPerfil.
   - Mesmo assim, preencha TODOS os campos com os dados disponíveis.

3. CAMPOS OBRIGATÓRIOS:
   - TODOS os campos do schema devem ser preenchidos (nunca deixe vazio ou null).
   - Campos de texto: use '' (string vazia) se não houver dados.
   - Campos de número: use 0 se não houver dados.
   - Campos de array: use [] se não houver dados.

4. CONTEXTO:
   - Esta é uma interação de prospecção/agendamento.
   - O foco é agendamento, NÃO fechamento de tratamento.
   - Scripts e gatilhos devem refletir esse objetivo.

5. METODOLOGIA:
   - Use apenas os documentos de metodologia fornecidos — não use conhecimento externo.

${EVIDENCE_REQUIRED_BLOCK}

${DISC_EVIDENCE_BLOCK}`;

      const prompt = `DOCUMENTOS DE METODOLOGIA (base obrigatória para toda análise):
${metodologiaContext}

--- FIM DOS DOCUMENTOS ---

CONTEXTO DA LIGAÇÃO:
- Número de palavras do lead: ~${leadWordCount} palavras
- Tipo: ${sourceLabel}
- Metodologia disponível: sim

SINAIS IMPORTANTES PARA WHATSAPP:
- Se a origem for WhatsApp, considere sinais de conversa assíncrona (tempo entre respostas, sumiço, retomadas, mensagens curtas/longas, pedido de preço, pedido de detalhes, hesitação).
- Se houver áudios transcritos, use o conteúdo falado do lead como evidência prioritária quando identificado.
- Não usar imagens como evidência comportamental neste ciclo (apenas contexto).

TRANSCRIÇÃO DA LIGAÇÃO:
${analysisTranscript}

INSTRUÇÕES ESPECÍFICAS:

1. Analise a transcrição acima e extraia os padrões de comportamento do LEAD (não do CRC).

2. Identifique o perfil comportamental DISC do LEAD (campo discProfile — obrigatório):
   - perfilPrimario: o perfil DISC dominante inferido a partir dos sinais de fala.
     * dominancia: lead direto, impaciente, orientado a resultado, quer saber próximos passos, prazo e efetividade.
     * influencia: lead comunicativo, emocional, fala de estética, autoestima, transformação, sorriso, imagem.
     * estabilidade: lead demonstra medo, ansiedade, insegurança, busca segurança e acolhimento, evita pressão.
     * conformidade: lead faz perguntas detalhadas, quer entender riscos, etapas, critérios, planeja antes de decidir.
   - perfilSecundario: segundo perfil quando houver mistura clara de sinais, senão null.
   - confianca: 0 a 100 conforme volume e clareza dos sinais detectados.
   - sinaisDetectados: trechos ou comportamentos observados que justificam o perfil.
   - motivadores, medosOuResistencias, comoComunicar, oQueEvitar, fraseRecomendada: práticos para o CRC usar.
   - justificativaTecnica: explicação técnica clara de como o perfil foi inferido pela metodologia.

3. Identifique (metodologia do ebook — base obrigatória):
   a) Nível cerebral dominante (reptiliano, limbico, neocortex) — campo legado, preencha com base na metodologia
   b) Motivação primária (alivio_dor, estetica, status, saude)
   c) Gatilhos mentais (transformacao, saude_longevidade, status, conforto, exclusividade)
   d) Objeções verdadeiras e ocultas (categoria: financeira, medo, tempo, confianca, outra)
   e) Técnicas de objeção sugeridas (LAER ou redirecionamento)
   f) Nível de rapport (0-100) e breakdown
   g) Sinais de linguagem (positivos e negativos)

4. Preencha TODOS os campos do schema — nunca deixe vazio.

5. ${leadWordCount < 100 ? `ATENÇÃO: Transcrição com apenas ~${leadWordCount} palavras do lead. No discProfile, indique 'Amostra insuficiente' no resumo e reduza a confiança para no máximo 20. Continue preenchendo todos os campos.` : 'Transcrição com volume adequado para análise.'}

6. Use EXATAMENTE os valores de enum definidos no schema — sem variações.

7. Para scriptPARE: crie um script COMPLETO adaptado ao contexto de AGENDAMENTO desta ligação, alinhado ao perfil DISC identificado.

8. Para tecnicaObjecao: forneça passos ESPECÍFICOS para o CRC usar na próxima ligação, considerando o perfil DISC.

RETORNE APENAS O JSON, sem explicações adicionais.`;

      const response = await invokeLLMWithRetry({
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "neurovendas_call_analysis",
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
                        justificativaTecnica: { type: "string" }
                      },
                      required: ["perfilPrimario", "perfilSecundario", "confianca", "resumo", "sinaisDetectados", "motivadores", "medosOuResistencias", "comoComunicar", "oQueEvitar", "fraseRecomendada", "justificativaTecnica"],
                      additionalProperties: false
                    },
                    nivelCerebralDominante: { type: "string", enum: ["neocortex", "limbico", "reptiliano"] },
                    motivacaoPrimaria: { type: "string", enum: ["alivio_dor", "estetica", "status", "saude"] },
                    nivelAnsiedade: { type: "number" },
                    nivelReceptividade: { type: "number" },
                    descricaoPerfil: { type: "string" }
                  },
                  required: ["discProfile", "nivelCerebralDominante", "motivacaoPrimaria", "nivelAnsiedade", "nivelReceptividade", "descricaoPerfil"],
                  additionalProperties: false
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
                          tecnicaSugerida: { type: "string", description: "SCRIPT COMPLETO de resposta usando técnica LAER para o CRC usar na próxima ligação." }
                        },
                        required: ["texto", "categoria", "tecnicaSugerida"],
                        additionalProperties: false
                      }
                    },
                    ocultas: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          texto: { type: "string", description: "A objeção oculta identificada" },
                          sinaisDetectados: { type: "string", description: "Sinais no texto que indicam essa objeção" },
                          perguntaReveladora: { type: "string", description: "Pergunta direta para revelar a objeção. Modelo: 'Você já consultou outra clínica sobre isso? Se sim, o que faltou para você fechar lá?' — adapte ao contexto específico da objeção detectada, sempre direta e objetiva." }
                        },
                        required: ["texto", "sinaisDetectados", "perguntaReveladora"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["verdadeiras", "ocultas"],
                  additionalProperties: false
                },
                sinaisLinguagem: {
                  type: "object",
                  properties: {
                    positivos: { type: "array", items: { type: "string" } },
                    negativos: { type: "array", items: { type: "string" } },
                    palavrasChaveEmocionais: { type: "array", items: { type: "string" } }
                  },
                  required: ["positivos", "negativos", "palavrasChaveEmocionais"],
                  additionalProperties: false
                },
                gatilhosMentais: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome: { type: "string", enum: ["transformacao", "saude_longevidade", "status", "conforto", "exclusividade"] },
                      justificativa: { type: "string" },
                      exemploFrase: { type: "string" }
                    },
                    required: ["nome", "justificativa", "exemploFrase"],
                    additionalProperties: false
                  }
                },
                scriptPARE: {
                  type: "object",
                  properties: {
                    problema: { type: "string" },
                    amplificacao: { type: "string" },
                    resolucao: { type: "string" },
                    engajamento: { type: "string" }
                  },
                  required: ["problema", "amplificacao", "resolucao", "engajamento"],
                  additionalProperties: false
                },
                tecnicaObjecao: {
                  type: "object",
                  properties: {
                    tipo: { type: "string", enum: ["LAER", "redirecionamento"] },
                    passos: { type: "array", items: { type: "string" } }
                  },
                  required: ["tipo", "passos"],
                  additionalProperties: false
                },
                rapport: {
                  type: "object",
                  properties: {
                    nivel: { type: "number" },
                    justificativa: { type: "string" },
                    sugestaoMelhoria: { type: "string" },
                    breakdown: {
                      type: "object",
                      properties: {
                        validacaoEmocional: { type: "number" },
                        espelhamentoLinguistico: { type: "number" },
                        escutaAtiva: { type: "number" },
                        equilibrioTurnos: { type: "number" },
                        ausenciaInterrupcoes: { type: "number" }
                      },
                      required: ["validacaoEmocional", "espelhamentoLinguistico", "escutaAtiva", "equilibrioTurnos", "ausenciaInterrupcoes"],
                      additionalProperties: false
                    }
                  },
                  required: ["nivel", "justificativa", "sugestaoMelhoria", "breakdown"],
                  additionalProperties: false
                },
                resumoGeral: { type: "string" }
              },
              required: ["perfilPsicografico", "objecoes", "sinaisLinguagem", "gatilhosMentais", "scriptPARE", "tecnicaObjecao", "rapport", "resumoGeral"],
              additionalProperties: false
            }
          }
        }
      });

      // Se retry falhou completamente, usar fallback
      if (!response) {
        console.error('[NEUROVENDAS-CRC] Todas as tentativas falharam — usando fallback seguro');
        const fallback = getNeurovendasFallback();
        await updateCall(input.callId, { neurovendasAnalysis: fallback as any, status: "analyzed" });
        console.log(`[Neurovendas][${requestId}] fallback=true durationMs=${Date.now() - startedAt}`);
        return { success: true, analysis: fallback, fallback: true };
      }

      const analysisContent = response.choices?.[0]?.message?.content;
      if (!analysisContent || typeof analysisContent !== 'string') {
        console.error('[NEUROVENDAS-CRC] Resposta vazia do LLM — usando fallback seguro');
        const fallback = getNeurovendasFallback();
        await updateCall(input.callId, { neurovendasAnalysis: fallback as any, status: "analyzed" });
        console.log(`[Neurovendas][${requestId}] fallback=empty-content durationMs=${Date.now() - startedAt}`);
        return { success: true, analysis: fallback, fallback: true };
      }

      let analysis: Record<string, unknown>;
      try {
        analysis = JSON.parse(analysisContent);
      } catch {
        console.error('[NEUROVENDAS-CRC] JSON inválido na resposta — usando fallback seguro');
        const fallback = getNeurovendasFallback();
        await updateCall(input.callId, { neurovendasAnalysis: fallback as any, status: "analyzed" });
        console.log(`[Neurovendas][${requestId}] fallback=invalid-json durationMs=${Date.now() - startedAt}`);
        return { success: true, analysis: fallback, fallback: true };
      }

      // Validação pós-parse não-bloqueante com helper centralizado
      const perfilPsicografico = (analysis as any)?.perfilPsicografico;
      if (perfilPsicografico?.discProfile) {
        const disc = perfilPsicografico.discProfile as any;
        disc.motivadores = sanitizeUnsupportedClaims(analysisTranscript, disc.motivadores || []);
        disc.medosOuResistencias = sanitizeUnsupportedClaims(analysisTranscript, disc.medosOuResistencias || []);
        perfilPsicografico.discProfile = enforceLowConfidenceWhenSparse(disc, analysisTranscript);
      }
      const warnings = validateNeurovendasAnalysis(analysis, 'crc');
      if (warnings.length > 0) {
        console.warn(`[NEUROVENDAS-CRC] ${warnings.length} warning(s) na análise da ligação ${input.callId}`);
      }

      // Save analysis to call
      await updateCall(input.callId, {
        neurovendasAnalysis: analysis as any,
        status: "analyzed",
      });

      // Also update lead's callProfile with the psychographic profile (DISC + legado)
      if (call.leadId) {
        const lead = await getLeadById(call.leadId);
        if (lead) {
          const perfil = analysis.perfilPsicografico as any;
          await updateLead(call.leadId, {
            callProfile: {
              discProfile: perfil?.discProfile || null,
              nivelCerebralDominante: perfil?.nivelCerebralDominante || 'limbico',
              probabilidadeAgendamento: Math.min(100, Math.max(0, Math.round(((perfil?.nivelReceptividade || 0) <= 10 ? (perfil?.nivelReceptividade || 0) * 10 : perfil?.nivelReceptividade || 0)))),
              resumo: perfil?.discProfile?.resumo || perfil?.descricaoPerfil || '',
            },
            neurovendasAnalysis: analysis as any,
          });
        }
      }

      console.log(`[Neurovendas][${requestId}] success durationMs=${Date.now() - startedAt}`);
      return { success: true, analysis };
    }),

  // Finalize call with scheduling result
  finalize: protectedProcedure
    .input(z.object({
      callId: z.number(),
      schedulingResult: z.enum(["scheduled", "not_scheduled", "callback", "no_answer"]),
      schedulingNotes: z.string().optional(),
      observations: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const call = await getCallById(input.callId);
      if (!call || call.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ligação não encontrada" });
      }

      await finalizeCall(input.callId, {
        schedulingResult: input.schedulingResult,
        schedulingNotes: input.schedulingNotes,
        observations: input.observations,
      });

      return { success: true };
    }),
});
