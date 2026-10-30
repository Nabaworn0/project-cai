# npm run voice -- [files.json ...] [--voice th-TH-NiwatNeural] [--rate +0%] [--out src/assets/voice] [--prune]
#
# The senior technician's voice for the lesson cartoons (docs/lessons-plan.md task A): every line to be spoken is
# sent to Microsoft's Thai neural voice through edge-tts (pip install edge-tts; needs the internet while it runs)
# and saved as one mp3 per line, with the time of every word so his mouth can move with it.
#
# Lines are the "say" strings anywhere in the given JSON files (default src/content/data/lessons.json).
# <out>/index.json lists them: { voice, rate, lines: { "<say>": { file, ms, words: [[start, end], ...] } } }
# (times in ms). A line already in the index with the same voice and rate is kept, so changing one line only
# makes that line again; --prune removes the files of lines no longer said.

import argparse
import asyncio
import hashlib
import json
import re
import sys
from pathlib import Path

import edge_tts

TICKS_PER_MS = 10_000  # edge-tts times are in 100 ns units
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def says(node, found):
    """Every "say" string in a JSON tree, in order, once each."""
    if isinstance(node, dict):
        if isinstance(node.get('say'), str) and node['say'] not in found:
            found.append(node['say'])
        for v in node.values():
            says(v, found)
    elif isinstance(node, list):
        for v in node:
            says(v, found)
    return found


def file_name(voice, rate, text):
    """The same line in the same voice always gets the same file."""
    return hashlib.sha1(f'{voice}|{rate}|{text}'.encode('utf-8')).hexdigest()[:16] + '.mp3'


async def speak(text, voice, rate, path):
    c = edge_tts.Communicate(text, voice, rate=rate, boundary='WordBoundary')
    audio = bytearray()
    words = []
    async for chunk in c.stream():
        if chunk['type'] == 'audio':
            audio += chunk['data']
        elif chunk['type'] == 'WordBoundary':
            start = round(chunk['offset'] / TICKS_PER_MS)
            words.append([start, start + round(chunk['duration'] / TICKS_PER_MS)])
    if not audio or not words:
        raise RuntimeError(f'no audio or no word times for: {text}')
    path.write_bytes(audio)
    # MP3 at 48 kbit/s (edge-tts's format): 6 bytes per ms. The last word's end is earlier, so take the longer.
    return {'ms': max(words[-1][1], round(len(audio) / 6)), 'words': words}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='*', default=['src/content/data/lessons.json'])
    ap.add_argument('--voice', default='th-TH-NiwatNeural')
    ap.add_argument('--rate', default='+0%')
    ap.add_argument('--out', default='src/assets/voice')
    ap.add_argument('--prune', action='store_true')
    a = ap.parse_args()

    lines = []
    for f in a.files:
        says(json.loads(Path(f).read_text(encoding='utf-8')), lines)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    index_path = out / 'index.json'
    old = json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else {}
    same = old.get('voice') == a.voice and old.get('rate') == a.rate
    kept = old.get('lines', {}) if same else {}

    index = {'voice': a.voice, 'rate': a.rate, 'lines': {}}
    made = 0
    for text in lines:
        name = file_name(a.voice, a.rate, text)
        entry = kept.get(text)
        if not (entry and entry['file'] == name and (out / name).exists()):
            for attempt in range(3):
                try:
                    entry = {'file': name, **await speak(text, a.voice, a.rate, out / name)}
                    break
                except Exception as e:  # the online service drops a request now and then
                    if attempt == 2:
                        sys.exit(f'voice: failed after 3 tries: {text}\n  {e}')
            made += 1
        index['lines'][text] = entry

    text = json.dumps(index, ensure_ascii=False, indent=1)
    text = re.sub(r'\[\s+(\d+),\s+(\d+)\s+\]', r'[\1, \2]', text)  # a word's times on one line, not four
    index_path.write_text(text + '\n', encoding='utf-8', newline='\n')
    pruned = 0
    if a.prune:
        used = {e['file'] for e in index['lines'].values()}
        for mp3 in out.glob('*.mp3'):
            if mp3.name not in used:
                mp3.unlink()
                pruned += 1
    print(f'voice: {len(lines)} lines ({made} made, {len(lines) - made} kept'
          + (f', {pruned} old files removed' if a.prune else '') + f') in {out}')


asyncio.run(main())
