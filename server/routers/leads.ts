import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createLead,
  getLeadsByClinic,
  getLeadsByCRC,
  getLeadById,
  updateLead,
  deleteLead,
  convertLeadToPatient,
  getUserById,
  getCallsByLead,
} from "../db";
import { invokeLLMWithRetry } from "../helpers/invokeLLMWithRetry";
import type { AttendanceVideoScript } from "../../drizzle/schema";
import type { Lead, Call, User } from "../../drizzle/schema";

function buildVideoScriptFallback(lead: Lead): AttendanceVideoScript {
  return {
    title: `Vídeo de acolhimento para ${lead.name}`,
    durationSeconds: 45,
    profileUsed: "unknown",
    objective: "Aumentar comparecimento à consulta de avaliação",
    script: `Olá, ${lead.name}! Aqui é o seu dentista. Quero te dar as boas-vindas e confirmar que estamos te esperando na sua consulta de avaliação. Nossa equipe já está preparada para te receber com atenção e cuidado. Será um prazer te conhecer pessoalmente e conversar sobre como podemos te ajudar. Te esperamos!`,
    opening: `Olá, ${lead.name}! Aqui é o seu dentista.`,
    personalConnection: "Ficamos muito felizes com o seu agendamento e queremos que você se sinta bem recebido(a).",
    trustBuilder: "Nossa equipe está preparada para te receber com atenção e cuidado na sua avaliação.",
    cta: "Estamos te esperando! Não perca essa oportunidade de cuidar do seu sorriso.",
    toneGuidance: ["Acolhedor", "Tranquilo", "Humano"],
    keyPointsToMention: ["Confirmar o agendamento", "Transmitir acolhimento", "Mostrar que a equipe está pronta"],
    avoidSaying: ["Pressão para fechar tratamento", "Promessa de resultado clínico", "Preço antes da avaliação"],
    sourceCallId: null,
    confidence: "low",
    generatedAt: new Date().toISOString(),
  };
}

async function generateAttendanceVideoScriptForLead(
  lead: Lead,
  dentist: User,
  calls: Call[]
): Promise<AttendanceVideoScript> {
  const analyzedCall = calls.find((c: any) => c.neurovendasAnalysis || c.callInsights || c.transcript);
  const lastCall = analyzedCall ?? calls[0] ?? null;

  const profileRaw = (lead.callProfile as any)?.nivelCerebralDominante
    ?? (lead.neurovendasAnalysis as any)?.perfilPrincipal
    ?? (lastCall as any)?.neurovendasAnalysis?.perfilPrincipal
    ?? null;

  const profileUsed: AttendanceVideoScript["profileUsed"] =
    ["neocortex", "limbico", "reptiliano"].includes(profileRaw?.toLowerCase?.() ?? "")
      ? profileRaw.toLowerCase()
      : "unknown";

  const callInsights = (lastCall as any)?.callInsights ?? null;
  const callTranscript = (lastCall as any)?.transcript ?? null;
  const callNeuro = (lastCall as any)?.neurovendasAnalysis ?? null;
  const leadNeuro = lead.neurovendasAnalysis as any;

  const contextLines: string[] = [
    `Nome do lead/paciente: ${lead.name}`,
    `Origem: ${lead.source ?? "não informada"}`,
    `Notas do CRC: ${lead.notes ?? "nenhuma"}`,
    `Dentista responsável: ${dentist.name ?? "não informado"}`,
    `Perfil comportamental dominante: ${profileUsed}`,
  ];

  if (leadNeuro?.resumoGeral) contextLines.push(`Resumo neurovendas do lead: ${leadNeuro.resumoGeral}`);
  if ((lead.callProfile as any)?.resumo) contextLines.push(`Resumo do perfil de ligação: ${(lead.callProfile as any).resumo}`);
  if (callNeuro?.resumoGeral) contextLines.push(`Resumo neurovendas da ligação: ${callNeuro.resumoGeral}`);
  if (callInsights?.dor) contextLines.push(`Dor mencionada na ligação: ${callInsights.dor}`);
  if (callInsights?.busca) contextLines.push(`O que o lead busca: ${callInsights.busca}`);
  if (callTranscript) contextLines.push(`Trecho da transcrição (primeiros 800 chars): ${String(callTranscript).slice(0, 800)}`);

  const hasRichContext = !!(leadNeuro || callNeuro || callInsights || callTranscript);

  const profileGuidance: Record<string, string> = {
    reptiliano: "Perfil reptiliano: priorize segurança, controle e clareza sobre o que vai acontecer. Tom calmo e protetor, sem pressão.",
    limbico: "Perfil límbico: conecte-se emocionalmente. Fale sobre transformação, autoestima e impacto do cuidado com a saúde bucal. Tom acolhedor e inspirador.",
    neocortex: "Perfil neocortex: seja claro e objetivo. Explique que a consulta é uma avaliação organizada, com etapas e plano definido. Tom informativo.",
    unknown: "Perfil desconhecido: use abordagem equilibrada com acolhimento, clareza e convite.",
  };

  const systemPrompt = `Você é um especialista em neurovendas odontológicas, análise comportamental e redução de faltas em consultas. Sua tarefa é criar um roteiro de vídeo curto para o dentista enviar ao lead recém-convertido em paciente, com objetivo de aumentar comparecimento à consulta. Use apenas informações fornecidas. Não invente diagnóstico, preço, promessa de resultado ou dados clínicos não mencionados.

Regras obrigatórias:
- O vídeo deve ter no máximo 1 minuto (aproximadamente 150 palavras no script completo).
- O script deve ter linguagem natural, humana e pronta para o dentista gravar.
- Mencione o nome do paciente.
- Cite pelo menos um ponto específico da ligação, se houver: dor, busca, medo, motivação, horário, objeção ou expectativa.
- ${profileGuidance[profileUsed]}
- Não prometa cura, diagnóstico, resultado estético, preço ou aprovação de tratamento.
- Não use tom de pressão ou urgência agressiva.
- O CTA deve reforçar comparecimento à avaliação e mostrar que a equipe está preparada.`;

  const userPrompt = `Contexto do paciente e ligação:\n${contextLines.join("\n")}\n\nGere o roteiro de vídeo no formato JSON solicitado.`;

  const response = await invokeLLMWithRetry(
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "attendance_video_script",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              durationSeconds: { type: "number" },
              profileUsed: { type: "string", enum: ["neocortex", "limbico", "reptiliano", "unknown"] },
              objective: { type: "string" },
              script: { type: "string" },
              opening: { type: "string" },
              personalConnection: { type: "string" },
              trustBuilder: { type: "string" },
              cta: { type: "string" },
              toneGuidance: { type: "array", items: { type: "string" } },
              keyPointsToMention: { type: "array", items: { type: "string" } },
              avoidSaying: { type: "array", items: { type: "string" } },
              sourceCallId: { type: ["number", "null"] },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              generatedAt: { type: "string" },
            },
            required: [
              "title", "durationSeconds", "profileUsed", "objective", "script",
              "opening", "personalConnection", "trustBuilder", "cta",
              "toneGuidance", "keyPointsToMention", "avoidSaying",
              "sourceCallId", "confidence", "generatedAt",
            ],
            additionalProperties: false,
          },
        },
      },
    },
    "AttendanceVideoScript"
  );

  if (!response) {
    console.warn("[AttendanceVideoScript] LLM não retornou resposta — usando fallback");
    return buildVideoScriptFallback(lead);
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    console.warn("[AttendanceVideoScript] Conteúdo vazio — usando fallback");
    return buildVideoScriptFallback(lead);
  }

  try {
    const parsed = JSON.parse(content) as AttendanceVideoScript;
    parsed.sourceCallId = lastCall?.id ?? null;
    parsed.generatedAt = new Date().toISOString();
    if (!hasRichContext) parsed.confidence = "low";
    return parsed;
  } catch {
    console.warn("[AttendanceVideoScript] JSON inválido — usando fallback");
    return buildVideoScriptFallback(lead);
  }
}

export const leadsRouter = router({
  // Create a new lead
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      source: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você precisa estar vinculado a uma clínica" });
      }
      if (user.clinicRole !== "crc" && user.clinicRole !== "gestor") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas CRCs e gestores podem criar leads" });
      }

      const lead = await createLead({
        clinicId: user.clinicId,
        crcId: ctx.user.id,
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        source: input.source || null,
        notes: input.notes || null,
      });

      return lead;
    }),

  // List leads (CRC sees own, Gestor sees all from clinic)
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        return [];
      }

      if (user.clinicRole === "gestor") {
        return await getLeadsByClinic(user.clinicId);
      } else if (user.clinicRole === "crc") {
        return await getLeadsByCRC(ctx.user.id);
      }

      return [];
    }),

  // Get lead by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const lead = await getLeadById(input.id);
      if (!lead || lead.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      }

      // CRC can only see own leads
      if (user.clinicRole === "crc" && lead.crcId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      // Get calls for this lead
      const leadCalls = await getCallsByLead(input.id);

      return { ...lead, calls: leadCalls };
    }),

  // Update lead
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      source: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const lead = await getLeadById(input.id);
      if (!lead || lead.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      }

      if (user.clinicRole === "crc" && lead.crcId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const { id, ...updateData } = input;
      await updateLead(id, updateData);
      return { success: true };
    }),

  // Delete lead
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const lead = await getLeadById(input.id);
      if (!lead || lead.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      }

      if (user.clinicRole === "crc" && lead.crcId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      await deleteLead(input.id);
      return { success: true };
    }),

  // Convert lead to patient (assigns to a dentist)
  convert: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      dentistId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.clinicId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }

      const lead = await getLeadById(input.leadId);
      if (!lead || lead.clinicId !== user.clinicId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      }

      if (lead.isConverted) {
        throw new TRPCError({ code: "CONFLICT", message: "Este lead já foi convertido em paciente" });
      }

      // Verify dentist belongs to same clinic
      const dentist = await getUserById(input.dentistId);
      if (!dentist || dentist.clinicId !== user.clinicId || dentist.clinicRole !== "dentista") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dentista inválido" });
      }

      const patient = await convertLeadToPatient(input.leadId, input.dentistId);

      // Gerar script de vídeo personalizado para aumentar comparecimento
      // Executa de forma assíncrona após a conversão; nunca bloqueia nem falha a conversão
      let attendanceVideoScript = null;
      try {
        const leadCalls = await getCallsByLead(input.leadId);
        attendanceVideoScript = await generateAttendanceVideoScriptForLead(lead, dentist, leadCalls);
        await updateLead(input.leadId, { attendanceVideoScript } as any);
      } catch (err) {
        console.warn("[leads.convert] Falha ao gerar script de vídeo — conversão continua normalmente:", err);
      }

      return { success: true, patient, attendanceVideoScript };
    }),
});
