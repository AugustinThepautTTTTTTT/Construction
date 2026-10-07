"use client";
import "./account.css";
import { AccountSettings, type Account } from "@/components/account-settings";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  User,
} from "lucide-react";
import { api } from "@/lib/browser-storage";
import { safeNext } from "@/lib/domain";
export default function AccountPage() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(
    "signup",
  );
  const [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState("");
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [enabled, setEnabled] = useState(false),
    [mail, setMail] = useState(false),
    [account, setAccount] = useState<Account | null>(null);
  const [reset, setReset] = useState(""),
    [next, setNext] = useState("/chat");
  async function refresh() {
    const c = await api("/api/session");
    setEnabled(c.accounts);
    setMail(c.email);
    if (c.user?.email) {
      const a = await api("/api/account");
      setAccount(a);
      setName(a.user.name || "");
      setEmail(a.user.email);
    } else setAccount(null);
  }
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const destination = safeNext(q.get("next"));
    setNext(destination);
    if (q.get("mode") === "login") setMode("login");
    const token = q.get("reset");
    if (token) {
      setReset(token);
      setMode("reset");
      window.history.replaceState(null, "", "/account");
    }
    if (q.get("error"))
      setStatus(
        "That sign-in link is unavailable. Sign in or request a fresh link.",
      );
    void refresh().then(() => api("/api/session")).then((c) => {
      if (c.user?.email && q.get("next") && !token) window.location.assign(destination);
    })
      .catch(() => setStatus("Account saving is temporarily unavailable."))
      .finally(() => setLoaded(true));
  }, []);
  async function action(task: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await task();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void action(async () => {
      if (mode === "forgot") {
        await api("/api/auth/reset", { email });
        setStatus(
          "If an account exists for this email, a recovery link will arrive shortly.",
        );
      } else if (mode === "reset") {
        await api("/api/auth/reset", { token: reset, password });
        setMode("login");
        setReset("");
        setPassword("");
        setStatus("Password reset. Sign in with your new password.");
      } else {
        await api("/api/auth/credentials", { mode, email, password, name });
        setPassword("");
        window.location.assign(next);
      }
    });
  }
  async function logout(all = false) {
    await api("/api/auth/logout", { all });
    if (account)
      localStorage.removeItem(`roomwise:cloud-cache:${account.user.id}`);
    setAccount(null);
    setPassword("");
    setName("");
    setEmail("");
    setMode("login");
    setStatus(all ? "Signed out on every device." : "Signed out.");
  }
  if (account && mode !== "reset") return <AccountSettings account={account} mail={mail} onSaved={refresh} onLogout={logout}/>;
  return (
    <main className="accountPage">
      <Link href="/chat" className="accountBack">
        <ArrowLeft />
        Back to workspace
      </Link>
      <section className="accountCard">
        <Link href="/" className="brand">
          <span className="brandMark">R</span>roomwise
        </Link>
        <div className="mailIcon">
          <User />
        </div>
        {
          <>
            <p className="kicker">YOUR SAVED ROOMS</p>
            <h1>
              {mode === "signup"
                ? "Make room for"
                : mode === "login"
                  ? "Welcome"
                  : mode === "reset"
                    ? "A fresh"
                    : "Recover your"}
              <br />
              <em>
                {mode === "signup"
                  ? "your next idea."
                  : mode === "login"
                    ? "back."
                    : mode === "reset"
                      ? "start."
                      : "workspace."}
              </em>
            </h1>
            <p>
              {mode === "signup"
                ? "Create your account to save rooms across devices and keep your test purchases."
                : mode === "login"
                  ? "Sign in to your saved rooms and planning conversations."
                  : mode === "reset"
                    ? "Choose a new password. Existing sessions will be signed out."
                    : "We’ll email a recovery link if this address has an account."}
            </p>
            {(mode === "signup" || mode === "login") && (
              <div className="accountTabs">
                <button
                  type="button"
                  aria-pressed={mode === "signup"}
                  onClick={() => {
                    setMode("signup");
                    setStatus("");
                  }}
                >
                  Create account
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "login"}
                  onClick={() => {
                    setMode("login");
                    setStatus("");
                  }}
                >
                  Sign in
                </button>
              </div>
            )}
            <form onSubmit={submit}>
              {mode === "signup" && (
                <>
                  <label htmlFor="name">Your name</label>
                  <input
                    id="name"
                    autoComplete="name"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!enabled}
                  />
                </>
              )}
              {mode !== "reset" && (
                <>
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    maxLength={254}
                    required
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!enabled}
                  />
                </>
              )}
              {mode !== "forgot" && (
                <>
                  <label htmlFor="password">
                    {mode === "login"
                      ? "Password"
                      : "Password · at least 12 characters"}
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    value={password}
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={128}
                    required
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!enabled}
                  />
                </>
              )}
              <button
                className="primary wide"
                disabled={busy || !enabled || (mode === "forgot" && !mail)}
              >
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create my account"
                    : mode === "login"
                      ? "Sign in"
                      : mode === "reset"
                        ? "Reset password"
                        : "Send recovery link"}
                <ArrowRight />
              </button>
            </form>
            {mode === "login" && (
              <button
                className="textLink"
                onClick={() => {
                  setMode("forgot");
                  setStatus("");
                }}
              >
                Forgot your password?
              </button>
            )}
            {mode === "forgot" && (
              <>
                <button className="textLink" onClick={() => setMode("login")}>
                  Back to sign in
                </button>
                {!mail && (
                  <p className="accountHint">
                    Email recovery is not enabled yet. Sign in using your
                    password.
                  </p>
                )}
              </>
            )}
            {mode === "signup" && !mail && (
              <small>
                Email recovery is not enabled yet. Keep your password safe.
              </small>
            )}
            {loaded && !enabled && (
              <p className="accountHint">
                Cloud accounts are temporarily unavailable. Your browser preview
                still works.
              </p>
            )}
          </>
        }
        {status && (
          <div className="accountStatus" role="status">
            {status}
          </div>
        )}
        <Link className="textLink" href="/chat">
          Return to workspace
          <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
