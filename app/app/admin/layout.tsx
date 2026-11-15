import { notFound } from "next/navigation";
import { pool } from "@/server/db";
import { userId } from "@/server/http";
import { isAdmin } from "@/server/state";

// Officer screens do not exist for anyone else: the server answers 404 before any of the page is sent.
export default async function Gate({ children }: { children: React.ReactNode }) {
  const id = await userId();
  const role = id ? (await pool().query(`select role from users where id = $1 and not suspended`, [id])).rows[0]?.role : null;
  if (!role || !isAdmin(role)) notFound();
  return children;
}
