// MediaRecorder-based audio recording script for capturing live audio chunks, sending them to a server
// and allowing download of the full recording upon stopping. 
import { connectToSocket,
         disconnectFromSocket,
         sendChunkToServer,
         sendAudioFileToServer } from "./socket.js";

let recorder;
let chunks = [];
const TIME_SLICE_MS = 20;
const MIME_WEBM = "audio/webm";
const MIME_MP4 = "audio/mp4";
const EXTENSION_WEBM = "webm";
const EXTENSION_MP4 = "mp4";

document.addEventListener("DOMContentLoaded", async () => {
  // Disable stop button initially
  document.getElementById("stop-button").disabled = true;
  document.getElementById("start-button").disabled = false;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    document.getElementById("status-text").innerText = "Microphone access denied or error occurred.";
    console.error("Error accessing microphone:", err);
    return;
  }
  
  let type;
  if (MediaRecorder.isTypeSupported(MIME_WEBM)) {
    type = MIME_WEBM;
  } else if (MediaRecorder.isTypeSupported(MIME_MP4)) {
    type = MIME_MP4;
  } else {
    document.getElementById("status-text").innerText = "Error: No supported audio format found for recording.";
    document.getElementById("start-button").disabled = true;
    document.getElementById("stop-button").disabled = true;
    return;
  }

  recorder = new MediaRecorder(stream, { mimeType: type });
  
  document.getElementById("start-button").onclick = async () => {
    if (recorder.state === "recording") return;

    // Connect to socket server
    await connectToSocket();
  
    document.getElementById("status-text").innerText = "Recording...";
    // Clear chunks from previous recordings
    chunks = [];
    recorder.start(TIME_SLICE_MS);
    // Disable buttons to prevent multiple clicks
    document.getElementById("start-button").disabled = true;
    document.getElementById("stop-button").disabled = false;
  };
  

  document.getElementById("stop-button").onclick = () => {
    if (recorder.state !== "recording") return;
    document.getElementById("status-text").innerText = "Idle";
    recorder.stop();
    // Disable buttons to prevent multiple clicks
    document.getElementById("start-button").disabled = false;
    document.getElementById("stop-button").disabled = true;
  };


  recorder.ondataavailable = async e => {
    chunks.push(e.data);
    const buffer = await e.data.arrayBuffer();
    // Log chunk size for debugging
    console.log("Chunk size (bytes):", buffer.byteLength);
    sendChunkToServer(buffer);
  };


  recorder.onstop = async () => {
    const audioBlob = new Blob(chunks, { type });

    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement("a");
    a.href = url;
    // TODO: Prompt on where to save the file or don't download
    a.download = "recording." + (type.includes(EXTENSION_WEBM) ? EXTENSION_WEBM : EXTENSION_MP4);
    a.click();
    // Revoke the object URL after a short delay to avoid memory leaks
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    // Send whole file to server
    sendAudioFileToServer(await audioBlob.arrayBuffer());

    // Disconnect from socket server
    disconnectFromSocket();
  };

});
