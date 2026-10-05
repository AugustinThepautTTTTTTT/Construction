import test from "node:test";
import assert from "node:assert/strict";
import { readChatStream, splitParagraphs } from "../lib/chat-stream";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ChatMessage } from "../components/chat-message";

test("paragraphs are emitted only when complete, keeping the unfinished paragraph", () => {
  const first = splitParagraphs("## Layout\n\nKeep the kitchen");
  assert.deepEqual(first.paragraphs, ["## Layout\n\n"]);
  const next = splitParagraphs(
    first.remainder + " cabinets.\n\nAdd warmer lighting.",
  );
  assert.deepEqual(next.paragraphs, ["Keep the kitchen cabinets.\n\n"]);
  assert.equal(next.remainder, "Add warmer lighting.");
});
test("stream reader handles arbitrary network fragments, Unicode, and status events", async () => {
  const payload = new TextEncoder().encode(
    JSON.stringify({ type: "status", message: "Reviewing…" }) +
      "\n" +
      JSON.stringify({ type: "paragraph", text: "A café kitchen.\n\n" }) +
      "\n" +
      JSON.stringify({ type: "done" }) +
      "\n",
  );
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < payload.length; i += 2)
        c.enqueue(payload.slice(i, i + 2));
      c.close();
    },
  });
  const events: unknown[] = [];
  await readChatStream(new Response(stream), (event) => events.push(event));
  assert.deepEqual(events, [
    { type: "status", message: "Reviewing…" },
    { type: "paragraph", text: "A café kitchen.\n\n" },
    { type: "done" },
  ]);
});
test("interrupted streams and server errors cannot be mistaken for completed replies", async () => {
  await assert.rejects(
    readChatStream(
      new Response('{"type":"paragraph","text":"partial"}\n'),
      () => {},
    ),
    /interrupted/,
  );
  await assert.rejects(
    readChatStream(
      new Response('{"type":"error","message":"Retry later"}\n'),
      () => {},
    ),
    /Retry later/,
  );
  await assert.rejects(
    readChatStream(
      new Response('{"error":"Sign in"}', { status: 401 }),
      () => {},
    ),
    /Sign in/,
  );
});
test("assistant replies render headings and lists without executing raw HTML or unsafe links", () => {
  const html = renderToStaticMarkup(
    createElement(ChatMessage, {
      message: {
        role: "assistant",
        content:
          "## Your room\n\n**Warm** lighting\n\n- Paint\n- Storage\n\n<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)",
      },
    }),
  );
  assert.match(html, /<h2>Your room<\/h2>/);
  assert.match(html, /<strong>Warm<\/strong>/);
  assert.match(html, /<li>Paint<\/li>/);
  assert.doesNotMatch(html, /<script|javascript:|## Your room/);
});
