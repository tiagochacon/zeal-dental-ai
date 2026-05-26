import { createHash } from "crypto";
import type { IncomingMessage } from "http";
import type { Server as HttpServer } from "http";
import type { Duplex } from "stream";
import { ENV } from "../_core/env";
import { getConsultationStreamingStatus } from "../helpers/consultationStreamingAvailability";
import { sdk } from "../_core/sdk";
import { getConsultationById, getUserById } from "../db";
import { ConsultationStreamingSession } from "../ai/stt/streaming/consultationStreamingSession";
import type { StreamingTranscriptEvent } from "../ai/stt/streaming/types";

type DecodedFrame = {
  opcode: number;
  payload: Buffer<ArrayBufferLike>;
};

function wsAcceptKey(key: string): string {
  return createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, "binary")
    .digest("base64");
}

function encodeWsFrame(opcode: number, payload: Buffer): Buffer {
  const first = 0x80 | (opcode & 0x0f);
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([first, payload.length]), payload]);
  }
  if (payload.length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = first;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = first;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

function decodeWsFrames(buffer: Buffer<ArrayBufferLike>): {
  frames: DecodedFrame[];
  remaining: Buffer<ArrayBufferLike>;
} {
  const frames: DecodedFrame[] = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const byte1 = buffer[offset];
    const byte2 = buffer[offset + 1];
    const opcode = byte1 & 0x0f;
    const masked = (byte2 & 0x80) !== 0;
    let length = byte2 & 0x7f;
    let headerSize = 2;

    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerSize = 4;
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break;
      const longLength = Number(buffer.readBigUInt64BE(offset + 2));
      if (!Number.isFinite(longLength)) break;
      length = longLength;
      headerSize = 10;
    }

    const maskSize = masked ? 4 : 0;
    const frameSize = headerSize + maskSize + length;
    if (offset + frameSize > buffer.length) break;

    let payload = buffer.subarray(
      offset + headerSize + maskSize,
      offset + frameSize
    );

    if (masked) {
      const maskingKey = buffer.subarray(offset + headerSize, offset + headerSize + 4);
      const unmasked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i++) {
        unmasked[i] = payload[i] ^ maskingKey[i % 4];
      }
      payload = unmasked;
    }

    frames.push({ opcode, payload });
    offset += frameSize;
  }

  return { frames, remaining: buffer.subarray(offset) };
}

function sendJson(socket: Duplex, payload: StreamingTranscriptEvent): void {
  const frame = encodeWsFrame(0x1, Buffer.from(JSON.stringify(payload), "utf-8"));
  socket.write(frame);
}

function sendClose(socket: Duplex): void {
  socket.write(encodeWsFrame(0x8, Buffer.alloc(0)));
  socket.end();
}

async function canAccessConsultation(
  userId: number,
  consultationId: number
): Promise<boolean> {
  const [user, consultation] = await Promise.all([
    getUserById(userId),
    getConsultationById(consultationId),
  ]);
  if (!user || !consultation) return false;
  if (consultation.dentistId === user.id) return true;
  if (
    user.clinicId &&
    (user.clinicRole === "gestor" || user.role === "admin")
  ) {
    const dentist = await getUserById(consultation.dentistId);
    if (dentist && dentist.clinicId === user.clinicId) return true;
  }
  return false;
}

async function authenticateUpgrade(req: IncomingMessage): Promise<{ id: number }> {
  const user = await sdk.authenticateRequest(req as any);
  return { id: user.id };
}

function parseConsultationId(pathname: string): number | null {
  const match = pathname.match(
    /^\/api\/consultations\/(\d+)\/stream-transcription\/?$/
  );
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function registerConsultationStreamingWs(server: HttpServer): void {
  server.on("upgrade", async (req, socket) => {
    try {
      const pathname = new URL(
        req.url || "/",
        `http://${req.headers.host || "localhost"}`
      ).pathname;
      const consultationId = parseConsultationId(pathname);
      if (!consultationId) return;

      if (!ENV.consultationStreamingAsrEnabled) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      const streamingStatus = getConsultationStreamingStatus();
      if (!streamingStatus.ready) {
        socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
        socket.destroy();
        return;
      }

      const key = req.headers["sec-websocket-key"];
      if (!key || Array.isArray(key)) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      const user = await authenticateUpgrade(req);
      const hasAccess = await canAccessConsultation(user.id, consultationId);
      if (!hasAccess) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      const acceptKey = wsAcceptKey(key);
      const responseHeaders = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${acceptKey}`,
        "\r\n",
      ];
      socket.write(responseHeaders.join("\r\n"));

      const provider =
        (ENV.consultationStreamingAsrProvider || "assemblyai") as
          | "assemblyai"
          | "deepgram"
          | "openai";

      const session = new ConsultationStreamingSession({
        consultationId,
        provider,
        sendToClient: (event) => sendJson(socket, event),
      });

      let started = false;
      let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

      socket.on("data", async (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const decoded = decodeWsFrames(buffer);
        buffer = decoded.remaining;

        for (const frame of decoded.frames) {
          if (frame.opcode === 0x8) {
            session.close();
            sendClose(socket);
            return;
          }
          if (frame.opcode === 0x9) {
            socket.write(encodeWsFrame(0xA, frame.payload));
            continue;
          }
          if (frame.opcode === 0x2) {
            if (!started) continue;
            session.sendAudio(Buffer.from(frame.payload));
            continue;
          }
          if (frame.opcode !== 0x1) continue;

          try {
            const message = JSON.parse(frame.payload.toString("utf-8")) as {
              type?: string;
            };

            if (message.type === "start" && !started) {
              try {
                await session.start();
                started = true;
              } catch (error) {
                const details =
                  error instanceof Error
                    ? error.message
                    : "Falha ao iniciar sessão de streaming";
                sendJson(socket, {
                  type: "error",
                  sessionId: "unknown",
                  consultationId,
                  error: details,
                  provider,
                  createdAt: new Date().toISOString(),
                });
                sendClose(socket);
              }
              continue;
            }

            if (
              message.type === "stop" ||
              message.type === "client_stop_requested" ||
              message.type === "client_final_flush"
            ) {
              session.stop();
              continue;
            }

            if (message.type === "close") {
              session.close();
              sendClose(socket);
              return;
            }
          } catch {
            sendJson(socket, {
              type: "error",
              sessionId: "unknown",
              consultationId,
              error: "Mensagem inválida no socket",
              createdAt: new Date().toISOString(),
            });
          }
        }
      });

      socket.on("error", () => {
        session.close();
      });

      socket.on("close", () => {
        session.close();
      });
    } catch (error) {
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
    }
  });
}
