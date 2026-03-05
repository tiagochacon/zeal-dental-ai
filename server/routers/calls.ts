import { router, protectedProcedure } from "../_core/trpc";
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
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
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

export const callsRouter = router({
  // Create a new call record
  create: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      leadName: z.string(),
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
  analyzeNeurovendas: protectedProcedure
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

      if (!call.transcript) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ligação não possui transcrição para análise" });
      }

      // Return cached analysis if exists
      if (call.neurovendasAnalysis) {
        return { success: true, analysis: call.neurovendasAnalysis, cached: true };
      }

      const metodologiaContext = await getMetodologiaContext();
      const leadWordCount = countPatientWords(call.transcript || '');

      const systemMessage = `Você é um especialista em análise comportamental e neurovendas odontológicas, baseado na metodologia do Dr. Carlos Rodriguez. Sua função é EXCLUSIVAMENTE analisar transcrições de ligações comerciais (CRC → Lead) e extrair padrões de comportamento, motivações e técnicas de comunicação.

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
   - Esta é uma ligação de prospecção/agendamento telefônico.
   - O foco é agendamento, NÃO fechamento de tratamento.
   - Scripts e gatilhos devem refletir esse objetivo.

5. METODOLOGIA:
   - Use apenas os documentos de metodologia fornecidos — não use conhecimento externo.`;

      const prompt = `DOCUMENTOS DE METODOLOGIA (base obrigatória para toda análise):
${metodologiaContext}

--- FIM DOS DOCUMENTOS ---

CONTEXTO DA LIGAÇÃO:
- Número de palavras do lead: ~${leadWordCount} palavras
- Tipo: Ligação comercial CRC → Lead (prospecção/agendamento)
- Metodologia disponível: sim

TRANSCRIÇÃO DA LIGAÇÃO:
${call.transcript}

INSTRUÇÕES ESPECÍFICAS:

1. Analise a transcrição acima e extraia os padrões de comportamento do LEAD (não do CRC).

2. Identifique:
   a) Nível cerebral dominante (reptiliano, limbico, neocortex)
   b) Motivação primária (alivio_dor, estetica, status, saude)
   c) Gatilhos mentais (transformacao, saude_longevidade, status, conforto, exclusividade)
   d) Objeções verdadeiras e ocultas (categoria: financeira, medo, tempo, confianca, outra)
   e) Técnicas de objeção sugeridas (LAER ou redirecionamento)
   f) Nível de rapport (0-100) e breakdown
   g) Sinais de linguagem (positivos e negativos)

3. Preencha TODOS os campos do schema — nunca deixe vazio.

4. ${leadWordCount < 100 ? `ATENÇÃO: Transcrição com apenas ~${leadWordCount} palavras do lead. Indique 'Amostra insuficiente' na descrição do perfil, mas continue preenchendo todos os campos.` : 'Transcrição com volume adequado para análise.'}

5. Use EXATAMENTE os valores de enum definidos no schema — sem variações.

6. Para scriptPARE: crie um script COMPLETO adaptado ao contexto de AGENDAMENTO desta ligação.

7. Para tecnicaObjecao: forneça passos ESPECÍFICOS para o CRC usar na próxima ligação.

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
                    nivelCerebralDominante: { type: "string", enum: ["neocortex", "limbico", "reptiliano"] },
                    motivacaoPrimaria: { type: "string", enum: ["alivio_dor", "estetica", "status", "saude"] },
                    nivelAnsiedade: { type: "number" },
                    nivelReceptividade: { type: "number" },
                    descricaoPerfil: { type: "string" }
                  },
                  required: ["nivelCerebralDominante", "motivacaoPrimaria", "nivelAnsiedade", "nivelReceptividade", "descricaoPerfil"],
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
                          texto: { type: "string" },
                          sinaisDetectados: { type: "string" },
                          perguntaReveladora: { type: "string" }
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
                }
              },
              required: ["perfilPsicografico", "objecoes", "sinaisLinguagem", "gatilhosMentais", "scriptPARE", "tecnicaObjecao", "rapport"],
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
        return { success: true, analysis: fallback, fallback: true };
      }

      const analysisContent = response.choices?.[0]?.message?.content;
      if (!analysisContent || typeof analysisContent !== 'string') {
        console.error('[NEUROVENDAS-CRC] Resposta vazia do LLM — usando fallback seguro');
        const fallback = getNeurovendasFallback();
        await updateCall(input.callId, { neurovendasAnalysis: fallback as any, status: "analyzed" });
        return { success: true, analysis: fallback, fallback: true };
      }

      let analysis: Record<string, unknown>;
      try {
        analysis = JSON.parse(analysisContent);
      } catch {
        console.error('[NEUROVENDAS-CRC] JSON inválido na resposta — usando fallback seguro');
        const fallback = getNeurovendasFallback();
        await updateCall(input.callId, { neurovendasAnalysis: fallback as any, status: "analyzed" });
        return { success: true, analysis: fallback, fallback: true };
      }

      // Validação pós-parse não-bloqueante com helper centralizado
      const warnings = validateNeurovendasAnalysis(analysis, 'crc');
      if (warnings.length > 0) {
        console.warn(`[NEUROVENDAS-CRC] ${warnings.length} warning(s) na análise da ligação ${input.callId}`);
      }

      // Save analysis to call
      await updateCall(input.callId, {
        neurovendasAnalysis: analysis as any,
        status: "analyzed",
      });

      // Also update lead's callProfile with the psychographic profile
      if (call.leadId) {
        const lead = await getLeadById(call.leadId);
        if (lead) {
          const perfil = analysis.perfilPsicografico as any;
          await updateLead(call.leadId, {
            callProfile: {
              nivelCerebralDominante: perfil?.nivelCerebralDominante || 'limbico',
              probabilidadeAgendamento: Math.min(100, Math.max(0, Math.round(((perfil?.nivelReceptividade || 0) <= 10 ? (perfil?.nivelReceptividade || 0) * 10 : perfil?.nivelReceptividade || 0)))),
              resumo: perfil?.descricaoPerfil || '',
            },
            neurovendasAnalysis: analysis as any,
          });
        }
      }

      return { success: true, analysis };
    }),

  // Finalize call with scheduling result
  finalize: protectedProcedure
    .input(z.object({
      callId: z.number(),
      schedulingResult: z.enum(["scheduled", "not_scheduled", "callback", "no_answer"]),
      schedulingNotes: z.string().optional(),
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
      });

      return { success: true };
    }),
});
