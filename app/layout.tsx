import type { Metadata } from "next";
import { Manrope, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const serif = DM_Serif_Display({ weight: "400", subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Roomwise — Your room, figured out",
  description: "Turn room photos and ideas into a clear design, renovation plan, budget and schedule with an AI room planner.",
  keywords: ["AI room planner", "renovation plan", "interior design AI", "remodel budget"],
  openGraph: { title: "Roomwise — Your room, figured out", description: "A practical plan for your next room, in minutes.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${manrope.variable} ${serif.variable}`}>{children}</body></html>;
}
