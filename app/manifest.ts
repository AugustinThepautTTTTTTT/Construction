import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Archicova", short_name: "Archicova", description: "AI interior design and renovation planning", start_url: "/", display: "standalone", background_color: "#f7f5ef", theme_color: "#19251e", icons: [{ src: "/brand/logo-192.png", sizes: "192x192", type: "image/png" }, { src: "/brand/logo-512.png", sizes: "512x512", type: "image/png" }] };
}
