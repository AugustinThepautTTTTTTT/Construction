"use client";

import { useState } from "react";
import { Accordion, Dialog } from "@base-ui-components/react";
import { ArrowRight, Check, ChevronDown, Hammer, Layers3, Sparkles, Upload, WandSparkles } from "lucide-react";
import Link from "next/link";

const outcomes = [
  { icon: WandSparkles, title: "See the room", text: "Mood, layout and visual direction shaped around how you actually live." },
  { icon: Layers3, title: "Know the work", text: "A sequenced scope, shopping list and practical trade notes." },
  { icon: Hammer, title: "Control the spend", text: "A realistic budget range with priorities and places to save." },
];

const faqs = [
  ["What do I receive?", "Exactly what you ask for: visual concepts, layout guidance, an itemized budget, a work schedule, or the complete room plan."],
  ["Do I need measurements?", "No. Start with a photo and a description. Roomwise will ask only for missing details that materially improve the answer."],
  ["Is this a replacement for an architect?", "No. Roomwise helps you explore and plan. Structural, electrical, gas and permit-sensitive work must be validated by licensed local professionals."],
  ["How does the $5 pass work?", "It unlocks one complete room project. Your conversation stays available so you can return to the plan."],
];

export default function Home() {
  const [brief, setBrief] = useState("");
  const [open, setOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const begin = () => {
    if (brief.trim()) localStorage.setItem("roomwise:draft", brief.trim());
    setOpen(true);
  };

  const checkout = async (plan: "single" | "pro") => {
    setCheckoutError("");
    const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else setCheckoutError("Checkout needs your Stripe keys. You can still preview the workspace.");
  };

  return (
    <main>
      <header className="nav wrap">
        <Link href="/" className="brand"><span className="brandMark">R</span> roomwise</Link>
        <nav><a href="#how">How it works</a><a href="#pricing">Pricing</a></nav>
        <Link className="navCta" href="/chat">Open workspace <ArrowRight size={15} /></Link>
      </header>

      <section className="hero wrap">
        <div className="eyebrow"><Sparkles size={14} /> Your room, figured out</div>
        <h1>From “what if?” to<br/><em>here’s the plan.</em></h1>
        <p className="heroCopy">Share a photo. Describe what you want. Get a thoughtful room concept, realistic budget and step-by-step plan—without the weeks of back-and-forth.</p>
        <div className="promptCard">
          <textarea aria-label="Describe your room" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="I want to turn our dark, narrow kitchen into a warm space where four people can cook and eat…" />
          <div className="promptFooter">
            <button className="upload" type="button"><Upload size={17} /> Add room photos</button>
            <button className="primary" onClick={begin}>Plan my room <ArrowRight size={17} /></button>
          </div>
        </div>
        <div className="micro"><span><Check size={14}/> No design experience needed</span><span><Check size={14}/> Your plan in minutes</span><span><Check size={14}/> From $5, once</span></div>
      </section>

      <section className="visual wrap" aria-label="Example room transformation">
        <div className="room roomBefore"><span>Before</span></div>
        <div className="resultCard">
          <div className="resultTop"><span className="pulse"/> Room plan ready</div>
          <h3>Warm minimal kitchen</h3>
          <div className="resultStat"><b>$12.4–16.8k</b><small>estimated budget</small></div>
          <div className="resultRow"><span>01</span><p><b>Open the sightline</b><br/>Remove upper units on the east wall</p></div>
          <div className="resultRow"><span>02</span><p><b>Add a social island</b><br/>210 × 90 cm, seats three</p></div>
          <div className="resultRow"><span>03</span><p><b>Warm the palette</b><br/>Oak, chalk and brushed steel</p></div>
        </div>
        <div className="room roomAfter"><span>Concept</span></div>
      </section>

      <section id="how" className="how wrap section">
        <div><p className="kicker">One conversation. A complete direction.</p><h2>Less guessing.<br/><em>More doing.</em></h2></div>
        <div className="steps">
          <article><b>01</b><h3>Show & tell</h3><p>Add photos, measurements if you have them, and explain the change you want.</p></article>
          <article><b>02</b><h3>Refine together</h3><p>Your agent asks a few smart questions—only where the answer genuinely matters.</p></article>
          <article><b>03</b><h3>Leave with a plan</h3><p>Get the visuals, scope, budget and schedule you need to confidently take the next step.</p></article>
        </div>
      </section>

      <section className="outcomes section">
        <div className="wrap"><p className="kicker">Useful, not overwhelming</p><h2>Everything your project needs.<br/><em>Nothing it doesn’t.</em></h2>
          <div className="outcomeGrid">{outcomes.map(({icon: Icon,title,text}) => <article key={title}><Icon/><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section id="pricing" className="pricing wrap section">
        <div className="priceIntro"><p className="kicker">Simple pricing</p><h2>One room.<br/><em>One clear answer.</em></h2><p>No hourly rates. No mystery invoice. Choose the access that fits your work.</p></div>
        <article className="priceCard"><span className="plan">ROOM PASS</span><div className="amount"><sup>$</sup>5</div><p>One-time payment for one complete room project.</p><ul><li><Check/>Full planning conversation</li><li><Check/>Photos and files</li><li><Check/>Visuals, budget & schedule</li><li><Check/>Project saved to your account</li></ul><button className="primary wide" onClick={begin}>Start one room <ArrowRight/></button></article>
        <article className="priceCard dark"><span className="plan">PRO</span><div className="amount"><sup>$</sup>50<small>/mo</small></div><p>For designers, contractors and active renovators.</p><ul><li><Check/>Up to 30 active projects</li><li><Check/>Priority generations</li><li><Check/>Client-ready exports</li><li><Check/>Commercial usage</li></ul><button className="lightButton" onClick={begin}>Choose Pro <ArrowRight/></button></article>
      </section>

      <section className="faq wrap section"><div><p className="kicker">Good to know</p><h2>Questions,<br/><em>answered.</em></h2></div><Accordion.Root className="accordion">{faqs.map(([q,a]) => <Accordion.Item key={q} value={q}><Accordion.Header><Accordion.Trigger>{q}<ChevronDown/></Accordion.Trigger></Accordion.Header><Accordion.Panel>{a}</Accordion.Panel></Accordion.Item>)}</Accordion.Root></section>

      <section className="finalCta"><div className="wrap"><Sparkles/><h2>Your room has potential.<br/><em>Let’s make it practical.</em></h2><button className="primary" onClick={begin}>Plan my room for $5 <ArrowRight/></button></div></section>
      <footer className="wrap"><Link href="/" className="brand"><span className="brandMark">R</span> roomwise</Link><p>AI planning for considered spaces.</p><span>© 2026 Roomwise</span></footer>

      <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Backdrop className="backdrop"/><Dialog.Popup className="dialog"><Dialog.Title>Choose your access</Dialog.Title><Dialog.Description>Your room brief is saved. Pay securely with Stripe, then continue straight to your planner.</Dialog.Description><button onClick={()=>checkout("single")} className="primary wide">Room Pass · $5 once <ArrowRight/></button><button onClick={()=>checkout("pro")} className="modalPro">Pro · $50/month <ArrowRight/></button>{checkoutError && <p className="checkoutError">{checkoutError} <Link href="/chat">Preview workspace →</Link></p>}<Dialog.Close className="dialogClose">Not yet</Dialog.Close></Dialog.Popup></Dialog.Portal></Dialog.Root>
    </main>
  );
}
