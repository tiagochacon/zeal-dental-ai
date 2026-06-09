# ARCHITECTURE_AUDIT.md — Zeal Dental AI

**Data:** 2026-06-09  
**Branch:** `refactor/rag-stt-v1`  
**Autor:** Agente de Refatoração  
**Objetivo:** Documentar a arquitetura atual, identificar gaps e propor plano de migração para RAG + STT melhorado.

---

## 1. Diagrama Textual da Arquitetura Atual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React 19)                            │
│  Wouter Router → DashboardLayout → Pages (Consultations, Calls, Leads...)  │
│  tRPC Client → @tanstack/react-query → HTTP /api/trpc/*                    │
│  Web Audio API → AudioWorklet → WebSocket /ws/consultation-streaming       │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ HTTP + WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express 4 + tRPC 11)                       │
│                                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────────────────┐  │
│  │ tRPC Routers│  │ REST Routes  │  │ WebSocket (raw, no socket.io)    │  │
│  │ - auth      │  │ - /api/upload│  │ - /ws/consultation-streaming     │  │
│  │ - patients  │  │ - /api/trans │  │   (AssemblyAI proxy)             │  │
│  │ - consult.  │  │ - /api/whats │  └───────────────────────────────────┘  │
│  │ - calls     │  │   app-upload │                                          │
│  │ - leads     │  └──────────────┘                                          │
│  │ - billing   │                                                            │
│  │ - clinic    │  ┌──────────────────────────────────────────────────────┐  │
│  │ - admin     │  │              AI LAYER                                │  │
│  └─────────────┘  │  invokeAI() → invokeLLM() → Manus Forge LLM API    │  │
│                    │  taskConfig: soap, treatment_plan, disc_profile,     │  │
│                    │    neurovendas_*, video_script, call_insights,       │  │
│                    │    whatsapp_summary, transcript_revalidation         │  │
│                    │  Validators: JSON, SOAP, TreatmentPlan, DISC, Neuro │  │
│                    │  Anti-Hallucination: evidence blocks, guardrails     │  │
│                    └──────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              STT LAYER                                               │   │
│  │  Batch: Deepgram → OpenAI Transcribe → Whisper (fallback chain)     │   │
│  │  Streaming: AssemblyAI u3-rt-pro (WebSocket proxy)                  │   │
│  │  Post-processing: hallucination filter, dental vocab, revalidation  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              DATA LAYER (Supabase Client — service_role key)         │   │
│  │  db.ts: ~1336 lines, all queries via supabase.from(...)             │   │
│  │  Tables: Users, Patients, Consultations, Calls, Leads, Clinics,     │   │
│  │    AudioChunks, Feedbacks, ConsultationTemplates, PaymentLogs,      │   │
│  │    PatientDentistAssignments                                        │   │
│  │  Multi-tenant: application-level clinicId filtering (NO RLS)        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              STORAGE (Manus Forge S3 proxy)                          │   │
│  │  storagePut / storageGet / storageDelete                            │   │
│  │  Audio files, exports, uploaded documents                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                    │
│  • Supabase (PostgreSQL) — database                                        │
│  • Manus Forge API — LLM (gemini-2.5-flash default), Storage, Whisper STT  │
│  • AssemblyAI — live streaming STT (u3-rt-pro)                             │
│  • Deepgram — batch STT (nova-3-medical, optional)                         │
│  • OpenAI — batch STT (whisper-1, optional)                                │
│  • Stripe — billing/subscriptions                                          │
│  • Resend — transactional emails                                           │
│  • Manus OAuth — authentication                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React 19 + Tailwind 4 + shadcn/ui | 19.2.1 |
| Routing (FE) | Wouter | 3.3.5 |
| State/Data (FE) | @tanstack/react-query + tRPC React | 5.90.2 / 11.6.0 |
| Backend | Express 4 + tRPC 11 | 4.21.2 / 11.6.0 |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js 2.100.0 |
| Schema Types | Drizzle ORM (type-only, MySQL syntax) | 0.44.5 |
| Auth | Manus OAuth + email/password (bcrypt + JWT) | jose 6.1.0 |
| LLM | Manus Forge API (gemini-2.5-flash default) | Custom wrapper |
| STT Batch | Deepgram / OpenAI / Whisper (chain) | Via API |
| STT Streaming | AssemblyAI u3-rt-pro | WebSocket |
| Storage | Manus Forge S3 proxy | Custom wrapper |
| Billing | Stripe | 20.1.2 |
| Email | Resend | 6.10.0 |
| Testing | Vitest | 2.1.4 |
| Build | Vite 7 + esbuild | 7.1.7 |

---

## 3. Pontos de Chamada a LLM

| Arquivo | Linha(s) | Propósito | Task Type |
|---------|----------|-----------|-----------|
| `server/routers/consultations.ts` | ~889 | Gerar SOAP Note | `soap` |
| `server/routers/consultations.ts` | ~300 | Gerar Treatment Plan | `treatment_plan` |
| `server/routers/consultations.ts` | ~1254 | Análise Neurovendas (consulta) | `neurovendas_consultation` |
| `server/routers/calls.ts` | ~25 | Call Insights | `call_insights` |
| `server/routers/calls.ts` | ~433 | Neurovendas de ligação | `neurovendas_call` |
| `server/routers/leads.ts` | ~123 | Video Script | `video_script` |
| `server/routes/whatsappUpload.ts` | ~179 | WhatsApp Summary | `whatsapp_summary` |
| `server/helpers/transcriptRevalidation.ts` | ~99 | Revalidação de transcrição | `transcript_revalidation` |

**Modelo padrão:** `gemini-2.5-flash` (via Manus Forge)  
**Fallback:** Configurável por env var, mas nenhum configurado por padrão (null).

---

## 4. Fluxo de Transcrição Atual

### 4.1 Batch (pós-gravação)

```
Áudio gravado → Upload S3 → transcribeAudio()
  → resolveProviderChain():
    consultation: Deepgram → OpenAI → Whisper
    call/whatsapp: Deepgram → OpenAI → Whisper
  → postProcessTranscript() (filtro de alucinações Whisper)
  → revalidateConsultationTranscript() (LLM fix de erros STT)
  → Salva transcript no banco
```

### 4.2 Streaming (tempo real)

```
Frontend AudioWorklet → WebSocket /ws/consultation-streaming
  → Backend valida auth + consultation ownership
  → Cria ConsultationStreamingSession
  → Proxy WebSocket para AssemblyAI (u3-rt-pro)
  → Recebe partial/final events → envia ao frontend
  → Frontend exibe legendas ao vivo
  → Ao finalizar: batch transcription é feita separadamente para SOAP/registro
```

### 4.3 Armazenamento

- **Transcrição final:** coluna `transcript` (text) na tabela `Consultations`/`Calls`
- **Segmentos:** coluna `transcriptSegments` (JSON) com timestamps e speakers
- **Chunks progressivos:** tabela `AudioChunks` (gravação resiliente)

---

## 5. Schema Atual do Supabase

### Tabelas

| Tabela | Propósito | Colunas-chave |
|--------|-----------|---------------|
| `Users` | Usuários (dentistas, CRCs, gestores) | id, openId, email, role, clinicId, clinicRole, subscriptionTier, stripeCustomerId |
| `Clinics` | Clínicas odontológicas | id, name, ownerId |
| `Patients` | Pacientes | id, dentistId, clinicId, name, phone, cpf |
| `PatientDentistAssignments` | Atribuição paciente↔dentista | patientId, dentistId, clinicId, role |
| `Consultations` | Consultas gravadas | id, dentistId, patientId, transcript, soapNote, neurovendasAnalysis, treatmentPlan |
| `AudioChunks` | Chunks de áudio progressivo | id, consultationId, chunkIndex, fileKey, transcriptionStatus |
| `Calls` | Ligações CRC↔Lead | id, clinicId, crcId, leadId, transcript, neurovendasAnalysis, callInsights |
| `Leads` | Leads (prospects) | id, clinicId, crcId, name, neurovendasAnalysis, callProfile |
| `Feedbacks` | Feedback pós-consulta | id, consultationId, rating |
| `ConsultationTemplates` | Templates de consulta | id, dentistId, name, promptCustomization |
| `payment_logs` | Audit trail Stripe | id, eventId, userId, amount, status |

### RLS (Row Level Security)

**NÃO HÁ RLS CONFIGURADO.** O isolamento multi-tenant é feito **inteiramente em código** (application-level) via filtros `clinicId` nos queries do `db.ts`. O backend usa `SUPABASE_SERVICE_ROLE_KEY` que bypassa qualquer RLS.

### Índices

Não há índices customizados documentados além dos PKs automáticos. Não há extensão `pgvector` ativa.

---

## 6. Fluxo de Autenticação e Multi-Tenant

### Autenticação

1. **Manus OAuth:** `/api/oauth/callback` → troca code por token → cria/atualiza User → JWT session cookie
2. **Email/Password:** `/api/trpc/auth.emailLogin` → bcrypt verify → JWT session cookie
3. **Sessão:** JWT assinado com `JWT_SECRET`, verificado em cada request via `sdk.authenticateRequest()`

### Multi-Tenant (Isolamento)

- **Modelo:** Cada `User` pertence a uma `Clinic` via `clinicId`
- **Roles:** `gestor` (dono), `crc` (comercial), `dentista` (clínico)
- **Isolamento:** Application-level — queries filtram por `clinicId` ou `dentistId`
- **Billing:** Herança do gestor — CRC/dentista herdam tier do gestor da clínica
- **Admin bypass:** Lista hardcoded de emails admin + role `admin` no banco

---

## 7. Gaps Identificados em Relação ao Objetivo

| # | Gap | Severidade | Impacto |
|---|-----|-----------|---------|
| G1 | **Sem RAG/grounding** — análise comportamental é feita diretamente da transcrição sem base de conhecimento estruturada | CRÍTICO | LLM alucina ao inferir perfis sem contexto de referência |
| G2 | **Pipeline monolítico** — extração de sinais e interpretação acontecem em uma única chamada LLM | ALTO | Impossível rastrear evidências, validar parcialmente, ou iterar |
| G3 | **Sem pgvector** — não há embedding, retrieval, ou base vetorial | ALTO | Impossível fazer grounding com documentos de metodologia |
| G4 | **Sem RLS** — isolamento multi-tenant é 100% application-level | MÉDIO | Risco de vazamento de dados entre tenants em caso de bug |
| G5 | **Sem redação de PII** — transcrições são armazenadas com dados pessoais | ALTO | Violação potencial de LGPD |
| G6 | **Sem observabilidade LLM** — logs são console.log, sem Langfuse ou equivalente | MÉDIO | Impossível auditar qualidade, custo, latência por invocação |
| G7 | **Sem Soniox** — streaming usa apenas AssemblyAI, sem fallback de provider | MÉDIO | Single point of failure para transcrição ao vivo |
| G8 | **Sem diarização confiável** — streaming não identifica dentista vs. paciente | MÉDIO | Análise comportamental não sabe quem falou o quê |
| G9 | **Sem custom vocabulary robusto** — vocabulário odontológico é parcial | BAIXO | Termos técnicos podem ser mal transcritos |
| G10 | **Sem rate limiting** — não há controle de taxa por tenant para chamadas LLM | MÉDIO | Risco de abuso e custo imprevisível |
| G11 | **Sem fila assíncrona** — análises pesadas são síncronas no request | MÉDIO | Timeout em análises longas, UX degradada |
| G12 | **Sem circuit breaker** — falha de API externa propaga para o usuário | BAIXO | Degradação em cascata |
| G13 | **Metodologia vazia** — pasta `server/metodologia/` não tem documentos | CRÍTICO | LLM opera em "modo de baixa confiança" sem base documental |
| G14 | **Sem evidências rastreáveis** — conclusões não citam trechos específicos da transcrição | ALTO | Impossível validar se análise é fundamentada |

---

## 8. Riscos Identificados

| # | Risco | Probabilidade | Impacto | Mitigação Proposta |
|---|-------|--------------|---------|-------------------|
| R1 | Alucinação em análise comportamental sem grounding | ALTA | ALTO | Implementar RAG com pgvector + pipeline de 2 etapas |
| R2 | Vazamento de PII entre tenants | MÉDIA | CRÍTICO | Implementar RLS + redação de PII antes de storage vetorial |
| R3 | Custo imprevisível de LLM em escala | MÉDIA | ALTO | Rate limiting + caching de embeddings + observabilidade |
| R4 | Perda de transcrição em sessões longas | BAIXA | ALTO | Já mitigado com AudioChunks progressivos |
| R5 | Inconsistência de saída da LLM | ALTA | MÉDIO | Já parcialmente mitigado com JSON Schema strict + validators |
| R6 | Downtime do AssemblyAI sem fallback | MÉDIA | MÉDIO | Adicionar Soniox como primary, AssemblyAI como fallback |
| R7 | Schema Drizzle diverge do Supabase real | ALTA | BAIXO | Já documentado no schema.ts, mas sem enforcement |

---

## 9. Plano de Migração Proposto (Fase-a-Fase)

### Fase 2: Refatoração de Qualidade de Código
- Extrair lógica de negócio dos routers (1468 linhas em consultations.ts) para services
- Adicionar logger estruturado (substituir console.log)
- Padronizar tratamento de erros
- Melhorar tipagem (remover `as any`)
- Rodar linter e corrigir warnings

### Fase 3: Implementação do RAG
- Ativar extensão pgvector no Supabase
- Criar tabela `knowledge_base` com coluna `embedding vector(1536)`
- Implementar módulos de ingestão (chunking, embedding, PII redaction)
- Implementar retrieval (similarity search com threshold)
- Criar script de seed com materiais de metodologia DISC/neurovendas
- Criar endpoint de upload de conhecimento por tenant

### Fase 4: Pipeline Anti-Alucinação
- Separar em 2 etapas: Extractor (sinais brutos) → Interpreter (classificação com RAG)
- Extractor: tool use com citação literal obrigatória
- Interpreter: recebe sinais + chunks relevantes do RAG → classifica com evidências
- Output com `evidences[]` rastreáveis (signal_id + knowledge_chunk_id)
- Feature flag para alternar entre pipeline antigo e novo

### Fase 5: Refatoração STT
- Adicionar Soniox como provider primário de streaming
- Manter AssemblyAI como fallback
- Implementar diarização dentista/paciente
- Expandir vocabulário odontológico
- Implementar redação de PII em tempo real
- Adicionar métricas de qualidade (WER, latência, taxa de fallback)

### Fase 6: Observabilidade e Escalabilidade
- Integrar Langfuse para rastreamento de chamadas LLM
- Implementar rate limiting por tenant
- Implementar caching de embeddings
- Adicionar circuit breaker para APIs externas
- Documentar limites operacionais

### Fase 7: Fechamento
- Atualizar README.md e CHANGELOG.md
- Garantir cobertura de testes ≥ 70%
- Commit final + PR para main

---

## 10. Métricas Atuais (Baseline)

| Métrica | Valor |
|---------|-------|
| Testes | 548 passando (43 arquivos) |
| Linhas de código (server) | ~6.366 (routers + routes) |
| Tabelas no banco | 11 |
| Tasks de IA | 10 tipos configurados |
| Providers STT | 3 batch (Deepgram, OpenAI, Whisper) + 1 streaming (AssemblyAI) |
| RLS policies | 0 |
| Documentos de metodologia | 0 (pasta vazia) |
| Grounding/RAG | Inexistente |
| Observabilidade LLM | console.log apenas |
| PII redaction | Inexistente |

---

## 11. Conclusão

O sistema atual é funcional e bem testado (548 testes), com uma arquitetura de IA já modularizada (`invokeAI`, `taskConfig`, validators). No entanto, a **ausência de grounding (RAG)** e a **abordagem monolítica de análise** são os principais fatores que causam alucinação. A pasta de metodologia vazia agrava o problema — o LLM não tem base documental para fundamentar suas conclusões.

A refatoração proposta mantém a infraestrutura existente (Supabase, Manus Forge, tRPC) e adiciona camadas de RAG, pipeline de 2 etapas, e observabilidade sem quebrar o que já funciona.

**Próximo passo:** Aguardar aprovação deste documento para iniciar a Fase 2 (Refatoração de Qualidade de Código).
