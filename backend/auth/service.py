"""Authentication service functions.

Handles user login, signup, password management, and account operations.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

import nacl.pwhash
import nacl.exceptions
from flask import jsonify

from database.models import User, get_session
from auth.session import create_session, validate_session, invalidate_session

logger = logging.getLogger(__name__)
UTC = timezone.utc

SUCCESS_CODE = 200
CREATED_CODE = 201
BAD_REQUEST_CODE = 400
UNAUTHORIZED_CODE = 401
NOT_FOUND_CODE = 404
CONFLICT_CODE = 409

MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 32
ALLOWED_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
MIN_PASSWORD_LENGTH = 8
REQUIRE_UPPERCASE = True
REQUIRE_LOWERCASE = True
REQUIRE_DIGIT = True
REQUIRE_SPECIAL = True
SPECIAL_CHARACTERS = "!@#$%^&*()_+-=[]{}|;:,.<>?"


def hash_password(password: str) -> str:
    """Hash a password using nacl.pwhash.

    Args:
        password (str): The password to hash.

    Returns:
        str: The hashed password as a string.
    """
    if not password:
        raise ValueError("Password must be provided")

    hashed = nacl.pwhash.str(
        password.encode(),
        opslimit=nacl.pwhash.OPSLIMIT_SENSITIVE,
        memlimit=nacl.pwhash.MEMLIMIT_SENSITIVE
    )
    return hashed.decode() if isinstance(hashed, bytes) else hashed


def verify_password(hashed_password: str, password: str) -> bool:
    """Verify a password against a hash.

    Args:
        hashed_password (str): The hashed password to verify against.
        password (str): The password to verify.

    Returns:
        bool: True if the password matches, False otherwise.
    """
    if not hashed_password or not password:
        raise ValueError("Hashed password and password must be provided")

    try:
        hashed_bytes = hashed_password.encode() if isinstance(hashed_password, str) else hashed_password
        return nacl.pwhash.verify(hashed_bytes, password.encode())
    except nacl.exceptions.InvalidkeyError:
        return False


def validate_password(password: str) -> Tuple[bool, str]:
    """Validate password meets complexity requirements.
    
    Args:
        password (str): The password to validate.
        
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        return False, f"Password must be at least {MIN_PASSWORD_LENGTH} characters long"

    if REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"

    if REQUIRE_LOWERCASE and not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"

    if REQUIRE_DIGIT and not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"

    if REQUIRE_SPECIAL and not any(c in SPECIAL_CHARACTERS for c in password):
        return False, f"Password must contain at least one special character from: {SPECIAL_CHARACTERS}"

    return True, ""


def validate_username(username: str) -> Tuple[bool, str]:
    """Validate username meets requirements.
    
    Args:
        username (str): The username to validate.
        
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    if not username or len(username) < MIN_USERNAME_LENGTH:
        return False, f"Username must be at least {MIN_USERNAME_LENGTH} characters long"

    if len(username) > MAX_USERNAME_LENGTH:
        return False, f"Username must not exceed {MAX_USERNAME_LENGTH} characters"

    if not all(c in ALLOWED_CHARS for c in username):
        return False, "Username can only contain letters, numbers, hyphens, and underscores"

    return True, ""


def login(username: str, password: str) -> Tuple[dict, int]:
    """Authenticate user and create a session.

    Args:
        username (str): Username of the user.
        password (str): Password of the user.

    Returns:
        Tuple[dict, int]: (response_dict, status_code) where response_dict contains:
            - On success: {"session_token": str, "user_id": int, "username": str}
            - On error: {"error": str}
    """
    if not username or not password:
        logger.warning("Login failed: Missing required fields")
        return jsonify({"error": "Missing required fields"}), BAD_REQUEST_CODE

    with get_session() as db:
        user: Optional[User] = db.query(User).filter_by(username=username).first()

    if not user:
        logger.warning("Login failed for user %s: User not found", username)
        return jsonify({"error": "User not found"}), NOT_FOUND_CODE

    if not verify_password(user.password_encrypted, password):
        logger.warning("Login failed for user %s: Invalid password", username)
        return jsonify({"error": "Invalid password"}), UNAUTHORIZED_CODE

    session_token = create_session(user.id)
    logger.info("User %s logged in successfully", username)
    return jsonify({
        "session_token": session_token,
        "user_id": user.id,
        "username": user.username
    }), SUCCESS_CODE


def signup(username: str, password: str) -> Tuple[dict, int]:
    """Register a new user and create a session.

    Args:
        username (str): Username for the new user.
        password (str): Password for the new user.

    Returns:
        Tuple[dict, int]: (response_dict, status_code) where response_dict contains:
            - On success: {"session_token": str, "user_id": int, "username": str}
            - On error: {"error": str}
    """
    if not username or not password:
        logger.warning("Sign up failed: Missing required fields")
        return jsonify({"error": "Missing required fields"}), BAD_REQUEST_CODE

    # Validate username
    is_valid, error_msg = validate_username(username)
    if not is_valid:
        logger.warning("Sign up failed: Invalid username - %s", error_msg)
        return jsonify({"error": error_msg}), BAD_REQUEST_CODE

    # Validate password strength
    is_valid, error_msg = validate_password(password)
    if not is_valid:
        logger.warning("Sign up failed for user %s: %s", username, error_msg)
        return jsonify({"error": error_msg}), BAD_REQUEST_CODE

    try:
        with get_session() as db:
            # Check if username already exists
            existing_user = db.query(User).filter_by(username=username).first()
            if existing_user:
                logger.warning("Sign up failed for user %s: Username already exists", username)
                return jsonify({"error": "Username already exists"}), CONFLICT_CODE

            # Create new user
            hashed_password = hash_password(password)
            new_user = User(
                username=username,
                password_encrypted=hashed_password,
                created_at=datetime.now(UTC)
            )

            db.add(new_user)
            db.flush()  # Ensure new_user.id is available
            user_id = new_user.id
            db.commit()
    except Exception as e:
        logger.exception("Error during signup for user %s: %s", username, e)
        return jsonify({"error": "Internal server error"}), 500

    session_token = create_session(user_id)
    logger.info("User %s signed up successfully", username)

    return jsonify({
        "session_token": session_token,
        "user_id": user_id,
        "username": username
    }), CREATED_CODE


def logout(session_token: str) -> Tuple[dict, int]:
    """Log out a user by invalidating their session.

    Args:
        session_token (str): The session token to invalidate.

    Returns:
        Tuple[dict, int]: (response_dict, status_code)
    """
    if not session_token:
        logger.warning("Logout failed: Missing session token")
        return jsonify({"error": "Missing session token"}), BAD_REQUEST_CODE

    if invalidate_session(session_token):
        logger.info("User logged out successfully")
        return jsonify({"message": "Logged out successfully"}), SUCCESS_CODE

    logger.warning("Logout failed: Invalid or expired session token")
    return jsonify({"error": "Invalid or expired session token"}), UNAUTHORIZED_CODE


def get_current_user(session_token: str) -> Tuple[dict, int]:
    """Get current user information from session token.

    Args:
        session_token (str): The session token.

    Returns:
        Tuple[dict, int]: (response_dict, status_code) where response_dict contains:
            - On success: {"user_id": int, "username": str, "created_at": str}
            - On error: {"error": str}
    """
    if not session_token:
        logger.warning("Get current user failed: Missing session token")
        return jsonify({"error": "Missing session token"}), BAD_REQUEST_CODE

    user_id = validate_session(session_token)
    if user_id is None:
        logger.warning("Get current user failed: Invalid or expired session token")
        return jsonify({"error": "Invalid or expired session token"}), UNAUTHORIZED_CODE

    with get_session() as db:
        user: Optional[User] = db.query(User).filter_by(id=user_id).first()

    if not user:
        logger.warning("Get current user failed: User %s not found", user_id)
        return jsonify({"error": "User not found"}), NOT_FOUND_CODE

    return jsonify({
        "user_id": user.id,
        "username": user.username,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }), SUCCESS_CODE


def change_password(session_token: str, current_password: str, new_password: str) -> Tuple[dict, int]:
    """Change the password for a user.

    Args:
        session_token (str): The session token of the authenticated user.
        current_password (str): The user's current password.
        new_password (str): The new password.

    Returns:
        Tuple[dict, int]: (response_dict, status_code)
    """
    if not session_token or not current_password or not new_password:
        logger.warning("Change password failed: Missing required fields")
        return jsonify({"error": "Missing required fields"}), BAD_REQUEST_CODE

    user_id = validate_session(session_token)
    if user_id is None:
        logger.warning("Change password failed: Invalid session token")
        return jsonify({"error": "Invalid or expired session token"}), UNAUTHORIZED_CODE

    try:
        with get_session() as db:
            user: Optional[User] = db.query(User).filter_by(id=user_id).first()

            if not user:
                logger.warning("Change password failed: User %s not found", user_id)
                return jsonify({"error": "User not found"}), NOT_FOUND_CODE

            # Verify current password
            if not verify_password(user.password_encrypted, current_password):
                logger.warning("Change password failed for user %s: Invalid current password", user_id)
                return jsonify({"error": "Invalid current password"}), UNAUTHORIZED_CODE

            # Check if new password is different from current
            if current_password == new_password:
                logger.warning("Change password failed for user %s: New password same as current", user_id)
                return jsonify(
                    {"error": "New password must be different from current password"}
                ), BAD_REQUEST_CODE

            # Validate new password strength
            is_valid, error_msg = validate_password(new_password)
            if not is_valid:
                logger.warning("Change password failed for user %s: %s", user_id, error_msg)
                return jsonify({"error": error_msg}), BAD_REQUEST_CODE

            # Update password
            user.password_encrypted = hash_password(new_password)
            db.commit()
    except Exception as e:
        logger.exception("Error changing password for user %s: %s", user_id, e)
        return jsonify({"error": "Internal server error"}), 500

    logger.info("User %s changed password successfully", user_id)
    return jsonify({"message": "Password changed successfully"}), SUCCESS_CODE


def delete_account(session_token: str, password: str) -> Tuple[dict, int]:
    """Delete a user account and invalidate all their sessions.

    Args:
        session_token (str): The session token of the authenticated user.
        password (str): The user's password for confirmation.

    Returns:
        Tuple[dict, int]: (response_dict, status_code)
    """
    if not session_token or not password:
        logger.warning("Delete account failed: Missing required fields")
        return jsonify({"error": "Missing required fields"}), BAD_REQUEST_CODE

    user_id = validate_session(session_token)
    if user_id is None:
        logger.warning("Delete account failed: Invalid session token")
        return jsonify({"error": "Invalid or expired session token"}), UNAUTHORIZED_CODE

    try:
        with get_session() as db:
            user: Optional[User] = db.query(User).filter_by(id=user_id).first()

            if not user:
                logger.warning("Delete account failed: User %s not found", user_id)
                return jsonify({"error": "User not found"}), NOT_FOUND_CODE

            # Verify password
            if not verify_password(user.password_encrypted, password):
                logger.warning("Delete account failed for user %s: Invalid password", user_id)
                return jsonify({"error": "Invalid password"}), UNAUTHORIZED_CODE

            # Delete user
            db.delete(user)
            db.commit()
    except Exception as e:
        logger.exception("Error deleting account for user %s: %s", user_id, e)
        return jsonify({"error": "Internal server error"}), 500

    # Invalidate session
    invalidate_session(session_token)

    logger.info("User %s deleted account successfully", user_id)
    return jsonify({"message": "Account deleted successfully"}), SUCCESS_CODE
