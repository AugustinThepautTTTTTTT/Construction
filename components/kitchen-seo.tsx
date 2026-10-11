import Link from "next/link";
import Image from "next/image";
import type {ReactNode} from "react";
import {PublicSiteHeader,PublicSiteFooter} from "@/components/public-site-chrome";
import "./bathroom-seo.css";
import "./kitchen-seo.css";
export const kitchen={hub:"/en/kitchen-renovation/",design:"/en/ai-kitchen-design/",inspiration:"/en/kitchen-inspiration/",cost:"/en/guides/kitchen-renovation-cost/"};
const account="/account?next=%2Fchat";
export function KitchenLayout({children}:{children:ReactNode}){return <div className="bathSeo kitchenSeo"><PublicSiteHeader/>{children}<PublicSiteFooter/></div>}
export function KitchenHero({eyebrow,title,accent,description,photo="/inspiration/kitchen.jpg",children}:{eyebrow:string;title:string;accent?:string;description:string;photo?:string;children?:ReactNode}){return <header className="seoHero"><div className="seoHeroText"><p className="seoEyebrow"><span className="seoDot"/> {eyebrow}</p><h1>{title}{accent&&<em>{accent}</em>}</h1><p className="seoLead">{description}</p><div className="seoActions">{children||<KitchenCTA/>}</div><p className="seoTrust">AI concepts and material quantities are provisional. Validate all site dimensions and safety-critical work.</p></div><figure className="seoHeroVisual"><Image src={photo} alt="Kitchen renovation design inspiration with cabinetry and work surfaces" fill priority sizes="(max-width: 820px) 100vw, 50vw"/><figcaption className="seoImageTag">ARCHICOVA / KITCHEN INSPIRATION</figcaption></figure></header>}
export function KitchenCTA({children="Plan my kitchen with AI"}:{children?:ReactNode}){return <Link className="seoBtn" href={account}>{children} <span aria-hidden="true">↗</span></Link>}
export function KitchenArticle({children}:{children:ReactNode}){return <div className="kitchenRead">{children}</div>}
export function KitchenSection({id,title,children}:{id:string;title:string;children:ReactNode}){return <section id={id} className="kitchenChapter"><h2>{title}</h2>{children}</section>}
export function KitchenFigure({src,alt,caption}:{src:string;alt:string;caption:string}){return <figure className="kitchenFigure"><div><Image src={src} alt={alt} fill sizes="(max-width: 800px) 100vw, 850px"/></div><figcaption>{caption}</figcaption></figure>}
export function KitchenPrompt({title,children}:{title:string;children:ReactNode}){return <aside className="kitchenPrompt"><span className="seoEyebrow">PUT THE IDEA TO WORK</span><h3>{title}</h3><p>{children}</p><KitchenCTA>Continue in Archicova chat</KitchenCTA></aside>}
export function KitchenRelated(){return <nav className="kitchenRelated" aria-label="Explore kitchen renovation"><span className="seoEyebrow">EXPLORE THE KITCHEN VERTICAL</span><div><Link href={kitchen.hub}>Kitchen renovation guide →</Link><Link href={kitchen.design}>AI kitchen design →</Link><Link href={kitchen.inspiration}>Kitchen inspiration →</Link><Link href={kitchen.cost}>Kitchen renovation cost →</Link></div></nav>}
export function KitchenFinal(){return <section className="seoFinal"><p className="seoEyebrow">FROM INSPIRATION TO A REAL PLAN</p><h2>Ready to make it yours?</h2><p>Bring your kitchen photo, design priorities and measurements into the same Archicova chat. Explore concepts, provisional materials, relevant products and the work ahead.</p><KitchenCTA>Start my kitchen project</KitchenCTA></section>}
