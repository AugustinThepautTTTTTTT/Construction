import type { Metadata } from "next";
import { Manrope, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const serif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Roomwise — Your room, figured out",
  description:
    "AI room renovation and modernization: create photo concepts, assess material quantities, find products and build a connected refurbishment work plan.",
  keywords: [
    "AI room planner",
    "renovation plan",
    "interior design AI",
    "remodel budget", "home modernization", "room refurbishment", "renovation bill of materials", "furniture product finder",
  ],
  openGraph: {
    title: "Roomwise — Your room, figured out",
    description: "A practical plan for your next room, in minutes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${serif.variable}`}>
        {children}
      </body>
    </html>
  );
}
