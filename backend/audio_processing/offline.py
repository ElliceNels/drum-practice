"""Offline audio processing for beat and tempo detection using BeatNet."""

import io
from BeatNet.BeatNet import BeatNet
import librosa
import numpy as np
from scipy.signal import medfilt

from data_model.statistics import TempoStatistics
from data_model.scores import QualityScores

SECONDS_IN_MINUTE: int = 60
MAX_REALISTIC_BPM: int = 300
MIN_REALISTIC_BPM: int = 40
SKILL_TIERS = {
    10: "Perfect / Machine-like",
    9:  "Extremely tight",
    8:  "Very tight",
    7:  "Tight",
    6:  "Pretty solid",
    5:  "Average",
    4:  "Loose",
    3:  "Very loose",
    2:  "Unsteady",
    1:  "Erratic",
}


class OfflineAudioProcessor:
    """
    A class to process audio files for beat and tempo detection using BeatNet.
    """

    SAMPLE_RATE: int = 22050
    # Weights for combining individual scores into final rank, must sum to 1.0
    ACCURACY_WEIGHT: float = 0.35
    CONSISTENCY_WEIGHT: float = 0.25
    STABILITY_WEIGHT: float = 0.15
    THRESHOLD_WEIGHT: float = 0.25

    def __init__(
            self,
            bpm_threshold: float = 10.0,
            accuracy_floor: float = 0.10,
            stability_floor: float = 20.0,
            consistency_floor: float = 0.18
        ):
        """
        Initializes the OfflineAudioProcessor with BeatNet model and parameters.
These parameters have been derived from empirical testing with a variety of musical recordings.
These thresholds were found to provide reasonable discrimination between different
levels of rhythmic performance.

        Args:
            bpm_threshold (float): Allowed BPM deviation for threshold calculations.
            accuracy_floor (float): Floor value for accuracy score normalization.
            stability_floor (float): Floor value for stability score normalization.
            consistency_floor (float): Floor value for consistency score normalization.
        """
        self.model: BeatNet = BeatNet(
            mode="offline", model=1, inference_model='DBN')
        self.bpm_threshold: float = bpm_threshold

        self.accuracy_floor: float = accuracy_floor  # 10% BPM deviation allowed
        self.stability_floor: float = stability_floor  # 20 BPM std deviation allowed
        self.consistency_floor: float = consistency_floor  # 18% CV allowed

    @staticmethod
    def load_audio(file_path: str) -> np.ndarray:
        """
        Loads an audio file.

        Args:
            file_path (str): Path to the audio file.
        Returns:
            np.ndarray: Audio time series.
        """
        audio_data: np.ndarray = librosa.load(
            file_path, sr=OfflineAudioProcessor.SAMPLE_RATE)[0]
        return audio_data

    @staticmethod
    def load_audio_from_bytes(audio_bytes: bytes) -> np.ndarray:
        """
        Loads audio data from bytes.

        Args:
            audio_bytes (bytes): Audio data in bytes.
        Returns:
            np.ndarray: Audio time series.
        """
        audio_data: np.ndarray = librosa.load(
            io.BytesIO(audio_bytes),
            sr=OfflineAudioProcessor.SAMPLE_RATE
        )[0]
        return audio_data

    def analyze_audio(self, audio_data: np.ndarray) -> tuple:
        """
        Analyzes an audio file to extract both beats and tempo.

        Args:
            audio_data (np.ndarray): Audio time series data to analyze.
        Returns:
            tuple: A tuple containing:
                - beat_times (list): List of detected beat times in seconds.
                - downbeats (list): List indicating downbeats (1 for downbeat, 0 otherwise).
        """
        res: np.ndarray = self.model.process(audio_data)
        beat_times: np.ndarray = res[:, 0]
        downbeats: np.ndarray = res[:, 1]

        return beat_times, downbeats

    @staticmethod
    def calculate_mean_tempo(beat_times: np.ndarray) -> float:
        """
        Calculate tempo (BPM) from beat times.

        Args:
            beat_times (np.ndarray): Array of detected beat times in seconds.
        Returns:
            float: Calculated tempo in BPM.
        """
        if len(beat_times) < 2:
            raise ValueError(
                "At least two beat times are required to calculate mean tempo.")
        return SECONDS_IN_MINUTE / np.mean(np.diff(beat_times))

    @staticmethod
    def _correct_half_double_time(bpm_array: np.ndarray, anchor: float = None):
        """
        Correct BPM array for half-time and double-time errors.

        Uses anchor BPM as reference if provided (e.g. target BPM in match-tempo mode),
        otherwise falls back to the median of the array.

        Args:
            bpm_array (np.ndarray): Array of BPM values.
            anchor (float, optional): Reference BPM to correct towards.
        Returns:
            np.ndarray: Corrected BPM array.
        """
        if len(bpm_array) == 0:
            return bpm_array

        ref: float = anchor if anchor is not None else float(np.median(bpm_array))
        candidates = np.stack([bpm_array, bpm_array / 2, bpm_array * 2], axis=1)
        distances = np.abs(candidates - ref)
        best_indices = np.argmin(distances, axis=1)
        corrected = candidates[np.arange(len(bpm_array)), best_indices]
        return corrected

    @staticmethod
    def _moving_average(bpm_array: np.ndarray, window_size: int = 5) -> np.ndarray:
        """
        Apply moving average smoothing to BPM array.
        Args:
            bpm_array (np.ndarray): Array of BPM values.
            window_size (int): Size of the moving average window.
        Returns:
            np.ndarray: Smoothed BPM array.
        """
        if len(bpm_array) < window_size:
            return bpm_array
        return np.convolve(bpm_array, np.ones(window_size) / window_size, mode="same")

    @staticmethod
    def _median_smooth(bpm_array: np.ndarray, kernel_size: int = 3) -> np.ndarray:
        """
        Apply median filtering to BPM array.
        Args:
            bpm_array (np.ndarray): Array of BPM values.
            kernel_size (int): Size of the median filter kernel. Must be odd.
        Returns:
            np.ndarray: Smoothed BPM array.
        Raises:
            ValueError: If kernel_size is not odd.
        """
        if len(bpm_array) < kernel_size:
            return bpm_array
        if kernel_size % 2 == 0:
            raise ValueError("kernel_size must be odd for median filtering")
        return medfilt(bpm_array, kernel_size=kernel_size)

    @staticmethod
    def calculate_bpm_array(beat_times: np.ndarray, target_bpm: float = None) -> tuple:
        """
        Calculate instantaneous BPM array from beat times by filtering only realistic inter-beat intervals.

        Args:
            beat_times (np.ndarray): Array of detected beat times in seconds.
            target_bpm (float, optional): Target BPM for half/double-time correction anchor.
        Returns:
            tuple: (bpm_array, time_midpoints) with matching lengths.
        """
        ibi: np.ndarray = np.diff(beat_times)
        midpoints: np.ndarray = (beat_times[:-1] + beat_times[1:]) / 2

        # 1. Build a single validity mask
        epsilon = 1e-6
        min_ibi_threshold = SECONDS_IN_MINUTE / MAX_REALISTIC_BPM
        max_ibi_threshold = SECONDS_IN_MINUTE / MIN_REALISTIC_BPM

        valid_mask = (ibi > epsilon) & (ibi > min_ibi_threshold) & (ibi < max_ibi_threshold)

        valid_ibi = ibi[valid_mask]
        valid_midpoints = midpoints[valid_mask]

        if len(valid_ibi) < 1:
            raise ValueError(
                "Not enough valid inter-beat intervals within the realistic BPM range "
                f"({MIN_REALISTIC_BPM}-{MAX_REALISTIC_BPM} BPM) to calculate BPM array."
            )
        inst_bpm_array: np.ndarray = SECONDS_IN_MINUTE / valid_ibi

        # 2. Half-time and double-time correction (use target BPM as anchor when available)
        corrected_bpm_array = OfflineAudioProcessor._correct_half_double_time(inst_bpm_array, anchor=target_bpm)

        # 3. Median Window Smoothing
        smoothed_bpm_array = OfflineAudioProcessor._median_smooth(
            corrected_bpm_array, kernel_size=3
        )

        # 4. Moving Average Smoothing
        averaged_bpm_array = OfflineAudioProcessor._moving_average(
            smoothed_bpm_array, window_size=5
        )

        # 5. Trim edges AFTER smoothing (moving average distorts first/last few values)
        TRIM_SECONDS = 3.0
        if len(valid_midpoints) > 0:
            start_time = valid_midpoints[0] + TRIM_SECONDS
            end_time = valid_midpoints[-1] - TRIM_SECONDS
            if start_time < end_time:
                trim_mask = (valid_midpoints >= start_time) & (valid_midpoints <= end_time)
                averaged_bpm_array = averaged_bpm_array[trim_mask]
                valid_midpoints = valid_midpoints[trim_mask]

        return averaged_bpm_array, valid_midpoints

    @staticmethod
    def calculate_time_midpoints(beat_times: np.ndarray) -> np.ndarray:
        """
        Calculate midpoints of beat times for plotting BPM values.

        Args:
            beat_times (np.ndarray): Array of detected beat times in seconds.
        Returns:
            np.ndarray: Midpoints of beat times.
        """
        return (beat_times[:-1] + beat_times[1:]) / 2

    def calculate_statistics(self, bpm_array: np.ndarray, target_bpm: float) -> TempoStatistics:
        """
        Calculate tempo stability statistics based on a target BPM.

        Args:
            bpm_array (np.ndarray): Instantaneous BPM values.
            target_bpm (float): The intended BPM of the song/performance.
        Returns:
            TempoStatistics: DTO containing tempo stability metrics.
        """
        if len(bpm_array) == 0:
            raise ValueError("Array must contain at least one BPM value to calculate statistics.")
        if target_bpm <= 0:
            raise ValueError("target_bpm must be greater than zero to calculate statistics.")
        median_bpm = float(np.median(bpm_array))
        std_bpm = float(np.std(bpm_array))
        cv = (std_bpm / target_bpm) * 100
        bpm_min, bpm_max = float(np.min(bpm_array)), float(np.max(bpm_array))

        deviation = np.abs(bpm_array - target_bpm)
        within_mask = deviation <= self.bpm_threshold
        percentage = (np.sum(within_mask) / len(bpm_array)) * 100

        return TempoStatistics(
            target_bpm=target_bpm,
            mean_bpm=float(np.mean(bpm_array)),
            median_bpm=median_bpm,
            min_bpm=bpm_min,
            max_bpm=bpm_max,
            std_dev=std_bpm,
            variance_coefficient=cv,
            percentage_within_threshold=percentage,
        )

    def calculate_scores(
            self,
            mean_bpm: float,
            std_dev: float,
            cv: float,
            percentage: float,
            target_bpm: float
        ) -> QualityScores:
        """
        Calculate quality scores based on tempo statistics.

        Args:
            mean_bpm (float): Mean BPM value
            std_dev (float): Standard deviation of BPM
            cv (float): Coefficient of variation of BPM
            percentage (float): Percentage of BPM values within threshold
            target_bpm (float): Target BPM value
        Returns:
            QualityScores: DTO containing accuracy, stability, consistency, and threshold scores.
Each score is a normalized value between 0 and 1, where 0 is bad and 1 is excellent.
        """
        # Accuracy: BPM error relative to target tempo
        # Stability: Standard deviation of BPM, overall longterm steadiness
        # Consistency: Coefficient of Variation (CV) of BPM, beat to beat jitter
        # Threshold: Percentage of beats within allowed timing window

        if target_bpm <= 0:
            raise ValueError("target_bpm must be greater than zero to compute accuracy score.")

        # Normalise metrics into quality scores (0 = bad, 1 = excellent)
        accuracy_error = abs(mean_bpm - target_bpm) / target_bpm
        accuracy_score = 1 - np.clip(accuracy_error / self.accuracy_floor, 0, 1)
        stability_score = 1 - np.clip(std_dev / self.stability_floor, 0, 1)
        consistency_score = 1 - np.clip((cv / 100) / self.consistency_floor, 0, 1)
        threshold_score = percentage / 100.0

        return QualityScores(
            accuracy=float(accuracy_score),
            stability=float(stability_score),
            consistency=float(consistency_score),
            threshold=float(threshold_score)
        )

    @staticmethod
    def scores_to_rank(
        accuracy: float,
        stability: float,
        consistency: float,
        threshold: float
    ) -> tuple:
        """
        Create a performance rank from individual score components.

        Args:
            accuracy (float): Accuracy score (0 to 1).
            stability (float): Stability score (0 to 1).
            consistency (float): Consistency score (0 to 1).
            threshold (float): Threshold score (0 to 1).
        Returns:
            tuple: A tuple containing:
                - rank (int): Performance rank from 1 to 10.
                - description (str): Description of the skill tier.
        """
        combined = (
            OfflineAudioProcessor.ACCURACY_WEIGHT * accuracy +
            OfflineAudioProcessor.CONSISTENCY_WEIGHT * consistency +
            OfflineAudioProcessor.STABILITY_WEIGHT * stability +
            OfflineAudioProcessor.THRESHOLD_WEIGHT * threshold
        )

        # Convert 0–1 score into 1–10 rank
        scaled_rank = int(round(combined * 9)) + 1
        final_rank = max(1, min(10, scaled_rank))
        return final_rank, SKILL_TIERS[final_rank]

    def performance_to_rank(self, bpm_array: np.ndarray, target_bpm: float) -> tuple:
        """
        Convenience method that calculates statistics, scores, and rank from BPM data.

        Args:
            bpm_array (np.ndarray): Instantaneous BPM values.
            target_bpm (float): The intended BPM of the song/performance.
        Returns:
            tuple: A tuple containing:
                - rank (int): Performance rank from 1 to 10.
                - description (str): Description of the skill tier.
        """
        stats = self.calculate_statistics(bpm_array, target_bpm)
        scores = self.calculate_scores(
            mean_bpm=stats.mean_bpm,
            std_dev=stats.std_dev,
            cv=stats.variance_coefficient,
            percentage=stats.percentage_within_threshold,
            target_bpm=stats.target_bpm
        )
        performance_rank = OfflineAudioProcessor.scores_to_rank(
            accuracy=scores.accuracy,
            stability=scores.stability,
            consistency=scores.consistency,
            threshold=scores.threshold
        )
        return performance_rank


if __name__ == "__main__":
    import logging
    logger = logging.getLogger(__name__)

    TEST_FILE = "..\\test_audio_files\\practice_124.wav"
    processor = OfflineAudioProcessor()
    data = processor.load_audio(TEST_FILE)
    beats, dbeats = processor.analyze_audio(data)
    bpm_arr, _ = processor.calculate_bpm_array(beats)
    rank = processor.performance_to_rank(bpm_arr, target_bpm=124.0)
    logger.info("Performance Rank: %d, Description: %s", rank[0], rank[1])
