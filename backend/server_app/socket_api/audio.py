"""Module defining the Audio Socket.IO namespace."""
import logging
from dataclasses import asdict
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
        self.online_processor.reset()

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
        """Handle incoming full audio file (WAV bytes)."""
        try:
            logger.info("[RECV] Full audio file from client, size: %d bytes", len(data))
            logger.debug("[PROC] Loading audio from bytes...")
            audio_data = self.offline_processor.load_audio_from_bytes(data)
            logger.debug("[PROC] Analyzing audio for beats and downbeats...")
            beats, downbeats = self.offline_processor.analyze_audio(audio_data)
            logger.debug("[PROC] Detected %d beats", len(beats))

            # Resolve target BPM before correction so it can anchor half/double-time fix
            target_bpm = self.online_processor.desired_bpm
            logger.debug("[PROC] Calculating BPM array from beat intervals...")
            bpm_arr, time_mids = self.offline_processor.calculate_bpm_array(beats, target_bpm=target_bpm)

            if target_bpm is None:
                target_bpm = float(bpm_arr.mean())
                logger.info("[PROC] No desired BPM set, using detected mean BPM: %.2f", target_bpm)
            else:
                logger.info("[PROC] Using client-specified target BPM: %.2f", target_bpm)

            logger.debug("[PROC] Calculating statistics and scores...")
            stats = self.offline_processor.calculate_statistics(bpm_arr, target_bpm)
            scores = self.offline_processor.calculate_scores(
                mean_bpm=stats.mean_bpm,
                std_dev=stats.std_dev,
                cv=stats.variance_coefficient,
                percentage=stats.percentage_within_threshold,
                target_bpm=stats.target_bpm
            )
            rank_num, rank_desc = self.offline_processor.scores_to_rank(
                accuracy=scores.accuracy,
                stability=scores.stability,
                consistency=scores.consistency,
                threshold=scores.threshold
            )

            logger.info("[PROC] Performance analysis complete - Rank: %d, Description: %s", rank_num, rank_desc)
            logger.info("[SEND] Performance summary to client")
            emit("performance_summary", {
                "rank": rank_num,
                "description": rank_desc,
                "scores": asdict(scores),
                "stats": asdict(stats),
                "bpm_timeline": {
                    "bpm_array": bpm_arr.tolist(),
                    "time_midpoints": time_mids.tolist(),
                },
            })

            return {"success": True, "message": "Audio file processed successfully"}
        except Exception as e:
            logger.error("[ERROR] Exception while processing audio file: %s", str(e))
            return {"success": False, "message": str(e)}

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
