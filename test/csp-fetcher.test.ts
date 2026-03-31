import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidUrl, fetchCspHeader } from "../src/csp-fetcher";

describe("isValidUrl", () => {
  it("should accept valid http URLs", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("should accept valid https URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });

  it("should accept URLs with paths", () => {
    expect(isValidUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("should reject ftp URLs", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });

  it("should reject javascript: URLs", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });

  it("should reject empty strings", () => {
    expect(isValidUrl("")).toBe(false);
  });

  it("should reject random text", () => {
    expect(isValidUrl("not a url")).toBe(false);
  });

  it("should reject relative paths", () => {
    expect(isValidUrl("/path/to/page")).toBe(false);
  });
});

describe("fetchCspHeader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return csp and title from HTML response", async () => {
    const mockCsp = "default-src 'self'";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html><head><title>My Site</title></head></html>", {
        headers: { "content-security-policy": mockCsp, "content-type": "text/html" },
      }),
    );

    const result = await fetchCspHeader("https://example.com");
    expect(result.csp).toBe(mockCsp);
    expect(result.title).toBe("My Site");
  });

  it("should return null title when content-type is not HTML", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("{}", {
        headers: { "content-security-policy": "default-src 'self'", "content-type": "application/json" },
      }),
    );

    const result = await fetchCspHeader("https://example.com");
    expect(result.title).toBeNull();
  });

  it("should return null title when no title tag exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html><head></head></html>", {
        headers: { "content-security-policy": "default-src 'self'", "content-type": "text/html" },
      }),
    );

    const result = await fetchCspHeader("https://example.com");
    expect(result.title).toBeNull();
  });

  it("should return null csp when no CSP header present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html><head><title>No CSP</title></head></html>", {
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await fetchCspHeader("https://example.com");
    expect(result.csp).toBeNull();
    expect(result.title).toBe("No CSP");
  });

  it("should prefer CSP over CSP-Report-Only", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", {
        headers: { "content-security-policy": "default-src 'self'", "content-security-policy-report-only": "default-src *" },
      }),
    );

    const result = await fetchCspHeader("https://example.com");
    expect(result.csp).toBe("default-src 'self'");
  });
});
