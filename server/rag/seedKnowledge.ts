/**
 * RAG Knowledge Base Seed Data
 *
 * Contains the core methodology documents for the dental neurovendas system.
 * These documents are ingested into the KnowledgeChunks table and used as
 * grounding context for all LLM analysis calls.
 *
 * Run via: npx tsx server/rag/seedKnowledge.ts
 */
import { ingestDocuments, type IngestDocumentInput } from "./ingestor";
import { createLogger } from "../lib/logger";

const log = createLogger("rag:seed");

// --------------------------------------------------------------------------
// Methodology Documents
// --------------------------------------------------------------------------

const DISC_METHODOLOGY: IngestDocumentInput = {
  documentId: "disc-methodology-v1",
  title: "Metodologia DISC para Odontologia",
  type: "methodology",
  category: "disc",
  content: `# Metodologia DISC Aplicada à Odontologia

## Fundamentos do DISC

O modelo DISC classifica comportamentos observáveis em quatro dimensões:

### Dominância (D)
- **Características:** Direto, decisivo, orientado a resultados, competitivo
- **Na consulta:** Paciente que vai direto ao ponto, quer saber o que precisa ser feito e quanto custa
- **Sinais verbais:** "Qual o melhor tratamento?", "Quanto tempo leva?", "Vamos resolver isso logo"
- **Sinais não-verbais:** Postura firme, contato visual direto, gestos assertivos
- **Motivadores:** Controle, eficiência, resultados rápidos
- **Medos:** Perder tempo, ser enganado, não ter controle
- **Como comunicar:** Seja direto, apresente opções com prós/contras, respeite o tempo
- **O que evitar:** Rodeios, excesso de detalhes técnicos desnecessários, indecisão
- **Frase modelo:** "Doutor, tenho três opções para resolver isso. A mais rápida é X, a mais duradoura é Y."

### Influência (I)
- **Características:** Entusiasta, otimista, sociável, persuasivo
- **Na consulta:** Paciente que conta histórias, faz perguntas sobre experiências de outros, quer conexão
- **Sinais verbais:** "Minha amiga fez e ficou lindo", "Vi no Instagram", "Quero ficar com um sorriso incrível"
- **Sinais não-verbais:** Expressivo, gesticulação ampla, sorriso fácil, tom animado
- **Motivadores:** Reconhecimento social, aparência, experiências positivas, validação
- **Medos:** Rejeição social, resultado que não impressione, ficar "feio"
- **Como comunicar:** Use storytelling, mostre antes/depois, crie entusiasmo, valide emoções
- **O que evitar:** Dados frios sem contexto emocional, ignorar aspectos sociais, ser muito técnico
- **Frase modelo:** "Vou te mostrar como ficou uma paciente com um caso parecido — ela adorou o resultado!"

### Estabilidade (S)
- **Características:** Paciente, leal, bom ouvinte, busca segurança
- **Na consulta:** Paciente que faz muitas perguntas sobre riscos, quer garantias, precisa de tempo
- **Sinais verbais:** "É seguro?", "Tem algum risco?", "Preciso pensar", "Meu dentista anterior fazia assim"
- **Sinais não-verbais:** Postura retraída, fala pausada, evita decisões rápidas
- **Motivadores:** Segurança, previsibilidade, confiança no profissional, rotina
- **Medos:** Mudanças bruscas, dor, resultados imprevisíveis, pressão para decidir
- **Como comunicar:** Seja paciente, explique passo a passo, ofereça garantias, dê tempo
- **O que evitar:** Pressionar decisão, mudar planos sem aviso, minimizar preocupações
- **Frase modelo:** "Vamos fazer isso com calma, um passo de cada vez. Você pode me ligar se tiver qualquer dúvida."

### Conformidade (C)
- **Características:** Analítico, preciso, orientado a dados, perfeccionista
- **Na consulta:** Paciente que pesquisou antes, traz perguntas técnicas, quer evidências
- **Sinais verbais:** "Li que esse material dura X anos", "Qual a taxa de sucesso?", "Tem estudos sobre isso?"
- **Sinais não-verbais:** Anotações, postura formal, perguntas sequenciais e organizadas
- **Motivadores:** Qualidade, precisão, evidências, custo-benefício comprovado
- **Medos:** Erro médico, falta de informação, decisão sem dados suficientes
- **Como comunicar:** Apresente dados, estudos, taxas de sucesso, materiais de qualidade
- **O que evitar:** Respostas vagas, "confie em mim" sem evidências, generalizar
- **Frase modelo:** "Esse material tem taxa de sucesso de 95% em 10 anos segundo estudos clínicos. Vou te enviar o artigo."

## Regras de Classificação

1. **Mínimo de evidências:** Pelo menos 3 sinais verbais/comportamentais para classificar
2. **Confiança mínima:** Abaixo de 40% de confiança, marcar como "inconclusivo"
3. **Perfil secundário:** Identificar quando há traços mistos (ex: D/I ou S/C)
4. **Contexto importa:** O mesmo paciente pode variar entre consultas (ansiedade, dor)
5. **Nunca inventar:** Se não há evidência suficiente, não classificar — prefira "dados insuficientes"

## Erros Comuns a Evitar

- Confundir ansiedade situacional com perfil S (estabilidade)
- Classificar paciente como D (dominância) apenas por ser assertivo sobre preço
- Assumir I (influência) apenas por mencionar redes sociais
- Classificar C (conformidade) apenas por fazer perguntas — todo paciente faz perguntas
`,
};

const NEUROVENDAS_METHODOLOGY: IngestDocumentInput = {
  documentId: "neurovendas-methodology-v1",
  title: "Neurovendas Odontológicas — Framework Completo",
  type: "methodology",
  category: "neurovendas",
  content: `# Framework de Neurovendas Odontológicas

## Princípios Fundamentais

### Os Três Cérebros na Decisão de Tratamento

1. **Reptiliano (Sobrevivência):** Responde a dor, medo, urgência
   - Ativado quando: paciente com dor aguda, medo de perder dente, emergência
   - Linguagem: "preciso resolver", "não aguento mais", "tenho medo de..."
   - Abordagem: Alívio imediato, segurança, proteção

2. **Límbico (Emocional):** Responde a emoções, relacionamentos, pertencimento
   - Ativado quando: paciente quer melhorar autoestima, impressionar, pertencer
   - Linguagem: "quero me sentir bem", "vergonha de sorrir", "minha amiga fez"
   - Abordagem: Empatia, storytelling, transformação pessoal

3. **Neocórtex (Racional):** Responde a dados, lógica, análise custo-benefício
   - Ativado quando: paciente pesquisa, compara, analisa opções
   - Linguagem: "qual a taxa de sucesso?", "quanto dura?", "vale a pena?"
   - Abordagem: Evidências, comparações objetivas, ROI do tratamento

## Técnica PARE (Script de Objeção)

### P — Problema
Identifique e nomeie o problema do paciente usando as palavras DELE.
- "Entendo que você está preocupado com [problema nas palavras do paciente]"

### A — Amplificação
Mostre as consequências de NÃO resolver (sem ser alarmista).
- "Se não tratarmos agora, [consequência realista e documentada]"

### R — Resolução
Apresente a solução conectada ao problema amplificado.
- "O tratamento X resolve exatamente isso porque [mecanismo]"

### E — Engajamento
Convide para o próximo passo (não pressione).
- "Posso explicar como funciona o processo?" / "Quer que eu monte um plano?"

## Técnica LAER (Tratamento de Objeções)

### L — Listen (Escutar)
Deixe o paciente terminar. Não interrompa. Demonstre escuta ativa.

### A — Acknowledge (Reconhecer)
Valide a preocupação: "Entendo perfeitamente sua preocupação com..."

### E — Explore (Explorar)
Faça perguntas para entender a objeção real: "O que exatamente te preocupa sobre...?"

### R — Respond (Responder)
Responda à objeção REAL (não à superficial) com evidências e empatia.

## Categorias de Objeções

### Financeira
- Sinais: "É muito caro", "Não tenho condições", "Vou ver se consigo"
- Objeção real possível: Não vê valor suficiente, medo de se comprometer
- Técnica: Fragmentar valor (custo por dia/mês), comparar com gastos cotidianos

### Medo
- Sinais: "Tenho medo de dor", "E se der errado?", "Já tive experiência ruim"
- Objeção real possível: Trauma anterior, falta de confiança no profissional
- Técnica: Validar medo, explicar diferenças, oferecer garantias concretas

### Tempo
- Sinais: "Agora não dá", "Vou pensar", "Depois eu volto"
- Objeção real possível: Não está convencido, precisa de mais informação
- Técnica: Entender urgência real, mostrar consequências do adiamento

### Confiança
- Sinais: "Vou pedir outra opinião", "Meu dentista anterior disse diferente"
- Objeção real possível: Não confia no diagnóstico ou no profissional
- Técnica: Mostrar evidências, oferecer segunda opinião, ser transparente

## Rapport — Métricas de Avaliação

### Componentes do Rapport (0-100 cada)

1. **Validação Emocional (0-20):** Dentista reconhece e valida sentimentos do paciente
2. **Espelhamento Linguístico (0-20):** Dentista usa vocabulário similar ao do paciente
3. **Escuta Ativa (0-20):** Dentista faz perguntas de follow-up, não interrompe
4. **Equilíbrio de Turnos (0-20):** Proporção adequada de fala (paciente deve falar 40-60%)
5. **Ausência de Interrupções (0-20):** Dentista não corta a fala do paciente

### Cálculo do Score
- Score total = soma dos 5 componentes (máximo 100)
- Abaixo de 40: Rapport fraco — risco de perda do paciente
- 40-70: Rapport adequado — há espaço para melhoria
- Acima de 70: Rapport forte — boa conexão estabelecida

## Gatilhos Mentais Éticos

### Transformação
- Quando usar: Paciente quer mudança de vida/aparência
- Exemplo: "Imagine como vai ser sorrir com confiança nas fotos"
- Evidência necessária: Paciente mencionou desejo de mudança

### Saúde/Longevidade
- Quando usar: Paciente preocupado com saúde a longo prazo
- Exemplo: "Manter esses dentes saudáveis por mais 30 anos"
- Evidência necessária: Paciente mencionou preocupação com saúde

### Status
- Quando usar: Paciente valoriza aparência profissional/social
- Exemplo: "Um sorriso alinhado transmite confiança profissional"
- Evidência necessária: Paciente mencionou contexto profissional/social

### Conforto
- Quando usar: Paciente quer eliminar desconforto/dor
- Exemplo: "Resolver isso vai eliminar aquele incômodo de vez"
- Evidência necessária: Paciente relatou dor ou desconforto

### Exclusividade
- Quando usar: Paciente valoriza qualidade premium
- Exemplo: "Esse material é o mais avançado disponível hoje"
- Evidência necessária: Paciente perguntou sobre qualidade/materiais
`,
};

const RAPPORT_METHODOLOGY: IngestDocumentInput = {
  documentId: "rapport-methodology-v1",
  title: "Avaliação de Rapport em Consultas Odontológicas",
  type: "methodology",
  category: "rapport",
  content: `# Avaliação de Rapport em Consultas Odontológicas

## Definição

Rapport é a qualidade da conexão interpessoal entre dentista e paciente durante a consulta.
Um bom rapport aumenta a adesão ao tratamento, reduz ansiedade e melhora a experiência do paciente.

## Indicadores de Rapport Forte

### Verbais
- Dentista usa o nome do paciente
- Dentista repete/parafraseia o que o paciente disse
- Perguntas abertas ("Como você se sente sobre...?")
- Validação explícita ("Entendo sua preocupação", "Faz sentido você pensar assim")
- Humor apropriado e natural
- Explicações adaptadas ao nível do paciente

### Não-Verbais (inferidos da transcrição)
- Pausas adequadas (dentista não fala sem parar)
- Turnos equilibrados (paciente tem espaço para falar)
- Ausência de interrupções
- Respostas que demonstram que ouviu (referência a algo dito antes)

## Indicadores de Rapport Fraco

### Verbais
- Monólogo técnico sem verificar entendimento
- Ignorar perguntas ou preocupações do paciente
- Respostas genéricas que não endereçam a preocupação específica
- Pressão para decisão sem espaço para reflexão
- Linguagem condescendente ou paternalista

### Estruturais
- Dentista fala mais de 70% do tempo
- Paciente responde apenas "sim/não" (não se sente à vontade)
- Consulta muito curta sem espaço para perguntas
- Ausência de perguntas sobre expectativas/medos

## Regras de Avaliação

1. **Não inferir tom de voz** — use apenas o texto da transcrição
2. **Contexto importa** — uma consulta de emergência tem dinâmica diferente de uma avaliação estética
3. **Proporção de fala** — ideal é 40-60% paciente / 40-60% dentista
4. **Qualidade > quantidade** — uma validação genuína vale mais que várias perguntas superficiais
5. **Não penalizar brevidade** — consultas curtas podem ter rapport excelente se eficientes

## Escala de Pontuação

- **0-20:** Rapport inexistente — comunicação puramente transacional
- **21-40:** Rapport fraco — tentativas mínimas de conexão
- **41-60:** Rapport adequado — conexão básica estabelecida
- **61-80:** Rapport bom — paciente se sente ouvido e respeitado
- **81-100:** Rapport excelente — conexão profunda, confiança mútua evidente
`,
};

const OBJECTION_HANDLING: IngestDocumentInput = {
  documentId: "objection-handling-v1",
  title: "Tratamento de Objeções em Odontologia",
  type: "guideline",
  category: "objection_handling",
  content: `# Tratamento de Objeções em Odontologia

## Princípio Fundamental

Toda objeção é um pedido de mais informação disfarçado. O paciente não está dizendo "não" —
está dizendo "ainda não me convenceu" ou "tenho medo que não me contou".

## Objeções Verdadeiras vs. Ocultas

### Objeção Verdadeira
- O paciente verbaliza claramente a preocupação
- Exemplo: "Não tenho R$5.000 para pagar agora"
- Tratamento: Endereçar diretamente (parcelamento, priorização)

### Objeção Oculta
- O paciente diz uma coisa mas a preocupação real é outra
- Exemplo: Diz "vou pensar" mas na verdade tem medo de dor
- Sinais: Hesitação, respostas vagas, mudança de assunto
- Tratamento: Perguntas exploratórias para revelar a objeção real

## Categorização de Objeções

### Financeira
**Sinais detectáveis na transcrição:**
- "É muito caro", "Não tenho condições", "Preciso ver meu orçamento"
- "Tem algo mais barato?", "Meu plano cobre?"
- Hesitação ao ouvir valores, silêncio após preço

**Técnicas recomendadas:**
- Fragmentação: "São R$3,50 por dia durante 2 anos"
- Comparação: "Menos que um café por dia"
- Priorização: "Podemos começar pelo mais urgente"
- Valor: "Quanto custa NÃO tratar? Perder o dente custa X"

### Medo/Dor
**Sinais detectáveis:**
- "Tenho medo", "Vai doer?", "Já tive experiência ruim"
- "É muito invasivo?", "Tem anestesia?"
- Perguntas repetidas sobre o procedimento

**Técnicas recomendadas:**
- Validação: "É completamente normal ter essa preocupação"
- Diferenciação: "Hoje a tecnologia é completamente diferente"
- Controle: "Você pode levantar a mão a qualquer momento"
- Gradualidade: "Vamos fazer uma sessão teste primeiro"

### Tempo
**Sinais detectáveis:**
- "Agora não dá", "Depois eu volto", "Vou pensar"
- "Estou muito ocupado", "Mês que vem talvez"
- Não agenda retorno, respostas evasivas sobre datas

**Técnicas recomendadas:**
- Consequência: "Adiar pode transformar uma restauração em canal"
- Facilidade: "São apenas 40 minutos, posso encaixar no horário de almoço"
- Urgência real: "Essa fratura pode piorar nas próximas semanas"

### Confiança
**Sinais detectáveis:**
- "Vou pedir outra opinião", "Meu dentista anterior disse diferente"
- "Você tem experiência com isso?", "Quantos casos já fez?"
- Comparações com outros profissionais

**Técnicas recomendadas:**
- Transparência: "Vou te mostrar exatamente o que estou vendo"
- Evidência: "Aqui está o raio-X, veja essa área escura"
- Abertura: "Fico feliz que queira outra opinião — é seu direito"
- Credencial: "Tenho X anos de experiência e Y casos similares"

## Regras de Identificação

1. Uma objeção só é "verdadeira" se o paciente a verbalizou explicitamente
2. Objeções "ocultas" são HIPÓTESES baseadas em sinais — sempre marcar como tal
3. Nunca atribuir mais de 2 objeções ocultas sem evidência forte
4. Se não há sinais claros de objeção, NÃO inventar — reportar "sem objeções detectadas"
5. Objeções podem ser legítimas — nem toda objeção precisa ser "superada"
`,
};

const CLINICAL_SOAP: IngestDocumentInput = {
  documentId: "clinical-soap-v1",
  title: "Diretrizes SOAP para Odontologia",
  type: "protocol",
  category: "soap",
  content: `# Diretrizes para Nota SOAP Odontológica

## Estrutura SOAP

### S — Subjetivo
O que o PACIENTE relata. Usar as palavras do paciente quando possível.

**Campos obrigatórios:**
- Queixa principal (motivo da consulta nas palavras do paciente)
- História da doença atual (quando começou, como evoluiu, fatores de melhora/piora)
- Histórico médico relevante (alergias, medicações, condições sistêmicas)
- Medicações em uso

**Regras:**
- NUNCA inventar queixas não mencionadas pelo paciente
- Se o paciente não mencionou histórico médico, deixar vazio — não assumir "nega alergias"
- Usar aspas para citações diretas do paciente quando relevante
- Distinguir entre queixa principal e queixas secundárias

### O — Objetivo
O que o DENTISTA observou/examinou. Dados clínicos objetivos.

**Campos obrigatórios:**
- Exame clínico geral (estado geral da saúde bucal)
- Achados específicos (por dente/região)
- Dentes afetados (numeração FDI)
- Classificações (cárie, fratura, mobilidade, etc.)

**Regras:**
- Extrair APENAS achados mencionados na transcrição
- Se o dentista não mencionou exame de um dente, não incluir
- Usar nomenclatura padrão (FDI para dentes, classificação de Black para cáries)
- Não inferir achados clínicos a partir de sintomas do paciente

### A — Avaliação
Diagnóstico ou hipótese diagnóstica do DENTISTA.

**Campos obrigatórios:**
- Diagnósticos (hipóteses diagnósticas baseadas em S + O)
- Red flags (sinais de alerta que requerem atenção imediata)

**Regras:**
- Diagnóstico deve ser consistente com achados em S e O
- Se o dentista não verbalizou diagnóstico, inferir com cautela e marcar como "hipótese"
- Red flags: apenas se há evidência na transcrição (dor intensa, mobilidade, sangramento)
- Não adicionar diagnósticos "por precaução" — apenas os suportados pela transcrição

### P — Plano
O que foi decidido/proposto como tratamento.

**Campos obrigatórios:**
- Tratamentos propostos (procedimento, dente, urgência, prazo)
- Orientações ao paciente
- Lembretes clínicos (follow-up, retorno, exames complementares)

**Regras:**
- Incluir APENAS tratamentos mencionados na transcrição
- Se o dentista disse "vamos acompanhar", incluir como plano
- Urgência: alta (dor/emergência), média (necessário mas não urgente), baixa (eletivo)
- Não inventar orientações genéricas — apenas as que foram ditas

## Classificação de Urgência

- **Alta:** Dor aguda, infecção, trauma, sangramento, abscesso
- **Média:** Cárie ativa, restauração necessária, tratamento planejado
- **Baixa:** Estético, preventivo, manutenção, check-up

## Regras Anti-Alucinação para SOAP

1. Se uma informação não está na transcrição, NÃO incluir no SOAP
2. Preferir campos vazios a campos inventados
3. Marcar inferências como "hipótese" ou "possível"
4. A queixa principal DEVE conter palavras que aparecem na transcrição
5. Dentes afetados DEVEM ter sido mencionados pelo dentista
6. Tratamentos propostos DEVEM ter sido discutidos na consulta
`,
};

// --------------------------------------------------------------------------
// Seed Function
// --------------------------------------------------------------------------

const ALL_DOCUMENTS: IngestDocumentInput[] = [
  DISC_METHODOLOGY,
  NEUROVENDAS_METHODOLOGY,
  RAPPORT_METHODOLOGY,
  OBJECTION_HANDLING,
  CLINICAL_SOAP,
];

export async function seedKnowledgeBase(): Promise<void> {
  log.info("Starting knowledge base seed", { documentCount: ALL_DOCUMENTS.length });

  const results = await ingestDocuments(ALL_DOCUMENTS);

  let totalChunks = 0;
  let failures = 0;

  for (const result of results) {
    if (result.success) {
      totalChunks += result.chunksCreated;
      log.info(`✓ ${result.documentId}: ${result.chunksCreated} chunks (v${result.version})`);
    } else {
      failures++;
      log.error(`✗ ${result.documentId}: ${result.error}`);
    }
  }

  log.info("Knowledge base seed complete", { totalChunks, failures });
}

// Allow running directly: npx tsx server/rag/seedKnowledge.ts
if (process.argv[1]?.includes("seedKnowledge")) {
  seedKnowledgeBase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
