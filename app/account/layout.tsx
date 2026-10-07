import type { Metadata } from "next";
export const metadata: Metadata = { title: "Your Account", robots: { index: false, follow: false }, alternates: { canonical: "/account" } };
export default function Layout({children}: {children: React.ReactNode}) { return children; }
