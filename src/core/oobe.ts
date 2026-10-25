// Windows 11's first-time setup after the install (the "out-of-box experience", 24H2), up to the desktop
// (case 5, docs/case5-plan.md section 3). Pure data in, data out like setup.ts: the screen renders
// `oobeView` and sends actions; the case flow listens to the returned effects.
// The heart is the account page: the technician hands the PC to the customer, who signs in and makes a
// PIN themself. Typing it for them, or asking for their password, is a mistake (objective 10, decided 25 Oct 2026).
// Wording follows the real pages (⚠️ = not yet checked word for word against a real screen, docs/real-screens.md).

import type { Edition } from './setup';

export const OOBE_PAGES = [
  'region',
  'keyboard',
  'second-keyboard',
  'network',
  'updates',
  'name',
  'setup-type',
  'account',
  'pin',
  'privacy',
  'customize',
  'phone',
  'onedrive',
  'finishing',
  'desktop',
] as const;
export type OobePage = (typeof OOBE_PAGES)[number];

/** A few lines of the real country list around the one the player needs. */
export const REGIONS = ['Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'United States'] as const;
export type Region = (typeof REGIONS)[number];

/** The real Thai layouts (Thai Kedmanee is the usual one) and the US layout Windows starts with. */
export const LAYOUTS = ['US', 'Thai Kedmanee', 'Thai Pattachote'] as const;
export type Layout = (typeof LAYOUTS)[number];

/** "Choose privacy settings for your device": every switch starts on Yes, as on the real page. */
export const PRIVACY = ['location', 'find-device', 'diagnostic', 'inking', 'tailored', 'ads'] as const;
export type PrivacyId = (typeof PRIVACY)[number];
export const PRIVACY_LABELS: Record<PrivacyId, string> = {
  location: 'Location',
  'find-device': 'Find my device',
  diagnostic: 'Diagnostic data',
  inking: 'Inking & typing',
  tailored: 'Tailored experiences',
  ads: 'Advertising ID',
};

/** Pages that ask nothing and move on by themselves; the customer's typing on the account and PIN pages. */
export const UPDATES_MS = 2000;
export const FINISHING_MS = 3000;
export const CUSTOMER_MS = 2500;

export type OobeMistake =
  /** The technician typed the customer's Microsoft account for them. */
  | 'typed-for-customer'
  /** The technician asked for the customer's password. */
  | 'asked-password';

export interface Oobe {
  page: OobePage;
  /** The edition just installed: Pro asks "personal or work or school". */
  edition: Edition;
  region: Region;
  layout: Layout;
  /** Second keyboard page: the layout list is open after "Add layout". */
  choosingLayout: boolean;
  secondLayout: Layout | null;
  /** The network cable is plugged in (the lab PC has no Wi-Fi card). */
  cable: boolean;
  /** What is typed in "Name your device" (null = skipped, Windows makes up a name). */
  deviceName: string;
  nameSkipped: boolean;
  setupType: 'personal' | 'work' | null;
  /** Who holds the PC: the customer signs in and makes the PIN, then hands it back. */
  holder: 'tech' | 'customer';
  /** How long the customer has been typing on the current page. */
  customerMs: number;
  privacy: Record<PrivacyId, boolean>;
  privacyAsked: boolean;
  /** Offers taken (OneDrive backup, phone link, the customize choices) instead of skipped. */
  extras: ('customize' | 'phone' | 'onedrive')[];
  /** Each account mistake counts once per visit. */
  blamed: OobeMistake[];
  waitedMs: number;
}

export type OobeAction =
  | { type: 'pick-region'; region: Region }
  | { type: 'pick-layout'; layout: Layout }
  | { type: 'yes' }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'skip' }
  | { type: 'accept' }
  | { type: 'add-layout' }
  | { type: 'plug-cable' }
  | { type: 'name'; value: string }
  | { type: 'pick-setup-type'; setupType: 'personal' | 'work' }
  /** Account page: give the PC to the customer to sign in themself (the right way). */
  | { type: 'hand-over' }
  | { type: 'type-for-customer' }
  | { type: 'ask-password' }
  | { type: 'toggle'; id: PrivacyId }
  /** Privacy page: ask the customer which settings they want. */
  | { type: 'ask-privacy' }
  | { type: 'tick'; ms: number };

export interface OobeResult {
  region: Region;
  /** A Thai layout was added (as the first or the second keyboard). */
  thaiKeyboard: boolean;
  deviceName: string | null;
  setupType: 'personal' | 'work' | null;
  privacyAsked: boolean;
  privacy: Record<PrivacyId, boolean>;
  extras: ('customize' | 'phone' | 'onedrive')[];
}

export type OobeEffect =
  | { type: 'mistake'; reason: OobeMistake }
  /** The PC went to the customer (account page) / came back after the PIN. */
  | { type: 'handed-over' }
  | { type: 'handed-back' }
  | { type: 'privacy-asked' }
  /** First-time setup is over: the Windows 11 desktop. */
  | { type: 'desktop'; result: OobeResult };

export function openOobe(edition: Edition): Oobe {
  return {
    page: 'region',
    edition,
    // The installer was English (United States), so that is what the first page offers.
    region: 'United States',
    layout: 'US',
    choosingLayout: false,
    secondLayout: null,
    cable: false,
    deviceName: '',
    nameSkipped: false,
    setupType: null,
    holder: 'tech',
    customerMs: 0,
    privacy: Object.fromEntries(PRIVACY.map((id) => [id, true])) as Record<PrivacyId, boolean>,
    privacyAsked: false,
    extras: [],
    blamed: [],
    waitedMs: 0,
  };
}

/** The three rules printed under the name field, in the real page's words and order. */
export const NAME_RULES = {
  numbers: "Can't contain only numbers",
  length: 'No more than 15 characters',
  chars: 'No spaces or special characters other than hyphen ( - ), dashes ( — and – ), and underscore ( _ )',
} as const;
export type NameRule = keyof typeof NAME_RULES;

/** The first rule a typed name breaks (the page shows the rules; Next stays grey until none is broken). */
export function nameError(name: string): NameRule | null {
  if (name === '') return null;
  if (/^[0-9]+$/.test(name)) return 'numbers';
  if (name.length > 15) return 'length';
  if (!/^[A-Za-z0-9_–—-]+$/.test(name)) return 'chars';
  return null;
}

const isPro = (o: Oobe) => o.edition.includes('Pro');
const isThai = (l: Layout | null) => !!l && l.startsWith('Thai');

function canNext(o: Oobe): boolean {
  switch (o.page) {
    case 'network':
      return o.cable;
    case 'name':
      return o.deviceName !== '' && !nameError(o.deviceName);
    case 'setup-type':
      return !!o.setupType;
    default:
      return false;
  }
}

function after(o: Oobe): OobePage {
  const i = OOBE_PAGES.indexOf(o.page);
  const next = OOBE_PAGES[i + 1]!;
  return next === 'setup-type' && !isPro(o) ? 'account' : next;
}

const BACK: Partial<Record<OobePage, OobePage>> = {
  keyboard: 'region',
  'second-keyboard': 'keyboard',
  network: 'second-keyboard',
};

const same = (o: Oobe) => ({ oobe: o, effects: [] as OobeEffect[] });
const go = (o: Oobe, effects: OobeEffect[] = []) => ({ oobe: { ...o, page: after(o), waitedMs: 0 }, effects });

function blame(o: Oobe, reason: OobeMistake) {
  if (o.blamed.includes(reason)) return same(o);
  return { oobe: { ...o, blamed: [...o.blamed, reason] }, effects: [{ type: 'mistake', reason }] as OobeEffect[] };
}

export function result(o: Oobe): OobeResult {
  return {
    region: o.region,
    thaiKeyboard: isThai(o.layout) || isThai(o.secondLayout),
    deviceName: o.nameSkipped ? null : o.deviceName,
    setupType: o.setupType,
    privacyAsked: o.privacyAsked,
    privacy: o.privacy,
    extras: o.extras,
  };
}

/** Waiting pages and the customer's typing run on the clock. */
function tick(o: Oobe, ms: number) {
  if (o.holder === 'customer') {
    const customerMs = o.customerMs + ms;
    if (customerMs < CUSTOMER_MS) return same({ ...o, customerMs });
    // Signed in: on to the PIN, still in the customer's hands. PIN made: the PC comes back.
    if (o.page === 'account') return same({ ...o, page: 'pin', customerMs: 0 });
    return go({ ...o, holder: 'tech', customerMs: 0 }, [{ type: 'handed-back' }]);
  }
  const wait = o.page === 'updates' ? UPDATES_MS : o.page === 'finishing' ? FINISHING_MS : 0;
  if (!wait) return same(o);
  const waitedMs = o.waitedMs + ms;
  if (waitedMs < wait) return same({ ...o, waitedMs });
  if (o.page === 'finishing')
    return { oobe: { ...o, page: 'desktop' as const, waitedMs: 0 }, effects: [{ type: 'desktop', result: result(o) }] as OobeEffect[] };
  return go(o);
}

const OFFERS: Partial<Record<OobePage, 'customize' | 'phone' | 'onedrive'>> = { customize: 'customize', phone: 'phone', onedrive: 'onedrive' };

export function act(o: Oobe, a: OobeAction): { oobe: Oobe; effects: OobeEffect[] } {
  if (a.type === 'tick') return tick(o, a.ms);
  // While the customer holds the PC, the technician's taps do nothing.
  if (o.holder === 'customer') return same(o);

  switch (a.type) {
    case 'pick-region':
      return same(o.page === 'region' ? { ...o, region: a.region } : o);
    case 'pick-layout':
      if (o.page === 'keyboard') return same({ ...o, layout: a.layout });
      if (o.page === 'second-keyboard' && o.choosingLayout) {
        // A layout that is the first one already is not added twice.
        return a.layout === o.layout ? same(o) : go({ ...o, secondLayout: a.layout, choosingLayout: false });
      }
      return same(o);
    case 'yes':
      return o.page === 'region' || o.page === 'keyboard' ? go(o) : same(o);
    case 'add-layout':
      return same(o.page === 'second-keyboard' ? { ...o, choosingLayout: true } : o);
    case 'plug-cable':
      return same(o.page === 'network' ? { ...o, cable: true } : o);
    case 'name':
      return same(o.page === 'name' ? { ...o, deviceName: a.value } : o);
    case 'pick-setup-type':
      return same(o.page === 'setup-type' ? { ...o, setupType: a.setupType } : o);
    case 'next':
      return canNext(o) ? go(o) : same(o);
    case 'back': {
      const to = BACK[o.page];
      return same(to ? { ...o, page: to, choosingLayout: false } : o);
    }
    case 'skip':
      if (o.page === 'second-keyboard') return go({ ...o, choosingLayout: false });
      if (o.page === 'name') return go({ ...o, deviceName: '', nameSkipped: true });
      return OFFERS[o.page] ? go(o) : same(o);
    case 'accept':
      if (o.page === 'privacy') return go(o);
      return OFFERS[o.page] ? go({ ...o, extras: [...o.extras, OFFERS[o.page]!] }) : same(o);
    case 'hand-over':
      return o.page === 'account' ? { oobe: { ...o, holder: 'customer', customerMs: 0 }, effects: [{ type: 'handed-over' }] } : same(o);
    case 'type-for-customer':
      return o.page === 'account' ? blame(o, 'typed-for-customer') : same(o);
    case 'ask-password':
      return o.page === 'account' ? blame(o, 'asked-password') : same(o);
    case 'toggle':
      return same(o.page === 'privacy' ? { ...o, privacy: { ...o.privacy, [a.id]: !o.privacy[a.id] } } : o);
    case 'ask-privacy':
      if (o.page !== 'privacy' || o.privacyAsked) return same(o);
      return { oobe: { ...o, privacyAsked: true }, effects: [{ type: 'privacy-asked' }] };
    default:
      return same(o);
  }
}

// ---- what the screen shows ----

const TITLES: Record<OobePage, string> = {
  region: 'Is this the right country or region?',
  keyboard: 'Is this the right keyboard layout or input method?',
  'second-keyboard': 'Want to add a second keyboard layout?',
  network: "Let's connect you to a network",
  updates: 'Checking for updates',
  name: "Let's name your device",
  'setup-type': 'How would you like to set up this device?',
  account: "Let's add your Microsoft account",
  pin: 'Set up a PIN',
  privacy: 'Choose privacy settings for your device',
  customize: "Let's customize your experience",
  phone: 'Use your Android phone from your PC',
  onedrive: 'Back up your files with OneDrive',
  finishing: 'This might take a few minutes',
  desktop: '',
};

export interface OobeView {
  page: OobePage;
  title: string;
  canNext: boolean;
  canBack: boolean;
  /** The customer has the PC: the screen shows them typing, the technician waits. */
  customerTyping: boolean;
  nameError: NameRule | null;
  /** 0–1 on the waiting pages and while the customer types. */
  progress: number;
}

export function oobeView(o: Oobe): OobeView {
  const wait = o.holder === 'customer' ? CUSTOMER_MS : o.page === 'updates' ? UPDATES_MS : o.page === 'finishing' ? FINISHING_MS : 0;
  const done = o.holder === 'customer' ? o.customerMs : o.waitedMs;
  return {
    page: o.page,
    title: TITLES[o.page],
    canNext: canNext(o),
    canBack: !!BACK[o.page] && o.holder === 'tech',
    customerTyping: o.holder === 'customer',
    nameError: o.page === 'name' ? nameError(o.deviceName) : null,
    progress: wait ? Math.min(1, done / wait) : 0,
  };
}
