import { describe, expect, it } from "vitest";
import { isAssemblyAITurnFinal } from "./ai/stt/streaming/assemblyAITurnClassification";

describe("isAssemblyAITurnFinal", () => {
  it("returns false for formatted partial (turn_is_formatted without end_of_turn)", () => {
    expect(
      isAssemblyAITurnFinal({
        end_of_turn: false,
        turn_is_formatted: true,
      })
    ).toBe(false);
  });

  it("returns false when end_of_turn is undefined", () => {
    expect(
      isAssemblyAITurnFinal({
        turn_is_formatted: true,
      })
    ).toBe(false);
  });

  it("returns true only when end_of_turn is explicitly true", () => {
    expect(
      isAssemblyAITurnFinal({
        end_of_turn: true,
        turn_is_formatted: true,
      })
    ).toBe(true);
  });

  it("returns false when end_of_turn is explicitly false", () => {
    expect(
      isAssemblyAITurnFinal({
        end_of_turn: false,
        turn_is_formatted: false,
      })
    ).toBe(false);
  });
});
