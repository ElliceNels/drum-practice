"""Data Transfer Objects for statistics and scoring."""

from dataclasses import dataclass


@dataclass
class TempoStatistics:
    """
    Data Transfer Object for tempo stability statistics.
    
    Attributes:
        target_bpm (float): The intended BPM of the song/performance.
        mean_bpm (float): Mean BPM value of the performance.
        median_bpm (float): Median BPM value of the performance.
        bpm_min (float): Minimum BPM value detected.
        bpm_max (float): Maximum BPM value detected.
        std_dev (float): Standard deviation of BPM values.
        variance_coefficient (float): Coefficient of variation (CV) of BPM.
        percentage_within_threshold (float): Percentage of beats within allowed timing window.
    """
    target_bpm: float
    mean_bpm: float
    median_bpm: float
    bpm_min: float
    bpm_max: float
    std_dev: float
    variance_coefficient: float
    percentage_within_threshold: float
