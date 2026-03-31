import { describe, it, expect } from "vitest";
import { isValidUrl } from "../src/csp-fetcher";

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
