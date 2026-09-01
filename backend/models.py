"""
models.py — SQLAlchemy ORM models for IARE Agent.

Tables:
  - campus_nodes    : landmarks / locations on campus
  - campus_edges    : walkable paths between nodes (undirected, weighted)
  - faculty         : staff members with cabin location
  - faculty_schedule: weekly class timetable entries
"""

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class CampusNode(Base):
    """A named location on the IARE campus (building, gate, facility)."""

    __tablename__ = "campus_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    # Comma-separated alternative names / abbreviations for fuzzy matching
    aliases: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Relative grid coordinates (for potential map rendering later)
    x_coord: Mapped[float | None] = mapped_column(Float, nullable=True)
    y_coord: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    edges_from: Mapped[list["CampusEdge"]] = relationship(
        "CampusEdge", foreign_keys="CampusEdge.source_id", back_populates="source_node"
    )
    edges_to: Mapped[list["CampusEdge"]] = relationship(
        "CampusEdge", foreign_keys="CampusEdge.target_id", back_populates="target_node"
    )

    def __repr__(self) -> str:
        return f"<CampusNode id={self.id} name={self.name!r}>"


class CampusEdge(Base):
    """A walkable path between two campus nodes (stored as directed; graph logic makes it undirected)."""

    __tablename__ = "campus_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("campus_nodes.id"), nullable=False)
    target_id: Mapped[int] = mapped_column(Integer, ForeignKey("campus_nodes.id"), nullable=False)
    distance_meters: Mapped[float] = mapped_column(Float, nullable=False)
    # Human-readable landmark cue for the step (e.g., "Turn left past the fountain")
    step_hint: Mapped[str | None] = mapped_column(Text, nullable=True)

    source_node: Mapped["CampusNode"] = relationship(
        "CampusNode", foreign_keys=[source_id], back_populates="edges_from"
    )
    target_node: Mapped["CampusNode"] = relationship(
        "CampusNode", foreign_keys=[target_id], back_populates="edges_to"
    )

    def __repr__(self) -> str:
        return f"<CampusEdge {self.source_id}→{self.target_id} {self.distance_meters}m>"


class Faculty(Base):
    """A faculty member at IARE."""

    __tablename__ = "faculty"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Alternative name spellings for fuzzy matching (comma-separated)
    aliases: Mapped[str | None] = mapped_column(Text, nullable=True)
    department: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cabin_location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)

    schedule: Mapped[list["FacultySchedule"]] = relationship(
        "FacultySchedule", back_populates="faculty", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Faculty id={self.id} name={self.name!r}>"


class FacultySchedule(Base):
    """A single weekly timetable slot for a faculty member."""

    __tablename__ = "faculty_schedule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    faculty_id: Mapped[int] = mapped_column(Integer, ForeignKey("faculty.id"), nullable=False)
    # 0=Monday … 5=Saturday (Sunday is off)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    # 24-hour clock strings, e.g. "09:00", "10:50"
    time_slot_start: Mapped[str] = mapped_column(String(5), nullable=False)
    time_slot_end: Mapped[str] = mapped_column(String(5), nullable=False)
    room: Mapped[str] = mapped_column(String(80), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(120), nullable=True)

    faculty: Mapped["Faculty"] = relationship("Faculty", back_populates="schedule")

    def __repr__(self) -> str:
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        day_str = days[self.day_of_week] if 0 <= self.day_of_week <= 5 else "?"
        return (
            f"<FacultySchedule faculty_id={self.faculty_id} "
            f"{day_str} {self.time_slot_start}-{self.time_slot_end} {self.room!r}>"
        )
