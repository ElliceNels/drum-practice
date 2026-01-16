"""Module defining authentication REST API routes."""
import logging
from flask import Blueprint, request

from auth.service import (
    login as auth_login,
    signup as auth_signup,
    logout as auth_logout,
    get_current_user as auth_get_current_user,
    change_password as auth_change_password,
    delete_account as auth_delete_account
)

logger = logging.getLogger(__name__)

auth_api = Blueprint("auth_api", __name__, url_prefix="/auth")


def get_bearer_token() -> str:
    """Extract Bearer token from Authorization header.
    
    Returns:
        str: The token if present, empty string otherwise.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return ""


@auth_api.post("/login")
def login():
    """Handle user login.
    
    Expected JSON:
        - username (str): Username
        - password (str): Password
    
    Returns:
        - 200: {"session_token": str, "user_id": int, "username": str}
        - 400: {"error": str}
        - 401: {"error": str}
        - 404: {"error": str}
    """
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    return auth_login(username, password)


@auth_api.post("/logout")
def logout():
    """Handle user logout.
    
    Expected Header:
        - Authorization: Bearer <session_token>
    
    Returns:
        - 200: {"message": str}
        - 400: {"error": str}
        - 401: {"error": str}
    """
    session_token = get_bearer_token()
    return auth_logout(session_token)


@auth_api.post("/signup")
def signup():
    """Handle user signup.
    
    Expected JSON:
        - username (str): Username
        - password (str): Password
    
    Returns:
        - 201: {"session_token": str, "user_id": int, "username": str}
        - 400: {"error": str}
        - 409: {"error": str}
    """
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    return auth_signup(username, password)


@auth_api.get("/current_user")
def current_user():
    """Get the current logged-in user.
    
    Expected Header:
        - Authorization: Bearer <session_token>
    
    Returns:
        - 200: {"user_id": int, "username": str, "created_at": str}
        - 400: {"error": str}
        - 401: {"error": str}
        - 404: {"error": str}
    """
    session_token = get_bearer_token()
    return auth_get_current_user(session_token)


@auth_api.post("/change_password")
def change_password():
    """Handle password change.
    
    Expected Header:
        - Authorization: Bearer <session_token>
    
    Expected JSON:
        - current_password (str): Current password
        - new_password (str): New password
    
    Returns:
        - 200: {"message": str}
        - 400: {"error": str}
        - 401: {"error": str}
        - 404: {"error": str}
    """
    session_token = get_bearer_token()
    data = request.get_json() or {}
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    return auth_change_password(session_token, current_password, new_password)


@auth_api.post("/delete_account")
def delete_account():
    """Handle account deletion.
    
    Expected Header:
        - Authorization: Bearer <session_token>
    
    Expected JSON:
        - password (str): Password for confirmation
    
    Returns:
        - 200: {"message": str}
        - 400: {"error": str}
        - 401: {"error": str}
        - 404: {"error": str}
    """
    session_token = get_bearer_token()
    data = request.get_json() or {}
    password = data.get("password", "")

    return auth_delete_account(session_token, password)
