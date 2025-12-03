"""Main application module for the Flask app with Socket.IO integration."""
from flask import Flask
from flask_socketio import SocketIO

from .rest_api.routes import placeholder_api
from .socket_api.audio import AudioNamespace

socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")

def create_app():
    """Create and configure the Flask application."""
    flask_app = Flask(__name__)

    # Register HTTP blueprints, Socket.IO namespaces and handlers
    flask_app.register_blueprint(placeholder_api)
    socketio.on_namespace(AudioNamespace("/audio"))

    socketio.init_app(flask_app)
    return flask_app


if __name__ == "__main__":
    app = create_app()
    socketio.run(app, debug=True)
