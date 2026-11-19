// The default permission matrix from the spec, section 2. One source of truth:
// the admin screen renders this table and every screen asks can() before showing an action.
// shortcut: enforced in the interface only while there is no backend; the same table must gate every server action.
export const roles = ["member", "alumni", "mentor", "cp_head", "treasurer", "secretary", "president", "super_admin"] as const;
export type Role = (typeof roles)[number];
export const roleName: Record<Role, string> = { member: "Member", alumni: "Alumni", mentor: "Mentor", cp_head: "CP Head", treasurer: "Treasurer", secretary: "Secretary", president: "President", super_admin: "Super Admin" };

type Cell = true | "scope" | "view" | "propose";
const Y = true;
export const matrix = {
  "profile.own":         { label: "Edit own profile, see own dues",  member: Y, alumni: Y, mentor: Y, cp_head: Y, treasurer: Y, secretary: Y, president: Y, super_admin: Y },
  "profile.editOwn":     { label: "Edit own public profile",         member: Y, alumni: Y, mentor: Y, cp_head: Y, treasurer: Y, secretary: Y, president: Y, super_admin: Y },
  "directory.view":      { label: "View member directory",           member: Y, alumni: Y, mentor: Y, cp_head: Y, treasurer: Y, secretary: Y, president: Y, super_admin: Y },
  "mentees.view":        { label: "View mentees' progress",          mentor: "scope", cp_head: Y, president: Y, super_admin: Y },
  "sheet.edit":          { label: "See sheet completion statistics",  cp_head: Y, president: Y, super_admin: Y },
  "payments.verify":     { label: "Verify member payments",          treasurer: Y, president: "view", super_admin: Y },
  "expense.approve":     { label: "Approve expenses",                treasurer: "propose", president: Y, super_admin: Y },
  "dues.waive":          { label: "Waive dues or fines",             treasurer: "propose", president: Y, super_admin: Y },
  "event.publish":       { label: "Run events: code, registrants, scoreboard",  secretary: Y, president: Y, super_admin: Y },
  "announce.post":       { label: "Post announcements",              mentor: "scope", cp_head: Y, treasurer: Y, secretary: Y, president: Y, super_admin: Y },
  "feed.post":           { label: "Create community feed posts",     member: Y, alumni: Y, mentor: Y, cp_head: Y, treasurer: Y, secretary: Y, president: Y, super_admin: Y },
  "idea.create":         { label: "Submit community ideas",          member: Y, alumni: Y, mentor: Y, cp_head: Y, treasurer: Y, secretary: Y, president: Y, super_admin: Y },
  "idea.manage":         { label: "Manage community ideas",          member: "scope", alumni: "scope", mentor: "scope", cp_head: "scope", treasurer: "scope", secretary: "scope", president: Y, super_admin: Y },
  "alumni.job.post":     { label: "Post alumni job listings",        alumni: Y, president: Y, super_admin: Y },
  "application.approve": { label: "Approve applications",            secretary: Y, president: Y, super_admin: Y },
  "roles.assign":        { label: "Assign roles",                    president: Y, super_admin: Y },
  "member.promote":      { label: "Promote member to mentor",        president: Y, super_admin: Y },
  "member.makeAlumni":   { label: "Transition member to alumni",     president: Y, super_admin: Y },
  "member.deactivate":   { label: "Deactivate member account",       president: Y, super_admin: Y },
  "audit.view":          { label: "View audit log",                  president: Y, super_admin: Y },
  "data.export":         { label: "Export the member list",           treasurer: Y, secretary: Y, president: Y, super_admin: Y },
} satisfies Record<string, { label: string } & Partial<Record<Role, Cell>>>;
export type Cap = keyof typeof matrix;

/** The matrix cell: true, a limited grant ("scope" | "view" | "propose"), or false. */
export const can = (role: Role, cap: Cap): Cell | false => (matrix[cap] as Partial<Record<Role, Cell>>)[role] ?? false;
/** Full, unrestricted grant only. Use for destructive or money-moving actions. */
export const canFully = (role: Role, cap: Cap) => can(role, cap) === true;
/** Sits on the committee: everyone except plain members, alumni and mentors. */
export const isCommittee = (r: Role) => r !== "member" && r !== "alumni" && r !== "mentor";
/** May open the admin panel: holds at least one account, audit or export capability. */
export const isAdmin = (r: Role) => !!(can(r, "application.approve") || can(r, "roles.assign") || can(r, "audit.view") || can(r, "data.export"));
