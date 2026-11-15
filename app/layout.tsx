import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, VT323, Silkscreen, Space_Grotesk, Press_Start_2P } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--mono", weight: ["400", "500", "700"] });
const pixel = VT323({ subsets: ["latin"], variable: "--pixel", weight: "400" }); // was Pixelify Sans: its C/O, 8/S and ( / { were ambiguous
const silk = Silkscreen({ subsets: ["latin"], variable: "--silk", weight: ["400", "700"] });
const sans = Space_Grotesk({ subsets: ["latin"], variable: "--sans", weight: ["400", "500", "700"] });
const arcade = Press_Start_2P({ subsets: ["latin"], variable: "--arcade", weight: "400" });

export const metadata: Metadata = {
  title: { default: `${site.short} — ${site.name}`, template: `%s — ${site.short}` },
  description: `${site.name} is the programming club of ${site.university}: competitive programming, workshops, contests and hack nights.`,
};
export const viewport: Viewport = { themeColor: "#040704", colorScheme: "dark light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${pixel.variable} ${silk.variable} ${sans.variable} ${arcade.variable}`}>
      <body>{children}</body>
    </html>
  );
}
