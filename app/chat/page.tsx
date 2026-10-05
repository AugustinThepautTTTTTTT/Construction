"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Avatar, Dialog } from "@base-ui-components/react";
import { ArrowLeft, ArrowUp, ImagePlus, Menu, Paperclip, Plus, Sparkles } from "lucide-react";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };
type Project = { id: string; title: string; updated: string };

const starterProjects: Project[] = [
  { id: "welcome", title: "Your first room", updated: "Just now" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState(starterProjects);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const draft = localStorage.getItem("roomwise:draft");
    if (draft) { setInput(draft); localStorage.removeItem("roomwise:draft"); }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = input.trim();
    if (!clean || loading || clean.length > 4000) return;
    const next = [...messages, { role: "user" as const, content: clean }];
    setMessages(next); setInput(""); setLoading(true);
    if (messages.length === 0) setProjects([{ id: crypto.randomUUID(), title: clean.slice(0, 34), updated: "Just now" }, ...projects]);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create a plan");
      setMessages([...next, { role: "assistant", content: data.message }]);
    } catch (error) {
      setMessages([...next, { role: "assistant", content: error instanceof Error ? error.message : "Something went wrong. Please try again." }]);
    } finally { setLoading(false); }
  }

  function newProject() { setMessages([]); setInput(""); setSidebar(false); }

  return <main className="workspace">
    <aside className={sidebar ? "side open" : "side"}>
      <div className="sideHead"><Link href="/" className="brand"><span className="brandMark">R</span> roomwise</Link><button onClick={newProject} aria-label="New project"><Plus/></button></div>
      <p className="sideLabel">PROJECTS</p>
      <div className="projectList">{projects.map((project, i) => <button className={i===0?"active":""} key={project.id}><span>{project.title}</span><small>{project.updated}</small></button>)}</div>
      <Link href="/account" className="account"><Avatar.Root className="avatar"><Avatar.Fallback>Y</Avatar.Fallback></Avatar.Root><div><b>Your account</b><small>Room Pass · 1 project</small></div></Link>
    </aside>
    <section className="chatArea">
      <header className="chatHead"><button className="menu" onClick={()=>setSidebar(!sidebar)}><Menu/></button><div><b>{messages[0]?.content.slice(0, 42) || "New room project"}</b><span><i/> Room planner ready</span></div><Link href="/" aria-label="Back to home"><ArrowLeft/></Link></header>
      <div className="thread">
        {messages.length === 0 ? <div className="welcome"><div className="agentOrb"><Sparkles/></div><p className="kicker">YOUR ROOM PLANNER</p><h1>What would you like<br/><em>to change?</em></h1><p>Tell me about the room, what isn’t working, and what a great result would feel like. Add photos if you have them.</p><div className="suggestions">{["Redesign my small kitchen", "Plan a full bathroom remodel", "Make my living room feel warmer"].map(x=><button key={x} onClick={()=>setInput(x)}>{x}<ArrowUp/></button>)}</div></div> : messages.map((message,index)=><div className={`message ${message.role}`} key={index}><span>{message.role === "assistant" ? "Roomwise" : "You"}</span><div>{message.content.split("\n").map((line,i)=><p key={i}>{line || <br/>}</p>)}</div></div>)}
        {loading && <div className="thinking"><i/><i/><i/> Thinking through your room</div>}
      </div>
      <form className="composer" onSubmit={submit}><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple/><textarea value={input} onChange={e=>setInput(e.target.value)} maxLength={4000} placeholder="Describe your room, goals, style, budget…" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/><div><span><button type="button" onClick={()=>fileRef.current?.click()} aria-label="Add photos"><ImagePlus/></button><button type="button" onClick={()=>fileRef.current?.click()} aria-label="Attach a file"><Paperclip/></button></span><small>{input.length}/4,000</small><button className="send" aria-label="Send" disabled={!input.trim()||loading}><ArrowUp/></button></div></form>
      <p className="disclaimer">Roomwise can make mistakes. Verify dimensions and consult qualified professionals for regulated work.</p>
    </section>
    <Dialog.Root open={false}><Dialog.Portal/></Dialog.Root>
  </main>;
}
