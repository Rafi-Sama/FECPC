export const roles = [
  'member',
  'alumni',
  'mentor',
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
  mentor: 'Mentor',
  cp_head: 'CP Head',
  treasurer: 'Treasurer',
  secretary: 'Secretary',
  president: 'President',
  super_admin: 'Super Admin',
};

/** Sits on the committee: everyone except plain members, alumni and mentors. */
export const isCommittee = (r: Role): boolean => r !== 'member' && r !== 'alumni' && r !== 'mentor';

/** Account lifecycle. `invited` accounts have no password yet; `suspended` ones cannot sign in. */
export const USER_STATUSES = ['active', 'invited', 'suspended', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
