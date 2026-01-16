"""Data Transfer Objects for quality scores."""

from dataclasses import dataclass
from database.models import Score


@dataclass
class QualityScores:
    """
    Data Transfer Object for tempo quality scores.
    
    All fields are required.
    Each score is a normalized value between 0 and 1, where 0 is bad and 1 is excellent.
    
    Attributes:
        accuracy (float): Accuracy score based on BPM error relative to target tempo.
        stability (float): Stability score based on standard deviation of BPM.
        consistency (float): Consistency score based on coefficient of variation.
        threshold (float): Percentage of beats within allowed timing window (0-1).
    """
    accuracy: float
    stability: float
    consistency: float
    threshold: float

    def to_db_model(
        self,
        rank: int,
        rank_description: str
    ) -> Score:
        """
        Convert QualityScores DTO to Score database model.
        
        Args:
            rank (int): The performance rank (1-10).
            rank_description (str): Description of the skill tier.
            
        Returns:
            Score: SQLAlchemy Score model instance.
        """
        return Score(
            session_id=-1,  # Placeholder, to be set by the database
            accuracy=self.accuracy,
            stability=self.stability,
            consistency=self.consistency,
            threshold=self.threshold,
            rank=rank,
            rank_description=rank_description
        )

    @staticmethod
    def from_db_model(score: Score) -> 'QualityScores':
        """
        Convert Score database model to QualityScores DTO.
        
        Args:
            score (Score): SQLAlchemy Score model instance.
            
        Returns:
            QualityScores: DTO instance.
        """
        return QualityScores(
            accuracy=score.accuracy,
            stability=score.stability,
            consistency=score.consistency,
            threshold=score.threshold
        )
