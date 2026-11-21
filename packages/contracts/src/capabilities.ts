import { asRoles, type Role, type Who } from './roles.ts';

export type Grant = 'none' | 'view' | 'scope' | 'propose' | 'full';
export type Cell = true | 'scope' | 'view' | 'propose';

const Y = true;

export const matrix = {
  'profile.own': {
    label: 'Edit own profile, see own dues',
    member: Y,
    alumni: Y,
    mentor: Y,
    cp_head: Y,
    treasurer: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'profile.editOwn': {
    label: 'Edit own public profile',
    member: Y,
    alumni: Y,
    mentor: Y,
    cp_head: Y,
    treasurer: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'directory.view': {
    label: 'View member directory',
    member: Y,
    alumni: Y,
    mentor: Y,
    cp_head: Y,
    treasurer: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'mentees.view': {
    label: "View mentees' progress",
    mentor: 'scope',
    cp_head: Y,
    president: Y,
    super_admin: Y,
  },
  'sheet.edit': {
    label: 'See sheet completion statistics',
    cp_head: Y,
    president: Y,
    super_admin: Y,
  },
  'payments.verify': {
    label: 'Verify member payments',
    treasurer: Y,
    president: 'view',
    super_admin: Y,
  },
  'expense.approve': {
    label: 'Approve expenses',
    treasurer: 'propose',
    president: Y,
    super_admin: Y,
  },
  'event.publish': {
    label: 'Run events: create, registrations, feedback, certificates',
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'contest.run': {
    label: 'Choose the contests on the contest-day scoreboard',
    cp_head: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'announce.post': {
    label: 'Post announcements',
    mentor: 'scope',
    cp_head: Y,
    treasurer: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'poll.create': {
    label: 'Create and close polls',
    cp_head: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'feed.post': {
    label: 'Create community feed posts',
    member: Y,
    alumni: Y,
    mentor: Y,
    cp_head: Y,
    treasurer: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'feed.moderate': {
    label: 'Review reported feed posts',
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'idea.create': {
    label: 'Submit community ideas',
    member: Y,
    alumni: Y,
    mentor: Y,
    cp_head: Y,
    treasurer: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'idea.manage': {
    label: 'Manage community ideas',
    member: 'scope',
    alumni: 'scope',
    mentor: 'scope',
    cp_head: 'scope',
    treasurer: 'scope',
    secretary: 'scope',
    president: Y,
    super_admin: Y,
  },
  'alumni.save': {
    label: 'Save alumni profile',
    member: Y,
    alumni: Y,
    mentor: Y,
    cp_head: Y,
    treasurer: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'alumni.toggleMentoring': {
    label: 'Toggle mentoring availability',
    alumni: 'scope',
    president: Y,
    super_admin: Y,
  },
  'alumni.job.post': {
    label: 'Post alumni job listings',
    alumni: Y,
    president: Y,
    super_admin: Y,
  },
  'alumni.job.fetch': {
    label: 'Fetch public job listings',
    president: Y,
    super_admin: Y,
  },
  'interview.roadmap.manage': {
    label: 'Create, edit and delete interview roadmaps',
    cp_head: Y,
    president: Y,
    super_admin: Y,
  },
  'interview.topic.create': {
    label: 'Create interview prep topic',
    cp_head: Y,
    president: Y,
    super_admin: Y,
  },
  'interview.problem.create': {
    label: 'Add problem to topic',
    cp_head: Y,
    president: Y,
    super_admin: Y,
  },
  'interview.tip.create': {
    label: 'Post interview tip',
    alumni: Y,
    president: Y,
    super_admin: Y,
  },
  'interview.progress.toggle': {
    label: 'Toggle problem solved',
    member: Y,
    alumni: Y,
    mentor: Y,
    cp_head: Y,
    treasurer: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'blog.post.create': {
    label: 'Write blog post',
    alumni: Y,
    president: Y,
    super_admin: Y,
  },
  'blog.post.delete': {
    label: 'Delete blog post',
    alumni: 'scope',
    president: Y,
    super_admin: Y,
  },
  'application.approve': {
    label: 'Approve applications',
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
  'roles.assign': {
    label: 'Assign roles',
    president: Y,
    super_admin: Y,
  },
  'member.promote': {
    label: 'Promote member to mentor',
    president: Y,
    super_admin: Y,
  },
  'member.makeAlumni': {
    label: 'Transition member to alumni',
    president: Y,
    super_admin: Y,
  },
  'member.deactivate': {
    label: 'Deactivate member account',
    president: Y,
    super_admin: Y,
  },
  'audit.view': {
    label: 'View audit log',
    president: Y,
    super_admin: Y,
  },
  'data.export': {
    label: 'Export the member list',
    treasurer: Y,
    secretary: Y,
    president: Y,
    super_admin: Y,
  },
} as const;

export type Capability = keyof typeof matrix;
export type Cap = Capability;

/**
 * The matrix cell: true, a limited grant ("scope" | "view" | "propose"), or false.
 * For several roles, the strongest grant any of them holds.
 */
export const can = (who: Who, cap: Capability): Cell | false => {
  let best: Cell | false = false;
  for (const r of asRoles(who)) {
    const c = (matrix[cap] as Partial<Record<Role, Cell>>)[r] ?? false;
    if (c === true) return true;
    best ||= c;
  }
  return best;
};

/**
 * Standardized Grant string: 'none' | 'view' | 'scope' | 'propose' | 'full'
 */
export const grantOf = (who: Who, cap: Capability): Grant => {
  const c = can(who, cap);
  if (c === true) return 'full';
  if (c === false) return 'none';
  return c;
};

/** Full, unrestricted grant only. Use for destructive or money-moving actions. */
export const canFully = (who: Who, cap: Capability): boolean => can(who, cap) === true;

/** May open the admin panel: holds at least one account, audit or export capability. */
export const isAdmin = (r: Who): boolean =>
  !!(
    can(r, 'application.approve') ||
    can(r, 'roles.assign') ||
    can(r, 'audit.view') ||
    can(r, 'data.export')
  );
