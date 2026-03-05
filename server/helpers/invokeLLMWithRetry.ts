/**
 * Wrapper para invokeLLM com retry automático e backoff exponencial.
 * 
 * Tenta até 3 vezes com intervalos crescentes (2s, 5s).
 * Se todas as tentativas falharem, retorna null para que o caller use fallback.
 */

import { invokeLLM, type InvokeParams, type InvokeResult } from "../_core/llm";

const RETRY_DELAYS = [2000, 5000]; // 2s, 5s entre tentativas

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function invokeLLMWithRetry(
  params: InvokeParams,
  context: string = "LLM"
): Promise<InvokeResult | null> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await invokeLLM(params);

      // Validate that we got a valid response
      const content = result.choices?.[0]?.message?.content;
      if (!content || (typeof content === 'string' && content.trim().length === 0)) {
        console.warn(`[${context}] Tentativa ${attempt}/${maxAttempts}: Resposta vazia do LLM`);
        if (attempt < maxAttempts) {
          await sleep(RETRY_DELAYS[attempt - 1]);
          continue;
        }
        return null;
      }

      // If we have response_format json_schema, validate JSON parsability
      if (params.response_format?.type === 'json_schema' || params.responseFormat?.type === 'json_schema') {
        if (typeof content === 'string') {
          try {
            JSON.parse(content);
          } catch {
            console.warn(`[${context}] Tentativa ${attempt}/${maxAttempts}: JSON inválido na resposta`);
            if (attempt < maxAttempts) {
              await sleep(RETRY_DELAYS[attempt - 1]);
              continue;
            }
            return null;
          }
        }
      }

      if (attempt > 1) {
        console.log(`[${context}] Sucesso na tentativa ${attempt}/${maxAttempts}`);
      }

      return result;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[${context}] Tentativa ${attempt}/${maxAttempts} falhou: ${errorMsg}`);

      if (attempt < maxAttempts) {
        const delay = RETRY_DELAYS[attempt - 1];
        console.log(`[${context}] Aguardando ${delay / 1000}s antes da próxima tentativa...`);
        await sleep(delay);
      }
    }
  }

  console.error(`[${context}] Falha após ${maxAttempts} tentativas`);
  return null;
}
