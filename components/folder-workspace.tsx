"use client";
import { useEffect, useState } from "react";
import { Button } from "@base-ui-components/react/button";
import {
  Image,
  ClipboardList,
  MessagesSquare,
  ArrowUpRight,
} from "lucide-react";
import { materialBills } from "@/lib/material-bills";
import type { Artifact } from "@/lib/room-artifacts";
import { ProjectMaterials } from "./project-materials";
import { ConstructionPlanView } from "./construction-plan";
import { ProjectVisualGallery } from "./project-visual-gallery";
export function FolderWorkspace({
  id,
  signal,
  unlocked,
  onChat,
}: {
  id: string;
  signal: number;
  unlocked: boolean;
  onChat: (id: string) => void;
}) {
  const [feed, setFeed] = useState<{
      folder: { title: string; description: string };
      chats: { id: string; title: string; paid: boolean }[];
      artifacts: (Artifact & { project_id: string })[];
    } | null>(null),
    [tab, setTab] = useState("visual"),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [focus, setFocus] = useState<{ id: string; index: number | null }>({
      id: "",
      index: null,
    });
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void fetch(`/api/folders?id=${id}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setFeed(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, signal, version]);
  if (!feed)
    return (
      <div className="folderWorkspace" role="status">
        {error || "Opening project…"}
      </div>
    );
  function changed() {
    setVersion((v) => v + 1);
  }
  function show(kind: string, assetId: string, index: number | null) {
    setTab(kind);
    setFocus({ id: assetId, index });
    setTimeout(
      () =>
        document
          .getElementById(`folder-asset-${assetId}`)
          ?.scrollIntoView({ block: "start", behavior: "smooth" }),
      80,
    );
  }
  const displayedArtifacts = feed.artifacts.filter(
    (a) =>
      a.kind !== "estimate" ||
      a.id === focus.id ||
      a.id ===
        materialBills(
          feed.artifacts.filter((other) => other.project_id === a.project_id),
        )[0]?.id,
  );
  const sections = [
    { kind: "visual", title: "Visuals", icon: Image },
    { kind: "estimate", title: "Bill of materials", icon: ClipboardList },
    { kind: "construction", title: "Work instructions", icon: ClipboardList },
  ];
  return (
    <div className="folderWorkspace">
      <header>
        <small>PROJECT</small>
        <h1>{feed.folder.title}</h1>
        <p>{feed.folder.description}</p>
      </header>
      <nav className="folderAssetTabs" aria-label="Project assets">
        {sections.map((s) => (
          <Button
            key={s.kind}
            aria-pressed={s.kind === tab}
            onClick={() => setTab(s.kind)}
          >
            <s.icon size={18} />
            <span>
              {s.title}
              <small>
                {displayedArtifacts.filter((a) => a.kind === s.kind).length}{" "}
                saved
              </small>
            </span>
          </Button>
        ))}
      </nav>
      <div className="folderAssetList">
        {tab === "visual" &&
          displayedArtifacts.some((a) => a.kind === "visual") && (
            <ProjectVisualGallery
              artifacts={displayedArtifacts.filter((a) => a.kind === "visual")}
              unlocked={(a) =>
                unlocked ||
                !!feed.chats.find((c) => c.id === a.project_id)?.paid
              }
              onChanged={changed}
              caption={(a) =>
                feed.chats.find((c) => c.id === a.project_id)?.title
              }
            />
          )}
        {displayedArtifacts
          .filter((a) => a.kind === tab && tab !== "visual")
          .map((a) => (
            <section key={a.id} id={`folder-asset-${a.id}`}>
              <h3 className="folderAssetTitle">
                {a.data.title}
                <small>
                  {feed.chats.find((c) => c.id === a.project_id)?.title}
                </small>
              </h3>
              {a.kind === "estimate" ? (
                <ProjectMaterials
                  artifact={a}
                  focusIndex={focus.id === a.id ? focus.index : null}
                  works={feed.artifacts.filter(
                    (w) =>
                      w.kind === "construction" &&
                      w.project_id === a.project_id,
                  )}
                  onChanged={changed}
                  unlocked={
                    unlocked ||
                    !!feed.chats.find((c) => c.id === a.project_id)?.paid
                  }
                  onStep={(work, index) => show("construction", work, index)}
                />
              ) : a.kind === "construction" ? (
                <ConstructionPlanView
                  artifact={a}
                  compact
                  focusStep={focus.id === a.id ? focus.index : null}
                  onChanged={changed}
                  onOpen={(id) => show("estimate", id, null)}
                  onMaterial={(id, index) => show("estimate", id, index)}
                />
              ) : null}
            </section>
          ))}
        {!displayedArtifacts.some((a) => a.kind === tab) && (
          <p className="folderEmpty">
            Saved {sections.find((s) => s.kind === tab)?.title.toLowerCase()}{" "}
            from this project’s chats will appear here.
          </p>
        )}
      </div>
      <section className="folderConversationList">
        <h2>
          <MessagesSquare size={18} />
          Chats in this project
        </h2>
        {feed.chats.map((chat) => (
          <Button key={chat.id} onClick={() => onChat(chat.id)}>
            <span>{chat.title}</span>
            <ArrowUpRight size={16} />
          </Button>
        ))}
        {!feed.chats.length && (
          <p>
            Drag a saved chat onto this folder or use its menu to assign it.
          </p>
        )}
      </section>
    </div>
  );
}
