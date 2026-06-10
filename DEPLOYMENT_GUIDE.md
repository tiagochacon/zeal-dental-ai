# Guia de Deployment — RAG + Pipeline Anti-Alucinação

## Passo 1: Habilitar pgvector no Supabase

### 1.1 Acessar o Supabase Dashboard
1. Acesse: https://app.supabase.com
2. Selecione seu projeto **zeal-dental-ai**
3. Vá para **SQL Editor** (ícone de banco de dados no menu lateral)

### 1.2 Executar o comando para habilitar pgvector
1. Clique em **New Query**
2. Cole o seguinte comando:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
3. Clique em **Run** (ou Ctrl+Enter)
4. Você deve ver a mensagem: `Success. No rows returned.`

### 1.3 Verificar se pgvector foi habilitado
1. Clique em **New Query**
2. Cole:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```
3. Clique em **Run**
4. Você deve ver uma linha com `vector` na coluna `extname`

---

## Passo 2: Executar a Migration para Criar a Tabela `knowledge_chunks`

### 2.1 Acessar o arquivo de migration
O arquivo está em: `/home/ubuntu/zeal-dental-ai/supabase/migrations/001_knowledge_chunks.sql`

### 2.2 Executar a migration no Supabase
1. Vá para **SQL Editor** no Supabase Dashboard
2. Clique em **New Query**
3. Abra o arquivo `supabase/migrations/001_knowledge_chunks.sql` e copie TODO o conteúdo
4. Cole no editor SQL do Supabase
5. Clique em **Run**
6. Você deve ver: `Success. No rows returned.` (várias vezes, uma para cada comando)

### 2.3 Verificar se a tabela foi criada
1. Clique em **New Query**
2. Cole:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'knowledge_chunks';
```
3. Clique em **Run**
4. Você deve ver uma linha com `knowledge_chunks`

### 2.4 Verificar a estrutura da tabela
1. Clique em **New Query**
2. Cole:
```sql
\d public.knowledge_chunks
```
3. Clique em **Run**
4. Você deve ver as colunas: `id`, `clinic_id`, `category`, `content`, `embedding`, `metadata`, `created_at`, `updated_at`

---

## Passo 3: (Opcional) Rodar o Seed da Base de Conhecimento

### 3.1 O que é o seed?
O seed insere dados iniciais de conhecimento odontológico (perfis DISC, técnicas de neurovendas, gatilhos emocionais) na tabela `knowledge_chunks`.

### 3.2 Executar o seed
1. No terminal, navegue até o projeto:
```bash
cd /home/ubuntu/zeal-dental-ai
```

2. Rode o script de seed:
```bash
npx ts-node server/rag/seedKnowledge.ts
```

3. Você deve ver output como:
```
[seed] Inserting 50 knowledge chunks...
[seed] Inserted 50 chunks successfully
[seed] Knowledge base ready for RAG
```

### 3.3 Verificar se o seed foi inserido
1. No Supabase SQL Editor, execute:
```sql
SELECT COUNT(*) as total_chunks FROM knowledge_chunks;
```
2. Você deve ver um número > 0 (provavelmente 50 ou mais)

---

## Passo 4: Integrar o RAG nos Routers Existentes

### 4.1 Entender a arquitetura RAG
```
Transcrição → Retriever (busca por similaridade) → Top-K chunks → Injetar no prompt LLM
```

### 4.2 Exemplo: Integrar RAG no SOAP Generation

**Arquivo:** `server/services/soapService.ts`

**Antes (sem RAG):**
```typescript
const soapResult = await invokeAI({
  task: "soap_generation",
  input: {
    transcript: consultation.transcript,
    patientHistory: patient.medicalHistory,
  },
});
```

**Depois (com RAG):**
```typescript
import { getRAGContext } from "../rag";

// 1. Extrair contexto da transcrição (ex: queixa principal)
const clinicalContext = consultation.transcript.slice(0, 500); // primeiros 500 chars

// 2. Buscar chunks relevantes do RAG
const ragContext = await getRAGContext(clinicalContext, {
  topK: 5,
  clinicId: consultation.clinicId,
});

// 3. Injetar no prompt
const soapResult = await invokeAI({
  task: "soap_generation",
  input: {
    transcript: consultation.transcript,
    patientHistory: patient.medicalHistory,
    ragContext: ragContext.formattedContext, // ← Novo!
  },
});
```

### 4.3 Exemplo: Integrar Pipeline Anti-Alucinação

**Arquivo:** `server/services/soapService.ts`

**Antes (single-stage):**
```typescript
const soapResult = await invokeAI({
  task: "soap_generation",
  input: { transcript, patientHistory },
});
```

**Depois (two-stage pipeline):**
```typescript
import { runAntiHallucinationPipeline } from "../ai/pipeline";

const pipelineResult = await runAntiHallucinationPipeline({
  consultationId: consultation.id,
  transcript: consultation.transcript,
  mode: "clinical", // ou "behavioral" para neurovendas
  context: {
    patientHistory: patient.medicalHistory,
    clinicId: consultation.clinicId,
  },
});

// pipelineResult.extraction → fatos puros
// pipelineResult.interpretation → análise com RAG
// pipelineResult.evidence → citações da transcrição
```

---

## Passo 5: Testar a Integração

### 5.1 Rodar os testes do RAG
```bash
cd /home/ubuntu/zeal-dental-ai
npx vitest run server/rag/rag.test.ts
```
Você deve ver: `✓ 12 tests passed`

### 5.2 Rodar os testes do Pipeline
```bash
npx vitest run server/ai/pipeline/pipeline.test.ts
```
Você deve ver: `✓ 11 tests passed`

### 5.3 Rodar todos os testes
```bash
pnpm test
```
Você deve ver: `✓ 614 tests passed`

### 5.4 Verificar health check
```bash
curl http://localhost:3000/api/health
```
Você deve ver:
```json
{
  "status": "healthy",
  "timestamp": "2026-06-10T...",
  "uptime": 123,
  "subsystems": [
    { "name": "database", "status": "healthy", "latencyMs": 45 },
    { "name": "stt_streaming", "status": "healthy" },
    { "name": "llm", "status": "healthy", "latencyMs": 234 },
    { "name": "storage", "status": "healthy" }
  ]
}
```

---

## Passo 6: Ativar o Circuit Breaker e Rate Limiter

### 6.1 O que são?
- **Circuit Breaker:** Protege contra falhas em cascata (ex: LLM indisponível)
- **Rate Limiter:** Protege contra abuso (ex: muitas requisições simultâneas)

### 6.2 Usar o Circuit Breaker
```typescript
import { llmCircuitBreaker } from "../lib/circuitBreaker";

try {
  const result = await llmCircuitBreaker.execute(() => 
    invokeAI({ task: "soap_generation", input: {...} })
  );
} catch (err) {
  if (err.name === "CircuitOpenError") {
    // LLM está fora, usar fallback
    console.log("LLM indisponível, usando fallback...");
  }
}
```

### 6.3 Usar o Rate Limiter
```typescript
import { aiRateLimiter } from "../lib/rateLimiter";

const userId = ctx.user.id;
if (!aiRateLimiter.consume(userId)) {
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: `Rate limit exceeded. Remaining: ${aiRateLimiter.remaining(userId)}`,
  });
}

// Prosseguir com a chamada LLM
```

---

## Passo 7: Monitorar a Saúde do Sistema

### 7.1 Verificar logs estruturados
Os logs agora incluem contexto estruturado:
```
[logger] SOAP generation started {"consultationId": 123, "clinicId": 456}
[logger] RAG retrieval completed {"topK": 5, "latencyMs": 234}
[logger] LLM invocation completed {"model": "gemini-2.5-flash", "latencyMs": 1234}
```

### 7.2 Monitorar circuit breaker
```typescript
import { llmCircuitBreaker, sttCircuitBreaker } from "../lib/circuitBreaker";

const stats = {
  llm: llmCircuitBreaker.getStats(),
  stt: sttCircuitBreaker.getStats(),
};

console.log(stats);
// {
//   llm: { state: "CLOSED", failures: 0, successes: 45, totalRequests: 45 },
//   stt: { state: "HALF_OPEN", failures: 2, successes: 10, totalRequests: 12 }
// }
```

### 7.3 Monitorar rate limiter
```typescript
import { aiRateLimiter } from "../lib/rateLimiter";

const stats = aiRateLimiter.getStats();
console.log(stats);
// {
//   name: "ai-endpoints",
//   activeBuckets: 45,
//   totalConsumed: 1234,
//   totalRejected: 12
// }
```

---

## Checklist de Deployment

- [ ] pgvector habilitado no Supabase (`CREATE EXTENSION IF NOT EXISTS vector;`)
- [ ] Migration executada (`supabase/migrations/001_knowledge_chunks.sql`)
- [ ] Seed da base de conhecimento inserido (opcional)
- [ ] Testes do RAG passando (`npx vitest run server/rag/rag.test.ts`)
- [ ] Testes do pipeline passando (`npx vitest run server/ai/pipeline/pipeline.test.ts`)
- [ ] Health check respondendo (`curl http://localhost:3000/api/health`)
- [ ] Logs estruturados sendo gerados
- [ ] Circuit breaker e rate limiter testados
- [ ] Documentação atualizada (README.md, etc.)
- [ ] PR revisado e aprovado

---

## Troubleshooting

### Erro: "Extension vector does not exist"
**Solução:** Você não habilitou pgvector. Execute o Passo 1.2 novamente.

### Erro: "Table knowledge_chunks does not exist"
**Solução:** Você não executou a migration. Execute o Passo 2.2 novamente.

### Erro: "Circuit breaker is OPEN"
**Solução:** O LLM está falhando. Verifique:
1. `BUILT_IN_FORGE_API_KEY` está configurado?
2. `BUILT_IN_FORGE_API_URL` está acessível?
3. Há quota disponível na API?

### Erro: "Rate limit exceeded"
**Solução:** Muitas requisições simultâneas. Aguarde alguns segundos e tente novamente.

### RAG não retorna resultados
**Solução:** 
1. Verifique se o seed foi executado (`SELECT COUNT(*) FROM knowledge_chunks;`)
2. Verifique se o pgvector está habilitado (`SELECT * FROM pg_extension WHERE extname = 'vector';`)
3. Tente executar o seed novamente

---

## Próximos Passos

1. **Integrar RAG em todos os tasks de IA** (SOAP, neurovendas, DISC, etc.)
2. **Ativar o pipeline anti-alucinação** para consultas críticas
3. **Adicionar observabilidade** (logs, métricas, traces)
4. **Testar em produção** com dados reais
5. **Monitorar performance** e ajustar thresholds do circuit breaker/rate limiter

---

## Suporte

Se encontrar problemas:
1. Verifique os logs: `docker logs zeal-dental-ai` (ou equivalente no seu deploy)
2. Rode os testes: `pnpm test`
3. Verifique o health check: `curl http://localhost:3000/api/health`
4. Consulte o `CHANGELOG.md` para detalhes técnicos
