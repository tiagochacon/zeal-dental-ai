/**
 * AI revalidation of dental consultation transcripts.
 *
 * After the audio is transcribed (Deepgram/Whisper), the raw STT output can still
 * contain phonetically-similar word errors. This pass uses an LLM that understands
 * the audio is a Brazilian Portuguese DENTAL consultation — mixing technical/clinical
 * talk with personal rapport between dentist and patient — to fix only obvious
 * transcription errors, preserving fidelity (no inventing, summarizing, or rewriting).
 */
import { invokeAI } from "../ai/invokeAI";
import type { InvokeResult } from "../_core/llm";

const REVALIDATION_SYSTEM_PROMPT = `Você é um revisor especializado em transcrições de consultas clínicas odontológicas em português brasileiro.

A transcrição abaixo foi gerada por reconhecimento automático de fala (STT) e pode conter erros: palavras foneticamente parecidas trocadas por outras que não fazem sentido no contexto.

CONTEXTO DO ÁUDIO:
- É uma consulta odontológica real entre dentista e paciente.
- Há trechos de conversa TÉCNICA/CLÍNICA: queixas, sintomas, diagnósticos, procedimentos, anatomia dental, medicamentos e planos de tratamento.
- Há também trechos de conversa de APROXIMAÇÃO PESSOAL (rapport): cumprimentos, assuntos do dia a dia e descontração.

SUA TAREFA:
- Corrigir APENAS erros evidentes de transcrição, usando o contexto clínico e conversacional para inferir a palavra que foi realmente falada.
- Preservar fielmente o sentido, o tom e a coloquialidade da fala (não formalize, não resuma, não reescreva o estilo).
- Manter a estrutura de turnos/linhas exatamente como está.

REGRAS DE FIDELIDADE (OBRIGATÓRIAS):
- NÃO invente informações, sintomas, diagnósticos, valores ou falas que não estejam na transcrição.
- NÃO adicione nem remova conteúdo. Apenas corrija palavras/erros de transcrição.
- Se um trecho estiver ininteligível ou ambíguo, mantenha-o como está em vez de adivinhar.
- Mantenha tudo em português brasileiro; não traduza.

Responda SOMENTE com a transcrição corrigida, sem comentários, sem marcações e sem explicações.`;

const MAX_REVALIDATION_CHARS = 10000;
const MIN_LENGTH_TO_REVALIDATE = 20;
// Guard against the model summarizing/inventing: if a revised chunk is much shorter
// or much longer than the original, we keep the original chunk instead.
const MIN_LENGTH_RATIO = 0.5;
const MAX_LENGTH_RATIO = 1.8;

function extractContent(response: InvokeResult): string {
  const content = response?.choices?.[0]?.message?.content;
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (part && "text" in part ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

/** Split preserving line (turn) boundaries so we never cut a sentence mid-way. */
function splitForRevalidation(transcript: string, maxChars: number): string[] {
  const lines = transcript.split("\n");
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (!current) {
      current = line;
      continue;
    }
    if (current.length + 1 + line.length <= maxChars) {
      current += `\n${line}`;
      continue;
    }
    chunks.push(current);
    current = line;
  }
  if (current) chunks.push(current);
  return chunks;
}

export type RevalidationResult = {
  text: string;
  changed: boolean;
  revalidated: boolean;
};

export async function revalidateConsultationTranscript(
  transcript: string,
  consultationId?: number
): Promise<RevalidationResult> {
  const original = typeof transcript === "string" ? transcript : "";
  if (original.trim().length < MIN_LENGTH_TO_REVALIDATE) {
    return { text: transcript, changed: false, revalidated: false };
  }

  const chunks = splitForRevalidation(original, MAX_REVALIDATION_CHARS);
  const revised: string[] = [];
  let anyChanged = false;
  let anyRevalidated = false;

  for (const chunk of chunks) {
    try {
      const result = await invokeAI(
        "transcript_revalidation",
        {
          messages: [
            { role: "system", content: REVALIDATION_SYSTEM_PROMPT },
            { role: "user", content: chunk },
          ],
        },
        { consultationId }
      );

      if (!result.success) {
        revised.push(chunk);
        continue;
      }

      const content = extractContent(result.response).trim();
      if (!content) {
        revised.push(chunk);
        continue;
      }

      const ratio = content.length / chunk.length;
      if (ratio < MIN_LENGTH_RATIO || ratio > MAX_LENGTH_RATIO) {
        // Suspicious length change — likely summarization/hallucination. Keep original.
        console.warn(
          `[TranscriptRevalidation] Trecho descartado por mudança de tamanho suspeita (ratio=${ratio.toFixed(2)}).`
        );
        revised.push(chunk);
        continue;
      }

      anyRevalidated = true;
      if (content !== chunk) anyChanged = true;
      revised.push(content);
    } catch (error) {
      console.warn("[TranscriptRevalidation] Falha ao revalidar trecho; mantendo original:", error);
      revised.push(chunk);
    }
  }

  return { text: revised.join("\n"), changed: anyChanged, revalidated: anyRevalidated };
}
