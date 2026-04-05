/**
 * Characters used for invite code generation.
 * Excludes visually ambiguous characters (0/O, 1/I/L) to reduce
 * transcription errors for elderly users.
 */
const INVITE_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const INVITE_CODE_LENGTH = 6

export function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(
    bytes,
    (b) => INVITE_CODE_CHARS[b % INVITE_CODE_CHARS.length],
  ).join("")
}
