"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("");
    const supabase = createClient();
    if (!supabase) { setStatus("Add your Supabase keys to enable passwordless sign-in."); setBusy(false); return; }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/chat` } });
    setStatus(error ? error.message : "Check your inbox for your private sign-in link."); setBusy(false);
  }

  return <main className="accountPage"><Link href="/" className="accountBack"><ArrowLeft/> Back</Link><section className="accountCard"><Link href="/" className="brand"><span className="brandMark">R</span> roomwise</Link><div className="mailIcon"><Mail/></div><p className="kicker">YOUR WORKSPACE</p><h1>Pick up where<br/><em>you left off.</em></h1><p>No password to remember. We’ll email you one secure link to your projects.</p><form onSubmit={signIn}><label htmlFor="email">Email address</label><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/><button className="primary wide" disabled={busy}>{busy ? "Sending…" : "Email my sign-in link"}<ArrowRight/></button></form>{status && <div className="accountStatus">{status}</div>}<small>By continuing, you agree to keep professional safety checks part of every renovation.</small></section></main>;
}
