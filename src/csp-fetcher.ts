export async function fetchCspHeader(url: string): Promise<string | null> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "csp-clipper/1.0",
    },
    redirect: "follow",
  });

  const csp =
    response.headers.get("content-security-policy") ||
    response.headers.get("content-security-policy-report-only");

  return csp;
}

export function isValidUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
