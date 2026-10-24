// The customer's computer as the game sees it. Flat on purpose: content files patch
// fields by name ("diskStyle": "mbr"), and the validator checks those names against this shape.

export type BootMode = 'uefi' | 'legacy';
export type DiskStyle = 'mbr' | 'gpt';
export type TpmVersion = 'none' | '1.2' | '2.0';
export type SataMode = 'ahci' | 'raid';
/** What the install USB was made from (Rufus Boot selection). */
export type UsbOs = 'win11' | 'win10' | 'ubuntu';
export interface Machine {
  brand: string;
  bootMode: BootMode;
  secureBoot: boolean;
  supervisorPassword: boolean;
  tpm: TpmVersion;
  tpmEnabled: boolean;
  sataMode: SataMode;
  raidDriverLoaded: boolean;
  /** USB installer boots first, via boot order or the one-time boot menu. */
  usbFirst: boolean;
  /** Partition scheme the install USB was made with in Rufus (textbook p.47). */
  usbScheme: DiskStyle;
  /** The image on the USB: only Windows 11 is right (the wrong image is a case 2 trap). */
  usbOs: UsbOs;
  /** Rufus removed the Windows 11 checks (TPM, Secure Boot, RAM): it installs, but Microsoft does not support it. */
  usbBypassChecks: boolean;
  cpu: string;
  cpuWin11: boolean;
  ramGB: number;
  storageGB: number;
  diskStyle: DiskStyle;
  /** The disk holds the customer's old Windows and files. */
  diskHasData: boolean;
  /** The customer brought a product key (textbook p.54). */
  productKey: boolean;
  /** Setup was told "I don't have a product key"; Windows is activated later. */
  activateLater: boolean;
  missingDrivers: string[];
}

export type MachinePatch = Partial<Omit<Machine, 'brand'>>;

/** A machine with nothing wrong: Windows 11 installs on it straight away. */
export function healthyMachine(brand: string): Machine {
  return {
    brand,
    bootMode: 'uefi',
    secureBoot: true,
    supervisorPassword: false,
    tpm: '2.0',
    tpmEnabled: true,
    sataMode: 'ahci',
    raidDriverLoaded: false,
    usbFirst: true,
    usbScheme: 'gpt',
    usbOs: 'win11',
    usbBypassChecks: false,
    cpu: 'Generic 8th-gen 4-core',
    cpuWin11: true,
    ramGB: 8,
    storageGB: 256,
    diskStyle: 'gpt',
    diskHasData: false,
    productKey: true,
    activateLater: false,
    missingDrivers: [],
  };
}

export function applyPatch(m: Machine, patch: MachinePatch): Machine {
  return { ...m, ...patch, missingDrivers: patch.missingDrivers ? [...patch.missingDrivers] : [...m.missingDrivers] };
}

/** True when every field named in `cond` has that value on `m`. */
export function matches(m: Machine, cond: MachinePatch): boolean {
  return (Object.keys(cond) as (keyof MachinePatch)[]).every((k) => JSON.stringify(m[k]) === JSON.stringify(cond[k]));
}

export function machineKey(m: Machine): string {
  return JSON.stringify(m);
}
