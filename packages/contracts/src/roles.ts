export const roles = [
  'member',
  'alumni',
  'cp_head',
  'treasurer',
  'secretary',
  'president',
  'super_admin',
] as const;

export type Role = (typeof roles)[number];

export const roleName: Record<Role, string> = {
  member: 'Member',
  alumni: 'Alumni',
  cp_head: 'CP Head',
  treasurer: 'Treasurer',
  secretary: 'Secretary',
  president: 'President',
  super_admin: 'Super Admin',
};

/** One role, or a member's effective roles: their own role plus whatever their post grants. */
export type Who = Role | readonly Role[];
export const asRoles = (w: Who): readonly Role[] => (typeof w === 'string' ? [w] : w);

/** Sits on the committee: anyone holding a role other than plain member or alumni. */
export const isCommittee = (w: Who): boolean =>
  asRoles(w).some((r) => r !== 'member' && r !== 'alumni');

/**
 * Club posts. They are aliases, not roles: each one grants a set of the roles above, chosen by the Super Admin
 * (`post_roles`). The President assigns posts; the Super Admin assigns the President.
 */
export const posts = [
  'vice_president',
  'general_secretary',
  'joint_secretary',
  'organizing_secretary',
  'joint_organizing_secretary',
  'office_secretary',
  'joint_office_secretary',
  'treasurer',
  'joint_treasurer',
  'press_secretary',
  'joint_press_secretary',
  'contest_secretary',
  'joint_contest_secretary',
  'executive_member',
  'member',
] as const;
export type Post = (typeof posts)[number];

export const postName: Record<Post, string> = {
  vice_president: 'Vice President',
  general_secretary: 'General Secretary',
  joint_secretary: 'Joint Secretary',
  organizing_secretary: 'Organizing Secretary',
  joint_organizing_secretary: 'Joint Organizing Secretary',
  office_secretary: 'Office Secretary',
  joint_office_secretary: 'Joint Office Secretary',
  treasurer: 'Treasurer',
  joint_treasurer: 'Joint Treasurer',
  press_secretary: 'Press & Publicity Affairs Secretary',
  joint_press_secretary: 'Joint Press & Publicity Affairs Secretary',
  contest_secretary: 'Contest & Seminar Affairs Secretary',
  joint_contest_secretary: 'Joint Contest & Seminar Affairs Secretary',
  executive_member: 'Executive Member',
  member: 'Member',
};

/** Roles a post may grant. Never President or Super Admin, so assigning a post can never outrank the assigner. */
export const postableRoles = roles.filter((r) => r !== 'president' && r !== 'super_admin');

/** Account lifecycle. `invited` accounts have no password yet; `suspended` ones cannot sign in. */
export const USER_STATUSES = ['active', 'invited', 'suspended', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
