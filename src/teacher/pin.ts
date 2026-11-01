// The teacher's page's PIN (docs/guide-pin-plan.md task G). The page keeps the teacher's sheet link and key on the
// device it is used on, so on a classroom computer a learner opening it could read the whole class; the PIN asks
// first. Only a slow hash of it is kept (src/teacher/pin.json, written by `npm run teacher-pin`), never the PIN.
// The site is static files, so this keeps learners out, not someone who takes the page's code apart: the results in
// the sheet stay behind the teacher's key, which Google checks.

/** pin.json: empty until a PIN is set. */
export interface PinRecord {
  salt?: string;
  iterations?: number;
  hash?: string;
}

export const PIN_MIN = 6;
export const ITERATIONS = 200_000;
/** Wrong tries in a row before a wait, and the wait. */
export const TRIES = 5;
export const WAIT_MS = 30_000;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** PBKDF2-SHA256 of the PIN, as hex; the same in the browser and in Node (WebCrypto in both). */
export async function hashPin(pin: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256);
  return hex(bits);
}

/** A record for this PIN with a fresh salt. */
export async function makeRecord(pin: string, iterations = ITERATIONS): Promise<Required<PinRecord>> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return { salt, iterations, hash: await hashPin(pin, salt, iterations) };
}

export const pinIsSet = (r: PinRecord): r is Required<PinRecord> => !!(r.salt && r.iterations && r.hash);

export async function pinMatches(pin: string, r: PinRecord): Promise<boolean> {
  if (!pinIsSet(r)) return false;
  return (await hashPin(pin, r.salt, r.iterations)) === r.hash;
}

/** A PIN that may be set: at least PIN_MIN letters or digits, no spaces; null if fine, else why not (Thai). */
export function pinProblem(pin: string): string | null {
  if (/\s/.test(pin)) return 'รหัสต้องไม่มีช่องว่าง';
  if ([...pin].length < PIN_MIN) return `รหัสต้องยาวอย่างน้อย ${PIN_MIN} ตัว`;
  return null;
}

/** Wrong tries so far in this tab, and until when the next try must wait. */
export interface Tries {
  fails: number;
  until: number;
}

/** After a wrong PIN: the fifth in a row starts a wait, and the count starts again. */
export function failed(t: Tries, now: number): Tries {
  const fails = t.fails + 1;
  return fails >= TRIES ? { fails: 0, until: now + WAIT_MS } : { fails, until: t.until };
}

/** Seconds left to wait before trying again (0: may try now). */
export const waitLeft = (t: Tries, now: number) => Math.max(0, Math.ceil((t.until - now) / 1000));
