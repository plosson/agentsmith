import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { config } from "./config";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

let googleJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getGoogleJWKS() {
  if (!googleJWKS) {
    googleJWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  }
  return googleJWKS;
}

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function verifyGoogleToken(credential: string): Promise<GoogleTokenPayload> {
  const { payload } = await jwtVerify(credential, getGoogleJWKS(), {
    issuer: GOOGLE_ISSUERS,
    audience: config.google.clientId,
  });

  if (!payload.sub || !payload.email) {
    throw new Error("Google token missing sub or email");
  }

  return {
    sub: payload.sub as string,
    email: payload.email as string,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
  };
}

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret);
}

export async function signSessionToken(sub: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer("agentsmith")
    .setExpirationTime(`${config.jwtExpirySeconds}s`)
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<{ sub: string; email: string }> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: "agentsmith",
  });

  if (!payload.sub || !payload.email) {
    throw new Error("Session token missing sub or email");
  }

  return {
    sub: payload.sub,
    email: payload.email as string,
  };
}
