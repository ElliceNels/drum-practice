let recorder;
let chunks = [];
const timeSliceMs = 20;
const MIME_WEBM = "audio/webm";
const MIME_MP4 = "audio/mp4";
const WEBM = "webm";
const MP4 = "mp4";

document.addEventListener("DOMContentLoaded", async () => {
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
  
  document.getElementById("start-button").onclick = () => {
    if (recorder.state === "recording") return;
    document.getElementById("status-text").innerText = "Recording...";
    recorder.start(timeSliceMs);
  };


  document.getElementById("stop-button").onclick  = () => {
    if (recorder.state !== "recording") return;
    document.getElementById("status-text").innerText = "Idle";
    recorder.stop();
  };


  recorder.ondataavailable = e => {
    chunks.push(e.data);
    // TODO: Send chunk to server
    e.data.arrayBuffer().then(buffer => {
      // Log chunk size for debugging
      console.log("Chunk size (bytes):", buffer.byteLength);
    });
  };

  recorder.onstop = () => {
    const audioBlob = new Blob(chunks, { type });

    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recording." + (type.includes(WEBM) ? WEBM : MP4);
    a.click();

    // TODO: send whole file to server

    // Clear chunks for next recording
    chunks = [];
  };

});
