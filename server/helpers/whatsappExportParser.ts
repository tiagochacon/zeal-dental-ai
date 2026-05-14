/**
 * WhatsApp Export Parser
 *
 * Parseia o _chat.txt exportado pelo WhatsApp e extrai mensagens estruturadas.
 * Suporta formatos comuns de data do WhatsApp em português brasileiro.
 */

export interface WhatsAppMessage {
  timestamp: string | null;
  sender: string | null;
  speakerRole: "lead" | "crc" | "system" | "unknown";
  text: string;
  mediaFileName: string | null;
  messageType: "text" | "audio" | "image" | "system" | "unknown";
}

export interface WhatsAppParseResult {
  messages: WhatsAppMessage[];
  participants: string[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  warnings: string[];
}

// Regex para linhas de mensagem do WhatsApp
// Formatos comuns:
// "20/01/2026, 14:03 - Nome: mensagem"
// "20/01/2026 14:03 - Nome: mensagem"
// "[20/01/2026, 14:03:45] Nome: mensagem"
const MESSAGE_LINE_REGEX =
  /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*-?\s*(.+?):\s(.+)$/;

// Regex para mensagens de sistema do WhatsApp
const SYSTEM_LINE_REGEX =
  /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*-?\s*(.+)$/;

// Padrões de anexos do WhatsApp
const MEDIA_PATTERNS = [
  /\u200e?<arquivo anexado>/i,
  /\u200e?<mídia oculta>/i,
  /\u200e?imagem omitida/i,
  /\u200e?áudio omitido/i,
  /\u200e?vídeo omitido/i,
  /\u200e?figurinha omitida/i,
  /\u200e?documento omitido/i,
  /\u200e?<media omitted>/i,
  /\u200e?<attached:\s*(.+?)>/i,
];

const AUDIO_EXTENSIONS = [".opus", ".ogg", ".m4a", ".mp3", ".wav", ".aac"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

// Padrões de mensagens de sistema do WhatsApp
const SYSTEM_PATTERNS = [
  /as mensagens.*são protegidas com a criptografia/i,
  /criou este grupo/i,
  /adicionou/i,
  /removeu/i,
  /saiu/i,
  /mudou o ícone/i,
  /mudou a descrição/i,
  /mudou o assunto/i,
  /messages.*end-to-end encrypted/i,
  /created this group/i,
  /added/i,
  /removed/i,
  /left/i,
  /changed the subject/i,
  /changed this group/i,
  /changed the group/i,
];

function isSystemMessage(text: string): boolean {
  return SYSTEM_PATTERNS.some((p) => p.test(text));
}

function detectMediaFile(text: string): { fileName: string | null; isAudio: boolean; isImage: boolean } {
  // Check for actual file names in the text
  const fileNameMatch = text.match(/([^\s<>]+\.(opus|ogg|m4a|mp3|wav|aac|jpg|jpeg|png|webp|gif|mp4|pdf|docx?))/i);
  if (fileNameMatch) {
    const fileName = fileNameMatch[1];
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
    return {
      fileName,
      isAudio: AUDIO_EXTENSIONS.includes(ext),
      isImage: IMAGE_EXTENSIONS.includes(ext),
    };
  }

  // Check for media patterns
  for (const pattern of MEDIA_PATTERNS) {
    if (pattern.test(text)) {
      const attachedMatch = text.match(/<attached:\s*(.+?)>/i);
      if (attachedMatch) {
        const fn = attachedMatch[1];
        const ext = fn.toLowerCase().slice(fn.lastIndexOf("."));
        return {
          fileName: fn,
          isAudio: AUDIO_EXTENSIONS.includes(ext),
          isImage: IMAGE_EXTENSIONS.includes(ext),
        };
      }
      // Generic media reference
      if (/áudio/i.test(text)) return { fileName: null, isAudio: true, isImage: false };
      if (/imagem|foto/i.test(text)) return { fileName: null, isAudio: false, isImage: true };
      return { fileName: null, isAudio: false, isImage: false };
    }
  }

  return { fileName: null, isAudio: false, isImage: false };
}

function inferSpeakerRole(
  sender: string,
  leadName: string | null,
  crcName: string | null
): "lead" | "crc" | "unknown" {
  if (!sender) return "unknown";
  const senderLower = sender.toLowerCase().trim();

  if (leadName) {
    const leadLower = leadName.toLowerCase().trim();
    // Check if sender contains lead name or vice versa
    if (senderLower.includes(leadLower) || leadLower.includes(senderLower)) {
      return "lead";
    }
    // Check first name match
    const leadFirst = leadLower.split(/\s+/)[0];
    const senderFirst = senderLower.split(/\s+/)[0];
    if (leadFirst && senderFirst && (leadFirst === senderFirst || senderLower.startsWith(leadFirst))) {
      return "lead";
    }
  }

  if (crcName) {
    const crcLower = crcName.toLowerCase().trim();
    if (senderLower.includes(crcLower) || crcLower.includes(senderLower)) {
      return "crc";
    }
    const crcFirst = crcLower.split(/\s+/)[0];
    const senderFirst = senderLower.split(/\s+/)[0];
    if (crcFirst && senderFirst && (crcFirst === senderFirst || senderLower.startsWith(crcFirst))) {
      return "crc";
    }
  }

  // Heuristic: if sender contains "clínica", "clinica", "zeal", "consultório" → crc
  if (/cl[íi]nica|zeal|consult[óo]rio|atendimento/i.test(senderLower)) {
    return "crc";
  }

  return "unknown";
}

/**
 * Parseia o conteúdo do _chat.txt exportado pelo WhatsApp.
 */
export function parseWhatsAppChat(
  chatContent: string,
  leadName: string | null = null,
  crcName: string | null = null
): WhatsAppParseResult {
  const lines = chatContent.split(/\r?\n/);
  const messages: WhatsAppMessage[] = [];
  const participantsSet = new Set<string>();
  const warnings: string[] = [];
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  let currentMessage: WhatsAppMessage | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Try to match a message line
    const msgMatch = line.match(MESSAGE_LINE_REGEX);
    if (msgMatch) {
      // Save previous message
      if (currentMessage) {
        messages.push(currentMessage);
      }

      const [, date, time, sender, text] = msgMatch;
      const timestamp = `${date} ${time}`;
      if (!firstTimestamp) firstTimestamp = timestamp;
      lastTimestamp = timestamp;

      participantsSet.add(sender.trim());

      const media = detectMediaFile(text);
      const speakerRole = inferSpeakerRole(sender, leadName, crcName);

      let messageType: WhatsAppMessage["messageType"] = "text";
      if (media.isAudio) messageType = "audio";
      else if (media.isImage) messageType = "image";

      currentMessage = {
        timestamp,
        sender: sender.trim(),
        speakerRole,
        text: text.trim(),
        mediaFileName: media.fileName,
        messageType,
      };
      continue;
    }

    // Try to match a system line
    const sysMatch = line.match(SYSTEM_LINE_REGEX);
    if (sysMatch && isSystemMessage(sysMatch[3])) {
      if (currentMessage) {
        messages.push(currentMessage);
        currentMessage = null;
      }

      const [, date, time, text] = sysMatch;
      const timestamp = `${date} ${time}`;
      if (!firstTimestamp) firstTimestamp = timestamp;
      lastTimestamp = timestamp;

      messages.push({
        timestamp,
        sender: null,
        speakerRole: "system",
        text: text.trim(),
        mediaFileName: null,
        messageType: "system",
      });
      continue;
    }

    // Continuation line (no timestamp) — append to current message
    if (currentMessage) {
      currentMessage.text += "\n" + line;
    }
  }

  // Push last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  // Heuristic: if we have exactly 2 participants and one is unknown, assign roles
  const participants = Array.from(participantsSet);
  if (participants.length === 2) {
    const roles = messages
      .filter((m) => m.speakerRole !== "system" && m.speakerRole !== "unknown")
      .map((m) => ({ sender: m.sender, role: m.speakerRole }));

    const knownSenders = new Map<string, "lead" | "crc">();
    for (const r of roles) {
      if (r.sender && !knownSenders.has(r.sender)) {
        knownSenders.set(r.sender, r.role as "lead" | "crc");
      }
    }

    // If only one sender is known, assign the other
    if (knownSenders.size === 1) {
      const entries = Array.from(knownSenders.entries());
      const [knownSender, knownRole] = entries[0];
      const otherSender = participants.find((p) => p !== knownSender);
      const otherRole = knownRole === "lead" ? "crc" : "lead";
      if (otherSender) {
        for (const msg of messages) {
          if (msg.sender === otherSender && msg.speakerRole === "unknown") {
            msg.speakerRole = otherRole;
          }
        }
      }
    }
  }

  if (messages.length === 0) {
    warnings.push("Nenhuma mensagem encontrada no arquivo de chat.");
  }

  return {
    messages,
    participants,
    dateRange: {
      start: firstTimestamp,
      end: lastTimestamp,
    },
    warnings,
  };
}

/**
 * Monta um transcript unificado a partir das mensagens parseadas e transcrições de áudio.
 */
export function buildUnifiedTranscript(
  parseResult: WhatsAppParseResult,
  audioTranscripts: Map<string, string> = new Map()
): string {
  const lines: string[] = [];

  lines.push("[WhatsApp Exportado]");
  if (parseResult.participants.length > 0) {
    lines.push(`Participantes: ${parseResult.participants.join(", ")}`);
  }
  if (parseResult.dateRange.start || parseResult.dateRange.end) {
    lines.push(`Período: ${parseResult.dateRange.start ?? "?"} a ${parseResult.dateRange.end ?? "?"}`);
  }
  lines.push("");

  for (const msg of parseResult.messages) {
    if (msg.messageType === "system") continue;

    const ts = msg.timestamp ? `[${msg.timestamp}]` : "";
    const role = msg.speakerRole === "lead" ? "Lead" : msg.speakerRole === "crc" ? "CRC" : msg.sender ?? "?";

    if (msg.messageType === "audio" && msg.mediaFileName) {
      const transcription = audioTranscripts.get(msg.mediaFileName);
      if (transcription) {
        lines.push(`${ts} ${role} (áudio transcrito: ${msg.mediaFileName}): ${transcription}`);
      } else {
        lines.push(`${ts} ${role}: [áudio: ${msg.mediaFileName}]`);
      }
    } else if (msg.messageType === "image") {
      lines.push(`${ts} ${role}: [imagem${msg.mediaFileName ? `: ${msg.mediaFileName}` : ""}]`);
    } else {
      // Clean up media reference patterns from text
      let cleanText = msg.text
        .replace(/\u200e/g, "")
        .replace(/<arquivo anexado>/gi, "")
        .replace(/<mídia oculta>/gi, "")
        .trim();
      if (cleanText) {
        lines.push(`${ts} ${role}: ${cleanText}`);
      }
    }
  }

  return lines.join("\n");
}
