# Análise do Prompt Multi-Role Clinic System

## Ebook: Neurovendas e Linguagem Corporal para Dentistas (Dr. Carlos Rodriguez)
- 3 perfis cerebrais: Reptiliano (medo/segurança), Límbico (emoção/transformação), Neocórtex (racional/dados)
- Técnica LAER para objeções verdadeiras
- Técnica de Redirecionamento para objeções falsas
- Técnica do Valor Percebido para objeções de preço
- Técnica da Dessensibilização Gradual para objeções de medo
- Modelo PARE: Problema-Amplificação-Resolução-Engajamento
- Gatilhos emocionais: transformação estética, saúde/longevidade, status social, conforto/alívio, exclusividade/inovação

## Arquitetura Multi-Role

### Papéis
1. **Gestor** - Dono da clínica, visão global, gerencia time
2. **CRC** - Comercial, gerencia leads e ligações
3. **Dentista** - Profissional clínico (fluxo existente + melhorias)

### Novas Tabelas
- `clinics` - id, name, ownerId, timestamps
- `leads` - id, clinicId, crcId, name, phone, email, source, notes, isConverted, convertedPatientId, neurovendasAnalysis, callProfile, timestamps
- `calls` - id, clinicId, crcId, leadId, leadName, audioUrl, audioFileKey, audioDurationSeconds, transcript, transcriptSegments, neurovendasAnalysis, schedulingResult, schedulingNotes, status, timestamps, finalizedAt

### Alterações em Tabelas Existentes
- `users` + clinicId (FK clinics), clinicRole (enum: gestor/crc/dentista)
- `patients` + clinicId, createdByUserId, originLeadId
- `consultations` + treatmentClosed (bool), treatmentClosedNotes (text)
- `feedbacks` + treatmentClosed (bool), treatmentClosedNotes (text)

### Novos Routers tRPC
- `clinic` - createClinic, getMyClinic, updateClinic, getMembers, addMember, updateMember, removeMember, getStats
- `leads` - create, list, getById, update, delete, convertToPatient
- `calls` - create, list, getById, transcribe, analyzeNeurovendas, finalizeCall

### Novas Páginas
- CRC: DashboardCRC, Leads, LeadDetail, Calls, NewCall, CallDetail, CRCProfile
- Gestor: DashboardGestor (funil + rankings), TeamManagement, ProfileGestor
- Dentista: Modificações em NewConsultation (dica lead), ConsultationDetail (treatmentClosed no feedback)

### Ordem de Execução
1. Schema DB + Migration
2. Backend (db.ts + routers.ts)
3. Ajustes login/registro
4. Roteamento (App.tsx)
5. RoleGuard
6. Telas CRC
7. Modificações Dentista
8. Telas Gestor
9. Prompt Neurovendas para Calls
10. Consistência visual

### Badge Colors por Role
- Gestor: amber-600 → yellow-500
- Dentista: emerald-600 → teal-500
- CRC: blue-600 → cyan-500
