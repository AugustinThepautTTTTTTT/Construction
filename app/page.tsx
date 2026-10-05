"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Accordion } from "@base-ui-components/react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Layers3,
  ShieldCheck,
  Sparkles,
  Wallet,
  MoveRight,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/browser-storage";
import { briefSchema } from "@/lib/domain";
const faqs = [
  [
    "What is free?",
    "Start with a short room brief and receive a guided starter plan. Create an account to use one free starter test. The limit follows your account across rooms and devices. Room Pass and Pro are available directly without taking the test first.",
  ],
  [
    "What does the $5 Room Pass include?",
    "One saved room conversation, follow-up planning, and a downloadable text plan when cloud planning and test checkout are available. It is a one-time purchase, not a subscription.",
  ],
  [
    "Can I try checkout safely?",
    "This PoC uses Stripe test mode only. No real payments are accepted. Test checkout becomes available once payment and cloud-saving connections are active.",
  ],
  [
    "Is this an architect or contractor quote?",
    "No. Roomwise helps you prepare decisions. Estimates and assumptions are labelled. Confirm dimensions, local prices and regulated work with qualified professionals.",
  ],
  [
    "Can I upload photos or get rendered designs?",
    "This version focuses on a text brief and a practical plan. Photo analysis and rendered images are not included.",
  ],
  [
    "Where is my plan saved?",
    "The starter workspace keeps a copy in this browser. When cloud saving is connected, your projects and conversations are stored privately and can be recovered by signing in to your account.",
  ],
];
export default function Home() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    const refresh = () => void api("/api/session").then((s) => { if (live) setSignedIn(Boolean(s.user?.email)); }).catch(() => {});
    refresh();
    window.addEventListener("focus", refresh);
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("revealed"); reveal.unobserve(entry.target); } });
    }, {threshold: 0.12});
    document.querySelectorAll(".salesFunnel .section, .salesFunnel .sampleSection").forEach((el) => { el.classList.add("reveal"); reveal.observe(el); });
    return () => { live = false; window.removeEventListener("focus", refresh); reveal.disconnect(); };
  }, []);
  const [room, setRoom] = useState("Kitchen");
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("");
  const [size, setSize] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  function begin(e: FormEvent) {
    e.preventDefault();
    const result = briefSchema.safeParse({
      room,
      goal,
      budget: budget || "Not set",
      size: size || "Not measured",
      location: location || "Not specified",
    });
    if (!result.success) {
      setError("Tell us what you want to change in a few words.");
      return;
    }
    try {
      localStorage.setItem("roomwise:brief", JSON.stringify(result.data));
      router.push(signedIn ? "/chat?new=1" : "/account?next=%2Fchat%3Fnew%3D1");
    } catch {
      setError("Enable browser storage to keep your free plan.");
    }
  }
  return (
    <main className="salesFunnel">
      <header className="nav wrap">
        <Link href="/" className="brand">
          <span className="brandMark">R</span> roomwise
        </Link>
        <nav>
          <a href="#how">How it works</a>
          <a href="#sample">See a sample</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <Link className="navCta" href={signedIn ? "/chat" : "/account?mode=login"}>
          {signedIn ? "My workspace" : "Sign in"} <ArrowRight size={15} />
        </Link>
      </header>
      <section className="funnelHero wrap">
        <div className="heroWords">
          <div className="eyebrow">
            <Sparkles size={14} /> YOUR NEXT ROOM STARTS HERE
          </div>
          <h1>
            Know what
            <br />
            to change.
            <br />
            <em>Before you spend.</em>
          </h1>
          <p className="heroCopy">
            You have the vision. Get the plan to move it forward: what to keep, where to spend, and what to do first. One room from $5. A whole-home mindset with Pro.
          </p>
          <div className="heroActions">
            <Link className="primary" href="/purchase?plan=single">Plan my room · $5 <ArrowRight size={17}/></Link>
            <Link className="secondary" href="/purchase?plan=pro">Go Pro · $50/month <ArrowRight size={17}/></Link>
          </div>
          <div className="heroTrust">
            <span>
              <Check size={15} /> One-time Room Pass
            </span>
            <span>
              <Check size={15} /> Secure Stripe checkout
            </span>
          </div>
          <a className="textLink" href="#sample">
            See what a starter plan looks like <MoveRight size={16} />
          </a>
        </div>
        <div className="heroScene" aria-label="Illustrative interior and sample planning priorities">
          <div className="heroScenePhoto roomAfter"/>
          <div className="sceneLabel"><Sparkles size={14}/> YOUR IDEA. A CLEARER DIRECTION.</div>
          <div className="floatingPlan"><span className="kicker">EXAMPLE ROOM PRIORITIES</span><h3>Keep what works.<br/><em>Make space for better.</em></h3>
            <div><Check size={16}/> Smarter storage</div><div><Check size={16}/> Warmer lighting</div><div><Check size={16}/> A practical work sequence</div>
          </div>
          <div className="scenePrice"><b>$5</b><span>One room.<br/>One clear next step.</span></div>
          <span className="sceneCaption">Illustrative photo · sample priorities</span>
        </div>
      </section>
      <section id="sample" className="sampleSection wrap">
        <div className="sampleRoom">
          <div className="room roomAfter">
            <span>Illustrative interior photo</span>
          </div>
          <p>A direction to discuss—not a promised before-and-after.</p>
        </div>
        <article className="samplePlan">
          <p className="kicker">SAMPLE OUTPUT · NOT A QUOTE</p>
          <h2>
            A warmer kitchen.
            <br />
            <em>Less disruption.</em>
          </h2>
          <div className="sampleMeta">
            <span>12 m²</span>
            <span>€5,000 target</span>
            <span>Keep existing services</span>
          </div>
          <ol>
            <li>
              <b>Keep the costly foundations</b>
              <p>
                Assess cabinet condition and retain plumbing locations where
                practical.
              </p>
            </li>
            <li>
              <b>Put storage and lighting first</b>
              <p>
                Measure circulation, identify unused space and compare finish
                samples.
              </p>
            </li>
            <li>
              <b>Price the work before committing</b>
              <p>
                Split materials and labour; obtain local quotes and keep a
                contingency.
              </p>
            </li>
          </ol>
          <div className="sampleAssumption">
            <ShieldCheck size={18} />
            <span>
              Assumption: no structural work. Costs and site conditions require
              checking.
            </span>
          </div>
        </article>
      </section>
      <section id="how" className="how wrap section">
        <div>
          <p className="kicker">FROM IDEA TO ACTION</p>
          <h2>
            Less guessing.
            <br />
            <em>More direction.</em>
          </h2>
        </div>
        <div className="steps">
          <article>
            <b>01</b>
            <h3>Choose your plan</h3>
            <p>
              Pick a $5 Room Pass for one room or $50/month Pro for multiple projects.
            </p>
          </article>
          <article>
            <b>02</b>
            <h3>Create your account & pay</h3>
            <p>
              Keep your rooms together with one login. Continue straight to secure Stripe test checkout.
            </p>
          </article>
          <article>
            <b>03</b>
            <h3>Make your next move</h3>
            <p>
              Describe your goals in your workspace. Build priorities, ask follow-up questions, and download your plan.
            </p>
          </article>
        </div>
      </section>
      <section className="outcomes section">
        <div className="wrap">
          <p className="kicker">BUILT AROUND THE DECISIONS THAT MATTER</p>
          <h2>
            Spend with a plan.
            <br />
            <em>Not a guess.</em>
          </h2>
          <div className="outcomeGrid">
            {[
              {
                Icon: Layers3,
                title: "A practical scope",
                text: "Separate essential changes from nice-to-haves and keep useful existing finishes.",
              },
              {
                Icon: Wallet,
                title: "Budget priorities",
                text: "Make your budget explicit and identify what needs a quote before buying.",
              },
              {
                Icon: ShieldCheck,
                title: "Clear assumptions",
                text: "See where measurements, local prices and professional advice are still needed.",
              },
            ].map(({ Icon, title, text }) => (
              <article key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section id="pricing" className="pricing wrap section">
        <div className="priceIntro">
          <p className="kicker">YOUR ROOM. YOUR NEXT MOVE.</p>
          <h2>
            One room.
            <br />
            <em>A simple next step.</em>
          </h2>
          <p>
            Choose the plan that matches your project. Create your account, complete Stripe checkout, and get to work. This PoC uses test payments only.
          </p>
          <a className="textLink" href="#brief">
            Prefer a test? One free plan per account <ArrowRight size={16} />
          </a>
        </div>
        <article className="priceCard featured">
          <span className="plan">ROOM PASS · ONE-TIME</span>
          <div className="amount">
            <sup>$</sup>5
          </div>
          <p>For one room you want to think through properly.</p>
          <ul>
            <li>
              <Check />
              One saved room conversation
            </li>
            <li>
              <Check />
              Follow-up planning
            </li>
            <li>
              <Check />
              Scope, priorities and sequence
            </li>
            <li>
              <Check />
              Download your text plan
            </li>
          </ul>
          <Link className="primary wide" href="/purchase?plan=single">
            Get my Room Pass · $5 <ArrowRight size={16} />
          </Link>
          <small className="priceFootnote">No recurring subscription.</small>
        </article>
        <article className="priceCard">
          <span className="plan">PRO · FOR MULTIPLE ROOMS</span>
          <div className="amount">
            <sup>$</sup>50<small>/mo</small>
          </div>
          <p>For ongoing planning across several projects.</p>
          <ul>
            <li>
              <Check />
              Multiple saved rooms
            </li>
            <li>
              <Check />
              Continue planning across projects
            </li>
            <li>
              <Check />
              Your personal cloud workspace
            </li>
            <li>
              <Check />
              Text plan downloads
            </li>
          </ul>
          <Link className="primary wide" href="/purchase?plan=pro">
            Get Pro · $50/month <ArrowRight size={16} />
          </Link>
          <small className="priceFootnote">
            Test subscription. No real charge in this PoC.
          </small>
        </article>
      </section>
      <section className="trialSection wrap section">
        <div><p className="kicker">A LITTLE CONFIDENCE BEFORE YOU COMMIT</p><h2>Try one room.<br/><em>See your next move.</em></h2><p>One free starter test with your account. Your email keeps your workspace connected and your test stays with you across devices.</p><p className="briefNote">No card for the test. One test per account.</p></div>
        <form id="brief" className="briefCard" onSubmit={begin}>
          <div className="briefTop">
            <span className="stepBadge">01 / YOUR ROOM</span>
            <span className="freeBadge">One free account test</span>
          </div>
          <h2>
            What would make
            <br />
            <em>your room work better?</em>
          </h2>
          <div className="briefGrid">
            <label>
              Room
              <select value={room} onChange={(e) => setRoom(e.target.value)}>
                {["Kitchen", "Bathroom", "Living room", "Bedroom", "Other"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
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
          </div>
          <label htmlFor="goal">The change you want most</label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            minLength={3}
            maxLength={2000}
            required
            placeholder="Our small kitchen needs more storage. I’d like to keep the floor and avoid moving the plumbing."
          />
          <div className="briefGrid">
            <label>
              Size <span>(optional)</span>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                maxLength={100}
                placeholder="e.g. 12 m²"
              />
            </label>
            <label>
              Location <span>(optional)</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
                placeholder="e.g. Mulhouse, France"
              />
            </label>
          </div>
          <button className="primary wide" type="submit">
            {signedIn ? "Use my account’s free test" : "Create account & try free"} <ArrowRight size={17} />
          </button>
          {error && (
            <p className="formError" role="alert">
              {error}
            </p>
          )}
          <p className="briefNote">
            A useful starting point. Estimates labelled. You stay in control.
          </p>
        </form>
      </section>
      <section className="faq wrap section">
        <div>
          <p className="kicker">BEFORE YOU START</p>
          <h2>
            Clear answers.
            <br />
            <em>No surprises.</em>
          </h2>
        </div>
        <Accordion.Root className="accordion">
          {faqs.map(([q, a]) => (
            <Accordion.Item key={q} value={q}>
              <Accordion.Header>
                <Accordion.Trigger>
                  {q}
                  <ChevronDown />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{a}</Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </section>
      <section className="finalCta">
        <div className="wrap">
          <Sparkles />
          <h2>
            Your room has potential.
            <br />
            <em>Start with a plan.</em>
          </h2>
          <Link href="/purchase?plan=single" className="primary">
            Get my Room Pass · $5 <ArrowRight size={17} />
          </Link>
          <p className="briefNote">One payment. Your own workspace. A plan to move forward.</p>
        </div>
      </section>
      <footer className="wrap">
        <Link href="/" className="brand">
          <span className="brandMark">R</span> roomwise
        </Link>
        <p>Practical planning for considered spaces.</p>
        <span>© 2026 Roomwise · Test PoC</span>
      </footer>
    </main>
  );
}
