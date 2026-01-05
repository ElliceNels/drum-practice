"""Online audio processing using Aubio for real-time onset and tempo detection."""
import time
import logging
import numpy as np
import aubio

# TODO: Validate number choices here
SAMPLERATE = 48000  # Default processing sample rate (e.g., typical browser/Web Audio output)
HOP_SIZE = 1024     # Hop size for aubio processing
BUFFER_SIZE = 2048  # FFT buffer size for aubio

logger = logging.getLogger(__name__)

class OnlineAubioProcessor:
    """Process audio chunks in real-time using Aubio for onset and tempo detection."""
    MAX_DEVIATION_BPM = 15.0  # Maximum allowed BPM deviation for tempo matching
    TOLERANCE_PERCENTAGE = 0.05  # Tolerance percentage for tempo matching

    def __init__(self, samplerate=SAMPLERATE, hop_size=HOP_SIZE, buffer_size=BUFFER_SIZE):
        self.samplerate = samplerate
        self.hop_size = hop_size
        self.buffer_size = buffer_size

        # Aubio processors
        self.onset = aubio.onset("default", buffer_size, hop_size, samplerate)
        self.tempo_detector = aubio.tempo("default", buffer_size, hop_size, samplerate)

        # For real BPM computation
        self.last_beat_time = None
        self.detected_bpm = None
        self.bpms = []
        self.mean_bpm = None

        # Desired tempo
        self.desired_bpm = None

        # Internal leftover buffer for frame alignment
        self._leftover = np.array([], dtype=np.float32)

    def set_desired_tempo(self, bpm):
        """Set the desired BPM for tempo matching."""
        self.desired_bpm = float(bpm)

    def _update_bpm(self):
        now = time.time()

        if self.last_beat_time is not None:
            delta = now - self.last_beat_time
            if delta > 0:
                self.detected_bpm = 60.0 / delta
                self.bpms.append(self.detected_bpm)
                self.mean_bpm = self._compute_average_bpm()
                if not self.desired_bpm:
                    self.desired_bpm = self.mean_bpm
        self.last_beat_time = now

    def _compute_average_bpm(self):
        if not self.bpms:
            return None
        return sum(self.bpms) / len(self.bpms)

    def _compare_tempo(self):
        if self.desired_bpm is None:
            return None

        # Prefer stable estimate
        bpm_to_compare = self.mean_bpm or self.detected_bpm
        if bpm_to_compare is None:
            return None

        # Relative tolerance feels more musical
        tolerance = min(self.MAX_DEVIATION_BPM, self.desired_bpm * self.TOLERANCE_PERCENTAGE)

        diff = bpm_to_compare - self.desired_bpm

        if abs(diff) <= tolerance:
            state = "on"
        elif diff > tolerance:
            state = "ahead"
        else:
            state = "behind"

        return state

    def process_chunk(self, chunk_bytes):
        """Process one audio chunk and return a list of Aubio event dictionaries."""
        logger.debug("PCM chunk size (bytes): %d", len(chunk_bytes))

        if len(chunk_bytes) == 0:
            return []

        # Convert raw bytes → float32 PCM: Each float32 sample = 4 bytes
        pcm = np.frombuffer(chunk_bytes, dtype=np.float32)

        logger.debug("PCM decoded samples: %d", len(pcm))

        # Merge leftover from previous chunk
        full_buffer = np.concatenate((self._leftover, pcm))

        results = []

        index = 0
        total = len(full_buffer)

        # Process full hop_size frames
        while index + self.hop_size <= total:
            frame = full_buffer[index:index + self.hop_size]

            logger.debug("Max frame amplitude: %f", np.max(np.abs(frame)))


            onset_detected = bool(self.onset(frame))
            beat_detected = bool(self.tempo_detector(frame))

            tempo_match = None
            if beat_detected:
                self._update_bpm()
                logger.debug("BEAT DETECTED")
                tempo_match = self._compare_tempo()

            result = {
                "onset": onset_detected,
                "beat": beat_detected,
                "bpm": self.detected_bpm,
                "mean_bpm": self.mean_bpm,
                "tempo_match": tempo_match
            }
            results.append(result)

            logger.debug("Aubio frame result: %s", result)

            index += self.hop_size

        # Save leftover unprocessed samples
        self._leftover = full_buffer[index:]

        logger.debug(
            "Processed chunk: %d frames, %d leftover samples",
            len(results),
            len(self._leftover)
        )

        return results
