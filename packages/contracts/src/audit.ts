// The audit log's sections. The API tags every entry with one (see `areaOf` and the `audit_area` SQL
// fallback in the schema); the admin panel groups and filters by them.
export const AUDIT_AREAS = [
  'Recruitment',
  'Members & roles',
  'Finance',
  'Events',
  'Community',
  'Workspace',
  'Training',
  'Alumni',
  'Email',
  'Security & settings',
  'Other',
] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];
export type AuditEntry = { id: string; at: string; who: string; what: string; area: AuditArea };
export type AuditPage = {
  rows: AuditEntry[];
  /** Entries per section, for the whole log. */
  counts: Partial<Record<AuditArea, number>>;
  /** Pass the last row's id as `before` for the next page. */
  more: boolean;
};
