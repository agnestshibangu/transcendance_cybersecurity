export type Env = Readonly<{
  port: number;
  authServiceUrl: string;
  dbWriterUrl: string;
  frontendUrl?: string;
}>;

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env var: ${name}`);
  return v.trim();
}

function getPort(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 65535) {
    throw new Error(`Invalid port in ${name}: "${raw}"`);
  }
  return n;
}

export function loadEnv(): Env {
  return {
    port: getPort("API_GATEWAY_PORT", 8080),

    authServiceUrl: mustGet("AUTH_SERVICE_URL"),
    dbWriterUrl: mustGet("DBWRITER_URL"),

    frontendUrl: process.env.FRONTEND_URL?.trim(),
  };
}
