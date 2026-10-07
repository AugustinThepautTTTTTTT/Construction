"use client";
import "./chat.css";
import "@/components/project-workspace.css";
import "@/components/chat-artifact.css";
import { Button } from "@base-ui-components/react/button";
import dynamic from "next/dynamic";
import type { ProjectTab, ProjectHighlight } from "@/components/project-panel";
import { FolderOpen } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Camera, Download, Plus, Settings, X } from "lucide-react";
import Link from "next/link";
import { briefSchema, type Project } from "@/lib/domain";
import type { Artifact } from "@/lib/room-artifacts";
import { ChatIcon } from "@/components/chat-icon";
import { ProjectHistory } from "@/components/project-history";
import { FolderWorkspace } from "@/components/folder-workspace";
import { ThreadManager } from "@/components/thread-manager";
import type { ProjectFolder } from "@/lib/project-folders";
import { ChatMessage } from "@/components/chat-message";
import { preparePhoto, PHOTO_LIMITS, type DraftPhoto } from "@/lib/photos";
import { readChatStream } from "@/lib/chat-stream";
import { api } from "@/lib/browser-storage";
const ProjectPanel = dynamic(
  () => import("@/components/project-panel").then((m) => m.ProjectPanel),
  {
    ssr: false,
    loading: () => (
      <aside className="projectPanel projectBlank">Opening your project…</aside>
    ),
  },
);
type Capabilities = {
  ai: boolean;
  checkout: boolean;
  user: {
    id: string;
    email: string;
    name?: string;
    pro_active: boolean;
    free_trial_used: boolean;
  } | null;
};
const initial: Capabilities = { ai: false, checkout: false, user: null };
export default function ChatPage() {
  const [cap, setCap] = useState(initial),
    [projects, setProjects] = useState<Project[]>([]),
    [active, setActive] = useState("");
  const [folders, setFolders] = useState<ProjectFolder[]>([]),
    [selectedFolder, setSelectedFolder] = useState("");
  const following = useRef(true),
    named = useRef(new Set<string>());
  const [projectWidth, setProjectWidth] = useState(380);
  const [projectSignal, setProjectSignal] = useState(0),
    [panelFocus, setPanelFocus] = useState<ProjectTab>("visuals"),
    [projectPanelOpen, setProjectPanelOpen] = useState(false),
    [highlight, setHighlight] = useState<ProjectHighlight>(null),
    [cadDirty, setCadDirty] = useState(false);
  const [projectAssets, setProjectAssets] = useState<{
    id: string;
    artifacts: Artifact[];
  }>({ id: "", artifacts: [] });
  const receiveArtifacts = useCallback(
    (id: string, artifacts: Artifact[]) => setProjectAssets({ id, artifacts }),
    [],
  );
  const artifactsChanged = useCallback(
    () => setProjectSignal((s) => s + 1),
    [],
  );
  const [input, setInput] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [sidebar, setSidebar] = useState(false);
  const [notice, setNotice] = useState(""),
    [confirming, setConfirming] = useState(false),
    [paywall, setPaywall] = useState(false);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]),
    [preparing, setPreparing] = useState(false),
    [progress, setProgress] = useState("");
  const photoPicker = useRef<HTMLInputElement>(null);
  const photoRef = useRef<DraftPhoto[]>([]);
  useEffect(() => {
    photoRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      photoRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
    },
    [],
  );
  const initialized = useRef(false),
    thread = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null);
  const project = projects.find((p) => p.id === active),
    empty = !project?.messages.length;
  const unlocked = Boolean(cap.user?.pro_active || project?.paid);
  useEffect(() => {
    setSidebar(window.matchMedia("(min-width:1101px)").matches);
  }, []);
  useEffect(() => {
    const el = composer.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(180, Math.max(28, el.scrollHeight))}px`;
  }, [input, empty]);
  const openArtifact = useCallback(
    (id: string) => {
      if (cadDirty) {
        setNotice("Save or discard your layout edits first.");
        return;
      }
      setHighlight((prev) => ({ id, version: (prev?.version || 0) + 1 }));
      setSidebar(false);
      setProjectPanelOpen(true);
      setProjectSignal((s) => s + 1);
    },
    [cadDirty],
  );
  async function refresh() {
    const [session, data] = await Promise.all([
      api("/api/session"),
      api("/api/projects"),
    ]);
    setCap(session);
    setProjects(data.projects);
    void api("/api/folders")
      .then((data) => setFolders(data.folders))
      .catch(() => {});
    return data.projects as Project[];
  }
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    let disposed = false;
    void (async () => {
      try {
        const session = await api("/api/session");
        if (!session.user?.email) {
          window.location.replace(
            `/account?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
          );
          return;
        }
        if (disposed) return;
        setCap(session);
        let list: Project[] = (await api("/api/projects")).projects;
        const q = new URLSearchParams(window.location.search);
        const selected =
          q.get("project") ||
          list.find((p) => p.paid && !p.messages.length)?.id ||
          list.find((p) => !p.messages.length)?.id ||
          "";
        if (disposed) return;
        setProjects(list);
        void api("/api/folders")
          .then((data) => {
            if (!disposed) setFolders(data.folders);
          })
          .catch(() => {});
        setActive(selected);
        if (selected && !q.get("folder"))
          setProjectPanelOpen(window.matchMedia("(min-width:1021px)").matches);
        if (q.get("folder")) setSelectedFolder(q.get("folder")!);
        setReady(true);
        let draft: unknown;
        try {
          draft = JSON.parse(localStorage.getItem("roomwise:brief") || "null");
        } catch {}
        const brief = briefSchema.safeParse(draft);
        if (q.get("new") === "1" && brief.success) {
          setInput(brief.data.goal);
          localStorage.removeItem("roomwise:brief");
        }
        if (q.get("checkout") === "cancelled")
          setNotice("Checkout cancelled. Your chat is saved.");
        const chosen = list.find((p) => p.id === selected);
        if (chosen && !chosen.paid && !session.user.pro_active) {
          setConfirming(true);
          try {
            const result = await api("/api/billing/confirm", {
              projectId: chosen.id,
              ...(q.get("session_id")
                ? { sessionId: q.get("session_id") }
                : {}),
            });
            if (result.confirmed) {
              list = await refresh();
              window.history.replaceState(
                null,
                "",
                `/chat?project=${chosen.id}`,
              );
            } else if (q.get("checkout") === "success")
              setNotice(
                "Payment confirmation is pending. Use Check payment below; you do not need to pay again.",
              );
          } catch (e) {
            if (q.get("checkout") === "success")
              setNotice(
                e instanceof Error ? e.message : "Could not check payment.",
              );
          } finally {
            if (!disposed) setConfirming(false);
          }
        }
      } catch {
        if (!disposed) {
          setNotice("Could not open your workspace. Refresh to try again.");
          setReady(true);
        }
      }
    })();
    return () => {
      disposed = true;
      initialized.current = false;
    };
  }, []);
  useEffect(() => {
    following.current = true;
    thread.current?.scrollTo({ top: thread.current.scrollHeight });
  }, [active]);
  useEffect(() => {
    if (following.current)
      thread.current?.scrollTo({ top: thread.current.scrollHeight });
  }, [project?.messages, busy]);
  useEffect(() => {
    const root = thread.current,
      content = root?.firstElementChild;
    if (!root || !content) return;
    const observer = new ResizeObserver(() => {
      if (following.current) root.scrollTo({ top: root.scrollHeight });
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [active, selectedFolder, empty]);
  useEffect(() => {
    if (
      !project?.messages.some((m) => m.role === "user") ||
      project.titleStatus !== "pending" ||
      named.current.has(project.id)
    )
      return;
    const id = project.id;
    named.current.add(id);
    void api("/api/projects/name", { id })
      .then((data) =>
        setProjects((list) =>
          list.map((chat) =>
            chat.id === id
              ? { ...chat, title: data.title, titleStatus: "complete" }
              : chat,
          ),
        ),
      )
      .catch(() => {});
  }, [project?.id, project?.titleStatus, project?.messages.length]);
  function openChat(id: string) {
    if (busy || preparing) return;
    if (cadDirty) {
      setNotice("Save or discard your room edits before switching chats.");
      return;
    }
    clearPhotos();
    setSelectedFolder("");
    setActive(id);
    setPanelFocus("visuals");
    setProjectPanelOpen(window.matchMedia("(min-width:1021px)").matches);
    setHighlight(null);
    setInput("");
    setNotice("");
    setPaywall(false);
    setSidebar(false);
    window.history.replaceState(null, "", `/chat?project=${id}`);
  }
  async function assignChat(chatId: string, folderId: string | null) {
    try {
      const r = await fetch("/api/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", chatId, folderId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setProjects((list) =>
        list.map((chat) => (chat.id === chatId ? { ...chat, folderId } : chat)),
      );
      setProjectSignal((s) => s + 1);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not assign this chat.");
    }
  }
  async function createProject(description: string) {
    try {
      const data = await api("/api/folders", { description });
      setFolders((list) => [data.folder, ...list]);
      window.history.replaceState(null, "", `/chat?folder=${data.folder.id}`);
      setSelectedFolder(data.folder.id);
      setProjectPanelOpen(false);
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Could not create the project.",
      );
      throw e;
    }
  }
  useEffect(() => {
    if (ready && !busy) composer.current?.focus();
  }, [ready, active, busy]);
  function clearPhotos() {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
  }
  async function addPhotos(files: FileList | null) {
    if (!files) return;
    if (photos.length + files.length > PHOTO_LIMITS.perMessage) {
      setNotice("Attach up to three room photos per message.");
      return;
    }
    setPreparing(true);
    setNotice("");
    const prepared: DraftPhoto[] = [];
    try {
      for (const file of Array.from(files))
        prepared.push(await preparePhoto(file));
      setPhotos((list) => [...list, ...prepared]);
    } catch (e) {
      prepared.forEach((p) => URL.revokeObjectURL(p.preview));
      setNotice(
        e instanceof Error ? e.message : "Could not prepare this photo.",
      );
    } finally {
      setPreparing(false);
      if (photoPicker.current) photoPicker.current.value = "";
    }
  }
  function newChat() {
    if (cadDirty) {
      setNotice("Save or discard your room edits before switching chats.");
      return;
    }
    setProjectPanelOpen(false);
    setPanelFocus("visuals");
    setHighlight(null);
    if (busy || preparing) return;
    clearPhotos();
    setActive("");
    setSelectedFolder("");
    setInput("");
    setPaywall(false);
    setNotice("");
    setSidebar(false);
    window.history.replaceState(null, "", "/chat");
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    following.current = true;
    if (cadDirty) {
      setNotice(
        "Save your room changes before sending, so Roomwise sees your latest geometry.",
      );
      return;
    }
    const text =
      input.trim() ||
      (photos.length ? "Help me plan improvements to this room." : "");
    if (!text || busy || preparing || confirming || !cap.user) return;
    setBusy(true);
    setNotice("");
    setPaywall(false);
    let p = project;
    try {
      if (!p) {
        // Use an unused paid Room Pass before creating a fresh conversation.
        p = projects.find((x) => x.paid && !x.messages.length);
        if (!p)
          p = (
            await api("/api/projects", {
              room: "Other",
              goal: text.slice(0, 2000),
              budget: "Not set",
              size: "Not measured",
              location: "Not specified",
            })
          ).project;
        setActive(p!.id);
        setProjects((list) => [p!, ...list.filter((x) => x.id !== p!.id)]);
        window.history.replaceState(null, "", `/chat?project=${p!.id}`);
      }
      const canSend =
        cap.user.pro_active ||
        p!.paid ||
        (!cap.user.free_trial_used && !p!.previewUsed);
      if (!canSend) {
        setPaywall(true);
        return;
      }
      const missing = photos.filter((photo) => !photo.id);
      if (missing.length) {
        setProgress("Uploading your room photos…");
        const form = new FormData();
        form.append("projectId", p!.id);
        missing.forEach((photo) => form.append("photos", photo.file));
        const uploaded = await fetch("/api/photos", {
          method: "POST",
          body: form,
        });
        const data = await uploaded.json();
        if (!uploaded.ok)
          throw new Error(data.error || "Could not upload photos.");
        missing.forEach((photo, i) => {
          photo.id = data.photoIds[i];
        });
        setPhotos([...photos]);
      }
      const photoIds = photos.map((photo) => photo.id!);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: p!.id, message: text, photoIds }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not start your reply.");
      }

      setSidebar(false);
      const updated = {
        ...p!,
        title: p!.messages.length ? p!.title : text.slice(0, 60),
        messages: [
          ...p!.messages,
          { role: "user" as const, content: text, photoIds },
          {
            role: "assistant" as const,
            content: "",
            status: "running" as const,
          },
        ],
        previewUsed: true,
      };
      setProjects((list) => [
        updated,
        ...list.filter((x) => x.id !== updated.id),
      ]);
      setInput("");
      clearPhotos();
      setProgress("Reviewing your room and request…");
      await readChatStream(response, (event) => {
        if (event.type === "cad") {
          setProjectSignal((s) => s + 1);
          setPanelFocus("layout");
          setProjectPanelOpen(true);
          setSidebar(false);
        }
        if (event.type === "artifact") {
          setProjectSignal((s) => s + 1);
          setPanelFocus(
            event.kind === "estimate"
              ? "materials"
              : event.kind === "construction"
                ? "construction"
                : "visuals",
          );
          setSidebar(false);
          setHighlight(null);
        }
        if (event.type === "status") setProgress(event.message);
        if (event.type === "artifact")
          setProjects((list) =>
            list.map((room) =>
              room.id !== p!.id
                ? room
                : {
                    ...room,
                    messages: room.messages.map((message, i) =>
                      i === room.messages.length - 1
                        ? {
                            ...message,
                            artifactViews:
                              event.view === "products" && event.index != null
                                ? {
                                    ...message.artifactViews,
                                    [event.id]: {
                                      type: "products" as const,
                                      index: event.index,
                                    },
                                  }
                                : message.artifactViews,
                            artifactIds: [
                              ...(message.artifactIds || []),
                              event.id,
                            ],
                          }
                        : message,
                    ),
                  },
            ),
          );
        if (event.type === "paragraph") {
          setProgress("Writing your plan…");
          setProjects((list) =>
            list.map((room) =>
              room.id !== p!.id
                ? room
                : {
                    ...room,
                    messages: room.messages.map((message, i) =>
                      i === room.messages.length - 1
                        ? { ...message, content: message.content + event.text }
                        : message,
                    ),
                  },
            ),
          );
        }
      });
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Could not send your message. Please retry.",
      );
    } finally {
      try {
        await refresh();
        setProjectSignal((s) => s + 1);
      } catch {}
      setBusy(false);
      setProgress("");
    }
  }
  async function checkPayment() {
    if (!project || confirming) return;
    setConfirming(true);
    setNotice("");
    try {
      const result = await api("/api/billing/confirm", {
        projectId: project.id,
      });
      await refresh();
      if (result.confirmed) {
        setPaywall(false);
        window.history.replaceState(null, "", `/chat?project=${project.id}`);
      } else
        setNotice(
          "No completed payment found for this chat yet. You can try again shortly.",
        );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not verify payment.");
    } finally {
      setConfirming(false);
    }
  }
  async function checkout(plan: "single" | "pro") {
    if (!project) return;
    setBusy(true);
    setNotice("");
    try {
      const data = await api("/api/checkout", { plan, projectId: project.id });
      window.location.assign(data.url);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not open checkout.");
      setBusy(false);
    }
  }
  function download() {
    if (!project) return;
    const blob = new Blob(
      [
        project.messages
          .map((m) => `${m.role === "user" ? "You" : "Roomwise"}\n${m.content}`)
          .join("\n\n"),
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "roomwise-plan.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  const inputBox = (
    <form
      className={`chatComposer ${empty ? "heroComposer" : ""}`}
      onSubmit={send}
    >
      <label className="visuallyHidden" htmlFor="chat-prompt">
        Message Roomwise
      </label>
      <textarea
        ref={composer}
        id="chat-prompt"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        maxLength={4000}
        rows={1}
        placeholder={"Ask anything about your room"}
        disabled={!ready || busy || preparing || confirming}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      {!!photos.length && (
        <div className="draftPhotos">
          {photos.map((photo, i) => (
            <div key={photo.preview}>
              <img src={photo.preview} alt={photo.name} />
              <Button
                type="button"
                aria-label={`Remove ${photo.name}`}
                disabled={busy || preparing}
                onClick={() => {
                  URL.revokeObjectURL(photo.preview);
                  setPhotos((list) => list.filter((_, j) => i !== j));
                }}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={photoPicker}
        className="visuallyHidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => void addPhotos(e.target.files)}
        disabled={busy || preparing}
      />
      <div className="chatComposerTools">
        <Button
          className="attachPhoto"
          type="button"
          aria-label="Attach room photos"
          title="Up to 3 JPG, PNG or WebP photos · 10 MB each · 12 per room"
          disabled={!ready || busy || preparing || photos.length >= 3}
          onClick={() => photoPicker.current?.click()}
        >
          <ChatIcon name="attach" size={18} />
        </Button>
        <Button
          className="composerPhotoTool"
          type="button"
          disabled={!ready || busy || preparing || photos.length >= 3}
          onClick={() => photoPicker.current?.click()}
          title="Up to 3 photos per message, 10 MB each"
        >
          <Camera size={16} />
          Photos
        </Button>
        <span
          className={
            busy || preparing || confirming
              ? "composerStatus"
              : "visuallyHidden"
          }
          role="status"
        >
          {preparing
            ? "Preparing your photos…"
            : confirming
              ? "Confirming your payment…"
              : busy
                ? "Preparing your reply…"
                : unlocked
                  ? "Room Pass active"
                  : "Your ideas, one conversation away."}
        </span>
        <Button
          type="submit"
          className="sendMessage"
          aria-label="Send message"
          disabled={
            !ready ||
            busy ||
            preparing ||
            confirming ||
            (!input.trim() && !photos.length)
          }
        >
          <ArrowUp size={20} />
        </Button>
      </div>
    </form>
  );
  return (
    <main
      style={
        {
          "--project-width": `${projectWidth}px`,
        } as import("react").CSSProperties
      }
      className={`workspace cleanWorkspace projectWorkspace chatKit ${sidebar ? "historyVisible" : ""} ${project ? "withProject" : ""} ${project && !selectedFolder && projectPanelOpen ? "projectVisible" : ""}`}
    >
      {sidebar && (
        <Button
          className="historyBackdrop"
          aria-label="Close chat history"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside id="roomwise-history" className={sidebar ? "side open" : "side"}>
        <Link href="/" className="brand" aria-label="Roomwise home">
          <span className="brandMark">R</span>
          <span className="brandName">roomwise</span>
        </Link>
        <Button
          className="newChatButton"
          onClick={newChat}
          disabled={busy || preparing}
        >
          <ChatIcon name="new-chat" size={18} /> <span>New chat</span>
        </Button>
        <Button
          className="railHistory"
          aria-label="Open saved chats"
          onClick={() => setSidebar(!sidebar)}
        >
          <ChatIcon name="sidebar" size={19} />
        </Button>
        <ProjectHistory
          chats={projects.filter(
            (p) => p.messages.length || p.paid || p.id === active,
          )}
          folders={folders}
          active={active}
          selected={selectedFolder}
          busy={busy || preparing || cadDirty}
          onChat={openChat}
          onFolder={(id) => {
            if (cadDirty || busy || preparing) return;
            setSelectedFolder(id);
            setProjectPanelOpen(false);
            setSidebar(false);
            window.history.replaceState(null, "", `/chat?folder=${id}`);
          }}
          onCreate={createProject}
          onAssign={assignChat}
        />
        <Link className="account cleanAccount" href="/account">
          <Settings size={17} />
          <span>My account</span>
          <small>{cap.user?.pro_active ? "Pro" : ""}</small>
        </Link>
      </aside>
      <section className="chatArea">
        <header className="chatHead">
          <Button
            className="menu"
            aria-label={sidebar ? "Collapse chat history" : "Open chat history"}
            aria-expanded={sidebar}
            aria-controls="roomwise-history"
            onClick={() => setSidebar(!sidebar)}
          >
            <ChatIcon name="sidebar" size={20} />
          </Button>
          <span className="chatHeaderTitle">
            {selectedFolder
              ? folders.find((f) => f.id === selectedFolder)?.title
              : project?.title || "Roomwise"}
          </span>
          <div className="workspaceActions">
            {project && !selectedFolder && (
              <Button
                className="openProject"
                aria-label={
                  projectPanelOpen
                    ? "Collapse project panel"
                    : "Open project panel"
                }
                aria-expanded={projectPanelOpen}
                aria-controls="roomwise-project"
                onClick={() => {
                  if (projectPanelOpen && cadDirty) {
                    setNotice(
                      "Save or discard your layout edits before closing the project.",
                    );
                    return;
                  }
                  if (!projectPanelOpen) setSidebar(false);
                  setProjectPanelOpen(!projectPanelOpen);
                }}
              >
                <FolderOpen size={16} />
                <span>Your project</span>
              </Button>
            )}
            {!empty && (
              <Button onClick={download} aria-label="Download plan">
                <Download size={16} />
              </Button>
            )}
            <Button onClick={newChat} aria-label="New chat">
              <Plus size={17} />
            </Button>
          </div>
        </header>
        {notice && (
          <div className="cleanNotice" role="status">
            <span>{notice}</span>
            <Button aria-label="Dismiss message" onClick={() => setNotice("")}>
              <X size={15} />
            </Button>
          </div>
        )}
        {selectedFolder ? (
          <FolderWorkspace
            key={selectedFolder}
            id={selectedFolder}
            signal={projectSignal}
            unlocked={Boolean(cap.user?.pro_active)}
            onChat={openChat}
          />
        ) : empty ? (
          <div className="chatWelcome">
            <h1>What will you create today?</h1>
            {inputBox}
            <small className="photoHelp">
              Attach room photos · Up to 3 per message, 10 MB each
            </small>
            {project && !unlocked && (
              <Button
                className="checkPaymentLink"
                disabled={confirming}
                onClick={() => void checkPayment()}
              >
                Already paid? Check payment
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="threadFrame">
              <div
                className="threadScroll"
                ref={thread}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  following.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 100;
                }}
              >
                <div className="thread">
                  {project?.messages.map((m, i) => (
                    <div key={i} id={`turn-${project?.id}-${i}`}>
                      <ChatMessage
                        message={m}
                        repeatedArtifactIds={(m.artifactIds || []).filter(
                          (id) =>
                            project.messages
                              .slice(0, i)
                              .some((previous) =>
                                previous.artifactIds?.includes(id),
                              ),
                        )}
                        onOpenArtifact={openArtifact}
                        artifacts={
                          projectAssets.id === project?.id
                            ? projectAssets.artifacts
                            : []
                        }
                        unlocked={unlocked}
                        onArtifactsChanged={artifactsChanged}
                      />
                    </div>
                  ))}
                  {busy && (
                    <div className="thinking" role="status" aria-live="polite">
                      <i />
                      <i />
                      <i />
                      Preparing your reply…
                    </div>
                  )}
                </div>
              </div>
              {project && (
                <ThreadManager
                  messages={project.messages}
                  chatId={project.id}
                  scroll={thread}
                />
              )}
            </div>
            {inputBox}
          </>
        )}
        {paywall && (
          <div className="chatUpgrade" role="status">
            <span>
              Your free test is used. Continue this chat with a Room Pass.
            </span>
            <Button onClick={() => void checkout("single")} disabled={busy}>
              Room Pass · $5
            </Button>
            <Button onClick={() => void checkout("pro")} disabled={busy}>
              Pro · $50/month
            </Button>
            <Button
              onClick={() => void checkPayment()}
              disabled={busy || confirming}
            >
              Check payment
            </Button>
          </div>
        )}
        <p className="disclaimer">
          Roomwise can make mistakes. Check important details before starting
          work.
        </p>
      </section>
      {project && !selectedFolder && (
        <ProjectPanel
          key={project.id}
          projectId={project.id}
          folder={folders.find((f) => f.id === project.folderId)}
          chats={projects.filter(
            (chat) => chat.folderId && chat.folderId === project.folderId,
          )}
          onChat={openChat}
          onFolder={() => {
            if (cadDirty || busy || preparing) return;
            setSelectedFolder(project.folderId || "");
            setProjectPanelOpen(false);
            window.history.replaceState(
              null,
              "",
              `/chat?folder=${project.folderId}`,
            );
          }}
          width={projectWidth}
          onWidth={setProjectWidth}
          signal={projectSignal}
          focus={panelFocus}
          highlight={highlight}
          mobileOpen={projectPanelOpen}
          busy={busy}
          unlocked={unlocked}
          onArtifacts={receiveArtifacts}
          onDirtyChange={setCadDirty}
          onClose={() => setProjectPanelOpen(false)}
          onAsk={(text) => {
            setInput(text);
            setSidebar(false);
            setProjectPanelOpen(false);
            composer.current?.focus();
          }}
        />
      )}
    </main>
  );
}
