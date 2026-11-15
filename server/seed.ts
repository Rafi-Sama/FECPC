// Creates the schema and loads the placeholder club, so a fresh database behaves like the demo did.
import { readFileSync } from "node:fs";
import { seedSolved } from "../lib/appdata.ts";
import { members } from "../lib/data.ts";
import type { Role } from "../lib/permissions.ts";
import { hashPassword } from "./auth.ts";
import * as data from "./data.ts";
import type { Db } from "./db.ts";

const roleOf: Record<string, Role> = { President: "president", "CP Head": "cp_head", "General Secretary": "secretary", "Event Secretary": "secretary", Treasurer: "treasurer", Mentor: "mentor" };

export async function setup(db: Db, password: string) {
  await db.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  if ((await db.query(`select 1 from users limit 1`)).rowCount) return false; // already seeded: never overwrite real data
  const hash = await hashPassword(password), base = JSON.stringify({ base: { solved: seedSolved.length, done: 1 }, solved: seedSolved, done: ["r1"] });
  for (const m of members)
    await db.query(`insert into users (id, email, pass_hash, role, name, handle, batch, dept, squad, title, rating, peak, solved, streak, helper, skills, progress) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [m.id, `${m.id}@fecpc.example`, hash, roleOf[m.role ?? ""] ?? "member", m.name, m.handle, m.batch, m.dept, m.squad, m.role ?? null, m.rating, m.peak, m.solved, m.streak, m.helper, m.skills, base]);
  await db.query(`insert into users (id, email, pass_hash, role, name, batch, dept, title, system) values ('admin', 'admin@fecpc.example', $1, 'super_admin', 'Site Admin', 0, 'CSE', 'Super Admin', true)`, [hash]);
  await db.query(`update users set mentor_id = 'mehedi' where id = any($1)`, [data.mentees.map((m) => m.id)]);
  for (const x of data.expenses) await db.query(`insert into expenses (by, what, amount, event) values ($1, $2, $3, $4)`, [x.by, x.what, x.amount, x.event]);
  for (const q of data.queue)
    await db.query(`insert into payments (user_id, invoice_id, label, amount, via, trx, sender) values ($1, 'INV-2611', $2, $3, $4, $5, $6)`, [q.who, q.label, q.amount, q.via, q.trx, q.sender.replace(/\D/g, "").padEnd(11, "0")]);
  for (const a of data.applications)
    await db.query(`insert into applications (name, sid, dept, batch, email, track, why, quiz, src) values ($1, $2, $3, $4, $5, 'cp', 'Seeded placeholder application.', $6, $7)`, [a.name, `20${a.batch}-331-0${a.id.slice(2)}`, a.dept, a.batch, `${a.id}@applicant.example`, a.quiz, a.src]);
  return true;
}
