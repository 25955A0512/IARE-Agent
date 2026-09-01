"""
seed_db.py — Seeds the database with campus graph and faculty timetable data.

Usage (from the /backend directory):
    python scripts/seed_db.py

Safe to re-run — performs upserts, won't create duplicates.
"""

import asyncio
import json
import sys
from pathlib import Path

# Allow imports from the backend root
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import AsyncSessionLocal, create_all_tables
from models import CampusEdge, CampusNode, Faculty, FacultySchedule
from sqlalchemy import select


DATA_DIR = Path(__file__).parent.parent / "data"


async def seed_campus_graph(session) -> None:
    """Load campus_graph.json and upsert nodes + edges into the database."""
    graph_path = DATA_DIR / "campus_graph.json"
    with open(graph_path, encoding="utf-8") as f:
        data = json.load(f)

    print("Seeding campus nodes...")
    node_id_map: dict[int, int] = {}  # seed id → DB id

    for node_data in data["nodes"]:
        seed_id = node_data["id"]
        # Check if node already exists by name
        result = await session.execute(
            select(CampusNode).where(CampusNode.name == node_data["name"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.aliases = node_data.get("aliases")
            existing.x_coord = node_data.get("x_coord")
            existing.y_coord = node_data.get("y_coord")
            existing.description = node_data.get("description")
            db_node = existing
        else:
            db_node = CampusNode(
                name=node_data["name"],
                aliases=node_data.get("aliases"),
                x_coord=node_data.get("x_coord"),
                y_coord=node_data.get("y_coord"),
                description=node_data.get("description"),
            )
            session.add(db_node)
            await session.flush()  # get the auto-generated DB id

        node_id_map[seed_id] = db_node.id
        print(f"  ✓ Node: {node_data['name']}")

    await session.commit()

    print("Seeding campus edges...")
    for edge_data in data["edges"]:
        source_db_id = node_id_map[edge_data["source"]]
        target_db_id = node_id_map[edge_data["target"]]

        # Check if edge already exists
        result = await session.execute(
            select(CampusEdge).where(
                CampusEdge.source_id == source_db_id,
                CampusEdge.target_id == target_db_id,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.distance_meters = edge_data["distance_meters"]
            existing.step_hint = edge_data.get("step_hint")
        else:
            edge = CampusEdge(
                source_id=source_db_id,
                target_id=target_db_id,
                distance_meters=edge_data["distance_meters"],
                step_hint=edge_data.get("step_hint"),
            )
            session.add(edge)
            print(f"  ✓ Edge: node {source_db_id} → node {target_db_id} ({edge_data['distance_meters']}m)")

    await session.commit()
    print(f"Campus graph seeded: {len(data['nodes'])} nodes, {len(data['edges'])} edges.\n")


async def seed_faculty(session) -> None:
    """Load faculty_timetable.json and upsert faculty + schedule into the database."""
    timetable_path = DATA_DIR / "faculty_timetable.json"
    with open(timetable_path, encoding="utf-8") as f:
        data = json.load(f)

    print("Seeding faculty...")
    for fac_data in data["faculty"]:
        # Upsert faculty by name
        result = await session.execute(
            select(Faculty).where(Faculty.name == fac_data["name"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.aliases = fac_data.get("aliases")
            existing.department = fac_data.get("department")
            existing.cabin_location = fac_data.get("cabin_location")
            existing.email = fac_data.get("email")
            faculty = existing
            # Remove old schedule entries so we can re-insert cleanly
            for old_slot in list(faculty.schedule):
                await session.delete(old_slot)
            await session.flush()
        else:
            faculty = Faculty(
                name=fac_data["name"],
                aliases=fac_data.get("aliases"),
                department=fac_data.get("department"),
                cabin_location=fac_data.get("cabin_location"),
                email=fac_data.get("email"),
            )
            session.add(faculty)
            await session.flush()

        print(f"  ✓ Faculty: {fac_data['name']}")

        for slot in fac_data.get("schedule", []):
            schedule_entry = FacultySchedule(
                faculty_id=faculty.id,
                day_of_week=slot["day_of_week"],
                time_slot_start=slot["time_slot_start"],
                time_slot_end=slot["time_slot_end"],
                room=slot["room"],
                subject=slot.get("subject"),
            )
            session.add(schedule_entry)

    await session.commit()
    print(f"Faculty seeded: {len(data['faculty'])} members.\n")


async def main() -> None:
    """Entry point: create tables then seed all data."""
    print("=== IARE Agent — Database Seeder ===\n")
    await create_all_tables()

    async with AsyncSessionLocal() as session:
        await seed_campus_graph(session)
        await seed_faculty(session)

    print("=== Seeding complete ===")


if __name__ == "__main__":
    asyncio.run(main())
