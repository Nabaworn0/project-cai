// Frame for the realistic simulated screens (Windows Setup, BIOS, Device Manager).
// Phase 0 only proves the layer: crisp text over the game, a selectable table, Thai typing.
// No vendor logos anywhere; on-screen wording stays English like the real screen.

import { useLayoutEffect, useRef, useState } from 'preact/hooks';

interface Props {
  onClose: () => void;
}

const ROWS = [
  { name: 'Drive 0 Partition 1: System Reserved', total: '50.0 MB', free: '28.0 MB', type: 'System' },
  { name: 'Drive 0 Partition 2', total: '237.4 GB', free: '120.6 GB', type: 'Primary' },
];

export function SimScreen({ onClose }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  // Latest onClose without re-running the mount effect (which would steal focus) when the parent re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Layout effect, not useEffect: the dialog is visible as soon as it is painted, so Escape must work from then on.
  useLayoutEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="sim-backdrop" role="dialog" aria-modal="true" aria-label="หน้าจอจำลอง">
      <div class="monitor">
        <div class="monitor-bar">
          <span class="sim-tag">โหมดจำลอง · ไม่ได้ติดตั้งจริง</span>
          <button ref={closeRef} class="btn ghost small" type="button" onClick={onClose}>
            ปิด
          </button>
        </div>
        <div class="screen">
          <div class="win">
            <div class="win-title">Windows Setup</div>
            <div class="win-body">
              <h2>Where do you want to install Windows?</h2>
              <table class="parts">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Total size</th>
                    <th>Free space</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r, i) => (
                    <tr key={r.name} class={sel === i ? 'sel' : ''} onClick={() => setSel(i)} aria-selected={sel === i}>
                      <td>{r.name}</td>
                      <td>{r.total}</td>
                      <td>{r.free}</td>
                      <td>{r.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <label class="type-test">
                <span>ทดสอบพิมพ์ (ไทย/อังกฤษ)</span>
                <input value={typed} onInput={(e) => setTyped(e.currentTarget.value)} placeholder="พิมพ์ที่นี่…" autocomplete="off" />
              </label>
              <p class="echo" data-testid="echo">
                {typed}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
