"use client";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/browser-storage";
export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void api("/api/session")
      .then((c) => {
        setEnabled(c.email);
        if (c.user?.email) setEmail(c.user.email);
      })
      .catch(() => setStatus("Cloud sign-in is temporarily unavailable."))
      .finally(() => setLoaded(true));
    const reason = new URLSearchParams(window.location.search).get("error");
    if (reason)
      setStatus(
        reason === "expired"
          ? "This sign-in link has expired. Request a fresh one."
          : "Sign-in is temporarily unavailable. Your browser copy is safe.",
      );
  }, []);
  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      await api("/api/auth/email", { email });
      setStatus(
        "Check your inbox for a private sign-in link. It expires in 15 minutes.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not send a link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="accountPage">
      <Link href="/chat" className="accountBack">
        <ArrowLeft /> Back to workspace
      </Link>
      <section className="accountCard">
        <Link href="/" className="brand">
          <span className="brandMark">R</span> roomwise
        </Link>
        <div className="mailIcon">
          <Mail />
        </div>
        <p className="kicker">YOUR SAVED ROOMS</p>
        <h1>
          Pick up where
          <br />
          <em>you left off.</em>
        </h1>
        <p>
          {loaded && !enabled
            ? "Email sign-in is not available yet. Your starter previews stay on this browser, and you can download a text copy from your workspace."
            : "No password to remember. We’ll email a secure link to your cloud projects."}
        </p>
        <form onSubmit={signIn}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={!enabled}
          />
          <button className="primary wide" disabled={!enabled || busy}>
            {busy ? "Sending…" : "Email my sign-in link"}
            <ArrowRight />
          </button>
        </form>
        {status && (
          <div className="accountStatus" role="status">
            {status}
          </div>
        )}
        <Link className="textLink" href="/chat">
          Return to my free workspace <ArrowRight size={15} />
        </Link>
        <small>
          Only requested sign-in messages are sent. Sign-in links expire after
          15 minutes.
        </small>
      </section>
    </main>
  );
}
