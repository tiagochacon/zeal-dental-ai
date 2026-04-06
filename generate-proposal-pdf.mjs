import { jsPDF } from "jspdf";
import fs from "fs";

const doc = new jsPDF({ unit: "mm", format: "a4" });
const pageWidth = 210;
const marginLeft = 25;
const marginRight = 25;
const usableWidth = pageWidth - marginLeft - marginRight;
let y = 25;

function checkPage(needed = 12) {
  if (y + needed > 275) {
    doc.addPage();
    y = 25;
  }
}

function addTitle(text, size = 16) {
  checkPage(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(20, 60, 100);
  const lines = doc.splitTextToSize(text, usableWidth);
  doc.text(lines, pageWidth / 2, y, { align: "center" });
  y += lines.length * (size * 0.45) + 4;
}

function addSectionTitle(text) {
  checkPage(18);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 60, 100);
  doc.text(text, marginLeft, y);
  y += 3;
  doc.setDrawColor(20, 60, 100);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 7;
}

function addSubSection(text) {
  checkPage(12);
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);
  const lines = doc.splitTextToSize(text, usableWidth);
  doc.text(lines, marginLeft, y);
  y += lines.length * 4.5 + 2;
}

function addParagraph(text) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);
  const lines = doc.splitTextToSize(text, usableWidth);
  for (const line of lines) {
    checkPage(5);
    doc.text(line, marginLeft, y);
    y += 4.8;
  }
  y += 2;
}

function addBullet(text, indent = 0) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);
  const bulletX = marginLeft + 3 + indent;
  const textX = bulletX + 4;
  const availableWidth = usableWidth - 7 - indent;
  const lines = doc.splitTextToSize(text, availableWidth);
  for (let i = 0; i < lines.length; i++) {
    checkPage(5);
    if (i === 0) {
      doc.setFont("helvetica", "bold");
      doc.text("\u2022", bulletX, y);
      doc.setFont("helvetica", "normal");
    }
    doc.text(lines[i], textX, y);
    y += 4.8;
  }
  y += 1;
}

function addBoldBullet(boldPart, normalPart, indent = 0) {
  const bulletX = marginLeft + 3 + indent;
  const textX = bulletX + 4;
  const availableWidth = usableWidth - 7 - indent;
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);

  const fullText = boldPart + " " + normalPart;
  const lines = doc.splitTextToSize(fullText, availableWidth);

  checkPage(lines.length * 5);
  doc.setFont("helvetica", "bold");
  doc.text("\u2022", bulletX, y);

  for (let i = 0; i < lines.length; i++) {
    if (i === 0) {
      doc.setFont("helvetica", "bold");
      const boldWidth = doc.getTextWidth(boldPart + " ");
      doc.text(boldPart + " ", textX, y);
      const restOfFirstLine = lines[0].substring(boldPart.length + 1);
      if (restOfFirstLine) {
        doc.setFont("helvetica", "normal");
        doc.text(restOfFirstLine, textX + boldWidth, y);
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.text(lines[i], textX, y);
    }
    y += 4.8;
  }
  y += 1;
}

function addSpacer(mm = 3) {
  y += mm;
}

// ===================== HEADER =====================
doc.setFont("helvetica", "bold");
doc.setFontSize(10);
doc.setTextColor(120, 120, 120);
doc.text("ZEAL TECNOLOGIA", pageWidth / 2, y, { align: "center" });
y += 8;

addTitle("PROPOSTA DE PARCERIA E INCENTIVO FINANCEIRO");
y += 2;

// Destinatario
doc.setFont("helvetica", "bold");
doc.setFontSize(10.5);
doc.setTextColor(40, 40, 40);
doc.text("Ao", marginLeft, y);
y += 5;
doc.text("Conselho Regional de Odontologia de Pernambuco (CRO-PE)", marginLeft, y);
y += 5;
doc.setFont("helvetica", "normal");
doc.setFontSize(10.5);
const assuntoLines = doc.splitTextToSize(
  "Assunto: Solicitação de apoio institucional e incentivo financeiro para o desenvolvimento da plataforma ZEAL — Assistente de Inteligência Artificial para a Odontologia.",
  usableWidth
);
for (const line of assuntoLines) {
  doc.text(line, marginLeft, y);
  y += 4.8;
}
y += 6;

// ===================== 1. QUEM SOMOS =====================
addSectionTitle("1. QUEM SOMOS");
addParagraph(
  "A Zeal Tecnologia é uma empresa focada exclusivamente no setor odontológico. Nascemos da observação direta dos desafios que cirurgiões-dentistas enfrentam diariamente em seus consultórios e clínicas: excesso de burocracia, tempo perdido com documentação, dificuldade de converter orçamentos em tratamentos e falta de ferramentas que realmente entendam a realidade da Odontologia."
);
addParagraph(
  "Nosso propósito é dar ao dentista uma ferramenta que trabalhe a favor dele — que simplifique a rotina, aumente a segurança clínica e ajude a transformar o potencial da clínica em resultado real."
);

// ===================== 2. A REALIDADE =====================
addSectionTitle("2. A REALIDADE QUE O DENTISTA ENFRENTA HOJE");
addParagraph(
  "O cirurgião-dentista brasileiro vive uma rotina intensa. Entre atender pacientes, preencher prontuários, elaborar orçamentos, negociar planos de tratamento e gerir a equipe, sobra pouco tempo para o que realmente importa: o cuidado clínico. Os dados do setor revelam problemas sérios:"
);

addBoldBullet(
  "Tempo perdido com burocracia:",
  "Dentistas gastam cerca de 12% do seu tempo produtivo apenas com documentação e tarefas administrativas. Isso são horas que poderiam ser dedicadas a atender mais pacientes ou a se capacitar."
);
addBoldBullet(
  "Erros em prescrições:",
  "31,4% das prescrições odontológicas apresentam algum tipo de erro, sendo o mais comum relacionado à dosagem. Não por falta de conhecimento, mas pelo acúmulo de tarefas e pela pressa da rotina."
);
addBoldBullet(
  "Pacientes que não voltam:",
  "A taxa de conversão de novos pacientes fica entre 50% e 60%, mas quando falamos de pacientes recorrentes aceitando novos planos de tratamento, esse número cai para apenas 25% a 35%. Ou seja: a cada 10 orçamentos apresentados, até 7 não se convertem em tratamento."
);
addBoldBullet(
  "Receita imprevisível:",
  "Com baixa conversão e alta evasão, a maioria das clínicas opera sem previsibilidade financeira, dificultando investimentos, contratações e crescimento."
);

addParagraph(
  "Esses não são problemas isolados. São gargalos estruturais do mercado que afetam desde o recém-formado até o profissional com décadas de experiência. E a tecnologia disponível hoje não resolve isso de forma integrada."
);

// ===================== 3. O QUE A ZEAL FAZ =====================
addSectionTitle("3. O QUE A ZEAL FAZ PELO DENTISTA");
addParagraph(
  "A ZEAL é uma plataforma inteligente que atua diretamente nos gargalos do dia a dia odontológico. Ela combina Inteligência Artificial com o conhecimento clínico e comercial para entregar soluções práticas em três frentes:"
);

addSubSection("3.1 Menos burocracia, mais tempo para o paciente");
addParagraph(
  "O dentista atende o paciente normalmente e a ZEAL cuida do resto:"
);
addBullet("A consulta é gravada e transcrita automaticamente, com vocabulário odontológico especializado — sem precisar digitar nada.");
addBullet("A nota clínica (SOAP) é gerada automaticamente a partir da conversa: Subjetivo, Objetivo, Avaliação e Plano, tudo estruturado e pronto para o prontuário.");
addBullet("O odontograma é preenchido automaticamente com a nomenclatura FDI, extraído diretamente do que foi falado na consulta.");
addBullet("O plano de tratamento é gerado pela IA e pode ser editado livremente pelo profissional antes de ser finalizado.");
addBullet("Toda a documentação pode ser exportada em PDF para impressão ou arquivamento digital.");

addParagraph(
  "O resultado: o que antes levava 15 a 20 minutos de digitação após cada consulta, agora é feito em segundos. O dentista ganha tempo, reduz erros e mantém o prontuário sempre completo e padronizado."
);

addSubSection("3.2 Mais pacientes fechando tratamento");
addParagraph(
  "Esta é a grande lacuna que nenhum outro software odontológico resolve. A ZEAL integra uma metodologia de Neurovendas desenvolvida em parceria com o Dr. Carlos Rodriguez, a maior referência em neurovendas na Odontologia do Brasil, diretamente na plataforma. Funciona assim:"
);
addBullet("Antes mesmo do paciente sentar na cadeira, o comercial da clínica registra a ligação de agendamento e a IA analisa o perfil comportamental do paciente (reptiliano, límbico ou neocortex).");
addBullet("Com base nesse perfil, a plataforma gera um script personalizado de como conduzir a apresentação do plano de tratamento — quais palavras usar, quais objeções antecipar, quais gatilhos emocionais ativar.");
addBullet("O dentista recebe estratégias de rapport, técnicas LAER para contornar objeções e o método PARE para conduzir a negociação.");
addBullet("Após a consulta, a IA analisa a conversa e gera insights sobre como melhorar a taxa de fechamento para os próximos atendimentos.");

addParagraph(
  "O impacto é direto no faturamento: mais planos aceitos, menos orçamentos perdidos, receita mais previsível."
);

addSubSection("3.3 Gestão inteligente da clínica");
addParagraph("Para clínicas com equipe, a ZEAL oferece uma visão completa do negócio:");
addBullet("O gestor acompanha o desempenho de cada profissional e do comercial (CRC) em um painel centralizado.");
addBullet("O funil de pacientes é visível: quantos leads entraram, quantos agendaram, quantos fecharam tratamento.");
addBullet("Leads são gerenciados dentro da plataforma, com histórico de ligações, transcrições e análise comportamental.");
addBullet("A equipe toda opera dentro de um único plano de assinatura gerenciado pelo dono da clínica.");

// ===================== 4. MERCADO =====================
addSectionTitle("4. A OPORTUNIDADE DO MERCADO ODONTOLÓGICO");
addParagraph(
  "O Brasil é um dos países com maior concentração de cirurgiões-dentistas do mundo. O mercado global de serviços odontológicos é estimado em mais de US$ 540 bilhões em 2025, com projeção de ultrapassar US$ 1,1 trilhão até 2035. E o segmento de tecnologia na Odontologia está entre os que mais crescem."
);
addParagraph(
  "Apesar disso, não existe hoje no mercado brasileiro uma solução que una, em uma única plataforma, documentação clínica automatizada com IA e ferramentas de negociação e conversão de pacientes. Essa lacuna é exatamente onde a ZEAL atua."
);
addParagraph(
  "Existem softwares de gestão de clínica. Existem IAs genéricas. Mas nenhum combina as duas coisas com conhecimento odontológico real e metodologia de vendas validada especificamente para o setor."
);

// ===================== 5. VALIDACAO =====================
addSectionTitle("5. ONDE JÁ ESTAMOS");
addParagraph(
  "A plataforma está completa e funcional, em fase de validação com clínicas reais:"
);
addBoldBullet("Clínica IBO", "— Boa Viagem, Recife-PE. Clínica piloto em testes ativos com o software.");
addBoldBullet("AGN Odontologia", "— Mooca, São Paulo-SP. Clínica piloto em testes ativos com o software.");
addBoldBullet("Professores universitários e clínicas menores", "colaboram na validação clínica e no feedback de usabilidade.");
addBoldBullet("Dr. Carlos Rodriguez", "— Mentor e referência em Neurovendas na Odontologia, cuja metodologia foi integrada à plataforma.");
addParagraph(
  "Todas as funcionalidades descritas neste documento já estão implementadas e funcionando. Não se trata de uma ideia ou projeto futuro — é um produto real, em uso."
);

// ===================== 6. RELEVANCIA CRO =====================
addSectionTitle("6. POR QUE ESTA PARCERIA IMPORTA PARA O CRO-PE");
addParagraph(
  "O CRO-PE tem como missão zelar pela classe odontológica, pela ética profissional e pelo bem-estar dos pacientes. Apoiar a ZEAL é apoiar uma iniciativa que atua diretamente nesses pilares:"
);
addBoldBullet(
  "Segurança para o paciente:",
  "Ao automatizar prescrições e documentação com IA especializada, a plataforma reduz o risco de erros que comprometem a segurança clínica."
);
addBoldBullet(
  "Sustentabilidade financeira do profissional:",
  "Com mais orçamentos convertidos e melhor negociação, o dentista tem receita mais previsível e condições reais de crescer."
);
addBoldBullet(
  "Apoio ao recém-formado:",
  "A ferramenta auxilia profissionais em início de carreira que ainda não têm experiência com negociação e gestão, reduzindo a curva de aprendizado."
);
addBoldBullet(
  "Inovação na Odontologia pernambucana:",
  "O apoio posiciona o CRO-PE como um conselho vanguardista, alinhado à transformação digital da saúde e comprometido com a modernização da profissão."
);
addBoldBullet(
  "Acesso democrático à tecnologia:",
  "Através do cupom exclusivo para associados, o CRO-PE garante que seus inscritos tenham acesso facilitado a uma ferramenta que, de outra forma, ficaria restrita a grandes clínicas."
);

// ===================== 7. CONTRAPARTIDAS =====================
addSectionTitle("7. CONTRAPARTIDAS OFERECIDAS");
addParagraph(
  "Em reconhecimento ao apoio institucional do CRO-PE, a Zeal Tecnologia oferece as seguintes contrapartidas:"
);

addSubSection("7.1 Logomarca do CRO-PE na plataforma");
addParagraph(
  "A logomarca oficial do CRO-PE será incluída com destaque na página inicial (landing page) da plataforma ZEAL, na seção de parceiros institucionais. A marca ficará visível para todos os visitantes e usuários da plataforma em âmbito nacional, enquanto durar a parceria."
);

addSubSection("7.2 Cupom de desconto exclusivo para associados do CRO-PE");
addParagraph(
  "Será criado um cupom de desconto exclusivo para cirurgiões-dentistas inscritos no CRO-PE, aplicável nos planos de assinatura da plataforma ZEAL. O cupom será divulgado pelo CRO-PE diretamente aos seus associados, fortalecendo o vínculo do Conselho com a classe e garantindo um benefício concreto e tangível para os profissionais."
);

// ===================== 8. DESTINACAO =====================
addSectionTitle("8. DESTINAÇÃO DO INVESTIMENTO");
addParagraph(
  "O incentivo financeiro solicitado será destinado integralmente ao desenvolvimento e crescimento da plataforma, nas seguintes frentes:"
);
addBoldBullet(
  "Evolução da plataforma:",
  "Novas funcionalidades como integração com radiografia por IA, suporte a mais especialidades odontológicas e melhorias contínuas de usabilidade."
);
addBoldBullet(
  "Segurança e privacidade:",
  "Adequação completa à LGPD para dados sensíveis de saúde, reforço nas camadas de proteção de dados e auditorias de segurança."
);
addBoldBullet(
  "Divulgação e acesso:",
  "Marketing digital, produção de conteúdo educativo para a classe odontológica e participação em eventos e congressos do setor."
);
addBoldBullet(
  "Operação e suporte:",
  "Ampliação da equipe para atender mais clínicas, oferecer suporte técnico dedicado e garantir a qualidade do serviço."
);

// ===================== 9. CONSIDERACOES FINAIS =====================
addSectionTitle("9. CONSIDERAÇÕES FINAIS");
addParagraph(
  "A ZEAL não é apenas um software — é uma ferramenta construída por quem entende as dores reais do cirurgião-dentista. Cada funcionalidade foi pensada para resolver problemas concretos: o tempo perdido com burocracia, os erros evitáveis em prescrições, os orçamentos que não se convertem em tratamento e a falta de previsibilidade financeira que assombra a maioria das clínicas."
);
addParagraph(
  "Apresentamos ao CRO-PE uma oportunidade concreta de apoiar a inovação na Odontologia com uma plataforma que já existe, que já funciona e que já está sendo testada em clínicas reais. O apoio do Conselho será determinante para acelerar o acesso dos profissionais pernambucanos a essa tecnologia."
);
addParagraph(
  "Colocamo-nos à inteira disposição para apresentação presencial da plataforma, demonstração das funcionalidades e esclarecimento de quaisquer dúvidas."
);

addSpacer(6);
addParagraph("Desde já agradecemos pela atenção e consideração.");
addParagraph("Atenciosamente,");
addSpacer(10);

doc.setDrawColor(40, 40, 40);
doc.line(marginLeft, y, marginLeft + 60, y);
y += 5;
doc.setFont("helvetica", "bold");
doc.setFontSize(10.5);
doc.setTextColor(40, 40, 40);
doc.text("[Nome do Responsável]", marginLeft, y);
y += 5;
doc.setFont("helvetica", "normal");
doc.text("Zeal Tecnologia", marginLeft, y);
y += 5;
doc.text("[CNPJ]", marginLeft, y);
y += 5;
doc.text("[Telefone de contato]", marginLeft, y);
y += 5;
doc.text("[E-mail de contato]", marginLeft, y);

const buffer = doc.output("arraybuffer");
fs.writeFileSync(
  "C:\\Zeal\\Zeal Manus\\zeal-dental-ai\\Proposta_Parceria_CRO_PE_Zeal.pdf",
  Buffer.from(buffer)
);
console.log("PDF gerado com sucesso!");
