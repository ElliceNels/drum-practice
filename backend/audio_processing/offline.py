"""Offline audio processing for beat and tempo detection using BeatNet."""

from BeatNet.BeatNet import BeatNet
import librosa
import numpy as np

SECONDS_IN_MINUTE: int = 60
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

    def __init__(
            self,
            bpm_threshold: float = 10.0,
            accuracy_floor: float = 0.10,
            stability_floor: float = 20.0,
            consistency_floor: float = 0.18
        ):
        """
        Initializes the OfflineAudioProcessor with BeatNet model and parameters.

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
    def calculate_bpm_array(beat_times: np.ndarray) -> np.ndarray:
        """
        Calculate instantaneous BPM array from beat times.

        Args:
            beat_times (np.ndarray): Array of detected beat times in seconds.
        Returns:
            np.ndarray: Array of BPM values corresponding to each beat interval.
        """
        ibi: np.ndarray = np.diff(beat_times)
        # Filter out zero or near-zero intervals to avoid division by zero
        epsilon = 1e-6
        valid_ibi = ibi[ibi > epsilon]
        inst_bpm_array: np.ndarray = SECONDS_IN_MINUTE / valid_ibi
        return inst_bpm_array

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

    def calculate_statistics(self, bpm_array: np.ndarray, target_bpm: float) -> dict:
        """
        Calculate tempo stability statistics based on a target BPM.

        Args:
            bpm_array (np.ndarray): Instantaneous BPM values.
            target_bpm (float): The intended BPM of the song/performance.
        Returns:
            dict: Dictionary containing tempo stability metrics.
        """

        median_bpm = float(np.median(bpm_array))
        std_bpm = float(np.std(bpm_array))
        cv = (std_bpm / target_bpm) * 100
        bpm_min, bpm_max = float(np.min(bpm_array)), float(np.max(bpm_array))

        deviation = np.abs(bpm_array - target_bpm)
        within_mask = deviation <= self.bpm_threshold
        percentage = (np.sum(within_mask) / len(bpm_array)) * 100
        # TODO: Convert to DTO format when used
        return {
            "target_bpm": target_bpm,
            "mean_bpm": float(np.mean(bpm_array)),
            "median_bpm": median_bpm,
            "bpm_min": bpm_min,
            "bpm_max": bpm_max,
            "std_dev": std_bpm,
            "variance_coefficient": cv,
            "percentage_within_threshold": percentage,
        }

    def calculate_scores(
            self,
            mean_bpm: float,
            std_dev: float,
            cv: float,
            percentage: float,
            target_bpm: float
        ) -> dict:
        """
        Calculate quality scores based on tempo statistics.

        Args:
            mean_bpm (float): Mean BPM value
            std_dev (float): Standard deviation of BPM
            cv (float): Coefficient of variation of BPM
            percentage (float): Percentage of BPM values within threshold
            target_bpm (float): Target BPM value
        Returns:
            dict: Dictionary containing accuracy, stability, consistency, and threshold scores.
        """
        # Accuracy: BPM error relative to target tempo
        # Stability: Standard deviation of BPM, overall longterm steadiness
        # Consistency: Coefficient of Variation (CV) of BPM, beat to beat jitter
        # Threshold: Percentage of beats within allowed timing window

        # Normalise metrics into quality scores (0 = bad, 1 = excellent)
        accuracy_error = abs(mean_bpm - target_bpm) / target_bpm
        accuracy_score = 1 - np.clip(accuracy_error / self.accuracy_floor, 0, 1)
        stability_score = 1 - np.clip(std_dev / self.stability_floor, 0, 1)
        consistency_score = 1 - np.clip((cv / 100) / self.consistency_floor, 0, 1)
        threshold_score = percentage / 100.0

        return {
            "accuracy_score": float(accuracy_score),
            "stability_score": float(stability_score),
            "consistency_score": float(consistency_score),
            "threshold_score": float(threshold_score)
        }

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
            accuracy * 0.35 +
            consistency * 0.25 +
            stability * 0.15 +
            threshold * 0.25
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
            mean_bpm=stats["mean_bpm"],
            std_dev=stats["std_dev"],
            cv=stats["variance_coefficient"],
            percentage=stats["percentage_within_threshold"],
            target_bpm=stats["target_bpm"]
        )
        performance_rank = OfflineAudioProcessor.scores_to_rank(
            accuracy=scores["accuracy_score"],
            stability=scores["stability_score"],
            consistency=scores["consistency_score"],
            threshold=scores["threshold_score"]
        )
        return performance_rank


if __name__ == "__main__":
    TEST_FILE = "..\\test_audio_files\\practice_124.wav"
    processor = OfflineAudioProcessor()
    data = processor.load_audio(TEST_FILE)
    beats, dbeats = processor.analyze_audio(data)
    bpm_arr = processor.calculate_bpm_array(beats)
    rank = processor.performance_to_rank(bpm_arr, target_bpm=124.0)
    print(f"Performance Rank: {rank[0]}, Description: {rank[1]}")
