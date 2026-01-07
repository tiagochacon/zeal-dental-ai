import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SOAPNote } from '../../../drizzle/schema';

interface ConsultationData {
  patientName: string;
  createdAt: Date | string;
  soapNote: SOAPNote;
  dentistName?: string;
  dentistCRO?: string;
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
    doc.text('⚠  Sinais de Alerta', margin + 10, yPos);
    
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
  
  // Dentist name and CRO
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  
  const dentistName = consultation.dentistName || '[Nome do Dentista]';
  const dentistCRO = consultation.dentistCRO || '[CRO/Número de Registro]';
  
  doc.text(dentistName, signatureStartX + signatureLineWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text(dentistCRO, signatureStartX + signatureLineWidth / 2, yPos, { align: 'center' });

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
