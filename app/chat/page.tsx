"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  Download,
  Menu,
  Plus,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { briefSchema, type Project } from "@/lib/domain";
import { api } from "@/lib/browser-storage";
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
  const [input, setInput] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [sidebar, setSidebar] = useState(false);
  const [notice, setNotice] = useState(""),
    [confirming, setConfirming] = useState(false),
    [paywall, setPaywall] = useState(false);
  const initialized = useRef(false),
    thread = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null);
  const project = projects.find((p) => p.id === active),
    empty = !project?.messages.length;
  const unlocked = Boolean(cap.user?.pro_active || project?.paid);
  async function refresh() {
    const [session, data] = await Promise.all([
      api("/api/session"),
      api("/api/projects"),
    ]);
    setCap(session);
    setProjects(data.projects);
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
        setActive(selected);
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
    thread.current?.scrollTo({
      top: thread.current.scrollHeight,
      behavior: "smooth",
    });
  }, [project?.messages.length, busy]);
  useEffect(() => {
    if (ready && !busy) composer.current?.focus();
  }, [ready, active, busy]);
  function newChat() {
    setActive("");
    setInput("");
    setPaywall(false);
    setNotice("");
    setSidebar(false);
    window.history.replaceState(null, "", "/chat");
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (text.length < 3 || busy || confirming || !cap.user) return;
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
      const data = await api("/api/chat", { projectId: p!.id, message: text });
      const updated = {
        ...p!,
        title: p!.messages.length ? p!.title : text.slice(0, 60),
        messages: [
          ...p!.messages,
          { role: "user" as const, content: text },
          { role: "assistant" as const, content: data.message },
        ],
        previewUsed: true,
      };
      setProjects((list) => [
        updated,
        ...list.filter((x) => x.id !== updated.id),
      ]);
      setInput("");
      setCap(await api("/api/session"));
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Could not send your message. Please retry.",
      );
    } finally {
      setBusy(false);
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
        rows={empty ? 3 : 2}
        placeholder={
          empty
            ? "Describe your idea. We’ll work out the details together…"
            : "Message Roomwise…"
        }
        disabled={!ready || busy || confirming}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="chatComposerTools">
        <span>
          {confirming ? (
            "Confirming your payment…"
          ) : busy ? (
            "Thinking…"
          ) : unlocked ? (
            <>
              <Check size={13} /> Room Pass active
            </>
          ) : (
            "Your ideas, one conversation away."
          )}
        </span>
        <button
          type="submit"
          aria-label="Send message"
          disabled={!ready || busy || confirming || input.trim().length < 3}
        >
          <ArrowUp size={20} />
        </button>
      </div>
    </form>
  );
  return (
    <main className="workspace cleanWorkspace">
      {sidebar && (
        <button
          className="historyBackdrop"
          aria-label="Close chat history"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={sidebar ? "side open" : "side"}>
        <Link href="/" className="brand">
          <span className="brandMark">R</span>roomwise
        </Link>
        <button className="newChatButton" onClick={newChat}>
          <Plus size={17} /> New chat
        </button>
        <p className="sideLabel">CHAT HISTORY</p>
        <div className="projectList">
          {projects
            .filter((p) => p.messages.length || p.paid || p.id === active)
            .map((p) => (
              <button
                key={p.id}
                className={p.id === active ? "active" : ""}
                onClick={() => {
                  setActive(p.id);
                  setInput("");
                  setNotice("");
                  setPaywall(false);
                  setSidebar(false);
                  window.history.replaceState(
                    null,
                    "",
                    `/chat?project=${p.id}`,
                  );
                }}
              >
                <span>
                  {p.messages
                    .find((m) => m.role === "user")
                    ?.content.slice(0, 60) ||
                    (p.paid ? "Your new room" : "New chat")}
                </span>
              </button>
            ))}
        </div>
        <Link className="account cleanAccount" href="/account">
          <Settings size={17} />
          <span>My account</span>
          <small>{cap.user?.pro_active ? "Pro" : ""}</small>
        </Link>
      </aside>
      <section className="chatArea">
        <header className="chatHead">
          <button
            className="menu"
            aria-label="Open chat history"
            onClick={() => setSidebar(!sidebar)}
          >
            <Menu size={18} />
          </button>
          <span className="chatHeaderTitle">
            {empty
              ? "Roomwise"
              : project?.messages
                  .find((m) => m.role === "user")
                  ?.content.slice(0, 55) || "Your chat"}
          </span>
          <div className="workspaceActions">
            {!empty && (
              <button onClick={download} aria-label="Download plan">
                <Download size={16} />
              </button>
            )}
            <button onClick={newChat} aria-label="New chat">
              <Plus size={17} />
            </button>
          </div>
        </header>
        {notice && (
          <div className="cleanNotice" role="status">
            <span>{notice}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </div>
        )}
        {empty ? (
          <div className="chatWelcome">
            <span className="brandMark welcomeLogo">R</span>
            <h1>
              What will you
              <br />
              <em>create today?</em>
            </h1>
            <p>From a first idea to a room that feels like you.</p>
            {inputBox}
            {project && !unlocked && (
              <button
                className="checkPaymentLink"
                disabled={confirming}
                onClick={() => void checkPayment()}
              >
                Already paid? Check payment
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="thread" ref={thread}>
              {project?.messages.map((m, i) => (
                <article className={`message ${m.role}`} key={i}>
                  <span>{m.role === "user" ? "You" : "Roomwise"}</span>
                  <div>
                    {m.content.split("\n").map((line, j) => (
                      <p key={j}>{line || <br />}</p>
                    ))}
                  </div>
                </article>
              ))}
              {busy && (
                <div className="thinking">
                  <i />
                  <i />
                  <i />
                  Thinking…
                </div>
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
            <button onClick={() => void checkout("single")} disabled={busy}>
              Room Pass · $5
            </button>
            <button onClick={() => void checkout("pro")} disabled={busy}>
              Pro · $50/month
            </button>
            <button
              onClick={() => void checkPayment()}
              disabled={busy || confirming}
            >
              Check payment
            </button>
          </div>
        )}
        <p className="disclaimer">
          Roomwise can make mistakes. Check important details before starting
          work.
        </p>
      </section>
    </main>
  );
}
