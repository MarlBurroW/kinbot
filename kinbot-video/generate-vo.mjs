#!/usr/bin/env bun
/**
 * Generate the KinBot video voiceover with ElevenLabs, using your cloned voice.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=xxxxx bun kinbot-video/generate-vo.mjs
 * Optional:
 *   ELEVENLABS_VOICE_ID=<id>   # skip auto-detect and use this exact voice
 *   ELEVENLABS_MODEL=eleven_multilingual_v2   # default
 *
 * Without ELEVENLABS_VOICE_ID it lists your voices and picks the first cloned one.
 * Output: kinbot-video/audio/scene-01..06.mp3 and full.mp3
 */
import { mkdir } from 'node:fs/promises';

const API = 'https://api.elevenlabs.io/v1';
const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const OUT = new URL('./audio/', import.meta.url);

if (!KEY) {
  console.error('Missing ELEVENLABS_API_KEY. Run: ELEVENLABS_API_KEY=... bun kinbot-video/generate-vo.mjs');
  process.exit(1);
}

const voiceSettings = {
  stability: 0.45,
  similarity_boost: 0.8,
  style: 0.0,
  use_speaker_boost: true,
};

// Target voice by NAME (the user's cloned voice is "marlburrow"). Override with
// ELEVENLABS_VOICE_NAME, or skip lookup entirely with ELEVENLABS_VOICE_ID.
const WANT_NAME = (process.env.ELEVENLABS_VOICE_NAME || 'marlburrow').toLowerCase();

async function pickVoiceId() {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  const res = await fetch(`${API}/voices`, { headers: { 'xi-api-key': KEY } });
  if (!res.ok) throw new Error(`voices list failed: ${res.status} ${await res.text()}`);
  const { voices = [] } = await res.json();
  console.log('Available voices:');
  for (const v of voices) console.log(`  ${v.voice_id}  ${v.name} (${v.category})`);
  // 1) exact name match, 2) name contains, 3) error (no silent fallback to the wrong voice)
  const byName =
    voices.find((v) => v.name?.toLowerCase() === WANT_NAME) ||
    voices.find((v) => v.name?.toLowerCase().includes(WANT_NAME));
  if (!byName) {
    throw new Error(`No voice named "${WANT_NAME}" found. Pick one above and set ELEVENLABS_VOICE_ID or ELEVENLABS_VOICE_NAME.`);
  }
  console.log(`→ Using voice: ${byName.name} (${byName.voice_id})`);
  return byName.voice_id;
}

async function tts(voiceId, text, outName) {
  const res = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: voiceSettings }),
  });
  if (!res.ok) throw new Error(`tts failed (${outName}): ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await Bun.write(new URL(outName, OUT), buf);
  console.log(`  wrote ${outName} (${(buf.length / 1024).toFixed(0)} KB)`);
}

const script = await Bun.file(new URL('./script.json', import.meta.url)).json();
await mkdir(OUT, { recursive: true });
const voiceId = await pickVoiceId();

console.log('Generating per-scene clips...');
for (const line of script.lines) await tts(voiceId, line.vo, `${line.id}.mp3`);

console.log('Generating full narration...');
const full = script.lines.map((l) => l.vo).join('\n\n');
await tts(voiceId, full, 'full.mp3');

console.log('Done. Files in kinbot-video/audio/');
