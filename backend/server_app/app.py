"""Main application module for the Flask app with Socket.IO integration.

This module loads configuration and configures logging on import.
"""
import logging
from flask import Flask
from flask_socketio import SocketIO
from config import config
from logging_config import configure_logging
from server_app.rest_api.routes import placeholder_api
from server_app.socket_api.audio import AudioNamespace

# Configure logging using the module-level config object
configure_logging(config)
logger = logging.getLogger(__name__)
logger.debug("Configuration Loaded: %s", config)

socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode="eventlet",
    max_http_buffer_size=5_000_000,  # allow ~5MB uploads for full WAV payloads
)

def create_app():
    """Create and configure the Flask application."""
    flask_app = Flask(__name__)

    # Register HTTP blueprints, Socket.IO namespaces and handlers
    flask_app.register_blueprint(placeholder_api)
    socketio.on_namespace(AudioNamespace("/audio"))

    socketio.init_app(flask_app)
    logger.debug("Flask app and Socket.IO initialized")
    return flask_app


if __name__ == "__main__":
    app = create_app()
    socketio.run(app, host=config.app.host, port=config.app.port, debug=bool(config.app.debug))
    logger.debug("Starting app on %s:%d", config.app.host, config.app.port)
