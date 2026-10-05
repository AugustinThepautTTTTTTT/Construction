export type ChatEvent =
  | { type: "status"; message: string }
  | { type: "paragraph"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
export function splitParagraphs(text: string) {
  const parts = text.split(/\n\s*\n/);
  return {
    paragraphs: parts.slice(0, -1).map((p) => p + "\n\n"),
    remainder: parts.at(-1) || "",
  };
}
export async function readChatStream(
  response: Response,
  onEvent: (event: ChatEvent) => void,
) {
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Could not start the planner.");
  }
  if (!response.body)
    throw new Error("Streaming is unavailable. Please refresh.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    complete = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line) continue;
        const event = JSON.parse(line) as ChatEvent;
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "done") complete = true;
        onEvent(event);
      }
      if (done) break;
    }
    if (!complete)
      throw new Error(
        "The connection was interrupted. Refresh to view your saved reply.",
      );
  } finally {
    reader.releaseLock();
  }
}
