/**
 * Health Check Endpoint
 *
 * Reports the status of all subsystems:
 * - Database (Supabase)
 * - STT Streaming (AssemblyAI)
 * - LLM (Forge API)
 * - Storage (S3)
 *
 * GET /api/health → 200 (healthy) or 503 (degraded)
 */
import type { Router } from "express";
import { createLogger } from "../lib/logger";
import { getConsultationStreamingStatus } from "../helpers/consultationStreamingAvailability";
import { resolveStreamingProvider } from "../ai/stt/streaming/streamingProviderChain";
import { supabase } from "../lib/supabaseClient";

const log = createLogger("health");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface SubsystemStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  details?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "down";
  timestamp: string;
  uptime: number;
  subsystems: SubsystemStatus[];
}

// --------------------------------------------------------------------------
// Subsystem Checks
// --------------------------------------------------------------------------

async function checkDatabase(): Promise<SubsystemStatus> {
  const start = Date.now();
  try {
    const { error } = await supabase.from("users").select("id").limit(1);
    const latencyMs = Date.now() - start;
    if (error) {
      return { name: "database", status: "degraded", latencyMs, details: error.message };
    }
    return { name: "database", status: "healthy", latencyMs };
  } catch (err) {
    return {
      name: "database",
      status: "down",
      latencyMs: Date.now() - start,
      details: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function checkStreaming(): SubsystemStatus {
  const streamingStatus = getConsultationStreamingStatus();
  const providerChain = resolveStreamingProvider();

  if (!streamingStatus.ready) {
    return {
      name: "stt_streaming",
      status: "down",
      details: streamingStatus.reason || "Streaming not available",
    };
  }

  if (!providerChain.provider) {
    return {
      name: "stt_streaming",
      status: "down",
      details: "No streaming provider available",
    };
  }

  return {
    name: "stt_streaming",
    status: "healthy",
    details: `Provider: ${providerChain.provider}${providerChain.fallbackUsed ? " (fallback)" : ""}`,
  };
}

async function checkLLM(): Promise<SubsystemStatus> {
  const forgeUrl = process.env.BUILT_IN_FORGE_API_URL;
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (!forgeUrl || !forgeKey) {
    return { name: "llm", status: "down", details: "Forge API not configured" };
  }

  const start = Date.now();
  try {
    const response = await fetch(`${forgeUrl}/v1/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${forgeKey}` },
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    if (response.ok) {
      return { name: "llm", status: "healthy", latencyMs };
    }
    return { name: "llm", status: "degraded", latencyMs, details: `HTTP ${response.status}` };
  } catch (err) {
    return {
      name: "llm",
      status: "down",
      latencyMs: Date.now() - start,
      details: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function checkStorage(): SubsystemStatus {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { name: "storage", status: "down", details: "Supabase not configured" };
  }

  return { name: "storage", status: "healthy", details: "S3 via Supabase configured" };
}

// --------------------------------------------------------------------------
// Route Registration
// --------------------------------------------------------------------------

const startTime = Date.now();

export function registerHealthRoutes(router: Router): void {
  router.get("/api/health", async (_req, res) => {
    try {
      const [database, llm] = await Promise.all([checkDatabase(), checkLLM()]);
      const streaming = checkStreaming();
      const storage = checkStorage();

      const subsystems: SubsystemStatus[] = [database, streaming, llm, storage];

      // Overall status: down if any critical subsystem is down, degraded if any is degraded
      let overallStatus: "healthy" | "degraded" | "down" = "healthy";
      const criticalSubsystems = ["database", "llm"];

      for (const sub of subsystems) {
        if (sub.status === "down" && criticalSubsystems.includes(sub.name)) {
          overallStatus = "down";
          break;
        }
        if (sub.status === "degraded" || sub.status === "down") {
          overallStatus = "degraded";
        }
      }

      const response: HealthResponse = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.round((Date.now() - startTime) / 1000),
        subsystems,
      };

      const httpStatus = overallStatus === "down" ? 503 : overallStatus === "degraded" ? 200 : 200;
      res.status(httpStatus).json(response);

      if (overallStatus !== "healthy") {
        log.warn("Health check degraded", { status: overallStatus, subsystems: subsystems.map((s) => `${s.name}:${s.status}`) });
      }
    } catch (err) {
      log.error("Health check failed", { error: err instanceof Error ? err.message : "Unknown" });
      res.status(503).json({
        status: "down",
        timestamp: new Date().toISOString(),
        uptime: Math.round((Date.now() - startTime) / 1000),
        subsystems: [],
      });
    }
  });
}
