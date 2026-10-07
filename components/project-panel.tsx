"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@base-ui-components/react/button";
import {
  Box,
  ClipboardList,
  Camera,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Plus,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { Artifact } from "@/lib/room-artifacts";
import { ChatVisual } from "./chat-artifact";
import { ProjectComparison } from "./project-comparison";
import { ConstructionPlanView } from "./construction-plan";
import { ProjectMaterials } from "./project-materials";
const CadStudio = dynamic(
  () => import("./cad/studio").then((m) => m.CadStudio),
  { ssr: false },
);
export type ProjectHighlight = { id: string; version: number } | null;
export type ProjectTab = "visuals" | "materials" | "layout" | "construction";
type Assets = {
  project?: { title: string };
  artifacts: Artifact[];
  photos: { id: string; created_at: string }[];
  hasCad: boolean;
};
export function ProjectPanel({
  projectId,
  folder,
  chats = [],
  onFolder,
  onChat,
  width,
  onWidth,
  signal,
  focus,
  highlight,
  mobileOpen,
  busy,
  unlocked,
  onClose,
  onAsk,
  onDirtyChange,
  onArtifacts,
}: {
  projectId: string;
  folder?: { id: string; title: string };
  chats?: { id: string; title: string }[];
  onFolder?: () => void;
  onChat?: (id: string) => void;
  width: number;
  onWidth: (width: number) => void;
  signal: number;
  focus: ProjectTab;
  highlight: ProjectHighlight;
  mobileOpen: boolean;
  busy: boolean;
  unlocked: boolean;
  onClose: () => void;
  onAsk: (text: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onArtifacts: (projectId: string, artifacts: Artifact[]) => void;
}) {
  const [assets, setAssets] = useState<Assets>({
      artifacts: [],
      photos: [],
      hasCad: false,
    }),
    [tab, setTab] = useState<ProjectTab>(focus),
    [compare, setCompare] = useState<Artifact | null>(null),
    [worksId, setWorksId] = useState(""),
    [stepIndex, setStepIndex] = useState<number | null>(null),
    [billId, setBillId] = useState(""),
    [materialIndex, setMaterialIndex] = useState<number | null>(null),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [cadEditing, setCadEditing] = useState(false);
  const seenHighlight = useRef(""),
    attempted = useRef(new Set<string>()),
    dirty = useRef(false),
    mounted = useRef(true),
    serial = useRef(0),
    controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    const request = ++serial.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const r = await fetch(`/api/projects/${projectId}/assets`, {
          signal: abort.signal,
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (mounted.current && request === serial.current) {
        setAssets(data);
        setNotice("");
      }
    } catch (e) {
      if (mounted.current && !abort.signal.aborted)
        setNotice(
          e instanceof Error ? e.message : "Could not load your project.",
        );
    } finally {
      if (mounted.current && request === serial.current) setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    void load();
  }, [load, signal]);
  useEffect(() => {
    onArtifacts(projectId, assets.artifacts);
  }, [projectId, assets.artifacts, onArtifacts]);
  useEffect(() => {
    if (!dirty.current) {
      setTab(focus);
      if (focus === "layout" && assets.hasCad) setCadEditing(true);
    }
  }, [focus, signal, assets.hasCad]);
  useEffect(() => {
    if (!highlight) return;
    const key = `${highlight.id}:${highlight.version}`;
    if (seenHighlight.current === key) return;
    const a = assets.artifacts.find((a) => a.id === highlight.id);
    if (a && !dirty.current) {
      seenHighlight.current = key;
      if (a.kind === "estimate") {
        setTab("materials");
        setBillId(a.id);
        setMaterialIndex(a.data.lastProductSearchIndex ?? null);
      } else if (a.kind === "visual") setTab("visuals");
      else if (a.kind === "construction") {
        setTab("construction");
        setWorksId(a.id);
        setStepIndex(null);
      }
    }
  }, [highlight, assets.artifacts]);
  const pending = assets.artifacts.some(
    (a) =>
      a.kind === "visual" &&
      !a.hasImage &&
      (a.status === "running" || (a.status === "queued" && unlocked)),
  );
  useEffect(() => {
    if (!pending && !busy) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    return () => clearInterval(timer);
  }, [pending, busy, load]);
  const generate = useCallback(
    async (id: string) => {
      attempted.current.add(id);
      try {
        const r = await fetch(`/api/artifacts/${id}/image`, { method: "POST" }),
          data = await r.json();
        if (!r.ok && r.status !== 409) throw new Error(data.error);
        await load();
      } catch (e) {
        if (mounted.current)
          setNotice(
            e instanceof Error
              ? e.message
              : "Your design is saved. The concept could not finish.",
          );
      }
    },
    [load],
  );
  useEffect(() => {
    if (!unlocked) return;
    for (const a of assets.artifacts)
      if (
        a.kind === "visual" &&
        a.status === "queued" &&
        !a.hasImage &&
        !attempted.current.has(a.id)
      )
        void generate(a.id);
  }, [assets, unlocked, generate]);
  function choose(next: ProjectTab) {
    if (dirty.current) {
      setNotice("Save or discard your layout edits first.");
      return;
    }
    setTab(next);
  }
  function ask(text: string) {
    if (dirty.current) {
      setNotice("Save or discard your layout edits first.");
      return;
    }
    onAsk(text);
    onClose();
  }
  function close() {
    if (dirty.current) {
      setNotice("Save or discard your layout changes first.");
      return;
    }
    onClose();
  }
  const works = assets.artifacts.filter((a) => a.kind === "construction"),
    work = works.find((a) => a.id === worksId) || works[0];
  const visuals = assets.artifacts.filter((a) => a.kind === "visual"),
    bills = assets.artifacts.filter((a) => a.kind === "estimate"),
    bill = bills.find((a) => a.id === billId) || bills[0];
  function material(id: string, index: number) {
    setBillId(id);
    setMaterialIndex(index);
    choose("materials");
  }
  function resize(x: number) {
    onWidth(Math.max(360, Math.min(960, window.innerWidth - x)));
  }
  return (
    <aside
      id="roomwise-project"
      className={`projectPanel ${mobileOpen ? "mobileOpen" : ""} ${width > 600 ? "projectExpanded" : ""}`}
      aria-label="Your room project"
    >
      <div
        className="projectResize"
        role="separator"
        aria-label="Resize project panel"
        aria-orientation="vertical"
        aria-valuemin={360}
        aria-valuemax={960}
        aria-valuenow={width}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            onWidth(
              Math.max(
                360,
                Math.min(960, width + (e.key === "ArrowLeft" ? 24 : -24)),
              ),
            );
          }
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) resize(e.clientX);
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      />
      <header className="projectPanelHead">
        <div>
          <FolderOpen size={18} />
          <strong>
            {folder?.title || assets.project?.title || "Your project"}
          </strong>
        </div>
        <div>
          <Button
            className="expandProject"
            aria-label={
              width > 600 ? "Reduce project panel" : "Expand project panel"
            }
            onClick={() => onWidth(width > 600 ? 380 : 760)}
          >
            {width > 600 ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
          <Button
            className="closeProjectPanel"
            aria-label="Close project panel"
            onClick={close}
          >
            <X size={18} />
          </Button>
        </div>
      </header>
      <div className="projectPanelScroll">
        <div className="projectRoute">
          <small>IDEA → IMPLEMENTATION</small>
          <p>Your design, shopping list and work plan.</p>
        </div>
        <nav className="projectFolders" aria-label="Project sections">
          <Button
            aria-pressed={tab === "visuals"}
            onClick={() => choose("visuals")}
          >
            <ImageIcon size={15} />
            Design
          </Button>
          <Button
            aria-pressed={tab === "materials"}
            onClick={() => choose("materials")}
          >
            <ClipboardList size={15} />
            Materials
          </Button>
          <Button
            aria-pressed={tab === "construction"}
            onClick={() => choose("construction")}
          >
            <CheckListIcon />
            Work plan
          </Button>
        </nav>
        {notice && (
          <div className="projectPanelNotice" role="status">
            {notice}
            <Button
              aria-label="Dismiss project message"
              onClick={() => setNotice("")}
            >
              <X size={12} />
            </Button>
          </div>
        )}
        {loading ? (
          <div className="projectBlank">Opening your project…</div>
        ) : tab === "visuals" ? (
          <div className="projectVisualFolder">
            <div className="projectSectionIntro">
              <small>CONCEPT GALLERY</small>
              <h2>Your space, reimagined.</h2>
              <p>
                See the proposed design. Reveal the original whenever you need a
                reference.
              </p>
            </div>
            {visuals.length ? (
              <div className="projectConceptGrid">
                {visuals.map((a) => (
                  <article key={a.id} className="projectConcept">
                    {a.hasImage ? (
                      <ChatVisual artifact={a} />
                    ) : (
                      <div
                        className={`conceptPending ${a.status === "running" ? "animating" : ""}`}
                      >
                        <Camera size={24} />
                        <span>
                          {a.status === "failed"
                            ? "Concept interrupted"
                            : !unlocked
                              ? "Room Pass required"
                              : "Creating your concept…"}
                        </span>
                        {a.data.generationError && (
                          <p>{a.data.generationError}</p>
                        )}
                        {a.status === "failed" && unlocked && (
                          <Button onClick={() => void generate(a.id)}>
                            Retry concept
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="conceptInfo">
                      <div>
                        <h3>{a.data.title}</h3>
                        <small>Illustrative design concept</small>
                      </div>
                      {a.hasImage && (
                        <Button
                          onClick={() => setCompare(a)}
                          aria-label={`Open ${a.data.title} full size`}
                        >
                          <Maximize2 size={15} />
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="projectFolderEmpty">
                <Camera size={28} />
                <h3>Start with your room.</h3>
                <p>
                  Share a photo and describe the change you imagine. Your
                  concept is created automatically.
                </p>
                <Button
                  onClick={() =>
                    ask(
                      "Create a refurbishment concept from my room photos. Keep the layout and retained features, and improve finishes, lighting and furniture.",
                    )
                  }
                >
                  <Plus size={14} />
                  Create a concept
                </Button>
              </div>
            )}
            {!!assets.photos.length && (
              <details className="projectSourcePhotos">
                <summary>Original room photos · {assets.photos.length}</summary>
                <div>
                  {assets.photos.map((photo, i) => (
                    <a
                      key={photo.id}
                      href={`/api/photos/${photo.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={`/api/photos/${photo.id}`}
                        alt={`Original room ${i + 1}`}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : tab === "materials" ? (
          <div className="projectMaterialFolder">
            <div className="projectSectionIntro">
              <small>MATERIALS & QUANTITIES</small>
              <h2>Your shopping plan.</h2>
              <p>
                Review each part of the job. Compare products only when you want
                a specific recommendation.
              </p>
            </div>
            {bills.length > 1 && (
              <label className="projectBillPicker">
                Version
                <select
                  aria-label="Select material bill"
                  value={bill.id}
                  onChange={(e) => {
                    setBillId(e.target.value);
                    setMaterialIndex(null);
                  }}
                >
                  {bills.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.data.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {bill ? (
              <ProjectMaterials
                key={bill.id}
                artifact={bill}
                focusIndex={materialIndex}
                works={works}
                onStep={(id, index) => {
                  setWorksId(id);
                  setStepIndex(index);
                  choose("construction");
                }}
                onChanged={load}
                unlocked={unlocked}
              />
            ) : (
              <div className="projectFolderEmpty">
                <ClipboardList size={28} />
                <h3>From design to supplies.</h3>
                <p>
                  A complete bill includes finishes, preparation, tools and
                  quantities. Product research is optional.
                </p>
                <Button
                  onClick={() =>
                    ask(
                      "Build a complete bill of materials for my chosen design, including preparation, tools, consumables and quantities. Estimate costs without web search and state the provisional surface measurements.",
                    )
                  }
                >
                  Prepare my bill
                </Button>
              </div>
            )}
          </div>
        ) : tab === "construction" ? (
          <div className="projectConstructionFolder">
            <div className="projectSectionIntro">
              <small>WORK PLAN</small>
              <h2>Make it happen.</h2>
              <p>
                Open a step for instructions, the exact materials to use and
                completion checks.
              </p>
            </div>
            {works.length > 1 && (
              <label className="projectBillPicker">
                Version
                <select
                  aria-label="Select construction plan"
                  value={work.id}
                  onChange={(e) => setWorksId(e.target.value)}
                >
                  {works.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.data.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {work ? (
              <ConstructionPlanView
                artifact={work}
                compact
                focusStep={stepIndex}
                onChanged={load}
                onMaterial={material}
                onOpen={(id) => {
                  setBillId(id);
                  setMaterialIndex(null);
                  choose("materials");
                }}
              />
            ) : (
              <div className="projectFolderEmpty">
                <ClipboardList size={28} />
                <h3>A clear route to the result.</h3>
                <p>
                  Preparation, application, drying and checks, with every supply
                  linked to your bill.
                </p>
                <Button
                  onClick={() =>
                    ask(
                      "Create a detailed construction plan linked to my complete bill of materials. Include preparation, tools, drying times and completion checks. Complete any missing supplies in the BOM first, without web research.",
                    )
                  }
                >
                  Prepare my work plan
                </Button>
              </div>
            )}
          </div>
        ) : cadEditing ? (
          <CadStudio
            projectId={projectId}
            signal={signal}
            busy={busy}
            onAsk={ask}
            onClose={() => {
              if (dirty.current) {
                setNotice("Save or discard your layout edits first.");
                return;
              }
              setCadEditing(false);
            }}
            onDirtyChange={(value) => {
              const wasDirty = dirty.current;
              dirty.current = value;
              onDirtyChange(value);
              if (wasDirty && !value) void load();
            }}
          />
        ) : (
          <div className="projectFolderEmpty">
            <Box size={28} />
            <h3>Optional layout studio</h3>
            <p>
              Open an editable room model for geometry or structural changes.
            </p>
            <Button onClick={() => setCadEditing(true)}>
              Open room studio
            </Button>
          </div>
        )}
        {folder && (
          <section className="panelProjectChats">
            <div>
              <small>CHATS IN THIS PROJECT</small>
              <Button onClick={onFolder}>Open project</Button>
            </div>
            {chats.map((chat) => (
              <Button
                key={chat.id}
                aria-current={chat.id === projectId ? "page" : undefined}
                onClick={() => onChat?.(chat.id)}
                disabled={busy}
              >
                {chat.title}
              </Button>
            ))}
          </section>
        )}
        <details className="projectAdvanced">
          <summary>
            <Layers size={14} />
            Advanced · layout & geometry
          </summary>
          <p>For moving furniture, changing openings or structural concepts.</p>
          <Button onClick={() => choose("layout")}>Open layout tools</Button>
        </details>
      </div>
      {compare && (
        <ProjectComparison
          key={compare.id}
          artifact={compare}
          onClose={() => setCompare(null)}
        />
      )}
    </aside>
  );
}
function CheckListIcon() {
  return <ClipboardList size={15} />;
}
