"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ArrowRight,
  Check,
  Download,
  Menu,
  Plus,
  Sparkles,
  Cloud,
  HardDrive,
  LockKeyhole,
} from "lucide-react";
import Link from "next/link";
import {
  briefSchema,
  type Project,
  type Brief,
} from "@/lib/domain";
import { api, writeProjects } from "@/lib/browser-storage";
type Capabilities = {
  storage: "local" | "cloud";
  checkout: boolean;
  email: boolean;
  ai: boolean;
  user: { id: string; email: string | null; pro_active: boolean; free_trial_used: boolean } | null;
};
const initial: Capabilities = {
  storage: "local",
  checkout: false,
  email: false,
  ai: false,
  user: null,
};
export default function ChatPage() {
  const [cap, setCap] = useState(initial);
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [notice, setNotice] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [room, setRoom] = useState("Kitchen");
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("");
  const initialized = useRef(false);
  const thread = useRef<HTMLDivElement>(null);
  const project = projects.find((p) => p.id === active);
  const unlocked = Boolean(
    cap.user?.pro_active || (project?.paid && project.storage === "cloud"),
  );
  const cacheKey = cap.user
    ? `roomwise:cloud-cache:${cap.user.id}`
    : "roomwise:local-projects";
  function persist(next: Project[], key = cacheKey) {
    setProjects(next);
    try {
      writeProjects(next, key);
    } catch {
      setNotice(
        "Browser saving is unavailable. Download your plan before closing this page.",
      );
    }
  }
  async function create(brief: Brief, config = cap, list = projects) {
    if (!config.user?.email) {
      window.location.assign("/account?next=%2Fchat");
      return;
    }
    try {
      let p: Project = (await api("/api/projects", brief)).project;
      const next = [p, ...list.filter((x) => x.id !== p.id)];
      persist(next, `roomwise:cloud-cache:${config.user.id}`);
      setActive(p.id);
      setSidebar(false);
      window.history.replaceState(null, "", `/chat?project=${p.id}`);
      if (config.user.pro_active || !config.user.free_trial_used) {
        try {
          const preview = await api("/api/chat", {
            projectId: p.id, message: `Create a starter plan for this room: ${brief.goal}`,
          });
          p = {...p, messages: [{role: "user", content: brief.goal}, {role: "assistant", content: preview.message}], previewUsed: true};
          persist([p, ...list.filter((x) => x.id !== p.id)], `roomwise:cloud-cache:${config.user.id}`);
          setCap(await api("/api/session"));
        } catch (e) { setNotice(e instanceof Error ? e.message : "The planner is unavailable."); }
      } else setNotice("Your free test has been used. Choose a Room Pass or Pro to plan this room.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save this room. Please try again."); }
  }
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      let config = initial;
      let list: Project[] = [];
      try {
        config = await api("/api/session");
        if (!config.user?.email) {
          window.location.replace(`/account?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        setCap(config);
        if (config.storage === "cloud" && config.user) {
          list = (await api("/api/projects")).projects;

        }
      } catch {
        setNotice(
          "Your account could not be loaded. Please refresh to try again.",
        );
      }
      setProjects(list);
      const query = new URLSearchParams(window.location.search);
      const selected = query.get("project");
      setActive(
        selected && list.some((p) => p.id === selected)
          ? selected
          : list[0]?.id || "",
      );
      if (query.get("checkout") === "success")
        setNotice(
          "Checking payment confirmation. Access updates only after Stripe confirms the payment.",
        );
      if (query.get("checkout") === "cancelled")
        setNotice("Checkout cancelled. Your preview is still here.");
      let draft: unknown;
      try {
        draft = JSON.parse(localStorage.getItem("roomwise:brief") || "null");
      } catch {}
      const parsed = briefSchema.safeParse(draft);
      if (parsed.success && query.get("new") === "1") {
        await create(parsed.data, config, list);
        localStorage.removeItem("roomwise:brief");
      }
      setReady(true);
    })();
  }, []);
  useEffect(() => {
    thread.current?.scrollTo({
      top: thread.current.scrollHeight,
      behavior: "smooth",
    });
  }, [project?.messages.length, loading]);
  // Poll only while a verified webhook is expected; the return URL never grants access.
  useEffect(() => {
    if (
      !ready ||
      !cap.user ||
      new URLSearchParams(window.location.search).get("checkout") !== "success"
    )
      return;
    let attempts = 0;
    const timer = setInterval(() => {
      void (async () => {
        attempts++;
        try {
          const config = await api("/api/session");
          setCap(config);
          const list = (await api("/api/projects")).projects;
          setProjects(list);
          const selected = list.find((p: Project) => p.id === active);
          if (config.user?.pro_active || selected?.paid) {
            setNotice("Payment confirmed. Your room is unlocked.");
            clearInterval(timer);
            window.history.replaceState(null, "", `/chat?project=${active}`);
          }
        } catch {}
        if (attempts >= 10) {
          clearInterval(timer);
          setNotice(
            "Payment confirmation is still pending. Reopen this workspace shortly.",
          );
        }
      })();
    }, 3000);
    return () => clearInterval(timer);
  }, [ready, cap.user?.id, active]);
  async function start(e: FormEvent) {
    e.preventDefault();
    const parsed = briefSchema.safeParse({
      room,
      goal,
      budget: budget || "Not set",
      size: "Not measured",
      location: "Not specified",
    });
    if (!parsed.success) {
      setNotice("Tell us your main goal in a few words.");
      return;
    }
    setLoading(true);
    try {
      await create(parsed.data);
      setGoal("");
    } finally {
      setLoading(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!project || !input.trim() || loading) return;
    if (!unlocked) {
      setNotice(
        "Your free starter plan is ready. Follow-up AI planning becomes available with an unlocked cloud room.",
      );
      return;
    }
    const clean = input.trim();
    setLoading(true);
    setNotice("");
    try {
      const data = await api("/api/chat", {
        projectId: project.id,
        message: clean,
      });
      const updated = {
        ...project,
        messages: [
          ...project.messages,
          { role: "user" as const, content: clean },
          { role: "assistant" as const, content: data.message },
        ],
        updated_at: new Date().toISOString(),
      };
      persist(projects.map((p) => (p.id === updated.id ? updated : p)));
      setInput("");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Could not continue the plan.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function checkout(plan: "single" | "pro") {
    if (!project || !cap.checkout || !cap.ai) {
      setNotice(
        "Test checkout is not available yet. Keep exploring your free preview.",
      );
      return;
    }
    if (!cap.user?.email) {
      window.location.assign(
        `/account?next=${encodeURIComponent(`/chat?project=${project.id}`)}`,
      );
      return;
    }
    setCheckoutBusy(true);
    try {
      let id = project.id;
      const cloud = (await api("/api/projects")).projects;
      if (!cloud.some((p: Project) => p.id === id)) {
        const saved = await api("/api/projects", project.brief);
        id = saved.project.id;
        persist(projects.map((p) => (p.id === project.id ? saved.project : p)));
        setActive(id);
      }
      const data = await api("/api/checkout", { plan, projectId: id });
      window.location.assign(data.url);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Checkout is unavailable.");
      setCheckoutBusy(false);
    }
  }
  function download() {
    if (!project) return;
    const body = `${project.title}\n\n${project.messages.map((m) => `${m.role === "assistant" ? "Roomwise" : "You"}\n${m.content}`).join("\n\n")}\n\nEstimates and assumptions require checking with local professionals.`;
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `roomwise-${project.brief.room.toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="workspace">
      <aside className={sidebar ? "side open" : "side"}>
        <div className="sideHead">
          <Link href="/" className="brand">
            <span className="brandMark">R</span> roomwise
          </Link>
          <button
            onClick={() => {
              setActive("");
              setSidebar(false);
              setNotice("");
            }}
            aria-label="New room"
          >
            <Plus />
          </button>
        </div>
        <p className="sideLabel">YOUR ROOMS</p>
        <div className="projectList">
          {projects.map((p) => (
            <button
              className={p.id === active ? "active" : ""}
              key={p.id}
              onClick={() => {
                setActive(p.id);
                setSidebar(false);
                setNotice("");
              }}
            >
              <span>{p.title}</span>
              <small>
                {p.paid && p.storage === "cloud"
                  ? "Unlocked room"
                  : p.storage === "cloud"
                    ? "Cloud starter preview"
                    : "Browser starter preview"}
              </small>
            </button>
          ))}
        </div>
        <div className="storageLabel">
          {cap.storage === "cloud" ? (
            <Cloud size={15} />
          ) : (
            <HardDrive size={15} />
          )}
          <span>
            {cap.storage === "cloud"
              ? "Cloud saving connected"
              : "Saved on this browser"}
          </span>
        </div>
        <Link href="/account" className="account">
          <div className="avatar">Y</div>
          <div>
            <b>{cap.user?.email || "Your workspace"}</b>
            <small>
              {cap.user?.email
                ? "Account & billing"
                : "Create account or sign in"}
            </small>
          </div>
        </Link>
      </aside>
      <section className="chatArea">
        <header className="chatHead">
          <button
            className="menu"
            onClick={() => setSidebar(!sidebar)}
            aria-label="Open room list"
          >
            <Menu />
          </button>
          <div>
            <b>{project?.title || "Your next room"}</b>
            <span>
              {unlocked ? (
                <>
                  <i /> Unlocked room
                </>
              ) : cap.ai ? (
                "Starter preview · AI connected"
              ) : (
                "Guided starter preview"
              )}
            </span>
          </div>
          <div className="workspaceActions">
            {project && (
              <button onClick={download} aria-label="Download text plan">
                <Download size={16} />
              </button>
            )}
            <Link href="/" aria-label="Back to home">
              <ArrowLeft size={16} />
            </Link>
          </div>
        </header>
        {notice && (
          <div className="workspaceNotice" role="status">
            {notice}
          </div>
        )}
        <div className="thread" ref={thread}>
          {!ready ? (
            <p className="briefNote">Opening your workspace…</p>
          ) : !project ? (
            <div className="welcome">
              <div className="agentOrb">
                <Sparkles />
              </div>
              <p className="kicker">YOUR WORKSPACE</p>
              <h1>
                One room.
                <br />
                <em>One clearer next step.</em>
              </h1>
              <p>
                Describe the room and what you want to improve. One free test is included per account. Choose a Room Pass or Pro to continue.
              </p>
              <form className="workspaceBrief" onSubmit={start}>
                <label>
                  Room
                  <select
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                  >
                    {[
                      "Kitchen",
                      "Bathroom",
                      "Living room",
                      "Bedroom",
                      "Other",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Budget & currency
                  <input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    maxLength={100}
                    placeholder="e.g. €5,000"
                  />
                </label>
                <label className="full">
                  Main goal
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    required
                    minLength={3}
                    maxLength={2000}
                    placeholder="More storage, keep the floor, avoid major work…"
                  />
                </label>
                <button className="primary wide full" disabled={loading}>
                  {cap.user?.pro_active ? "Create my room plan" : cap.user?.free_trial_used ? "Create a room" : "Use my free test"} <ArrowRight size={16} />
                </button>
              </form>
            </div>
          ) : project.messages.length === 0 ? (
            <p>
              Your room is saved. Choose a Room Pass below to start planning, or upgrade to Pro.
            </p>
          ) : (
            project.messages.map((m, i) => (
              <div className={`message ${m.role}`} key={i}>
                <span>{m.role === "assistant" ? "Roomwise" : "You"}</span>
                <div>
                  {m.content.split("\n").map((line, j) => (
                    <p key={j}>{line || <br />}</p>
                  ))}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="thinking">
              <i />
              <i />
              <i /> Preparing your plan
            </div>
          )}
        </div>
        {project && !unlocked && (
          <div className="unlockCard">
            <div>
              <LockKeyhole size={18} />
              <span>
                <b>{project.messages.length ? "Your starter plan is ready." : "Ready to plan this room?"}</b>
                <small>
                  {cap.checkout && cap.ai
                    ? "Continue this room with a test Room Pass."
                    : "Test checkout is not available yet. Download your preview to keep it."}
                </small>
              </span>
            </div>
            <button
              className="primary"
              disabled={!cap.checkout || !cap.ai || checkoutBusy}
              onClick={() => checkout("single")}
            >
              {checkoutBusy ? "Opening…" : "Unlock room · $5"}
              <ArrowRight size={15} />
            </button>
            {cap.checkout && cap.ai && (
              <button
                className="proLink"
                onClick={() => checkout("pro")}
                disabled={checkoutBusy}
              >
                Multiple rooms? Pro · $50/month
              </button>
            )}
          </div>
        )}
        {project && (
          <form className="composer" onSubmit={submit}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={4000}
              placeholder={
                unlocked
                  ? "What would you like to refine?"
                  : "Your starter preview is ready. Unlock a room for follow-up planning."
              }
              disabled={!unlocked}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div>
              <span className="composerHint">
                {unlocked ? (
                  <>
                    <Check size={13} /> Private room conversation
                  </>
                ) : (
                  "Free preview · no card required"
                )}
              </span>
              <small>{input.length}/4,000</small>
              <button
                className="send"
                aria-label="Send"
                disabled={!unlocked || !input.trim() || loading}
              >
                <ArrowUp />
              </button>
            </div>
          </form>
        )}
        <p className="disclaimer">
          Plans are guidance. Verify measurements, costs and regulated work with
          qualified local professionals.
        </p>
      </section>
    </main>
  );
}
