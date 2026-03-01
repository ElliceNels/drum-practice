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
let micSource = null;
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
  // Create audio context if it doesn't exist
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    // Load worklet file once
    await audioContext.audioWorklet.addModule("./pcm_processor.js");
  }

  // Create new worklet node
  workletNode = new AudioWorkletNode(audioContext, "pcm-processor");

  // Forward PCM audio from processor → socket & buffer for final file
  workletNode.port.onmessage = (event) => {
    const float32 = event.data; // Float32Array of PCM samples (frame size may vary)
    pcmChunks.push(float32);    // store reference; we copy later to avoid holding onto the worklet's reused internal buffer
    sendChunkToServer(float32.buffer);
  };

  // Create or reuse mic source
  if (!micSource) {
    micSource = audioContext.createMediaStreamSource(stream);
  }
  
  // Connect mic → worklet
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
        `Invalid tempo value: Must be between ${MIN_TEMPO_BPM} and ${MAX_TEMPO_BPM} BPM (inclusive).`;
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

  // Resume or recreate the worklet node if needed
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  
  // Recreate worklet node if it was disconnected
  if (!workletNode || workletNode.port.onmessage === null) {
    const stream = micSource.mediaStream;
    await setUpAudioWorklet(stream);
  }
}

// Stop recording, send full audio to server, download locally if desired, then disconnect.
async function stopRecording() {
  // Suspend audio context to stop recording
  if (audioContext && audioContext.state === "running") {
    await audioContext.suspend();
  }
  
  // Disconnect worklet node to stop processing
  if (workletNode) {
    workletNode.disconnect();
    workletNode.port.onmessage = null;
    workletNode = null;
  }
  
  document.getElementById(STATUS_TEXT_ID).innerText = "Analysing performance...";
  document.getElementById(STOP_BUTTON_ID).disabled = true;

  // Merge Float32 PCM into one array
  const merged = mergeFloat32Arrays(pcmChunks);

  // Build WAV and download locally
  const wavBlob = buildWavFile(merged, audioContext.sampleRate);

  // Send WAV bytes to server
  const wavArrayBuffer = await wavBlob.arrayBuffer();
  try {
    await sendAudioFileToServer(wavArrayBuffer);
    console.log("[SUCCESS] Audio file sent and processed by server");
  } catch (err) {
    console.error("[ERROR] Failed to send or process audio file:", err);
    document.getElementById(STATUS_TEXT_ID).innerText = "Error: Failed to process audio. Please try again.";
  }

  document.getElementById(STATUS_TEXT_ID).innerText = "Idle";
  document.getElementById(STOP_BUTTON_ID).disabled = true;

  // Download the file
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "recording.wav";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_TIMEOUT_MS);
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
        sampleRate: SAMPLE_RATE,
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

  try {
    await setUpAudioWorklet(stream);
  } catch (err) {
    document.getElementById(STATUS_TEXT_ID).innerText =
      "Error setting up audio processing.";
    console.error("Error setting up AudioWorklet:", err);
    return;
  }

  document.getElementById(START_BUTTON_ID).onclick = startRecording;
  document.getElementById(STOP_BUTTON_ID).onclick = stopRecording;

  // Listen for offline analysis results
  document.addEventListener("offlineAnalysisComplete", (event) => {
    const results = event.detail;
    const rank = results.rank || "N/A";
    const description = results.description || "No description";
    document.getElementById(STATUS_TEXT_ID).innerText = 
      `Performance Rank: ${rank}/10 - ${description}`;
    document.getElementById(START_BUTTON_ID).disabled = false;
    document.getElementById(STOP_BUTTON_ID).disabled = true;
    console.log("Performance analysis complete:", results);
  });
});
