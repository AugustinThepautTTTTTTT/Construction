"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Dialog } from "@base-ui-components/react/dialog";
import { Button } from "@base-ui-components/react/button";
import { ArrowLeft, ArrowRight, Camera, Folder, X } from "lucide-react";
import type { Artifact } from "@/lib/room-artifacts";
import { ChatArtifact, ChatVisual } from "./chat-artifact";
export function ProjectVisualGallery({
  artifacts,
  unlocked,
  onChanged,
  caption,
}: {
  artifacts: Artifact[];
  unlocked: (artifact: Artifact) => boolean;
  onChanged: () => void;
  caption?: (artifact: Artifact) => string | undefined;
}) {
  const track = useRef<HTMLDivElement>(null),
    [expanded, setExpanded] = useState<string | null>(null),
    [selected, setSelected] = useState<string | null>(null);
  const current = artifacts.find((a) => a.id === selected),
    index = artifacts.findIndex((a) => a.id === selected);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (
        (delta > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) ||
        (delta < 0 && el.scrollLeft <= 0)
      )
        return;
      event.preventDefault();
      el.scrollLeft += delta * (event.deltaMode === 1 ? 20 : 1);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [artifacts.length]);
  function shift(direction: number) {
    track.current?.scrollBy({
      left: direction * 240,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <section className="visualDeck" aria-label="Project image gallery">
      <header>
        <div>
          <Folder size={15} />
          <span>
            {artifacts.length} {artifacts.length === 1 ? "concept" : "concepts"}
          </span>
        </div>
        <div>
          <Button aria-label="Browse previous images" onClick={() => shift(-1)}>
            <ArrowLeft size={15} />
          </Button>
          <Button aria-label="Browse next images" onClick={() => shift(1)}>
            <ArrowRight size={15} />
          </Button>
        </div>
      </header>
      <div
        ref={track}
        className="visualDeckScroll"
        onMouseLeave={() => setExpanded(null)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setExpanded(null);
        }}
      >
        <div className="visualDeckTrack">
          {artifacts.map((a, i) => (
            <article
              key={a.id}
              className="visualDeckCard"
              data-expanded={expanded === a.id}
              style={
                {
                  "--card-tilt": `${i % 2 === 0 ? -1 : 1}deg`,
                  "--card-layer": i + 1,
                } as CSSProperties
              }
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") setExpanded(a.id);
              }}
              onFocus={() => setExpanded(a.id)}
            >
              <Button
                aria-label={`Open concept: ${a.data.title}`}
                onClick={() => setSelected(a.id)}
              >
                <div className="visualDeckTab">
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <small>
                    {a.hasImage
                      ? "Concept"
                      : a.status === "failed"
                        ? "Interrupted"
                        : "Preparing"}
                  </small>
                </div>
                <div className="visualDeckPhoto">
                  {a.hasImage ? (
                    <img
                      src={`/api/artifacts/${a.id}/image`}
                      alt={a.data.title}
                      loading="lazy"
                    />
                  ) : (
                    <div>
                      <Camera size={25} />
                      <span>
                        {a.status === "failed"
                          ? "Open to retry"
                          : "Your concept is preparing"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="visualDeckCaption">
                  <strong>{a.data.title}</strong>
                  <small>{caption?.(a) || "Illustrative room concept"}</small>
                </div>
              </Button>
            </article>
          ))}
        </div>
      </div>
      <p className="visualDeckHint">
        Hover to explore · Scroll to browse · Click to open
      </p>
      <Dialog.Root
        open={!!current}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="projectCreateBackdrop" />
          <Dialog.Popup className="visualGalleryDialog chatKit">
            <header>
              <div>
                <Dialog.Title>{current?.data.title}</Dialog.Title>
                <Dialog.Description>
                  Illustrative room concept · Compare with your original photo.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close image preview">
                <X size={18} />
              </Dialog.Close>
            </header>
            {current &&
              (current.hasImage ? (
                <ChatVisual key={current.id} artifact={current} />
              ) : (
                <ChatArtifact
                  key={current.id}
                  id={current.id}
                  artifact={current}
                  unlocked={unlocked(current)}
                  onChanged={onChanged}
                />
              ))}
            <nav aria-label="Image versions">
              <Button
                aria-label="Previous concept"
                disabled={index <= 0}
                onClick={() => setSelected(artifacts[index - 1].id)}
              >
                <ArrowLeft size={15} />
              </Button>
              <span>
                {index + 1} / {artifacts.length}
              </span>
              <Button
                aria-label="Next concept"
                disabled={index >= artifacts.length - 1}
                onClick={() => setSelected(artifacts[index + 1].id)}
              >
                <ArrowRight size={15} />
              </Button>
            </nav>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
