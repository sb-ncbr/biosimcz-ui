import "server-only";
import { getEnv } from "../config/env";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE_KEY = /password|token|secret|session|cookie|authorization|csrf|refresh/i;
const MAX_DEPTH = 6;

const redact = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) return "[depth]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : redact(child, depth + 1)]),
    );
  }
  return value;
};

const threshold = (): number => {
  try {
    return ORDER[getEnv().logLevel];
  } catch {
    return ORDER.info;
  }
};

const write = (level: Level, message: string, context?: Record<string, unknown>): void => {
  if (ORDER[level] < threshold()) return;
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...(context ? (redact(context) as object) : {}) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),
};

export { logger, redact };
