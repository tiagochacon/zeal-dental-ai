# Exemplos de Integração RAG nos Routers

Este arquivo contém exemplos práticos de como integrar o RAG (Retrieval-Augmented Generation) nos routers existentes do projeto.

---

## Exemplo 1: Integrar RAG no SOAP Generation

**Arquivo:** `server/services/soapService.ts`

### Antes (sem RAG):

```typescript
export async function generateSOAP(
  consultation: Consultation,
  patient: Patient,
  transcript: string
): Promise<SOAPResult> {
  const soapResult = await invokeAI({
    task: "soap_generation",
    input: {
      transcript,
      patientHistory: patient.medicalHistory,
    },
  });

  return parseSoapResult(soapResult);
}
```

### Depois (com RAG):

```typescript
import { getRAGContext } from "../rag";

export async function generateSOAPWithRAG(
  consultation: Consultation,
  patient: Patient,
  transcript: string
): Promise<SOAPResult> {
  // 1. Extrair contexto clínico da transcrição (primeiros 500 chars)
  const clinicalContext = transcript.slice(0, 500);

  // 2. Buscar chunks relevantes do RAG
  const ragContext = await getRAGContext(clinicalContext, {
    topK: 5,
    category: "clinical", // Buscar apenas chunks de clínica
    clinicId: consultation.clinicId,
  });

  // 3. Injetar RAG context no prompt
  const soapResult = await invokeAI({
    task: "soap_generation",
    input: {
      transcript,
      patientHistory: patient.medicalHistory,
      ragContext: ragContext.formattedContext, // ← NOVO!
      ragSources: ragContext.sources, // ← Rastreabilidade
    },
  });

  return parseSoapResult(soapResult);
}
```

---

## Exemplo 2: Integrar RAG no Neurovendas Analysis

**Arquivo:** `server/services/neurovendasService.ts`

### Antes (sem RAG):

```typescript
export async function analyzeNeurovendas(
  consultation: Consultation,
  transcript: string
): Promise<NeurovendasResult> {
  const result = await invokeAI({
    task: "neurovendas_analysis",
    input: {
      transcript,
      patientProfile: consultation.patientProfile,
    },
  });

  return parseNeurovendasResult(result);
}
```

### Depois (com RAG):

```typescript
import { getRAGContext } from "../rag";

export async function analyzeNeurovendasWithRAG(
  consultation: Consultation,
  transcript: string
): Promise<NeurovendasResult> {
  // 1. Extrair gatilhos emocionais da transcrição
  const emotionalContext = extractEmotionalCues(transcript);

  // 2. Buscar técnicas de neurovendas relevantes do RAG
  const ragContext = await getRAGContext(emotionalContext, {
    topK: 5,
    category: "neurovendas", // Buscar chunks de neurovendas
    clinicId: consultation.clinicId,
  });

  // 3. Injetar RAG context no prompt
  const result = await invokeAI({
    task: "neurovendas_analysis",
    input: {
      transcript,
      patientProfile: consultation.patientProfile,
      ragContext: ragContext.formattedContext, // ← NOVO!
      ragSources: ragContext.sources,
    },
  });

  return parseNeurovendasResult(result);
}
```

---

## Exemplo 3: Usar o Pipeline Anti-Alucinação com RAG

**Arquivo:** `server/routers/consultations.ts`

### Integrar no router de finalize:

```typescript
import { runAntiHallucinationPipeline } from "../ai/pipeline";
import { getRAGContext } from "../rag";

export const consultationRouter = createTRPCRouter({
  finalize: protectedProcedure
    .input(z.object({ consultationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const consultation = await db.getConsultation(input.consultationId);
      const patient = await db.getPatient(consultation.patientId);

      // 1. Executar pipeline anti-alucinação com RAG
      const pipelineResult = await runAntiHallucinationPipeline({
        consultationId: consultation.id,
        transcript: consultation.transcript,
        mode: "clinical",
        context: {
          patientHistory: patient.medicalHistory,
          clinicId: consultation.clinicId,
        },
        // ← Novo: Passar RAG retriever
        ragRetriever: async (query) => {
          return getRAGContext(query, {
            topK: 5,
            clinicId: consultation.clinicId,
          });
        },
      });

      // 2. Salvar resultados com rastreabilidade
      await db.updateConsultation(consultation.id, {
        soapNotes: pipelineResult.interpretation.soap,
        neurovendasAnalysis: pipelineResult.interpretation.neurovendas,
        extractedFacts: pipelineResult.extraction,
        ragSources: pipelineResult.ragSources,
        evidence: pipelineResult.evidence,
      });

      return {
        success: true,
        consultationId: consultation.id,
        soap: pipelineResult.interpretation.soap,
        neurovendas: pipelineResult.interpretation.neurovendas,
        evidence: pipelineResult.evidence,
      };
    }),
});
```

---

## Exemplo 4: Buscar Conhecimento Manualmente

Se você quiser buscar conhecimento do RAG manualmente em qualquer lugar:

```typescript
import { getRAGContext } from "../server/rag";

// Buscar chunks sobre DISC
const discChunks = await getRAGContext("Como identificar perfil DISC?", {
  topK: 5,
  category: "disc",
  clinicId: 123, // ID da clínica
});

console.log(discChunks.formattedContext);
// Output:
// "Fonte 1: Metodologia DISC para Odontologia
//  O perfil DISC é dividido em 4 tipos...
//  
//  Fonte 2: Avaliação de Rapport em Consultas
//  Para identificar o tipo DISC, observe..."

// Usar no prompt
const result = await invokeAI({
  task: "disc_profile_analysis",
  input: {
    transcript,
    ragContext: discChunks.formattedContext,
  },
});
```

---

## Exemplo 5: Adicionar Novo Documento à Base de Conhecimento

Se você quiser adicionar novo conhecimento dinamicamente:

```typescript
import { ingestDocuments } from "../server/rag/ingestor";

// Adicionar novo protocolo clínico
await ingestDocuments([
  {
    documentId: "new-protocol-implants-v1",
    documentTitle: "Protocolo de Implantes Dentários",
    documentType: "protocol",
    category: "clinical",
    content: `
      Protocolo de Implantes Dentários
      
      1. Avaliação Pré-Implante
         - Radiografia panorâmica
         - Tomografia computadorizada
         - Análise óssea
      
      2. Planejamento
         - Posicionamento do implante
         - Seleção de diâmetro e comprimento
         - Planejamento protético
      
      3. Execução
         - Anestesia adequada
         - Fresagem progressiva
         - Inserção do implante
         - Torque de inserção: 35-45 Ncm
      
      4. Pós-operatório
         - Repouso por 24h
         - Antibióticos por 7 dias
         - Acompanhamento em 7, 14, 30 dias
    `,
    clinicId: null, // null = global, ou número da clínica
  },
]);

// Agora você pode buscar por implantes
const implantChunks = await getRAGContext("Como fazer implante?", {
  topK: 5,
  category: "clinical",
});
```

---

## Exemplo 6: Testar a Integração

```typescript
// test/rag-integration.test.ts
import { describe, it, expect } from "vitest";
import { getRAGContext } from "../server/rag";
import { generateSOAPWithRAG } from "../server/services/soapService";

describe("RAG Integration", () => {
  it("should retrieve relevant DISC methodology", async () => {
    const result = await getRAGContext("Como identificar DISC?", {
      topK: 5,
      category: "disc",
    });

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.formattedContext).toContain("DISC");
  });

  it("should generate SOAP with RAG context", async () => {
    const consultation = {
      id: 1,
      clinicId: 1,
      transcript: "Paciente com dor em dente 36...",
    };

    const patient = {
      medicalHistory: "Sem alergias conhecidas",
    };

    const soap = await generateSOAPWithRAG(
      consultation as any,
      patient as any,
      consultation.transcript
    );

    expect(soap.subjective).toBeDefined();
    expect(soap.objective).toBeDefined();
    expect(soap.assessment).toBeDefined();
    expect(soap.plan).toBeDefined();
  });
});
```

---

## Checklist de Integração

- [ ] Importar `getRAGContext` do módulo RAG

- [ ] Adicionar parâmetro `ragContext` ao `invokeAI`

- [ ] Testar com `getRAGContext("query", { topK: 5 })`

- [ ] Verificar que os chunks retornados são relevantes

- [ ] Adicionar testes unitários

- [ ] Validar que a rastreabilidade (sources) está sendo salva

- [ ] Rodar `pnpm test` para garantir que nada quebrou

- [ ] Fazer commit com `git add -A && git commit -m "feat: integrate RAG into SOAP/neurovendas"`

---

## Troubleshooting

### "No chunks found"

- Verifique se o seed foi executado: `pnpm exec tsx server/rag/seedKnowledge.ts`

- Verifique se a query é relevante para a categoria

### "Circuit breaker is OPEN"

- O LLM está falhando. Verifique a API key e quota.

### "Chunks não são relevantes"

- Ajuste o `topK` (mais alto = mais resultados)

- Tente uma query diferente

- Adicione mais documentos ao seed

---

## Próximos Passos

1. **Integrar RAG em todos os tasks de IA** (SOAP, neurovendas, DISC, etc.)

1. **Adicionar observabilidade** (logs de quais chunks foram usados)

1. **Testar em produção** com dados reais

1. **Monitorar performance** (latência de retrieval)

1. **Adicionar embeddings** quando o Forge API suportar

