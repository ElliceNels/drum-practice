"""Service layer for practice session management.

Handles all database interactions and business logic for practice sessions.
"""
import logging
from typing import Optional, Tuple
from flask import jsonify

from database.models import Session, get_session
from data_model.statistics import TempoStatistics
from data_model.scores import QualityScores

logger = logging.getLogger(__name__)

SUCCESS_CODE = 200
CREATED_CODE = 201
BAD_REQUEST_CODE = 400
NOT_FOUND_CODE = 404
FORBIDDEN_CODE = 403
INTERNAL_SERVER_ERROR_CODE = 500


def save_practice_session(
    user_id: int,
    file_location: str,
    length_seconds: float,
    stats_data: Optional[TempoStatistics] = None,
    score_data: Optional[Tuple[QualityScores, int, str]] = None
) -> Tuple[dict, int]:
    """Save a new practice session to the database.
    
    Args:
        user_id (int): ID of the user who owns this session
        file_location (str): Path to recorded audio file
        length_seconds (float): Session duration in seconds
        stats_data (TempoStatistics, optional): Statistical data for the session
        score_data (tuple, optional): Tuple of (QualityScores, rank, rank_description)
    
    Returns:
        Tuple[dict, int]: (response_dict, status_code)
    """
    try:
        with get_session() as db:
            # Create session record
            new_session = Session(
                user_id=user_id,
                file_location=file_location,
                length_seconds=length_seconds
            )
            db.add(new_session)
            db.flush()  # Get session ID

            # Add stats if provided
            if stats_data:
                stats = stats_data.to_db_model()
                stats.session_id = new_session.id
                db.add(stats)

            # Add score if provided
            if score_data:
                quality_scores, rank, rank_description = score_data
                score = quality_scores.to_db_model(rank, rank_description)
                score.session_id = new_session.id
                db.add(score)

            db.commit()
            session_id = new_session.id

        logger.info("Practice session %d saved for user %d", session_id, user_id)
        return jsonify({
            "session_id": session_id,
            "message": "Session saved successfully"
        }), CREATED_CODE

    except Exception as e:
        logger.exception("Error saving session for user %d: %s", user_id, e)
        return jsonify({"error": "Internal server error"}), INTERNAL_SERVER_ERROR_CODE


def get_practice_session(session_id: int, user_id: int) -> Tuple[object, int]:
    """Get a specific practice session by ID.
    
    On success, returns (payload, code) where payload is (session, stats_dto, score_dto) and code is SUCCESS_CODE.
    On error, returns (json_error_response, error_code).

    Args:
        session_id (int): The session ID to retrieve
        user_id (int): ID of the requesting user (for ownership validation)
    
    Returns:
        Tuple[object, int]: (payload, status_code)
            Success payload: (Session, Optional[TempoStatistics], Optional[QualityScores])
            Error payload: flask jsonify error response
    """
    try:
        with get_session() as db:
            session = db.query(Session).filter_by(id=session_id).first()

            if not session:
                logger.warning("Session %d not found", session_id)
                return jsonify({"error": "Session not found"}), NOT_FOUND_CODE

            # Check ownership
            if session.user_id != user_id:
                logger.warning("User %d attempted to access session %d owned by user %d",
                             user_id, session_id, session.user_id)
                return jsonify({"error": "Access denied"}), FORBIDDEN_CODE

            # Build DTOs (routes will convert DTOs to dicts)
            stats_dto: Optional[TempoStatistics] = None
            score_dto: Optional[QualityScores] = None

            if session.stats:
                stats_dto = TempoStatistics.from_db_model(session.stats)

            if session.score:
                score_dto = QualityScores.from_db_model(session.score)

            return (session, stats_dto, score_dto), SUCCESS_CODE

    except Exception as e:
        logger.exception("Error retrieving session %d: %s", session_id, e)
        return jsonify({"error": "Internal server error"}), INTERNAL_SERVER_ERROR_CODE


def get_all_practice_sessions(
    user_id: int,
    limit: int = 100,
    offset: int = 0,
    order_by: str = "recorded_at",
    order_dir: str = "desc"
) -> Tuple[object, int]:
    """Get all practice sessions for a user.
    
    On success, returns ((items, total, limit, offset), SUCCESS_CODE) where items is a list of
    (session, stats_dto, score_dto) tuples. On error, returns (json_error_response, error_code).
    
    Args:
        user_id (int): ID of the user
        limit (int): Maximum number of sessions to return
        offset (int): Number of sessions to skip
        order_by (str): Sort field - 'recorded_at' or 'length_seconds'
        order_dir (str): Sort direction - 'asc' or 'desc'
    
    Returns:
        Tuple[object, int]: (payload, status_code)
            Success payload: (items, total, limit, offset)
            Error payload: flask jsonify error response
    """
    try:
        with get_session() as db:
            # Build query
            query = db.query(Session).filter_by(user_id=user_id)

            # Get total count
            total = query.count()

            # Apply ordering
            if order_by == "recorded_at":
                order_column = Session.recorded_at
            elif order_by == "length_seconds":
                order_column = Session.length_seconds
            else:
                order_column = Session.recorded_at  # Default

            if order_dir == "desc":
                query = query.order_by(order_column.desc())
            else:
                query = query.order_by(order_column.asc())

            # Apply pagination
            sessions = query.limit(limit).offset(offset).all()

            # Build list of (session, stats_dto, score_dto)
            items = []
            for session in sessions:
                stats_dto: Optional[TempoStatistics] = None
                score_dto: Optional[QualityScores] = None

                if session.stats:
                    stats_dto = TempoStatistics.from_db_model(session.stats)
                if session.score:
                    score_dto = QualityScores.from_db_model(session.score)

                items.append((session, stats_dto, score_dto))

            return (items, total, limit, offset), SUCCESS_CODE

    except Exception as e:
        logger.exception("Error retrieving sessions for user %d: %s", user_id, e)
        return jsonify({"error": "Internal server error"}), INTERNAL_SERVER_ERROR_CODE


def delete_practice_session(session_id: int, user_id: int) -> Tuple[dict, int]:
    """Delete a specific practice session.
    
    Args:
        session_id (int): The session ID to delete
        user_id (int): ID of the requesting user (for ownership validation)
    
    Returns:
        Tuple[dict, int]: (response_dict, status_code)
    """
    try:
        with get_session() as db:
            session = db.query(Session).filter_by(id=session_id).first()

            if not session:
                logger.warning("Session %d not found", session_id)
                return jsonify({"error": "Session not found"}), NOT_FOUND_CODE

            # Check ownership
            if session.user_id != user_id:
                logger.warning("User %d attempted to delete session %d owned by user %d",
                             user_id, session_id, session.user_id)
                return jsonify({"error": "Access denied"}), FORBIDDEN_CODE

            # Delete session (cascade will handle stats and scores)
            db.delete(session)
            db.commit()

        logger.info("Session %d deleted by user %d", session_id, user_id)
        return jsonify({"message": "Session deleted successfully"}), SUCCESS_CODE

    except Exception as e:
        logger.exception("Error deleting session %d: %s", session_id, e)
        return jsonify({"error": "Internal server error"}), INTERNAL_SERVER_ERROR_CODE
