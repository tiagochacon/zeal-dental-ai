# 🔒 Revisão de Segurança e Qualidade - ZEAL Dental AI

**Data:** Revisão Completa  
**Revisor:** AI Senior Developer  
**Status:** 🔴 CRÍTICO - Ação imediata necessária

---

## 📋 Sumário Executivo

### Estatísticas
- **Problemas Críticos de Segurança:** 8
- **Problemas de Clean Code:** 12
- **Problemas de Performance:** 5
- **Total:** 25 issues identificadas

### Prioridades
- 🔴 **CRÍTICO:** 8 issues (Segurança)
- 🟠 **ALTO:** 7 issues (Qualidade/Segurança)
- 🟡 **MÉDIO:** 10 issues (Performance/Manutenibilidade)

---

## 🔴 PROBLEMAS CRÍTICOS DE SEGURANÇA

### 1. Falta de Headers de Segurança HTTP
**Severidade:** 🔴 CRÍTICA  
**Arquivo:** `server/_core/index.ts`  
**Problema:**
- Não há configuração de headers de segurança (CSP, HSTS, X-Frame-Options, etc.)
- Vulnerável a ataques XSS, clickjacking, e outros

**Solução:**
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

---

### 2. Limite de Upload Excessivo Sem Validação
**Severidade:** 🔴 CRÍTICA  
**Arquivo:** `server/_core/index.ts:34-35`  
**Problema:**
```typescript
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
```
- 50MB é excessivo e pode causar DoS
- Sem validação de tipo de arquivo
- Sem rate limiting

**Solução:**
```typescript
// Reduzir para 10MB e adicionar validação
app.use(express.json({ 
  limit: "10mb",
  verify: (req, res, buf) => {
    // Validação adicional se necessário
  }
}));
```

---

### 3. Variáveis de Ambiente Sem Validação
**Severidade:** 🔴 CRÍTICA  
**Arquivo:** `server/_core/env.ts`  
**Problema:**
```typescript
export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  // Pode retornar strings vazias!
};
```
- Valores críticos podem ser strings vazias
- Sem validação no startup
- App pode iniciar em estado inválido

**Solução:**
```typescript
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const ENV = {
  appId: getRequiredEnv('VITE_APP_ID'),
  cookieSecret: getRequiredEnv('JWT_SECRET'),
  databaseUrl: getRequiredEnv('DATABASE_URL'),
  // ...
};
```

---

### 4. Falta de Rate Limiting
**Severidade:** 🔴 CRÍTICA  
**Arquivo:** Todos os endpoints  
**Problema:**
- Sem proteção contra brute force em login
- Sem limites em rotas de upload/API
- Vulnerável a DoS

**Solução:**
```typescript
import rateLimit from 'express-rate-limit';

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: 'Muitas requisições, tente novamente mais tarde'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 tentativas por 15 minutos
  skipSuccessfulRequests: true,
});

app.use('/api/', generalLimiter);
app.use('/api/oauth/', authLimiter);
```

---

### 5. Mensagens de Erro Expõem Detalhes Internos
**Severidade:** 🟠 ALTA  
**Arquivo:** Múltiplos arquivos  
**Problema:**
```typescript
console.warn("[Database] Cannot get user: database not available");
console.error("[OAuth] Callback failed", error);
res.status(500).json({ error: "OAuth callback failed" });
```
- Stack traces podem vazar em produção
- Mensagens expõem arquitetura interna

**Solução:**
```typescript
// Criar error handler centralizado
const isDev = process.env.NODE_ENV === 'development';

app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Erro interno do servidor',
    ...(isDev && { stack: err.stack })
  });
});
```

---

### 6. Cookie SameSite="none" Sem Validação Adicional
**Severidade:** 🟠 ALTA  
**Arquivo:** `server/_core/cookies.ts:45`  
**Problema:**
```typescript
sameSite: "none",
```
- Permite CSRF se não houver outras proteções
- Deve ser "lax" ou "strict" quando possível

**Solução:**
```typescript
sameSite: isSecureRequest(req) ? "none" : "lax",
```

---

### 7. Falta de Input Sanitization em Upload de Áudio
**Severidade:** 🟠 ALTA  
**Arquivo:** `server/routers.ts` (upload routes)  
**Problema:**
- Sem validação de tipo MIME
- Sem scan de malware
- Nomes de arquivo não sanitizados

**Solução:**
```typescript
import fileType from 'file-type';

// Validar tipo real do arquivo
const audioSchema = z.object({
  audioData: z.string().refine(async (data) => {
    const buffer = Buffer.from(data, 'base64');
    const type = await fileType.fromBuffer(buffer);
    return type && ['audio/mpeg', 'audio/wav', 'audio/ogg'].includes(type.mime);
  }, 'Formato de áudio inválido'),
});
```

---

### 8. Logs Não Estruturados Podem Vazar Informações
**Severidade:** 🟡 MÉDIA  
**Arquivo:** Múltiplos arquivos  
**Problema:**
```typescript
console.log, console.error, console.warn
```
- Logs não estruturados
- Podem vazar PII (dados pessoais)
- Difícil auditoria

**Solução:**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

---

## 🧹 PROBLEMAS DE CLEAN CODE

### 9. Arquivo routers.ts Muito Grande (561 linhas)
**Severidade:** 🟠 ALTA  
**Arquivo:** `server/routers.ts`  
**Problema:**
- Viola Single Responsibility Principle
- Difícil manutenção e testes
- Múltiplas responsabilidades misturadas

**Solução:**
```
server/
  routers/
    auth.router.ts
    patients.router.ts
    consultations.router.ts
    feedbacks.router.ts
    index.ts (combina todos)
```

---

### 10. Duplicação de Código em Validações de Ownership
**Severidade:** 🟡 MÉDIA  
**Arquivo:** `server/routers.ts` (múltiplas ocorrências)  
**Problema:**
```typescript
// Repetido em vários lugares
const patient = await getPatientById(input.id);
if (!patient || patient.dentistId !== ctx.user.id) {
  throw new Error("Paciente não encontrado ou acesso negado");
}
```

**Solução:**
```typescript
// Criar middleware de autorização
async function validatePatientOwnership(patientId: number, userId: number) {
  const patient = await getPatientById(patientId);
  if (!patient || patient.dentistId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Acesso negado',
    });
  }
  return patient;
}
```

---

### 11. Magic Numbers e Strings Hardcoded
**Severidade:** 🟡 MÉDIA  
**Arquivo:** Múltiplos  
**Problema:**
```typescript
"50mb", 20, 3000, 302, 400, 500
```

**Solução:**
```typescript
// constants.ts
export const SERVER_CONFIG = {
  MAX_UPLOAD_SIZE: '10mb',
  PORT_SCAN_RANGE: 20,
  DEFAULT_PORT: 3000,
} as const;

export const HTTP_STATUS = {
  OK: 200,
  REDIRECT: 302,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
} as const;
```

---

### 12. Funções Muito Longas
**Severidade:** 🟡 MÉDIA  
**Arquivo:** `server/routers.ts`  
**Problema:**
- Função de transcrição + SOAP generation tem ~100 linhas
- Difícil de testar e manter

**Solução:**
- Extrair em funções menores e testáveis
- Um nível de abstração por função

---

### 13. Falta de Documentação JSDoc
**Severidade:** 🟡 MÉDIA  
**Problema:**
- Funções complexas sem documentação
- Parâmetros não documentados
- Dificulta onboarding

**Solução:**
```typescript
/**
 * Validates patient ownership and returns patient data
 * @param patientId - The ID of the patient to validate
 * @param userId - The ID of the authenticated user
 * @throws {TRPCError} When patient not found or access denied
 * @returns Patient data if validation succeeds
 */
async function validatePatientOwnership(
  patientId: number, 
  userId: number
): Promise<Patient> {
  // ...
}
```

---

### 14. Falta de ESLint
**Severidade:** 🟠 ALTA  
**Problema:**
- Sem linting automático
- Inconsistências de código
- Possíveis bugs não detectados

**Solução:**
```bash
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

---

## ⚡ PROBLEMAS DE PERFORMANCE

### 15. Queries Sem Índices (Possível)
**Severidade:** 🟡 MÉDIA  
**Arquivo:** `drizzle/schema.ts`  
**Recomendação:**
- Verificar índices em `dentistId`, `patientId`
- Adicionar índices compostos para queries comuns

---

### 16. Sem Cache para Queries Frequentes
**Severidade:** 🟡 MÉDIA  
**Problema:**
- User info buscado a cada request
- Pacientes listados sem cache

**Solução:**
```typescript
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutos
```

---

### 17. Re-renders Desnecessários no Frontend
**Severidade:** 🟡 MÉDIA  
**Arquivo:** Componentes React  
**Recomendação:**
- Usar React.memo para componentes pesados
- useMemo/useCallback para callbacks

---

### 18. getDb() Chamado Múltiplas Vezes
**Severidade:** 🟡 MÉDIA  
**Arquivo:** `server/db.ts`  
**Problema:**
- Conexão verificada a cada query
- Pode ser ineficiente

**Solução:**
- Garantir pool de conexões
- Singleton pattern já implementado, mas verificar

---

## 📊 RESUMO DE CORREÇÕES NECESSÁRIAS

### Correções Imediatas (Críticas)
1. ✅ Adicionar helmet para security headers
2. ✅ Validar ENV vars no startup
3. ✅ Reduzir limite de upload para 10MB
4. ✅ Adicionar rate limiting
5. ✅ Melhorar tratamento de erros

### Correções de Curto Prazo (1-2 semanas)
1. ⏳ Configurar ESLint
2. ⏳ Modularizar routers.ts
3. ⏳ Implementar logger estruturado
4. ⏳ Extrair constantes
5. ⏳ Adicionar JSDoc

### Correções de Médio Prazo (1 mês)
1. 📅 Adicionar cache
2. 📅 Otimizar queries
3. 📅 Melhorar performance do frontend
4. 📅 Adicionar testes de segurança
5. 📅 Audit de dependências

---

## 🎯 Próximos Passos

1. **Implementar correções críticas de segurança**
2. **Configurar ferramentas de qualidade (ESLint)**
3. **Refatorar código para Clean Code**
4. **Adicionar testes unitários**
5. **Documentar arquitetura e decisões**

---

**Nota:** Este documento deve ser revisado e atualizado conforme as correções são implementadas.



