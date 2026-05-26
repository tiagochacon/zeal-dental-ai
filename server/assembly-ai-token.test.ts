import { describe, expect, it } from "vitest";
import {
  buildAssemblyAITokenRequestUrl,
  formatAssemblyAITokenError,
} from "./ai/stt/streaming/assemblyAIToken";

describe("buildAssemblyAITokenRequestUrl", () => {
  it("includes expires_in_seconds and max_session_duration_seconds", () => {
    const url = buildAssemblyAITokenRequestUrl({
      expiresInSeconds: 600,
      maxSessionDurationSeconds: 3600,
    });

    expect(url).toBe(
      "https://streaming.assemblyai.com/v3/token?expires_in_seconds=600&max_session_duration_seconds=3600"
    );
  });
});

describe("formatAssemblyAITokenError", () => {
  it("returns controlled message for 422 in production", () => {
    const message = formatAssemblyAITokenError(
      422,
      "missing query expires_in_seconds Field required",
      true
    );

    expect(message).toBe(
      "Falha na autenticação do streaming AssemblyAI (parâmetros inválidos)."
    );
    expect(message).not.toContain("expires_in_seconds");
  });

  it("includes technical details for 422 outside production", () => {
    const message = formatAssemblyAITokenError(
      422,
      "missing query expires_in_seconds Field required",
      false
    );

    expect(message).toContain("422");
    expect(message).toContain("expires_in_seconds");
  });

  it("returns friendly message for 401", () => {
    const message = formatAssemblyAITokenError(401, "Unauthorized", true);
    expect(message).toContain("ASSEMBLYAI_API_KEY");
  });
});
