import { z } from "zod";

function resolveServerEnv() {
  const authUrl =
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  return {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: directUrl,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: authUrl,
    NODE_ENV: process.env.NODE_ENV,
  };
}

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
    AUTH_URL: z.string().url().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (data.AUTH_SECRET.length < 32) {
        ctx.addIssue({
          code: "custom",
          message: "AUTH_SECRET must be at least 32 characters in production",
          path: ["AUTH_SECRET"],
        });
      }
      if (!data.AUTH_URL) {
        ctx.addIssue({
          code: "custom",
          message:
            "AUTH_URL is required in production (set AUTH_URL or deploy on Vercel with VERCEL_URL)",
          path: ["AUTH_URL"],
        });
      }
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function validateEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(resolveServerEnv());
  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    console.error("Invalid environment variables:", formatted);
    throw new Error("Invalid environment variables. Check server logs for details.");
  }

  cached = parsed.data;
  return cached;
}

export function getEnv(): ServerEnv {
  return validateEnv();
}
