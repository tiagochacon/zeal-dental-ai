import { describe, expect, it } from "vitest";
import { resolveProviderChain } from "./ai/stt/providerChain";

describe("STT provider chain", () => {
  it("keeps whisper for progressive chunks", () => {
    const chain = resolveProviderChain({
      mimeType: "audio/webm",
      audioType: "progressive_chunk",
    });
    expect(chain).toEqual(["whisper"]);
  });

  it("respects provider override with whisper fallback", () => {
    const chain = resolveProviderChain({
      mimeType: "audio/webm",
      audioType: "consultation",
      providerOverride: "deepgram",
    });
    expect(chain).toEqual(["deepgram", "whisper"]);
  });
});
