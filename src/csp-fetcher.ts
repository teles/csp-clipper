export interface FetchCspResult {
  csp: string | null;
  title: string | null;
}

export async function fetchCspHeader(url: string): Promise<FetchCspResult> {
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

  let title: string | null = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const body = await response.text();
    const match = body.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    if (match) {
      title = match[1].trim();
    }
  }

  return { csp, title };
}

export function isValidUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
