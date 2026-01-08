"""Module defining the Audio Socket.IO namespace."""
import logging
from flask_socketio import Namespace, emit
from audio_processing.online import OnlineAubioProcessor
from audio_processing.offline import OfflineAudioProcessor

logger = logging.getLogger(__name__)


class AudioNamespace(Namespace):
    """Socket.IO namespace for handling audio streaming."""
    PERFOMANCE_SUMMARY_EVENT = "performance_summary"
    CHUNK_RESPONSE_EVENT = "chunk_response"

    def __init__(self, namespace):
        super().__init__(namespace)
        self.online_processor = OnlineAubioProcessor()
        self.offline_processor = OfflineAudioProcessor()

    def on_connect(self):
        """Handle a new client connection."""
        logger.info("[SOCKET] Client connected to /audio namespace")

    def on_disconnect(self):
        """Handle client disconnection."""
        logger.info("[SOCKET] Client disconnected from /audio namespace")

    def on_receive_chunk(self, data):
        """Handle incoming audio stream chunk."""
        if not data or len(data) <= 1:
            logger.warning("[RECV] Empty audio chunk received")
            return
        logger.debug("[RECV] Audio chunk from client, size: %d bytes", len(data))
        results = self.online_processor.process_chunk(data)
        # Process the audio chunk with online audio processing
        if results:
            logger.debug("[SEND] Chunk response to client: %s", results[-1])
            emit("chunk_response", results[-1])

    def on_receive_audio_file(self, data):
        """Handle incoming full audio file."""
        logger.info("[RECV] Full audio file from client, size: %d bytes", len(data))
        logger.debug("[PROC] Loading audio from bytes...")
        # Process the audio file with offline audio processing
        audio_data = self.offline_processor.load_audio_from_bytes(data)
        logger.debug("[PROC] Analyzing audio for beats and downbeats...")
        beats, downbeats = self.offline_processor.analyze_audio(audio_data)
        logger.debug("[PROC] Detected %d beats", len(beats))
        logger.debug("[PROC] Calculating BPM array from beat intervals...")
        bpm_arr = self.offline_processor.calculate_bpm_array(beats)

        # Use desired BPM if set, otherwise use mean of detected BPM
        target_bpm = self.online_processor.desired_bpm
        if target_bpm is None:
            target_bpm = self.offline_processor.calculate_mean_tempo(bpm_arr)
            logger.info("[PROC] No desired BPM set, using detected mean BPM: %.2f", target_bpm)
        else:
            logger.info("[PROC] Using client-specified target BPM: %.2f", target_bpm)
        
        logger.debug("[PROC] Calculating performance rank...")
        rank = self.offline_processor.performance_to_rank(bpm_arr, target_bpm=target_bpm)
        if rank:
            logger.info("[PROC] Performance analysis complete - Rank: %d, Description: %s", rank[0], rank[1])
            logger.info("[SEND] Performance summary to client")
            emit("performance_summary", {"rank": rank[0], "description": rank[1]})
        else:
            logger.error("[ERROR] Failed to calculate performance rank")

    def on_desired_tempo(self, data):
        """Handle desired tempo setting from client."""
        tempo = data.get("tempo")
        if tempo:
            logger.info("[RECV] Desired tempo from client: %.2f BPM", tempo)
            logger.debug("[PROC] Setting desired tempo for audio processing")
            # Set the desired tempo for audio processing
            self.online_processor.set_desired_tempo(tempo)
        else:
            logger.warning("[ERROR] Received desired tempo event but no tempo value provided")
            # Set the desired tempo for audio processing
            self.online_processor.set_desired_tempo(tempo)
