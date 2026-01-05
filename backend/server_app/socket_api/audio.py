"""Module defining the Audio Socket.IO namespace."""
import logging
from flask_socketio import Namespace, emit
from audio_processing.online import OnlineAubioProcessor

logger = logging.getLogger(__name__)


class AudioNamespace(Namespace):
    """Socket.IO namespace for handling audio streaming."""

    def __init__(self, namespace):
        super().__init__(namespace)
        self.online_processor = OnlineAubioProcessor()

    def on_connect(self):
        """Handle a new client connection."""
        logger.info("Client connected to /audio")

    def on_disconnect(self):
        """Handle client disconnection."""
        logger.info("Client disconnected from /audio")

    def on_receive_chunk(self, data):
        """Handle incoming audio stream chunk."""
        if not data or len(data) <= 1:
            logger.warning("Received empty audio chunk.")
            return
        logger.debug("Received audio chunk of length: %d", len(data))
        results = self.online_processor.process_chunk(data)
        # Process the audio chunk with online audio processing
        if results:
            emit("chunk_response", results[-1])

    def on_receive_audio_file(self, data):
        """Handle incoming full audio file."""
        logger.info("Received audio file of size: %d", len(data))
        # Process the audio file with online audio processing

    def on_desired_tempo(self, data):
        """Handle desired tempo setting from client."""
        tempo = data.get("tempo")
        if tempo:
            logger.info("Received desired tempo: %s", tempo)
            # Set the desired tempo for audio processing
            self.online_processor.set_desired_tempo(tempo)
