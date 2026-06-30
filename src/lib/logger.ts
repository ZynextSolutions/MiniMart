type LogMeta = Record<string, unknown>;

function serializeError(error: unknown): LogMeta | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { value: String(error) };
}

function write(level: "info" | "warn" | "error", message: string, meta?: LogMeta) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    write("info", message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    write("warn", message, meta);
  },
  error(message: string, error?: unknown, meta?: LogMeta) {
    write("error", message, {
      ...meta,
      error: serializeError(error),
    });
  },
};
