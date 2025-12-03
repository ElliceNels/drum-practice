let socket = null;
const SOCKET_URL = "http://localhost:5000/audio";

const CONNECT_EVENT = "connect";
const CHUNK_RESPONSE_EVENT = "chunk_response";
const RECEIVE_CHUNK_EVENT = "receive_chunk";
const RECEIVE_AUDIO_FILE_EVENT = "receive_audio_file";

function handleChunkResponse(data) {
  console.log("Received response from server:", data);
}

// Connect to server
export function connectToSocket() {
  return new Promise(resolve => {
    socket = io(SOCKET_URL, {transports: ["websocket"]});

    socket.on(CONNECT_EVENT, () => {
        console.log("Socket connected:", socket.id);
        resolve(); // Ensure the promise resolves only after connection
    });

    socket.on(CHUNK_RESPONSE_EVENT, handleChunkResponse);
  });
}

export function disconnectFromSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
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


