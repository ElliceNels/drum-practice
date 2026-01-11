"""Data Transfer Objects for quality scores."""

from dataclasses import dataclass


@dataclass
class QualityScores:
    """
    Data Transfer Object for tempo quality scores.
    
    Each score is a normalized value between 0 and 1, where 0 is bad and 1 is excellent.
    
    Attributes:
        accuracy_score (float): Accuracy score based on BPM error relative to target tempo.
        stability_score (float): Stability score based on standard deviation of BPM.
        consistency_score (float): Consistency score based on coefficient of variation.
        threshold_score (float): Percentage of beats within allowed timing window (0-1).
    """
    accuracy: float
    stability: float
    consistency: float
    threshold: float
