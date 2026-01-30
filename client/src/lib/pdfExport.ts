import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SOAPNote, TreatmentPlan } from '../../../drizzle/schema';

interface ConsultationData {
  patientName: string;
  createdAt: Date | string;
  soapNote: SOAPNote;
  dentistName?: string;
  dentistCRO?: string;
  clinicName?: string;
}

interface TreatmentPlanExportData {
  patientName: string;
  createdAt: Date | string;
  treatmentPlan: TreatmentPlan;
  dentistName?: string;
  dentistCRO?: string;
  clinicName?: string;
  patientMedicalHistory?: string;
  patientAllergies?: string;
  patientMedications?: string;
}

export function exportSOAPToPDF(consultation: ConsultationData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  // Modern Header with gradient effect simulation
  doc.setFillColor(30, 27, 75); // Dark purple/navy
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Add a subtle lighter bar at the bottom of header
  doc.setFillColor(59, 130, 246); // Blue accent
  doc.rect(0, 43, pageWidth, 2, 'F');
  
  // Logo and Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('ZEAL', margin, 30);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 255);
  doc.text('Assistente de IA Odontológico', margin + 50, 30);

  // Patient information section
  yPos = 60;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(consultation.patientName, margin, yPos);
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const dateStr = new Date(consultation.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  doc.text(`Data da consulta: ${dateStr}`, margin, yPos);

  yPos += 15;

  const soapNote = consultation.soapNote;

  // Red Flags Section - Enhanced visibility
  if (soapNote.assessment?.red_flags && soapNote.assessment.red_flags.length > 0) {
    // Calculate box height dynamically
    const flagHeight = soapNote.assessment.red_flags.length * 6;
    const boxHeight = 18 + flagHeight;
    
    // Draw colored background with border
    doc.setFillColor(254, 242, 242); // Very light red/pink
    doc.setDrawColor(220, 38, 38); // Red border
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, boxHeight, 3, 3, 'FD');
    
    // Add icon/symbol bar on the left
    doc.setFillColor(239, 68, 68); // Red accent bar
    doc.roundedRect(margin, yPos, 5, boxHeight, 3, 3, 'F');
    
    yPos += 10;
    doc.setTextColor(153, 27, 27); // Dark red
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Sinais de Alerta', margin + 10, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(127, 29, 29);
    soapNote.assessment.red_flags.forEach((flag: string) => {
      const lines = doc.splitTextToSize(`• ${flag}`, pageWidth - 2 * margin - 20);
      doc.text(lines, margin + 10, yPos);
      yPos += lines.length * 5;
    });
    yPos += 10;
  }

  // Helper function to add section with professional styling
  const addSection = (title: string, sectionColor: number[], content: { label: string; value: string | string[] }[]) => {
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Section header with accent bar
    doc.setFillColor(248, 250, 252); // Very light gray
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 12, 2, 2, 'F');
    
    // Add colored accent bar on the left
    doc.setFillColor(sectionColor[0], sectionColor[1], sectionColor[2]);
    doc.roundedRect(margin, yPos, 4, 12, 2, 2, 'F');
    
    // Section title
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 10, yPos + 8);
    yPos += 18;

    // Section content
    content.forEach(item => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      // Subsection label
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105); // Slate gray
      doc.text(item.label, margin + 5, yPos);
      yPos += 6;

      // Subsection content
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      
      if (Array.isArray(item.value)) {
        item.value.forEach(v => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          const lines = doc.splitTextToSize(`• ${v}`, pageWidth - 2 * margin - 15);
          doc.text(lines, margin + 10, yPos);
          yPos += lines.length * 5 + 1;
        });
      } else {
        const lines = doc.splitTextToSize(item.value || 'Não informado', pageWidth - 2 * margin - 15);
        doc.text(lines, margin + 10, yPos);
        yPos += lines.length * 5;
      }
      yPos += 5;
    });
    yPos += 3;
  };

  // Subjective Section (Purple/Blue color)
  const subjectiveContent: { label: string; value: string | string[] }[] = [];
  if (soapNote.subjective.queixa_principal) {
    subjectiveContent.push({ label: 'Queixa Principal', value: soapNote.subjective.queixa_principal });
  }
  if (soapNote.subjective.historia_doenca_atual) {
    subjectiveContent.push({ label: 'História da Doença Atual', value: soapNote.subjective.historia_doenca_atual });
  }
  if (soapNote.subjective.historico_medico && soapNote.subjective.historico_medico.length > 0) {
    subjectiveContent.push({ label: 'Histórico Médico', value: soapNote.subjective.historico_medico });
  }
  if (subjectiveContent.length > 0) {
    addSection('Subjetivo (S)', [99, 102, 241], subjectiveContent); // Indigo
  }

  // Objective Section (Green color)
  const objectiveContent: { label: string; value: string | string[] }[] = [];
  if (soapNote.objective.exame_clinico_geral) {
    objectiveContent.push({ label: 'Exame Clínico Geral', value: soapNote.objective.exame_clinico_geral });
  }
  if (soapNote.objective.exame_clinico_especifico && soapNote.objective.exame_clinico_especifico.length > 0) {
    objectiveContent.push({ label: 'Exame Clínico Específico', value: soapNote.objective.exame_clinico_especifico });
  }
  if (soapNote.objective.dentes_afetados && soapNote.objective.dentes_afetados.length > 0) {
    objectiveContent.push({ label: 'Dentes Afetados', value: soapNote.objective.dentes_afetados.join(', ') });
  }
  if (objectiveContent.length > 0) {
    addSection('Objetivo (O)', [16, 185, 129], objectiveContent); // Emerald
  }

  // Assessment Section (Orange color)
  const assessmentContent: { label: string; value: string | string[] }[] = [];
  if (soapNote.assessment.diagnosticos && soapNote.assessment.diagnosticos.length > 0) {
    assessmentContent.push({ label: 'Diagnósticos', value: soapNote.assessment.diagnosticos });
  }
  if (assessmentContent.length > 0) {
    addSection('Avaliação (A)', [249, 115, 22], assessmentContent); // Orange
  }

  // Plan Section (Blue color)
  if (soapNote.plan.tratamentos && soapNote.plan.tratamentos.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    // Section header with accent bar
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 12, 2, 2, 'F');
    
    // Add colored accent bar
    doc.setFillColor(59, 130, 246); // Blue
    doc.roundedRect(margin, yPos, 4, 12, 2, 2, 'F');
    
    // Section title
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Plano (P)', margin + 10, yPos + 8);
    yPos += 18;

    // Treatments table subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Tratamentos Propostos', margin + 5, yPos);
    yPos += 5;

    const tableData = soapNote.plan.tratamentos.map(trat => [
      trat.urgencia.toUpperCase(),
      trat.procedimento,
      trat.dente,
      trat.prazo || 'A definir'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Urgência', 'Procedimento', 'Dente', 'Prazo']],
      body: tableData,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [59, 130, 246], // Blue
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Orientations
  if (soapNote.plan.orientacoes && soapNote.plan.orientacoes.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Orientações ao Paciente', margin + 5, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    soapNote.plan.orientacoes.forEach(or => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const lines = doc.splitTextToSize(`• ${or}`, pageWidth - 2 * margin - 15);
      doc.text(lines, margin + 10, yPos);
      yPos += lines.length * 5 + 1;
    });
    yPos += 8;
  }

  // Clinical reminders
  if (soapNote.plan.lembretes_clinicos && soapNote.plan.lembretes_clinicos.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Lembretes Clínicos', margin + 5, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    soapNote.plan.lembretes_clinicos.forEach(lem => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const lines = doc.splitTextToSize(`• ${lem}`, pageWidth - 2 * margin - 15);
      doc.text(lines, margin + 10, yPos);
      yPos += lines.length * 5 + 1;
    });
    yPos += 8;
  }

  // Dentist Signature Section
  // Check if we need a new page for signature
  if (yPos > pageHeight - 70) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 15; // Extra spacing before signature

  // Signature line
  const signatureLineWidth = 80;
  const signatureStartX = pageWidth - margin - signatureLineWidth;
  
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.5);
  doc.line(signatureStartX, yPos, signatureStartX + signatureLineWidth, yPos);
  
  yPos += 6;
  
  // Conditional logic for dentist information
  const hasDentistInfo = consultation.dentistName && consultation.dentistName.trim() !== '' && 
                          consultation.dentistCRO && consultation.dentistCRO.trim() !== '';
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  if (hasDentistInfo) {
    // Show real dentist information
    doc.setTextColor(30, 41, 59); // Darker color for real data
    
    doc.text(consultation.dentistName || 'Dentista', signatureStartX + signatureLineWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text(consultation.dentistCRO || 'CRO', signatureStartX + signatureLineWidth / 2, yPos, { align: 'center' });
    
    // Add clinic name if available
    if (consultation.clinicName && consultation.clinicName.trim() !== '') {
      yPos += 5;
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105); // Lighter color for clinic
      doc.text(consultation.clinicName, signatureStartX + signatureLineWidth / 2, yPos, { align: 'center' });
    }
  } else {
    // Show placeholders
    doc.setTextColor(156, 163, 175); // Gray color for placeholders
    doc.setFont('helvetica', 'italic');
    
    doc.text('[Nome Completo do Dentista]', signatureStartX + signatureLineWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text('[CRO/Número de Registro]', signatureStartX + signatureLineWidth / 2, yPos, { align: 'center' });
  }

  // Professional Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer separator line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Gerado por ZEAL - Assistente de IA Odontológico`,
      pageWidth / 2,
      pageHeight - 9,
      { align: 'center' }
    );
    
    // Page number
    doc.setFontSize(8);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 9,
      { align: 'right' }
    );
  }

  // Save the PDF with formatted filename
  const fileName = `nota-soap-${consultation.patientName.replace(/\s+/g, '-').toLowerCase()}-${new Date(consultation.createdAt).toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

export function exportTreatmentPlanToPDF(data: TreatmentPlanExportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 22; // Margens equilibradas (mínimo 20mm)
  let yPos = 20;
  
  // Constantes de tipografia para consistência
  const LINE_HEIGHT = 1.6; // Espaçamento entre linhas aumentado
  const PARAGRAPH_SPACING = 8; // Espaçamento entre parágrafos
  const SECTION_SPACING = 12; // Espaçamento entre seções
  const ITEM_SPACING = 6; // Espaçamento entre itens de lista

  // ============================================
  // CABEÇALHO PREMIUM COM IDENTIDADE VISUAL
  // ============================================
  
  // Background do header com gradiente simulado
  doc.setFillColor(30, 27, 75); // Deep navy/purple
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  // Barra de destaque inferior
  doc.setFillColor(59, 130, 246); // Blue accent
  doc.rect(0, 48, pageWidth, 2, 'F');
  
  // Logo ZEAL
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('ZEAL', margin, 32);
  
  // Tagline
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 220);
  doc.text('Assistente de IA Odontológico', margin + 55, 32);
  
  // Informações da clínica no header (lado direito)
  if (data.clinicName && data.clinicName.trim() !== '') {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(data.clinicName, pageWidth - margin, 25, { align: 'right' });
  }
  
  if (data.dentistName && data.dentistName.trim() !== '') {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 230);
    doc.text(`Dr(a). ${data.dentistName}`, pageWidth - margin, 33, { align: 'right' });
    if (data.dentistCRO && data.dentistCRO.trim() !== '') {
      doc.text(`CRO: ${data.dentistCRO}`, pageWidth - margin, 41, { align: 'right' });
    }
  }

  // ============================================
  // TÍTULO DO DOCUMENTO
  // ============================================
  yPos = 65;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Plano de Tratamento Odontológico', margin, yPos);
  
  // Linha decorativa sob o título
  yPos += 5;
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(1);
  doc.line(margin, yPos, margin + 80, yPos);
  
  yPos += SECTION_SPACING + 5;

  // ============================================
  // SEÇÃO 1: DADOS DO PACIENTE
  // ============================================
  
  // Card de informações do paciente
  const patientCardHeight = 35;
  doc.setFillColor(248, 250, 252); // Light gray background
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, patientCardHeight, 4, 4, 'F');
  
  // Barra lateral colorida
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(margin, yPos, 5, patientCardHeight, 4, 4, 'F');
  
  yPos += 12;
  
  // Nome do paciente
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(data.patientName, margin + 12, yPos);
  
  yPos += 8;
  
  // Data da consulta
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const dateStr = new Date(data.createdAt).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  doc.text(`Consulta realizada em ${dateStr}`, margin + 12, yPos);
  
  yPos += patientCardHeight - 15 + SECTION_SPACING;

  // ============================================
  // SEÇÃO 2: HISTÓRICO RELEVANTE (se disponível)
  // ============================================
  
  const hasHistory = data.patientMedicalHistory || data.patientAllergies || data.patientMedications;
  
  if (hasHistory) {
    // Título da seção
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 14, 3, 3, 'F');
    doc.setFillColor(249, 115, 22); // Orange accent
    doc.roundedRect(margin, yPos, 5, 14, 3, 3, 'F');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Histórico Relevante do Paciente', margin + 12, yPos + 10);
    yPos += 22;
    
    // Grid de informações
    const colWidth = (pageWidth - 2 * margin) / 3;
    
    if (data.patientMedicalHistory) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Histórico Médico:', margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      const histLines = doc.splitTextToSize(data.patientMedicalHistory, pageWidth - 2 * margin - 10);
      doc.text(histLines, margin + 5, yPos);
      yPos += histLines.length * 4.5 + ITEM_SPACING;
    }
    
    if (data.patientAllergies) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38); // Red for allergies
      doc.text('Alergias:', margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      const allergyLines = doc.splitTextToSize(data.patientAllergies, pageWidth - 2 * margin - 10);
      doc.text(allergyLines, margin + 5, yPos);
      yPos += allergyLines.length * 4.5 + ITEM_SPACING;
    }
    
    if (data.patientMedications) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Medicações em Uso:', margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      const medLines = doc.splitTextToSize(data.patientMedications, pageWidth - 2 * margin - 10);
      doc.text(medLines, margin + 5, yPos);
      yPos += medLines.length * 4.5 + ITEM_SPACING;
    }
    
    yPos += SECTION_SPACING;
  }

  const plan = data.treatmentPlan;

  // ============================================
  // FUNÇÃO AUXILIAR PARA SEÇÕES COM ESTILO PREMIUM
  // ============================================
  
  const addPremiumSection = (
    title: string,
    sectionColor: number[],
    content: { label?: string; value: string | string[]; highlight?: boolean }[]
  ) => {
    // Verificar se precisa de nova página
    if (yPos > 240) {
      doc.addPage();
      yPos = 25;
    }

    // Header da seção com estilo premium
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 14, 3, 3, 'F');
    
    // Barra de cor lateral
    doc.setFillColor(sectionColor[0], sectionColor[1], sectionColor[2]);
    doc.roundedRect(margin, yPos, 5, 14, 3, 3, 'F');
    
    // Título da seção
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 12, yPos + 10);
    yPos += 22;

    // Conteúdo da seção com espaçamento melhorado
    content.forEach((item, index) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 25;
      }

      // Label (se existir)
      if (item.label) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(item.label, margin + 8, yPos);
        yPos += 6;
      }

      // Valor/Conteúdo
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);

      if (Array.isArray(item.value)) {
        item.value.forEach((v, vIndex) => {
          if (yPos > 260) {
            doc.addPage();
            yPos = 25;
          }
          
          // Bullet point estilizado
          doc.setFillColor(sectionColor[0], sectionColor[1], sectionColor[2]);
          doc.circle(margin + 12, yPos - 1.5, 1.5, 'F');
          
          // Texto com line-height aumentado
          const lines = doc.splitTextToSize(v, pageWidth - 2 * margin - 25);
          doc.text(lines, margin + 18, yPos);
          yPos += lines.length * 5.5 + ITEM_SPACING; // Line height 1.6 aproximado
        });
      } else {
        const lines = doc.splitTextToSize(item.value || 'Não informado', pageWidth - 2 * margin - 15);
        lines.forEach((line: string, lineIndex: number) => {
          doc.text(line, margin + 8, yPos);
          yPos += 5.5; // Line height aumentado
        });
      }
      
      yPos += PARAGRAPH_SPACING;
    });
    
    yPos += SECTION_SPACING - PARAGRAPH_SPACING;
  };

  // ============================================
  // SEÇÃO 3: RESUMO DO PLANO
  // ============================================
  
  if (plan.summary) {
    addPremiumSection('Resumo do Plano de Tratamento', [59, 130, 246], [{ value: plan.summary }]);
  }

  // ============================================
  // SEÇÃO 4: SEQUÊNCIA DE TRATAMENTO DETALHADA
  // ============================================
  
  if (plan.steps && plan.steps.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 25;
    }
    
    // Header da seção
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 14, 3, 3, 'F');
    doc.setFillColor(99, 102, 241); // Indigo
    doc.roundedRect(margin, yPos, 5, 14, 3, 3, 'F');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Sequência de Tratamento', margin + 12, yPos + 10);
    yPos += 22;
    
    // Cada etapa como um card individual
    plan.steps.forEach((step, index) => {
      if (yPos > 230) {
        doc.addPage();
        yPos = 25;
      }
      
      // Título da fase - apenas "Fase X:" em azul, seguido do título do step (sem duplicar "Fase")
      doc.setTextColor(59, 130, 246); // Azul para "Fase X:"
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Fase ${index + 1}:`, margin, yPos);
      
      // Título da etapa na mesma linha - remover "Fase X:" se já estiver no título
      doc.setTextColor(30, 41, 59);
      // Remover possível duplicação de "Fase X:" no título
      let cleanTitle = step.title.replace(/^Fase\s*\d+\s*[:\-]?\s*/i, '').trim();
      doc.text(cleanTitle, margin + 22, yPos);
      yPos += 10;
      
      // Descrição
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const descLines = doc.splitTextToSize(step.description, pageWidth - 2 * margin);
      descLines.forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += 5.5;
      });
      yPos += 4;
      
      // Metadados (duração, frequência, observações)
      const metaItems: string[] = [];
      if (step.duration) metaItems.push(`Duração: ${step.duration}`);
      if (step.frequency) metaItems.push(`Frequência: ${step.frequency}`);
      
      if (metaItems.length > 0) {
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(metaItems.join('  •  '), margin, yPos);
        yPos += 6;
      }
      
      if (step.notes) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139);
        const noteLines = doc.splitTextToSize(`Obs: ${step.notes}`, pageWidth - 2 * margin);
        noteLines.forEach((line: string) => {
          doc.text(line, margin, yPos);
          yPos += 4.5;
        });
      }
      
      // Espaçamento maior antes da linha divisória
      yPos += ITEM_SPACING + 12;
      
      // Linha divisória sutil entre etapas (exceto última) - com mais espaço
      if (index < plan.steps.length - 1) {
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos - 6, pageWidth - margin, yPos - 6);
        yPos += 4; // Espaço após a linha
      }
    });
    
    yPos += SECTION_SPACING;
  }

  // ============================================
  // SEÇÃO 5: MEDICAÇÕES
  // ============================================
  
  if (plan.medications && plan.medications.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 25;
    }
    
    // Header da seção
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 14, 3, 3, 'F');
    doc.setFillColor(16, 185, 129); // Emerald
    doc.roundedRect(margin, yPos, 5, 14, 3, 3, 'F');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Prescrição Medicamentosa', margin + 12, yPos + 10);
    yPos += 22;
    
    // Tabela de medicações com estilo premium
    const medTableData = plan.medications.map(med => [
      med.name,
      med.dose,
      med.frequency,
      med.duration || '-',
      med.notes || '-'
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Medicamento', 'Dose', 'Frequência', 'Duração', 'Observações']],
      body: medTableData,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 4,
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 9,
        cellPadding: 5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 'auto' },
      },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + SECTION_SPACING;
  }

  // ============================================
  // SEÇÃO 6: INSTRUÇÕES PÓS-OPERATÓRIAS
  // ============================================
  
  if (plan.postOpInstructions && plan.postOpInstructions.length > 0) {
    addPremiumSection('Recomendações Pós-Procedimento', [249, 115, 22], [
      { value: plan.postOpInstructions },
    ]);
  }

  // ============================================
  // SEÇÃO 7: ALERTAS E CUIDADOS
  // ============================================
  
  if (plan.warnings && plan.warnings.length > 0) {
    // Calcular altura dinâmica baseada no conteúdo real
    // Primeiro, calcular quantas linhas cada warning vai ocupar
    let totalWarningLines = 0;
    const warningTextWidth = pageWidth - 2 * margin - 25;
    plan.warnings.forEach(warning => {
      const lines = doc.splitTextToSize(`• ${warning}`, warningTextWidth);
      totalWarningLines += lines.length;
    });
    
    // Altura = título (22) + linhas de texto (5.5 cada) + espaçamento entre items (2 * número de warnings) + padding
    const warningBoxHeight = 26 + (totalWarningLines * 5.5) + (plan.warnings.length * 3) + 10;
    
    // Verificar se precisa de nova página
    if (yPos + warningBoxHeight > pageHeight - 30) {
      doc.addPage();
      yPos = 25;
    }
    
    // Box de alerta com destaque
    doc.setFillColor(254, 242, 242); // Light red background
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, warningBoxHeight, 4, 4, 'FD');
    
    // Barra lateral vermelha
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(margin, yPos, 6, warningBoxHeight, 4, 4, 'F');
    
    yPos += 14;
    
    // Título
    doc.setTextColor(153, 27, 27);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Alertas e Cuidados Importantes', margin + 14, yPos);
    yPos += 12;
    
    // Lista de alertas
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(127, 29, 29);
    
    plan.warnings.forEach(warning => {
      const lines = doc.splitTextToSize(`• ${warning}`, warningTextWidth);
      lines.forEach((line: string) => {
        doc.text(line, margin + 14, yPos);
        yPos += 5.5;
      });
      yPos += 3;
    });
    
    yPos += SECTION_SPACING;
  }

  // ============================================
  // SEÇÃO 8: CAMPO DE ASSINATURA
  // ============================================
  
  // Verificar se precisa de nova página para assinatura
  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = 25;
  }
  
  yPos += 20;
  
  // Linha divisória antes da assinatura
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 20;
  
  // Área de assinatura centralizada
  const signatureWidth = 90;
  const signatureStartX = (pageWidth - signatureWidth) / 2;
  
  // Linha de assinatura
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.5);
  doc.line(signatureStartX, yPos, signatureStartX + signatureWidth, yPos);
  
  yPos += 8;
  
  // Informações do dentista
  const hasDentistInfo = data.dentistName && data.dentistName.trim() !== '' &&
                          data.dentistCRO && data.dentistCRO.trim() !== '';
  
  doc.setFontSize(10);
  
  if (hasDentistInfo) {
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(`Dr(a). ${data.dentistName}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`CRO: ${data.dentistCRO}`, pageWidth / 2, yPos, { align: 'center' });
    
    if (data.clinicName && data.clinicName.trim() !== '') {
      yPos += 5;
      doc.setFontSize(9);
      doc.text(data.clinicName, pageWidth / 2, yPos, { align: 'center' });
    }
  } else {
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'italic');
    doc.text('[Nome Completo do Dentista]', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    doc.text('[CRO/Número de Registro]', pageWidth / 2, yPos, { align: 'center' });
  }

  // ============================================
  // RODAPÉ PROFISSIONAL EM TODAS AS PÁGINAS
  // ============================================
  
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Linha separadora do footer
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
    
    // Texto do footer
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Gerado por ZEAL - Assistente de IA Odontológico',
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    
    // Número da página
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
    
    // Data de geração
    const generatedDate = new Date().toLocaleDateString('pt-BR');
    doc.text(
      `Emitido em: ${generatedDate}`,
      margin,
      pageHeight - 10,
      { align: 'left' }
    );
  }

  // ============================================
  // SALVAR O PDF
  // ============================================
  
  const fileName = `plano-tratamento-${data.patientName.replace(/\s+/g, '-').toLowerCase()}-${new Date(data.createdAt).toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
