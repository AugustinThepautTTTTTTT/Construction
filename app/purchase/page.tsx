"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "@/lib/browser-storage";
import { briefSchema } from "@/lib/domain";

export default function PurchasePage() {
  const started = useRef(false);
  const [plan, setPlan] = useState<"basic" | "pro">("basic");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  async function openCheckout(selected: "basic" | "pro") {
    setBusy(true);
    setError("");
    try {
      const session = await api("/api/session");
      if (!session.user?.email) {
        window.location.replace(`/account?next=${encodeURIComponent(`/purchase?plan=${selected}`)}`);
        return;
      }
      const cache = `roomwise:purchase:${session.user.id}:${selected}`;
      let id: string | null = null;
      try { id = sessionStorage.getItem(cache); } catch {}
      if (id) {
        try {
          const saved = await api(`/api/projects?id=${id}`);
          if (saved.project.paid) id = null;
        } catch { id = null; }
      }
      if (!id) {
        let draft: unknown;
        try { draft = JSON.parse(localStorage.getItem("roomwise:brief") || "null"); } catch {}
        const brief = briefSchema.safeParse(draft);
        const saved = await api("/api/projects", brief.success ? brief.data : {
          room: "Other", goal: "Help me plan my room. Ask about my goals, budget and dimensions first.",
          budget: "Not set", size: "Not measured", location: "Not specified",
        });
        id = saved.project.id;
        try { sessionStorage.setItem(cache, id!); } catch {}
      }
      const checkout = await api("/api/checkout", {plan: selected, projectId: id});
      window.location.assign(checkout.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout could not be opened. Please try again.");
      setBusy(false);
    }
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const selected = new URLSearchParams(window.location.search).get("plan") === "pro" ? "pro" : "basic";
    setPlan(selected);
    void openCheckout(selected);
  }, []);
  return <main className="accountPage"><section className="accountCard">
    <Link href="/" className="brand"><span className="brandMark">R</span>roomwise</Link>
    <p className="kicker">ACCOUNT → SECURE CHECKOUT → YOUR WORKSPACE</p>
    <h1>{plan === "pro" ? "Roomwise Pro" : "Roomwise Basic"}</h1>
    <p>{plan === "pro" ? "$50/month · 350 credits · cancel anytime" : "$5/month · 30 credits · cancel anytime"}</p>
    <p><ShieldCheck size={16}/> Stripe test checkout. No real charge in this PoC.</p>
    {busy ? <p role="status">Opening your secure checkout…</p> : <>
      <p role="alert" className="formError">{error}</p>
      <button className="primary wide" onClick={() => void openCheckout(plan)}>Try checkout again <ArrowRight size={16}/></button>
    </>}
    <Link href="/chat" className="textLink">Back to my workspace</Link>
  </section></main>;
}
