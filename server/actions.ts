// Every change a member or officer can make. One entry point, one transaction, one row lock on the acting user.
// This is the only place that decides what a role may DO; the interface merely hides what would be refused here.
import { APPROVAL_THRESHOLD, announcements, invoices, polls, resources, sheet, shop } from "../lib/appdata.ts";
import { cols, courses, volunteerShifts, wiki } from "../lib/appdata2.ts";
import { events } from "../lib/data.ts";
import { can, canFully, roleName, roles, type Role } from "../lib/permissions.ts";
import { RANKS, UNRATED_RANK } from "../lib/rank.ts";
import type { AlumniJob, AlumniSummary, BlogPost, CommunityComment, FeedCategory, FeedPostDetail, FeedPostSummary, IdeaDetail, IdeaInterestRow, IdeaStatus, IdeaSummary, IdeaType, InterviewProblem, InterviewTip, InterviewTopic, MemberActivityItem, MemberContestRow, MemberExperience, MemberProfile, MemberSummary, MilestoneDTO } from "../lib/state.ts";
import { earned } from "../lib/xp.ts";
import { hashPassword, newToken, sha } from "./auth.ts";
import * as data from "./data.ts";
import { Fail, tx, type Db } from "./db.ts";
import { DAILY_KUDOS_CAP, detectCrossovers, MILESTONE_FRESHNESS_DAYS } from "./milestones.ts";
import { isAdmin, isCommittee, loadState, progress, today, type Progress } from "./state.ts";

type Actor = { id: string; role: Role; name: string; system: boolean };
const person = (a: Actor) => need(!a.system, "This is an operator account, not a member. It cannot do that.");
type In = Record<string, unknown>;
const KEY = /^[\w:.&' /+#-]{1,80}$/;
const text = (v: unknown, min: number, max: number, what: string) => {
  // Plain text only: control characters are dropped, React escapes the rest on output.
  const t = typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "";
  if (t.length < min || t.length > max) throw new Fail(400, `${what} must be ${min} to ${max} characters.`);
  return t;
};
const mdText = (v: unknown, min: number, max: number, what: string) => {
  // Multiline Markdown text: preserve newlines/tabs, drop other control characters.
  const t = typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim() : "";
  if (t.length < min || t.length > max) throw new Fail(400, `${what} must be ${min} to ${max} characters.`);
  return t;
};
const posInt = (v: unknown, what: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 2_000_000_000) throw new Fail(400, `Invalid ${what}.`);
  return n;
};
export function excerptFromMarkdown(md: string, maxLen = 140): string {
  const flat = md
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > maxLen ? flat.slice(0, maxLen - 1).trimEnd() + "…" : flat;
}
const optionalUrl = (v: unknown, what: string): string | null => {
  if (v === undefined || v === null) return null;
  const t = typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim() : "";
  if (!t) return null;
  if (t.length > 400 || !/^https?:\/\/[^\s]+$/i.test(t)) throw new Fail(400, `${what} must be a valid http(s) URL.`);
  return t;
};
const optionalAvatar = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const t = typeof v === "string" ? v.trim() : "";
  if (!t) return null;
  if (/^https?:\/\/[^\s]{4,480}$/i.test(t)) return t;
  if (/^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(t) && t.length <= 450_000) return t;
  throw new Fail(400, "Avatar must be a PNG, JPEG, or WebP image under 300KB.");
};
const FEED_CATS = ["problem-solving", "upsolving", "topic"] as const;
const FEED_CAT_ALIAS: Record<string, FeedCategory> = {
  "problem-solving": "problem-solving",
  wins: "problem-solving",
  upsolving: "upsolving",
  help: "upsolving",
  topic: "topic",
  contests: "topic",
};
const IDEA_TYPES = ["idea", "teammate", "study"] as const;
const IDEA_STATUSES = ["open", "planned", "shipped", "closed"] as const;
const key = (v: unknown) => { if (typeof v !== "string" || !KEY.test(v)) throw new Fail(400, "That is not a valid item."); return v; };
const pick = <T extends string>(v: unknown, from: readonly T[], what: string): T => { if (!from.includes(v as T)) throw new Fail(400, `Unknown ${what}.`); return v as T; };
const need = (ok: unknown, why = "Your role cannot do that.") => { if (!ok) throw new Fail(403, why); };
const audit = (c: Db, a: Actor, what: string) => c.query(`insert into audit (who, what) values ($1, $2)`, [a.name, what]);
const tk = (n: number) => "৳" + n.toLocaleString("en");
const flip = (list: string[], id: string, on: boolean) => (on ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id));

// What each personal list accepts. Anything else is refused, so a list can never hold an id that earns XP for nothing.
const lists: Record<string, (id: string) => boolean> = {
  solved: (id) => sheet.some((p) => p.id === id),
  done: (id) => resources.some((r) => r.id === id) || wiki.some((w) => "wiki:" + w.id === id),
  lessons: (id) => courses.some((c) => c.lessons.some((_, i) => `${c.id}:${i}` === id)),
  read: (id) => announcements.some((a) => a.id === id) || /^(an:\d{1,9}|n:[\w:.-]{1,70})$/.test(id),
};
// Shared switches: who may flip them. Everything not listed here is a personal preference.
const clubFlag = (k: string, r: Role): boolean | null =>
  k.startsWith("act:") ? isCommittee(r) && data.meetings.some((m) => m.actions.some((x) => x[0] === k.slice(4)))
  : k.startsWith("cd:") ? isCommittee(r)
  : k === "unfrozen" ? !!can(r, "event.publish")
  : null;

async function setClub(c: Db, a: Actor, k: string, value: boolean | string) {
  await c.query(`insert into club (key, value, by) values ($1, $2, $3) on conflict (key) do update set value = excluded.value, by = excluded.by, at = now()`, [k, JSON.stringify(value), a.id]);
}

const handlers: Record<string, (c: Db, a: Actor, p: Progress, i: In) => Promise<string | void>> = {
  async toggle(c, a, p, i) {
    const id = key(i.id), list = String(i.list), now = (has: boolean) => (typeof i.on === "boolean" ? i.on : !has);
    if (lists[list]) {
      need(lists[list](id), "That item does not exist.");
      const k = list as "solved" | "done" | "lessons" | "read";
      p[k] = flip(p[k], id, now(p[k].includes(id)));
    } else if (list === "reg") {
      need(events.some((e) => e.id === id), "That event does not exist.");
      const has = (await c.query(`select 1 from registrations where user_id = $1 and event_id = $2`, [a.id, id])).rowCount! > 0;
      if (now(has)) await c.query(`insert into registrations values ($1, $2) on conflict do nothing`, [a.id, id]);
      else await c.query(`delete from registrations where user_id = $1 and event_id = $2`, [a.id, id]);
    } else if (list === "kudos") {
      need(!id.startsWith("shop:"), "That is not something you can cheer.");
      need(!id.startsWith("milestone:"), "Use kudosMilestone for milestone kudos.");
      const has = (await c.query(`select 1 from reactions where user_id = $1 and target = $2`, [a.id, id])).rowCount! > 0;
      if (now(has)) await c.query(`insert into reactions values ($1, $2) on conflict do nothing`, [a.id, id]);
      else await c.query(`delete from reactions where user_id = $1 and target = $2`, [a.id, id]);
    } else if (list === "present") { // volunteer shifts; class attendance needs the room code (see `attend`)
      const shift = volunteerShifts.find((v) => "vol:" + v[0] === id);
      need(shift, "That shift does not exist.");
      await c.query(`select pg_advisory_xact_lock(hashtext($1))`, [id]); // two people cannot take the last place
      const has = (await c.query(`select 1 from attendance where user_id = $1 and key = $2`, [a.id, id])).rowCount! > 0;
      if (!now(has)) return void (await c.query(`delete from attendance where user_id = $1 and key = $2`, [a.id, id]));
      const taken = (await c.query(`select count(*)::int n from attendance where key = $1`, [id])).rows[0].n;
      if (!has && shift![3] + taken >= shift![2]) throw new Fail(409, "That shift just filled up.");
      await c.query(`insert into attendance values ($1, $2) on conflict do nothing`, [a.id, id]);
    } else throw new Fail(400, "Unknown list.");
  },
  async readAll(c, a, p) { p.read = [...new Set([...p.read, ...(await loadState(c, a.id))!.inbox.map((n) => n.id)])].slice(-500); },
  async checkin(_c, _a, p) { p.checkin = today(); },
  async flag(c, a, p, i) {
    const k = key(i.key);
    if (typeof i.on !== "boolean") throw new Fail(400, "Expected on or off.");
    need(!/^(susp|post|role|mod|rule):|^(remind|risk)/.test(k), "That switch does not exist.");
    const shared = clubFlag(k, a.role);
    if (shared !== null) {
      need(shared);
      await setClub(c, a, "flag:" + k, i.on);
      if (k === "unfrozen") await audit(c, a, i.on ? "unfroze the contest scoreboard" : "refroze the contest scoreboard");
      return;
    }
    if (k.startsWith("nudge")) need(can(a.role, "mentees.view"));
    if (!(k in p.flags) && Object.keys(p.flags).length >= 300) throw new Fail(400, "Too many saved preferences.");
    p.flags[k] = i.on;
  },
  async kv(c, a, p, i) {
    const k = key(i.key), v = text(i.value, 0, 200, "Value");
    if (k.startsWith("task:")) {
      need(isCommittee(a.role)); need(data.tasks.some((t) => t.id === k.slice(5)), "That task does not exist.");
      return setClub(c, a, "kv:" + k, pick(v, cols, "column"));
    }
    if (k.startsWith("inv:")) {
      need(isCommittee(a.role));
      const item = data.inventory.find((x) => x[1] === k.slice(4));
      need(item, "That item does not exist.");
      const holder = (await c.query(`select value from club where key = $1`, ["kv:" + k])).rows[0]?.value || item![2];
      if (v ? holder : holder !== a.id && !isAdmin(a.role)) throw new Fail(409, v ? "That item is already checked out." : "Only the person holding it, or an admin, can return it.");
      await setClub(c, a, "kv:" + k, v ? a.id : "");
      return void (await audit(c, a, `${v ? "checked out" : "returned"} ${item![0]}`));
    }
    need(!k.startsWith("role:"), "Use the role action for that.");
    if (k.startsWith("conf:")) { need(sheet.some((x) => x.id === k.slice(5)), "That problem does not exist."); pick(v, ["shaky", "ok", "solid"], "confidence"); }
    if (k === "rate") pick(v, ["1", "2", "3", "4", "5"], "rating");
    if (k === "fantasy") {
      const ids = [...new Set(v.split(",").filter(Boolean))];
      need(ids.length <= 3, "Pick at most three members.");
      const n = (await c.query(`select count(*)::int n from users where id = any($1)`, [ids])).rows[0].n;
      need(n === ids.length, "One of those members does not exist.");
      return void (p.kv[k] = ids.join(","));
    }
    if (!(k in p.kv) && Object.keys(p.kv).length >= 200) throw new Fail(400, "Too many saved preferences.");
    p.kv[k] = v;
  },
  async vote(c, a, _p, i) {
    person(a);
    const poll = key(i.poll), option = text(i.option, 1, 80, "Option");
    const once = poll === "fb:freshers"; // a feedback rating cannot be changed
    if (poll === "fb:freshers") pick(option, ["1", "2", "3", "4", "5"], "rating");
    else need(polls.find((x) => x.id === poll)?.opts.some((o) => o[0] === option), "That is not an option in this poll.");
    const r = await c.query(`insert into votes values ($1, $2, $3) on conflict (user_id, poll_id) do ${once ? "nothing" : "update set option = excluded.option"}`, [a.id, poll, option]);
    if (once && !r.rowCount) throw new Fail(409, "You have already rated this event.");
  },
  async quiz(_c, _a, p, i) {
    const answers = data.quizAnswers[String(i.course)];
    need(answers, "That quiz does not exist.");
    if (!Array.isArray(i.picks) || i.picks.length !== answers.length) throw new Fail(400, "Answer every question.");
    p.quiz[String(i.course)] = answers.filter((ans, n) => (i.picks as unknown[])[n] === ans).length;
  },
  async quizReset(_c, _a, p, i) { delete p.quiz[String(i.course)]; },
  async handle(c, a, p, i) {
    const h = typeof i.value === "string" ? i.value.trim() : "";
    if (h && !/^[\w.-]{3,24}$/.test(h)) throw new Fail(400, "That is not a valid Codeforces handle.");
    p.handle = h;
    if (h) await audit(c, a, `linked Codeforces handle ${h}`);
  },
  async pay(c, a, _p, i) {
    person(a);
    const inv = invoices.find((x) => x.id === i.invoice);
    need(inv, "That invoice does not exist.");
    if (inv!.event) need((await c.query(`select 1 from registrations where user_id = $1 and event_id = $2`, [a.id, inv!.event])).rowCount, "That invoice is only for members registered for the event.");
    const via = pick(i.via, ["bKash", "Nagad", "Rocket"] as const, "wallet"), trx = String(i.trx ?? "").trim().toUpperCase(), sender = String(i.sender ?? "").trim();
    if (!/^[A-Z0-9]{8,12}$/.test(trx)) throw new Fail(400, "A transaction ID is 8 to 12 letters and digits. Copy it from the wallet SMS.");
    if (!/^01\d{9}$/.test(sender)) throw new Fail(400, "Enter the 11-digit number the money was sent from.");
    // The two unique indexes are the rule; checking first would let two simultaneous submissions both pass.
    const r = await c.query(`insert into payments (user_id, invoice_id, label, amount, via, trx, sender) values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing returning id`, [a.id, inv!.id, inv!.label, inv!.amount, via, trx, sender]);
    if (!r.rows[0]) {
      const mine = (await c.query(`select 1 from payments where user_id = $1 and invoice_id = $2 and status <> 'rejected'`, [a.id, inv!.id])).rowCount;
      throw new Fail(409, mine ? "You have already submitted a payment for this invoice." : "That transaction ID has already been used. Check the SMS from your wallet and enter the ID exactly.");
    }
    await audit(c, a, `submitted payment PAY-${r.rows[0].id} for ${inv!.id} (${via})`);
  },
  async attend(c, a, _p, i) {
    if (String(i.code ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase() !== data.ATTENDANCE.code) throw new Fail(400, "That code is wrong or has expired. Read it off the projector again.");
    await c.query(`insert into attendance values ($1, $2) on conflict do nothing`, [a.id, data.ATTENDANCE.event]);
  },
  async redeem(c, a, p, i) {
    person(a);
    const item = shop.find((x) => x[0] === i.item);
    need(item, "That reward does not exist.");
    if (p.shop.includes(item![0])) throw new Fail(409, "You have already redeemed that.");
    const st = (await loadState(c, a.id))!; // read inside the transaction, under the row lock, so XP cannot be spent twice
    if (st.me.xp + earned(st.s) - st.s.spent < item![1]) throw new Fail(409, "You do not have enough XP for that yet.");
    p.shop.push(item![0]); p.spent += item![1];
    await audit(c, a, `redeemed "${item![0]}" for ${item![1]} XP`);
  },
  async announce(c, a, _p, i) {
    need(can(a.role, "announce.post"));
    const title = text(i.title, 3, 140, "The title");
    const bodyMd = i.body_md !== undefined && String(i.body_md).trim() !== "" ? mdText(i.body_md, 1, 6000, "The message") : "";
    const pinned = Boolean(i.pinned);
    const requiresAck = Boolean(i.requires_ack);
    // A scoped grant (mentor) reaches that mentor's own mentees only; the audience is decided here, never by the caller.
    const audience = can(a.role, "announce.post") === "scope" || i.audience === "mentees" ? "mentees:" + a.id : "all";
    await c.query(
      `insert into announcements (user_id, title, body_md, audience, pinned, requires_ack) values ($1, $2, $3, $4, $5, $6)`,
      [a.id, title, bodyMd, audience, pinned, requiresAck]
    );
    await audit(c, a, `posted announcement "${title}"${audience === "all" ? "" : " to their mentees"}`);
  },
  async markAnnouncementRead(c, a, p, i) {
    const raw = String(i.id ?? "").trim();
    const id = /^\d{1,9}$/.test(raw) ? "an:" + raw : key(raw);
    const isSeed = announcements.some((x) => x.id === id);
    if (!isSeed) {
      const m = /^an:(\d{1,9})$/.exec(id);
      need(m, "That announcement does not exist.");
      const exists = (await c.query(`select 1 from announcements where id = $1`, [+m![1]])).rowCount! > 0;
      need(exists, "That announcement does not exist.");
    }
    await c.query(`insert into announcement_reads (announcement_id, user_id) values ($1, $2) on conflict do nothing`, [id, a.id]);
    if (!p.read.includes(id)) p.read = [...p.read, id];
  },
  async createFeedPost(c, a, _p, i) {
    person(a);
    need(can(a.role, "feed.post"));
    const title = text(i.title, 3, 160, "Title");
    const bodyMd = mdText(i.body_md, 3, 10000, "Post body");
    const category = pick(i.category, FEED_CATS, "category");
    await c.query(`insert into feed_posts (user_id, title, body_md, category) values ($1, $2, $3, $4)`, [a.id, title, bodyMd, category]);
  },
  async voteFeed(c, a, _p, i) {
    person(a);
    const postId = posInt(i.postId, "post");
    const rawVal = Number(i.value);
    if (rawVal !== -1 && rawVal !== 0 && rawVal !== 1) throw new Fail(400, "Vote must be -1, 0, or 1.");
    const post = (await c.query(`select id, score from feed_posts where id = $1 for update`, [postId])).rows[0];
    if (!post) throw new Fail(404, "That post does not exist.");
    const cur = (await c.query(`select value from feed_votes where user_id = $1 and post_id = $2`, [a.id, postId])).rows[0];
    const prev: number = cur ? Number(cur.value) : 0;
    const next = rawVal === prev ? 0 : rawVal;
    if (next === 0) await c.query(`delete from feed_votes where user_id = $1 and post_id = $2`, [a.id, postId]);
    else await c.query(`insert into feed_votes (user_id, post_id, value) values ($1, $2, $3) on conflict (user_id, post_id) do update set value = excluded.value, created_at = now()`, [a.id, postId, next]);
    const delta = next - prev;
    if (delta !== 0) await c.query(`update feed_posts set score = score + $2 where id = $1`, [postId, delta]);
  },
  async updateFeedPost(c, a, _p, i) {
    person(a);
    const postId = posInt(i.postId, "post");
    const title = text(i.title, 3, 160, "Title");
    const bodyMd = mdText(i.body_md, 3, 10000, "Post body");
    const r = await c.query(`update feed_posts set title = $2, body_md = $3, updated_at = now() where id = $1 and user_id = $4 returning id`, [postId, title, bodyMd, a.id]);
    if (!r.rows[0]) throw new Fail(403, "Only the author can edit this post.");
  },
  async deleteFeedPost(c, a, _p, i) {
    person(a);
    const postId = posInt(i.postId, "post");
    const r = await c.query(`delete from feed_posts where id = $1 and user_id = $2 returning id`, [postId, a.id]);
    if (!r.rows[0]) throw new Fail(403, "Only the author can delete this post.");
  },
  async reportFeedPost(c, a, _p, i) {
    person(a);
    const postId = posInt(i.postId, "post");
    const post = (await c.query(`select user_id, title from feed_posts where id = $1`, [postId])).rows[0];
    if (!post) throw new Fail(404, "That post does not exist.");
    need(post.user_id !== a.id, "You cannot report your own post.");
    const reason = i.reason ? text(i.reason, 1, 300, "Reason") : "Flagged by member";
    await c.query(`insert into feed_reports (post_id, user_id, reason) values ($1, $2, $3) on conflict do nothing`, [postId, a.id, reason]);
    await audit(c, a, `reported feed post #${postId} ("${post.title}")`);
  },
  async comment(c, a, _p, i) {
    person(a);
    const targetType = pick(i.targetType, ["idea"] as const, "target");
    const targetId = posInt(i.targetId, "item");
    const body = mdText(i.body, 1, 2000, "Comment");
    const exists = (await c.query(`select 1 from ideas where id = $1`, [targetId])).rowCount! > 0;
    if (!exists) throw new Fail(404, "That item does not exist.");
    await c.query(`insert into community_comments (target_type, target_id, user_id, body) values ($1, $2, $3, $4)`, [targetType, targetId, a.id, body]);
  },
  async createIdea(c, a, _p, i) {
    person(a);
    need(can(a.role, "idea.create"));
    const title = text(i.title, 3, 160, "Title");
    const bodyMd = mdText(i.body_md, 3, 10000, "Description");
    const rawType = i.ideaType ?? (i.type !== "createIdea" ? i.type : undefined);
    const type = pick(rawType, IDEA_TYPES, "type");
    const rawRoles = Array.isArray(i.roles) ? i.roles : [];
    const rolesList = rawRoles.map((r) => (typeof r === "string" ? r.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "")).filter(Boolean).slice(0, 3);
    for (const r of rolesList) if (r.length > 140) throw new Fail(400, "Each role prompt must be under 140 characters.");
    await c.query(`insert into ideas (user_id, title, body_md, type, roles) values ($1, $2, $3, $4, $5::jsonb)`, [a.id, title, bodyMd, type, JSON.stringify(rolesList)]);
  },
  async updateIdea(c, a, _p, i) {
    person(a);
    const ideaId = posInt(i.ideaId, "idea");
    const cur = (await c.query(`select user_id, status from ideas where id = $1`, [ideaId])).rows[0];
    if (!cur) throw new Fail(404, "That idea does not exist.");
    need(cur.user_id === a.id || canFully(a.role, "idea.manage"), "Only the poster or an admin can edit this idea.");
    const title = text(i.title, 3, 160, "Title");
    const bodyMd = mdText(i.body_md, 3, 10000, "Description");
    const status = i.status !== undefined ? pick(i.status, IDEA_STATUSES, "status") : cur.status;
    await c.query(`update ideas set title = $2, body_md = $3, status = $4, updated_at = now() where id = $1`, [ideaId, title, bodyMd, status]);
  },
  async closeIdea(c, a, _p, i) {
    person(a);
    const ideaId = posInt(i.ideaId, "idea");
    const cur = (await c.query(`select user_id from ideas where id = $1`, [ideaId])).rows[0];
    if (!cur) throw new Fail(404, "That idea does not exist.");
    need(cur.user_id === a.id || canFully(a.role, "idea.manage"), "Only the poster or an admin can close this idea.");
    await c.query(`update ideas set status = 'closed', updated_at = now() where id = $1`, [ideaId]);
  },
  async markIdeaViewed(c, a, _p, i) {
    const ideaId = posInt(i.ideaId, "idea");
    const exists = (await c.query(`select 1 from ideas where id = $1`, [ideaId])).rowCount! > 0;
    if (!exists) throw new Fail(404, "That idea does not exist.");
    await c.query(`insert into idea_views (idea_id, user_id) values ($1, $2) on conflict do nothing`, [ideaId, a.id]);
  },
  async expressInterest(c, a, _p, i) {
    person(a);
    const ideaId = posInt(i.ideaId, "idea");
    const idea = (await c.query(`select user_id, status from ideas where id = $1`, [ideaId])).rows[0];
    if (!idea) throw new Fail(404, "That idea does not exist.");
    need(idea.user_id !== a.id, "You cannot express interest in your own post.");
    if (idea.status === "closed") throw new Fail(409, "This post is closed.");
    const cleanResp: Record<string, string> = {};
    if (i.response && typeof i.response === "object" && !Array.isArray(i.response)) {
      for (const [k, v] of Object.entries(i.response as Record<string, unknown>).slice(0, 5)) {
        const ck = String(k).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 140);
        const cv = String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500);
        if (ck && cv) cleanResp[ck] = cv;
      }
    }
    await c.query(
      `insert into idea_interests (idea_id, user_id, response, status) values ($1, $2, $3::jsonb, 'pending')
       on conflict (idea_id, user_id) do update set response = excluded.response`,
      [ideaId, a.id, JSON.stringify(cleanResp)]
    );
  },
  async decideInterest(c, a, _p, i) {
    person(a);
    const ideaId = posInt(i.ideaId, "idea");
    const applicant = key(i.userId);
    const decision = pick(i.decision, ["accepted", "declined"] as const, "decision");
    const idea = (await c.query(`select user_id from ideas where id = $1`, [ideaId])).rows[0];
    if (!idea) throw new Fail(404, "That idea does not exist.");
    need(idea.user_id === a.id, "Only the poster can decide on interested members.");
    const r = await c.query(
      `update idea_interests set status = $3, decided_at = now() where idea_id = $1 and user_id = $2 returning idea_id`,
      [ideaId, applicant, decision]
    );
    if (!r.rows[0]) throw new Fail(404, "That interest request does not exist.");
  },
  async send(c, a, _p, i) {
    const kind = pick(i.kind, ["checkin", "suggest", "feedback"] as const, "message");
    const body = text(i.body, kind === "feedback" ? 1 : 3, 1000, "Your message");
    if (kind === "checkin") {
      const mentor = (await c.query(`select mentor_id from users where id = $1`, [a.id])).rows[0]?.mentor_id;
      need(mentor, "You do not have a mentor yet. Ask the CP Head to assign one.");
      return void (await c.query(`insert into messages (kind, user_id, to_user, body) values ('checkin', $1, $2, $3)`, [a.id, mentor, body]));
    }
    // A suggestion is anonymous for real: the sender is not written anywhere, not even to the audit log.
    await c.query(`insert into messages (kind, user_id, body) values ($1, $2, $3)`, [kind, kind === "suggest" ? null : a.id, body]);
  },
  async ping(c, a, _p, i) {
    const kind = pick(i.kind, ["invite", "duel", "nudge", "team"] as const, "request"), to = key(i.to), ref = typeof i.ref === "string" && KEY.test(i.ref) ? i.ref : "";
    need(to !== a.id, "You cannot send that to yourself.");
    const t = (await c.query(`select mentor_id from users where id = $1 and not suspended and not system`, [to])).rows[0];
    need(t, "That member does not exist.");
    if (kind === "nudge") { const lvl = can(a.role, "mentees.view"); need(lvl); need(lvl === true || t.mentor_id === a.id, "You can only nudge your own mentees."); }
    await c.query(`insert into pings (from_user, to_user, kind, ref) values ($1, $2, $3, $4) on conflict do nothing`, [a.id, to, kind, ref]);
  },
  async expense(c, a, _p, i) {
    need(isCommittee(a.role), "Only committee members file expense requests.");
    const amount = Number(i.amount), what = text(i.what, 3, 140, "The description"), event = text(i.event, 0, 80, "The event");
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) throw new Fail(400, "Enter the amount in whole taka, up to 1,000,000.");
    const r = await c.query(`insert into expenses (by, what, amount, event) values ($1, $2, $3, $4) returning id`, [a.id, what, amount, event]);
    await audit(c, a, `requested expense EXP-${r.rows[0].id} (${tk(amount)}): ${what}`);
  },
  async profile(c, a, _p, i) {
    const name = text(i.name, 2, 80, "Your name"), dept = text(i.dept, 2, 20, "Department"), batch = Number(i.batch);
    if (!Number.isInteger(batch) || batch < 0 || batch > 99) throw new Fail(400, "Batch is a two-digit number, like 24.");
    await c.query(`update users set name = $2, dept = $3, batch = $4 where id = $1`, [a.id, name, dept, batch]);
    if (name !== a.name) await audit(c, a, `changed their name to ${name}`);
  },
  async decide(c, a, _p, i) {
    const kind = pick(i.kind, ["payment", "expense", "waiver", "application"] as const, "decision"), id = key(i.id), to = String(i.to);
    if (kind === "payment") {
      need(canFully(a.role, "payments.verify"), "Only the Treasurer verifies payments.");
      pick(to, ["verified", "rejected"], "decision");
      const n = /^PAY-(\d{1,9})$/.exec(id);
      need(n, "That payment does not exist.");
      const note = to === "rejected" ? text(i.reason, 3, 200, "The reason for rejecting") : null; // the member is shown this
      const r = await c.query(`update payments set status = $2, decided_by = $3, note = $4 where id = $1 and status = 'pending' and user_id <> $3 returning amount, via`, [+n![1], to, a.id, note]);
      if (!r.rows[0]) throw new Fail(409, "That payment is already decided, or it is your own: someone else must verify it.");
      return void (await audit(c, a, `${to} payment ${id} (${tk(r.rows[0].amount)}, ${r.rows[0].via})${note ? `: ${note}` : ""}`));
    }
    if (kind === "application") {
      need(can(a.role, "application.approve"));
      pick(to, ["accepted", "declined"], "decision");
      need(/^\d{1,9}$/.test(id), "That application does not exist.");
      const app = (await c.query(`update applications set status = $2 where id = $1 and status = 'pending' returning name, email, dept, batch, cf`, [+id, to])).rows[0];
      if (!app) throw new Fail(409, "That application has already been decided.");
      if (to === "declined") return void (await audit(c, a, `declined applicant ${app.name}`));
      const slug = app.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "member", token = newToken();
      const made = await c.query(
        `insert into users (id, email, invite_hash, invite_expires, name, handle, batch, dept) select $1 || case when exists (select 1 from users where id = $1) then '_' || $2 else '' end, $3, $4, now() + interval '7 days', $5, $6, $7, $8
         where not exists (select 1 from users where email = $3) returning id`, [slug, id, app.email, sha(token), app.name, app.cf, app.batch, app.dept]);
      if (!made.rows[0]) throw new Fail(409, "A member already uses that email address.");
      await audit(c, a, `accepted applicant ${app.name}; account created`);
      return `Account created for ${app.name}. Send them this link to set a password. It works once and expires in 7 days: /login?invite=${token}`;
    }
    // Expenses and waivers: two-person rules. Nobody decides their own request.
    if (kind === "expense") {
      const n = /^EXP-(\d{1,9})$/.exec(id), lvl = can(a.role, "expense.approve");
      need(lvl); need(n, "That expense does not exist.");
      const x = (await c.query(`select by, amount, status, decided_by from expenses where id = $1 for update`, [+n![1]])).rows[0]; // the lock makes two simultaneous decisions take turns
      need(x, "That expense does not exist."); need(x.by !== a.id, "You cannot decide your own expense request.");
      const big = x.amount > APPROVAL_THRESHOLD;
      if (x.status !== "pending" && !(x.status === "sent to President" && lvl === true)) throw new Fail(409, "That expense has already been decided.");
      // Above the threshold two different people must agree: one passes it up, another with full authority decides. Nobody skips the first step.
      if (big && x.status === "pending") pick(to, ["sent to President"], "decision: a large expense is first passed up, then decided by a second officer");
      else pick(to, ["approved", "rejected"], "decision");
      if (big && x.status === "sent to President") need(x.decided_by !== a.id, "A second officer has to make the final decision on an expense you passed up.");
      await c.query(`update expenses set status = $2, decided_by = $3 where id = $1`, [+n![1], to, a.id]);
      return void (await audit(c, a, to === "sent to President" ? `proposed expense ${id} to the President` : `${to} expense ${id} (${tk(x.amount)})`));
    }
    await c.query(`select pg_advisory_xact_lock(hashtext($1))`, [kind + id]);
    const cur: string | undefined = (await c.query(`select status from decisions where kind = $1 and id = $2`, [kind, id])).rows[0]?.status;
    const save = async (line: string) => { await c.query(`insert into decisions values ($1, $2, $3, $4) on conflict (kind, id) do update set status = excluded.status, by = excluded.by, at = now()`, [kind, id, to, a.id]); await audit(c, a, line); };
    const w = data.waivers.find((e) => e.id === id), lvl = can(a.role, "dues.waive");
    need(w, "That waiver does not exist."); need(lvl); need(w!.who !== a.id, "You cannot decide a waiver for yourself.");
    // Two people: one proposes, a different one with full authority decides.
    const row = (await c.query(`select by from decisions where kind = 'waiver' and id = $1`, [id])).rows[0];
    if (cur && !(cur === "proposed" && lvl === true)) throw new Fail(409, "That waiver has already been decided.");
    pick(to, cur === "proposed" ? ["waived", "rejected"] : ["proposed"], cur ? "decision" : "decision: a waiver is first proposed, then decided by a second officer");
    if (cur === "proposed") need(row.by !== a.id, "A second officer has to decide a waiver you proposed.");
    return save(to === "proposed" ? `proposed waiver ${id} to the President` : `${to} waiver ${id}: ${tk(w!.amount)}, ${w!.what} (reason: ${w!.reason})`);
  },
  async role(c, a, _p, i) {
    need(canFully(a.role, "roles.assign"));
    const role = pick(i.role, roles, "role"), reason = text(i.reason, 3, 200, "The reason"), user = key(i.user);
    need(user !== a.id, "You cannot change your own role.");
    need(role !== "super_admin" || a.role === "super_admin", "Only a Super Admin can grant Super Admin.");
    // The public title follows the role, so a demoted officer does not keep the title and a promoted one gets it.
    const r = await c.query(`update users set role = $2, title = $4 where id = $1 and not system and (role <> 'super_admin' or $3) returning name`, [user, role, a.role === "super_admin", role === "member" ? null : roleName[role]]);
    if (!r.rows[0]) throw new Fail(404, "That member does not exist, or is a Super Admin.");
    await audit(c, a, `assigned role ${roleName[role]} to ${r.rows[0].name} (reason: ${reason})`);
  },
  async suspend(c, a, _p, i) {
    need(canFully(a.role, "roles.assign"));
    const user = key(i.user);
    if (typeof i.on !== "boolean") throw new Fail(400, "Expected on or off.");
    need(user !== a.id, "You cannot suspend yourself.");
    const r = await c.query(`update users set suspended = $2 where id = $1 and (role <> 'super_admin' or $3) returning name`, [user, i.on, a.role === "super_admin"]);
    if (!r.rows[0]) throw new Fail(404, "That member does not exist, or is a Super Admin.");
    if (i.on) await c.query(`delete from sessions where user_id = $1`, [user]); // signed out everywhere, immediately
    await audit(c, a, `${i.on ? "suspended" : "reinstated"} ${r.rows[0].name}`);
  },
  // A fresh one-time link: the first password for someone who never signed in, or a reset for someone locked out.
  async invite(c, a, _p, i) {
    const user = key(i.user), token = newToken();
    need(user !== a.id, "Change your own password from your profile.");
    const t = (await c.query(`select role, name, pass_hash is not null as joined from users where id = $1 and not suspended for update`, [user])).rows[0];
    need(t, "That member does not exist.");
    // Whoever can take over an account must already outrank it: officers' accounts need the role-assigning authority, a Super Admin's needs a Super Admin.
    need(t.role === "member" ? can(a.role, "application.approve") || canFully(a.role, "roles.assign") : t.role === "super_admin" ? a.role === "super_admin" : canFully(a.role, "roles.assign"));
    await c.query(`update users set invite_hash = $2, invite_expires = now() + interval '7 days' where id = $1`, [user, sha(token)]);
    await audit(c, a, `issued a ${t.joined ? "password reset" : "new invite"} link for ${t.name}`);
    return `${t.joined ? "Password reset" : "Invite"} link for ${t.name}. It works once and expires in 7 days: /login?invite=${token}`;
  },
  async updateProfile(c, a, p, i) {
    person(a);
    need(can(a.role, "profile.editOwn"));
    const sets: string[] = [];
    const params: unknown[] = [a.id];
    let idx = 2;

    if ("bio" in i) {
      const rawBio = i.bio === null || i.bio === undefined ? "" : String(i.bio);
      const cleanBio = rawBio.trim() === "" ? null : mdText(rawBio, 1, 400, "Bio");
      sets.push(`bio = $${idx++}`);
      params.push(cleanBio);
    }
    if ("cf_handle" in i) {
      const h = typeof i.cf_handle === "string" ? i.cf_handle.trim() : "";
      if (h && !/^[\w.-]{3,24}$/.test(h)) throw new Fail(400, "That is not a valid Codeforces handle.");
      sets.push(`cf_handle = $${idx++}`);
      params.push(h || null);
      sets.push(`handle = $${idx++}`);
      params.push(h);
      p.handle = h;
    }
    if ("cf_rating" in i && i.cf_rating !== undefined) {
      if (i.cf_rating === null || i.cf_rating === "") {
        sets.push(`cf_rating = null`);
      } else {
        const r = Number(i.cf_rating);
        if (!Number.isInteger(r) || r < 0 || r > 4500) throw new Fail(400, "Invalid Codeforces rating.");
        sets.push(`cf_rating = $${idx++}`);
        params.push(r);
        sets.push(`rating = $${idx++}`);
        params.push(r);
      }
    }
    if ("problems_solved" in i && i.problems_solved !== undefined) {
      const s = Number(i.problems_solved);
      if (!Number.isInteger(s) || s < 0 || s > 50000) throw new Fail(400, "Invalid solved count.");
      sets.push(`problems_solved = $${idx++}`);
      params.push(s);
      sets.push(`solved = greatest(solved, $${idx - 1})`);
    }
    if ("github_url" in i) {
      sets.push(`github_url = $${idx++}`);
      params.push(optionalUrl(i.github_url, "GitHub URL"));
    }
    if ("linkedin_url" in i) {
      sets.push(`linkedin_url = $${idx++}`);
      params.push(optionalUrl(i.linkedin_url, "LinkedIn URL"));
    }
    if ("skills" in i) {
      if (!Array.isArray(i.skills)) throw new Fail(400, "Skills must be a list.");
      const cleanSkills = [...new Set(i.skills.map((x) => (typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "")).filter(Boolean))].slice(0, 15);
      for (const sk of cleanSkills) if (sk.length > 40) throw new Fail(400, "Each skill must be at most 40 characters.");
      sets.push(`skills = $${idx++}::text[]`);
      params.push(cleanSkills);
    }
    if ("avatar_url" in i) {
      sets.push(`avatar_url = $${idx++}`);
      params.push(optionalAvatar(i.avatar_url));
    }

    if (sets.length > 0) {
      let prevStats: { cf_rating: number | null; rating: number; problems_solved: number; solved: number; current_streak: number; streak: number; cf_handle: string | null; handle: string } | null = null;
      if ("cf_rating" in i || "problems_solved" in i) {
        prevStats = (await c.query(
          `select cf_rating, rating, problems_solved, solved, current_streak, streak, cf_handle, handle from users where id = $1`,
          [a.id]
        )).rows[0] ?? null;
      }
      await c.query(`update users set ${sets.join(", ")} where id = $1`, params);
      if (prevStats) {
        const after = (await c.query(
          `select cf_rating, rating, problems_solved, solved, current_streak, streak, cf_handle, handle from users where id = $1`,
          [a.id]
        )).rows[0];
        if (after) {
          const detected = detectCrossovers(
            {
              cf_rating: prevStats.cf_rating !== null ? Number(prevStats.cf_rating) : prevStats.rating > 0 ? Number(prevStats.rating) : null,
              problems_solved: Math.max(Number(prevStats.problems_solved || 0), Number(prevStats.solved || 0)),
              current_streak: Math.max(Number(prevStats.current_streak || 0), Number(prevStats.streak || 0)),
            },
            {
              cf_rating: after.cf_rating !== null ? Number(after.cf_rating) : after.rating > 0 ? Number(after.rating) : null,
              problems_solved: Math.max(Number(after.problems_solved || 0), Number(after.solved || 0)),
              current_streak: Math.max(Number(after.current_streak || 0), Number(after.streak || 0)),
            },
            { cf_handle: after.cf_handle || after.handle || null, source: "profile_update" }
          );
          for (const m of detected) {
            await c.query(
              `insert into milestones (user_id, type, from_value, to_value, threshold, meta)
               values ($1, $2, $3, $4, $5, $6::jsonb)
               on conflict (user_id, type, to_value) do nothing`,
              [a.id, m.type, m.from_value, m.to_value, m.threshold, JSON.stringify(m.meta)]
            );
          }
        }
      }
    }
  },
  async kudosMilestone(c, a, _p, i) {
    person(a);
    const milestoneId = posInt(i.milestoneId, "milestone");
    const res = await giveMilestoneKudosTx(c, a, milestoneId);
    if (!res.ok && res.reason === "DAILY_LIMIT") {
      throw new Fail(429, "DAILY LIMIT REACHED. TRY AGAIN TOMORROW.");
    }
  },
  async saveAlumni(c, a, _p, i) {
    const alumniId = key(i.alumniId);
    const has = (await c.query(`select 1 from alumni_saves where user_id = $1 and alumni_id = $2`, [a.id, alumniId])).rowCount! > 0;
    if (has) {
      await c.query(`delete from alumni_saves where user_id = $1 and alumni_id = $2`, [a.id, alumniId]);
      return "UNSAVED";
    } else {
      await c.query(`insert into alumni_saves (user_id, alumni_id) values ($1, $2) on conflict do nothing`, [a.id, alumniId]);
      return "SAVED";
    }
  },
  async setAvailableForQuestions(c, a, _p, i) {
    const targetId = typeof i.alumniId === "string" && KEY.test(i.alumniId) ? i.alumniId : a.id;
    need(targetId === a.id || isAdmin(a.role), "Only the account owner or an admin can change mentoring availability.");
    const val = Boolean(i.value);
    await c.query(`update users set available_for_questions = $1 where id = $2 and not system`, [val, targetId]);
    await audit(c, a, `set mentoring availability for ${targetId} to ${val}`);
  },
  async createAlumniJob(c, a, _p, i) {
    need(canFully(a.role, "alumni.job.post"), "Only alumni or admins can post alumni jobs.");
    const company = text(i.company, 1, 100, "Company");
    const roleTitle = text(i.title ?? i.role, 1, 120, "Role");
    const url = optionalUrl(i.url, "Job URL");
    if (!url) throw new Fail(400, "Job URL is required.");
    const location = i.location ? text(i.location, 1, 100, "Location") : null;
    const alumniId = isAdmin(a.role) && typeof i.alumniId === "string" && KEY.test(i.alumniId) ? i.alumniId : a.id;
    const owner = (await c.query(`select id from users where id = $1 and not system`, [alumniId])).rows[0];
    if (!owner) throw new Fail(404, "Target member does not exist.");
    const vacancies = Math.max(1, Math.min(999, posInt(i.vacancies ?? 1, "vacancies")));
    const jobType = i.job_type ? String(i.job_type) : "Full-time";
    const experience = i.experience ? text(i.experience, 1, 100, "Experience") : null;
    const salary = i.salary ? text(i.salary, 1, 100, "Salary") : null;
    const description = i.description ? String(i.description).trim() : null;
    const responsibilities = Array.isArray(i.responsibilities) ? i.responsibilities.map(String).map((s) => s.trim()).filter(Boolean) : [];
    const requirements = Array.isArray(i.requirements) ? i.requirements.map(String).map((s) => s.trim()).filter(Boolean) : [];
    const deadline = i.deadline ? String(i.deadline).slice(0, 10) : null;
    const companyLogoUrl = typeof i.company_logo_url === "string" && i.company_logo_url.trim() ? i.company_logo_url.trim() : null;

    await c.query(
      `insert into alumni_jobs (
         alumni_id, company, role, title, location, url, source,
         vacancies, job_type, experience, salary, description, responsibilities, requirements, deadline, company_logo_url, posted_at
       ) values ($1, $2, $3, $3, $4, $5, 'manual', $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14, now())`,
      [
        alumniId, company, roleTitle, location, url,
        vacancies, jobType, experience, salary, description,
        JSON.stringify(responsibilities), JSON.stringify(requirements),
        deadline, companyLogoUrl
      ]
    );
    await audit(c, a, `posted alumni job: ${company} — ${roleTitle}`);
  },
  async deleteAlumniJob(c, a, _p, i) {
    const jobId = posInt(i.jobId, "job");
    const row = (await c.query(`select id, alumni_id, company, role from alumni_jobs where id = $1`, [jobId])).rows[0];
    if (!row) throw new Fail(404, "That job listing does not exist.");
    need(row.alumni_id === a.id || isAdmin(a.role), "Only the author or an admin can delete this job.");
    await c.query(`delete from alumni_jobs where id = $1`, [jobId]);
    await audit(c, a, `deleted alumni job #${jobId} (${row.company} — ${row.role})`);
  },
  async toggleInterviewProblem(c, a, _p, i) {
    person(a);
    const problemId = posInt(i.problemId, "problem");
    const has = (await c.query(`select 1 from interview_user_progress where user_id = $1 and problem_id = $2`, [a.id, problemId])).rowCount! > 0;
    if (has) {
      await c.query(`delete from interview_user_progress where user_id = $1 and problem_id = $2`, [a.id, problemId]);
    } else {
      await c.query(`insert into interview_user_progress (user_id, problem_id) values ($1, $2) on conflict do nothing`, [a.id, problemId]);
    }
  },
  async createInterviewTopic(c, a, _p, i) {
    need(canFully(a.role, "interview.topic.create"), "Only alumni or admins can create interview topics.");
    const name = text(i.name, 2, 80, "Topic name");
    const desc = i.description ? text(i.description, 1, 300, "Description") : null;
    const maxOrder = (await c.query(`select coalesce(max(order_index), 0) as max_ord from interview_topics`)).rows[0]?.max_ord ?? 0;
    await c.query(
      `insert into interview_topics (name, description, created_by, order_index) values ($1, $2, $3, $4)`,
      [name, desc, a.id, maxOrder + 1]
    );
    await audit(c, a, `created interview topic: ${name}`);
  },
  async createInterviewProblem(c, a, _p, i) {
    need(canFully(a.role, "interview.problem.create"), "Only alumni or admins can add interview problems.");
    const topicId = posInt(i.topicId, "topic");
    const title = text(i.title, 2, 120, "Title");
    const url = optionalUrl(i.url, "Problem URL");
    if (!url) throw new Fail(400, "Problem URL is required.");
    const diff = pick(i.difficulty, ["easy", "medium", "hard"] as const, "difficulty");
    const topic = (await c.query(`select id from interview_topics where id = $1`, [topicId])).rows[0];
    if (!topic) throw new Fail(404, "That topic does not exist.");
    await c.query(
      `insert into interview_problems (topic_id, title, url, difficulty, created_by) values ($1, $2, $3, $4, $5)`,
      [topicId, title, url, diff, a.id]
    );
    await audit(c, a, `added problem to topic #${topicId}: ${title}`);
  },
  async deleteInterviewProblem(c, a, _p, i) {
    const problemId = posInt(i.problemId, "problem");
    const p = (await c.query(`select id, created_by, title from interview_problems where id = $1`, [problemId])).rows[0];
    if (!p) throw new Fail(404, "That problem does not exist.");
    need(p.created_by === a.id || isAdmin(a.role), "Only the creator or an admin can delete this problem.");
    await c.query(`delete from interview_problems where id = $1`, [problemId]);
    await audit(c, a, `deleted interview problem #${problemId}: ${p.title}`);
  },
  async createInterviewTip(c, a, _p, i) {
    need(canFully(a.role, "interview.tip.create"), "Only alumni or admins can create interview tips.");
    const topicId = i.topicId ? posInt(i.topicId, "topic") : null;
    if (topicId) {
      const topic = (await c.query(`select id from interview_topics where id = $1`, [topicId])).rows[0];
      if (!topic) throw new Fail(404, "That topic does not exist.");
    }
    const title = text(i.title, 2, 140, "Title");
    const bodyMd = mdText(i.body_md ?? i.body, 1, 20_000, "Body");
    await c.query(
      `insert into interview_tips (author_id, topic_id, title, body_md) values ($1, $2, $3, $4)`,
      [a.id, topicId, title, bodyMd]
    );
    await audit(c, a, `posted interview tip: ${title}`);
  },
  async deleteInterviewTip(c, a, _p, i) {
    const tipId = posInt(i.tipId, "tip");
    const tip = (await c.query(`select id, author_id, title from interview_tips where id = $1`, [tipId])).rows[0];
    if (!tip) throw new Fail(404, "That tip does not exist.");
    need(tip.author_id === a.id || isAdmin(a.role), "Only the author or an admin can delete this tip.");
    await c.query(`delete from interview_tips where id = $1`, [tipId]);
    await audit(c, a, `deleted interview tip #${tipId}: ${tip.title}`);
  },
  async createBlogPost(c, a, _p, i) {
    need(canFully(a.role, "blog.post.create"), "Only alumni or admins can write blog posts.");
    const title = text(i.title, 2, 120, "Title");
    const subtitle = i.subtitle ? text(i.subtitle, 1, 200, "Subtitle") : null;
    const bodyMd = mdText(i.body_md ?? i.body, 1, 50_000, "Story");
    const excerpt = i.excerpt ? text(i.excerpt, 1, 280, "Excerpt") : excerptFromMarkdown(bodyMd, 140);
    const coverUrl = typeof i.cover_url === "string" && i.cover_url.trim() ? i.cover_url.trim() : null;
    const tags = Array.isArray(i.tags) ? i.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [];
    const status = pick(i.status ?? "draft", ["draft", "published"] as const, "status");
    let slug = i.slug ? text(i.slug, 2, 100, "Slug").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") : "";
    if (!slug) {
      slug = title.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    }
    const exists = (await c.query(`select 1 from blog_posts where slug = $1`, [slug])).rowCount! > 0;
    if (exists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    const publishedAt = status === "published" ? new Date() : null;
    await c.query(
      `insert into blog_posts (author_id, slug, title, subtitle, excerpt, body_md, cover_url, tags, status, published_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
      [a.id, slug, title, subtitle, excerpt, bodyMd, coverUrl, JSON.stringify(tags), status, publishedAt]
    );
    await audit(c, a, `created blog post: ${title} (${status})`);
  },
  async updateBlogPost(c, a, _p, i) {
    const id = posInt(i.id, "post");
    const post = (await c.query(`select id, author_id, title, status, published_at from blog_posts where id = $1`, [id])).rows[0];
    if (!post) throw new Fail(404, "That post does not exist.");
    need(post.author_id === a.id || isAdmin(a.role), "Only the author or an admin can edit this post.");
    const title = i.title ? text(i.title, 2, 120, "Title") : post.title;
    const subtitle = i.subtitle !== undefined ? (i.subtitle ? text(i.subtitle, 1, 200, "Subtitle") : null) : null;
    const bodyMd = i.body_md ? mdText(i.body_md, 1, 50_000, "Story") : null;
    const excerpt = i.excerpt !== undefined ? (i.excerpt ? text(i.excerpt, 1, 280, "Excerpt") : null) : (bodyMd ? excerptFromMarkdown(bodyMd, 140) : null);
    const coverUrl = i.cover_url !== undefined ? (typeof i.cover_url === "string" && i.cover_url.trim() ? i.cover_url.trim() : null) : undefined;
    const tags = Array.isArray(i.tags) ? i.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : undefined;
    const status = i.status ? pick(i.status, ["draft", "published"] as const, "status") : undefined;
    let publishedAt = post.published_at;
    if (status === "published" && !publishedAt) {
      publishedAt = new Date();
    }
    await c.query(
      `update blog_posts set
         title = coalesce($2, title),
         subtitle = case when $3::int is null then subtitle else $4 end,
         excerpt = case when $5::int is null then excerpt else $6 end,
         body_md = coalesce($7, body_md),
         cover_url = case when $8::int is null then cover_url else $9 end,
         tags = case when $10::int is null then tags else $11::jsonb end,
         status = coalesce($12, status),
         published_at = coalesce($13, published_at),
         updated_at = now()
       where id = $1`,
      [
        id,
        i.title ? title : null,
        i.subtitle !== undefined ? 1 : null, subtitle,
        i.excerpt !== undefined || bodyMd ? 1 : null, excerpt,
        bodyMd,
        i.cover_url !== undefined ? 1 : null, coverUrl,
        tags ? 1 : null, tags ? JSON.stringify(tags) : null,
        status ?? null,
        publishedAt
      ]
    );
    await audit(c, a, `updated blog post #${id}: ${title}`);
  },
  async deleteBlogPost(c, a, _p, i) {
    const id = posInt(i.id, "post");
    const post = (await c.query(`select id, author_id, title from blog_posts where id = $1`, [id])).rows[0];
    if (!post) throw new Fail(404, "That post does not exist.");
    need(post.author_id === a.id || isAdmin(a.role), "Only the author or an admin can delete this post.");
    await c.query(`delete from blog_posts where id = $1`, [id]);
    await audit(c, a, `deleted blog post #${id}: ${post.title}`);
  },
  async promoteMember(c, a, _p, i) {
    need(canFully(a.role, "member.promote"), "Only the President or Super Admin can promote members.");
    const userId = key(i.userId);
    need(userId !== a.id, "You cannot promote yourself.");
    const r = await c.query(
      `update users set role = 'mentor', title = 'Mentor' where id = $1 and not system and role <> 'super_admin' returning name`,
      [userId]
    );
    if (!r.rows[0]) throw new Fail(404, "That member does not exist, or cannot be modified.");
    await audit(c, a, `promoted ${r.rows[0].name} to Mentor`);
  },
  async makeAlumni(c, a, _p, i) {
    need(canFully(a.role, "member.makeAlumni"), "Only the President or Super Admin can transition members to alumni.");
    const userId = key(i.userId);
    need(userId !== a.id, "You cannot transition your own account.");
    const r = await c.query(
      `update users set role = 'alumni', title = 'Alumni' where id = $1 and not system and role <> 'super_admin' returning name`,
      [userId]
    );
    if (!r.rows[0]) throw new Fail(404, "That member does not exist, or cannot be modified.");
    await audit(c, a, `transitioned ${r.rows[0].name} to Alumni`);
  },
  async deactivateMember(c, a, _p, i) {
    need(canFully(a.role, "member.deactivate"), "Only the President or Super Admin can deactivate members.");
    const userId = key(i.userId);
    need(userId !== a.id, "You cannot deactivate yourself.");
    const r = await c.query(
      `update users set suspended = true where id = $1 and not system and (role <> 'super_admin' or $2) returning name`,
      [userId, a.role === "super_admin"]
    );
    if (!r.rows[0]) throw new Fail(404, "That member does not exist, or is a Super Admin.");
    await c.query(`delete from sessions where user_id = $1`, [userId]);
    await audit(c, a, `deactivated ${r.rows[0].name}`);
  },
};
export const actionTypes = Object.keys(handlers);

/** Runs one action for `userId`. Throws Fail for anything the caller got wrong; returns an optional one-time notice. */
export async function act(userId: string, input: unknown): Promise<string | void> {
  const i = (input && typeof input === "object" ? input : {}) as In, run = handlers[String(i.type)];
  if (!run || !Object.hasOwn(handlers, String(i.type))) throw new Fail(400, "Unknown action.");
  return tx(async (c) => {
    const u = (await c.query(`select id, role, name, system, progress from users where id = $1 and not suspended for update`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const p = progress(u.progress), before = JSON.stringify(p);
    const info = await run(c, { id: u.id, role: u.role, name: u.name, system: u.system }, p, i);
    const after = JSON.stringify(p);
    if (after !== before) await c.query(`update users set progress = $2 where id = $1`, [userId, after]);
    return info;
  });
}

/** The public join form. Anyone can call it, so it is strict about what it accepts. */
export async function apply(db: Db, i: In) {
  const email = text(i.email, 5, 200, "Email").toLowerCase(), batch = Number(i.batch);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Fail(400, "Enter a valid email address.");
  if (!Number.isInteger(batch) || batch < 0 || batch > 99) throw new Fail(400, "Batch is a two-digit number, like 24.");
  const cf = typeof i.cf === "string" && /^[\w.-]{3,24}$/.test(i.cf.trim()) ? i.cf.trim() : "";
  const row = [text(i.name, 2, 80, "Your name"), text(i.sid, 3, 40, "Student ID"), text(i.dept, 2, 20, "Department"), batch, email, cf, text(i.track, 2, 10, "Track"), text(i.why, 10, 1000, "Your answer")];
  const taken = (await db.query(`select 1 from users where email = $1`, [email])).rowCount;
  const r = taken ? { rowCount: 0 } : await db.query(`insert into applications (name, sid, dept, batch, email, cf, track, why) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict do nothing`, row);
  if (!r.rowCount) throw new Fail(409, "An application or an account already exists for that email address.");
}

/** Member export for officers. The download itself is the audited event. */
export async function exportMembers(userId: string) {
  return tx(async (c) => {
    const u = (await c.query(`select role, name from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u || !can(u.role, "data.export")) throw new Fail(403, "Your role cannot export data.");
    await audit(c, { id: userId, role: u.role, name: u.name, system: false }, "exported member data (CSV)");
    const rows = (await c.query(`select name, handle, batch, dept, rating, solved, case when suspended then 'suspended' else 'active' end as status from users where not system order by name`)).rows;
    // A leading = + - @ would run as a formula when the file is opened in a spreadsheet.
    const cell = (v: unknown) => { const t = String(v); return `"${(/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replaceAll('"', '""')}"`; };
    return "name,handle,batch,dept,rating,solved,status\n" + rows.map((r) => [r.name, r.handle, r.batch, r.dept, r.rating, r.solved, r.status].map(cell).join(",")).join("\n") + "\n";
  });
}

/** Cursor-paginated Feed posts for infinite scroll. */
export async function listFeedPosts(
  db: Db,
  userId: string,
  input: { q?: string; category?: string; sort?: string; cursor?: string | number | null; limit?: number } = {}
): Promise<{ items: FeedPostSummary[]; nextCursor: string | null }> {
  const limit = Math.min(50, Math.max(1, Number(input.limit) || 20));
  const q = typeof input.q === "string" ? input.q.trim() : "";
  const rawCat = typeof input.category === "string" ? input.category.trim().toLowerCase() : "";
  const category = rawCat && rawCat !== "all" ? FEED_CAT_ALIAS[rawCat] ?? null : null;
  const sort = input.sort === "top" ? "top" : "new";
  const where: string[] = [];
  const params: unknown[] = [userId];
  let idx = 2;

  if (q) {
    where.push(`(fp.title ilike $${idx} or fp.body_md ilike $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (category) {
    where.push(`fp.category = $${idx}`);
    params.push(category);
    idx++;
  }
  if (input.cursor !== undefined && input.cursor !== null && String(input.cursor).trim() !== "") {
    if (sort === "top") {
      const m = /^(-?\d+):(\d+)$/.exec(String(input.cursor));
      if (m) {
        where.push(`(fp.score < $${idx} or (fp.score = $${idx} and fp.id < $${idx + 1}))`);
        params.push(Number(m[1]), Number(m[2]));
        idx += 2;
      }
    } else {
      const cId = Number(input.cursor);
      if (Number.isInteger(cId) && cId > 0) {
        where.push(`fp.id < $${idx}`);
        params.push(cId);
        idx++;
      }
    }
  }

  params.push(limit + 1);
  const orderBy = sort === "top" ? `fp.score desc, fp.id desc` : `fp.created_at desc, fp.id desc`;
  const sql = `
    select fp.id, fp.user_id, u.name as author_name, greatest(u.problems_solved, u.solved) as author_solved,
      u.rating as author_rating, u.title as author_role, u.avatar_url as author_avatar,
      fp.title, fp.body_md, fp.category, fp.score,
      coalesce(v.value, 0)::int as my_vote,
      fp.created_at, fp.updated_at
    from feed_posts fp
    join users u on u.id = fp.user_id
    left join feed_votes v on v.post_id = fp.id and v.user_id = $1
    ${where.length ? "where " + where.join(" and ") : ""}
    order by ${orderBy}
    limit $${idx}`;
  const rows = (await db.query(sql, params)).rows as FeedPostSummary[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? (sort === "top" ? `${last.score}:${last.id}` : String(last.id)) : null;
  return { items, nextCursor };
}

/** Full detail for a single Feed post modal (body, author contribution stats, author recent posts). */
export async function getFeedPostDetail(db: Db, userId: string, input: { postId: number | string }): Promise<FeedPostDetail> {
  const postId = posInt(input.postId, "post");
  const row = (await db.query(
    `select fp.id, fp.user_id, u.name as author_name, greatest(u.problems_solved, u.solved) as author_solved,
        u.rating as author_rating, u.title as author_role, u.avatar_url as author_avatar, u.streak as author_streak,
        fp.title, fp.body_md, fp.category, fp.score,
        coalesce(v.value, 0)::int as my_vote,
        (select count(*)::int from feed_posts x where x.user_id = fp.user_id) as author_posts_count,
        exists (select 1 from feed_reports fr where fr.post_id = fp.id and fr.user_id = $1) as reported_by_me,
        fp.created_at, fp.updated_at
      from feed_posts fp
      join users u on u.id = fp.user_id
      left join feed_votes v on v.post_id = fp.id and v.user_id = $1
      where fp.id = $2`,
    [userId, postId]
  )).rows[0];
  if (!row) throw new Fail(404, "That post does not exist.");

  const recent = (await db.query(
    `select id, title, created_at from feed_posts where user_id = $1 and id <> $2 order by created_at desc limit 4`,
    [row.user_id, postId]
  )).rows as { id: number; title: string; created_at: string }[];

  return { ...row, author_recent: recent };
}

/** Cursor-paginated Ideas list (merged with Teammates). Never returns interested[] member list. */
export async function listIdeas(
  db: Db,
  userId: string,
  input: { q?: string; type?: string; status?: string; sort?: string; cursor?: string | number | null; limit?: number } = {}
): Promise<{ items: IdeaSummary[]; nextCursor: string | null }> {
  const limit = Math.min(50, Math.max(1, Number(input.limit) || 20));
  const q = typeof input.q === "string" ? input.q.trim() : "";
  const type = typeof input.type === "string" && IDEA_TYPES.includes(input.type as IdeaType) ? (input.type as IdeaType) : null;
  const status = typeof input.status === "string" && IDEA_STATUSES.includes(input.status as IdeaStatus) ? (input.status as IdeaStatus) : null;
  const sort = input.sort === "new" ? "new" : "top";
  const where: string[] = [];
  const params: unknown[] = [userId];
  let idx = 2;

  if (q) {
    where.push(`(i.title ilike $${idx} or i.body_md ilike $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (type) {
    where.push(`i.type = $${idx}`);
    params.push(type);
    idx++;
  }
  if (status) {
    where.push(`i.status = $${idx}`);
    params.push(status);
    idx++;
  }

  let cursorClause = "";
  if (input.cursor !== undefined && input.cursor !== null && String(input.cursor).trim() !== "") {
    if (sort === "top") {
      const m = /^(\d+):(\d+)$/.exec(String(input.cursor));
      if (m) {
        cursorClause = `where (upvotes < $${idx} or (upvotes = $${idx} and id < $${idx + 1}))`;
        params.push(Number(m[1]), Number(m[2]));
        idx += 2;
      }
    } else {
      const cId = Number(input.cursor);
      if (Number.isInteger(cId) && cId > 0) {
        where.push(`i.id < $${idx}`);
        params.push(cId);
        idx++;
      }
    }
  }

  params.push(limit + 1);
  const sql = `
    with base as (
      select i.id, i.user_id, u.name as author_name, greatest(u.problems_solved, u.solved) as author_solved,
        u.rating as author_rating, u.avatar_url as author_avatar,
        i.title, i.body_md, i.type, i.status, i.roles,
        (select count(*)::int from reactions r where r.target = 'idea:' || i.id) as upvotes,
        (select count(*)::int from community_comments cc where cc.target_type = 'idea' and cc.target_id = i.id) as comment_count,
        (select count(*)::int from idea_interests ii where ii.idea_id = i.id) as interested_count,
        (select count(*)::int from idea_interests ii where ii.idea_id = i.id and ii.status = 'accepted') as accepted_count,
        (select ii.status from idea_interests ii where ii.idea_id = i.id and ii.user_id = $1) as my_interest,
        i.created_at, i.updated_at
      from ideas i
      join users u on u.id = i.user_id
      ${where.length ? "where " + where.join(" and ") : ""}
    )
    select * from base
    ${cursorClause}
    order by ${sort === "top" ? "upvotes desc, id desc" : "created_at desc, id desc"}
    limit $${idx}`;
  const rows = (await db.query(sql, params)).rows as IdeaSummary[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? (sort === "top" ? `${last.upvotes}:${last.id}` : String(last.id)) : null;
  return { items, nextCursor };
}

/**
 * Idea detail for modal. Marks idea as viewed server-side.
 * STRICT PRIVACY: `interested` is queried and included ONLY when viewerId === idea.user_id.
 */
export async function getIdeaDetail(db: Db, viewerId: string, input: { ideaId: number | string }): Promise<IdeaDetail> {
  const ideaId = posInt(input.ideaId, "idea");
  const row = (await db.query(
    `select i.id, i.user_id, u.name as author_name, greatest(u.problems_solved, u.solved) as author_solved,
        u.rating as author_rating, u.avatar_url as author_avatar,
        i.title, i.body_md, i.type, i.status, i.roles,
        (select count(*)::int from reactions r where r.target = 'idea:' || i.id) as upvotes,
        (select count(*)::int from community_comments cc where cc.target_type = 'idea' and cc.target_id = i.id) as comment_count,
        (select count(*)::int from idea_interests ii where ii.idea_id = i.id) as interested_count,
        (select count(*)::int from idea_interests ii where ii.idea_id = i.id and ii.status = 'accepted') as accepted_count,
        (select ii.status from idea_interests ii where ii.idea_id = i.id and ii.user_id = $1) as my_interest,
        i.created_at, i.updated_at
      from ideas i
      join users u on u.id = i.user_id
      where i.id = $2`,
    [viewerId, ideaId]
  )).rows[0] as IdeaSummary | undefined;
  if (!row) throw new Fail(404, "That idea does not exist.");

  // Record view server-side on modal open.
  await db.query(`insert into idea_views (idea_id, user_id) values ($1, $2) on conflict do nothing`, [ideaId, viewerId]);

  const comments = (await db.query(
    `select cc.id, cc.user_id, u.name as author_name, greatest(u.problems_solved, u.solved) as author_solved,
        u.avatar_url as author_avatar, cc.body, cc.created_at
      from community_comments cc
      join users u on u.id = cc.user_id
      where cc.target_type = 'idea' and cc.target_id = $1
      order by cc.id asc`,
    [ideaId]
  )).rows as CommunityComment[];

  const detail: IdeaDetail = { ...row, comments };
  // Enforce server-side: interested[] returned ONLY if viewerId === idea.user_id.
  if (viewerId === row.user_id) {
    detail.interested = (await db.query(
      `select ii.user_id, u.name, u.rating, greatest(u.problems_solved, u.solved) as problems_solved,
          u.avatar_url, ii.response, ii.status, ii.created_at, ii.decided_at
        from idea_interests ii
        join users u on u.id = ii.user_id
        where ii.idea_id = $1
        order by case ii.status when 'pending' then 0 when 'accepted' then 1 else 2 end, ii.created_at desc`,
      [ideaId]
    )).rows as IdeaInterestRow[];
  }
  return detail;
}

/**
 * Paginated, filtered member roster for `/app/members`.
 * Composes all filters (q, rating tier title, skill, batch, type) with AND.
 */
export async function listMembers(
  db: Db,
  _viewerId: string,
  input: { q?: string; rating?: string; skill?: string; batch?: number | string; type?: string; page?: number; pageSize?: number } = {}
): Promise<{ members: MemberSummary[]; total: number; clubTotal: number; hasMore: boolean; skills: string[]; batches: number[] }> {
  const pageSize = Math.min(48, Math.max(1, Number(input.pageSize) || 16));
  const page = Math.max(0, Math.floor(Number(input.page) || 0));
  const q = typeof input.q === "string" ? input.q.trim() : "";
  const rating = typeof input.rating === "string" ? input.rating.trim() : "";
  const skill = typeof input.skill === "string" ? input.skill.trim() : "";
  const batchNum = input.batch !== undefined && input.batch !== "" && input.batch !== null ? Number(input.batch) : NaN;
  const type = typeof input.type === "string" ? input.type.trim().toLowerCase() : "all";

  const where: string[] = [`not u.system`, `not u.suspended`];
  const params: unknown[] = [];
  let idx = 1;

  if (q) {
    where.push(`(u.name ilike $${idx} or coalesce(nullif(u.cf_handle, ''), u.handle) ilike $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }

  if (rating && rating.toLowerCase() !== "all ratings") {
    if (rating.toLowerCase() === UNRATED_RANK.title.toLowerCase()) {
      where.push(`(greatest(u.problems_solved, u.solved) = 0 and coalesce(nullif(u.cf_handle, ''), u.handle, '') = '')`);
    } else {
      const tier = RANKS.find((r) => r.title.toLowerCase() === rating.toLowerCase());
      if (tier) {
        if (tier.min === 0) {
          where.push(`(greatest(u.problems_solved, u.solved) between 0 and $${idx} and not (greatest(u.problems_solved, u.solved) = 0 and coalesce(nullif(u.cf_handle, ''), u.handle, '') = ''))`);
          params.push(tier.max);
          idx++;
        } else if (Number.isFinite(tier.max)) {
          where.push(`greatest(u.problems_solved, u.solved) between $${idx} and $${idx + 1}`);
          params.push(tier.min, tier.max);
          idx += 2;
        } else {
          where.push(`greatest(u.problems_solved, u.solved) >= $${idx}`);
          params.push(tier.min);
          idx++;
        }
      }
    }
  }

  if (skill && skill.toLowerCase() !== "any skill") {
    where.push(`$${idx} = any(u.skills)`);
    params.push(skill);
    idx++;
  }

  if (Number.isInteger(batchNum) && batchNum > 0) {
    where.push(`u.batch = $${idx}`);
    params.push(batchNum);
    idx++;
  }

  if (type === "alumni") {
    where.push(`u.role = 'alumni'`);
  } else if (type === "current") {
    where.push(`u.role <> 'alumni'`);
  }

  const whereSql = where.join(" and ");
  const [countRes, metaRes, rowsRes] = await Promise.all([
    db.query(`select count(*)::int as total from users u where ${whereSql}`, params),
    db.query(
      `select
         count(*)::int as club_total,
         coalesce((select json_agg(s order by s) from (select distinct unnest(skills) as s from users where not system and not suspended) x), '[]'::json) as skills,
         coalesce((select json_agg(b order by b desc) from (select distinct batch as b from users where not system and not suspended and batch > 0) y), '[]'::json) as batches
       from users where not system and not suspended`
    ),
    db.query(
      `select u.id, u.member_no as no, u.name,
         coalesce(nullif(u.cf_handle, ''), u.handle) as handle,
         nullif(coalesce(nullif(u.cf_handle, ''), u.handle), '') as cf_handle,
         u.title as role,
         (u.role = 'alumni') as is_alumni,
         u.batch, u.dept, u.squad,
         coalesce(u.cf_rating, u.rating) as rating,
         coalesce(u.cf_rating, nullif(u.rating, 0)) as cf_rating,
         greatest(u.problems_solved, u.solved) as problems_solved,
         greatest(u.current_streak, u.streak) as current_streak,
         u.contests_participated,
         u.skills,
         u.avatar_url
       from users u
       where ${whereSql}
       order by coalesce(u.cf_rating, u.rating) desc, greatest(u.problems_solved, u.solved) desc, u.name asc
       limit $${idx} offset $${idx + 1}`,
      [...params, pageSize, page * pageSize]
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  const clubTotal = Number(metaRes.rows[0]?.club_total ?? 0);
  const skills = (metaRes.rows[0]?.skills ?? []) as string[];
  const batches = (metaRes.rows[0]?.batches ?? []) as number[];
  const members = rowsRes.rows as MemberSummary[];
  const hasMore = page * pageSize + members.length < total;

  return { members, total, clubTotal, hasMore, skills, batches };
}

/**
 * Full resume payload for a single member profile modal.
 * Returns private fields (e.g. `email`) ONLY when `viewerId === userId`.
 */
export async function getMemberProfile(db: Db, viewerId: string, input: { userId: string }): Promise<MemberProfile> {
  const userId = key(input.userId);
  const row = (await db.query(
    `select u.id, u.member_no as no, u.name, u.email,
       coalesce(nullif(u.cf_handle, ''), u.handle) as handle,
       nullif(coalesce(nullif(u.cf_handle, ''), u.handle), '') as cf_handle,
       u.title as role,
       (u.role = 'alumni') as is_alumni,
       u.batch, u.dept, u.squad,
       coalesce(u.cf_rating, u.rating) as rating,
       coalesce(u.cf_rating, nullif(u.rating, 0)) as cf_rating,
       greatest(u.problems_solved, u.solved) as problems_solved,
       greatest(u.current_streak, u.streak) as current_streak,
       u.contests_participated,
       u.skills,
       u.avatar_url,
       u.bio,
       u.github_url,
       u.linkedin_url,
       u.experience,
       u.contest_history,
       u.available_for_questions,
       u.location
     from users u
     where u.id = $1 and not u.system and not u.suspended`,
    [userId]
  )).rows[0];
  if (!row) throw new Fail(404, "That member does not exist.");

  const [activityRes, prepRes, jobsRes, tipsRes, blogsRes, jobsPostedRes] = await Promise.all([
    db.query(
      `select * from (
         select 'feed'::text as kind, id, title, created_at from feed_posts where user_id = $1
         union all
         select 'idea'::text as kind, id, title, created_at from ideas where user_id = $1
       ) x
       order by created_at desc
       limit 5`,
      [userId]
    ),
    row.is_alumni
      ? db.query(
          `select id, title, created_at from feed_posts where user_id = $1 order by created_at desc limit 10`,
          [userId]
        )
      : Promise.resolve({ rows: [] }),
    row.is_alumni
      ? db.query(
          `select id, alumni_id, company, role, coalesce(title, role) as title, vacancies, location, url, source, fetched_at, created_at
           from alumni_jobs
           where alumni_id = $1
           order by created_at desc`,
          [userId]
        )
      : Promise.resolve({ rows: [] }),
    row.is_alumni
      ? db.query(
          `select id, author_id, topic_id, title, body_md, created_at, updated_at
           from interview_tips
           where author_id = $1
           order by created_at desc`,
          [userId]
        )
      : Promise.resolve({ rows: [] }),
    row.is_alumni
      ? db.query(
          `select id, author_id, slug, title, subtitle, excerpt, body_md, cover_url, tags, status, published_at, views, created_at, updated_at
           from blog_posts
           where author_id = $1 and status = 'published'
           order by published_at desc`,
          [userId]
        )
      : Promise.resolve({ rows: [] }),
    row.is_alumni
      ? db.query(
          `select id, alumni_id, company, role, coalesce(title, role) as title, vacancies, location, job_type, experience, salary, description, responsibilities, requirements, to_char(deadline, 'YYYY-MM-DD') as deadline, company_logo_url, url, source, fetched_at, created_at
           from alumni_jobs
           where alumni_id = $1 and source = 'manual'
           order by created_at desc`,
          [userId]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const experience = Array.isArray(row.experience) ? (row.experience as MemberExperience[]) : [];
  const contest_history = Array.isArray(row.contest_history) ? (row.contest_history as MemberContestRow[]) : [];
  const recent_activity = activityRes.rows as MemberActivityItem[];

  const profile: MemberProfile = {
    id: row.id,
    no: row.no,
    name: row.name,
    handle: row.handle,
    cf_handle: row.cf_handle,
    role: row.role,
    is_alumni: Boolean(row.is_alumni),
    batch: row.batch,
    dept: row.dept,
    squad: row.squad,
    rating: row.rating,
    cf_rating: row.cf_rating,
    problems_solved: row.problems_solved,
    current_streak: row.current_streak,
    contests_participated: row.contests_participated,
    skills: Array.isArray(row.skills) ? row.skills : [],
    avatar_url: row.avatar_url ?? null,
    bio: row.bio ?? null,
    github_url: row.github_url ?? null,
    linkedin_url: row.linkedin_url ?? null,
    experience,
    contest_history,
    recent_activity,
  };

  if (viewerId === userId) {
    profile.email = row.email;
  }

  if (profile.is_alumni) {
    profile.available_for_questions = Boolean(row.available_for_questions ?? true);
    profile.location = row.location ?? null;
    profile.interview_prep = prepRes.rows as { id: number; title: string; created_at: string }[];
    profile.interview_tips = tipsRes.rows as InterviewTip[];
    profile.blogs = blogsRes.rows.map((b: any) => ({
      ...b,
      tags: Array.isArray(b.tags) ? b.tags : [],
    })) as BlogPost[];
    profile.jobs_posted = jobsPostedRes.rows.map((j: any) => ({
      ...j,
      responsibilities: Array.isArray(j.responsibilities) ? j.responsibilities : [],
      requirements: Array.isArray(j.requirements) ? j.requirements : [],
    })) as AlumniJob[];
    const allJobs = jobsRes.rows as AlumniJob[];
    profile.jobs_fetched = allJobs.filter((j) => j.source === "fetched");
    profile.jobs_manual = allJobs.filter((j) => j.source === "manual");
  }

  return profile;
}

type BoardSpec = { provider: "greenhouse" | "lever"; slug: string; company: string };

/**
 * On-demand / cron fetch of public Greenhouse / Lever job boards for an alumni member.
 * Inserts new listings into `alumni_jobs` with `source = 'fetched'`, deduplicated by URL.
 */
export async function fetchAlumniJobs(
  db: Db,
  actorId: string,
  input: { userId: string; boards?: BoardSpec[] }
): Promise<{ added: number; jobs: AlumniJob[] }> {
  const userId = key(input.userId);
  const actor = (await db.query(`select id, role, name from users where id = $1 and not suspended`, [actorId])).rows[0];
  if (!actor) throw new Fail(401, "Sign in again.");
  need(actor.id === userId || isAdmin(actor.role), "Only the alumni member or an admin can refresh fetched jobs.");

  const target = (await db.query(`select id, role from users where id = $1 and not system`, [userId])).rows[0];
  if (!target) throw new Fail(404, "That member does not exist.");
  need(target.role === "alumni", "Job board syncing is only available for alumni.");

  const boards: BoardSpec[] =
    Array.isArray(input.boards) && input.boards.length > 0
      ? input.boards.slice(0, 5)
      : [
          { provider: "greenhouse", slug: "stripe", company: "Stripe" },
          { provider: "lever", slug: "figma", company: "Figma" },
        ];

  let added = 0;
  for (const b of boards) {
    if (!/^[a-z0-9_-]{1,60}$/i.test(b.slug)) continue;
    try {
      let parsed: { role: string; location: string | null; url: string }[] = [];
      if (b.provider === "greenhouse") {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.slug)}/jobs`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const json = (await res.json()) as { jobs?: { title?: string; location?: { name?: string }; absolute_url?: string }[] };
          parsed = (json.jobs ?? [])
            .filter((j) => j.title && j.absolute_url)
            .slice(0, 5)
            .map((j) => ({
              role: String(j.title).slice(0, 120),
              location: j.location?.name ? String(j.location.name).slice(0, 100) : null,
              url: String(j.absolute_url).slice(0, 400),
            }));
        }
      } else if (b.provider === "lever") {
        const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(b.slug)}?mode=json`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const json = (await res.json()) as { text?: string; categories?: { location?: string }; hostedUrl?: string }[];
          if (Array.isArray(json)) {
            parsed = json
              .filter((j) => j.text && j.hostedUrl)
              .slice(0, 5)
              .map((j) => ({
                role: String(j.text).slice(0, 120),
                location: j.categories?.location ? String(j.categories.location).slice(0, 100) : null,
                url: String(j.hostedUrl).slice(0, 400),
              }));
          }
        }
      }
      for (const item of parsed) {
        const exists = (
          await db.query(`select 1 from alumni_jobs where alumni_id = $1 and url = $2`, [userId, item.url])
        ).rowCount! > 0;
        if (!exists) {
          await db.query(
            `insert into alumni_jobs (alumni_id, company, role, location, url, source, fetched_at) values ($1, $2, $3, $4, $5, 'fetched', now())`,
            [userId, b.company.slice(0, 100), item.role, item.location, item.url]
          );
          added++;
        }
      }
    } catch {
      // Public job board unreachable or timed out; continue gracefully without failing.
    }
  }

  const jobs = (
    await db.query(
      `select id, alumni_id, company, role, location, url, source, fetched_at, created_at
       from alumni_jobs where alumni_id = $1 and source = 'fetched' order by created_at desc`,
      [userId]
    )
  ).rows as AlumniJob[];

  return { added, jobs };
}

export type KudosMilestoneResult =
  | {
      ok: true;
      alreadyGiven: boolean;
      milestoneId: number;
      kudosCount: number;
      hasKudos: true;
      kudosToday: number;
    }
  | {
      ok: false;
      reason: "DAILY_LIMIT";
      kudosToday: number;
    };

/**
 * Returns the number of milestone kudos `userId` has given today (UTC day, resets at 00:00 UTC).
 */
export async function getKudosTodayCount(db: Db, userId: string): Promise<number> {
  const row = (
    await db.query(
      `select count(*)::int as n
       from milestone_kudos
       where user_id = $1
         and created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')`,
      [userId]
    )
  ).rows[0];
  return Number(row?.n ?? 0);
}

/**
 * Lists recent milestones from the last 14 days, newest first, capped at `limit` (default 5).
 * Includes live kudos counts, whether the viewer has already given kudos, and (for the owner)
 * up to 3 recent giver names.
 */
export async function listRecentMilestones(
  db: Db,
  userId: string,
  input: { limit?: number } = {}
): Promise<MilestoneDTO[]> {
  const limit = Math.min(50, Math.max(1, Math.floor(Number(input.limit) || 5)));
  const rows = (
    await db.query(
      `select m.id, m.user_id,
         u.name as member_name,
         u.avatar_url as member_avatar,
         greatest(u.problems_solved, u.solved) as member_solved,
         nullif(coalesce(nullif(u.cf_handle, ''), u.handle), '') as member_cf_handle,
         coalesce(u.cf_rating, u.rating) as member_rating,
         m.type, m.from_value, m.to_value, m.threshold, m.meta, m.created_at,
         (select count(*)::int from milestone_kudos mk where mk.milestone_id = m.id) as kudos_count,
         exists (select 1 from milestone_kudos mk where mk.milestone_id = m.id and mk.user_id = $1) as has_kudos,
         case when m.user_id = $1 then (
           select coalesce(json_agg(g.name order by mk.created_at desc), '[]'::json)
           from (
             select user_id, created_at from milestone_kudos where milestone_id = m.id and user_id <> $1 order by created_at desc limit 3
           ) mk
           join users g on g.id = mk.user_id
         ) else '[]'::json end as recent_givers
       from milestones m
       join users u on u.id = m.user_id
       where m.created_at > now() - ($2 || ' days')::interval
         and not u.system and not u.suspended
       order by m.created_at desc, m.id desc
       limit $3`,
      [userId, String(MILESTONE_FRESHNESS_DAYS), limit]
    )
  ).rows as MilestoneDTO[];
  return rows;
}

/**
 * Shared transactional implementation for giving a permanent, non-revocable kudos
 * on a milestone. Caller must already hold `FOR UPDATE` lock on the acting user's row.
 */
async function giveMilestoneKudosTx(c: Db, a: Actor, milestoneId: number): Promise<KudosMilestoneResult> {
  const milestone = (
    await c.query(`select id, user_id, type, to_value from milestones where id = $1`, [milestoneId])
  ).rows[0];
  if (!milestone) throw new Fail(404, "That milestone does not exist.");
  need(milestone.user_id !== a.id, "You cannot give kudos to your own milestone.");

  // Deduplication check: replaying an already-given milestone returns idempotently without hitting the cap.
  const existing = (
    await c.query(`select 1 from milestone_kudos where milestone_id = $1 and user_id = $2`, [milestoneId, a.id])
  ).rowCount! > 0;
  if (existing) {
    const [countRes, todayCount] = await Promise.all([
      c.query(`select count(*)::int as n from milestone_kudos where milestone_id = $1`, [milestoneId]),
      getKudosTodayCount(c, a.id),
    ]);
    return {
      ok: true,
      alreadyGiven: true,
      milestoneId,
      kudosCount: Number(countRes.rows[0]?.n ?? 0),
      hasKudos: true,
      kudosToday: todayCount,
    };
  }

  // Server-side daily cap guard (20/day UTC, enforced under user row lock).
  const todayCount = await getKudosTodayCount(c, a.id);
  if (todayCount >= DAILY_KUDOS_CAP) {
    return { ok: false, reason: "DAILY_LIMIT", kudosToday: todayCount };
  }

  const ins = await c.query(
    `insert into milestone_kudos (milestone_id, user_id)
     values ($1, $2)
     on conflict (milestone_id, user_id) do nothing
     returning milestone_id`,
    [milestoneId, a.id]
  );
  const inserted = (ins.rowCount ?? 0) > 0;
  const countRes = await c.query(`select count(*)::int as n from milestone_kudos where milestone_id = $1`, [milestoneId]);
  return {
    ok: true,
    alreadyGiven: !inserted,
    milestoneId,
    kudosCount: Number(countRes.rows[0]?.n ?? 0),
    hasKudos: true,
    kudosToday: todayCount + (inserted ? 1 : 0),
  };
}

/**
 * Gives one permanent kudos on a specific milestone.
 * Enforces server-side auth, non-system account, non-self check, deduplication (`ON CONFLICT DO NOTHING`),
 * and the 20/day UTC cap. Awards +2 XP and an inbox notification to the milestone owner on first kudos only.
 */
export async function kudosMilestone(
  userId: string,
  input: { milestoneId: number | string }
): Promise<KudosMilestoneResult> {
  const milestoneId = posInt(input.milestoneId, "milestone");
  return tx(async (c) => {
    const u = (
      await c.query(`select id, role, name, system from users where id = $1 and not suspended for update`, [userId])
    ).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    return giveMilestoneKudosTx(c, actor, milestoneId);
  });
}

/* ========================================================================== */
/*                           ALUMNI DIRECTORY                                 */
/* ========================================================================== */

export async function listAlumni(
  db: Db,
  viewerId: string,
  input: {
    q?: string;
    batch?: string | number;
    location?: string;
    mentoringOnly?: boolean;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ alumni: AlumniSummary[]; total: number; hasMore: boolean; batchOptions: number[]; locationOptions: string[] }> {
  const page = Math.max(0, Math.floor(Number(input.page) || 0));
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(input.pageSize) || 16)));
  const offset = page * pageSize;

  const conditions: string[] = ["u.role = 'alumni'", "not u.system", "not u.suspended"];
  const params: unknown[] = [];
  let pIdx = 1;

  if (input.q && typeof input.q === "string" && input.q.trim()) {
    const term = `%${input.q.trim()}%`;
    conditions.push(`(
      u.name ilike $${pIdx} or
      u.handle ilike $${pIdx} or
      coalesce(u.cf_handle, '') ilike $${pIdx} or
      coalesce(u.location, '') ilike $${pIdx} or
      coalesce(u.title, '') ilike $${pIdx} or
      exists (select 1 from alumni_jobs j where j.alumni_id = u.id and (j.company ilike $${pIdx} or j.role ilike $${pIdx} or coalesce(j.title, '') ilike $${pIdx}))
    )`);
    params.push(term);
    pIdx++;
  }

  if (input.batch !== undefined && input.batch !== "" && input.batch !== null && input.batch !== "all") {
    const b = Number(input.batch);
    if (!Number.isNaN(b)) {
      conditions.push(`u.batch = $${pIdx}`);
      params.push(b);
      pIdx++;
    }
  }

  if (input.location && typeof input.location === "string" && input.location.trim() && input.location !== "all") {
    conditions.push(`u.location ilike $${pIdx}`);
    params.push(input.location.trim());
    pIdx++;
  }

  if (input.mentoringOnly) {
    conditions.push(`u.available_for_questions = true`);
  }

  const whereSql = conditions.join(" and ");

  const countRow = (
    await db.query(`select count(*)::int as total from users u where ${whereSql}`, params)
  ).rows[0];
  const total = Number(countRow?.total ?? 0);

  const viewerParamIdx = pIdx++;
  const limitParamIdx = pIdx++;
  const offsetParamIdx = pIdx++;
  const queryParams = [...params, viewerId, pageSize, offset];

  const rowsRes = await db.query(
    `select u.id, u.member_no as no, u.name,
       coalesce(nullif(u.cf_handle, ''), u.handle) as handle,
       nullif(coalesce(nullif(u.cf_handle, ''), u.handle), '') as cf_handle,
       u.title as role,
       u.title,
       u.batch, u.dept,
       coalesce(u.cf_rating, u.rating) as rating,
       coalesce(u.cf_rating, nullif(u.rating, 0)) as cf_rating,
       greatest(u.problems_solved, u.solved) as problems_solved,
       u.skills,
       u.avatar_url,
       u.location,
       u.available_for_questions,
       exists (select 1 from alumni_saves s where s.user_id = $${viewerParamIdx} and s.alumni_id = u.id) as "isSaved"
     from users u
     where ${whereSql}
     order by (u.id = $${viewerParamIdx}) desc, u.available_for_questions desc, u.rating desc, u.id asc
     limit $${limitParamIdx} offset $${offsetParamIdx}`,
    queryParams
  );

  const [batchRes, locRes] = await Promise.all([
    db.query(`select distinct batch from users where role = 'alumni' and not system and not suspended order by batch desc`),
    db.query(`select distinct location from users where role = 'alumni' and not system and not suspended and location is not null and location <> '' order by location asc`),
  ]);

  const batchOptions = batchRes.rows.map((r) => Number(r.batch)).filter(Number.isInteger);
  const locationOptions = locRes.rows.map((r) => String(r.location).trim()).filter(Boolean);

  const alumni = rowsRes.rows.map((r) => ({
    ...r,
    skills: Array.isArray(r.skills) ? r.skills : [],
    isSaved: Boolean(r.isSaved),
    saved: Boolean(r.isSaved),
    available_for_questions: Boolean(r.available_for_questions ?? true),
  })) as AlumniSummary[];

  return {
    alumni,
    total,
    hasMore: offset + alumni.length < total,
    batchOptions,
    locationOptions,
  };
}

export async function saveAlumni(
  a: Db | string,
  b: string | { alumniId: string },
  c?: { alumniId: string }
): Promise<{ saved: boolean }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  const alumniId = key(input.alumniId);
  return tx(async (conn) => {
    const has = (await conn.query(`select 1 from alumni_saves where user_id = $1 and alumni_id = $2`, [userId, alumniId])).rowCount! > 0;
    if (has) {
      await conn.query(`delete from alumni_saves where user_id = $1 and alumni_id = $2`, [userId, alumniId]);
      return { saved: false };
    } else {
      await conn.query(`insert into alumni_saves (user_id, alumni_id) values ($1, $2) on conflict do nothing`, [userId, alumniId]);
      return { saved: true };
    }
  });
}

export async function setAvailableForQuestions(
  a: Db | string,
  b: string | { value?: boolean; available?: boolean; alumniId?: string; userId?: string },
  c?: { value?: boolean; available?: boolean; alumniId?: string; userId?: string }
): Promise<{ success: boolean; value: boolean; available: boolean }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const rawTarget = input.userId ?? input.alumniId;
    const targetId = typeof rawTarget === "string" && KEY.test(rawTarget) ? rawTarget : userId;
    need(targetId === userId || isAdmin(u.role), "Only the account owner or an admin can change mentoring availability.");
    const val = input.available !== undefined ? Boolean(input.available) : Boolean(input.value);
    await conn.query(`update users set available_for_questions = $1 where id = $2 and not system`, [val, targetId]);
    return { success: true, value: val, available: val };
  });
}

/* ========================================================================== */
/*                                   JOBS                                     */
/* ========================================================================== */

export async function listAlumniJobs(
  db: Db,
  viewerId: string,
  input: {
    q?: string;
    type?: string;
    sort?: string;
    src?: string;
    source?: string;
  } = {}
): Promise<{ jobs: AlumniJob[]; total: number }> {
  const conditions: string[] = [
    `(j.source = 'manual' or j.fetched_at > now() - interval '30 days')`
  ];
  const params: unknown[] = [viewerId];
  let pIdx = 2;

  const src = input.src || input.source;
  if (src === "manual" || src === "fetched") {
    conditions.push(`j.source = $${pIdx}`);
    params.push(src);
    pIdx++;
  }

  if (input.type && typeof input.type === "string" && input.type.trim() && input.type !== "All job types") {
    conditions.push(`j.job_type ilike $${pIdx}`);
    params.push(input.type.trim());
    pIdx++;
  }

  if (input.q && typeof input.q === "string" && input.q.trim()) {
    const term = `%${input.q.trim()}%`;
    conditions.push(`(
      j.company ilike $${pIdx} or
      j.role ilike $${pIdx} or
      coalesce(j.title, '') ilike $${pIdx} or
      coalesce(j.location, '') ilike $${pIdx} or
      coalesce(j.job_type, '') ilike $${pIdx}
    )`);
    params.push(term);
    pIdx++;
  }

  const whereSql = conditions.join(" and ");

  let orderSql = `case when j.deadline is not null and j.deadline < current_date then 1 else 0 end asc, `;
  if (input.sort === "vac") {
    orderSql += `j.vacancies desc, coalesce(j.posted_at, j.created_at) desc`;
  } else if (input.sort === "new") {
    orderSql += `coalesce(j.posted_at, j.created_at) desc, j.id desc`;
  } else {
    // Default = "soon"
    orderSql += `case when j.deadline is not null then j.deadline else '9999-12-31'::date end asc, j.id desc`;
  }

  const rows = (
    await db.query(
      `select j.id, j.alumni_id, j.company, j.role, coalesce(j.title, j.role) as title,
         j.vacancies, j.location, j.job_type, j.experience, j.salary, j.description,
         j.responsibilities, j.requirements,
         to_char(j.deadline, 'YYYY-MM-DD') as deadline,
         j.company_logo_url, j.url, j.source, j.fetched_at,
         coalesce(j.posted_at, j.created_at) as posted_at,
         j.created_at,
         (j.alumni_id = $1) as mine
       from alumni_jobs j
       where ${whereSql}
       order by ${orderSql}`,
      params
    )
  ).rows;

  const jobs = rows.map((r) => ({
    ...r,
    responsibilities: Array.isArray(r.responsibilities) ? r.responsibilities : [],
    requirements: Array.isArray(r.requirements) ? r.requirements : [],
    vacancies: Number(r.vacancies || 1),
    mine: Boolean(r.mine),
  })) as AlumniJob[];

  return {
    jobs,
    total: jobs.length,
  };
}

export async function createAlumniJob(
  a: Db | string,
  b: string | {
    company: string;
    company_logo_url?: string | null;
    title?: string;
    role?: string;
    vacancies?: number;
    location?: string | null;
    job_type?: string | null;
    experience?: string | null;
    salary?: string | null;
    description?: string | null;
    responsibilities?: string[];
    requirements?: string[];
    deadline?: string | null;
    url: string;
  },
  c?: {
    company: string;
    company_logo_url?: string | null;
    title?: string;
    role?: string;
    vacancies?: number;
    location?: string | null;
    job_type?: string | null;
    experience?: string | null;
    salary?: string | null;
    description?: string | null;
    responsibilities?: string[];
    requirements?: string[];
    deadline?: string | null;
    url: string;
  }
): Promise<{ success: boolean; jobId: number; id: number; company: string; role: string; title: string; vacancies: number; mine: boolean }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role, name, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    need(canFully(actor.role, "alumni.job.post"), "Only alumni or admins can post alumni jobs.");

    const company = text(input.company, 1, 100, "Company");
    const roleTitle = text(input.title ?? input.role, 1, 120, "Role");
    const url = optionalUrl(input.url, "Job URL");
    if (!url) throw new Fail(400, "Job URL is required.");
    const location = input.location ? text(input.location, 1, 100, "Location") : null;
    const vacancies = Math.max(1, Math.min(999, posInt(input.vacancies ?? 1, "vacancies")));
    const jobType = input.job_type ? String(input.job_type) : "Full-time";
    const experience = input.experience ? text(input.experience, 1, 100, "Experience") : null;
    const salary = input.salary ? text(input.salary, 1, 100, "Salary") : null;
    const description = input.description ? String(input.description).trim() : null;
    const responsibilities = Array.isArray(input.responsibilities) ? input.responsibilities.map(String).map((s) => s.trim()).filter(Boolean) : [];
    const requirements = Array.isArray(input.requirements) ? input.requirements.map(String).map((s) => s.trim()).filter(Boolean) : [];
    const deadline = input.deadline ? String(input.deadline).slice(0, 10) : null;
    const companyLogoUrl = typeof input.company_logo_url === "string" && input.company_logo_url.trim() ? input.company_logo_url.trim() : null;

    const ins = await conn.query(
      `insert into alumni_jobs (
         alumni_id, company, role, title, location, url, source,
         vacancies, job_type, experience, salary, description, responsibilities, requirements, deadline, company_logo_url, posted_at
       ) values ($1, $2, $3, $3, $4, $5, 'manual', $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, coalesce($13::date, current_date + interval '30 days'), $14, now())
       returning id`,
      [
        userId, company, roleTitle, location, url,
        vacancies, jobType, experience, salary, description,
        JSON.stringify(responsibilities), JSON.stringify(requirements),
        deadline, companyLogoUrl
      ]
    );
    await audit(conn, actor, `posted alumni job: ${company} — ${roleTitle}`);
    const jobId = Number(ins.rows[0].id);
    return { success: true, jobId, id: jobId, company, role: roleTitle, title: roleTitle, vacancies, mine: true };
  });
}

export async function deleteAlumniJob(
  a: Db | string,
  b: string | { jobId: number | string },
  c?: { jobId: number | string }
): Promise<{ success: boolean; deleted: boolean }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role, name, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    const jobId = posInt(input.jobId, "job");
    const row = (await conn.query(`select id, alumni_id, company, role from alumni_jobs where id = $1`, [jobId])).rows[0];
    if (!row) throw new Fail(404, "That job listing does not exist.");
    need(row.alumni_id === userId || isAdmin(actor.role), "Only the author or an admin can delete this job.");
    await conn.query(`delete from alumni_jobs where id = $1`, [jobId]);
    await audit(conn, actor, `deleted alumni job #${jobId} (${row.company} — ${row.role})`);
    return { success: true, deleted: true };
  });
}

/* ========================================================================== */
/*                             INTERVIEW PREP                                 */
/* ========================================================================== */

export async function listInterviewTopics(
  db: Db,
  viewerId: string
): Promise<{ topics: InterviewTopic[] }> {
  const rows = (
    await db.query(
      `select t.id, t.name, t.description, t.created_by, t.order_index, t.created_at,
         (select count(*)::int from interview_problems p where p.topic_id = t.id) as "totalCount",
         (select count(*)::int from interview_user_progress up
          join interview_problems p on p.id = up.problem_id
          where p.topic_id = t.id and up.user_id = $1) as "solvedCount",
         coalesce((select array_agg(p.title order by p.id)
           from interview_problems p where p.topic_id = t.id), '{}') as "problemTitles"
       from interview_topics t
       order by t.order_index asc, t.name asc`,
      [viewerId]
    )
  ).rows;

  const topics = rows.map((r) => ({
    ...r,
    totalCount: Number(r.totalCount || 0),
    solvedCount: Number(r.solvedCount || 0),
    problemTitles: Array.isArray(r.problemTitles) ? r.problemTitles : [],
  })) as InterviewTopic[];

  return { topics };
}

export async function getInterviewTopicDetail(
  db: Db,
  viewerId: string,
  input: { topicId: number | string }
): Promise<{ topic: InterviewTopic; problems: InterviewProblem[]; tips: InterviewTip[] }> {
  const topicId = posInt(input.topicId, "topic");
  const topicRow = (
    await db.query(
      `select t.id, t.name, t.description, t.created_by, t.order_index, t.created_at,
         (select count(*)::int from interview_problems p where p.topic_id = t.id) as "totalCount",
         (select count(*)::int from interview_user_progress up
          join interview_problems p on p.id = up.problem_id
          where p.topic_id = t.id and up.user_id = $1) as "solvedCount"
       from interview_topics t
       where t.id = $2`,
      [viewerId, topicId]
    )
  ).rows[0];
  if (!topicRow) throw new Fail(404, "That topic does not exist.");

  const [problemsRes, tipsRes] = await Promise.all([
    db.query(
      `select p.id, p.topic_id, p.title, p.url, p.difficulty, p.meta, p.created_by, p.created_at,
         exists (select 1 from interview_user_progress up where up.problem_id = p.id and up.user_id = $1) as solved
       from interview_problems p
       where p.topic_id = $2
       order by p.id asc`,
      [viewerId, topicId]
    ),
    db.query(
      `select tip.id, tip.author_id, tip.topic_id, tip.title, tip.body_md, tip.created_at, tip.updated_at,
         u.name as author_name,
         coalesce(nullif(u.cf_handle, ''), u.handle) as author_handle,
         u.avatar_url as author_avatar,
         coalesce(u.cf_rating, u.rating) as author_rating
       from interview_tips tip
       join users u on u.id = tip.author_id
       where tip.topic_id = $1
       order by tip.created_at desc`,
      [topicId]
    ),
  ]);

  const topic: InterviewTopic = {
    ...topicRow,
    totalCount: Number(topicRow.totalCount || 0),
    solvedCount: Number(topicRow.solvedCount || 0),
  };

  const problems = problemsRes.rows.map((p) => ({
    ...p,
    solved: Boolean(p.solved),
  })) as InterviewProblem[];

  const tips = tipsRes.rows as InterviewTip[];

  return { topic, problems, tips };
}

function parseActorAndInput<T>(a: Db | string, b: string | T, c?: T): { actorId: string; input: T } {
  if (typeof a === "string") {
    return { actorId: a, input: b as T };
  }
  return { actorId: b as string, input: c as T };
}

export async function toggleInterviewProblem(
  a: Db | string,
  b: string | { problemId: number | string },
  c?: { problemId: number | string }
): Promise<{ problemId: number; solved: boolean }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  const problemId = posInt(input.problemId, "problem");
  return tx(async (conn) => {
    const u = (await conn.query(`select id, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    need(!u.system, "Operator accounts cannot track progress.");
    const has = (await conn.query(`select 1 from interview_user_progress where user_id = $1 and problem_id = $2`, [userId, problemId])).rowCount! > 0;
    if (has) {
      await conn.query(`delete from interview_user_progress where user_id = $1 and problem_id = $2`, [userId, problemId]);
      return { problemId, solved: false };
    } else {
      await conn.query(`insert into interview_user_progress (user_id, problem_id) values ($1, $2) on conflict do nothing`, [userId, problemId]);
      return { problemId, solved: true };
    }
  });
}

export async function createInterviewTopic(
  a: Db | string,
  b: string | { name: string; description?: string },
  c?: { name: string; description?: string }
): Promise<{ success: boolean; topicId: number }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role, name, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    need(canFully(actor.role, "interview.topic.create"), "Only alumni or admins can create interview topics.");

    const name = text(input.name, 2, 80, "Topic name");
    const desc = input.description ? text(input.description, 1, 300, "Description") : null;
    const maxOrder = (await conn.query(`select coalesce(max(order_index), 0) as max_ord from interview_topics`)).rows[0]?.max_ord ?? 0;
    const ins = await conn.query(
      `insert into interview_topics (name, description, created_by, order_index) values ($1, $2, $3, $4) returning id`,
      [name, desc, userId, maxOrder + 1]
    );
    await audit(conn, actor, `created interview topic: ${name}`);
    return { success: true, topicId: Number(ins.rows[0].id) };
  });
}

export async function createInterviewProblem(
  a: Db | string,
  b: string | { topicId?: number | string; topic_id?: number | string; title: string; url: string; difficulty: string },
  c?: { topicId?: number | string; topic_id?: number | string; title: string; url: string; difficulty: string }
): Promise<{ success: boolean; problemId: number }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role, name, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    need(canFully(actor.role, "interview.problem.create"), "Only alumni or admins can add interview problems.");

    const rawTopicId = input.topicId ?? input.topic_id;
    const topicId = posInt(rawTopicId, "topic");
    const title = text(input.title, 2, 120, "Title");
    const url = optionalUrl(input.url, "Problem URL");
    if (!url) throw new Fail(400, "Problem URL is required.");
    const diff = pick(input.difficulty, ["easy", "medium", "hard"] as const, "difficulty");
    const topic = (await conn.query(`select id from interview_topics where id = $1`, [topicId])).rows[0];
    if (!topic) throw new Fail(404, "That topic does not exist.");

    const ins = await conn.query(
      `insert into interview_problems (topic_id, title, url, difficulty, created_by) values ($1, $2, $3, $4, $5) returning id`,
      [topicId, title, url, diff, userId]
    );
    await audit(conn, actor, `added problem to topic #${topicId}: ${title}`);
    return { success: true, problemId: Number(ins.rows[0].id) };
  });
}

export async function deleteInterviewProblem(
  a: Db | string,
  b: string | { problemId: number | string },
  c?: { problemId: number | string }
): Promise<{ success: boolean; deleted: boolean }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role, name, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    const problemId = posInt(input.problemId, "problem");
    const p = (await conn.query(`select id, created_by, title from interview_problems where id = $1`, [problemId])).rows[0];
    if (!p) throw new Fail(404, "That problem does not exist.");
    need(p.created_by === userId || isAdmin(actor.role), "Only the creator or an admin can delete this problem.");
    await conn.query(`delete from interview_problems where id = $1`, [problemId]);
    await audit(conn, actor, `deleted interview problem #${problemId}: ${p.title}`);
    return { success: true, deleted: true };
  });
}

export async function createInterviewTip(
  a: Db | string,
  b: string | { topicId?: number | string | null; topic_id?: number | string | null; title: string; body_md: string },
  c?: { topicId?: number | string | null; topic_id?: number | string | null; title: string; body_md: string }
): Promise<{ success: boolean; tipId: number; id: number; author_id: string; author_name: string; title: string; body_md: string }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role, name, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    need(canFully(actor.role, "interview.tip.create"), "Only alumni or admins can create interview tips.");

    const rawTopicId = input.topicId ?? input.topic_id;
    const topicId = rawTopicId ? posInt(rawTopicId, "topic") : null;
    if (topicId) {
      const topic = (await conn.query(`select id from interview_topics where id = $1`, [topicId])).rows[0];
      if (!topic) throw new Fail(404, "That topic does not exist.");
    }
    const title = text(input.title, 2, 140, "Title");
    const bodyMd = mdText(input.body_md, 1, 20_000, "Body");

    const ins = await conn.query(
      `insert into interview_tips (author_id, topic_id, title, body_md) values ($1, $2, $3, $4) returning id`,
      [userId, topicId, title, bodyMd]
    );
    await audit(conn, actor, `posted interview tip: ${title}`);
    const tipId = Number(ins.rows[0].id);
    return { success: true, tipId, id: tipId, author_id: userId, author_name: u.name, title, body_md: bodyMd };
  });
}

export async function deleteInterviewTip(
  a: Db | string,
  b: string | { tipId: number | string },
  c?: { tipId: number | string }
): Promise<{ success: boolean; deleted: boolean }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role, name, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    const tipId = posInt(input.tipId, "tip");
    const tip = (await conn.query(`select id, author_id, title from interview_tips where id = $1`, [tipId])).rows[0];
    if (!tip) throw new Fail(404, "That tip does not exist.");
    need(tip.author_id === userId || isAdmin(actor.role), "Only the author or an admin can delete this tip.");
    await conn.query(`delete from interview_tips where id = $1`, [tipId]);
    await audit(conn, actor, `deleted interview tip #${tipId}: ${tip.title}`);
    return { success: true, deleted: true };
  });
}

export async function listInterviewExperiences(
  db: Db
): Promise<{ experiences: InterviewTip[] }> {
  const rows = (
    await db.query(
      `select tip.id, tip.author_id, tip.topic_id, tip.title, tip.body_md, tip.created_at, tip.updated_at,
         u.name as author_name,
         coalesce(nullif(u.cf_handle, ''), u.handle) as author_handle,
         u.avatar_url as author_avatar,
         coalesce(u.cf_rating, u.rating) as author_rating
       from interview_tips tip
       join users u on u.id = tip.author_id
       where tip.topic_id is null
       order by tip.created_at desc`
    )
  ).rows;
  return { experiences: rows as InterviewTip[] };
}

/* ========================================================================== */
/*                                   BLOGS                                    */
/* ========================================================================== */

export async function listBlogPosts(
  db: Db,
  viewerId: string = "",
  input: {
    q?: string;
    tag?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ posts: BlogPost[]; total: number; tags: string[] }> {
  const page = Math.max(0, Math.floor(Number(input.page) || 0));
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(input.pageSize) || 12)));
  const offset = page * pageSize;

  const viewerRow = viewerId ? (await db.query(`select role from users where id = $1`, [viewerId])).rows[0] : null;
  const admin = viewerRow && isAdmin(viewerRow.role);

  const conditions: string[] = [];
  const params: unknown[] = [viewerId || null];
  let pIdx = 2;

  if (!admin) {
    conditions.push(`(b.status = 'published' or (b.author_id = $1 and $1 is not null))`);
  }

  if (input.tag && typeof input.tag === "string" && input.tag.trim() && input.tag.toLowerCase() !== "all") {
    conditions.push(`b.tags @> $${pIdx}::jsonb`);
    params.push(JSON.stringify([input.tag.trim().toLowerCase()]));
    pIdx++;
  }

  if (input.q && typeof input.q === "string" && input.q.trim()) {
    const term = `%${input.q.trim()}%`;
    conditions.push(`(
      b.title ilike $${pIdx} or
      coalesce(b.subtitle, '') ilike $${pIdx} or
      coalesce(b.excerpt, '') ilike $${pIdx} or
      b.body_md ilike $${pIdx} or
      u.name ilike $${pIdx} or
      b.tags::text ilike $${pIdx}
    )`);
    params.push(term);
    pIdx++;
  }

  const whereSql = conditions.length ? conditions.join(" and ") : "1=1";
  const sortSql = input.sort === "oldest"
    ? `coalesce(b.published_at, b.created_at) asc, b.id asc`
    : `coalesce(b.published_at, b.created_at) desc, b.id desc`;

  const countRow = (
    await db.query(`select count(*)::int as total from blog_posts b join users u on u.id = b.author_id where ${whereSql}`, params)
  ).rows[0];
  const total = Number(countRow?.total ?? 0);

  const queryParams = [...params, pageSize, offset];
  const rows = (
    await db.query(
      `select b.id, b.author_id, b.slug, b.title, b.subtitle, b.excerpt, b.body_md,
         b.cover_url, b.tags, b.status, b.published_at, b.views, b.created_at, b.updated_at,
         u.name as author_name,
         coalesce(nullif(u.cf_handle, ''), u.handle) as author_handle,
         u.avatar_url as author_avatar,
         coalesce(u.cf_rating, u.rating) as author_rating,
         u.title as author_role
       from blog_posts b
       join users u on u.id = b.author_id
       where ${whereSql}
       order by ${sortSql}
       limit $${pIdx++} offset $${pIdx++}`,
      queryParams
    )
  ).rows;

  const tagRows = (
    await db.query(
      `select distinct jsonb_array_elements_text(tags) as tag
       from blog_posts
       where status = 'published'
       order by 1 asc`
    )
  ).rows;
  const tags = tagRows.map((r) => String(r.tag)).filter(Boolean);

  const posts = rows.map((r) => {
    const wordCount = (r.body_md || "").split(/\s+/).filter(Boolean).length;
    const read_time_min = Math.max(1, Math.round(wordCount / 200));
    return {
      ...r,
      tags: Array.isArray(r.tags) ? r.tags : [],
      read_time_min,
    };
  }) as BlogPost[];

  return { posts, total, tags };
}

export async function getBlogPost(
  db: Db,
  viewerIdOrInput: string | { slug?: string; id?: number | string },
  maybeInput?: { slug?: string; id?: number | string } | string
): Promise<BlogPost> {
  let viewerId = "";
  let slug: string | undefined;
  let id: number | string | undefined;

  if (typeof viewerIdOrInput === "object" && viewerIdOrInput !== null) {
    slug = viewerIdOrInput.slug;
    id = viewerIdOrInput.id;
  } else if (typeof viewerIdOrInput === "string") {
    if (typeof maybeInput === "string") {
      viewerId = viewerIdOrInput;
      slug = maybeInput;
    } else if (typeof maybeInput === "object" && maybeInput !== null) {
      viewerId = viewerIdOrInput;
      slug = maybeInput.slug;
      id = maybeInput.id;
    } else {
      slug = viewerIdOrInput;
    }
  }

  let row;
  if (slug) {
    row = (
      await db.query(
        `select b.id, b.author_id, b.slug, b.title, b.subtitle, b.excerpt, b.body_md,
           b.cover_url, b.tags, b.status, b.published_at, b.views, b.created_at, b.updated_at,
           u.name as author_name,
           coalesce(nullif(u.cf_handle, ''), u.handle) as author_handle,
           u.avatar_url as author_avatar,
           coalesce(u.cf_rating, u.rating) as author_rating,
           u.title as author_role
         from blog_posts b
         join users u on u.id = b.author_id
         where b.slug = $1`,
        [slug]
      )
    ).rows[0];
  } else if (id) {
    const postId = posInt(id, "post");
    row = (
      await db.query(
        `select b.id, b.author_id, b.slug, b.title, b.subtitle, b.excerpt, b.body_md,
           b.cover_url, b.tags, b.status, b.published_at, b.views, b.created_at, b.updated_at,
           u.name as author_name,
           coalesce(nullif(u.cf_handle, ''), u.handle) as author_handle,
           u.avatar_url as author_avatar,
           coalesce(u.cf_rating, u.rating) as author_rating,
           u.title as author_role
         from blog_posts b
         join users u on u.id = b.author_id
         where b.id = $1`,
        [postId]
      )
    ).rows[0];
  }
  if (!row) throw new Fail(404, "That blog post does not exist.");

  if (viewerId) {
    const viewerRow = (await db.query(`select role from users where id = $1`, [viewerId])).rows[0];
    const admin = viewerRow && isAdmin(viewerRow.role);
    if (row.status !== "published" && row.author_id !== viewerId && !admin) {
      throw new Fail(403, "This draft post is private.");
    }
  } else if (row.status !== "published") {
    throw new Fail(403, "This draft post is private.");
  }

  // Fire-and-forget view count increment
  db.query(`update blog_posts set views = views + 1 where id = $1`, [row.id]).catch(() => {});

  const wordCount = (row.body_md || "").split(/\s+/).filter(Boolean).length;
  const read_time_min = Math.max(1, Math.round(wordCount / 200));

  return {
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : [],
    read_time_min,
  } as BlogPost;
}

export async function createBlogPost(
  a: Db | string,
  b: string | {
    title: string;
    subtitle?: string | null;
    excerpt?: string | null;
    body_md: string;
    cover_url?: string | null;
    tags?: string[];
    slug?: string | null;
    status?: "draft" | "published";
  },
  c?: {
    title: string;
    subtitle?: string | null;
    excerpt?: string | null;
    body_md: string;
    cover_url?: string | null;
    tags?: string[];
    slug?: string | null;
    status?: "draft" | "published";
  }
): Promise<{ success: boolean; id: number; slug: string; author_id: string }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role, name, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    need(canFully(actor.role, "blog.post.create"), "Only alumni or admins can write blog posts.");

    const title = text(input.title, 2, 120, "Title");
    const subtitle = input.subtitle ? text(input.subtitle, 1, 200, "Subtitle") : null;
    const bodyMd = mdText(input.body_md, 1, 50_000, "Story");
    const excerpt = input.excerpt ? text(input.excerpt, 1, 280, "Excerpt") : excerptFromMarkdown(bodyMd, 140);
    const coverUrl = typeof input.cover_url === "string" && input.cover_url.trim() ? input.cover_url.trim() : null;
    const tags = Array.isArray(input.tags) ? input.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [];
    const status = pick(input.status ?? "draft", ["draft", "published"] as const, "status");
    let slug = input.slug ? text(input.slug, 2, 100, "Slug").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") : "";
    if (!slug) {
      slug = title.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    }
    const exists = (await conn.query(`select 1 from blog_posts where slug = $1`, [slug])).rowCount! > 0;
    if (exists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    const publishedAt = status === "published" ? new Date() : null;

    const ins = await conn.query(
      `insert into blog_posts (author_id, slug, title, subtitle, excerpt, body_md, cover_url, tags, status, published_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10) returning id, slug`,
      [userId, slug, title, subtitle, excerpt, bodyMd, coverUrl, JSON.stringify(tags), status, publishedAt]
    );
    await audit(conn, actor, `created blog post: ${title} (${status})`);
    return { success: true, id: Number(ins.rows[0].id), slug: String(ins.rows[0].slug), author_id: userId };
  });
}

export async function updateBlogPost(
  a: Db | string,
  b: string | {
    id: number | string;
    title?: string;
    subtitle?: string | null;
    excerpt?: string | null;
    body_md?: string;
    cover_url?: string | null;
    tags?: string[];
    slug?: string;
    status?: "draft" | "published";
  },
  c?: {
    id: number | string;
    title?: string;
    subtitle?: string | null;
    excerpt?: string | null;
    body_md?: string;
    cover_url?: string | null;
    tags?: string[];
    slug?: string;
    status?: "draft" | "published";
  }
): Promise<{ success: boolean; title?: string }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role, name, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    const id = posInt(input.id, "post");
    const post = (await conn.query(`select id, author_id, title, status, published_at from blog_posts where id = $1`, [id])).rows[0];
    if (!post) throw new Fail(404, "That post does not exist.");
    need(post.author_id === userId || isAdmin(actor.role), "Only the author or an admin can edit this post.");

    const title = input.title ? text(input.title, 2, 120, "Title") : post.title;
    const subtitle = input.subtitle !== undefined ? (input.subtitle ? text(input.subtitle, 1, 200, "Subtitle") : null) : null;
    const bodyMd = input.body_md ? mdText(input.body_md, 1, 50_000, "Story") : null;
    const excerpt = input.excerpt !== undefined ? (input.excerpt ? text(input.excerpt, 1, 280, "Excerpt") : null) : (bodyMd ? excerptFromMarkdown(bodyMd, 140) : null);
    const coverUrl = input.cover_url !== undefined ? (typeof input.cover_url === "string" && input.cover_url.trim() ? input.cover_url.trim() : null) : undefined;
    const tags = Array.isArray(input.tags) ? input.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : undefined;
    const status = input.status ? pick(input.status, ["draft", "published"] as const, "status") : undefined;
    let publishedAt = post.published_at;
    if (status === "published" && !publishedAt) {
      publishedAt = new Date();
    }

    await conn.query(
      `update blog_posts set
         title = coalesce($2, title),
         subtitle = case when $3::int is null then subtitle else $4 end,
         excerpt = case when $5::int is null then excerpt else $6 end,
         body_md = coalesce($7, body_md),
         cover_url = case when $8::int is null then cover_url else $9 end,
         tags = case when $10::int is null then tags else $11::jsonb end,
         status = coalesce($12, status),
         published_at = coalesce($13, published_at),
         updated_at = now()
       where id = $1`,
      [
        id,
        input.title ? title : null,
        input.subtitle !== undefined ? 1 : null,
        subtitle,
        input.excerpt !== undefined || bodyMd ? 1 : null,
        excerpt,
        bodyMd,
        coverUrl !== undefined ? 1 : null,
        coverUrl,
        tags !== undefined ? 1 : null,
        tags ? JSON.stringify(tags) : null,
        status ?? null,
        publishedAt ?? null,
      ]
    );

    await audit(conn, actor, `updated blog post #${id}: ${title}`);
    return { success: true, title };
  });
}

export async function deleteBlogPost(
  a: Db | string,
  b: string | { id: number | string },
  c?: { id: number | string }
): Promise<{ success: boolean; deleted: boolean }> {
  const { actorId: userId, input } = parseActorAndInput(a, b, c);
  return tx(async (conn) => {
    const u = (await conn.query(`select id, role, name, system from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const actor: Actor = { id: u.id, role: u.role, name: u.name, system: u.system };
    person(actor);
    const id = posInt(input.id, "post");
    const post = (await conn.query(`select id, author_id, title from blog_posts where id = $1`, [id])).rows[0];
    if (!post) throw new Fail(404, "That post does not exist.");
    need(post.author_id === userId || isAdmin(actor.role), "Only the author or an admin can delete this post.");

    await conn.query(`delete from blog_posts where id = $1`, [id]);
    await audit(conn, actor, `deleted blog post #${id}: ${post.title}`);
    return { success: true, deleted: true };
  });
}
