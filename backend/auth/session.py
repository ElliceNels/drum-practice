"""Session management for authentication.

Simple session-based authentication
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# In-memory session store
_sessions: dict[str, dict] = {}

SESSION_TIMEOUT_HOURS = 4
UTC = timezone.utc


def create_session(user_id: int) -> str:
    """Create a new session token for a user.
    
    Args:
        user_id (int): The user's ID.
        
    Returns:
        str: A secure session token.
    """
    token = secrets.token_urlsafe(32)
    _sessions[token] = {
        "user_id": user_id,
        "created_at": datetime.now(UTC),
        "expires_at": datetime.now(UTC) + timedelta(hours=SESSION_TIMEOUT_HOURS)
    }
    logger.debug("Session created for user %s", user_id)
    return token


def validate_session(token: str) -> Optional[int]:
    """Validate a session token and return the user ID.
    
    Args:
        token (str): The session token to validate.
        
    Returns:
        Optional[int]: The user ID if valid, None otherwise.
    """
    if token not in _sessions:
        logger.warning("Session validation failed: Token not found")
        return None

    session = _sessions[token]

    # Check if session has expired
    if datetime.now(UTC) > session["expires_at"]:
        logger.warning("Session validation failed: Token expired")
        del _sessions[token]
        return None

    return session["user_id"]


def invalidate_session(token: str) -> bool:
    """Invalidate a session token (logout).
    
    Args:
        token (str): The session token to invalidate.
        
    Returns:
        bool: True if session was invalidated, False if not found.
    """
    if token in _sessions:
        del _sessions[token]
        logger.debug("Session invalidated")
        return True
    return False


def get_current_user_id(token: str) -> Optional[int]:
    """Get the current user ID from a session token.
    
    Args:
        token (str): The session token.
        
    Returns:
        Optional[int]: The user ID if valid session, None otherwise.
    """
    return validate_session(token)
