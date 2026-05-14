# Copy Mapping - Textos a Alterar

## NewCall.tsx
1. L381: h1 "Nova Interação" → "Nova interação comercial" ✓ (já OK, mas spec pede "comercial")
2. L382: subtítulo genérico → dinâmico por aba
3. L456: h2 "Registro da Interação" → OK
4. L252: toast "Ligação registrada e áudio enviado com sucesso!" → contextual
5. L254: toast "Ligação registrada!" → contextual
6. L259: toast "Erro ao registrar ligação" → contextual
7. L826-842: Botão submit "Registrar Ligação" → dinâmico por aba (record/upload)
8. L834: "Enviando áudio..." → OK para audio tabs
9. L811: "Enviando áudio..." → OK para audio tabs
10. L845: "A gravação será transcrita..." → dinâmico por aba

## Calls.tsx
11. L49: h1 "Ligações" → "Interações" 
12. L51: "Histórico de ligações com leads" → "Histórico de interações com leads"
13. L59: "Nova Ligação" → "Nova Interação"
14. L79: "Histórico de Ligações" → "Histórico de Interações"
15. L96: "Nenhuma ligação encontrada" → "Nenhuma interação encontrada"
16. L96: "Nenhuma ligação registrada" → "Nenhuma interação registrada"
17. L99: "Comece registrando sua primeira ligação" → "Comece registrando sua primeira interação"
18. L107: "Nova Ligação" → "Nova Interação"

## CallDetail.tsx
19. L52: toast "Ligação finalizada!" → dinâmico (WhatsApp vs Ligação)
20. L71: "Ligação não encontrada" → "Interação não encontrada"
21. L185: "Áudio da Ligação" → "Áudio da Ligação" (OK, só aparece se tem áudio)
22. L379: placeholder "Observações sobre a ligação (opcional)..." → dinâmico
23. L432: "Observações da Ligação" → dinâmico
24. L446/457/468: "Não mencionado na ligação" → dinâmico

## LeadDetail.tsx
25. L762: "Ligações ({count})" → "Interações ({count})"
26. L767: "Nova Interação" → OK (já está correto)
27. L773: "Nenhuma interação registrada..." → OK (já está correto)

## DashboardLayout.tsx
28. L76/85: sidebar "Ligações" → "Interações"
