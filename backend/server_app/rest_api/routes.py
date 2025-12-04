"""Module defining placeholder REST API routes."""
from flask import Blueprint, jsonify

placeholder_api = Blueprint("placeholder_api", __name__, url_prefix="/placeholder")

@placeholder_api.get("/test")
def test():
    """A test endpoint that returns a simple JSON response."""
    return jsonify({"passed": True})
