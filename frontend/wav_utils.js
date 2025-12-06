// WAV format constants
const BITS_PER_SAMPLE = 32; // float32
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;  // 4
const NUM_CHANNELS = 1; // mono
const AUDIO_FORMAT_IEEE_FLOAT = 3; // PCM float format code
const HEADER_SIZE = 44; // Standard WAV header
const SUBCHUNK1_SIZE = 16; // PCM fmt chunk size
const FMT_CHUNK_ID = "fmt ";
const DATA_CHUNK_ID = "data";
const RIFF_CHUNK_ID = "RIFF";
const WAVE_ID = "WAVE";
const WAV_MIME_FORMAT = "audio/wav";

// Build WAV file for download (32-bit float WAV)
export function buildWavFile(pcm_array, sampleRate) {
  const BLOCK_ALIGN = NUM_CHANNELS * BYTES_PER_SAMPLE;
  const BYTE_RATE = sampleRate * BLOCK_ALIGN;

  const dataSize = pcm_array.length * BYTES_PER_SAMPLE;
  const fileSize = HEADER_SIZE + dataSize;

  // Allocate WAV buffer
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // Moving from 0 to 40 in steps of 4
  // RIFF header
  writeString(view, 0, RIFF_CHUNK_ID);
  view.setUint32(4, fileSize - 8, true); // ChunkSize
  writeString(view, 8, WAVE_ID);

  // fmt chunk
  writeString(view, 12, FMT_CHUNK_ID);
  view.setUint32(16, SUBCHUNK1_SIZE, true);
  view.setUint16(20, AUDIO_FORMAT_IEEE_FLOAT, true);
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, BYTE_RATE, true);
  view.setUint16(32, BLOCK_ALIGN, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  // data chunk
  writeString(view, 36, DATA_CHUNK_ID);
  view.setUint32(40, dataSize, true);

  // Write PCM samples (float32)
  let offset = HEADER_SIZE;
  for (let i = 0; i < pcm_array.length; i++) {
    view.setFloat32(offset, pcm_array[i], true);
    offset += BYTES_PER_SAMPLE;
  }

  return new Blob([buffer], { type: WAV_MIME_FORMAT });
}


function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Merge Float32 chunks arrays into 1 array
export function mergeFloat32Arrays(arrays) {
  let length = 0;
  for (let a of arrays) length += a.length;
  
  let result = new Float32Array(length);
  let offset = 0;
  for (let a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}