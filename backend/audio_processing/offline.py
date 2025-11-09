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
            file_path (str): Path to the audio file.
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
        inst_bpm_array: np.ndarray = SECONDS_IN_MINUTE / ibi
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

# Example usage
if __name__ == "__main__":
    AUDIO_PATH = "..\\test_audio_files\\guns_n_ships.wav"
    ap = OfflineAudioProcessor()
    data = ap.load_audio(AUDIO_PATH)
    bts, dbs = ap.analyze_audio(data)
    mean = ap.calculate_mean_tempo(bts)
    array = ap.calculate_bpm_array(bts)
    time_mids = ap.calculate_time_midpoints(bts)
