import { redirect } from "next/navigation";
import { StoreProvider } from "@/components/app/Store";
import Shell from "@/components/app/Shell";
import { pool } from "@/server/db";
import { userId } from "@/server/http";
import { loadState } from "@/server/state";
import "../(site)/site.css";
import "./app.css";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic"; // every member area page is personal; nothing here is ever cached or prerendered

// The gate for the whole member area: no valid session, no page. The first render already carries the member's state.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const id = await userId(), state = id ? await loadState(pool(), id) : null;
  if (!state) redirect("/login");
  return <StoreProvider initial={state}><Shell>{children}</Shell></StoreProvider>;
}
