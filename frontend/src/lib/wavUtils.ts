/**
 * Port of legacy/wav_utils.js — builds 32-bit float WAV files from PCM data.
 */

const BITS_PER_SAMPLE = 32;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const NUM_CHANNELS = 1;
const AUDIO_FORMAT_IEEE_FLOAT = 3;
const HEADER_SIZE = 44;
const SUBCHUNK1_SIZE = 16;

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function buildWavFile(pcmArray: Float32Array, sampleRate: number): Blob {
  const BLOCK_ALIGN = NUM_CHANNELS * BYTES_PER_SAMPLE;
  const BYTE_RATE = sampleRate * BLOCK_ALIGN;

  const dataSize = pcmArray.length * BYTES_PER_SAMPLE;
  const fileSize = HEADER_SIZE + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, SUBCHUNK1_SIZE, true);
  view.setUint16(20, AUDIO_FORMAT_IEEE_FLOAT, true);
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, BYTE_RATE, true);
  view.setUint16(32, BLOCK_ALIGN, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  const pcmView = new Float32Array(buffer, HEADER_SIZE, pcmArray.length);
  pcmView.set(pcmArray);

  return new Blob([buffer], { type: "audio/wav" });
}

export function mergeFloat32Arrays(arrays: Float32Array[]): Float32Array {
  let length = 0;
  for (const a of arrays) length += a.length;

  const result = new Float32Array(length);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}