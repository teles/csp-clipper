import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidUrl, fetchCspHeader, splitPolicies } from "../src/csp-fetcher";

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

describe("splitPolicies", () => {
  it("should return an empty list for a missing header", () => {
    expect(splitPolicies(null)).toEqual([]);
  });

  it("should split comma-separated policies and trim them", () => {
    expect(splitPolicies("default-src 'self' ,  img-src *")).toEqual(["default-src 'self'", "img-src *"]);
  });

  it("should drop empty entries", () => {
    expect(splitPolicies("default-src 'self',, ")).toEqual(["default-src 'self'"]);
  });
});

describe("fetchCspHeader policies", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should list each repeated CSP header as its own policy", async () => {
    const headers = new Headers();
    headers.append("content-security-policy", "default-src 'self'");
    headers.append("content-security-policy", "script-src 'none'");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { headers }));

    const result = await fetchCspHeader("https://example.com");
    expect(result.policies).toEqual([
      { policy: "default-src 'self'", reportOnly: false },
      { policy: "script-src 'none'", reportOnly: false },
    ]);
    expect(result.csp).toBe("default-src 'self'");
    expect(result.reportOnly).toBe(false);
  });

  it("should list enforced policies before report-only ones", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", {
        headers: { "content-security-policy-report-only": "default-src *", "content-security-policy": "default-src 'self'" },
      }),
    );

    const result = await fetchCspHeader("https://example.com");
    expect(result.policies).toEqual([
      { policy: "default-src 'self'", reportOnly: false },
      { policy: "default-src *", reportOnly: true },
    ]);
  });

  it("should flag a report-only policy when no enforced policy exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { headers: { "content-security-policy-report-only": "default-src 'self'" } }),
    );

    const result = await fetchCspHeader("https://example.com");
    expect(result.csp).toBe("default-src 'self'");
    expect(result.reportOnly).toBe(true);
  });

  it("should return no policies when no CSP header present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(""));

    const result = await fetchCspHeader("https://example.com");
    expect(result.policies).toEqual([]);
    expect(result.reportOnly).toBe(false);
  });
});
