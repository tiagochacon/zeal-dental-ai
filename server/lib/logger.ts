/**
 * Structured Logger
 *
 * Provides consistent, JSON-structured logging across the application.
 * Replaces ad-hoc console.log/warn/error calls with contextual, level-aware logging.
 *
 * Output format (production): JSON lines
 * Output format (development): human-readable with color
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function formatDev(entry: LogEntry): string {
  const { level, module, message, timestamp, ...extra } = entry;
  const prefix = `[${timestamp.slice(11, 19)}] [${level.toUpperCase().padEnd(5)}] [${module}]`;
  const extraStr = Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : "";
  return `${prefix} ${message}${extraStr}`;
}

function emit(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return;

  if (IS_PRODUCTION) {
    const output = JSON.stringify(entry);
    if (entry.level === "error") {
      process.stderr.write(output + "\n");
    } else {
      process.stdout.write(output + "\n");
    }
  } else {
    const formatted = formatDev(entry);
    switch (entry.level) {
      case "error":
        console.error(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(childModule: string): Logger;
}

export function createLogger(module: string): Logger {
  function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    emit({
      level,
      module,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  return {
    debug: (msg, meta) => log("debug", msg, meta),
    info: (msg, meta) => log("info", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    error: (msg, meta) => log("error", msg, meta),
    child: (childModule: string) => createLogger(`${module}:${childModule}`),
  };
}

/** Root logger for quick imports */
export const logger = createLogger("app");
