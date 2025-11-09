"""Offline audio processing for beat and tempo detection using BeatNet."""

from BeatNet.BeatNet import BeatNet
import librosa
import numpy as np

SECONDS_IN_MINUTE: int = 60

class OfflineAudioProcessor:
    """
    A class to process audio files for beat and tempo detection using BeatNet.
    """

    SAMPLE_RATE: int = 22050
    model: BeatNet = BeatNet(mode="offline", model=1, inference_model='DBN')
    BPM_threshold: float = 5.0

    @staticmethod
    def load_audio(file_path: str) -> np.ndarray:
        """
        Loads an audio file.

        Args:
            file_path (str): Path to the audio file.
        Returns:
            np.ndarray: Audio time series.
        """
        audio_data: np.ndarray = librosa.load(file_path, sr=OfflineAudioProcessor.SAMPLE_RATE)[0]
        return audio_data

    @staticmethod
    def analyze_audio(audio_data: np.ndarray) -> tuple:
        """
        Analyzes an audio file to extract both beats and tempo.

        Args:
            audio_data (np.ndarray): Audio time series data to analyze.
        Returns:
            tuple: A tuple containing:
                - beat_times (list): List of detected beat times in seconds.
                - downbeats (list): List indicating downbeats (1 for downbeat, 0 otherwise).
        """
        res: np.ndarray = OfflineAudioProcessor.model.process(audio_data)
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
            raise ValueError("At least two beat times are required to calculate mean tempo.")
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

    @staticmethod
    def calculate_statistics(bpm_array: np.ndarray, bpm: float) -> dict:
        """
        Calculate tempo stability statistics based on a target BPM

        Args:
            bpm_array (np.ndarray): Instantaneous BPM values.
            target_bpm (float): The intended BPM of the song/performance.

        Returns:
            dict: Dictionary containing tempo stability metrics.
        """

        median_bpm = float(np.median(bpm_array))
        std_bpm = float(np.std(bpm_array))
        cv = (std_bpm / bpm) * 100
        bpm_min, bpm_max = float(np.min(bpm_array)), float(np.max(bpm_array))

        deviation = np.abs(bpm_array - bpm)
        within_mask = deviation <= OfflineAudioProcessor.BPM_threshold
        percentage = (np.sum(within_mask) / len(bpm_array)) * 100
        # TODO: Convert to DTO format
        return {
            "target_bpm": bpm,
            "median_bpm": median_bpm,
            "bpm_min": bpm_min,
            "bpm_max": bpm_max,
            "std_dev": std_bpm,
            "variance_coefficient": cv,
            "percentage_within_threshold": percentage,
        }

# Example usage
if __name__ == "__main__":
    AUDIO_PATH = "test_audio_files\\iris_152.wav"
    ap = OfflineAudioProcessor()
    data = ap.load_audio(AUDIO_PATH)
    bts, dbs = ap.analyze_audio(data)
    mean = ap.calculate_mean_tempo(bts)
    array = ap.calculate_bpm_array(bts)
    time_mids = ap.calculate_time_midpoints(bts)

    stats = ap.calculate_statistics(array, bpm=152.0)
    tstats = ap.calculate_statistics(array, bpm=mean)
    print("BPM Statistics:", stats)
    print("Target BPM Statistics:", tstats)
