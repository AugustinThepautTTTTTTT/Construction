"use client";
import { useEffect, useState, type RefObject } from "react";
import { Button } from "@base-ui-components/react/button";
import type { Message } from "@/lib/domain";
export function ThreadManager({
  messages,
  chatId,
  scroll,
}: {
  messages: Message[];
  chatId: string;
  scroll: RefObject<HTMLDivElement | null>;
}) {
  const turns = messages
      .map((message, index) => ({ message, index }))
      .filter((t) => t.message.role === "user"),
    [active, setActive] = useState(0);
  useEffect(() => {
    const root = scroll.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let current = 0;
        for (const turn of turns) {
          const el = document.getElementById(`turn-${chatId}-${turn.index}`);
          if (
            el &&
            el.getBoundingClientRect().top <=
              root.getBoundingClientRect().top + root.clientHeight * 0.4
          )
            current = turn.index;
        }
        setActive(current);
      });
    };
    root.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("scroll", update);
    };
  }, [chatId, messages.length, scroll]);
  return (
    <nav className="threadManager" aria-label="Conversation turns">
      {turns.map((turn) => (
        <Button
          key={turn.index}
          aria-label={`Jump to: ${turn.message.content.slice(0, 90)}`}
          title={turn.message.content.slice(0, 120)}
          aria-current={active === turn.index ? "step" : undefined}
          onClick={() => {
            const root = scroll.current,
              el = document.getElementById(`turn-${chatId}-${turn.index}`);
            if (root && el) {
              root.scrollTo({
                top:
                  root.scrollTop +
                  el.getBoundingClientRect().top -
                  root.getBoundingClientRect().top -
                  20,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              });
              setActive(turn.index);
            }
          }}
        >
          <i />
        </Button>
      ))}
    </nav>
  );
}
