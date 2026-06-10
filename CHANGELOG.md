# Changelog — refactor/rag-stt-v1

## Resumo

Refatoração completa do sistema de IA odontológico com foco em:
- **RAG (Retrieval-Augmented Generation)** com pgvector para grounding
- **Pipeline Anti-Alucinação** de duas etapas (Extração → Interpretação)
- **STT Streaming refatorado** com Strategy pattern e observabilidade
- **Hardening** com circuit breaker, rate limiter e health checks

**Estatísticas:**
- 29 arquivos alterados, +6.393 linhas adicionadas
- 55+ testes novos adicionados (total: 614 passando)
- 0 erros TypeScript
- 0 breaking changes (todos os módulos são aditivos)

---

## Fase 1 — Reconhecimento e Auditoria (`b4bcee3`)

### Adicionado
- `ARCHITECTURE_AUDIT.md` — Documento completo de auditoria do sistema atual

### Gaps Identificados
- Sem RAG/grounding para análise comportamental
- Pipeline monolítico (extração + interpretação em uma chamada)
- Sem pgvector/embeddings
- Sem RLS (isolamento application-level)
- Sem redação de PII
- Metodologia vazia (pasta sem documentos)
- Conclusões sem evidências rastreáveis

---

## Fase 2 — Refatoração de Qualidade de Código (`d21dceb`)

### Adicionado
- `server/lib/logger.ts` — Logger estruturado com níveis, contexto e JSON output
- `server/services/soapService.ts` — Service extraído do router (SOAP generation)
- `server/services/neurovendasService.ts` — Service extraído do router (análise neurovendas)
- `server/services/transcriptionService.ts` — Service extraído do router (transcrição)
- `server/services/audioService.ts` — Service extraído do router (upload/chunks de áudio)
- `server/services/index.ts` — Barrel export
- `server/services/soapService.test.ts` — 8 testes unitários
- `server/services/neurovendasService.test.ts` — 9 testes unitários

### Melhorias
- Lógica de negócio separada dos routers tRPC
- Funções puras e testáveis isoladamente
- Logger com contexto (módulo, consultationId, clinicId)

---

## Fase 3 — Implementação do RAG com pgvector (`b698c3b`)

### Adicionado
- `server/rag/retriever.ts` — Retriever com busca por embedding (pgvector) + FTS (full-text search)
- `server/rag/ingestor.ts` — Pipeline de ingestão: chunking → embedding → upsert
- `server/rag/seedKnowledge.ts` — Base de conhecimento DISC + neurovendas odontológico
- `server/rag/index.ts` — Barrel export
- `server/rag/rag.test.ts` — 12 testes unitários
- `supabase/migrations/001_knowledge_chunks.sql` — Migration para pgvector + tabela knowledge_chunks

### Arquitetura RAG
```
Documento → Chunking (500 tokens, 50 overlap) → Embedding → Supabase pgvector
Query → Embedding → Similarity Search + FTS → Top-K chunks → LLM Context
```

### Base de Conhecimento Incluída
- Perfis DISC (Dominância, Influência, Estabilidade, Conformidade)
- Técnicas de neurovendas odontológicas
- Gatilhos emocionais por perfil
- Objeções comuns e respostas
- Estratégias de fechamento

---

## Fase 4 — Pipeline Anti-Alucinação (`3fc1a78`)

### Adicionado
- `server/ai/pipeline/extractionStage.ts` — Estágio 1: Extração determinística de fatos
- `server/ai/pipeline/interpretationStage.ts` — Estágio 2: Interpretação com RAG context
- `server/ai/pipeline/index.ts` — Orquestrador do pipeline com fallback para legacy
- `server/ai/pipeline/pipeline.test.ts` — 11 testes unitários

### Arquitetura do Pipeline
```
Transcrição → [Extração (T=0, seed=42)] → Fatos Puros → [Interpretação (T=0.3, RAG)] → Análise Final
                                                                                          ↓
                                                                                    Cada conclusão
                                                                                    cita trecho da
                                                                                    transcrição
```

### Características
- **Estágio 1 (Extração):** Temperature 0, seed 42, JSON Schema strict — extrai APENAS fatos observáveis
- **Estágio 2 (Interpretação):** Temperature 0.3, RAG context injetado — interpreta com base de conhecimento
- **Rastreabilidade:** Cada conclusão inclui `evidence` (citação direta da transcrição)
- **Fallback:** Se o pipeline falhar, cai para o modo legacy (single-stage)

### Task Types Adicionados
- `soap_extraction` — Extração de fatos clínicos
- `neurovendas_extraction` — Extração de fatos comportamentais

---

## Fase 5 — Refatoração da Transcrição em Tempo Real (`5856f1d`)

### Adicionado
- `server/ai/stt/streaming/streamingProviderChain.ts` — Strategy pattern para múltiplos providers
- `server/ai/stt/streaming/audioBuffer.ts` — Ring buffer para replay durante reconexões
- `server/ai/stt/streaming/streamingMetrics.ts` — Métricas de latência e qualidade
- `server/ai/stt/streaming/streaming.test.ts` — 17 testes unitários

### Provider Chain
```
Preferred (env) → AssemblyAI → Deepgram → OpenAI → null
                  ↓ (check)     ↓ (check)   ↓ (check)
                  API key?      API key?     Not implemented
```

### AudioBuffer
- Ring buffer de 10 segundos (configurável)
- Evita perda de áudio durante reconexões
- Método `drain()` para replay ao novo provider

### Métricas por Sessão
- Latência: avg, p95, max
- Qualidade: confidence média, palavras transcritas
- Confiabilidade: reconexões, erros, pacotes enviados

---

## Fase 6 — Observabilidade, Escalabilidade e Hardening (`fb2e3d3`)

### Adicionado
- `server/routes/health.ts` — Health check endpoint (`GET /api/health`)
- `server/lib/circuitBreaker.ts` — Circuit breaker (CLOSED/OPEN/HALF_OPEN)
- `server/lib/rateLimiter.ts` — Rate limiter (token bucket algorithm)
- `server/lib/hardening.test.ts` — 15 testes unitários

### Health Check
```
GET /api/health → 200 (healthy) | 503 (degraded/down)

Subsistemas monitorados:
- database (Supabase)
- stt_streaming (AssemblyAI/Deepgram)
- llm (Forge API)
- storage (S3)
```

### Circuit Breakers
| Instância | Threshold | Cooldown | Protege |
|-----------|-----------|----------|---------|
| `llmCircuitBreaker` | 5 falhas | 30s | Chamadas LLM |
| `sttCircuitBreaker` | 3 falhas | 60s | Transcrição batch |
| `storageCircuitBreaker` | 3 falhas | 15s | Operações S3 |

### Rate Limiters
| Instância | Max Burst | Refill | Protege |
|-----------|-----------|--------|---------|
| `aiRateLimiter` | 10 req | 0.5/s (30/min) | Endpoints de IA |
| `sttRateLimiter` | 5 req | 0.2/s (12/min) | Transcrição batch |
| `streamingRateLimiter` | 3 sessões | 0.1/s | Streaming sessions |

---

## Instruções de Deploy

### Pré-requisitos
1. Habilitar pgvector no Supabase: `CREATE EXTENSION IF NOT EXISTS vector;`
2. Executar migration: `supabase/migrations/001_knowledge_chunks.sql`
3. (Opcional) Rodar seed: `server/rag/seedKnowledge.ts`

### Variáveis de Ambiente Necessárias
- `ASSEMBLYAI_API_KEY` — Para streaming STT
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — Para RAG storage
- `BUILT_IN_FORGE_API_URL` + `BUILT_IN_FORGE_API_KEY` — Para LLM + embeddings

### Como Ativar o Pipeline Anti-Alucinação
O pipeline é aditivo e não substitui o fluxo existente. Para ativá-lo:
```typescript
import { runAntiHallucinationPipeline } from "./server/ai/pipeline";

const result = await runAntiHallucinationPipeline({
  consultationId: 123,
  transcript: "...",
  mode: "clinical", // ou "behavioral"
});
```

### Como Usar o RAG
```typescript
import { getRAGContext } from "./server/rag";

const context = await getRAGContext("perfil DISC dominância", { topK: 5 });
// context.formattedContext → string para injetar no prompt
```

---

## Testes

```bash
# Rodar todos os testes
pnpm test

# Rodar testes específicos
npx vitest run server/ai/pipeline/pipeline.test.ts
npx vitest run server/rag/rag.test.ts
npx vitest run server/ai/stt/streaming/streaming.test.ts
npx vitest run server/lib/hardening.test.ts
npx vitest run server/services/soapService.test.ts
npx vitest run server/services/neurovendasService.test.ts
```
