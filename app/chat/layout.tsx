import type { Metadata } from "next";
export const metadata: Metadata = { title: "Your Design Workspace", robots: { index: false, follow: false }, alternates: { canonical: "/chat" } };
export default function Layout({children}: {children: React.ReactNode}) { return children; }
