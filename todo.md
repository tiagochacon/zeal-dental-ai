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
