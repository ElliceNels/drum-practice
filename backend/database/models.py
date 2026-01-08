"""SQLAlchemy models and session management for the drum practice app."""

from __future__ import annotations
import logging

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    create_engine
)
from sqlalchemy.orm import declarative_base, relationship, scoped_session, sessionmaker

from config import config

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = Path(__file__).resolve().parent / config.database.name
DATABASE_URL = os.getenv("DATABASE_URL", config.database.url or f"sqlite:///{DEFAULT_DB_PATH}")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith(
    "sqlite") else {}
engine = create_engine(DATABASE_URL, future=True,
                       echo=False, connect_args=connect_args)
SessionLocal = scoped_session(
    sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
)  # Manual transaction control

Base = declarative_base()


class User(Base):
    """User model representing application users."""
    __tablename__ = "users"

    id = Column("user_id", Integer, primary_key=True, autoincrement=True)
    username = Column(String(128), unique=True, nullable=False, index=True)
    password_encrypted = Column(String(256), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(
        timezone.utc), nullable=False)

    sessions = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}')>"


class Session(Base):
    """Session model representing a drum practice session."""
    __tablename__ = "sessions"

    id = Column("session_id", Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"),
                     nullable=False, index=True)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(
        timezone.utc), nullable=False)
    file_location = Column(String(512))
    length_seconds = Column(Float)

    user = relationship("User", back_populates="sessions")
    stats = relationship("Stats", back_populates="session",
                         uselist=False, cascade="all, delete-orphan")
    score = relationship("Score", back_populates="session",
                         uselist=False, cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Session(id={self.id}, user_id={self.user_id}, recorded_at={self.recorded_at})>"


class Stats(Base):
    """Stats model representing computed statistics for a session."""
    __tablename__ = "stats"

    session_id = Column(Integer, ForeignKey(
        "sessions.session_id"), primary_key=True)
    target_bpm = Column(Float)
    mean_bpm = Column(Float)
    std_dev = Column(Float)
    min_bpm = Column(Float)
    max_bpm = Column(Float)
    median_bpm = Column(Float)
    coeff_variation = Column(Float)

    session = relationship("Session", back_populates="stats")

    def __repr__(self) -> str:
        return f"<Stats(session_id={self.session_id}, mean_bpm={self.mean_bpm}, target_bpm={self.target_bpm})>"


class Score(Base):
    """Score model representing computed scores for a session."""
    __tablename__ = "scores"

    session_id = Column(Integer, ForeignKey(
        "sessions.session_id"), primary_key=True)
    accuracy = Column(Float)
    stability = Column(Float)
    consistency = Column(Float)
    threshold = Column(Float)
    rank = Column(Integer)
    rank_description = Column(String(256))

    session = relationship("Session", back_populates="score")

    def __repr__(self) -> str:
        return f"<Score(session_id={self.session_id}, rank={self.rank}, accuracy={self.accuracy})>"


def init_db() -> None:
    """Create database tables if they do not exist."""
    logger.debug("Initializing database and creating tables if not exist")
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized")


def get_session() -> Generator:
    """Provide a transactional scope around a series of operations."""
    session = SessionLocal()
    logger.debug("New database session created")
    try:
        yield session
    finally:
        logger.debug("Closing a database session")
        session.close()
