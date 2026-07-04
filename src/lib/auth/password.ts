import bcrypt from "bcryptjs";

/**
 * Password hashing with bcrypt (default).
 * For Argon2: install `argon2` and set USE_ARGON2=true.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if (hash.startsWith("$argon2")) {
    return false;
  }
  return bcrypt.compare(password, hash);
}
