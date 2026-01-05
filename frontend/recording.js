// MediaRecorder-based audio recording script for capturing live PCM audio chunks,
// sending them to a server, AND allowing download of the full recording upon stopping.

import {
  connectToSocket,
  disconnectFromSocket,
  sendChunkToServer,
  sendAudioFileToServer,
  sendTempoToServer
} from "./socket.js";
import { buildWavFile, mergeFloat32Arrays } from "./wav_utils.js";

let audioContext = null;
let workletNode = null;
let pcmChunks = [];        // stores raw float32 PCM for final download
let useTempoCheckbox = null;
let tempoInput = null;
let tempoUnit = null;

const MAX_TEMPO_BPM = 300;
const MIN_TEMPO_BPM = 40;
const SAMPLE_RATE = 48000;
const REVOKE_TIMEOUT_MS = 6000;

const START_BUTTON_ID = "start-button";
const STOP_BUTTON_ID = "stop-button";
const USE_TEMPO_CHECKBOX_ID = "use-tempo-checkbox";
const TEMPO_INPUT_ID = "tempo-input";
const TEMPO_UNIT_ID = "tempo-unit";
const STATUS_TEXT_ID = "status-text";

async function setUpAudioWorklet(stream) {
  audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });

  // Load worklet file and create Node
  await audioContext.audioWorklet.addModule("./pcm_processor.js");
  workletNode = new AudioWorkletNode(audioContext, "pcm-processor");

  // Forward PCM audio from processor → socket & buffer for final file
  workletNode.port.onmessage = (event) => {
    const float32 = event.data; // Float32Array of PCM samples (frame size may vary)
    pcmChunks.push(float32);    // no need to copy
    sendChunkToServer(float32.buffer);
  };

  // Connect mic → worklet
  const micSource = audioContext.createMediaStreamSource(stream);
  micSource.connect(workletNode);
}

async function startRecording() {
  await connectToSocket();

  // Handle tempo input
  if (useTempoCheckbox && useTempoCheckbox.checked) {
    const raw = tempoInput.value;
    const bpm = parseFloat(raw);

    if (!Number.isFinite(bpm) || bpm < MIN_TEMPO_BPM || bpm > MAX_TEMPO_BPM) {
      document.getElementById(STATUS_TEXT_ID).innerText =
        "Invalid tempo value: Must be between 40 and 300 BPM.";
      return;
    }

    try {
      await sendTempoToServer(bpm);
      console.log("Sent desired tempo:", bpm);
    } catch (err) {
      console.warn("Failed to send tempo:", err);
    }
  }

  pcmChunks = []; // reset buffer
  document.getElementById(STATUS_TEXT_ID).innerText = "Recording...";
  document.getElementById(START_BUTTON_ID).disabled = true;
  document.getElementById(STOP_BUTTON_ID).disabled = false;

  audioContext.resume();
}

async function stopRecording() {
  // Disconnect worklet node before suspending the audio context to avoid leaks.
  if (workletNode) {
    workletNode.disconnect();
    // Optional: clear message handler to help GC.
    workletNode.port.onmessage = null;
  }
  audioContext.suspend();
  document.getElementById(STATUS_TEXT_ID).innerText = "Idle";

  // Merge Float32 PCM into one array
  const merged = mergeFloat32Arrays(pcmChunks);

  // Build WAV and download locally
  const wavBlob = buildWavFile(merged, audioContext.sampleRate);

  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "recording.wav";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_TIMEOUT_MS);

  // Send whole PCM audio to server
  await sendAudioFileToServer(merged.buffer);

  disconnectFromSocket();

  document.getElementById(START_BUTTON_ID).disabled = false;
  document.getElementById(STOP_BUTTON_ID).disabled = true;
}

// On Loadup
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById(STOP_BUTTON_ID).disabled = true;
  document.getElementById(START_BUTTON_ID).disabled = false;

  useTempoCheckbox = document.getElementById(USE_TEMPO_CHECKBOX_ID);
  tempoInput = document.getElementById(TEMPO_INPUT_ID);
  tempoUnit = document.getElementById(TEMPO_UNIT_ID);

  // Show or hide tempo number input based on checkbox
  if (useTempoCheckbox) {
    useTempoCheckbox.addEventListener("change", () => {
      const show = useTempoCheckbox.checked;
      tempoInput.style.display = show ? "inline-block" : "none";
      tempoUnit.style.display = show ? "inline-block" : "none";
    });
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 48000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        googAutoGainControl: false,
        googNoiseSuppression: false,
        googEchoCancellation: false
      }
    });

  } catch (err) {
    document.getElementById(STATUS_TEXT_ID).innerText =
      "Microphone access denied or error occurred.";
    console.error("Error accessing microphone:", err);
    return;
  }

  await setUpAudioWorklet(stream);

  document.getElementById(START_BUTTON_ID).onclick = startRecording;
  document.getElementById(STOP_BUTTON_ID).onclick = stopRecording;
});
