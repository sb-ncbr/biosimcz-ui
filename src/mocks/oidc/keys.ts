import { exportJWK, generateKeyPair, SignJWT, type JWK, type CryptoKey } from "jose";

type Keys = { privateKey: CryptoKey; jwk: JWK };

const KID = "mock-idp-1";

let cached: Promise<Keys> | undefined;

// One RS256 key per process, generated on first use (nothing secret is stored anywhere).
const getKeys = (): Promise<Keys> =>
  (cached ??= generateKeyPair("RS256").then(async ({ privateKey, publicKey }) => ({
    privateKey,
    jwk: { ...(await exportJWK(publicKey)), kid: KID, alg: "RS256", use: "sig" },
  })));

const signIdToken = async (claims: Record<string, unknown>, options: { issuer: string; audience: string; ttlS: number; nonce?: string | undefined }): Promise<string> => {
  const { privateKey } = await getKeys();
  return new SignJWT(options.nonce ? { ...claims, nonce: options.nonce } : claims)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setIssuedAt()
    .setExpirationTime(`${options.ttlS}s`)
    .sign(privateKey);
};

export { getKeys, signIdToken };
