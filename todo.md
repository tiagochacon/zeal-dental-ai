# ZEAL - Assistente de IA Odontológico - TODO

## Schema e Banco de Dados
- [x] Tabela de pacientes (patients)
- [x] Tabela de consultas (consultations)
- [x] Tabela de templates de consulta (consultationTemplates)
- [x] Tabela de feedbacks (feedbacks)

## Backend - Rotas tRPC
- [x] CRUD de pacientes
- [x] CRUD de consultas
- [x] Upload de áudio para S3
- [x] Transcrição de áudio com Whisper API
- [x] Geração de nota SOAP com GPT-4
- [x] Atualização de nota SOAP
- [x] Finalização de consulta
- [ ] Exportação de PDF
- [x] Sistema de feedback

## Front-end - Páginas
- [x] Dashboard principal com lista de consultas
- [x] Nova consulta (gravação/upload de áudio)
- [x] Revisão de transcrição
- [x] Visualização de nota SOAP
- [ ] Edição de nota SOAP
- [x] Modal de feedback obrigatório
- [x] Lista de pacientes
- [ ] Detalhes do paciente

## Front-end - Componentes
- [x] Header com navegação
- [x] Gravador de áudio com visualização de onda
- [x] Player de áudio com timestamps
- [ ] Visualizador de transcrição estilo chat
- [x] Visualizador de nota SOAP (seções S, O, A, P)
- [ ] Editor de nota SOAP
- [x] Card de sinais de alerta (red flags)
- [x] Badges de urgência (alta, média, baixa)
- [x] Modal de feedback com estrelas

## Design e Estilo
- [x] Tema escuro como padrão
- [x] Cores: verde-água (#14B8A6), vermelho para alertas
- [x] Logo ZEAL no header
- [x] Layout responsivo

## Fluxo Clínico Obrigatório
- [x] 1. Upload/Captura de áudio
- [x] 2. Processamento de áudio
- [x] 3. Tela de Revisão (Player + Transcrição editável)
- [x] 4. Confirmação manual do usuário
- [x] 5. Geração da Nota SOAP + Diagnóstico
- [x] 6. Finalização manual da consulta
- [x] 7. Feedback Obrigatório (1-5 estrelas + comentário)

## Testes
- [x] Testes unitários para autenticação
- [x] Testes unitários para rotas protegidas
- [x] Testes de validação da estrutura SOAP

## Bugs Corrigidos
- [x] Corrigir feedbacks.getByConsultation retornando undefined

## Atualizações Solicitadas (v2)
- [x] Mudar paleta de cores de verde/teal para Roxo/Azul Escuro
- [x] Implementar layout com sidebar lateral
- [x] Adicionar cards de estatísticas no dashboard (Total de Pacientes, Consultas Realizadas, Em Andamento, Avaliação Média)
- [x] Adicionar opção de entrada de texto além de áudio
- [x] Criar página de login
- [x] Manter perfil do usuário no rodapé da sidebar

## Melhorias Funcionais (v3)
- [x] Implementar exportação de PDF funcional para Nota SOAP
- [x] Criar componente de Odontograma visual junto às abas
- [x] Odontograma baseado apenas nos dados do áudio (não inventar)
- [x] Adicionar prazo/perspectiva de tempo ao plano de tratamento
- [x] Atualizar schema para incluir prazo nos tratamentos
- [x] Garantir responsividade total (Desktop e Mobile)
- [x] Sidebar responsiva com menu hambúrguer no mobile
- [x] Cards de estatísticas responsivos
- [x] Formulários responsivos na página de nova consulta

## Atualização da Página de Login (v4)
- [x] Redesign da página de login conforme referência visual
- [x] Logo ZEAL centralizada no topo
- [x] Card de login com fundo escuro arredondado
- [x] Campo de E-mail com placeholder
- [x] Campo de Senha com ícone de visualização (mostrar/ocultar)
- [x] Botão "Entrar" em roxo/purple
- [x] Link "Não tem conta? Cadastre-se"
- [x] Background com gradiente roxo/azul escuro

## Correção de Bug e Automação do Odontograma (v5)
- [x] Corrigir bug de perda de foco no input de texto (cadastro/edição de paciente)
- [x] Simplificar Odontograma para classificação geral por dente (sem faces)
- [x] Implementar preenchimento automático baseado na transcrição
- [x] Sistema de cores únicas para cada classificação
- [x] Legenda automática com todas as classificações
- [x] Classificações: Não Avaliado, Saudável, Cárie, Restaurado, Ausente, Fraturado, Canal, Coroa, Indicação de extração
- [x] Atualizar backend para extrair classificações da transcrição

## Correção de Bug de Deploy (v6)
- [x] Corrigir validação obrigatória de OWNER_OPEN_ID que causa falha no deploy
- [x] Tornar OWNER_OPEN_ID opcional com valor padrão

## Correção de Bug removeChild (v7)
- [x] Analisar manipulações diretas do DOM (document.*, removeChild, appendChild, innerHTML)
- [x] Identificar useEffect com cleanup inseguro
- [x] Verificar race conditions em efeitos assíncronos
- [x] Auditar modais, dialogs e componentes dinâmicos
- [x] Verificar keys estáveis em listas renderizadas com map()
- [x] Auditar uso de portals (ReactDOM.createPortal)
- [x] Implementar Error Boundary global melhorado
- [x] Adicionar guards contra atualizações em componentes desmontados (useIsMounted hook)
- [x] Corrigir cleanup functions inseguros (Map.tsx, dialog.tsx)

## Correção de Bugs (v8)
- [x] Corrigir erro TypeScript no pdfExport.ts (linhas 343, 345 - undefined não atribuífável a string)
- [x] Remover colunas birthDate e clinicName do schema (não existem no banco remoto)
- [x] Remover todas as referências a birthDate do código (Patients.tsx, db.ts, routers.ts)
- [x] Corrigir erro de OAuth callback - servidor agora rodando corretamente

## Integração Stripe - Sistema de Assinaturas (v9)
- [x] Step 1: Executar webdev_add_feature stripe para inicializar infraestrutura
- [x] Step 2: Adicionar campos stripe_customer_id, subscription_status, price_id ao schema users
- [x] Step 3: Criar protectedSubscriptionProcedure para verificar assinatura ativa
- [x] Step 4: Adicionar aba Subscription no sidebar com pricing toggle/modal
- [x] Step 5: Implementar webhooks para checkout.session.completed, subscription.updated, subscription.deleted
- [x] Step 6: Testar fluxo completo de assinatura (13 testes passando)

## Lógica de Negócio Stripe - Planos e Trial (v10)
- [x] Step 1: Criar produtos no Stripe (ZEAL Básico R$ 99,90/mês, ZEAL Pro R$ 199,90/mês) - IDs salvos em .env.local
- [x] Step 2: Adicionar campos trial_started_at, trialEndsAt e consultation_count ao schema users
- [x] Step 3: Criar helpers de billing (trial, subscription, consultation limits)
- [x] Step 4: Adicionar middleware consultationLimitProcedure para enforcement
- [x] Step 5: Criar página de Pricing com 3 planos (Trial, Básico, Pro)
- [x] Step 6: Implementar rota billing.startTrial para iniciar trial gratuito
- [x] Step 7: Criar 29 testes de billing - todos passando

## Automação Comercial SaaS (v11)
- [x] Step 1: Implementar PaywallGuard global no frontend - redireciona para /pricing se sem assinatura/trial
- [x] Step 2: Integrar incrementConsultationCount após finalização de SOAP
- [x] Step 3: Criar componente UsageIndicator com barra de progresso e botão Upgrade
- [x] Step 4: Otimizar página de pricing com gradientes e loading states
- [x] Step 5: Criar job de reset automático de consultation_count
- [x] Step 6: Criar 21 testes de automação comercial - todos passando

## Integração Payment Links Stripe (v12)
- [x] Step 1: Mapear links de pagamento Stripe nos botões de cada plano (Básico e Pro)
- [x] Step 2: Configurar redirecionamento pós-pagamento com refresh de status via useEffect
- [x] Step 3: Implementar botão de trial gratuito separado ("Ou inicie um trial grátis")
- [x] Step 4: Validar fluxo completo - página de pricing funcionando com 3 planos

## Autenticação Customizada Email/Senha (v13)
- [x] Step 1: Adicionar campo password_hash ao schema users e instalar bcrypt
- [x] Step 2: Criar rotas de auth.register e auth.emailLogin com validacao
- [x] Step 3: Criar arquivo auth.ts com hashPassword e authenticateUser
- [ ] Step 4: Criar paginas de Login e Registro com branding ZEAL
- [ ] Step 5: Implementar paywall no registro - redirecionar para /pricing
- [ ] Step 6: Criar seed script para contas admin com acesso ilimitado
- [ ] Step 7: Atualizar middleware para bypass de limites para admins
- [ ] Step 8: Atualizar UsageIndicator para mostrar Acesso Ilimitado para admins
- [ ] Step 9: Testar fluxo completo de registro, login e enforcement

## Bug Fix - Trial Access (v14)
- [x] Corrigir middleware protectedSubscriptionProcedure para verificar trialEndsAt por datas
- [x] Verificar se trialEndsAt esta sendo setado corretamente ao iniciar trial
- [x] Testar fluxo completo de trial com transcricao - CORRIGIDO

## Enforcement Estrito de Limites (v15)
- [x] Step 1: Refatorar middleware para verificar consultation_count antes de executar AI
- [x] Step 2: Criar suite de 22 testes automatizados - 100% passando
- [x] Step 3: Implementar UpgradeBanner com upsell contextual para cada plano
- [x] Step 4: Adicionar reset automático no webhook invoice.paid
- [x] Step 5: Criar LimitReachedModal com opções de upgrade
- [x] Step 6: Integrar modal no TranscriptionReview para tratamento de erro

## Refinamento UI Pricing (v16)
- [x] Remover informações de teste (cartão 4242...) da página
- [x] Padronizar botão do ZEAL Básico para estilo sólido azul com gradiente
- [x] Manter destaque "Mais Popular" no ZEAL Pro
- [x] Garantir consistência de padding, alinhamento e fontes nos 3 cards

## Ajuste UI Pricing (v17)
- [x] Remover botão "Ou inicie um trial grátis" do plano ZEAL Básico

## Autenticação Customizada UI (v18)
- [x] Criar página de Login customizada (/login) com branding ZEAL
- [x] Criar página de Registro customizada (/register) com branding ZEAL
- [x] Implementar auth guard global no App.tsx
- [x] Remover redirecionamentos para manus.im/app-auth
- [x] Polimento visual (transições, loading states, mensagens de erro)
- [x] Redirecionar registro para /pricing após sucesso
- [x] Criar testes de autenticação email/senha (12 testes passando)

## Reset do Sistema e Finalização Auth (v19)
- [x] Reset das tabelas users, sessions, subscriptions
- [x] Remover todas as referências ao OAuth Manus (env vars, callbacks, botões)
- [x] Criar 3 contas admin com acesso ilimitado
- [x] Validar fluxo: novos usuários devem registrar e pagar, admins podem logar diretamente

## Refinamento de Cores Auth (v20)
- [x] Auditar cores purple/violet nas páginas de Login e Registro
- [x] Substituir purple por Deep Blue/Navy (consistente com Dashboard)
- [x] Atualizar botões, focus rings, gradientes e links
- [x] Verificar consistência visual com sidebar/dashboard
- [x] Garantir logo ZEAL visível contra fundo deep blue

## Atualização de Privilégios (v21)
- [x] Identificar usuários: drcarlosrodriguezbr@gmail.com, leo_brasill@hotmail.com, fabionetto81@yahoo.com.br
- [x] Atualizar para role=admin, subscriptionStatus=active, priceId=unlimited
- [x] Verificar atualização no banco de dados

## Inteligência de Vendas Clínicas - Neurovendas (v22)
- [x] Analisar eBook de Neurovendas e extrair conceitos-chave
- [x] Criar procedimento de análise neuro no backend (routers.ts)
- [x] Implementar aba de Negociação na página de consulta
- [x] Adicionar Perfil Psicográfico do Paciente
- [x] Implementar Script de Fechamento (Modelo PARE)
- [x] Criar Mapeador de Objeções
- [x] Adicionar Gatilhos Mentais Recomendados
- [x] Implementar indicadores visuais (Temperature Gauge para rapport)
- [x] Testar integração com análise de consulta existente
- [x] Criar testes de Neurovendas (11 testes passando)

## Interface Adaptativa de Negociação por Perfil Neurológico (v23)
- [x] Fase 1: Atualizar backend para detectar perfil neurológico na geração SOAP
- [x] Fase 2: Criar componente RapportGauge (gauge circular animado)
- [x] Fase 2: Criar componente NegotiationBadge (chips para gatilhos mentais)
- [x] Fase 2: Criar componente ObjectionMapper (lista expansível de objeções)
- [x] Fase 2: Criar componente ScriptPARE (script PARE visual)
- [x] Fase 3: Criar AdaptiveNegotiationTab com UI por perfil (Reptiliano, Neocórtex, Límbico)
- [x] Fase 3: Implementar ReptilianNegotiationView (foco em segurança, verde)
- [x] Fase 3: Implementar NeocortexNegotiationView (foco em dados, azul)
- [x] Fase 3: Implementar LimbicNegotiationView (foco em transformação, roxo)
- [x] Fase 4: Integrar na página ConsultationDetail
- [x] Fase 5: Testar e validar funcionalidade (17 testes passando)

## Restauração Visual Login (v24)
- [x] Restaurar tela de login para visual anterior com tema Deep Blue

## Correção de Bugs - Aba Negociação (v25)
- [x] Corrigir persistência do Rapport no backend (não recalcular após primeira geração)
- [x] Implementar auto-geração da análise ao entrar na aba Negociação
- [x] Exibir Skeleton durante loading da análise
- [x] Renderizar todos os 3 blocos simultaneamente (Rapport + Objeções + Script)
- [x] Garantir que estado persiste ao trocar de aba e voltar
- [x] Criar testes de auto-load e persistência (11 testes passando)
