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
import { getMetodologiaContext } from "../_core/metodologiaLoader";
import { validateNeurovendasAnalysis } from "../helpers/validateNeurovendasAnalysis";
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

      // RAG: Carregar documentos de metodologia
      const metodologiaContext = await getMetodologiaContext();

      const prompt = `=== DOCUMENTAÇÃO DE METODOLOGIA (BASE DE CONHECIMENTO OBRIGATÓRIA) ===
${metodologiaContext}
=== FIM DA DOCUMENTAÇÃO ===

AGORA, analise a seguinte transcrição de LIGAÇÃO COMERCIAL entre um CRC (Consultor de Relacionamento com o Cliente) de uma clínica odontológica e um LEAD (prospect/potencial paciente).
Toda a análise DEVE ser ancorada nos documentos acima. Use a nomenclatura exata dos documentos.

TRANSCRIÇÃO:
${call.transcript}

CONTEXTO: Esta é uma ligação de prospecção/agendamento. O CRC está tentando agendar uma consulta para o lead na clínica. Diferente de uma consulta presencial, aqui o foco é na comunicação telefônica e técnicas de agendamento.

Com base na transcrição E nos documentos de metodologia fornecidos, analise:

1. PERFIL PSICOGRÁFICO DO LEAD:
- Identifique o nível cerebral dominante (Neocórtex/Límbico/Reptiliano) conforme descrito nos documentos
- Determine a motivação primária (Alívio da Dor, Estética, Status, Saúde)
- Avalie o nível de receptividade (1-10) à proposta de agendamento com base em evidências textuais

2. OBJEÇÕES IDENTIFICADAS:
- Liste APENAS objeções que aparecem explicitamente ou fortemente implícitas na transcrição
- Para CADA objeção, forneça um SCRIPT COMPLETO de resposta usando a técnica LAER dos documentos:
  * L (Listen/Ouvir): Reconheça a preocupação
  * A (Acknowledge/Aceitar): Valide o sentimento
  * E (Explore/Explorar): Perguntas para entender melhor
  * R (Respond/Responder): Solução personalizada baseada nos scripts dos documentos
- Liste possíveis objeções ocultas/falsas com perguntas reveladoras
- Classifique cada objeção (financeira, medo, tempo, confiança)

3. SINAIS DE LINGUAGEM:
- Sinais positivos: cite palavras LITERAIS do lead
- Sinais de resistência: cite palavras LITERAIS
- Palavras-chave emocionais usadas pelo lead

4. GATILHOS MENTAIS RECOMENDADOS:
- Use APENAS gatilhos catalogados nos documentos de metodologia fornecidos
- Liste os 3 mais eficazes para este lead com justificativa
- Se os documentos não cobrem um gatilho específico, deixe o campo vazio

5. SCRIPT DE FECHAMENTO (Modelo PARE conforme documentos):
- Problema: Como abordar a necessidade do lead
- Amplificação: Como mostrar urgência do agendamento
- Resolução: Como apresentar a consulta como solução
- Engajamento: Como criar compromisso de agendamento

6. NÍVEL DE RAPPORT (0-100):
Calcule usando os critérios dos documentos de metodologia:
a) VALIDAÇÃO EMOCIONAL (máx 30 pts)
b) ESPELHAMENTO LINGUÍSTICO (máx 25 pts)
c) ESCUTA ATIVA (máx 20 pts)
d) EQUILÍBRIO DE TURNOS (máx 15 pts)
e) AUSÊNCIA DE INTERRUPÇÕES (máx 10 pts)

7. RESUMO EXECUTIVO:
- Síntese da análise em 2-3 frases, ancorada nos conceitos dos documentos

Responda em JSON estruturado.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: `Você é um analista de Neurovendas aplicadas ao agendamento odontológico. Seu ÚNICO referencial teórico são os documentos de metodologia fornecidos no início do prompt do usuário.

REGRAS INVIOLÁVEIS:
1. NÃO use conhecimento externo sobre vendas, PNL ou persuasão que não esteja nos documentos fornecidos.
2. Use a nomenclatura EXATA dos documentos (nomes de técnicas, categorias de perfil, gatilhos mentais).
3. Se os documentos não cobrem um aspecto específico, preencha o campo com "Não documentado na metodologia" em vez de inventar.
4. Baseie toda análise em evidências textuais diretas da transcrição da ligação.
5. Objeções: liste APENAS o que o lead expressou explicitamente — NÃO suponha objeções por ser uma ligação de venda.
6. Sinais de linguagem: cite APENAS palavras literais do lead, não paráfrases.
7. Scripts LAER: devem ser derivados dos modelos e exemplos presentes nos documentos fornecidos, endereçando a objeção específica identificada.
8. nivelReceptividade: calibre com base no que o lead disse, não no resultado final da ligação.
9. Se a transcrição tiver menos de 100 palavras do lead, reduza proporcionalidade das conclusões e indique limitação nos campos de descrição.` },
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

      // Validação pós-parse não-bloqueante (campos obrigatórios + enums)
      validateNeurovendasAnalysis(analysis, "crc");

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
