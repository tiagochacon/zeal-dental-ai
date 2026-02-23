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
import { nanoid } from "nanoid";

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
      const ext = input.mimeType.includes("webm") ? "webm" : input.mimeType.includes("mp3") ? "mp3" : "wav";
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
        prompt: "Transcrição de ligação comercial entre CRC de clínica odontológica e lead/prospect",
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

      const prompt = `Você é um especialista em Neurovendas aplicadas ao agendamento odontológico, baseado na metodologia do Dr. Carlos Rodriguez.

Analise a seguinte transcrição de LIGAÇÃO COMERCIAL entre um CRC (Consultor de Relacionamento com o Cliente) de uma clínica odontológica e um LEAD (prospect/potencial paciente):

TRANSCRIÇÃO:
${call.transcript}

CONTEXTO: Esta é uma ligação de prospecção/agendamento. O CRC está tentando agendar uma consulta para o lead na clínica. Diferente de uma consulta presencial, aqui o foco é na comunicação telefônica e técnicas de agendamento.

Com base na transcrição, analise:

1. PERFIL PSICOGRÁFICO DO LEAD:
- Identifique o nível cerebral dominante (Neocórtex/Límbico/Reptiliano)
- Determine a motivação primária (Alívio da Dor, Estética, Status, Saúde)
- Avalie o nível de receptividade (1-10) à proposta de agendamento

2. OBJEÇÕES IDENTIFICADAS:
- Liste objeções verdadeiras detectadas na transcrição
- Para CADA objeção, forneça uma RESPOSTA SUGERIDA COMPLETA usando a técnica LAER:
  * L (Listen/Ouvir): Reconheça a preocupação do lead
  * A (Acknowledge/Aceitar): Valide o sentimento
  * E (Explore/Explorar): Faça perguntas para entender melhor
  * R (Respond/Responder): Ofereça uma solução personalizada
- A resposta deve ser um SCRIPT COMPLETO que o CRC pode usar na próxima ligação
- Liste possíveis objeções ocultas/falsas com perguntas reveladoras
- Classifique cada objeção (financeira, medo, tempo, confiança)

3. SINAIS DE LINGUAGEM:
- Sinais positivos de interesse no agendamento
- Sinais de resistência ou objeção oculta
- Palavras-chave emocionais usadas pelo lead

4. GATILHOS MENTAIS RECOMENDADOS:
- Liste os 3 gatilhos mais eficazes para este lead
- Explique por que cada gatilho é adequado para agendamento

5. SCRIPT DE FECHAMENTO (Modelo PARE):
- Problema: Como abordar a necessidade do lead
- Amplificação: Como mostrar urgência do agendamento
- Resolução: Como apresentar a consulta como solução
- Engajamento: Como criar compromisso de agendamento

6. NÍVEL DE RAPPORT (0-100):
Calcule usando os mesmos critérios:
a) VALIDAÇÃO EMOCIONAL (máx 30 pts)
b) ESPELHAMENTO LINGUÍSTICO (máx 25 pts)
c) ESCUTA ATIVA (máx 20 pts)
d) EQUILÍBRIO DE TURNOS (máx 15 pts)
e) AUSÊNCIA DE INTERRUPÇÕES (máx 10 pts)

Responda em JSON estruturado.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um especialista em Neurovendas aplicadas ao agendamento odontológico, treinado na metodologia do Dr. Carlos Rodriguez. Sua análise deve ser prática e focada em ajudar o CRC a melhorar suas técnicas de agendamento e conversão de leads." },
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

      const analysisContent = response.choices?.[0]?.message?.content;
      if (!analysisContent || typeof analysisContent !== 'string') {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao gerar análise de Neurovendas" });
      }

      const analysis = JSON.parse(analysisContent);

      // Save analysis to call
      await updateCall(input.callId, {
        neurovendasAnalysis: analysis,
        status: "analyzed",
      });

      // Also update lead's callProfile with the psychographic profile
      if (call.leadId) {
        const lead = await getLeadById(call.leadId);
        if (lead) {
          await updateLead(call.leadId, {
            callProfile: {
              nivelCerebralDominante: analysis.perfilPsicografico.nivelCerebralDominante,
              probabilidadeAgendamento: analysis.perfilPsicografico.nivelReceptividade * 10,
              resumo: analysis.perfilPsicografico.descricaoPerfil,
            },
            neurovendasAnalysis: analysis,
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
