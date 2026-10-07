"use client";
import { Collapsible } from "@base-ui-components/react/collapsible";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@base-ui-components/react/button";
import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/browser-storage";
import {
  roomMetrics,
  type Artifact,
  type RoomPlan,
} from "@/lib/room-artifacts";
function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return <Collapsible.Root className="artifactDetail"><Collapsible.Trigger className="detailTrigger">{title}<ChevronDown size={14}/></Collapsible.Trigger><Collapsible.Panel className="detailPanel">{children}</Collapsible.Panel></Collapsible.Root>;
}
export function FloorPlan({ plan }: { plan: RoomPlan }) {
  const ref = useRef<SVGSVGElement>(null),
    points = plan.outline;
  const minX = Math.min(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y)),
    width = Math.max(...points.map((p) => p.x)) - minX,
    height = Math.max(...points.map((p) => p.y)) - minY;
  const font = Math.max(width, height) * 0.026,
    metrics = roomMetrics(plan);
  function download() {
    if (!ref.current) return;
    const svg = new XMLSerializer().serializeToString(ref.current),
      url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "archicova-floor-plan.svg";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        className="floorPlan"
        viewBox={`${minX - 1} ${minY - 1} ${width + 2} ${height + 2}`}
        role="img"
        aria-label={`${plan.title}. ${metrics.area.toFixed(2)} square metres. ${plan.confirmed ? "User-confirmed measurements" : "Provisional dimensions"}`}
      >
        <rect
          x={minX - 1}
          y={minY - 1}
          width={width + 2}
          height={height + 2}
          fill="#fafbf7"
        />
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="#eaf0e2"
          stroke="#263c2e"
          strokeWidth=".07"
          strokeLinejoin="round"
        />
        {points.map((a, i) => {
          const b = points[(i + 1) % points.length],
            length = Math.hypot(b.x - a.x, b.y - a.y),
            cx = points.reduce((n, p) => n + p.x, 0) / points.length,
            cy = points.reduce((n, p) => n + p.y, 0) / points.length,
            mx = (a.x + b.x) / 2,
            my = (a.y + b.y) / 2;
          return (
            <text
              key={i}
              x={mx + (mx >= cx ? 0.24 : -0.24)}
              y={my + (my >= cy ? 0.24 : -0.24)}
              textAnchor="middle"
              fontSize={font}
              fill="#344b3b"
            >
              {plan.confirmed ? "" : "≈ "}{length.toFixed(1)} m
            </text>
          );
        })}
        {plan.openings.map((o, i) => {
          const a = points[o.wall],
            b = points[(o.wall + 1) % points.length],
            length = Math.hypot(b.x - a.x, b.y - a.y),
            dx = (b.x - a.x) / length,
            dy = (b.y - a.y) / length;
          return (
            <g key={i}>
              <line
                x1={a.x + dx * o.offset}
                y1={a.y + dy * o.offset}
                x2={a.x + dx * (o.offset + o.width)}
                y2={a.y + dy * (o.offset + o.width)}
                stroke={o.kind === "window" ? "#63a3ba" : "#c38a54"}
                strokeWidth=".11"
              />
              <title>{`${o.kind}: ${o.width} m wide`}</title>
            </g>
          );
        })}
        {plan.fixtures.map((f, i) => (
          <g key={i}>
            <title>{f.label}</title>
            <rect
              x={f.x}
              y={f.y}
              width={f.width}
              height={f.depth}
              rx=".04"
              fill="#c6d3b6"
              stroke="#788b67"
              strokeWidth=".025"
            />
            <text
              x={f.x + f.width / 2}
              y={f.y + f.depth / 2}
              textAnchor="middle"
              fontSize={font * 0.85}
              fill="#344b3b"
            >
              {i + 1}
            </text>
          </g>
        ))}
        <text x={minX} y={minY + height + 0.65} fontSize={font} fill="#65745c">
          {metrics.area.toFixed(2)} m² ·{" "}
          {plan.confirmed
            ? "User-confirmed dimensions"
            : "Provisional dimensions — confirm before ordering"}
        </text>
      </svg>
      {!!plan.openings.length && <p className="planLegend">{plan.openings.map(o => `${o.kind === "window" ? "Window" : "Door"} · wall ${o.wall + 1}, ${plan.confirmed ? "" : "≈ "}${o.width.toFixed(1)} m wide`).join(" / ")}</p>}
      {!!plan.fixtures.length && <p className="planLegend">{plan.fixtures.map((f, i) => `${i + 1}. ${f.label}`).join(" · ")}</p>}
      <div className="artifactActions">
        <Button onClick={download}><Download size={14}/> Download plan</Button>
        <small>
          <span className="doorKey" /> Door <span className="windowKey" />{" "}
          Window
        </small>
      </div>
    </>
  );
}
export function RoomArtifact({ id }: { id: string }) {
  const [artifact, setArtifact] = useState<Artifact | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function load() {
    const result = await api(`/api/artifacts/${id}`);
    setArtifact(result.artifact);
  }
  useEffect(() => {
    let alive = true;
    api(`/api/artifacts/${id}`)
      .then((result) => {
        if (alive) setArtifact(result.artifact);
      })
      .catch(() => {
        if (alive)
          setNotice("Could not load this deliverable. Refresh to retry.");
      });
    return () => {
      alive = false;
    };
  }, [id]);
  async function action(path: string, body: Record<string, string> = {}) {
    setBusy(true);
    setNotice("");
    try {
      const result = await api(path, body);
      await load();
      if (typeof result.count === "number")
        setNotice(
          result.count
            ? `${result.count} local product sources found. Check pack sizes and checkout prices.`
            : "No matching provider prices could be verified. Unmatched items remain estimated allowances.",
        );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Could not complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!artifact)
    return (
      <div className="roomArtifact">
        {notice || "Loading your deliverable…"}
      </div>
    );
  const plan = artifact.kind === "plan" ? (artifact.data as RoomPlan) : null;
  if (!plan) return null;
  return (
    <section className="roomArtifact" aria-label={artifact.data.title}>
      <div className="artifactTitle">
        <h3>{artifact.data.title}</h3>
        <span>
          2D PLAN
        </span>
      </div>
      {plan && (
        <>
          <FloorPlan plan={plan} />
          <p className="artifactHint">
            {plan.confirmed
              ? "Measurements confirmed by you. This remains a planning drawing."
              : "Check every wall, opening and fixture dimension. Tell Archicova corrections in chat before confirming."}
          </p>
          {!plan.confirmed && (
            <Button
              disabled={busy}
              onClick={() =>
                void action(`/api/artifacts/${id}`, {
                  action: "confirm_measurements",
                })
              }
            >
              I confirm these measurements
            </Button>
          )}
          {!!plan.surfaces.length && <Detail title="Existing materials & condition"><div className="surfaceAssessment">{plan.surfaces.map((s, i) => <p key={i}><strong>{s.surface}.</strong> {s.material}. {s.evidence} {s.recommendation} <small>{s.confidence} confidence</small></p>)}</div></Detail>}
          {!!plan.questions.length && (
            <div className="artifactHint">
              <strong>To clarify</strong>
              <ul>
                {plan.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {!!artifact.data.assumptions?.length && (
        <Detail title="Assumptions & measurement notes">
          <ul>
            {artifact.data.assumptions.map((a: string, i: number) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Detail>
      )}
      {notice && (
        <p role="status" className="artifactNotice">
          {notice}
        </p>
      )}
    </section>
  );
}
