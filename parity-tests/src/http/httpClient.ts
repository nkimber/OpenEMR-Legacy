import http from "node:http";
import https from "node:https";

export type HttpTextResponse = {
  statusCode: number | null;
  headers: http.IncomingHttpHeaders;
  body: string;
  finalUrl: string;
  cookies: string[];
};

export async function requestText(
  url: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    allowSelfSigned?: boolean;
    followRedirects?: boolean;
    maxRedirects?: number;
    cookies?: string[];
  } = {}
): Promise<HttpTextResponse> {
  return await new Promise<HttpTextResponse>((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const cookies = options.cookies ?? [];
    const headers = {
      ...options.headers,
      ...(cookies.length ? { Cookie: cookies.join("; ") } : {})
    };
    const request = client.request(
      parsed,
      {
        method: options.method ?? "GET",
        headers,
        rejectUnauthorized: options.allowSelfSigned === true ? false : undefined,
        timeout: 15_000
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          const statusCode = response.statusCode ?? null;
          const setCookies = normalizeSetCookie(response.headers["set-cookie"]);
          const nextCookies = mergeCookies(cookies, setCookies);
          if (options.followRedirects && isRedirect(statusCode) && response.headers.location && (options.maxRedirects ?? 5) > 0) {
            const nextUrl = new URL(response.headers.location, parsed).toString();
            requestText(nextUrl, {
              ...options,
              method: "GET",
              body: undefined,
              headers: removeBodyHeaders(options.headers),
              cookies: nextCookies,
              maxRedirects: (options.maxRedirects ?? 5) - 1
            })
              .then(resolve)
              .catch(reject);
            return;
          }
          resolve({
            statusCode,
            headers: response.headers,
            body,
            finalUrl: url,
            cookies: nextCookies
          });
        });
      }
    );
    request.on("timeout", () => {
      request.destroy(new Error(`Request timed out: ${url}`));
    });
    request.on("error", reject);
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

export function isSuccessStatus(statusCode: number | null) {
  return statusCode !== null && statusCode >= 200 && statusCode < 400;
}

function isRedirect(statusCode: number | null) {
  return statusCode !== null && statusCode >= 300 && statusCode < 400;
}

function normalizeSetCookie(value: string[] | string | undefined) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function mergeCookies(existing: string[], setCookies: string[]) {
  const map = new Map<string, string>();
  for (const cookie of existing) {
    const [name] = cookie.split("=", 1);
    if (name) {
      map.set(name, cookie);
    }
  }
  for (const cookie of setCookies) {
    const pair = cookie.split(";", 1)[0];
    const [name] = pair.split("=", 1);
    if (name && pair) {
      map.set(name, pair);
    }
  }
  return [...map.values()];
}

function removeBodyHeaders(headers: Record<string, string> | undefined) {
  if (!headers) {
    return undefined;
  }
  const next = { ...headers };
  delete next["Content-Type"];
  delete next["Content-Length"];
  return next;
}
