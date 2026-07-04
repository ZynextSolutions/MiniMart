import { NextResponse } from "next/server";
import { requirePlatformSession } from "@/platform/auth/platform-session";
import { enforceApiRateLimit } from "@/lib/rate-limit";
import { apiErrorResponse } from "@/lib/auth/api-error-response";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "POS Platform API",
    version: "1.0.0",
    description: "REST API for mobile and external integrations",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/health": { get: { summary: "Health check", responses: { "200": { description: "OK" } } } },
    "/products/search": {
      get: {
        summary: "Search products",
        parameters: [{ name: "q", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Product list" } },
      },
    },
    "/customers": {
      get: {
        summary: "List customers",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated customers" } },
      },
    },
    "/sales": {
      get: {
        summary: "List sales",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "branchId", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: { "200": { description: "Paginated sales" } },
      },
    },
    "/branches": { get: { summary: "List branches", responses: { "200": { description: "Branches" } } } },
  },
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "authjs.session-token" },
    },
  },
  security: [{ sessionCookie: [] }],
};

export async function GET(request: Request) {
  try {
    await enforceApiRateLimit(request, "openapi", 30);

    if (process.env.OPENAPI_ENABLED === "false") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (process.env.NODE_ENV === "production") {
      await requirePlatformSession();
    }

    return NextResponse.json(spec);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
