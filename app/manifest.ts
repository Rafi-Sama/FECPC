import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return { name: site.name, short_name: site.short, start_url: "/app", display: "standalone", background_color: "#0C0C0D", theme_color: "#0C0C0D", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
