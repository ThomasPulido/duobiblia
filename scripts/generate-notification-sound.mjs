import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sampleRate = 44100;
const duration = 2.25;
const sampleCount = Math.floor(sampleRate * duration);
const samples = new Float64Array(sampleCount);
let seed = 0x51f15e;

function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 0x100000000 * 2 - 1;
}

function pluck(frequency, startSeconds, amplitude, decay = .994) {
  const start = Math.floor(startSeconds * sampleRate);
  const delay = Math.max(2, Math.round(sampleRate / frequency));
  const ring = Float64Array.from({ length: delay }, () => random());
  let index = 0;
  for (let output = start; output < sampleCount; output += 1) {
    const age = (output - start) / sampleRate;
    const value = ring[index];
    const next = (ring[index] + ring[(index + 1) % delay]) * .5 * decay;
    ring[index] = next;
    index = (index + 1) % delay;
    const envelope = Math.min(1, age / .012) * Math.exp(-age * 1.85);
    samples[output] += value * amplitude * envelope;
  }
}

pluck(523.25, 0, .36);
pluck(659.25, .22, .28);
pluck(783.99, .46, .25);
pluck(1046.5, .72, .18, .993);

const fadeStart = Math.floor(sampleRate * 1.55);
let peak = 0;
for (let index = 0; index < sampleCount; index += 1) {
  if (index >= fadeStart) samples[index] *= 1 - (index - fadeStart) / (sampleCount - fadeStart);
  peak = Math.max(peak, Math.abs(samples[index]));
}
const gain = peak ? .78 / peak : 1;
const dataSize = sampleCount * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(dataSize, 40);
for (let index = 0; index < sampleCount; index += 1) {
  const value = Math.max(-1, Math.min(1, samples[index] * gain));
  wav.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
}

const destinations = [
  resolve(root, "android/app/src/main/res/raw/duobiblia_guitar_calm.wav"),
  resolve(root, "ios/App/App/duobiblia_guitar_calm.wav")
];
for (const destination of destinations) {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, wav);
}
console.log(`Generated ${destinations.length} calm guitar notification sounds (${wav.length} bytes each).`);
