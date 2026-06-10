/**
 * Anti-Hallucination Pipeline — Orchestrator
 *
 * Coordinates the two-stage pipeline:
 * Stage 1 (Extraction): Extract pure facts with citations from transcript
 * Stage 2 (Interpretation): Interpret facts using RAG context into structured output
 *
 * Falls back to single-stage (legacy) when extraction fails.
 */
import { extractClinicalFacts, extractBehavioralFacts } from "./extractionStage";
import { interpretClinicalFacts, interpretBehavioralFacts } from "./interpretationStage";
import { createLogger } from "../../lib/logger";
import type { ExtractedClinicalFacts, ExtractedBehavioralFacts } from "./extractionStage";

const log = createLogger("pipeline:orchestrator");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface PipelineResult<T> {
  /** The final structured output */
  output: T;
  /** Whether the two-stage pipeline was used (false = legacy single-stage fallback) */
  pipelineUsed: boolean;
  /** Extracted facts from Stage 1 (null if pipeline not used) */
  extractedFacts: ExtractedClinicalFacts | ExtractedBehavioralFacts | null;
  /** Timing metrics */
  timing: {
    extractionMs: number;
    interpretationMs: number;
    totalMs: number;
  };
}

export interface SOAPPipelineInput {
  consultationId: number;
  transcript: string;
}

export interface NeurovendasPipelineInput {
  consultationId: number;
  transcript: string;
  patientId?: number | null;
}

// --------------------------------------------------------------------------
// SOAP Pipeline
// --------------------------------------------------------------------------

/**
 * Run the full anti-hallucination pipeline for SOAP note generation.
 *
 * Stage 1: Extract clinical facts with citations
 * Stage 2: Interpret facts into structured SOAP note with RAG context
 *
 * Falls back to null if both stages fail (caller should use legacy single-stage).
 */
export async function runSOAPPipeline(input: SOAPPipelineInput): Promise<PipelineResult<Record<string, unknown>> | null> {
  const { consultationId, transcript } = input;
  const startTime = Date.now();

  log.info("Starting SOAP pipeline", { consultationId, transcriptLength: transcript.length });

  // Stage 1: Extraction
  const extractionStart = Date.now();
  const facts = await extractClinicalFacts(transcript, consultationId);
  const extractionMs = Date.now() - extractionStart;

  if (!facts) {
    log.warn("SOAP extraction failed — pipeline aborted, caller should use legacy", { consultationId });
    return null;
  }

  log.info("SOAP extraction completed", {
    consultationId,
    extractionMs,
    factsCount: {
      achados: facts.achadosClinicos.length,
      dentes: facts.dentesReferenciados.length,
      diagnosticos: facts.diagnosticosMencionados.length,
      tratamentos: facts.tratamentosDiscutidos.length,
    },
  });

  // Stage 2: Interpretation
  const interpretationStart = Date.now();
  const soapNote = await interpretClinicalFacts({
    consultationId,
    facts,
    transcript,
  });
  const interpretationMs = Date.now() - interpretationStart;

  if (!soapNote) {
    log.warn("SOAP interpretation failed — pipeline aborted, caller should use legacy", { consultationId });
    return null;
  }

  const totalMs = Date.now() - startTime;
  log.info("SOAP pipeline completed", { consultationId, totalMs, extractionMs, interpretationMs });

  return {
    output: soapNote,
    pipelineUsed: true,
    extractedFacts: facts,
    timing: { extractionMs, interpretationMs, totalMs },
  };
}

// --------------------------------------------------------------------------
// Neurovendas Pipeline
// --------------------------------------------------------------------------

/**
 * Run the full anti-hallucination pipeline for Neurovendas analysis.
 *
 * Stage 1: Extract behavioral facts with citations
 * Stage 2: Interpret facts into neurovendas analysis with RAG context
 *
 * Falls back to null if both stages fail (caller should use legacy single-stage).
 */
export async function runNeurovendasPipeline(input: NeurovendasPipelineInput): Promise<PipelineResult<Record<string, unknown>> | null> {
  const { consultationId, transcript, patientId } = input;
  const startTime = Date.now();

  log.info("Starting neurovendas pipeline", { consultationId, transcriptLength: transcript.length });

  // Stage 1: Extraction
  const extractionStart = Date.now();
  const facts = await extractBehavioralFacts(transcript, consultationId);
  const extractionMs = Date.now() - extractionStart;

  if (!facts) {
    log.warn("Neurovendas extraction failed — pipeline aborted, caller should use legacy", { consultationId });
    return null;
  }

  log.info("Neurovendas extraction completed", {
    consultationId,
    extractionMs,
    factsCount: {
      falas: facts.falasPaciente.length,
      perguntas: facts.perguntasPaciente.length,
      objecoes: facts.objecoesPaciente.length,
      emocoes: facts.expressoesEmocionais.length,
    },
  });

  // Stage 2: Interpretation
  const interpretationStart = Date.now();
  const analysis = await interpretBehavioralFacts({
    consultationId,
    facts,
    transcript,
    patientId,
  });
  const interpretationMs = Date.now() - interpretationStart;

  if (!analysis) {
    log.warn("Neurovendas interpretation failed — pipeline aborted, caller should use legacy", { consultationId });
    return null;
  }

  const totalMs = Date.now() - startTime;
  log.info("Neurovendas pipeline completed", { consultationId, totalMs, extractionMs, interpretationMs });

  return {
    output: analysis,
    pipelineUsed: true,
    extractedFacts: facts,
    timing: { extractionMs, interpretationMs, totalMs },
  };
}

// --------------------------------------------------------------------------
// Re-exports
// --------------------------------------------------------------------------

export type { ExtractedClinicalFacts, ExtractedBehavioralFacts } from "./extractionStage";
export { extractClinicalFacts, extractBehavioralFacts } from "./extractionStage";
export { interpretClinicalFacts, interpretBehavioralFacts } from "./interpretationStage";
