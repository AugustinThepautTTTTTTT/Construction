import Link from "next/link";
import {ArrowUpRight} from "lucide-react";
import {BrandMark} from "@/components/brand-mark";
import "./public-site-chrome.css";

export function PublicSiteHeader({signed=false}:{signed?:boolean}){
 return <header className="archPublicHeader"><div className="archPublicHeaderInner">
 <Link href="/" className="archPublicBrand" aria-label="Archicova — Home"><BrandMark/> <span>Archicova</span></Link>
 <nav className="archPublicNav" aria-label="Main navigation">
 <Link href="/#possibilities">Possibilities</Link>
 <Link href="/#how">How it works</Link>
 <Link href="/en/guides/">Journal</Link>
 <Link href="/#pricing">Plans</Link>
 </nav>
 <Link className="archPublicAccount" href={signed?"/chat":"/account?mode=login"}>{signed?"My workspace":"Sign in"} <ArrowUpRight size={15} aria-hidden="true"/></Link>
 </div></header>;
}
export function PublicSiteFooter(){
 return <footer className="archPublicFooter"><div className="archPublicFooterInner"><div><Link href="/" className="archPublicBrand"><BrandMark/><span>Archicova</span></Link><p>From idea to implementation.</p></div><nav aria-label="Footer navigation"><Link href="/">Home</Link><Link href="/en/guides/">Journal</Link><Link href="/en/bathroom-renovation/">Bathroom renovation</Link><Link href="/en/bathroom-inspiration/">Inspiration</Link><Link href="/en/ai-bathroom-design/">AI design</Link><Link href="/account">Start a project</Link></nav><small>Concepts and estimates require on-site verification.</small></div></footer>;
}