import fs from "fs";
import path from "path";

const METODOLOGIA_DIR = path.join(__dirname, "..", "metodologia");

let cache: string | null = null;
let cacheLoadedAt: number | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const SUPPORTED_EXTENSIONS = [".txt", ".md"];

/**
 * Retorna o conteúdo consolidado de todos os arquivos de metodologia
 * disponíveis em server/metodologia/.
 *
 * Se a pasta estiver vazia ou não existir, retorna uma mensagem padrão
 * indicando que nenhum documento foi fornecido — o que instrui a IA
 * a operar em modo de baixa confiança.
 *
 * O resultado é cacheado por 5 minutos para evitar I/O repetido.
 */
export async function getMetodologiaContext(): Promise<string> {
  const now = Date.now();

  if (cache !== null && cacheLoadedAt !== null && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cache;
  }

  if (!fs.existsSync(METODOLOGIA_DIR)) {
    cache = buildEmptyContext();
    cacheLoadedAt = now;
    return cache;
  }

  let files: string[];
  try {
    files = fs.readdirSync(METODOLOGIA_DIR).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext) && f !== "README.md";
    });
  } catch {
    cache = buildEmptyContext();
    cacheLoadedAt = now;
    return cache;
  }

  if (files.length === 0) {
    cache = buildEmptyContext();
    cacheLoadedAt = now;
    return cache;
  }

  const sections: string[] = [];

  for (const file of files.sort()) {
    const filePath = path.join(METODOLOGIA_DIR, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8").trim();
      if (content.length > 0) {
        sections.push(`### METODOLOGIA: ${file}\n${content}`);
      }
    } catch (err) {
      console.warn(`[MetodologiaLoader] Não foi possível ler o arquivo ${file}:`, err);
    }
  }

  if (sections.length === 0) {
    cache = buildEmptyContext();
    cacheLoadedAt = now;
    return cache;
  }

  cache = sections.join("\n\n---\n\n");
  cacheLoadedAt = now;

  console.log(`[MetodologiaLoader] ${sections.length} arquivo(s) de metodologia carregado(s).`);
  return cache;
}

/**
 * Invalida o cache manualmente (útil após atualizar os arquivos sem reiniciar o servidor).
 */
export function invalidateMetodologiaCache(): void {
  cache = null;
  cacheLoadedAt = null;
  console.log("[MetodologiaLoader] Cache de metodologia invalidado.");
}

function buildEmptyContext(): string {
  return (
    "AVISO: Nenhum documento de metodologia foi encontrado em server/metodologia/.\n" +
    "Opere em modo de baixa confiança: indique explicitamente nos campos de descrição que " +
    "a análise está sendo feita sem base documental e que os resultados devem ser revisados manualmente."
  );
}
