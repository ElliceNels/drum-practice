let socket = null;
const SOCKET_URL = "http://localhost:5000/audio";

const CONNECT_EVENT = "connect";
const CHUNK_RESPONSE_EVENT = "chunk_response";
const RECEIVE_CHUNK_EVENT = "receive_chunk";
const RECEIVE_AUDIO_FILE_EVENT = "receive_audio_file";
const DESIRED_TEMPO_EVENT = "desired_tempo";
const MAX_TEMPO_BPM = 300;
const MIN_TEMPO_BPM = 40;

function handleChunkResponse(data) {
  console.log("Received response from server:", data);
}

// Connect to server
export function connectToSocket() {
  return new Promise((resolve, reject) => {
    let settled = false;
    socket = io(SOCKET_URL, {transports: ["websocket"]});

    socket.on(CONNECT_EVENT, () => {
        if (!settled) {
            settled = true;
            console.log("Socket connected:", socket.id);
            resolve(); // Ensure the promise resolves only after connection
        }
    });

    socket.on("connect_error", (error) => {
        if (!settled) {
            settled = true;
            console.error("Socket connection error:", error);
            reject(error);
        }
    });
    socket.on(CHUNK_RESPONSE_EVENT, handleChunkResponse);
  });
}

export function disconnectFromSocket() {
  if (!socket) return;
  socket.off(CONNECT_EVENT);
  socket.off(CHUNK_RESPONSE_EVENT, handleChunkResponse);
  socket.disconnect();
  socket = null;
}

// Send desired tempo (BPM) to the server. Uses Socket.IO acknowledgement to confirm delivery.
export function sendTempoToServer(tempo) {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error("Socket not connected"));
    if (typeof tempo !== 'number' || Number.isNaN(tempo) || tempo <= MIN_TEMPO_BPM || tempo >= MAX_TEMPO_BPM){
      return reject(
        new Error("Invalid tempo value: Must be a number between " + MIN_TEMPO_BPM + " and " + MAX_TEMPO_BPM)
      );
    }

    // Emit with acknowledgement callback
    socket.emit(DESIRED_TEMPO_EVENT, { tempo }, (ack) => {
      resolve(ack);
    });
  });
}

// Send raw chunk as array buffer
export async function sendChunkToServer(arrayBuffer) {
  if (!socket || !arrayBuffer) return;

  socket.emit(RECEIVE_CHUNK_EVENT, arrayBuffer);

}

// Send full audio file
export async function sendAudioFileToServer(arrayBuffer) {
  if (!socket || !arrayBuffer) return;

  socket.emit(RECEIVE_AUDIO_FILE_EVENT, arrayBuffer);
}


