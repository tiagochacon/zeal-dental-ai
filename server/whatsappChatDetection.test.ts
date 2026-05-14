import { describe, it, expect } from "vitest";

/**
 * Tests for the WhatsApp chat file detection logic.
 * 
 * The scoring function and detection logic are embedded in whatsappUpload.ts route handler.
 * We test the core scoring algorithm here by replicating the same pattern.
 */

// Replicate the scoring logic from whatsappUpload.ts
const WA_MSG_PATTERN = /^\[?\d{1,2}\/\d{1,2}\/\d{2,4}[,\s]+\d{1,2}:\d{2}/;

function scoreWhatsAppContent(content: string): number {
  const lines = content.split(/\r?\n/).slice(0, 50);
  let matches = 0;
  for (const line of lines) {
    if (WA_MSG_PATTERN.test(line.trim())) matches++;
  }
  return matches;
}

describe("WhatsApp Chat File Detection - Score Function", () => {
  it("should score a valid WhatsApp chat highly", () => {
    const chatContent = `13/05/2026 09:15 - As mensagens são protegidas com a criptografia
13/05/2026 09:15 - Maria Silva: Olá, bom dia!
13/05/2026 09:16 - CRC Dental: Bom dia Maria!
13/05/2026 09:17 - Maria Silva: Quanto custa?
13/05/2026 09:18 - CRC Dental: Depende do caso.`;
    
    const score = scoreWhatsAppContent(chatContent);
    expect(score).toBeGreaterThanOrEqual(4);
  });

  it("should score a non-WhatsApp text file as 0", () => {
    const randomContent = `Este é um arquivo de texto qualquer.
Não contém mensagens do WhatsApp.
Apenas texto normal sem timestamps.
Mais uma linha de texto.`;
    
    const score = scoreWhatsAppContent(randomContent);
    expect(score).toBe(0);
  });

  it("should score iOS format (brackets) correctly", () => {
    const iosChat = `[13/05/2026, 09:15:00] Maria Silva: Olá, bom dia!
[13/05/2026, 09:16:00] CRC Dental: Bom dia!
[13/05/2026, 09:17:00] Maria Silva: Tudo bem?`;
    
    const score = scoreWhatsAppContent(iosChat);
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it("should score 2-digit year format correctly", () => {
    const shortYearChat = `13/05/26, 09:15 - Maria: Olá!
13/05/26, 09:16 - João: Bom dia!
13/05/26, 09:17 - Maria: Tudo bem?`;
    
    const score = scoreWhatsAppContent(shortYearChat);
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it("should handle empty content", () => {
    const score = scoreWhatsAppContent("");
    expect(score).toBe(0);
  });

  it("should handle content with only whitespace", () => {
    const score = scoreWhatsAppContent("   \n  \n   ");
    expect(score).toBe(0);
  });

  it("should correctly choose WhatsApp file among multiple candidates", () => {
    const whatsappFile = `13/05/2026 09:15 - Maria: Olá!
13/05/2026 09:16 - João: Bom dia!
13/05/2026 09:17 - Maria: Tudo bem?
13/05/2026 09:18 - João: Tudo ótimo!`;
    
    const readmeFile = `# Instruções
Este arquivo contém instruções de uso.
Leia atentamente antes de prosseguir.`;
    
    const notesFile = `Notas da reunião
- Item 1: Discutir orçamento
- Item 2: Revisar cronograma`;
    
    const whatsappScore = scoreWhatsAppContent(whatsappFile);
    const readmeScore = scoreWhatsAppContent(readmeFile);
    const notesScore = scoreWhatsAppContent(notesFile);
    
    expect(whatsappScore).toBeGreaterThan(readmeScore);
    expect(whatsappScore).toBeGreaterThan(notesScore);
    expect(readmeScore).toBe(0);
    expect(notesScore).toBe(0);
  });

  it("should handle file named differently than _chat.txt", () => {
    // This tests the concept: the file name doesn't matter, content does
    const chatContent = `20/01/2026, 14:03 - Nome: mensagem de teste
20/01/2026, 14:04 - Outro: resposta aqui
20/01/2026, 14:05 - Nome: mais uma mensagem`;
    
    const score = scoreWhatsAppContent(chatContent);
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it("should handle mixed content with some WhatsApp lines", () => {
    const mixedContent = `Conversa exportada do WhatsApp
Exportado em 13/05/2026
---
13/05/2026 09:15 - Maria: Olá!
13/05/2026 09:16 - João: Bom dia!
Essa linha não é uma mensagem
13/05/2026 09:17 - Maria: Tudo bem?`;
    
    const score = scoreWhatsAppContent(mixedContent);
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it("should handle continuation lines (multi-line messages) without false positives", () => {
    const chatWithContinuation = `13/05/2026 09:15 - Maria: Olá!
Essa é uma continuação da mensagem anterior
que não começa com timestamp
13/05/2026 09:16 - João: Bom dia!
Também com continuação`;
    
    const score = scoreWhatsAppContent(chatWithContinuation);
    // Only the actual message lines should match, not continuations
    expect(score).toBe(2);
  });

  it("should handle different date separators", () => {
    // Comma separator
    const commaFormat = `13/05/2026, 09:15 - Maria: Olá!
13/05/2026, 09:16 - João: Bom dia!`;
    expect(scoreWhatsAppContent(commaFormat)).toBeGreaterThanOrEqual(2);
    
    // Space separator
    const spaceFormat = `13/05/2026 09:15 - Maria: Olá!
13/05/2026 09:16 - João: Bom dia!`;
    expect(scoreWhatsAppContent(spaceFormat)).toBeGreaterThanOrEqual(2);
  });
});
