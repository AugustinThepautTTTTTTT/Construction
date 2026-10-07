"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@base-ui-components/react/button";
import {
  ArrowUpRight,
  Download,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { api } from "@/lib/browser-storage";
import {
  materialPresentation,
  money,
  retailerName,
} from "@/lib/material-presentation";
import type { Artifact } from "@/lib/room-artifacts";
import { ProductComparisonView } from "./product-comparison";
import { ConstructionPlanView } from "./construction-plan";

export function ChatArtifact({
  id,
  artifact: shared,
  view,
  legacyComparison = false,
  unlocked,
  onOpen,
  onChanged,
}: {
  id: string;
  artifact?: Artifact;
  view?: { type: "products"; index: number };
  legacyComparison?: boolean;
  unlocked: boolean;
  onOpen?: (id: string) => void;
  onChanged: () => void;
}) {
  const [saved, setSaved] = useState<Artifact | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  // Recent results come from the shared project feed. Older conversation items
  // are loaded privately once rather than giving every message a polling loop.
  useEffect(() => {
    if (shared) return;
    const controller = new AbortController();
    void fetch(`/api/artifacts/${id}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setSaved(data.artifact);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setNotice("This project item could not load. Refresh to retry.");
      });
    return () => controller.abort();
  }, [id, shared]);
  const artifact = shared || saved;
  const productView =
    view ||
    (legacyComparison &&
    artifact?.kind === "estimate" &&
    artifact.data.lastProductSearchIndex != null
      ? {
          type: "products" as const,
          index: artifact.data.lastProductSearchIndex,
        }
      : undefined);
  async function retry() {
    setBusy(true);
    setNotice("");
    try {
      await api(`/api/artifacts/${id}/image`, {});
      onChanged();
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "The concept could not finish.",
      );
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  if (!artifact)
    return (
      <div className="chatArtifactLoading" role="status">
        {notice || "Preparing your project item…"}
      </div>
    );
  if (artifact.kind === "plan") return null;
  if (artifact.kind === "construction")
    return <ConstructionPlanView artifact={artifact} onOpen={onOpen} />;
  if (artifact.kind === "estimate" && productView?.type === "products")
    return (
      <ProductComparisonView
        cardsOnly
        artifact={artifact}
        index={productView.index}
        onChanged={() => {
          onChanged();
          if (!shared)
            void api(`/api/artifacts/${id}`).then((result) =>
              setSaved(result.artifact),
            );
        }}
        unlocked={unlocked}
      />
    );
  if (artifact.kind === "estimate")
    return (
      <ChatBill
        artifact={artifact}
        onOpen={onOpen}
        onChanged={() => {
          onChanged();
          if (!shared)
            void api(`/api/artifacts/${id}`).then((result) =>
              setSaved(result.artifact),
            );
        }}
        unlocked={unlocked}
      />
    );
  return (
    <div className="chatVisualResult">
      {artifact.hasImage ? (
        <ChatVisual artifact={artifact} />
      ) : (
        <div className="chatVisualPending" role="status">
          <ImageIcon size={25} />
          <strong>
            {artifact.status === "failed"
              ? "Your concept was interrupted"
              : !unlocked
                ? "A Room Pass unlocks this concept"
                : "Creating your room concept…"}
          </strong>
          <p>
            {artifact.data.generationError ||
              "Your image will appear here automatically. You can keep chatting."}
          </p>
          {artifact.status === "failed" && unlocked && (
            <Button disabled={busy} onClick={() => void retry()}>
              {busy ? "Retrying…" : "Retry concept"}
            </Button>
          )}
        </div>
      )}
      {notice && (
        <p className="chatArtifactNotice" role="status">
          {notice}
        </p>
      )}
      <div className="chatArtifactFooter">
        <span>
          {artifact.data.title}
          {artifact.hasImage ? " · Illustrative concept" : ""}
        </span>
        {onOpen && (
          <Button onClick={() => onOpen(id)}>
            In your project <ArrowUpRight size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ChatVisual({ artifact }: { artifact: Artifact }) {
  const [before, setBefore] = useState(false),
    [compare, setCompare] = useState(false),
    [ratio, setRatio] = useState(1);
  const original = `/api/photos/${artifact.data.sourcePhotoId}`,
    concept = `/api/artifacts/${artifact.id}/image`;
  return (
    <figure
      className={`chatVisual ${compare ? "comparing" : ""}`}
      aria-label={artifact.data.title}
    >
      <div className="chatVisualTools">
        <Button
          aria-pressed={before}
          disabled={compare}
          onClick={() => setBefore(!before)}
        >
          {before ? "See after" : "See before"}
        </Button>
        <Button
          aria-pressed={compare}
          onClick={() => {
            setCompare(!compare);
            setBefore(false);
          }}
        >
          {compare ? "Single view" : "Compare"}
        </Button>
        <a
          href={concept}
          download="archicova-concept.jpg"
          aria-label="Download room concept"
        >
          <Download size={14} />
        </a>
      </div>
      {compare ? (
        <div className="chatVisualPair">
          <figure>
            <img src={original} alt="Before: your original room" />
            <figcaption>Before</figcaption>
          </figure>
          <figure>
            <img src={concept} alt="After: illustrative room concept" />
            <figcaption>After</figcaption>
          </figure>
        </div>
      ) : (
        <div className="chatVisualSingle" style={{ aspectRatio: ratio }}>
          <div className={`chatVisualFlip ${before ? "flipped" : ""}`}>
            <div className="chatVisualFace">
              <img
                src={concept}
                alt="After: illustrative room concept"
                aria-hidden={before}
                onLoad={(e) =>
                  setRatio(
                    e.currentTarget.naturalWidth /
                      e.currentTarget.naturalHeight,
                  )
                }
              />
            </div>
            <div className="chatVisualFace chatVisualBack">
              <img
                src={original}
                alt="Before: your original room"
                aria-hidden={!before}
              />
            </div>
          </div>
          <span className="chatVisualLabel" aria-live="polite">
            {before ? "Before · Original" : "After · Concept"}
          </span>
        </div>
      )}
    </figure>
  );
}

function ChatBill({
  artifact,
  onOpen,
  onChanged,
  unlocked,
}: {
  artifact: Artifact;
  onOpen?: (id: string) => void;
  onChanged: () => void;
  unlocked: boolean;
}) {
  const bill = materialPresentation(artifact),
    fmt = (value: number) => money(value, bill.currency),
    range = (low: number, high: number) =>
      low === high ? fmt(low) : `${fmt(low)} – ${fmt(high)}`;
  return (
    <section className="chatBill" aria-label="Bill of materials">
      <header>
        <div className="chatBillEyebrow">
          <FileText size={14} /> Materials & shopping
        </div>
        <h3>{artifact.data.title}</h3>
        <p>
          {[artifact.data.city, artifact.data.country]
            .filter(Boolean)
            .join(", ")}{" "}
          · {bill.rows.length} materials ·{" "}
          {bill.verifiedCount
            ? `${bill.verifiedCount} selected products`
            : "estimated costs"}
        </p>
      </header>
      <div className="chatBillRows">
        {bill.rows.map((row: any) => (
          <article key={row.index}>
            <div>
              <h4>{row.item}</h4>
              <p>{row.source?.title || row.specification}</p>
              {row.source ? (
                <a
                  href={row.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {retailerName(row.source.url)} <ArrowUpRight size={12} />
                </a>
              ) : (
                <small>Estimated allowance · no verified product yet</small>
              )}
            </div>
            <div className="chatBillPrice">
              <strong>
                {row.source ? fmt(row.subtotal) : range(row.low, row.high)}
              </strong>
              <span>
                {row.quantity} {row.unit}{" "}
                {row.source ? `× ${fmt(row.source.price)}` : ""}
              </span>
            </div>
          </article>
        ))}
      </div>
      <div className="chatBillTotal">
        <span>
          Materials total<strong>{range(bill.low, bill.high)}</strong>
        </span>
        <p>
          {bill.rows.length > bill.verifiedCount
            ? `Includes ${range(bill.allowanceLow, bill.allowanceHigh)} in estimated allowances. `
            : ""}
          {artifact.data.calculations?.provisional
            ? "Photo-based quantities are provisional. "
            : ""}
          Check pack sizes, current checkout prices and delivery.
        </p>
      </div>
      {!!artifact.data.exclusions?.length && (
        <details>
          <summary>Assumptions & exclusions</summary>
          <p>{artifact.data.exclusions.join(" · ")}</p>
          {artifact.data.assumptions?.map((s: string, i: number) => (
            <p key={i}>{s}</p>
          ))}
        </details>
      )}
      {artifact.data.researchNotice && (
        <p className="chatBillResearch">{artifact.data.researchNotice}</p>
      )}
      <footer>
        <a href={`/api/artifacts/${artifact.id}/export`}>
          <Download size={14} />
          Download Excel
        </a>
        {onOpen && (
          <Button onClick={() => onOpen(artifact.id)}>
            Review quantities & products <ArrowUpRight size={13} />
          </Button>
        )}
      </footer>
    </section>
  );
}
