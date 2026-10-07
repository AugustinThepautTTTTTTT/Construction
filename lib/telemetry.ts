export function sanitizedTrackingUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.search = ""; url.hash = "";
    url.pathname = url.pathname.replace(/\/(projects|artifacts|photos)\/[^/]+/g, "/$1/[id]");
    return url.toString();
  } catch { return null; }
}
