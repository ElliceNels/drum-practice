"""Data Transfer Objects for statistics and scoring."""

from dataclasses import dataclass
from database.models import Stats


@dataclass
class TempoStatistics:
    """
    Data Transfer Object for tempo stability statistics.
    
    All fields are required.
    
    Attributes:
        target_bpm (float): The intended BPM of the song/performance.
        mean_bpm (float): Mean BPM value of the performance.
        median_bpm (float): Median BPM value of the performance.
        min_bpm (float): Minimum BPM value detected.
        max_bpm (float): Maximum BPM value detected.
        std_dev (float): Standard deviation of BPM values.
        variance_coefficient (float): Coefficient of variation (CV) of BPM.
        percentage_within_threshold (float): Percentage of beats within allowed timing window.
    """
    target_bpm: float
    mean_bpm: float
    median_bpm: float
    min_bpm: float
    max_bpm: float
    std_dev: float
    variance_coefficient: float
    percentage_within_threshold: float

    def to_db_model(self) -> Stats:
        """
        Convert TempoStatistics DTO to Stats database model.
        
        Returns:
            Stats: SQLAlchemy Stats model instance.
        """
        return Stats(
            session_id=-1,  # Placeholder, to be set by the database
            target_bpm=self.target_bpm,
            mean_bpm=self.mean_bpm,
            median_bpm=self.median_bpm,
            min_bpm=self.min_bpm,
            max_bpm=self.max_bpm,
            std_dev=self.std_dev,
            variance_coefficient=self.variance_coefficient,
            percentage_within_threshold=self.percentage_within_threshold
        )

    @staticmethod
    def from_db_model(stats: Stats) -> 'TempoStatistics':
        """
        Convert Stats database model to TempoStatistics DTO.
        
        Args:
            stats (Stats): SQLAlchemy Stats model instance.
            
        Returns:
            TempoStatistics: DTO instance.
        """
        return TempoStatistics(
            target_bpm=stats.target_bpm,
            mean_bpm=stats.mean_bpm,
            median_bpm=stats.median_bpm,
            min_bpm=stats.min_bpm,
            max_bpm=stats.max_bpm,
            std_dev=stats.std_dev,
            variance_coefficient=stats.variance_coefficient,
            percentage_within_threshold=stats.percentage_within_threshold
        )
