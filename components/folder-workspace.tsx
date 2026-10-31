"use client";
import { useEffect, useState } from "react";
import { Button } from "@base-ui-components/react/button";
import {
  Image,
  ClipboardList,
  MessagesSquare,
  ArrowUpRight,
  Ruler,
  ListChecks,
  CalendarClock,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { materialBills } from "@/lib/material-bills";
import type { Artifact } from "@/lib/room-artifacts";
import type { Workspace } from "@/lib/renovation-workspace";
import { purchaseKey } from "@/lib/renovation-workspace";
import { money } from "@/lib/material-presentation";
import { ProjectMaterials } from "./project-materials";
import { ConstructionPlanView } from "./construction-plan";
import { ProjectVisualGallery } from "./project-visual-gallery";
export function FolderWorkspace({
  id,
  signal,
  unlocked,
  onChat,
}: {
  id: string;
  signal: number;
  unlocked: boolean;
  onChat: (id: string) => void;
}) {
  const [feed, setFeed] = useState<{
      folder: { title: string; description: string };
      chats: { id: string; title: string; paid: boolean }[];
      artifacts: (Artifact & { project_id: string })[];
      workspaces: Record<string, { state: Workspace; revision: number }>;
    } | null>(null),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [focus, setFocus] = useState<{ id: string; index: number | null }>({
      id: "",
      index: null,
    });
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void fetch(`/api/folders?id=${id}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setFeed(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, signal, version]);
  if (!feed)
    return (
      <div className="folderWorkspace" role="status">
        {error || "Opening project…"}
      </div>
    );
  function changed() {
    setVersion((v) => v + 1);
  }
  function show(kind: string, assetId: string, index: number | null) {
    setTab(kind);
    setFocus({ id: assetId, index });
    setTimeout(
      () =>
        document
          .getElementById(`folder-asset-${assetId}`)
          ?.scrollIntoView({ block: "start", behavior: "smooth" }),
      80,
    );
  }
  const displayedArtifacts = feed.artifacts.filter(
    (a) =>
      a.kind !== "estimate" ||
      a.id === focus.id ||
      a.id ===
        materialBills(
          feed.artifacts.filter((other) => other.project_id === a.project_id),
        )[0]?.id,
  );
  const workspaces = Object.values(feed.workspaces || {}).map(({state}) => state);
  const surfaceRecords = displayedArtifacts.filter(a => a.kind === "estimate").flatMap(a =>
    Object.entries(a.data.measurements || {}).filter(([k]) => ["floorArea","wallArea","ceilingArea","perimeter"].includes(k)).map(([key,value]) => ({
      key: a.id + ":" + key, label: ({floorArea:"Floor area",wallArea:"Wall area",ceilingArea:"Ceiling area",perimeter:"Perimeter"} as Record<string,string>)[key],
      value: typeof value === "number" && value > 0 ? value : null,
      verified: Boolean(a.data.measurements?.confirmed),
      unit: key === "perimeter" ? "m" : "m²",
    }))
  );
  const fixtureRecords = workspaces.flatMap(state => state.measurements);
  const measurementTotal = surfaceRecords.length + fixtureRecords.length;
  const measurementRecorded = surfaceRecords.filter(m => m.value !== null).length + fixtureRecords.filter(m => m.value !== null).length;
  const measurementVerified = surfaceRecords.filter(m => m.verified && m.value !== null).length + fixtureRecords.filter(m => m.confidence === "verified").length;
  const decisions = workspaces.flatMap(state => state.decisions);
  const confirmedDecisions = decisions.filter(d => d.status === "confirmed");
  const openDecisions = decisions.filter(d => d.status === "proposed");
  const bills = displayedArtifacts.filter(a => a.kind === "estimate");
  const billRows = bills.flatMap(a => (a.data.calculations?.items || []).map((item: {index:number;item:string;quantity:number;unit:string;basis:string}) => {
    const state = feed.workspaces?.[a.project_id]?.state;
    const purchase = state?.purchases?.[purchaseKey(a.id,item.index)];
    const confirmed = Boolean(a.data.measurements?.confirmed) && !a.data.calculations?.provisional;
    const status = purchase?.status || (item.basis === "manual" || confirmed ? "ready" : "needs_measurements");
    return {...item, status, purchase, billId:a.id,projectId:a.project_id};
  }));
  const shoppingReady = billRows.filter(r => r.status === "ready").length;
  const shoppingPending = billRows.filter(r => r.status === "needs_measurements").length;
  const purchased = billRows.filter(r => r.status === "purchased" || r.status === "owned").length;
  const actualSpent = billRows.reduce((sum,r) => sum + (r.purchase?.actualCost || 0),0);
  const low = bills.reduce((sum,a) => sum + (a.data.calculations?.low || 0),0);
  const high = bills.reduce((sum,a) => sum + (a.data.calculations?.high || 0),0);
  const currency = bills[0]?.data.currency || "EUR";
  const works = displayedArtifacts.filter(a => a.kind === "construction");
  const steps = works.flatMap(a => (a.data.steps || []).map((step:{title:string},i:number)=>({step,index:i,completed:Boolean(a.data.completedSteps?.[i]),asset:a})));
  const stepsDone = steps.filter(s => s.completed).length;
  const reviewShopping = workspaces.some(s => Boolean(s.review?.shopping));
  const reviewConstruction = workspaces.some(s => Boolean(s.review?.construction));
  const usability = workspaces.every(s => s.keepRoomUsable);
  const sections = [
    { kind: "visual", title: "Design", icon: Image, count: displayedArtifacts.filter(a => a.kind === "visual").length + " concepts" },
    { kind: "measurements", title: "Measurements", icon: Ruler, count: measurementVerified + " verified · " + measurementRecorded + " recorded" },
    { kind: "estimate", title: "Shopping List", icon: ShoppingCart, count: billRows.length + " items · " + purchased + " purchased" },
    { kind: "construction", title: "Work Plan", icon: ClipboardList, count: stepsDone + " / " + steps.length + " steps" },
    { kind: "decisions", title: "Decisions", icon: ListChecks, count: confirmedDecisions.length + " confirmed · " + openDecisions.length + " open" },
  ];
  return (
    <div className="folderWorkspace">
      <header>
        <small>PROJECT</small>
        <h1>{feed.folder.title}</h1>
        <p>{feed.folder.description}</p>
      </header>
      <nav className="folderAssetTabs folderDashboardNav" aria-label="Project sections">
        <Button className="folderOverviewTab" aria-pressed={tab === "overview"} onClick={() => setTab("overview")}>
          Project overview <ChevronRight size={15} />
        </Button>
        <div className="folderDashboardCards">
          {sections.map(s => <Button key={s.kind} aria-pressed={tab === s.kind} onClick={() => setTab(s.kind)}>
            <s.icon size={19} aria-hidden="true" />
            <span><strong>{s.title}</strong><small>{s.count}</small></span>
            <ChevronRight size={15} className="folderCardChevron"/>
          </Button>)}
        </div>
      </nav>
      {tab === "overview" && <div className="folderOverview">
        <div className="folderOverviewHeading"><div><small>PROJECT STATUS</small><h2>From idea to execution.</h2><p>Your renovation at a glance. Complete the missing checks before buying or starting work.</p></div></div>
        <section className="folderOverviewHero">
          <div className="folderOverviewHeroTop"><span>SHOPPING OVERVIEW</span><span>{billRows.length} items</span></div>
          <div className="folderOverviewBudget"><div><small>Estimated budget</small><strong>{bills.length ? money(low,currency) + " – " + money(high,currency) : "Not estimated"}</strong></div><div><small>Actual spending</small><strong>{money(actualSpent,currency)}</strong></div></div>
          <div className="folderOverviewStats">
            <span><b>{shoppingReady}</b> ready</span><span><b>{shoppingPending}</b> need measurements</span><span><b>{purchased}</b> purchased / owned</span>
          </div>
          <div className="folderOverviewProgress" aria-label={purchased + " of " + billRows.length + " items purchased"}><span style={{width:billRows.length ? purchased / billRows.length * 100 + "%" : "0%"}}/></div>
          {(shoppingPending > 0 || reviewShopping) && <div className="folderOverviewAlert"><AlertCircle size={16}/><p>{reviewShopping ? "Project changes need a Shopping List review." : shoppingPending + " items still need confirmed measurements before purchase."}</p></div>}
          <div className="folderOverviewActions"><Button onClick={() => setTab("estimate")}>Review Shopping List <ChevronRight size={15}/></Button>{bills.length > 0 && <a href={`/api/artifacts/${bills[0].id}/export`}>Export Excel</a>}</div>
        </section>
        <div className="folderOverviewDetails">
          <section className="folderOverviewDetail"><div className="folderDetailHeader"><Ruler size={18}/><h3>Measurements</h3><span>{measurementRecorded}/{measurementTotal || "—"} recorded</span></div>
            {measurementTotal ? <><div className="folderDetailRows">{[...surfaceRecords.slice(0,4).map(m => ({name:m.label,detail:m.value === null ? "Not measured" : m.value + " " + m.unit,ok:m.verified})),...fixtureRecords.slice(0,3).map(m=>({name:m.label,detail:m.value === null ? "Not measured" : m.value + " " + m.unit,ok:m.confidence==="verified"}))].slice(0,5).map((m,i)=><div key={i}><span>{m.name}</span><span className={m.ok?"folderDetailVerified":""}>{m.detail}{m.ok ? " · verified" : ""}</span></div>)}</div><p>{measurementVerified} verified on site. Unverified values should not determine product compatibility.</p></>:<p>No measurements saved yet. Add the dimensions needed for your chosen purchases.</p>}
            <Button onClick={() => setTab("measurements")}>Review measurements <ChevronRight size={14}/></Button>
          </section>
          <section className="folderOverviewDetail"><div className="folderDetailHeader"><ListChecks size={18}/><h3>Decisions</h3><span>{confirmedDecisions.length} confirmed</span></div>
            {decisions.length ? <div className="folderDetailRows">{[...openDecisions,...confirmedDecisions].slice(0,5).map(d=><div key={d.id}><span>{d.label}</span><span className={d.status==="confirmed"?"folderDetailVerified":""}>{d.status}</span></div>)}</div>:<p>Record what stays, what changes, and what is still being considered.</p>}
            {openDecisions.length>0 && <p>{openDecisions.length} proposed decisions may change the scope of purchases or work.</p>}
            <Button onClick={() => setTab("decisions")}>Review decisions <ChevronRight size={14}/></Button>
          </section>
          <section className="folderOverviewDetail"><div className="folderDetailHeader"><CalendarClock size={18}/><h3>Execution readiness</h3><span>{stepsDone}/{steps.length || "—"} complete</span></div>
            <div className="folderDetailRows"><div><span>Work plan</span><span>{steps.length ? steps.length+" steps" : "Not created"}</span></div><div><span>Keep room usable</span><span>{usability?"Preferred":"Not required"}</span></div><div><span>Plan review</span><span>{reviewConstruction?"Required":"No flagged changes"}</span></div></div>
            <p>Check fixture downtime, dependencies and drying times before starting.</p>
            <Button onClick={() => setTab("construction")}>Open work plan <ChevronRight size={14}/></Button>
          </section>
        </div>
      </div>}
      {tab === "measurements" && <section className="folderOverviewDetail folderStandalone"><div className="folderDetailHeader"><Ruler size={18}/><h3>Measurements</h3></div><div className="folderDetailRows">{surfaceRecords.map(m=><div key={m.key}><span>{m.label}</span><span>{m.value === null?"Missing":m.value+" "+m.unit}{m.verified?" · Verified":""}</span></div>)}{fixtureRecords.map(m=><div key={m.id}><span>{m.label}</span><span>{m.value === null?"Missing":m.value+" "+m.unit} · {m.confidence}</span></div>)}</div><p>To edit measurements, open the related room chat and select Measurements in its project panel.</p>{feed.chats.length>0&&<Button onClick={()=>onChat(feed.chats[0].id)}>Open room workspace <ArrowUpRight size={14}/></Button>}</section>}
      {tab === "decisions" && <section className="folderOverviewDetail folderStandalone"><div className="folderDetailHeader"><ListChecks size={18}/><h3>Project decisions</h3></div><div className="folderDetailRows">{decisions.map(d=><div key={d.id}><span>{d.label}</span><span>{d.status}</span></div>)}</div><p>To confirm or change a decision, open the room project panel.</p>{feed.chats.length>0&&<Button onClick={()=>onChat(feed.chats[0].id)}>Open room workspace <ArrowUpRight size={14}/></Button>}</section>}
      <div className="folderAssetList">
        {tab === "visual" &&
          displayedArtifacts.some((a) => a.kind === "visual") && (
            <ProjectVisualGallery
              artifacts={displayedArtifacts.filter((a) => a.kind === "visual")}
              unlocked={(a) =>
                unlocked ||
                !!feed.chats.find((c) => c.id === a.project_id)?.paid
              }
              onChanged={changed}
              caption={(a) =>
                feed.chats.find((c) => c.id === a.project_id)?.title
              }
            />
          )}
        {displayedArtifacts
          .filter((a) => a.kind === tab && tab !== "visual")
          .map((a) => (
            <section key={a.id} id={`folder-asset-${a.id}`}>
              <h3 className="folderAssetTitle">
                {a.data.title}
                <small>
                  {feed.chats.find((c) => c.id === a.project_id)?.title}
                </small>
              </h3>
              {a.kind === "estimate" ? (
                <ProjectMaterials
                  artifact={a}
                  focusIndex={focus.id === a.id ? focus.index : null}
                  works={feed.artifacts.filter(
                    (w) =>
                      w.kind === "construction" &&
                      w.project_id === a.project_id,
                  )}
                  onChanged={changed}
                  unlocked={
                    unlocked ||
                    !!feed.chats.find((c) => c.id === a.project_id)?.paid
                  }
                  onStep={(work, index) => show("construction", work, index)}
                />
              ) : a.kind === "construction" ? (
                <ConstructionPlanView
                  artifact={a}
                  compact
                  focusStep={focus.id === a.id ? focus.index : null}
                  onChanged={changed}
                  onOpen={(id) => show("estimate", id, null)}
                  onMaterial={(id, index) => show("estimate", id, index)}
                />
              ) : null}
            </section>
          ))}
        {["visual","estimate","construction"].includes(tab) && !displayedArtifacts.some((a) => a.kind === tab) && (
          <p className="folderEmpty">
            Saved {sections.find((s) => s.kind === tab)?.title.toLowerCase()}{" "}
            from this project’s chats will appear here.
          </p>
        )}
      </div>
      <section className="folderConversationList">
        <h2>
          <MessagesSquare size={18} />
          Chats in this project
        </h2>
        {feed.chats.map((chat) => (
          <Button key={chat.id} onClick={() => onChat(chat.id)}>
            <span>{chat.title}</span>
            <ArrowUpRight size={16} />
          </Button>
        ))}
        {!feed.chats.length && (
          <p>
            Drag a saved chat onto this folder or use its menu to assign it.
          </p>
        )}
      </section>
    </div>
  );
}
