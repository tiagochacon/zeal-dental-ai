/**
 * Server configuration constants
 * Centralized constants to avoid magic numbers and strings
 */

export const SERVER_CONFIG = {
  /** Maximum size for JSON/URL-encoded request bodies */
  MAX_UPLOAD_SIZE: "10mb",
  
  /** Number of ports to scan when finding available port */
  PORT_SCAN_RANGE: 20,
  
  /** Default port for the server */
  DEFAULT_PORT: 3000,
  
  /** Port environment variable key */
  PORT_ENV_KEY: "PORT",
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const RATE_LIMIT_CONFIG = {
  /** General API rate limit window (15 minutes in ms) */
  GENERAL_WINDOW_MS: 15 * 60 * 1000,
  
  /** Maximum requests per window for general API */
  GENERAL_MAX_REQUESTS: 100,
  
  /** Auth endpoints rate limit window (15 minutes in ms) */
  AUTH_WINDOW_MS: 15 * 60 * 1000,
  
  /** Maximum auth attempts per window */
  AUTH_MAX_ATTEMPTS: 5,
} as const;

export const ERROR_MESSAGES = {
  PATIENT_NOT_FOUND: "Paciente não encontrado",
  ACCESS_DENIED: "Acesso negado",
  CONSULTATION_NOT_FOUND: "Consulta não encontrada",
  INVALID_INPUT: "Dados de entrada inválidos",
  AUTHENTICATION_REQUIRED: "Autenticação necessária",
  INTERNAL_ERROR: "Erro interno do servidor",
  RATE_LIMIT_EXCEEDED: "Muitas requisições. Tente novamente mais tarde",
} as const;

export const LOG_PREFIXES = {
  DATABASE: "[Database]",
  OAUTH: "[OAuth]",
  SERVER: "[Server]",
  SECURITY: "[Security]",
} as const;

