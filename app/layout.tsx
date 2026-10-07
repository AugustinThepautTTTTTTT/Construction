import type { Metadata, Viewport } from "next";
import { SITE, searchRobots, structuredData } from "@/lib/seo";
import { SiteTelemetry } from "@/components/site-telemetry";
import { Manrope, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const serif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: "%s | Archicova" },
  applicationName: SITE.name,
  description: SITE.description,
  alternates: { canonical: "/" },
  robots: searchRobots(),
  icons: { icon: "/brand/favicon.png?v=2", apple: "/brand/apple-touch-icon.png" },
  keywords: [
    "AI room planner",
    "renovation plan",
    "interior design AI",
    "remodel budget", "home modernization", "room refurbishment", "renovation bill of materials", "furniture product finder",
  ],
  openGraph: {
    title: SITE.title,
    description: SITE.description,
    siteName: SITE.name,
    url: SITE.url,
    locale: "en_US",
    images: [{ url: "/brand/social.png", width: 1200, height: 630, alt: "Archicova — AI interior design and renovation planning" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description, images: ["/brand/social.png"] },
};
export const viewport: Viewport = { themeColor: "#19251e" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${serif.variable}`}>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }} />
        <SiteTelemetry />
      </body>
    </html>
  );
}
