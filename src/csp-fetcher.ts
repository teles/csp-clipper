export interface FetchedPolicy {
  policy: string;
  /** True when it came from Content-Security-Policy-Report-Only (monitored, not enforced). */
  reportOnly: boolean;
}

export interface FetchCspResult {
  /** First policy found, kept for clients that only read a single string. */
  csp: string | null;
  /** Whether `csp` came from the report-only header. */
  reportOnly: boolean;
  /** Every policy the site sends, enforced ones first. */
  policies: FetchedPolicy[];
  title: string | null;
}

/**
 * Split a CSP header value into its policies. Repeated headers are joined with
 * commas by Headers.get(), and a single header may also list several policies.
 */
export function splitPolicies(headerValue: string | null): string[] {
  if (!headerValue) return [];
  return headerValue
    .split(",")
    .map((policy) => policy.trim())
    .filter((policy) => policy.length > 0);
}

export async function fetchCspHeader(url: string): Promise<FetchCspResult> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "csp-clipper/1.0",
    },
    redirect: "follow",
  });

  const policies: FetchedPolicy[] = [
    ...splitPolicies(response.headers.get("content-security-policy")).map((policy) => ({ policy, reportOnly: false })),
    ...splitPolicies(response.headers.get("content-security-policy-report-only")).map((policy) => ({ policy, reportOnly: true })),
  ];

  let title: string | null = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const body = await response.text();
    const match = body.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    if (match) {
      title = match[1].trim();
    }
  }

  return {
    csp: policies[0]?.policy ?? null,
    reportOnly: policies[0]?.reportOnly ?? false,
    policies,
    title,
  };
}

export function isValidUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
