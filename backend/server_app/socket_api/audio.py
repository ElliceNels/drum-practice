"""Module defining the Audio Socket.IO namespace."""
from flask_socketio import Namespace

class AudioNamespace(Namespace):
    """Socket.IO namespace for handling audio streaming."""

    def on_connect(self):
        """Handle a new client connection."""
        print("Client connected to /audio")

    def on_disconnect(self):
        """Handle client disconnection."""
        print("Client disconnected from /audio")

    def on_stream_chunk(self, data):
        """Handle incoming audio stream chunk."""
        print("Received audio chunk:", len(data))
        # Process the audio chunk with online audio processing
