"""Module defining the Audio Socket.IO namespace."""
from flask_socketio import Namespace, emit

class AudioNamespace(Namespace):
    """Socket.IO namespace for handling audio streaming."""

    def on_connect(self):
        """Handle a new client connection."""
        print("Client connected to /audio")

    def on_disconnect(self):
        """Handle client disconnection."""
        print("Client disconnected from /audio")

    def on_receive_chunk(self, data):
        """Handle incoming audio stream chunk."""
        if len(data) <= 1:
            print("Received empty audio chunk.")
            return
        print("Received audio chunk:", len(data))
        # Process the audio chunk with online audio processing
        emit("chunk_response", {"data": "I just processed a chunk!"})

    def on_receive_audio_file(self, data):
        """Handle incoming full audio file."""
        print("Received audio file:", len(data))
        # Process the audio file with online audio processing

    def on_desired_tempo(self, data):
        """Handle desired tempo setting from client."""
        tempo = data.get("tempo")
        if tempo:
            print("Received desired tempo:", tempo)
            # Set the desired tempo for audio processing
