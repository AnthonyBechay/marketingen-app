// Tiny helper used to gate admin-only features (e.g. the bechai.ai seed
// button). The list is intentionally hardcoded — this is a personal
// instance, not a SaaS with admin roles.
const ADMIN_EMAILS = new Set([
  "anthonybechay1@gmail.com",
]);

export function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}
