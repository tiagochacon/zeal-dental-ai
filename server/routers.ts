import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, protectedSubscriptionProcedure, consultationLimitProcedure, negotiationAccessProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createPatient,
  getPatientsByDentist,
  getPatientById,
  updatePatient,
  deletePatient,
  getPatientByNameForDentist,
  createConsultation,
  getConsultationsByDentist,
  getConsultationById,
  updateConsultation,
  getConsultationsByPatient,
  createFeedback,
  getFeedbackByConsultation,
  deleteFeedbacksByConsultation,
  updateUserCRO,
  updateDentistProfile,
  getUserById,
  createAudioChunk,
  getAudioChunksBySession,
  deleteAudioChunks,
  getAudioChunksByConsultation,
  deleteAudioChunksByConsultation,
  deleteConsultation,
  resetUserAccount,
} from "./db";
import { storagePut, storageDelete } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { SOAPNote, TreatmentPlan } from "../drizzle/schema";
import { nanoid } from "nanoid";
import { stripe, isStripeConfigured } from "./stripe/stripe";
import { STRIPE_PRODUCTS } from "./stripe/products";
import { updateUserSubscription, getUserByStripeCustomerId, updateUserByStripeCustomerId, incrementConsultationCount } from "./db";
import { createUser, authenticateUser, isAdminEmail, getUserByIdAuth } from "./auth";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

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

const treatmentPlanSchema = z.object({
  summary: z.string().optional(),
  steps: z.array(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    duration: z.string().optional(),
    frequency: z.string().optional(),
    notes: z.string().optional(),
  })),
  medications: z.array(z.object({
    name: z.string().min(1),
    dose: z.string().min(1),
    frequency: z.string().min(1),
    duration: z.string().optional(),
    notes: z.string().optional(),
  })),
  postOpInstructions: z.array(z.string()),
  warnings: z.array(z.string()),
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
    register: publicProcedure
      .input(z.object({
        email: z.string().email("Email invalido"),
        password: z.string().min(6, "Senha minimo 6 caracteres"),
        name: z.string().min(1, "Nome obrigatorio"),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await createUser({ email: input.email, password: input.password, name: input.name });
        
        // Create session token and set cookie using openId
        const sessionToken = await sdk.createSessionToken(user.openId, { 
          expiresInMs: ONE_YEAR_MS,
          name: user.name 
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      }),
    emailLogin: publicProcedure
      .input(z.object({ email: z.string().email("Email invalido"), password: z.string().min(1, "Senha obrigatoria") }))
      .mutation(async ({ ctx, input }) => {
        const user = await authenticateUser(input.email, input.password);
        
        // Create session token and set cookie using openId
        const sessionToken = await sdk.createSessionToken(user.openId, { 
          expiresInMs: ONE_YEAR_MS,
          name: user.name || '' 
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        
        return { id: user.id, email: user.email, name: user.name, role: user.role, subscriptionStatus: user.subscriptionStatus };
      }),
  }),

  patients: router({
    create: protectedProcedure
      .input(createPatientSchema)
      .mutation(async ({ ctx, input }) => {
        const existing = await getPatientByNameForDentist(ctx.user.id, input.name);
        if (existing) {
          throw new Error("Já existe um paciente com este nome.");
        }
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

    getTreatmentPlan: protectedProcedure
      .input(z.object({ consultationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }
        return consultation.treatmentPlan || null;
      }),

    updateTreatmentPlan: protectedProcedure
      .input(z.object({
        consultationId: z.number(),
        treatmentPlan: treatmentPlanSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }
        await updateConsultation(input.consultationId, {
          treatmentPlan: input.treatmentPlan,
        });
        return { success: true };
      }),

    generateTreatmentPlan: protectedProcedure
      .input(z.object({ consultationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        const patient = await getPatientById(consultation.patientId);
        if (!patient) {
          throw new Error("Paciente não encontrado");
        }

        const soapNote = consultation.soapNote as SOAPNote | null;
        if (!soapNote) {
          throw new Error("Nota SOAP não disponível para gerar plano");
        }

        const prompt = `Você é um assistente de IA odontológico especializado em planos de tratamento detalhados.\n\nGere um plano estruturado em JSON estritamente no formato abaixo, em português, com linguagem clínica clara e instruções detalhadas:\n\n{\n  \"summary\": \"...\",\n  \"steps\": [\n    {\n      \"title\": \"...\",\n      \"description\": \"...\",\n      \"duration\": \"...\",\n      \"frequency\": \"...\",\n      \"notes\": \"...\"\n    }\n  ],\n  \"medications\": [\n    {\n      \"name\": \"...\",\n      \"dose\": \"...\",\n      \"frequency\": \"...\",\n      \"duration\": \"...\",\n      \"notes\": \"...\"\n    }\n  ],\n  \"postOpInstructions\": [\"...\"],\n  \"warnings\": [\"...\"]\n}\n\nContexto:\n- Paciente: ${patient.name}\n- Histórico médico: ${patient.medicalHistory || "Não informado"}\n- Alergias: ${patient.allergies || "Não informado"}\n- Medicações em uso: ${patient.medications || "Não informado"}\n- Achados clínicos (SOAP): ${JSON.stringify(soapNote)}\n\nRegras:\n- Inclua cronogramas precisos (ex: \"a cada 12h por 8 dias\").\n- Inclua instruções pós-operatórias quando aplicável.\n- Não invente dados fora do contexto clínico fornecido.\n- Se não houver medicamento, deixe medications como array vazio.\n- Retorne apenas JSON válido.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um assistente especializado em planos odontológicos. Nunca invente dados clínicos." },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "treatment_plan",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        duration: { type: "string" },
                        frequency: { type: "string" },
                        notes: { type: "string" }
                      },
                      required: ["title", "description"],
                      additionalProperties: false
                    }
                  },
                  medications: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        dose: { type: "string" },
                        frequency: { type: "string" },
                        duration: { type: "string" },
                        notes: { type: "string" }
                      },
                      required: ["name", "dose", "frequency"],
                      additionalProperties: false
                    }
                  },
                  postOpInstructions: { type: "array", items: { type: "string" } },
                  warnings: { type: "array", items: { type: "string" } }
                },
                required: ["steps", "medications", "postOpInstructions", "warnings"],
                additionalProperties: false
              }
            }
          }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Resposta vazia da IA");
        }

        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as TreatmentPlan;
        const validated = treatmentPlanSchema.parse(parsed);
        await updateConsultation(input.consultationId, {
          treatmentPlan: validated,
        });

        return { success: true, treatmentPlan: validated };
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

    delete: protectedProcedure
      .input(z.object({ consultationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        const chunkFiles = await getAudioChunksByConsultation(input.consultationId);
        const deleteKeys = [
          consultation.audioFileKey,
          ...chunkFiles.map(chunk => chunk.fileKey),
        ].filter(Boolean) as string[];

        for (const key of deleteKeys) {
          await storageDelete(key);
        }

        await deleteFeedbacksByConsultation(input.consultationId);
        await deleteAudioChunksByConsultation(input.consultationId);
        await deleteConsultation(input.consultationId);

        return { success: true };
      }),

    analyzeAndGenerateSOAP: consultationLimitProcedure
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

ANÁLISE DE PERFIL NEUROLÓGICO DO PACIENTE:
Baseado na transcrição, classifique o perfil predominante do paciente:

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
  },
  "patientProfile": {
    "type": "reptilian" | "neocortex" | "limbic",
    "confidence": 0-100,
    "primaryTraits": ["trait1", "trait2"],
    "detectedKeywords": ["palavra1", "palavra2"],
    "recommendedApproach": "descrição breve da abordagem recomendada",
    "triggers": {
      "positive": ["gatilho positivo 1", "gatilho positivo 2"],
      "negative": ["gatilho negativo 1", "gatilho negativo 2"]
    }
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
                  },
                  patientProfile: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["reptilian", "neocortex", "limbic"] },
                      confidence: { type: "number" },
                      primaryTraits: { type: "array", items: { type: "string" } },
                      detectedKeywords: { type: "array", items: { type: "string" } },
                      recommendedApproach: { type: "string" },
                      triggers: {
                        type: "object",
                        properties: {
                          positive: { type: "array", items: { type: "string" } },
                          negative: { type: "array", items: { type: "string" } }
                        },
                        required: ["positive", "negative"],
                        additionalProperties: false
                      }
                    },
                    required: ["type", "confidence", "primaryTraits", "detectedKeywords", "recommendedApproach", "triggers"],
                    additionalProperties: false
                  }
                },
                required: ["urgency", "subjective", "objective", "assessment", "plan", "patientProfile"],
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

        // Increment consultation count for billing tracking
        // Only increment for non-admin users
        if (ctx.user.role !== 'admin') {
          await incrementConsultationCount(ctx.user.id);
        }

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

  // Neurovendas Analysis Router
  neurovendas: router({
    // Analyze consultation transcript for sales intelligence
    // Gate: Only PRO, Trial, and Unlimited users can access Negotiation analysis
    analyzeConsultation: negotiationAccessProcedure
      .input(z.object({
        consultationId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        if (!consultation.transcript) {
          throw new Error("Esta consulta não possui transcrição para análise");
        }

        // Se já existe análise, retornar a existente (não recalcular para manter Rapport persistente)
        if (consultation.neurovendasAnalysis) {
          return { success: true, analysis: consultation.neurovendasAnalysis, cached: true };
        }

        const prompt = `Você é um especialista em Neurovendas e Linguagem Corporal para Dentistas, baseado na metodologia do Dr. Carlos Rodriguez.

Analise a seguinte transcrição de consulta odontológica e forneça uma análise de inteligência de vendas:

TRANSCRIÇÃO:
${consultation.transcript}

Com base na transcrição, analise:

1. PERFIL PSICOGRÁFICO DO PACIENTE:
- Identifique o nível cerebral dominante (Neocórtex/Límbico/Reptiliano)
- Determine a motivação primária (Alívio da Dor, Estética, Status, Saúde)
- Avalie o nível de ansiedade/receptividade (1-10)

2. OBJEÇÕES IDENTIFICADAS:
- Liste objeções verdadeiras detectadas
- Liste possíveis objeções ocultas/falsas
- Classifique cada objeção (financeira, medo, tempo, confiança)

3. SINAIS DE LINGUAGEM:
- Sinais positivos de absorção identificados
- Sinais de resistência ou objeção oculta
- Palavras-chave emocionais usadas pelo paciente

4. GATILHOS MENTAIS RECOMENDADOS:
- Liste os 3 gatilhos mais eficazes para este paciente
- Explique por que cada gatilho é adequado

5. SCRIPT DE FECHAMENTO (Modelo PARE):
- Problema: Como abordar a dor/necessidade
- Amplificação: Como mostrar consequências
- Resolução: Como apresentar a solução
- Engajamento: Como criar compromisso

6. TÉCNICA RECOMENDADA PARA OBJEÇÕES:
- Se objeção verdadeira: Aplique técnica LAER
- Se objeção falsa: Aplique técnica de Redirecionamento

7. NÍVEL DE RAPPORT (0-100) - ANÁLISE DETALHADA:
Calcule o Rapport usando os seguintes critérios com pesos específicos:

a) VALIDAÇÃO EMOCIONAL (máx 30 pontos):
   - Frases como 'entendo', 'faz sentido', 'é normal sentir', 'compreendo sua preocupação'
   - Reconhecimento dos sentimentos do paciente

b) ESPELHAMENTO LINGUÍSTICO (máx 25 pontos):
   - Dentista repete palavras-chave do paciente (ex: se paciente diz 'dor', dentista usa 'dor' em vez de 'desconforto')
   - Uso do vocabulário do paciente

c) ESCUTA ATIVA (máx 20 pontos):
   - Parafrasear o paciente
   - Fazer perguntas abertas
   - Silêncios de escuta (permitir que paciente complete pensamentos)

d) EQUILÍBRIO DE TURNOS (máx 15 pontos):
   - Paciente fala 30-50% do tempo = ótimo (15 pts)
   - Paciente fala 20-30% ou 50-60% = bom (10 pts)
   - Paciente fala <20% ou >70% = ruim (5 pts ou menos)

e) AUSÊNCIA DE INTERRUPÇÕES (máx 10 pontos):
   - Dentista NÃO interrompe frases do paciente
   - Permite conclusão de pensamentos

AJUSTES POR PERFIL NEUROLÓGICO:
- Se Reptiliano: +10% se menciona segurança/garantia, -15% se pressiona decisão rápida
- Se Límbico: +15% se usa histórias/casos similares, -10% se foca só em dados técnicos
- Se Neocórtex: +10% se apresenta estudos/evidências, -10% se apela só para emoção

Forneça:
- Pontuação total (0-100)
- Breakdown de cada critério
- Justificativa em 1 frase citando o critério de maior impacto
- 1 sugestão prática de melhoria

Responda em JSON estruturado.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um especialista em Neurovendas aplicadas à Odontologia, treinado na metodologia do Dr. Carlos Rodriguez. Sua análise deve ser prática, ética e focada em ajudar o dentista a comunicar melhor o valor dos tratamentos." },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "neurovendas_analysis",
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
                            tecnicaSugerida: { type: "string" }
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
                      nivel: { type: "number", description: "Pontuação total de 0-100" },
                      breakdown: {
                        type: "object",
                        properties: {
                          validacaoEmocional: { type: "number", description: "0-30 pontos" },
                          espelhamentoLinguistico: { type: "number", description: "0-25 pontos" },
                          escutaAtiva: { type: "number", description: "0-20 pontos" },
                          equilibrioTurnos: { type: "number", description: "0-15 pontos" },
                          ausenciaInterrupcoes: { type: "number", description: "0-10 pontos" }
                        },
                        required: ["validacaoEmocional", "espelhamentoLinguistico", "escutaAtiva", "equilibrioTurnos", "ausenciaInterrupcoes"],
                        additionalProperties: false
                      },
                      justificativa: { type: "string", description: "1 frase citando o critério de maior impacto" },
                      melhoria: { type: "string", description: "1 sugestão prática de melhoria" },
                      pontosFortesRelacionamento: { type: "array", items: { type: "string" } },
                      acoesParaMelhorar: { type: "array", items: { type: "string" } }
                    },
                    required: ["nivel", "breakdown", "justificativa", "melhoria", "pontosFortesRelacionamento", "acoesParaMelhorar"],
                    additionalProperties: false
                  },
                  resumoExecutivo: { type: "string" }
                },
                required: ["perfilPsicografico", "objecoes", "sinaisLinguagem", "gatilhosMentais", "scriptPARE", "tecnicaObjecao", "rapport", "resumoExecutivo"],
                additionalProperties: false
              }
            }
          }
        });

        const analysisContent = response.choices[0]?.message?.content;
        if (!analysisContent || typeof analysisContent !== 'string') {
          throw new Error("Falha ao gerar análise de neurovendas");
        }

        const analysis = JSON.parse(analysisContent);

        // Save analysis to consultation
        await updateConsultation(input.consultationId, {
          neurovendasAnalysis: analysis,
        });

        return { success: true, analysis };
      }),

    // Get neurovendas analysis for a consultation
    getAnalysis: protectedProcedure
      .input(z.object({
        consultationId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const consultation = await getConsultationById(input.consultationId);
        if (!consultation || consultation.dentistId !== ctx.user.id) {
          throw new Error("Consulta não encontrada ou acesso negado");
        }

        return {
          hasAnalysis: !!consultation.neurovendasAnalysis,
          analysis: consultation.neurovendasAnalysis,
        };
      }),
  }),

  // Admin functions
  admin: router({
    resetAccount: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        adminPassword: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate admin password (configured in environment)
        const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';
        
        // Check if user is admin
        if (ctx.user.role !== 'admin') {
          throw new Error('Acesso negado: apenas administradores');
        }
        
        if (input.adminPassword !== adminPassword) {
          throw new Error('Senha de admin inválida');
        }
        
        return await resetUserAccount(input.email);
      }),
  }),

});

export type AppRouter = typeof appRouter;
