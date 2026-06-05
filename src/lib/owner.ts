/**
 * The owner (DM) is identified by NEXT_PUBLIC_OWNER_EMAIL. Only the owner gets
 * edit access; every other signed-in account (party members) sees the player
 * view. This is the UI/routing boundary — the database enforces the same rule
 * via RLS (see supabase/migrations/0004_owner_only_writes.sql).
 *
 * If NEXT_PUBLIC_OWNER_EMAIL is unset, any signed-in user is treated as the
 * owner (single-account fallback). Set it once you open public sign-ups.
 */
export function isOwner(user: { email?: string | null } | null): boolean {
  if (!user) return false;
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL?.toLowerCase();
  if (!ownerEmail) return true;
  return (user.email?.toLowerCase() ?? "") === ownerEmail;
}
