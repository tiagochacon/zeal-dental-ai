/**
 * Validates and retrieves a required environment variable
 * @param key - The environment variable key
 * @param defaultValue - Optional default value (makes the var optional)
 * @throws {Error} If required variable is missing or empty
 * @returns The environment variable value
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  
  if (defaultValue !== undefined) {
    return value || defaultValue;
  }
  
  if (!value || value.trim() === "") {
    throw new Error(
      `❌ Missing required environment variable: ${key}\n` +
      `Please set ${key} in your .env file or environment`
    );
  }
  
  return value.trim();
}

// Validate all environment variables on startup
export const ENV = {
  appId: getEnvVar("VITE_APP_ID"),
  cookieSecret: getEnvVar("JWT_SECRET"),
  // Supabase (replaces DATABASE_URL)
  supabaseUrl: getEnvVar("SUPABASE_URL", ""),
  supabaseAnonKey: getEnvVar("SUPABASE_ANON_KEY", ""),
  // OAuth (kept for backward compatibility, but not used with email/password auth)
  oAuthServerUrl: getEnvVar("OAUTH_SERVER_URL", ""),
  ownerOpenId: getEnvVar("OWNER_OPEN_ID", ""),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: getEnvVar("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: getEnvVar("BUILT_IN_FORGE_API_KEY"),
  resendApiKey: getEnvVar("RESEND_API_KEY", ""),
} as const;
