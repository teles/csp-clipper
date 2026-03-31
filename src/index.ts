import { RateLimiter } from "./rate-limiter";
import { fetchCspHeader, isValidUrl } from "./csp-fetcher";

const rateLimiter = new RateLimiter(30, 60_000);

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

const ALLOWED_ORIGIN = "https://visual-csp.pages.dev";

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function jsonResponse(request: Request, body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request),
      ...extra,
    },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== "GET") {
      return jsonResponse(request, { error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);

    if (url.pathname !== "/csp") {
      return jsonResponse(request, { error: "Not found. Use GET /csp?url=<target>" }, 404);
    }

    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return jsonResponse(request, { error: "Missing required query parameter: url" }, 400);
    }

    if (!isValidUrl(targetUrl)) {
      return jsonResponse(request, { error: "Invalid URL. Must be an absolute HTTP or HTTPS URL." }, 400);
    }

    const clientIp = getClientIp(request);
    const { allowed, remaining, resetAt } = rateLimiter.isAllowed(clientIp);

    const rateLimitHeaders: Record<string, string> = {
      "X-RateLimit-Limit": "30",
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
    };

    if (!allowed) {
      return jsonResponse(
        request,
        { error: "Rate limit exceeded. Try again later." },
        429,
        { ...rateLimitHeaders, "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
      );
    }

    try {
      const csp = await fetchCspHeader(targetUrl);

      if (!csp) {
        return jsonResponse(request, { url: targetUrl, csp: null, message: "No CSP header found" }, 200, rateLimitHeaders);
      }

      return jsonResponse(request, { url: targetUrl, csp }, 200, rateLimitHeaders);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return jsonResponse(request, { error: `Failed to fetch URL: ${message}` }, 502, rateLimitHeaders);
    }
  },
} satisfies ExportedHandler;
