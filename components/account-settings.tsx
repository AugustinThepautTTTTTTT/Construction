"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@base-ui-components/react/button";
import { CreditCard } from "lucide-react";
import { api } from "@/lib/browser-storage";
export type Account = {
  user: { id: string; email: string; name: string; pro_active: boolean; email_verified: boolean };
  stats: { rooms: number; unlocked: number }; billingAvailable: boolean; subscription: boolean;
};
function SettingsIcon({ name }: { name: "general" | "security" | "close" }) {
  const size = name === "general" ? [10, 9] : name === "security" ? [9, 9] : [6, 7];
  return <span className="settingsIcon" aria-hidden="true"><img src={`/chat-ui/settings-${name}.svg`} width={size[0]} height={size[1]} alt="" style={{ transform: `scale(${14 / Math.max(...size)})` }}/></span>;
}
export function AccountSettings({ account, mail, onSaved, onLogout }: {
  account: Account; mail: boolean; onSaved: () => Promise<void>; onLogout: (all?: boolean) => Promise<void>;
}) {
  const [tab, setTab] = useState<"general" | "security" | "billing">("general");
  const [name, setName] = useState(account.user.name), [currentPassword, setCurrentPassword] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  async function action(task: () => Promise<void>) {
    setBusy(true); setStatus("");
    try { await task(); } catch (e) { setStatus(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="settingsPage"><section className="settingsWindow" aria-label="Account settings">
    <header className="settingsHeader"><h1>Settings</h1><Link href="/chat" aria-label="Close settings"><SettingsIcon name="close"/></Link></header>
    <div className="settingsLayout"><nav className="settingsNav" aria-label="Settings sections">
      <Button aria-pressed={tab === "general"} onClick={() => { setTab("general"); setStatus(""); }}><SettingsIcon name="general"/>General</Button>
      <Button aria-pressed={tab === "security"} onClick={() => { setTab("security"); setStatus(""); }}><SettingsIcon name="security"/>Security</Button>
      <Button aria-pressed={tab === "billing"} onClick={() => { setTab("billing"); setStatus(""); }}><CreditCard size={15}/>Plan & billing</Button>
    </nav><div className="settingsContent">
      {tab === "general" ? <><h2>General</h2><p className="settingsIntro">Your profile and workspace.</p>
        <form onSubmit={e => { e.preventDefault(); void action(async () => { await api("/api/account", { name }); await onSaved(); setStatus("Profile saved."); }); }}>
          <div className="settingsRow settingsProfileRow"><label htmlFor="settings-name">Name</label><input id="settings-name" autoComplete="name" value={name} maxLength={80} onChange={e => setName(e.target.value)}/></div>
          <div className="settingsRow"><span>Email address</span><span className="settingsValue">{account.user.email}</span></div>
          <div className="settingsRow"><span>Appearance</span><span className="settingsValue">Light</span></div>
          <div className="settingsFormActions"><Button type="submit" className="settingsPrimary" disabled={busy}>Save profile</Button></div>
        </form>
        <div className="settingsRow"><div><span>Your workspace</span><small>{account.stats.rooms} saved rooms · {account.stats.unlocked} room passes</small></div><Link className="settingsPill" href="/chat">Open workspace</Link></div>
        <div className="settingsRow"><span>Log out on this device</span><Button className="settingsPill" disabled={busy} onClick={() => void action(() => onLogout())}>Log out</Button></div>
      </> : tab === "security" ? <><h2>Security</h2><p className="settingsIntro">Keep your account and sessions secure.</p>
        <form className="settingsPassword" onSubmit={e => { e.preventDefault(); void action(async () => { await api("/api/auth/password", { currentPassword, newPassword: password }); setPassword(""); setCurrentPassword(""); setStatus("Password updated. Other devices have been signed out."); }); }}>
          <label htmlFor="settings-current-password">Current password</label><input id="settings-current-password" type="password" autoComplete="current-password" value={currentPassword} maxLength={128} onChange={e => setCurrentPassword(e.target.value)}/>
          <label htmlFor="settings-new-password">New password</label><input id="settings-new-password" type="password" autoComplete="new-password" value={password} minLength={12} maxLength={128} required onChange={e => setPassword(e.target.value)}/><small>Use at least 12 characters.</small>
          <div className="settingsFormActions"><Button type="submit" className="settingsPrimary" disabled={busy}>Update password</Button></div>
        </form>
        <div className="settingsRow"><div><span>Email recovery</span><small>{mail ? "Password recovery is available by email." : "Email recovery is not enabled yet. Keep your password safe."}</small></div></div>
        <div className="settingsRow"><div><span>Log out of all devices</span><small>End every active session, including this one.</small></div><Button className="settingsPill" disabled={busy} onClick={() => void action(() => onLogout(true))}>Log out all</Button></div>
      </> : <><h2>Plan & billing</h2><p className="settingsIntro">Manage access to your room projects.</p>
        <div className="settingsRow"><span>Current plan</span><span className="settingsPlanBadge">{account.user.pro_active ? "Pro" : "Free"}</span></div>
        <div className="settingsRow"><span>Room passes</span><span className="settingsValue">{account.stats.unlocked}</span></div>
        <div className="settingsRow"><div><span>Payments & subscription</span><small>Stripe test mode · no real charges</small></div><Button className="settingsPill" disabled={busy || !account.billingAvailable} onClick={() => void action(async () => { const result = await api("/api/billing/portal", {}); window.location.assign(result.url); })}>Manage billing</Button></div>
        {!account.billingAvailable && <p className="settingsHint">Billing becomes available after your first checkout.</p>}
        {!account.user.pro_active && <div className="settingsRow"><div><span>More room to create</span><small>Pro includes access across your room projects.</small></div><Link href="/purchase?plan=pro" className="settingsPill">Explore Pro</Link></div>}
      </>}
      {status && <p className="settingsStatus" role="status">{status}</p>}
    </div></div>
  </section></main>;
}
