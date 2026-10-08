import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import "./bathroom-seo.css";
import {PublicSiteHeader,PublicSiteFooter} from "@/components/public-site-chrome";

export const routes = { hub:"/en/bathroom-renovation/", design:"/en/ai-bathroom-design/", inspiration:"/en/bathroom-inspiration/" } as const;
export const signup="/account?next=%2Fchat";
export function CTA({children,secondary=false}:{children:ReactNode;secondary?:boolean}){return <Link className={secondary?"seoBtn seoBtnOutline":"seoBtn"} href={signup}>{children}<span aria-hidden="true">↗</span></Link>}
export function SEOLayout({children}:{children:ReactNode}){return <div className="bathSeo"><PublicSiteHeader/>{children}<PublicSiteFooter/></div>}
export function Eyebrow({children}:{children:ReactNode}){return <p className="seoEyebrow"><span className="seoDot"/> {children}</p>}
export function Hero({eyebrow,title,accent,description,children,photo="/inspiration/bathroom.jpg"}:{eyebrow:string;title:string;accent:string;description:string;children:ReactNode;photo?:string}){return <section className="seoHero"><div className="seoHeroText"><Eyebrow>{eyebrow}</Eyebrow><h1>{title}<em>{accent}</em></h1><p className="seoLead">{description}</p><div className="seoActions">{children}</div><p className="seoTrust">Create an account to use the AI tools · One connected renovation chat</p></div><div className="seoHeroVisual"><Image src={photo} alt="Bathroom design inspiration for renovation planning" fill priority sizes="(max-width: 800px) 100vw, 50vw"/><div className="seoImageTag">INSPIRATION / BATHROOM</div></div></section>}
export function Section({kicker,title,children}:{kicker?:string;title:string;children:ReactNode}){return <section className="seoSection">{kicker&&<Eyebrow>{kicker}</Eyebrow>}<h2>{title}</h2>{children}</section>}
export function CardGrid({cards}:{cards:{title:string;body:string;href?:string}[]}){return <div className="seoCards">{cards.map(c=><article className="seoCard" key={c.title}><span className="seoCardSymbol" aria-hidden="true">✳</span><h3>{c.title}</h3><p>{c.body}</p>{c.href&&<Link href={c.href}>Explore <span aria-hidden="true">→</span></Link>}</article>)}</div>}
export function NextSteps(){return <section className="seoFinal"><Eyebrow>ONE CONNECTED WORKSPACE</Eyebrow><h2>Inspired? Make it your own.</h2><p>Create an account to explore ideas, share your bathroom photo and continue through materials, products and a practical work plan—all in the same chat.</p><CTA>Start my bathroom project</CTA></section>}
