import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, protectedSubscriptionProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createPatient,
  getPatientsByDentist,
  getPatientById,
  updatePatient,
  deletePatient,
  createConsultation,
  getConsultationsByDentist,
  getConsultationById,
  updateConsultation,
  getConsultationsByPatient,
  createFeedback,
  getFeedbackByConsultation,
  updateUserCRO,
  updateDentistProfile,
  getUserById,
  createAudioChunk,
  getAudioChunksBySession,
  deleteAudioChunks,
} from "./db";
import { storagePut } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { SOAPNote } from "../drizzle/schema";
import { nanoid } from "nanoid";
import { stripe, isStripeConfigured } from "./stripe/stripe";
import { STRIPE_PRODUCTS } from "./stripe/products";
import { updateUserSubscription, getUserByStripeCustomerId, updateUserByStripeCustomerId } from "./db";

// Zod schemas for validation
const createPatientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  cpf: z.string().optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
});

const updatePatientSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  cpf: z.string().optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
});

const soapNoteSchema = z.object({
  urgency: z.enum(["high", "medium", "low"]).optional(),
  subjective: z.object({
    queixa_principal: z.string(),
    historia_doenca_atual: z.string(),
    historico_medico: z.array(z.string()),
    medicacoes: z.array(z.object({
      nome: z.string(),
      dose: z.string(),
      frequencia: z.string(),
    })),
  }),
  objective: z.object({
    exame_clinico_geral: z.string(),
    exame_clinico_especifico: z.array(z.string()),
    dentes_afetados: z.array(z.string()),
    classificacoes_dentes: z.array(z.object({
      numero: z.string(),
      classificacao: z.enum(["not_evaluated", "healthy", "cavity", "restored", "missing", "fractured", "root_canal", "crown", "extraction"]),
      notas: z.string().optional(),
    })).optional(),
  }),
  assessment: z.object({
    diagnosticos: z.array(z.string()),
    red_flags: z.array(z.string()),
  }),
  plan: z.object({
    tratamentos: z.array(z.object({
      procedimento: z.string(),
      dente: z.string(),
      urgencia: z.enum(["alta", "media", "baixa"]),
      prazo: z.string().optional(),
    })),
    orientacoes: z.array(z.string()),
    lembretes_clinicos: z.array(z.string()),
  }),
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateCRO: protectedProcedure
      .input(z.object({ croNumber: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await updateUserCRO(ctx.user.id, input.croNumber);
        return { success: true };
      }),
    getProfile: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserById(ctx.user.id);
        if (!user) throw new Error("User not found");
        return {
          name: user.name || '',
          croNumber: user.croNumber || '',
        };
      }),
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        croNumber: z.string().min(1, "CRO é obrigatório"),
        birthDate: z.string().optional(),
        clinicName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateDentistProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  patients: router({
    create: protectedProcedure
      .input(createPatientSchema)
      .mutation(async ({ ctx, input }) => {
        const patient = await createPatient({
          dentistId: ctx.user.id,
          ...input,
        });
        return { success: true, patient };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await getPatientsByDentist(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const patient = await getPatientById(input.id);
        if (!patient || patient.dentistId !== ctx.user.id) {
          throw new Error("Paciente não encontrado ou acesso negado");
        }
        return patient;
      }),

    update: protectedProcedure
      .input(updatePatientSchema)
      .mutation(async ({ ctx, input }) => {
        const patient = await getPatientById(input.id);
        if (!patient || patient.dentistId !== ctx.user.id) {
          throw new Error("Paciente não encontrado ou acesso negado");
        }
        const { id, ...updateData } = input;
        await updatePatient(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const patient = await getPatientById(input.id);
        if (!patient || patient.dentistId !== ctx.user.id) {
          throw new Error("Paciente não encontrado ou acesso negado");
        }
        await deletePatient(input.id);
        return { success: true };
      }),
  }),

  consultations: router({
    create: protectedProcedure
      .input(z.object({
        patientId: z.number(),
        patientName: z.string(),
        templateUsed: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await createConsultation({
          dentistId: ctx.user.id,
          patientId: input.patientId,
          patientName: input.patientName,
          templateUsed: input.templateUsed,
          status: "draft",
        });
        return { success: true, consultationId: result.id };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await getConsultationsByDentist(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.id);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }
        return consultation;
      }),

    getByPatient: protectedProcedure
      .input(z.object({ patientId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getConsultationsByPatient(input.patientId, ctx.user.id);
      }),

    uploadAudio: protectedProcedure
      .input(z.object({
        consultationId: z.number(),
        audioBase64: z.string(),
        mimeType: z.string(),
        durationSeconds: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        // Convert base64 to buffer
        const audioBuffer = Buffer.from(input.audioBase64, 'base64');
        
        // Generate unique file key
        const extension = input.mimeType.split('/')[1] || 'webm';
        const fileKey = `consultations/${ctx.user.id}/${input.consultationId}/audio-${nanoid()}.${extension}`;
        
        // Upload to S3
        const { url } = await storagePut(fileKey, audioBuffer, input.mimeType);

        // Update consultation with audio info
        await updateConsultation(input.consultationId, {
          audioUrl: url,
          audioFileKey: fileKey,
          audioDurationSeconds: input.durationSeconds || null,
        });

        return { success: true, audioUrl: url };
      }),

    // Upload audio chunk for progressive recording
    uploadAudioChunk: protectedProcedure
      .input(z.object({
        consultationId: z.number(),
        recordingSessionId: z.string(),
        chunkIndex: z.number(),
        audioBase64: z.string(),
        mimeType: z.string(),
        durationSeconds: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        // Convert base64 to buffer
        const audioBuffer = Buffer.from(input.audioBase64, 'base64');
        const sizeBytes = audioBuffer.length;
        
        // Generate unique file key for chunk
        const extension = input.mimeType.split('/')[1] || 'webm';
        const fileKey = `consultations/${ctx.user.id}/${input.consultationId}/chunks/${input.recordingSessionId}/chunk-${input.chunkIndex}.${extension}`;
        
        // Upload chunk to S3
        const { url } = await storagePut(fileKey, audioBuffer, input.mimeType);

        // Store chunk metadata in database
        await createAudioChunk({
          consultationId: input.consultationId,
          recordingSessionId: input.recordingSessionId,
          chunkIndex: input.chunkIndex,
          fileKey,
          url,
          mimeType: input.mimeType,
          sizeBytes,
          durationSeconds: input.durationSeconds || null,
        });

        return { success: true, chunkUrl: url };
      }),

    // Concatenate audio chunks and finalize recording
    finalizeAudioRecording: protectedProcedure
      .input(z.object({
        consultationId: z.number(),
        recordingSessionId: z.string(),
        totalDurationSeconds: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        // Get all chunks for this session
        const chunks = await getAudioChunksBySession(
          input.consultationId,
          input.recordingSessionId
        );

        if (chunks.length === 0) {
          throw new Error("Nenhum chunk de áudio encontrado para esta sessão");
        }

        // Download and concatenate all chunks
        const chunkBuffers: Buffer[] = [];
        for (const chunk of chunks) {
          const response = await fetch(chunk.url);
          if (!response.ok) {
            throw new Error(`Falha ao baixar chunk ${chunk.chunkIndex}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          chunkBuffers.push(Buffer.from(arrayBuffer));
        }

        // Concatenate all chunks into single buffer
        const concatenatedBuffer = Buffer.concat(chunkBuffers);
        
        // Upload final audio file
        const extension = chunks[0].mimeType.split('/')[1] || 'webm';
        const finalFileKey = `consultations/${ctx.user.id}/${input.consultationId}/audio-final-${nanoid()}.${extension}`;
        const { url: finalUrl } = await storagePut(
          finalFileKey,
          concatenatedBuffer,
          chunks[0].mimeType
        );

        // Update consultation with final audio
        await updateConsultation(input.consultationId, {
          audioUrl: finalUrl,
          audioFileKey: finalFileKey,
          audioDurationSeconds: input.totalDurationSeconds || null,
        });

        // Clean up chunks from database (keep files in S3 for safety)
        await deleteAudioChunks(input.consultationId, input.recordingSessionId);

        return { success: true, audioUrl: finalUrl };
      }),

    updateTranscript: protectedProcedure
      .input(z.object({
        consultationId: z.number(),
        transcript: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        await updateConsultation(input.consultationId, {
          transcript: input.transcript,
          status: "reviewed",
        });

        return { success: true };
      }),

    transcribe: protectedSubscriptionProcedure
      .input(z.object({ consultationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        if (!consultation.audioUrl) {
          throw new Error("Nenhum arquivo de áudio encontrado para esta consulta");
        }

        // Transcribe audio using Whisper
        const result = await transcribeAudio({
          audioUrl: consultation.audioUrl,
          language: "pt",
          prompt: "Consulta odontológica entre dentista e paciente. IMPORTANTE: Identifique e marque claramente cada falante usando 'Dentista:' ou 'Paciente:' no início de cada fala. Termos técnicos: cárie, gengivite, canal, restauração, periodontia, dente, molar, incisivo, prótese, implante, extração, obturação, profilaxia.",
        });

        if ('error' in result) {
          throw new Error(`Erro na transcrição: ${result.error}`);
        }

        // Update consultation with transcript
        await updateConsultation(input.consultationId, {
          transcript: result.text,
          transcriptSegments: result.segments || [],
          status: "transcribed",
        });

        return { success: true, transcript: result.text, segments: result.segments };
      }),

    analyzeAndGenerateSOAP: protectedSubscriptionProcedure
      .input(z.object({ consultationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        if (!consultation.transcript) {
          throw new Error("Nenhuma transcrição encontrada para esta consulta");
        }

        // Dental AI analysis prompt
        const prompt = `Você é um assistente de IA especializado em documentação odontológica brasileira.

TRANSCRIÇÃO DA CONSULTA:
${consultation.transcript}

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

FORMATO DE SAÍDA (JSON):
{
  "urgency": "high" | "medium" | "low",
  "subjective": {
    "queixa_principal": "string",
    "historia_doenca_atual": "string",
    "historico_medico": ["string"],
    "medicacoes": [{"nome": "string", "dose": "string", "frequencia": "string"}]
  },
  "objective": {
    "exame_clinico_geral": "string",
    "exame_clinico_especifico": ["string"],
    "dentes_afetados": ["16", "21"],
    "classificacoes_dentes": [{"numero": "16", "classificacao": "cavity|restored|missing|fractured|root_canal|crown|extraction|healthy|not_evaluated", "notas": "string opcional"}]
  },
  "assessment": {
    "diagnosticos": ["string"],
    "red_flags": ["string"]
  },
  "plan": {
    "tratamentos": [{"procedimento": "string", "dente": "string", "urgencia": "baixa|media|alta", "prazo": "string (ex: imediato, 1 semana, 1 mês, 3 meses)"}],
    "orientacoes": ["string"],
    "lembretes_clinicos": ["string"]
  }
}

Seja preciso, conciso e use terminologia clínica apropriada. NÃO INVENTE DADOS.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um assistente especializado em documentação odontológica brasileira. Sua prioridade é a fidelidade clínica - nunca invente dados." },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
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
                            frequencia: { type: "string" }
                          },
                          required: ["nome", "dose", "frequencia"],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ["queixa_principal", "historia_doenca_atual", "historico_medico", "medicacoes"],
                    additionalProperties: false
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
                            classificacao: { type: "string", enum: ["not_evaluated", "healthy", "cavity", "restored", "missing", "fractured", "root_canal", "crown", "extraction"] },
                            notas: { type: "string" }
                          },
                          required: ["numero", "classificacao", "notas"],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ["exame_clinico_geral", "exame_clinico_especifico", "dentes_afetados", "classificacoes_dentes"],
                    additionalProperties: false
                  },
                  assessment: {
                    type: "object",
                    properties: {
                      diagnosticos: { type: "array", items: { type: "string" } },
                      red_flags: { type: "array", items: { type: "string" } }
                    },
                    required: ["diagnosticos", "red_flags"],
                    additionalProperties: false
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
                            prazo: { type: "string" }
                          },
                          required: ["procedimento", "dente", "urgencia", "prazo"],
                          additionalProperties: false
                        }
                      },
                      orientacoes: { type: "array", items: { type: "string" } },
                      lembretes_clinicos: { type: "array", items: { type: "string" } }
                    },
                    required: ["tratamentos", "orientacoes", "lembretes_clinicos"],
                    additionalProperties: false
                  }
                },
                required: ["urgency", "subjective", "objective", "assessment", "plan"],
                additionalProperties: false
              }
            }
          }
        });

        // Parse response
        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Resposta vazia da IA");
        }
        
        const soapNote: SOAPNote = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));

        // Update consultation with SOAP note
        await updateConsultation(input.consultationId, {
          soapNote: soapNote,
        });

        return { success: true, soapNote };
      }),

    updateSOAP: protectedProcedure
      .input(z.object({
        consultationId: z.number(),
        soapNote: soapNoteSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        await updateConsultation(input.consultationId, {
          soapNote: input.soapNote as SOAPNote,
        });

        return { success: true };
      }),

    finalize: protectedProcedure
      .input(z.object({ consultationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        // Check if feedback exists (mandatory)
        const feedback = await getFeedbackByConsultation(input.consultationId);
        if (!feedback) {
          throw new Error("Feedback obrigatório antes de finalizar a consulta");
        }

        await updateConsultation(input.consultationId, {
          status: "finalized",
          finalizedAt: new Date(),
        });

        return { success: true };
      }),
  }),

  feedbacks: router({
    create: protectedProcedure
      .input(z.object({
        consultationId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        const feedback = await createFeedback({
          consultationId: input.consultationId,
          dentistId: ctx.user.id,
          rating: input.rating,
          comment: input.comment,
        });

        return { success: true, feedback };
      }),

    getByConsultation: protectedProcedure
      .input(z.object({ consultationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        const feedback = await getFeedbackByConsultation(input.consultationId);
        return feedback ?? null;
      }),
  }),

  billing: router({
    // Start free trial
    startTrial: protectedProcedure.mutation(async ({ ctx }) => {
      const { startUserTrial } = await import('./db');
      const { calculateTrialEndDate } = await import('./billing');
      
      const user = await getUserById(ctx.user.id);
      if (!user) throw new Error("Usuário não encontrado");
      
      // Check if user already has a trial or subscription
      if (user.trialStartedAt || user.subscriptionStatus === 'active') {
        throw new Error("Você já possui um trial ou assinatura ativa");
      }
      
      const trialEndDate = calculateTrialEndDate();
      await startUserTrial(ctx.user.id, trialEndDate);
      
      return { success: true, trialEndsAt: trialEndDate };
    }),
  }),

  stripe: router({
    // Get subscription status and available plans
    getSubscriptionInfo: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new Error("Usuário não encontrado");

      return {
        subscriptionStatus: user.subscriptionStatus,
        priceId: user.priceId,
        subscriptionEndDate: user.subscriptionEndDate,
        plans: Object.entries(STRIPE_PRODUCTS).map(([key, plan]) => ({
          key,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          features: plan.features,
        })),
      };
    }),

    // Create checkout session for subscription
    createCheckoutSession: protectedProcedure
      .input(z.object({
        priceId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!stripe || !isStripeConfigured()) {
          throw new Error("Stripe não está configurado");
        }

        const user = await getUserById(ctx.user.id);
        if (!user) throw new Error("Usuário não encontrado");

        // Get or create Stripe customer
        let customerId = user.stripeCustomerId;
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email || undefined,
            name: user.name || undefined,
            metadata: {
              user_id: ctx.user.id.toString(),
            },
          });
          customerId = customer.id;
          await updateUserSubscription(ctx.user.id, { stripeCustomerId: customerId });
        }

        // Create checkout session
        const origin = ctx.req.headers.origin || 'http://localhost:3000';
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          client_reference_id: ctx.user.id.toString(),
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: input.priceId,
              quantity: 1,
            },
          ],
          success_url: `${origin}/subscription?success=true`,
          cancel_url: `${origin}/subscription?canceled=true`,
          allow_promotion_codes: true,
          metadata: {
            user_id: ctx.user.id.toString(),
            customer_email: user.email || '',
            customer_name: user.name || '',
          },
        });

        return { checkoutUrl: session.url };
      }),

    // Create portal session for managing subscription
    createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
      if (!stripe || !isStripeConfigured()) {
        throw new Error("Stripe não está configurado");
      }

      const user = await getUserById(ctx.user.id);
      if (!user || !user.stripeCustomerId) {
        throw new Error("Nenhuma assinatura encontrada");
      }

      const origin = ctx.req.headers.origin || 'http://localhost:3000';
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${origin}/subscription`,
      });

      return { portalUrl: session.url };
    }),
  }),
});

export type AppRouter = typeof appRouter;