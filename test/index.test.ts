import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/index";

const ALLOWED_ORIGIN = "https://visual-csp.pages.dev";

function makeRequest(url: string, method = "GET", headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method,
    headers: { "cf-connecting-ip": "1.2.3.4", "Origin": ALLOWED_ORIGIN, ...headers },
  });
}

describe("Worker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 204 for OPTIONS requests with allowed origin", async () => {
    const req = makeRequest("https://worker.dev/csp?url=https://example.com", "OPTIONS");
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
  });

  it("should return 405 for POST requests", async () => {
    const req = makeRequest("https://worker.dev/csp", "POST");
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.status).toBe(405);
    const body = await res.json() as any;
    expect(body.error).toContain("Method not allowed");
  });

  it("should return 404 for unknown paths", async () => {
    const req = makeRequest("https://worker.dev/unknown");
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.status).toBe(404);
  });

  it("should return 400 when url param is missing", async () => {
    const req = makeRequest("https://worker.dev/csp");
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("Missing required query parameter");
  });

  it("should return 400 for invalid URLs", async () => {
    const req = makeRequest("https://worker.dev/csp?url=not-a-url");
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("Invalid URL");
  });

  it("should return CSP header when present", async () => {
    const mockCsp = "default-src 'self'; script-src 'none'";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html><head><title>Example Site</title></head></html>", {
        headers: { "content-security-policy": mockCsp, "content-type": "text/html" },
      }),
    );

    const req = makeRequest("https://worker.dev/csp?url=https://example.com");
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.csp).toBe(mockCsp);
    expect(body.url).toBe("https://example.com");
    expect(body.title).toBe("Example Site");
  });

  it("should return CSP-Report-Only header when CSP is absent", async () => {
    const mockCsp = "default-src 'self'";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", {
        headers: { "content-security-policy-report-only": mockCsp },
      }),
    );

    const req = makeRequest("https://worker.dev/csp?url=https://example.com");
    const res = await worker.fetch(req, {} as any, {} as any);
    const body = await res.json() as any;
    expect(body.csp).toBe(mockCsp);
  });

  it("should return null title when response is not HTML", async () => {
    const mockCsp = "default-src 'self'";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", {
        headers: { "content-security-policy": mockCsp, "content-type": "application/json" },
      }),
    );

    const req = makeRequest("https://worker.dev/csp?url=https://example.com");
    const res = await worker.fetch(req, {} as any, {} as any);
    const body = await res.json() as any;
    expect(body.title).toBeNull();
  });

  it("should return null csp when no CSP header exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(""));

    const req = makeRequest("https://worker.dev/csp?url=https://example.com");
    const res = await worker.fetch(req, {} as any, {} as any);
    const body = await res.json() as any;
    expect(body.csp).toBeNull();
    expect(body.message).toContain("No CSP header found");
  });

  it("should return 502 when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

    const req = makeRequest("https://worker.dev/csp?url=https://example.com");
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.status).toBe(502);
    const body = await res.json() as any;
    expect(body.error).toContain("Connection refused");
  });

  it("should include rate limit headers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(""));

    const req = makeRequest("https://worker.dev/csp?url=https://example.com");
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("30");
    expect(res.headers.has("X-RateLimit-Remaining")).toBe(true);
    expect(res.headers.has("X-RateLimit-Reset")).toBe(true);
  });

  it("should include CORS headers with allowed origin", async () => {
    const req = makeRequest("https://worker.dev/csp");
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
  });

  it("should reject CORS for disallowed origins", async () => {
    const req = new Request("https://worker.dev/csp?url=https://example.com", {
      headers: { "cf-connecting-ip": "1.2.3.4", "Origin": "https://evil.com" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(""));
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("");
  });

  it("should return empty CORS origin when no Origin header", async () => {
    const req = new Request("https://worker.dev/csp?url=https://example.com", {
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(""));
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("");
  });

  it("should use x-forwarded-for when cf-connecting-ip is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(""));

    const req = new Request("https://worker.dev/csp?url=https://example.com", {
      headers: { "x-forwarded-for": "5.6.7.8, 10.0.0.1" },
    });
    const res = await worker.fetch(req, {} as any, {} as any);
    expect(res.status).toBe(200);
  });
});
