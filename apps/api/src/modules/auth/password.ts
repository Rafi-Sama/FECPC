import { scrypt, timingSafeEqual, randomBytes, type ScryptOptions } from 'node:crypto';

const scryptAsync = (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

export interface ScryptParams {
  n: number;
  r: number;
  p: number;
}

export const DEFAULT_SCRYPT_PARAMS: ScryptParams = {
  n: 16384,
  r: 8,
  p: 1,
};

export class PasswordHasher {
  static async hash(
    password: string,
    params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
  ): Promise<string> {
    const salt = randomBytes(16);
    const maxmem = Math.ceil(128 * params.n * params.r * 1.5);
    const derivedKey = (await scryptAsync(password.normalize('NFKC'), salt, 32, {
      N: params.n,
      r: params.r,
      p: params.p,
      maxmem,
    })) as Buffer;

    return `scrypt$${params.n}$${params.r}$${params.p}$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
  }

  static async verify(
    password: string,
    storedHash: string,
  ): Promise<{ valid: boolean; needsRehash: boolean }> {
    // If legacy hash format (e.g. "salt:hash" or standard scrypt)
    let n = DEFAULT_SCRYPT_PARAMS.n;
    let r = DEFAULT_SCRYPT_PARAMS.r;
    let p = DEFAULT_SCRYPT_PARAMS.p;
    let saltBuf: Buffer;
    let expectedKeyBuf: Buffer;

    let isModern = false;

    if (storedHash.startsWith('scrypt$')) {
      const parts = storedHash.split('$');
      if (parts.length === 6) {
        n = parseInt(parts[1]!, 10);
        r = parseInt(parts[2]!, 10);
        p = parseInt(parts[3]!, 10);
        saltBuf = Buffer.from(parts[4]!, 'base64url');
        expectedKeyBuf = Buffer.from(parts[5]!, 'base64url');
        isModern =
          n === DEFAULT_SCRYPT_PARAMS.n &&
          r === DEFAULT_SCRYPT_PARAMS.r &&
          p === DEFAULT_SCRYPT_PARAMS.p &&
          expectedKeyBuf.length === 32;
      } else if (parts.length === 3) {
        // Legacy 3-part scrypt format: scrypt$salt$derivedKey (N=16384, r=8, p=1, keylen=64)
        n = 16384;
        r = 8;
        p = 1;
        saltBuf = Buffer.from(parts[1]!, 'base64url');
        expectedKeyBuf = Buffer.from(parts[2]!, 'base64url');
        isModern = false;
      } else {
        return { valid: false, needsRehash: false };
      }
    } else if (storedHash.includes(':')) {
      // Legacy format "saltHex:hashHex"
      const [saltHex, hashHex] = storedHash.split(':');
      saltBuf = Buffer.from(saltHex!, 'hex');
      expectedKeyBuf = Buffer.from(hashHex!, 'hex');
      isModern = false;
    } else {
      return { valid: false, needsRehash: false };
    }

    // A truncated or empty stored hash must never compare equal (two empty buffers would).
    if (expectedKeyBuf.length < 16 || saltBuf.length < 8)
      return { valid: false, needsRehash: false };

    const maxmem = Math.ceil(128 * n * r * 1.5);
    const keyLen = expectedKeyBuf.length;

    try {
      const actualKey = (await scryptAsync(password.normalize('NFKC'), saltBuf, keyLen, {
        N: n,
        r: r,
        p: p,
        maxmem,
      })) as Buffer;

      const valid =
        actualKey.length === expectedKeyBuf.length && timingSafeEqual(actualKey, expectedKeyBuf);

      const needsRehash = !isModern;

      return { valid, needsRehash };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  /**
   * Dummy verification to maintain constant-time behavior when account does not exist.
   */
  static async dummyVerify(): Promise<void> {
    const dummySalt = Buffer.alloc(16);
    const dummyKey = Buffer.alloc(32);
    const maxmem = Math.ceil(128 * DEFAULT_SCRYPT_PARAMS.n * DEFAULT_SCRYPT_PARAMS.r * 1.5);
    try {
      const actual = (await scryptAsync('dummy-password-string', dummySalt, 32, {
        N: DEFAULT_SCRYPT_PARAMS.n,
        r: DEFAULT_SCRYPT_PARAMS.r,
        p: DEFAULT_SCRYPT_PARAMS.p,
        maxmem,
      })) as Buffer;
      timingSafeEqual(actual, dummyKey);
    } catch {
      // ignore
    }
  }
}
