import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SOAPNote } from '../../../drizzle/schema';

interface ConsultationData {
  patientName: string;
  createdAt: Date | string;
  soapNote: SOAPNote;
}

export function exportSOAPToPDF(consultation: ConsultationData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Header with logo area
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ZEAL', margin, 28);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Assistente de IA Odontológico', margin + 45, 28);

  // Patient info
  yPos = 55;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(consultation.patientName, margin, yPos);
  
  yPos += 8;
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

  // Red Flags Section
  if (soapNote.assessment?.red_flags && soapNote.assessment.red_flags.length > 0) {
    doc.setFillColor(254, 226, 226); // red-100
    doc.setDrawColor(239, 68, 68); // red-500
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10 + soapNote.assessment.red_flags.length * 6, 3, 3, 'FD');
    
    yPos += 8;
    doc.setTextColor(185, 28, 28); // red-700
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠ Sinais de Alerta', margin + 5, yPos);
    
    yPos += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    soapNote.assessment.red_flags.forEach((flag: string) => {
      doc.text(`• ${flag}`, margin + 8, yPos);
      yPos += 5;
    });
    yPos += 8;
  }

  // Helper function to add section
  const addSection = (title: string, icon: string, content: { label: string; value: string | string[] }[]) => {
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Section header
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, 'F');
    
    doc.setTextColor(59, 130, 246); // blue-500
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${icon} ${title}`, margin + 5, yPos + 7);
    yPos += 15;

    // Section content
    doc.setTextColor(30, 41, 59);
    content.forEach(item => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(item.label, margin + 5, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      
      if (Array.isArray(item.value)) {
        item.value.forEach(v => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          const lines = doc.splitTextToSize(`• ${v}`, pageWidth - 2 * margin - 10);
          doc.text(lines, margin + 8, yPos);
          yPos += lines.length * 5;
        });
      } else {
        const lines = doc.splitTextToSize(item.value, pageWidth - 2 * margin - 10);
        doc.text(lines, margin + 5, yPos);
        yPos += lines.length * 5;
      }
      yPos += 3;
    });
    yPos += 5;
  };

  // Subjective Section
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
    addSection('Subjetivo (S)', '🩺', subjectiveContent);
  }

  // Objective Section
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
    addSection('Objetivo (O)', '✓', objectiveContent);
  }

  // Assessment Section
  const assessmentContent: { label: string; value: string | string[] }[] = [];
  if (soapNote.assessment.diagnosticos && soapNote.assessment.diagnosticos.length > 0) {
    assessmentContent.push({ label: 'Diagnósticos', value: soapNote.assessment.diagnosticos });
  }
  if (assessmentContent.length > 0) {
    addSection('Avaliação (A)', '📋', assessmentContent);
  }

  // Plan Section
  if (soapNote.plan.tratamentos && soapNote.plan.tratamentos.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    // Section header
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, 'F');
    
    doc.setTextColor(59, 130, 246);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('📋 Plano (P)', margin + 5, yPos + 7);
    yPos += 15;

    // Treatments table
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
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
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      bodyStyles: {
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [241, 245, 249],
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },
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
    doc.setTextColor(100, 116, 139);
    doc.text('Orientações ao Paciente', margin + 5, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    soapNote.plan.orientacoes.forEach(or => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const lines = doc.splitTextToSize(`• ${or}`, pageWidth - 2 * margin - 10);
      doc.text(lines, margin + 8, yPos);
      yPos += lines.length * 5;
    });
    yPos += 5;
  }

  // Clinical reminders
  if (soapNote.plan.lembretes_clinicos && soapNote.plan.lembretes_clinicos.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Lembretes Clínicos', margin + 5, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    soapNote.plan.lembretes_clinicos.forEach(lem => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const lines = doc.splitTextToSize(`• ${lem}`, pageWidth - 2 * margin - 10);
      doc.text(lines, margin + 8, yPos);
      yPos += lines.length * 5;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado por ZEAL - Assistente de IA Odontológico | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `nota-soap-${consultation.patientName.replace(/\s+/g, '-').toLowerCase()}-${new Date(consultation.createdAt).toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
