export type AssemblyAITokenParams = {
  expiresInSeconds: number;
  maxSessionDurationSeconds: number;
};

export function buildAssemblyAITokenRequestUrl(
  params: AssemblyAITokenParams
): string {
  const url = new URL("https://streaming.assemblyai.com/v3/token");
  url.searchParams.set("expires_in_seconds", String(params.expiresInSeconds));
  url.searchParams.set(
    "max_session_duration_seconds",
    String(params.maxSessionDurationSeconds)
  );
  return url.toString();
}

export function formatAssemblyAITokenError(
  status: number,
  details: string,
  isProduction: boolean
): string {
  if (status === 401) {
    return "Chave AssemblyAI inválida ou não autorizada. Verifique ASSEMBLYAI_API_KEY no servidor.";
  }
  if (status === 422) {
    return isProduction
      ? "Falha na autenticação do streaming AssemblyAI (parâmetros inválidos)."
      : `Falha na autenticação do streaming AssemblyAI (422): ${details}`;
  }
  if (status === 429) {
    return "Limite de requisições da AssemblyAI excedido. Tente novamente em alguns instantes.";
  }
  return isProduction
    ? `Falha ao iniciar streaming AssemblyAI (${status}).`
    : `Falha ao criar token temporário da AssemblyAI (${status}): ${details || "sem detalhes"}`;
}
