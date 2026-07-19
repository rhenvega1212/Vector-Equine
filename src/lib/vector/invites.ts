const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijklmnopqrstuvwxyz";

/** Generate an 8-character alphanumeric invite code (excludes ambiguous 0/O/1/I). */
export function generateInviteCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHANUM[bytes[i]! % ALPHANUM.length];
  }
  return code;
}
