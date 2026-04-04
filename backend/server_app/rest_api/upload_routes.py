"""Module defining file upload REST API routes for offline analysis."""
import logging
import tempfile
import os
from dataclasses import asdict
from flask import Blueprint, request, jsonify

from auth.session import validate_session
from audio_processing.offline import OfflineAudioProcessor

logger = logging.getLogger(__name__)

upload_api = Blueprint("upload_api", __name__, url_prefix="/upload")

ALLOWED_EXTENSIONS = {"wav", "mp3", "mp4", "m4a", "ogg", "flac", "mov"}
MAX_FILE_SIZE = 600 * 1024 * 1024  # 600MB


def get_bearer_token() -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return ""


def require_auth():
    session_token = get_bearer_token()
    if not session_token:
        return None, (jsonify({"error": "Missing session token"}), 401)
    user_id = validate_session(session_token)
    if user_id is None:
        return None, (jsonify({"error": "Invalid or expired session token"}), 401)
    return user_id, None


@upload_api.post("/analyze")
def analyze_upload():
    """Upload an audio file for offline analysis.

    Accepts multipart/form-data with:
        - file: audio file (wav, mp3, mp4, m4a, ogg, flac)
        - target_bpm (optional): target BPM for match-tempo mode

    Returns:
        - 200: { rank, description, scores, stats, bpm_timeline }
        - 400: { error }
        - 401: { error }
    """
    user_id, error = require_auth()
    if error:
        return error

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]

    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    # Check extension
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({
            "error": f"Unsupported format. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        }), 400

    try:
        audio_bytes = file.read()

        if len(audio_bytes) > MAX_FILE_SIZE:
            return jsonify({"error": "File too large (max 600MB)"}), 400

        # Parse optional target BPM
        target_bpm = request.form.get("target_bpm")
        if target_bpm is not None:
            try:
                target_bpm = float(target_bpm)
            except ValueError:
                return jsonify({"error": "target_bpm must be a number"}), 400

        processor = OfflineAudioProcessor()

        logger.info("[UPLOAD] Processing uploaded file: %s (%d bytes)", file.filename, len(audio_bytes))

        # Write to temp file so audioread can use system decoders for non-WAV formats (MOV, MP4, etc.)
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}")
        try:
            tmp.write(audio_bytes)
            tmp.close()
            audio_data = processor.load_audio(tmp.name)
        finally:
            os.unlink(tmp.name)
        beats, downbeats = processor.analyze_audio(audio_data)

        bpm_arr, time_mids = processor.calculate_bpm_array(beats, target_bpm=target_bpm)

        if target_bpm is None:
            target_bpm = float(bpm_arr.mean())

        stats = processor.calculate_statistics(bpm_arr, target_bpm)
        scores = processor.calculate_scores(
            mean_bpm=stats.mean_bpm,
            std_dev=stats.std_dev,
            cv=stats.variance_coefficient,
            percentage=stats.percentage_within_threshold,
            target_bpm=stats.target_bpm
        )
        rank_num, rank_desc = processor.scores_to_rank(
            accuracy=scores.accuracy,
            stability=scores.stability,
            consistency=scores.consistency,
            threshold=scores.threshold
        )

        logger.info("[UPLOAD] Analysis complete - Rank: %d, Description: %s", rank_num, rank_desc)

        return jsonify({
            "rank": rank_num,
            "description": rank_desc,
            "scores": asdict(scores),
            "stats": asdict(stats),
            "bpm_timeline": {
                "bpm_array": bpm_arr.tolist(),
                "time_midpoints": time_mids.tolist(),
            },
        }), 200

    except Exception:
        logger.exception("[UPLOAD] Error processing file")
        return jsonify({"error": "Analysis failed"}), 500
