export type AssemblyAITurnLike = {
  end_of_turn?: boolean;
  turn_is_formatted?: boolean;
};

/**
 * AssemblyAI docs: use end_of_turn to detect completion.
 * turn_is_formatted may be true on partials when format_turns=true — not a final signal.
 */
export function isAssemblyAITurnFinal(event: AssemblyAITurnLike): boolean {
  return event.end_of_turn === true;
}
