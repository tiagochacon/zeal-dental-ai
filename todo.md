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

## Refinamento Algoritmo Rapport com Neurociência (v26)
- [x] Atualizar schema/interface de Rapport com breakdown dos 5 critérios
- [x] Atualizar prompt da IA para calcular Rapport com pesos definidos
- [x] Adicionar ajuste por perfil neurológico (Reptiliano/Límbico/Neocórtex)
- [x] Adicionar tooltip com breakdown ao hover na porcentagem
- [x] Adicionar insight card com justificativa e melhoria
- [x] Testar com cenários de validação (19 testes passando)

## Gates de Funcionalidade por Plano de Assinatura (v27)
- [x] Verificar/atualizar schema com campos subscriptionTier e limites
- [x] Implementar verificação de trial expirado (7 dias ou 7 consultas)
- [x] Implementar contagem de consultas mensais por plano
- [x] Bloquear aba Negociação no backend para plano basic
- [x] Criar UpgradeModal no frontend para plano basic
- [x] Desabilitar aba Negociação visualmente para plano basic (com badge PRO)
- [x] Manter acesso a consultas antigas com Negociação após downgrade
- [x] Implementar admin override (ignorar restrições)
- [x] Testar cenários de validação (29 testes passando)

## Bug Fix - Trial Expirado Bloqueando Usuário (v28)
- [ ] Analisar lógica de verificação de trial no middleware
- [ ] Corrigir comparação de datas de trial
- [ ] Testar com usuário toscc@cin.ufpe.br

## Tela de Upgrade Intuitiva (v29)
- [x] Atualizar LimitReachedModal com lógica de planos dinâmica
- [x] Trial expirado: mostrar planos Básico e Pro
- [x] Básico no limite: mostrar apenas plano Pro
- [x] Criar UI interativa com cards de planos e benefícios
- [x] Adicionar CTAs claros para cada plano
- [x] Testar cenários de upgrade (194 testes passando)

## Enforcement Estrito de Limites e Upsell (v30)
- [x] Refatorar middleware para verificar limites ANTES de executar lógica de IA/DB
- [x] Retornar TRPC_ERROR FORBIDDEN quando limite atingido
- [x] Criar testes automatizados: trial bloqueado na 8ª, basic na 21ª, pro na 51ª (26 testes passando)
- [x] Testar que admins nunca são bloqueados (por role e por email)
- [x] Implementar UpgradeBanner dinâmico (trial->basic/pro, basic->pro)
- [x] Verificar lógica de reset mensal alinhada com ciclo Stripe (webhook invoice.paid)
- [x] Tratar erro FORBIDDEN no frontend com modal de upgrade

## Reimplementação de Modais de Upsell (v31)
- [x] Step 1: Analisar LimitReachedModal existente e criar UpgradeModal persuasivo
- [x] Step 2: Implementar detecção de limites com hook useUsageLimit
- [x] Step 3: Integrar modal em NewConsultation, TranscriptionReview e ConsultationDetail
- [x] Step 4: Criar copywriting persuasivo com frases de impacto
- [x] Step 5: Adicionar código de erro LIMIT_EXCEEDED no backend
- [x] Step 6: Testar fluxos de trigger (trial, basic, feature_gate)
- [x] Step 7: Criar testes automatizados para modais de upsell (27 testes passando)

## Automação de Liberação de Acesso via Stripe Webhooks (v33)
- [x] Verificar implementação atual do webhook do Stripe
- [x] Configurar chaves de produção do Stripe (via Settings > Payment)
- [x] Garantir tratamento de checkout.session.completed para ativar planos (Basic/Pro)
- [x] Implementar customer.subscription.deleted para revogar acesso (rebaixa para trial)
- [x] Implementar invoice.payment_failed para marcar como past_due
- [x] Validar segurança com STRIPE_WEBHOOK_SECRET
- [x] Criar testes automatizados (30 testes passando)
- [ ] Usuário deve configurar webhook no painel do Stripe

## Reconstrução Robusta da Integração Stripe (v34)
- [x] Auditar schema do banco (stripe_customer_id, plan_type, subscription_status)
- [x] Criar tabela payment_logs para auditoria de webhooks
- [x] Configurar mapeamento de Price IDs (Basic: price_1SuYhvJBQOFbtGZhL4AVyGqb, Pro: price_1SuYhvJBQOFbtGZhu5hcAhqH)
- [x] Configurar mapeamento de Product IDs (Basic: prod_TsJKWnhkerrtD3, Pro: prod_TsJKKhldI5j5h6)
- [x] Reconstruir webhook handler com lógica robusta e idempotente
- [x] Implementar feature gating: Basic sem Neurovendas, Pro com acesso completo
- [x] Criar testes end-to-end do fluxo de pagamento (281 testes passando)
- [x] Validar fluxo completo: webhook → DB → UI

## Gerenciamento de Assinatura e Correções (v35)
- [x] Corrigir tamanho do modal de upgrade para caber na tela (max-h-[90vh] com scroll)
- [x] Criar página de gerenciamento de assinatura (ver status, cancelar, upgrade)
- [x] Implementar pop-up de upgrade para usuários Basic/Trial em funcionalidades Pro (Negociação)
- [x] Página de assinatura já acessível via sidebar

## Correção de Bugs - Menu e Pop-up (v36)
- [x] Adicionar link "Assinatura" no menu lateral do dashboard
- [x] Corrigir pop-up de upgrade nas funções Pro (não está aparecendo)
- [x] Testar fluxo completo após correções

## Otimização UI/UX de Conversão (v37)
- [x] Substituir aba 'Assinatura' por botão CTA atrativo na sidebar (gradient Deep Blue to Cyan, ícone Crown)
- [x] Otimizar modal de upgrade: max-width 500px, grid 2 colunas, animação suave
- [x] Reescrever copywriting dos benefícios por plano (Trial, Basic, Pro)
- [x] Manter lógica de restrição: Basic não acessa Negociação
- [x] Garantir responsividade e estética dark mode

## Refinamentos de UX e Integridade do Sistema (v38)
- [x] Adicionar atribuição "Metodologia: Dr. Carlos Rodriguez" na aba Negociação (texto discreto, canto inferior direito)
- [x] Padronizar sidebar globalmente - garantir que "Consultas" apareça em todas as páginas (incluindo Meu Perfil)
- [x] Corrigir edição de perfil para permitir múltiplas edições (não apenas uma vez)
- [x] Testar fluxo completo após correções

## Reposicionamento Atribuição de Metodologia (v39)
- [x] Mover atribuição "Metodologia: Dr. Carlos Rodriguez" do rodapé para o topo da aba Negociação
- [x] Aumentar tamanho da fonte (text-xs para text-sm ou text-base)
- [x] Aplicar font-weight medium/semi-bold para leitura clara
- [x] Usar cor de destaque suave (azul claro da paleta ZEAL)
- [x] Garantir balanceamento visual sem empurrar outros elementos
- [x] Testar e validar mudanças

## Sincronização Global da Sidebar (v40)
- [x] Analisar componentes de sidebar e identificar inconsistências entre páginas
- [x] Unificar sidebar com botão de upgrade em todas as páginas (Dashboard, Pacientes, Consultas, Perfil)
- [x] Garantir que o botão de upgrade mantenha mesmo estilo e posição em todas as telas
- [x] Testar navegação completa e validar consistência visual

## Copywriting Estratégico - Conversão (v41)
- [x] Atualizar headline: "Sua Clínica no Próximo Nível com Inteligência Artificial"
- [x] Atualizar subheadline com foco em tempo e faturamento
- [x] Reescrever features com gatilhos psicológicos (Autoridade, Ganho de Tempo, Aumento de Lucro)
- [x] Adicionar nova feature de Neurovendas
- [x] Atualizar CTA: "Começar minha Revolução Clínica"
- [x] Manter design system atual (cores, fontes, layout)
- [x] Testar e validar mudanças

## Simplificação Copywriting Minimalista (v42)
- [x] Remover item do odontograma da lista de benefícios
- [x] Substituir "Nota SOAP" por "Documentação clínica" ou "Diagnósticos e Tratamentos"
- [x] Reduzir para 3 tópicos principais (Transcrição, Documentação, Neurovendas)
- [x] Ajustar espaçamento vertical (gap) para manter equilíbrio visual
- [x] Aplicar mesmas mudanças na página de Register
- [x] Testar e validar mudanças

## Ajustes de Copywriting (v43)
- [x] Trocar "O ZEAL" por "A ZEAL" em todas as ocorrências
- [x] Colocar "com Inteligência Artificial" na mesma linha do headline
- [x] Aplicar mudanças nas páginas de Login e Register

## Otimização PDF Plano de Tratamento (v44)
- [x] Analisar lógica atual de geração do PDF
- [x] Aumentar espaçamento entre linhas (line-height 1.5-1.6)
- [x] Melhorar hierarquia tipográfica (Bold para títulos, Regular para corpo)
- [x] Garantir margens equilibradas (mínimo 22mm)
- [x] Adicionar espaçamento entre itens de tratamento e recomendações
- [x] Organizar: Dados Paciente > Histórico > Plano Detalhado > Recomendações > Assinatura
- [x] Alinhar cabeçalho com logo ZEAL e informações da clínica
- [x] Testar e validar PDF gerado

## Correção Layout PDF (v45)
- [x] Corrigir overflow de texto na caixa de Alertas (ajustar altura dinâmica)
- [x] Remover círculos numerados redundantes da Sequência de Tratamento
- [x] Usar hierarquia de texto limpa (Fase X: Título em negrito)
- [x] Garantir espaçamento uniforme entre as fases
- [x] Testar e validar PDF corrigido

## Ajustes Finais PDF (v46)
- [x] Remover duplicação "Fase X: Fase X:" - exibir apenas "Fase X:" seguido do título sem repetir
- [x] Aumentar espaçamento entre texto e linha divisória entre fases
- [x] Testar e validar PDF corrigido

## UI Adaptativa por Plano (v47)
- [ ] Implementar badge de status (ADMIN gold, PRO gradient azul, BASIC slate, TRIAL verde) próximo à logo
- [ ] Ajustar lógica do botão de upgrade: ocultar para Admin/Pro, mostrar para Basic/Trial
- [ ] Basic: botão "Upgrade para PRO" | Trial: botão "Assinar Plano PRO"
- [ ] Garantir integração com AuthContext e subscriptionTier do usuário
- [ ] Aplicar estilos Tailwind com cantos arredondados e harmonia dark mode
- [ ] Testar e validar para todos os níveis de usuário

## UI Adaptativa por Plano (v47) - CONCLUÍDO
- [x] Adicionar badge de status do plano na sidebar próximo à logo (ADMIN, PRO, BASIC, TRIAL)
- [x] Admin: badge âmbar, sem botão de upgrade, badge "Acesso Admin" no lugar do CTA
- [x] Pro: badge gradiente azul/cyan, badge "Plano PRO Ativo" no lugar do CTA
- [x] Basic: badge cinza, botão "Upgrade para PRO" com texto "Desbloqueie Neurovendas"
- [x] Trial: badge verde, botão "Assinar Plano PRO" com texto "Desbloqueie todo o potencial"
- [x] Aplicar mudanças em todas as páginas (Dashboard, Patients, Consultations, Profile)
- [x] Testar e validar lógica condicional

## Ajuste Visual Badge do Plano (v48)
- [x] Diminuir tamanho do badge do plano (text-[10px] menor)
- [x] Alinhar badge com a logo (mt-0.5 para descer um pouco)
- [x] Aplicar mudanças em todas as páginas (Dashboard, Patients, Consultations, Profile)

## Correção Bug PRO identificado como TRIAL (v49)
- [x] Auditar schema do banco - verificar campos plan, subscriptionStatus, subscriptionTier
- [x] Verificar lógica do webhook Stripe - garantir que checkout.session.completed atualize plan corretamente
- [x] Corrigir lógica de determinação de plano no frontend - priorizar assinatura ativa sobre trial
- [x] Garantir que usuário PRO veja badge PRO (não TRIAL) e não veja botão de upgrade
- [x] Testar e validar correções

## Correção Integração Stripe - Plano Correto (v50)
- [x] Analisar produtos/preços configurados no Stripe (Basic vs PRO price_ids)
- [x] Corrigir webhook para identificar plano correto baseado no price_id
- [x] Atualizar subscriptionTier para 'basic' ou 'pro' conforme o plano comprado
- [x] Implementar lógica de cancelamento que esgota trial (consultationCount = 7)
- [x] Garantir que usuário com trial esgotado precise assinar para usar novamente
- [x] Testar fluxo completo: compra Basic, compra PRO, cancelamento

## Integração Enterprise Stripe (v51)
- [x] Configurar 3 contas Admin (zealtecnologia@gmail.com, tiagosennachacon@gmail.com, victorodriguez2611@gmail.com)
- [x] Verificar Product IDs do Stripe (Basic: prod_TsJKWnhkerrtD3, PRO: prod_TsJKKhldI5j5h6)
- [x] Refatorar webhook para identificar plano por Product ID (não pelo valor pago)
- [x] Implementar lógica de cancelamento que esgota trial (consultationCount = 7)
- [x] Implementar middleware de controle de acesso (Basic não acessa Negociação)
- [x] Garantir que consultas do Trial não sejam descontadas do plano pago
- [x] Testar cenários: PRO com cupom 100%, cancelamento, login Admin

## Correção Crítica Stripe PRO→Basic (v52)
- [x] Analisar logs e identificar onde a identificação de plano está falhando
- [x] Corrigir webhook para expandir line_items com Stripe API e obter Product ID
- [x] Implementar reset de consultationCount = 0 ao iniciar novo plano
- [x] Garantir que PRO seja identificado corretamente pelo Product ID prod_TsJKKhldI5j5h6
- [x] Testar fluxo completo de compra PRO

## Correções de UX v53
- [ ] Corrigir botão "Voltar para Login" que não está funcionando
- [ ] Corrigir redirecionamento após iniciar Trial (deve ir para dashboard, não ficar no pricing)
- [ ] Ajustar cores dos nomes dos planos nos cards (texto "ZEAL" cortado/escuro)
- [ ] Criar contador de consultas ao clicar no badge do plano (X/Y consultas usadas)

## Correções de UX v54
- [x] Corrigir botão Voltar para Login na página de Pricing (usar Link do wouter)
- [x] Corrigir redirecionamento após iniciar Trial (usar window.location.href para forçar navegação)
- [x] Ajustar cores dos nomes dos planos nos cards do UpgradeModal (ZEAL PRO, ZEAL Básico)
- [x] Criar componente UsageCounterModal para mostrar contador de consultas
- [x] Tornar badge do plano clicável no Dashboard para abrir contador
- [x] Tornar badge do plano clicável no Patients para abrir contador
- [x] Tornar badge do plano clicável no Consultations para abrir contador

## Correção do Contador de Consultas v55
- [x] Analisar billing.getPlanInfo para verificar cálculo de consultationsUsed e consultationsLimit
- [x] Corrigir lógica de contagem baseada no plano do usuário (adicionado consultationsUsed, consultationsLimit, trialDaysRemaining)
- [x] Garantir que consultation_count incrementa ao finalizar consulta (já implementado em generateSOAP)
- [x] Testar contador com diferentes planos (trial, basic, pro, admin)

## Ajustes Críticos no Sistema de Planos v56
- [x] REQ1: Permitir acesso à aba Negociação para usuários Trial (backend + frontend)
- [x] REQ2: Corrigir alinhamento do botão de upgrade (Crown icon + texto)
- [x] REQ3: Melhorar modal de detalhes de uso - PRO não deve ter botão de upgrade
- [x] Testar todos os cenários de planos (trial, basic, pro, admin)

## Correção Respostas Sugeridas Neurovendas v57
- [x] Analisar prompt de análise de Neurovendas no backend (routers.ts)
- [x] Corrigir prompt para gerar respostas sugeridas completas e personalizadas (não apenas "LAER")
- [x] Testar com consulta real para validar as respostas

## Atualização Informações de Planos v58
- [x] Analisar configuração real dos planos no backend (products.ts, billing.ts)
- [x] Mapear todas as telas que exibem info de planos (6 telas + 4 sidebars)
- [x] Atualizar Pricing.tsx com permissões reais (features com ✓ e ✗)
- [x] Atualizar UpgradeModal.tsx com permissões reais
- [x] Atualizar UsageCounterModal.tsx com permissões reais
- [x] Atualizar LimitReachedModal.tsx com permissões reais
- [x] Atualizar Subscription.tsx (PLAN_DETAILS + inline lists)
- [x] Atualizar sidebars (Dashboard, Patients, Consultations, Profile)

## Alterações v59
- [x] Renomear "Gerar Nota SOAP" para "Gerar Notas Clínicas" em todos os botões e textos do sistema (9 arquivos atualizados)
- [x] Corrigir bug do perfil que salva automaticamente sem dar tempo de editar (useRef para proteger modo de edição)

## Bug Perfil Auto-Save v60
- [x] Investigar causa raiz: refetchOnWindowFocus padrão do React Query causava re-fetch do getProfile
- [x] Corrigir: desabilitar refetchOnWindowFocus/refetchOnReconnect na query getProfile
- [x] Corrigir: useRef editingRef como guard no useEffect para impedir reset durante edição
- [x] Testado: modo de edição persiste por 10+ segundos sem sair automaticamente

## Perfil Completo v61
- [x] BUG: Corrigir definitivamente edição de perfil (useReducer + refetchOnWindowFocus:false no pai)
- [x] Adicionar campo telefone ao schema e perfil (com máscara (XX) XXXXX-XXXX)
- [x] Adicionar campo especialidade ao schema e perfil
- [x] Adicionar campo endereço do consultório ao schema e perfil (textarea)
- [x] Implementar máscara de CRO (CRO-UF Número)
- [x] Atualizar backend (schema, db.ts, routers.ts) + migração aplicada
- [x] Testado: modo de edição persiste 15+ segundos, 310 testes passando

## Simplificação do Perfil v62
- [x] Remover campos telefone, especialidade e endereço do DentistProfile.tsx
- [x] Manter apenas Nome Completo e CRO/Número de Registro
- [x] FormData simplificado para { name, croNumber } apenas

## Remover Máscara CRO v63
- [x] Remover formatCRO e preenchimento automático do campo CRO no perfil

## Sistema Multi-Role Clínica v64

### Fase 1 - Schema DB
- [x] Criar tabela clinics (id, name, ownerId, timestamps)
- [x] Alterar tabela users (+clinicId, +clinicRole enum gestor/crc/dentista)
- [x] Criar tabela leads (14 colunas incluindo neurovendasAnalysis e callProfile)
- [x] Criar tabela calls (17 colunas incluindo neurovendasAnalysis e schedulingResult)
- [x] Alterar tabela patients (+clinicId, +createdByUserId, +originLeadId)
- [x] Alterar tabela consultations (+treatmentClosed, +treatmentClosedNotes)
- [x] Alterar tabela feedbacks (+treatmentClosed, +treatmentClosedNotes)
- [x] Executar pnpm db:push (migração 0014 aplicada)

### Fase 2 - Backend
- [x] Criar funções DB: createClinic, getClinicById, getClinicByOwnerId, getClinicMembers, addClinicMember, updateClinicMember, removeClinicMember
- [x] Criar funções DB: createLead, getLeadsByClinic, getLeadById, updateLead, deleteLead, convertLeadToPatient
- [x] Criar funções DB: createCall, getCallsByClinic, getCallById, updateCall, finalizeCall
- [x] Criar funções DB: getClinicStats (funil de conversão)
- [x] Criar router tRPC: clinic (createClinic, getMyClinic, updateClinic, getMembers, addMember, updateMember, removeMember, getStats)
- [x] Criar router tRPC: leads (create, list, getById, update, delete, convertToPatient)
- [x] Criar router tRPC: calls (create, list, getById, uploadAudio, transcribe, analyzeNeurovendas, finalize)
- [x] Atualizar feedbacks.create para incluir treatmentClosed e treatmentClosedNotes

### Fase 3-4 - Login/Registro + Roteamento + RoleGuard
- [ ] Ajustar registro para incluir criação de clínica (Gestor cria clínica no registro)
- [x] Criar componente RoleGuard.tsx
- [x] Atualizar App.tsx com novas rotas (lazy loading para novas páginas)
- [ ] Adaptar DashboardLayout para selecionar sidebar por clinicRole

### Fase 5 - Telas CRC
- [x] Criar DashboardCRC.tsx (KPI cards + ligações recentes)
- [x] Criar Leads.tsx (CRUD de leads com busca)
- [x] Criar LeadDetail.tsx (info + perfil negociação + ligações + converter com seleção de dentista)
- [ ] Criar Calls.tsx (lista de ligações) - integrado no DashboardCRC
- [x] Criar NewCall.tsx (gravação de áudio + seleção de lead)
- [x] Criar CallDetail.tsx (transcrição + análise Neurovendas + finalizar)
- [ ] Criar CRCProfile.tsx (apenas campo Nome)

### Fase 6 - Modificações Dentista
- [x] Adicionar dica contextual de lead em NewConsultation.tsx
- [x] Adicionar treatmentClosed e treatmentClosedNotes no modal de feedback em ConsultationDetail.tsx
- [ ] Adicionar badge de fechamento em Consultations.tsx
- [ ] Adicionar indicador de fechamento em ConsultationDetail.tsx

### Fase 7 - Telas Gestor
- [x] Criar DashboardGestor.tsx (funil visual + KPI cards + rankings)
- [x] Criar TeamManagement.tsx (CRUD de membros com add/remove/trocar papel)
- [ ] Criar ProfileGestor.tsx (dados pessoais + dados da clínica)

### Fase 8-9 - Neurovendas para Calls + Consistência
- [x] Adaptar prompt de Neurovendas para contexto de ligação comercial CRC (LAER, PARE, rapport)
- [x] Adicionar probabilidadeAgendamento ao perfilPsicografico
- [ ] Verificar consistência visual (badges, cores, dark mode)
- [ ] Testes vitest para novos routers

## Integração Sidebar Multi-Role v65
- [x] Configurar usuários admin como gestor com clínica no banco
- [x] Adaptar DashboardLayout sidebar para mostrar menus por papel (Gestor/CRC/Dentista)
- [x] Garantir navegação funcional para todas as novas rotas
- [x] Remover sidebars internas de Dashboard.tsx, Patients.tsx, Consultations.tsx, Profile.tsx
- [x] Remover DashboardLayout wrapper duplicado de Subscription.tsx
- [x] Centralizar toda navegação no DashboardLayout.tsx
- [x] Adicionar Assinatura ao menu de todos os papéis
- [x] Traduzir "Sign out" para "Sair" no DashboardLayout
- [x] Testar fluxo completo de Gestor, CRC e Dentista

## Auditoria UX/UI Completa v66
### Fase 0 - Diagnóstico
- [x] Ler e mapear problemas em todos os arquivos frontend

### Fase 1 - Unificação do Layout
- [x] Verificar se DashboardLayout é o wrapper de todas as páginas autenticadas
- [x] Remover sidebars inline duplicadas remanescentes
- [x] Remover verificações de auth duplicadas (DashboardLayout já faz)
- [x] Alinhar menuItems com rotas reais

### Fase 2 - Polish Visual
- [x] Padronizar cabeçalhos de página (título + descrição)
- [x] Padronizar KPI cards no Dashboard
- [x] Padronizar cards de lista (Consultas, Pacientes)
- [x] Padronizar empty states (ícone + título + descrição + CTA)
- [x] Padronizar search bars
- [x] Centralizar badges de status via consultationStatusConfig

### Fase 3 - Fluxo Nova Consulta
- [x] Melhorar NewConsultation.tsx (wizard/stepper visual com 2 etapas + mini-card paciente)
- [x] Melhorar ConsultationDetail.tsx (header, tabs, modal feedback)

### Fase 4 - Feedback e Fechamento
- [x] Adicionar campo treatmentClosed ao modal de feedback
- [x] Mostrar badge de fechamento na lista de Consultas
- [x] Mostrar banner de fechamento no header de ConsultationDetail

### Fase 5 - Tela de Pacientes
- [x] Grid responsivo com cards profissionais
- [x] Modal com Accordion para campos clínicos
- [x] Sheet lateral com dados completos + consultas do paciente

### Fase 6 - Login e Register
- [x] Garantir cores usando variáveis CSS (sem hardcode)
- [x] Link "Esqueci minha senha" (toast "Em breve")
- [x] Responsividade mobile (ocultar lado marketing)

### Fase 7 - Responsividade Mobile
- [x] Sidebar mobile com Sheet/drawer
- [x] Grids responsivos em todas as páginas
- [x] Formulários em modal com scroll
- [x] Tabs com scroll horizontal em mobile

### Fase 8 - Micro-interações
- [x] Animações Framer Motion de entrada de página
- [x] Skeleton loading em todas as listas
- [x] Botões com estado isPending + Loader2
- [x] Toasts específicos em português
- [x] Tooltips em botões de ícone

### Fase 9-10 - Verificação e Checklist
- [x] Verificar fluxo completo de consulta
- [x] Verificar export PDF
- [x] TypeScript sem erros (0 erros)
- [x] Checklist final de qualidade (328 testes passando)

## Fix Painel Gestor - Consultas e Fechamentos Automáticos (v67)
- [x] Diagnosticar como consultas e fechamentos são contados no backend
- [x] Corrigir query para contar consultas realizadas pelos dentistas da clínica
- [x] Corrigir query para contar fechamentos de tratamento da clínica (via consultations + feedbacks)
- [x] Garantir que DashboardGestor exibe dados corretos automaticamente
- [x] Propagar clinicId do dentista para pacientes na criação
- [x] Testar fluxo completo
- [x] Corrigir barras do funil para usar valor máximo como referência (não hardcoded 100%)

## Bug: Login CRC criado pelo gestor não funciona (v68)
- [x] Diagnosticar erro no login de CRC criado via Meu Time (faltava openId)
- [x] Corrigir fluxo de criação de membro / login (gerar openId no addClinicMember)
- [x] Corrigir usuários existentes sem openId (4 usuários corrigidos no banco)
- [x] Testar login CRC (328 testes passando)

## Fix: CRC redirecionado para assinatura + botão Voltar + contagem consultas (v69)
- [x] Botão "Voltar ao Dashboard" no Pricing.tsx redireciona por papel (CRC -> /crc, Gestor -> /gestor)
- [x] CRC não é mais bloqueado pelo PaywallGuard (herda acesso do gestor)
- [x] CRC é redirecionado automaticamente para /crc ao acessar / (Dashboard.tsx)
- [x] CRC/Dentista criado pelo gestor herda acesso da assinatura do gestor (getEffectiveBillingUser)
- [x] Contagem de consultas baseada no gestor (incrementClinicConsultationCount)
- [x] Todos os middlewares de billing usam getEffectiveBillingUser
- [x] billing.getPlanInfo retorna info do plano do gestor para CRC/Dentista
- [x] 328 testes passando, 0 erros TypeScript

## Bug: Não consegue excluir a última consulta da lista (v70)
- [x] Diagnosticar fluxo de exclusão de consultas (backend + frontend)
- [x] Corrigir bug: gestor e admin agora podem excluir consultas de membros da clínica
- [x] Testar exclusão (328 testes passando)

## Bug: CRC não consegue acessar /leads - erro "Apenas o gestor pode ver os membros" (v71)
- [x] Diagnosticar: LeadDetail.tsx chama clinic.getMembers (restrito ao gestor) para listar dentistas na conversão
- [x] Corrigir: permitir CRC ver membros da clínica (necessário para converter leads em pacientes)
- [x] Testar: 328 testes passando, 0 erros TypeScript
