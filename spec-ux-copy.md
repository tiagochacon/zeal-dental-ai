# Spec: Ajustar UX/UI Copy de Interações Comerciais

## Objetivo
Revisar textos, títulos e rótulos de botões na jornada do CRC para refletir com precisão a ação e o tipo de interação (ligação gravada, upload de áudio ou importação de conversa WhatsApp).

## Copy por aba
- **aba_record**: título "Nova interação comercial", subtítulo "Grave a ligação...", botão "Registrar ligação", progresso "Enviando áudio..."
- **aba_upload**: título "Nova interação comercial", subtítulo "Envie um arquivo de áudio...", botão "Registrar interação com áudio", progresso "Enviando áudio..."
- **aba_whatsapp**: título "Nova interação comercial", subtítulo "Importe o .zip exportado pelo WhatsApp...", botão "Importar conversa do WhatsApp", progresso "Importando conversa..."

## Arquivos prioritários
- NewCall.tsx, Calls.tsx, CallDetail.tsx, LeadDetail.tsx

## Critérios de aceite
- Na aba WhatsApp, botão primário nunca exibe "Registrar ligação"
- Na aba Gravar/Upload, não aparece copy exclusiva de WhatsApp
- Título e subtítulo não contradizem a aba selecionada
- Lista em Calls e fluxo em LeadDetail usam mesma nomenclatura
- Sem regressão funcional
