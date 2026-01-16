"""Module defining practice session REST API routes."""
import logging
from flask import Blueprint, request, jsonify

from auth.session import validate_session
from practice_sessions.service import (
    save_practice_session,
    get_practice_session,
    get_all_practice_sessions,
    delete_practice_session
)
from data_model.statistics import TempoStatistics
from data_model.scores import QualityScores
from dataclasses import asdict

logger = logging.getLogger(__name__)

session_api = Blueprint("session_api", __name__, url_prefix="/sessions")

SUCCESS_CODE = 200
BAD_REQUEST_CODE = 400
UNAUTHORIZED_CODE = 401

DEFAULT_QUERY_LIMIT = 100
MAX_QUERY_LIMIT = 1000


def get_bearer_token() -> str:
    """Extract Bearer token from Authorization header.
    
    Returns:
        str: The token if present, empty string otherwise.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return ""


def require_auth():
    """Validate session token and return user_id.
    
    Returns:
        tuple: (user_id: int, None) on success, (None, error_response) on failure
    """
    session_token = get_bearer_token()
    if not session_token:
        logger.warning("Auth failed: Missing session token")
        return None, (jsonify({"error": "Missing session token"}), UNAUTHORIZED_CODE)

    user_id = validate_session(session_token)
    if user_id is None:
        logger.warning("Auth failed: Invalid or expired session token")
        return None, (jsonify({"error": "Invalid or expired session token"}), UNAUTHORIZED_CODE)

    return user_id, None


@session_api.post("")
def save_session():
    """Save a new practice session.
    
    Expected Header:
        - Authorization: Bearer <session_token>
    
    Expected JSON:
        - file_location (str, required): Path to recorded audio file
        - length_seconds (float, required): Session duration
        - stats (dict, optional): Statistical data
            - target_bpm (float)
            - mean_bpm (float)
            - std_dev (float)
            - min_bpm (float)
            - max_bpm (float)
            - median_bpm (float)
            - variance_coefficient (float)
            - percentage_within_threshold (float)
        - score (dict, optional): Scoring data
            - accuracy (float)
            - stability (float)
            - consistency (float)
            - threshold (float)
            - rank (int)
            - rank_description (str)
    
    Returns:
        - 201: {"session_id": int, "message": str}
        - 400: {"error": str}
        - 401: {"error": str}
        - 500: {"error": str}
    """
    user_id, error = require_auth()
    if error:
        return error

    data = request.get_json() or {}

    # Validate required fields
    file_location = data.get("file_location")
    length_seconds = data.get("length_seconds")

    if not file_location:
        return jsonify({"error": "file_location is required"}), BAD_REQUEST_CODE

    if length_seconds is None:
        return jsonify({"error": "length_seconds is required"}), BAD_REQUEST_CODE

    try:
        length_seconds = float(length_seconds)
    except (ValueError, TypeError):
        return jsonify({"error": "length_seconds must be a number"}), BAD_REQUEST_CODE

    # Convert stats dict to TempoStatistics DTO if provided
    stats_data = None
    if "stats" in data:
        try:
            stats_dict = data["stats"]
            required_stats_fields = [
                "target_bpm", "mean_bpm", "median_bpm", "min_bpm", "max_bpm",
                "std_dev", "variance_coefficient", "percentage_within_threshold"
            ]
            missing_fields = [f for f in required_stats_fields if f not in stats_dict]
            if missing_fields:
                return jsonify({"error": f"Missing required stats fields: {', '.join(missing_fields)}"}), BAD_REQUEST_CODE
            
            stats_data = TempoStatistics(
                target_bpm=stats_dict["target_bpm"],
                mean_bpm=stats_dict["mean_bpm"],
                median_bpm=stats_dict["median_bpm"],
                min_bpm=stats_dict["min_bpm"],
                max_bpm=stats_dict["max_bpm"],
                std_dev=stats_dict["std_dev"],
                variance_coefficient=stats_dict["variance_coefficient"],
                percentage_within_threshold=stats_dict["percentage_within_threshold"]
            )
        except (TypeError, KeyError) as e:
            return jsonify({"error": f"Invalid stats format: {str(e)}"}), BAD_REQUEST_CODE

    # Convert score dict to QualityScores DTO if provided
    score_data = None
    if "score" in data:
        try:
            score_dict = data["score"]
            required_score_fields = ["accuracy", "stability", "consistency", "threshold", "rank", "rank_description"]
            missing_fields = [f for f in required_score_fields if f not in score_dict]
            if missing_fields:
                return jsonify({"error": f"Missing required score fields: {', '.join(missing_fields)}"}), BAD_REQUEST_CODE
            
            quality_scores = QualityScores(
                accuracy=score_dict["accuracy"],
                stability=score_dict["stability"],
                consistency=score_dict["consistency"],
                threshold=score_dict["threshold"]
            )
            rank = score_dict["rank"]
            rank_description = score_dict["rank_description"]
            score_data = (quality_scores, rank, rank_description)
        except (TypeError, KeyError) as e:
            return jsonify({"error": f"Invalid score format: {str(e)}"}), BAD_REQUEST_CODE

    return save_practice_session(
        user_id=user_id,
        file_location=file_location,
        length_seconds=length_seconds,
        stats_data=stats_data,
        score_data=score_data
    )


@session_api.get("/<int:session_id>")
def get_session(session_id: int):
    """Get a specific practice session by ID.
    
    Expected Header:
        - Authorization: Bearer <session_token>
    
    URL Parameters:
        - session_id (int): The session ID to retrieve
    
    Returns:
        - 200: {
            "session_id": int,
            "user_id": int,
            "recorded_at": str,
            "file_location": str,
            "length_seconds": float,
            "stats": {...},
            "score": {...}
        }
        - 401: {"error": str}
        - 403: {"error": str}
        - 404: {"error": str}
    """
    user_id, error = require_auth()
    if error:
        return error

    session_data, code = get_practice_session(session_id, user_id)
    if code != SUCCESS_CODE:
        return session_data, code

    result, stats_dto, score_dto = session_data
    session = result

    response = {
        "session_id": session.id,
        "user_id": session.user_id,
        "recorded_at": session.recorded_at.isoformat() if session.recorded_at else None,
        "file_location": session.file_location,
        "length_seconds": session.length_seconds
    }

    if stats_dto:
        response["stats"] = asdict(stats_dto)

    if score_dto and session.score:
        score_dict = asdict(score_dto)
        score_dict["rank"] = session.score.rank
        score_dict["rank_description"] = session.score.rank_description
        response["score"] = score_dict

    return jsonify(response), SUCCESS_CODE


@session_api.get("")
def get_all_sessions():
    """Get all practice sessions for the authenticated user.
    
    Expected Header:
        - Authorization: Bearer <session_token>
    
    Query Parameters:
        - limit (int, optional): Maximum number of sessions to return (default: 100)
        - offset (int, optional): Number of sessions to skip (default: 0)
        - order_by (str, optional): Sort field - 'recorded_at' or 'length_seconds' (default: 'recorded_at')
        - order_dir (str, optional): Sort direction - 'asc' or 'desc' (default: 'desc')
    
    Returns:
        - 200: {
            "sessions": [...],
            "total": int,
            "limit": int,
            "offset": int
        }
        - 400: {"error": str}
        - 401: {"error": str}
    """
    user_id, error = require_auth()
    if error:
        return error

    # Parse query parameters
    try:
        limit = min(int(request.args.get("limit", DEFAULT_QUERY_LIMIT)), MAX_QUERY_LIMIT)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        return jsonify({"error": "Invalid limit or offset parameter"}), BAD_REQUEST_CODE

    order_by = request.args.get("order_by", "recorded_at")
    order_dir = request.args.get("order_dir", "desc").lower()

    if order_by not in ["recorded_at", "length_seconds"]:
        return jsonify({"error": "Invalid order_by parameter"}), BAD_REQUEST_CODE

    if order_dir not in ["asc", "desc"]:
        return jsonify({"error": "Invalid order_dir parameter"}), BAD_REQUEST_CODE

    result, code = get_all_practice_sessions(
        user_id, limit, offset, order_by, order_dir
    )
    
    if code != SUCCESS_CODE:
        return result, code
    
    items, total, limit, offset = result

    sessions_list = []
    for session, stats_dto, score_dto in items:
        session_data = {
            "session_id": session.id,
            "recorded_at": session.recorded_at.isoformat() if session.recorded_at else None,
            "file_location": session.file_location,
            "length_seconds": session.length_seconds
        }

        if stats_dto:
            stats = asdict(stats_dto)
            session_data["stats_summary"] = {
                "mean_bpm": stats.get("mean_bpm"),
                "target_bpm": stats.get("target_bpm")
            }

        if score_dto and session.score:
            score = asdict(score_dto)
            session_data["score_summary"] = {
                "rank": session.score.rank,
                "rank_description": session.score.rank_description,
                "accuracy": score.get("accuracy")
            }

        sessions_list.append(session_data)

    return jsonify({
        "sessions": sessions_list,
        "total": total,
        "limit": limit,
        "offset": offset
    }), SUCCESS_CODE


@session_api.delete("/<int:session_id>")
def delete_session(session_id: int):
    """Delete a specific practice session.
    
    Expected Header:
        - Authorization: Bearer <session_token>
    
    URL Parameters:
        - session_id (int): The session ID to delete
    
    Returns:
        - 200: {"message": str}
        - 401: {"error": str}
        - 403: {"error": str}
        - 404: {"error": str}
    """
    user_id, error = require_auth()
    if error:
        return error

    return delete_practice_session(session_id, user_id)
