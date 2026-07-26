import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE = "shark_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no está configurado");
  }
  return new TextEncoder().encode(secret);
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const username = payload.username;

    if (typeof username !== "string") {
      return null;
    }

    return { username };
  } catch {
    return null;
  }
}

export function getSessionMaxAgeSeconds(): number {
  return SESSION_DURATION_SECONDS;
}

export function getAdminCredentials(): { username: string; password: string } {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("ADMIN_USERNAME y ADMIN_PASSWORD deben estar configurados");
  }

  return { username, password };
}
