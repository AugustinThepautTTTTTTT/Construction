import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";
export function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  return isIP(address) === 6 && /^2[0-9a-f]{3}:/i.test(address);
}
export function imageUrl(value: string, page: string) {
  try {
    const u = new URL(value.replace(/&amp;/g, "&"), page);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      !isIP(u.hostname) &&
      !/(^|\.)localhost$|\.local$/i.test(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function productImage(html: string, page: string) {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const a of tag[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g))
      attrs[a[1].toLowerCase()] = a[2];
    if (
      /^(og:image(?::secure_url)?|twitter:image)$/i.test(
        attrs.property || attrs.name || "",
      )
    ) {
      const url = imageUrl(attrs.content || "", page);
      if (url) return url;
    }
  }
  for (const script of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const walk = (v: any): string | null => {
        if (Array.isArray(v)) {
          for (const item of v) {
            const r = walk(item);
            if (r) return r;
          }
        } else if (v && typeof v === "object") {
          if ([v["@type"]].flat().includes("Product")) {
            const first = Array.isArray(v.image) ? v.image[0] : v.image;
            return imageUrl(
              typeof first === "string" ? first : first?.url || "",
              page,
            );
          }
          return walk(v["@graph"]);
        }
        return null;
      };
      const url = walk(JSON.parse(script[1]));
      if (url) return url;
    } catch {}
  }
  return null;
}
// Pin a validated public DNS address for the TLS connection, and validate every
// redirect. Only metadata from the verified product page is used; no AI search.
export async function fetchProductImage(
  page: string,
  redirects = 0,
): Promise<string | null> {
  try {
    const u = new URL(page);
    if (!imageUrl(page, page)) return null;
    const addresses = await lookup(u.hostname, { all: true });
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      return null;
    const address = addresses[0];
    const result = await new Promise<{ html?: string; redirect?: string }>(
      (resolve, reject) => {
        const req = https.get(
          u,
          {
            lookup: ((_host: any, _options: any, cb: any) => {
              if (_options.all) cb(null, [address]);
              else cb(null, address.address, address.family);
            }) as any,
            headers: {
              "User-Agent": "Archicova/1.0 product preview",
              Accept: "text/html",
            },
          },
          (res) => {
            if (
              res.statusCode &&
              res.statusCode >= 300 &&
              res.statusCode < 400
            ) {
              res.resume();
              resolve({ redirect: res.headers.location });
              return;
            }
            if (
              res.statusCode !== 200 ||
              !res.headers["content-type"]?.includes("text/html")
            ) {
              res.resume();
              resolve({});
              return;
            }
            const chunks: Buffer[] = [];
            let bytes = 0;
            res.on("data", (chunk: Buffer) => {
              bytes += chunk.length;
              if (bytes > 512000) {
                res.destroy();
                resolve({});
              } else chunks.push(chunk);
            });
            res.on("end", () =>
              resolve({ html: Buffer.concat(chunks).toString("utf8") }),
            );
            res.on("error", reject);
          },
        );
        const deadline = setTimeout(
          () => req.destroy(new Error("timeout")),
          5000,
        );
        req.on("close", () => clearTimeout(deadline));
        req.setTimeout(5000, () => req.destroy(new Error("timeout")));
        req.on("error", reject);
      },
    );
    if (result.redirect && redirects < 2)
      return fetchProductImage(new URL(result.redirect, u).href, redirects + 1);
    return result.html ? productImage(result.html, u.href) : null;
  } catch {
    return null;
  }
}
