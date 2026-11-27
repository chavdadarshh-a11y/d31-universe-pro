/** Who may open the hidden owner stats screen. Never shown in the nav. */
import { OWNER_EMAILS } from '../config/access'
import { isLive } from './env'
import type { AccountUser } from '../store/app'

export function isOwner(user: AccountUser | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase()
  if (!email || !OWNER_EMAILS.includes(email)) return false
  // Live builds: only a real cloud sign-in. Demo builds: a local account with the same
  // email is enough so the screen can be checked without Supabase keys.
  if (isLive) return user?.provider === 'supabase'
  return true
}
