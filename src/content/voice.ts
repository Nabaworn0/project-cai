// The lesson voice made by tools/voice.py (src/assets/voice): its index of lines and the URL of each recording.
// Globs rather than imports, so the game still builds before any voice has been made.

import type { VoiceIndex } from '../core/lesson';

const index = import.meta.glob<VoiceIndex>('../assets/voice/index.json', { eager: true, import: 'default' });
const mp3 = import.meta.glob<string>('../assets/voice/*.mp3', { eager: true, query: '?url', import: 'default' });

export const VOICE: VoiceIndex | null = Object.values(index)[0] ?? null;

/** Recording file name -> URL in the built game. */
const urls = new Map(Object.entries(mp3).map(([path, url]) => [path.split('/').pop()!, url]));
export const voiceUrl = (file: string) => urls.get(file) ?? null;
export const voiceFiles = () => [...urls.keys()];
