import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// In-memory cache to avoid repeated I/O
let cachedContext: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const METODOLOGIA_DIR = path.resolve(__dirname, "../metodologia");

const SUPPORTED_EXTENSIONS = [".txt", ".md"];

/**
 * Loads all methodology files from server/metodologia/ and returns
 * a consolidated string to be injected into LLM prompts.
 * 
 * Uses in-memory cache to avoid repeated filesystem reads.
 * Cache is invalidated after 5 minutes.
 */
export async function getMetodologiaContext(): Promise<string> {
  const now = Date.now();

  // Return cached version if still valid
  if (cachedContext !== null && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedContext;
  }

  try {
    // Check if directory exists
    if (!fs.existsSync(METODOLOGIA_DIR)) {
      console.warn("[MetodologiaLoader] Pasta server/metodologia/ não encontrada. Criando...");
      fs.mkdirSync(METODOLOGIA_DIR, { recursive: true });
      cachedContext = getDefaultMessage();
      cacheTimestamp = now;
      return cachedContext;
    }

    // Read all supported files
    const files = fs.readdirSync(METODOLOGIA_DIR)
      .filter(f => {
        const ext = path.extname(f).toLowerCase();
        return SUPPORTED_EXTENSIONS.includes(ext) && f !== "README.md";
      })
      .sort(); // Consistent ordering

    if (files.length === 0) {
      console.warn("[MetodologiaLoader] Nenhum arquivo de metodologia encontrado em server/metodologia/");
      cachedContext = getDefaultMessage();
      cacheTimestamp = now;
      return cachedContext;
    }

    // Concatenate all files with clear separators
    const sections: string[] = [];

    for (const file of files) {
      const filePath = path.join(METODOLOGIA_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8").trim();

      if (content.length > 0) {
        sections.push(`### METODOLOGIA: ${file}\n${content}`);
      }
    }

    const consolidated = sections.join("\n\n---\n\n");

    console.log(`[MetodologiaLoader] Carregados ${files.length} arquivo(s) de metodologia (${consolidated.length} chars)`);

    cachedContext = consolidated;
    cacheTimestamp = now;
    return cachedContext;

  } catch (error) {
    console.error("[MetodologiaLoader] Erro ao carregar arquivos de metodologia:", error);
    cachedContext = getDefaultMessage();
    cacheTimestamp = now;
    return cachedContext;
  }
}

function getDefaultMessage(): string {
  return "AVISO: Nenhum documento de metodologia foi fornecido. Use conhecimento geral de neurovendas aplicadas à odontologia, mas indique em cada campo que a análise não está ancorada em documentação específica.";
}

/**
 * Force cache invalidation (useful after file updates)
 */
export function invalidateMetodologiaCache(): void {
  cachedContext = null;
  cacheTimestamp = 0;
  console.log("[MetodologiaLoader] Cache invalidado");
}
