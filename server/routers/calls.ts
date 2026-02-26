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

      const metodologiaContext = await getMetodologiaContext();

      const prompt = `DOCUMENTOS DE METODOLOGIA (base obrigatória para toda análise):
${metodologiaContext}

--- FIM DOS DOCUMENTOS ---

TRANSCRIÇÃO DA LIGAÇÃO COMERCIAL (CRC → Lead):
${call.transcript}

CONTEXTO: Esta é uma ligação de prospecção/agendamento telefônico. O CRC está tentando agendar uma consulta para o lead/prospect na clínica odontológica. O foco é na comunicação telefônica e técnicas de agendamento — não fechamento de tratamento.

INSTRUÇÃO PRINCIPAL:
Analise a transcrição acima usando EXCLUSIVAMENTE os frameworks, técnicas, nomenclaturas e categorias definidos nos DOCUMENTOS DE METODOLOGIA acima. Se um conceito pedido abaixo não estiver documentado, deixe o campo vazio ('') ou array vazio ([]).

1. PERFIL COMPORTAMENTAL DO LEAD:
- Identifique o perfil/nível cerebral dominante usando EXATAMENTE a nomenclatura dos documentos
- Determine a motivação primária conforme categorias dos documentos
- Avalie o nível de receptividade ao agendamento (1-10) com base em evidências textuais da transcrição

2. OBJEÇÕES IDENTIFICADAS:
- Liste APENAS objeções expressas explicitamente pelo lead na transcrição. Não suponha objeções por ser uma ligação de venda.
- Para CADA objeção, forneça SCRIPT COMPLETO de resposta derivado dos modelos dos documentos, que o CRC pode usar na próxima ligação
- Liste possíveis objeções ocultas/falsas somente se evidenciadas na transcrição

3. SINAIS DE LINGUAGEM:
- Cite APENAS palavras literais do lead encontradas na transcrição (não paráfrases)
- Sinais positivos de interesse no agendamento
- Sinais de resistência ou objeção oculta

4. GATILHOS MENTAIS RECOMENDADOS:
- Liste APENAS gatilhos catalogados nos documentos de metodologia, adequados para contexto de agendamento

5. SCRIPT DE FECHAMENTO:
- Use o modelo definido nos documentos adaptado ao objetivo de agendamento desta ligação

6. NÍVEL DE RAPPORT (0-100):
- Calcule usando os critérios e pesos definidos nos documentos de metodologia
- Cite evidência textual da transcrição para cada critério pontuado

RESTRIÇÕES ANTI-ALUCINAÇÃO:
- Use APENAS nomenclaturas e categorias dos documentos fornecidos
- Cite a frase exata da transcrição para cada conclusão comportamental
- Se a transcrição tiver menos de 100 palavras do lead, indique 'Amostra insuficiente — conclusões com baixa confiança' em descricaoPerfil
- NÃO complete com conhecimento geral de vendas externo aos documentos
- Responda em JSON estruturado`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um especialista em análise de perfil comportamental e comunicação persuasiva aplicada ao agendamento odontológico. Sua única base de conhecimento para esta análise são os DOCUMENTOS DE METODOLOGIA fornecidos no contexto do usuário. NÃO use conhecimento externo sobre vendas, psicologia ou neuromarketing que não esteja explicitamente nesses documentos.\n\nREGRAS DE FIDELIDADE DOCUMENTAL:\n1. Cada framework, técnica, categoria ou script que você citar deve ter origem rastreável nos documentos de metodologia fornecidos. Se não encontrar, use '' ou [] para o campo.\n2. Os perfis de comportamento do lead devem usar EXATAMENTE a nomenclatura presente nos documentos — não renomeie nem adapte.\n3. As técnicas de resposta a objeções devem seguir EXATAMENTE a estrutura definida nos documentos.\n4. Gatilhos mentais: liste APENAS os catalogados nos documentos. Não invente gatilhos não documentados.\n5. Scripts sugeridos devem ser derivados dos modelos e exemplos dos documentos, adaptados à transcrição.\n6. Se os documentos NÃO cobrem algum aspecto do JSON schema, retorne '' ou [].\n\nREGRAS DE PRECISÃO BASEADA EM EVIDÊNCIA TEXTUAL:\n1. Baseie toda análise em evidências textuais diretas da transcrição da ligação.\n2. Se o lead não disse nada que indique um perfil claro, use o tipo mais neutro disponível com baixa confiança.\n3. Objeções verdadeiras: liste APENAS o que o lead expressou explicitamente. Não suponha objeções por ser uma ligação de venda.\n4. Scripts de resposta: devem endereçar a objeção específica identificada, não ser scripts genéricos.\n5. nivelReceptividade: calibre com base no que o lead disse, não no resultado final da ligação.\n6. Rapport: pontue APENAS com base em comportamentos observáveis na transcrição.\n7. Esta é uma ligação telefônica de prospecção — o contexto é agendamento, não fechamento de tratamento. Scripts e gatilhos devem refletir esse objetivo conforme definido nos documentos.\n8. Se a transcrição tiver menos de 100 palavras do lead, declare explicitamente em descricaoPerfil: 'Amostra insuficiente — conclusões com baixa confiança'." },
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

      // Validação de ancoragem documental — não-bloqueante
      if (!analysis.perfilPsicografico?.descricaoPerfil || analysis.perfilPsicografico.descricaoPerfil.length < 20) {
        console.warn('[NEUROVENDAS-CRC] descricaoPerfil vazio ou muito curto — possível falha de ancoragem documental');
      }
      if (!Array.isArray(analysis.objecoes?.verdadeiras)) {
        console.warn('[NEUROVENDAS-CRC] objecoes.verdadeiras ausente — possível falha de estrutura na resposta da IA');
      }

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
