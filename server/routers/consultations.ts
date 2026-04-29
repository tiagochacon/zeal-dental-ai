import { router, protectedProcedure, consultationLimitProcedure, negotiationAccessProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  createConsultation,
  getConsultationsByDentist,
  getConsultationById,
  updateConsultation,
  getConsultationsByPatient,
  getConsultationsByPatientAll,
  getConsultationsByClinic,
  createFeedback,
  getFeedbackByConsultation,
  deleteFeedbacksByConsultation,
  createAudioChunk,
  getAudioChunksBySession,
  getAudioChunksByConsultation,
  deleteAudioChunks,
  deleteAudioChunksByConsultation,
  updateAudioChunkTranscript,
  deleteConsultation,
  getUserById,
  incrementConsultationCount,
} from "../db";
import { storagePut, storageDelete } from "../storage";
import { transcribeLongAudio } from "../_core/voiceTranscription";
import { concatenateAudioChunksWithFfmpeg } from "../helpers/concatenateAudioChunks";
import { invokeLLM } from "../_core/llm";
import { invokeLLMWithRetry } from "../helpers/invokeLLMWithRetry";
import { validateNeurovendasAnalysis } from "../helpers/validateNeurovendasAnalysis";
import { getNeurovendasFallback, countPatientWords } from "../helpers/neurovendasFallback";
import { getMetodologiaContext } from "../_core/metodologiaLoader";
import { SOAPNote, TreatmentPlan } from "../../drizzle/schema";
import { incrementClinicConsultationCount } from "../clinicBilling";
import { isAdminEmail } from "../auth";
import { nanoid } from "nanoid";

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

async function assertConsultationAccess<T extends { dentistId: number }>(
  consultation: T | null | undefined,
  user: { id: number; role?: string | null; clinicRole?: string | null; clinicId?: number | null }
): Promise<T> {
  if (!consultation) throw new Error("Consulta não encontrada");
  const isOwner = consultation.dentistId === user.id;
  if (isOwner) return consultation;
  if (user.clinicId && (user.clinicRole === 'gestor' || user.role === 'admin')) {
    const dentist = await getUserById(consultation.dentistId);
    if (dentist && dentist.clinicId === user.clinicId) return consultation;
  }
  throw new Error("Consulta não encontrada ou acesso negado");
}

export const consultationsRouter = router({
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
    const user = ctx.user;
    if (user.clinicId && (user.clinicRole === 'gestor' || user.role === 'admin')) {
      return await getConsultationsByClinic(user.clinicId);
    }
    return await getConsultationsByDentist(ctx.user.id);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const consultation = await getConsultationById(input.id);
      if (!consultation) throw new Error("Consulta não encontrada");
      const isOwner = consultation.dentistId === ctx.user.id;
      const isClinicGestor = ctx.user.clinicId && (ctx.user.clinicRole === 'gestor' || ctx.user.role === 'admin');
      if (!isOwner && !isClinicGestor) {
        throw new Error("Consulta não encontrada ou acesso negado");
      }
      return consultation;
    }),

  getByPatient: protectedProcedure
    .input(z.object({ patientId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.clinicId && (ctx.user.clinicRole === 'gestor' || ctx.user.role === 'admin')) {
        return await getConsultationsByPatientAll(input.patientId);
      }
      return await getConsultationsByPatient(input.patientId, ctx.user.id);
    }),

  getTreatmentPlan: protectedProcedure
    .input(z.object({ consultationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const consultation = await getConsultationById(input.consultationId);
      if (!consultation) throw new Error("Consulta não encontrada");
      const isOwner = consultation.dentistId === ctx.user.id;
      const isClinicGestor = ctx.user.clinicId && (ctx.user.clinicRole === 'gestor' || ctx.user.role === 'admin');
      if (!isOwner && !isClinicGestor) {
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
      await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );
      await updateConsultation(input.consultationId, {
        treatmentPlan: input.treatmentPlan,
      });
      return { success: true };
    }),

  generateTreatmentPlan: protectedProcedure
    .input(z.object({ consultationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const consultation = await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      const { getPatientById } = await import('../db');
      const patient = await getPatientById(consultation.patientId);
      if (!patient) {
        throw new Error("Paciente não encontrado");
      }

      const rawSoap = consultation.soapNote;
      const soapNote: SOAPNote | null = typeof rawSoap === "string"
        ? (() => { try { return JSON.parse(rawSoap) as SOAPNote; } catch { return null; } })()
        : (rawSoap as SOAPNote | null);
      if (!soapNote) {
        throw new Error("Nota SOAP não disponível para gerar plano. Por favor, gere as notas SOAP primeiro.");
      }

      const prompt = `Você é um assistente de IA odontológico especializado em planos de tratamento detalhados.\n\nGere um plano estruturado em JSON estritamente no formato abaixo, em português, com linguagem clínica clara e instruções detalhadas:\n\n{\n  \"summary\": \"...\",\n  \"steps\": [\n    {\n      \"title\": \"...\",\n      \"description\": \"...\",\n      \"duration\": \"...\",\n      \"frequency\": \"...\",\n      \"notes\": \"...\"\n    }\n  ],\n  \"medications\": [\n    {\n      \"name\": \"...\",\n      \"dose\": \"...\",\n      \"frequency\": \"...\",\n      \"duration\": \"...\",\n      \"notes\": \"...\"\n    }\n  ],\n  \"postOpInstructions\": [\"...\"],\n  \"warnings\": [\"...\"]\n}\n\nContexto:\n- Paciente: ${patient.name}\n- Histórico médico: ${patient.medicalHistory || "Não informado"}\n- Alergias: ${patient.allergies || "Não informado"}\n- Medicações em uso: ${patient.medications || "Não informado"}\n- Achados clínicos (SOAP): ${JSON.stringify(soapNote)}\n\nRegras:\n- Inclua cronogramas precisos (ex: \"a cada 12h por 8 dias\").\n- Inclua instruções pós-operatórias quando aplicável.\n- Não invente dados fora do contexto clínico fornecido.\n- Se os achados clínicos não incluem indicação para medicamentos, retorne "medications": [].\n- Se os achados clínicos não incluem procedimento cirúrgico, retorne "postOpInstructions": [].\n- Cada step do plano deve mapear diretamente a um tratamento listado nos achados do SOAP.\n- Se não houver medicamento, deixe medications como array vazio.\n- Retorne apenas JSON válido.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um assistente especializado em planos odontológicos. REGRAS OBRIGATÓRIAS:\n1. O plano deve ser derivado EXCLUSIVAMENTE dos dados clínicos fornecidos (nota SOAP, histórico médico, alergias, medicações).\n2. Nunca adicione procedimentos não citados ou inferidos da nota SOAP.\n3. Medicações: inclua APENAS se houver indicação clínica direta nos achados. Se não houver, retorne array vazio.\n4. Instruções pós-operatórias: inclua APENAS se houver procedimento cirúrgico ou invasivo no plano.\n5. Cronogramas (ex: 'a cada 12h por 8 dias') devem seguir protocolos odontológicos padrão para o procedimento indicado — nunca invente posologia.\n6. Se os dados clínicos forem insuficientes para gerar um passo, não o inclua." },
          { role: "user", content: prompt }
        ],
        temperature: 0,
        seed: 42,
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

      let parsed: TreatmentPlan;
      try {
        parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as TreatmentPlan;
      } catch {
        throw new Error("Resposta da IA em formato inválido. Tente novamente.");
      }
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
      await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      const audioBuffer = Buffer.from(input.audioBase64, 'base64');
      const extension = input.mimeType.split('/')[1] || 'webm';
      const fileKey = `consultations/${ctx.user.id}/${input.consultationId}/audio-${nanoid()}.${extension}`;
      const { url } = await storagePut(fileKey, audioBuffer, input.mimeType);

      await updateConsultation(input.consultationId, {
        audioUrl: url,
        audioFileKey: fileKey,
        audioDurationSeconds: input.durationSeconds || null,
      });

      return { success: true, audioUrl: url };
    }),

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
      await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      const audioBuffer = Buffer.from(input.audioBase64, 'base64');
      const sizeBytes = audioBuffer.length;
      const extension = input.mimeType.split('/')[1]?.split(';')[0] || 'webm';
      const fileKey = `consultations/${ctx.user.id}/${input.consultationId}/chunks/${input.recordingSessionId}/chunk-${input.chunkIndex}-${nanoid(6)}.${extension}`;
      const { url } = await storagePut(fileKey, audioBuffer, input.mimeType);

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

  transcribeAudioChunk: protectedProcedure
    .input(z.object({
      consultationId: z.number(),
      recordingSessionId: z.string(),
      chunkIndex: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      const chunks = await getAudioChunksBySession(
        input.consultationId,
        input.recordingSessionId
      );
      const chunk = chunks.find((c) => c.chunkIndex === input.chunkIndex);
      if (!chunk) {
        throw new Error(`Chunk ${input.chunkIndex} não encontrado`);
      }

      const DENTAL_PROMPT = "Transcrição de consulta odontológica clínica. Vocabulário esperado: cárie, restauração, canal, extração, implante, prótese, periodontia, ortodontia, radiografia, anestesia, dente 16, dente 21, FDI, SOAP, diagnóstico, plano de tratamento, hipótese diagnóstica, gengivite, molar, incisivo, obturação, profilaxia, clareamento, bruxismo, oclusão, endodontia. Diálogo entre dentista e paciente. Português brasileiro. Identifique e marque cada falante usando 'Dentista:' ou 'Paciente:'. Termos técnicos odontológicos precisam ser transcritos com exatidão.";

      const result = await transcribeLongAudio({
        audioUrl: chunk.url,
        language: "pt",
        prompt: DENTAL_PROMPT,
      });

      if ("error" in result) {
        const errorMsg = `Chunk ${input.chunkIndex} transcription failed: ${result.error}${result.details ? ` (${result.details})` : ''}`;
        console.error(`[TranscribeAudioChunk] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      await updateAudioChunkTranscript(
        input.consultationId,
        input.recordingSessionId,
        input.chunkIndex,
        result.text
      );

      return { success: true, transcript: result.text };
    }),

  finalizeAudioRecording: protectedProcedure
    .input(z.object({
      consultationId: z.number(),
      recordingSessionId: z.string(),
      totalDurationSeconds: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      const chunks = await getAudioChunksBySession(
        input.consultationId,
        input.recordingSessionId
      );

      if (chunks.length === 0) {
        throw new Error("Nenhum chunk de áudio encontrado para esta sessão");
      }

      const chunkBuffers = await Promise.all(
        chunks.map(async (chunk) => {
          const response = await fetch(chunk.url);
          if (!response.ok) {
            throw new Error(`Falha ao baixar chunk ${chunk.chunkIndex}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        })
      );

      let concatenatedBuffer: Buffer;
      try {
        const result = await concatenateAudioChunksWithFfmpeg(chunkBuffers, chunks[0].mimeType);
        concatenatedBuffer = result.buffer;
      } catch (ffmpegError) {
        console.warn("[finalizeAudioRecording] ffmpeg concat failed, falling back to Buffer.concat:", ffmpegError);
        concatenatedBuffer = Buffer.concat(chunkBuffers);
      }

      const extension = chunks[0].mimeType.split('/')[1] || 'webm';
      const finalFileKey = `consultations/${ctx.user.id}/${input.consultationId}/audio-final-${nanoid()}.${extension}`;
      const { url: finalUrl } = await storagePut(
        finalFileKey,
        concatenatedBuffer,
        chunks[0].mimeType
      );

      const transcriptParts = chunks
        .map((c) => (c as { transcriptText?: string | null }).transcriptText)
        .filter((t): t is string => !!t && t.trim().length > 0);
      const mergedTranscript = transcriptParts.length > 0
        ? transcriptParts.join("\n\n")
        : null;

      await updateConsultation(input.consultationId, {
        audioUrl: finalUrl,
        audioFileKey: finalFileKey,
        audioDurationSeconds: input.totalDurationSeconds || null,
        ...(mergedTranscript && {
          transcript: mergedTranscript,
          status: "transcribed" as const,
        }),
      });

      await deleteAudioChunks(input.consultationId, input.recordingSessionId);

      return { success: true, audioUrl: finalUrl };
    }),

  updateTranscript: protectedProcedure
    .input(z.object({
      consultationId: z.number(),
      transcript: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      await updateConsultation(input.consultationId, {
        transcript: input.transcript,
        status: "reviewed",
      });

      return { success: true };
    }),

  transcribe: consultationLimitProcedure
    .input(z.object({ consultationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const consultation = await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      let audioUrl = consultation.audioUrl;

      if (!audioUrl) {
        console.log(`[Transcription] Consultation ${input.consultationId}: audioUrl is NULL, checking for audio chunks...`);
        const chunks = await getAudioChunksByConsultation(input.consultationId);

        if (chunks.length === 0) {
          throw new Error("Nenhum arquivo de áudio encontrado para esta consulta");
        }

        console.log(`[Transcription] Found ${chunks.length} audio chunks, concatenating...`);

        const chunkBuffers = await Promise.all(
          chunks.map(async (chunk) => {
            const response = await fetch(chunk.url);
            if (!response.ok) {
              throw new Error(`Falha ao baixar chunk ${chunk.chunkIndex}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
          })
        );

        let concatenatedBuffer: Buffer;
        try {
          const result = await concatenateAudioChunksWithFfmpeg(chunkBuffers, chunks[0].mimeType);
          concatenatedBuffer = result.buffer;
        } catch (ffmpegError) {
          console.warn("[Transcription] ffmpeg concat failed, falling back to Buffer.concat:", ffmpegError);
          concatenatedBuffer = Buffer.concat(chunkBuffers);
        }

        const extension = chunks[0].mimeType.split('/')[1] || 'webm';
        const finalFileKey = `consultations/${ctx.user.id}/${input.consultationId}/audio-recovered-${nanoid()}.${extension}`;
        const { url: finalUrl } = await storagePut(
          finalFileKey,
          concatenatedBuffer,
          chunks[0].mimeType
        );

        const totalDuration = chunks.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);

        await updateConsultation(input.consultationId, {
          audioUrl: finalUrl,
          audioFileKey: finalFileKey,
          audioDurationSeconds: totalDuration || null,
        });

        audioUrl = finalUrl;
        console.log(`[Transcription] Audio recovered from ${chunks.length} chunks: ${(concatenatedBuffer.length / (1024 * 1024)).toFixed(1)}MB`);

        await deleteAudioChunksByConsultation(input.consultationId);
      }

      const DENTAL_PROMPT = "Transcrição de consulta odontológica clínica. Vocabulário esperado: cárie, restauração, canal, extração, implante, prótese, periodontia, ortodontia, radiografia, anestesia, dente 16, dente 21, FDI, SOAP, diagnóstico, plano de tratamento, hipótese diagnóstica, gengivite, molar, incisivo, obturação, profilaxia, clareamento, bruxismo, oclusão, endodontia. Diálogo entre dentista e paciente. Português brasileiro. Identifique e marque cada falante usando 'Dentista:' ou 'Paciente:'. Termos técnicos odontológicos precisam ser transcritos com exatidão.";

      const result = await transcribeLongAudio({
        audioUrl,
        language: "pt",
        prompt: DENTAL_PROMPT,
      });

      if ('error' in result) {
        throw new Error(`Erro na transcrição: ${result.error}`);
      }

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
      if (!consultation) {
        throw new Error("Consulta não encontrada");
      }

      const isOwner = consultation.dentistId === ctx.user.id;
      const isAdmin = ctx.user.role === 'admin';
      let isGestorOfClinic = false;
      if (ctx.user.clinicRole === 'gestor' && ctx.user.clinicId) {
        const dentist = await getUserById(consultation.dentistId);
        if (dentist && dentist.clinicId === ctx.user.clinicId) {
          isGestorOfClinic = true;
        }
      }

      if (!isOwner && !isAdmin && !isGestorOfClinic) {
        throw new Error("Acesso negado: você não tem permissão para excluir esta consulta");
      }

      try {
        const chunkFiles = await getAudioChunksByConsultation(input.consultationId);
        const deleteKeys = [
          consultation.audioFileKey,
          ...chunkFiles.map(chunk => chunk.fileKey),
        ].filter(Boolean) as string[];

        for (const key of deleteKeys) {
          try {
            await storageDelete(key);
          } catch (e) {
            console.warn(`[Delete] Failed to delete S3 key ${key}:`, e);
          }
        }
      } catch (e) {
        console.warn(`[Delete] Failed to get audio chunks for consultation ${input.consultationId}:`, e);
      }

      try {
        await deleteFeedbacksByConsultation(input.consultationId);
      } catch (e) {
        console.warn(`[Delete] Failed to delete feedbacks:`, e);
      }
      try {
        await deleteAudioChunksByConsultation(input.consultationId);
      } catch (e) {
        console.warn(`[Delete] Failed to delete audio chunks:`, e);
      }
      await deleteConsultation(input.consultationId);

      return { success: true };
    }),

  analyzeAndGenerateSOAP: consultationLimitProcedure
    .input(z.object({ consultationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const consultation = await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      let effectiveTranscript = consultation.transcript;
      if (!effectiveTranscript) {
        const allChunks = await getAudioChunksByConsultation(input.consultationId);
        const doneChunks = (allChunks as Array<{ transcriptionStatus?: string | null; transcriptText?: string | null; chunkIndex?: number | null }>)
          .filter(c => c.transcriptionStatus === "done" && c.transcriptText)
          .sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
        const assembled = doneChunks.map(c => c.transcriptText).filter(Boolean).join("\n\n");
        if (assembled) {
          effectiveTranscript = assembled;
          await updateConsultation(input.consultationId, { transcript: assembled, status: "transcribed" as const });
          console.log(`[SOAP] Transcript assembled from ${doneChunks.length} chunks for consultation ${input.consultationId}`);
        }
      }

      if (!effectiveTranscript) {
        throw new Error("Nenhuma transcrição encontrada para esta consulta");
      }

      const prompt = `Você é um assistente de IA especializado em documentação odontológica brasileira.

TRANSCRIÇÃO DA CONSULTA:
${effectiveTranscript}

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

Seja preciso, conciso e use terminologia clínica apropriada. NÃO INVENTE DADOS.

INSTRUÇÕES ANTI-ALUCINAÇÃO:
- Cada campo da resposta deve ter evidência direta na transcrição acima.
- Se a transcrição é curta ou incompleta, gere campos correspondentemente curtos/vazios.
- NÃO EXPANDA informações além do que foi dito.
- NÃO INFIRA condições clínicas a partir de sintomas sem que o dentista as tenha citado explicitamente.
- Para dentes: classifique APENAS os mencionados explicitamente. Os demais devem ser 'not_evaluated'.
- patientProfile: baseie-se APENAS em palavras literais do paciente na transcrição, não em inferências gerais.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um assistente especializado em documentação odontológica brasileira. REGRAS OBRIGATÓRIAS DE FIDELIDADE:\n1. NUNCA invente, presuma ou complete dados que não aparecem literalmente na transcrição.\n2. Se uma informação não foi mencionada na transcrição, use string vazia '' para campos de texto, [] para arrays, e para classificações de dentes use exclusivamente 'not_evaluated'.\n3. Use aspas ou paráfrase próxima ao relatar queixas — não reescreva com suas próprias palavras.\n4. Diagnósticos devem ser prefixados com 'Hipótese:' quando não confirmados explicitamente pelo dentista na transcrição.\n5. Nunca adicione orientações, lembretes ou tratamentos que não foram discutidos na consulta.\n6. Sua função é EXTRAIR e ESTRUTURAR, não interpretar ou complementar." },
          { role: "user", content: prompt }
        ],
        temperature: 0,
        seed: 42,
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

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Resposta vazia da IA");
      }

      let soapNote: SOAPNote;
      try {
        soapNote = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
      } catch {
        throw new Error("Resposta da IA em formato inválido. Tente novamente.");
      }

      const soapTranscriptWords = (effectiveTranscript || '').toLowerCase().split(/\s+/);
      const queixaWords = (soapNote.subjective as any)?.queixa_principal?.toLowerCase().split(/\s+/) || [];
      const sharedWords = queixaWords.filter((w: string) => w.length > 4 && soapTranscriptWords.some((tw: string) => tw.includes(w.slice(0, 5))));
      if (queixaWords.length > 3 && sharedWords.length === 0) {
        console.warn('[SOAP] Possível alucinação: queixa_principal não tem correspondência na transcrição');
      }

      await updateConsultation(input.consultationId, {
        soapNote: soapNote,
      });

      const isAdmin = ctx.user.role === 'admin' || isAdminEmail(ctx.user.email || '');
      if (!isAdmin) {
        await incrementClinicConsultationCount(ctx.user);
      }

      return { success: true, soapNote };
    }),

  updateSOAP: protectedProcedure
    .input(z.object({
      consultationId: z.number(),
      soapNote: soapNoteSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      await updateConsultation(input.consultationId, {
        soapNote: input.soapNote as SOAPNote,
      });

      return { success: true };
    }),

  finalize: protectedProcedure
    .input(z.object({ consultationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      const feedback = await getFeedbackByConsultation(input.consultationId);
      if (!feedback) {
        throw new Error("Feedback obrigatório antes de finalizar a consulta");
      }

      await updateConsultation(input.consultationId, {
        status: "finalized",
        finalizedAt: new Date(),
        treatmentClosed: feedback.treatmentClosed ?? null,
      });

      return { success: true };
    }),
});

export const feedbacksRouter = router({
  create: protectedProcedure
    .input(z.object({
      consultationId: z.number(),
      rating: z.number().min(1).max(5),
      comment: z.string().optional(),
      treatmentClosed: z.boolean().optional(),
      treatmentClosedNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      const feedback = await createFeedback({
        consultationId: input.consultationId,
        dentistId: ctx.user.id,
        rating: input.rating,
        comment: input.comment,
        treatmentClosed: input.treatmentClosed ?? null,
        treatmentClosedNotes: input.treatmentClosedNotes ?? null,
      });

      return { success: true, feedback };
    }),

  getByConsultation: protectedProcedure
    .input(z.object({ consultationId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      const feedback = await getFeedbackByConsultation(input.consultationId);
      return feedback ?? null;
    }),
});

export const neurovendasRouter = router({
  analyzeConsultation: negotiationAccessProcedure
    .input(z.object({
      consultationId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const consultation = await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      let neuroTranscript = consultation.transcript;
      if (!neuroTranscript) {
        const allChunks = await getAudioChunksByConsultation(input.consultationId);
        const doneChunks = (allChunks as Array<{ transcriptionStatus?: string | null; transcriptText?: string | null; chunkIndex?: number | null }>)
          .filter(c => c.transcriptionStatus === "done" && c.transcriptText)
          .sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
        const assembled = doneChunks.map(c => c.transcriptText).filter(Boolean).join("\n\n");
        if (assembled) {
          neuroTranscript = assembled;
          await updateConsultation(input.consultationId, { transcript: assembled, status: "transcribed" as const });
          console.log(`[Neurovendas] Transcript assembled from ${doneChunks.length} chunks for consultation ${input.consultationId}`);
        }
      }

      if (!neuroTranscript) {
        throw new Error("Esta consulta não possui transcrição para análise");
      }

      if (consultation.neurovendasAnalysis) {
        return { success: true, analysis: consultation.neurovendasAnalysis, cached: true };
      }

      const metodologiaContext = await getMetodologiaContext();
      const patientWordCount = countPatientWords(neuroTranscript || '');

      const systemMessage = `Você é um especialista em análise comportamental e neurovendas odontológicas, baseado na metodologia do Dr. Carlos Rodriguez. Sua função é EXCLUSIVAMENTE analisar transcrições de consultas odontológicas e extrair padrões de comportamento, motivações e técnicas de comunicação.

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
   - Aplique o framework de análise comportamental: nível cerebral dominante (reptiliano, límbico, neocortex), motivações primárias, gatilhos mentais, objeções, rapport e scripts de objeção (LAER/PARE).
   - Use apenas os documentos de metodologia fornecidos — não use conhecimento externo.`;

      const prompt = `DOCUMENTOS DE METODOLOGIA (base obrigatória para toda análise):
${metodologiaContext}

--- FIM DOS DOCUMENTOS ---

CONTEXTO CLÍNICO:
- Paciente: ${consultation.patientId ? 'ID ' + consultation.patientId : 'Não identificado'}
- Número de palavras do paciente: ~${patientWordCount} palavras
- Metodologia disponível: sim

TRANSCRIÇÃO DA CONSULTA:
${neuroTranscript}

INSTRUÇÕES ESPECÍFICAS:

1. Analise a transcrição acima e extraia os padrões de comportamento do PACIENTE (não do dentista).

2. Identifique:
   a) Nível cerebral dominante (reptiliano, limbico, neocortex) — baseado em padrões de linguagem e preocupações
   b) Motivação primária (alivio_dor, estetica, status, saude)
   c) Gatilhos mentais (transformacao, saude_longevidade, status, conforto, exclusividade)
   d) Objeções verdadeiras e ocultas (categoria: financeira, medo, tempo, confianca, outra)
   e) Técnicas de objeção sugeridas (LAER ou redirecionamento)
   f) Nível de rapport (0-100) e breakdown de componentes
   g) Sinais de linguagem (positivos e negativos)

3. Preencha TODOS os campos do schema — nunca deixe vazio.

4. ${patientWordCount < 300 ? `ATENÇÃO: Transcrição com apenas ~${patientWordCount} palavras do paciente. Indique 'Análise de baixa confiança' na descrição do perfil, mas continue preenchendo todos os campos.` : 'Transcrição com volume adequado para análise completa.'}

5. Use EXATAMENTE os valores de enum definidos no schema — sem variações.

6. Para scriptPARE: crie um script COMPLETO e PERSONALIZADO baseado no contexto desta consulta. Cada campo (problema, amplificacao, resolucao, engajamento) deve conter pelo menos uma frase completa.

7. Para tecnicaObjecao: forneça passos ESPECÍFICOS e ACIONÁVEIS, não genéricos.

RETORNE APENAS O JSON, sem explicações adicionais.`;

      const response = await invokeLLMWithRetry({
        messages: [
          { role: "system", content: systemMessage },
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
                          texto: { type: "string", description: "A objeção exata do paciente" },
                          categoria: { type: "string", enum: ["financeira", "medo", "tempo", "confianca", "outra"], description: "Categoria da objeção" },
                          tecnicaSugerida: { type: "string", description: "SCRIPT COMPLETO de resposta usando técnica LAER. Deve ser uma frase completa que o dentista pode usar diretamente, não apenas o nome da técnica. Exemplo: 'Entendo sua preocupação com o valor. É normal querer entender bem o investimento. Me conta, o que especificamente te preocupa mais: o valor total ou a forma de pagamento? Temos opções de parcelamento que podem ajudar.'" }
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

      if (!response) {
        console.error('[NEUROVENDAS] Todas as tentativas falharam — usando fallback seguro');
        const fallback = getNeurovendasFallback();
        await updateConsultation(input.consultationId, { neurovendasAnalysis: fallback as any });
        return { success: true, analysis: fallback, fallback: true };
      }

      const analysisContent = response.choices[0]?.message?.content;
      if (!analysisContent || typeof analysisContent !== 'string') {
        console.error('[NEUROVENDAS] Resposta vazia do LLM — usando fallback seguro');
        const fallback = getNeurovendasFallback();
        await updateConsultation(input.consultationId, { neurovendasAnalysis: fallback as any });
        return { success: true, analysis: fallback, fallback: true };
      }

      let analysis: Record<string, unknown>;
      try {
        analysis = JSON.parse(analysisContent);
      } catch {
        console.error('[NEUROVENDAS] JSON inválido na resposta — usando fallback seguro');
        const fallback = getNeurovendasFallback();
        await updateConsultation(input.consultationId, { neurovendasAnalysis: fallback as any });
        return { success: true, analysis: fallback, fallback: true };
      }

      const warnings = validateNeurovendasAnalysis(analysis, 'consulta');
      if (warnings.length > 0) {
        console.warn(`[NEUROVENDAS] ${warnings.length} warning(s) na análise da consulta ${input.consultationId}`);
      }

      await updateConsultation(input.consultationId, {
        neurovendasAnalysis: analysis as any,
      });

      return { success: true, analysis };
    }),

  getAnalysis: protectedProcedure
    .input(z.object({
      consultationId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const consultation = await assertConsultationAccess(
        await getConsultationById(input.consultationId), ctx.user
      );

      return {
        hasAnalysis: !!consultation.neurovendasAnalysis,
        analysis: consultation.neurovendasAnalysis,
      };
    }),
});
