"""
navigation_agent.py — Campus Navigation Agent for IARE Agent.

Given a natural-language query, identifies source and destination campus nodes,
computes the shortest walkable path using Dijkstra's algorithm (via NetworkX),
and returns clear step-by-step text directions.

Key behaviours:
  - Fuzzy-matches location names (handles typos, abbreviations).
  - Defaults source to "Main Gate" if none is mentioned, and says so.
  - Returns a structured NavigationResult with an ordered stop list and
    human-readable directions text.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import networkx as nx
from rapidfuzz import fuzz, process as fuzz_process

logger = logging.getLogger(__name__)

# ── Data types ────────────────────────────────────────────────────────────────

@dataclass
class NavigationStep:
    """A single step along a navigation route."""
    step_number: int
    from_node: str
    to_node: str
    distance_meters: float
    hint: str


@dataclass
class NavigationResult:
    """Full result returned by the navigation agent."""
    success: bool
    source: str
    destination: str
    total_distance_meters: float
    steps: list[NavigationStep] = field(default_factory=list)
    directions_text: str = ""
    error_message: str = ""
    defaulted_source: bool = False   # True if source was defaulted to Main Gate


# ── Campus graph (loaded once at startup) ────────────────────────────────────

class CampusGraph:
    """In-memory campus graph backed by NetworkX. Thread-safe for reads."""

    def __init__(self) -> None:
        self._graph: nx.Graph = nx.Graph()
        # node_name → node metadata dict
        self._nodes: dict[str, dict] = {}
        # flat list of (canonical_name, alias) for fuzzy matching
        self._name_index: list[tuple[str, str]] = []
        self._loaded = False

    def load_from_json(self, json_path: Path) -> None:
        """Load nodes and edges from the campus_graph.json seed file."""
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)

        # Build id → name map first
        id_to_name: dict[int, str] = {}
        for node in data["nodes"]:
            node_id = node["id"]
            name = node["name"]
            id_to_name[node_id] = name
            self._nodes[name] = node
            self._graph.add_node(name, **node)

            # Register canonical name for fuzzy matching
            self._name_index.append((name, name.lower()))
            # Register each alias
            for alias in (node.get("aliases") or "").split(","):
                alias = alias.strip()
                if alias:
                    self._name_index.append((name, alias.lower()))

        for edge in data["edges"]:
            src = id_to_name[edge["source"]]
            tgt = id_to_name[edge["target"]]
            dist = edge["distance_meters"]
            hint = edge.get("step_hint", "")
            # Undirected graph — add both directions with the same hint
            self._graph.add_edge(src, tgt, weight=dist, hint=hint)

        self._loaded = True
        logger.info(
            "Campus graph loaded: %d nodes, %d edges",
            self._graph.number_of_nodes(),
            self._graph.number_of_edges(),
        )

    def load_from_db_rows(
        self,
        nodes: list,
        edges: list,
    ) -> None:
        """Load from SQLAlchemy ORM objects (alternative to JSON)."""
        id_to_name: dict[int, str] = {}
        for node in nodes:
            id_to_name[node.id] = node.name
            self._nodes[node.name] = {
                "name": node.name,
                "aliases": node.aliases or "",
                "x_coord": node.x_coord,
                "y_coord": node.y_coord,
                "description": node.description or "",
            }
            self._graph.add_node(node.name)
            self._name_index.append((node.name, node.name.lower()))
            for alias in (node.aliases or "").split(","):
                alias = alias.strip()
                if alias:
                    self._name_index.append((node.name, alias.lower()))

        for edge in edges:
            src = id_to_name.get(edge.source_id)
            tgt = id_to_name.get(edge.target_id)
            if src and tgt:
                self._graph.add_edge(
                    src, tgt,
                    weight=edge.distance_meters,
                    hint=edge.step_hint or "",
                )
        self._loaded = True
        logger.info(
            "Campus graph loaded from DB: %d nodes, %d edges",
            self._graph.number_of_nodes(),
            self._graph.number_of_edges(),
        )

    def fuzzy_match_node(self, query: str, threshold: int = 60) -> Optional[str]:
        """
        Return the canonical node name that best matches *query*, or None if
        no match exceeds *threshold*.
        """
        if not self._name_index:
            return None
        query_lower = query.lower().strip()

        # Build list of alias strings for rapidfuzz
        alias_strings = [alias for (_, alias) in self._name_index]
        result = fuzz_process.extractOne(
            query_lower,
            alias_strings,
            scorer=fuzz.WRatio,
            score_cutoff=threshold,
        )
        if result is None:
            return None

        matched_alias = result[0]
        # Find the canonical name for this alias
        for canonical, alias in self._name_index:
            if alias == matched_alias:
                return canonical
        return None

    def shortest_path(
        self, source: str, destination: str
    ) -> tuple[list[str], float]:
        """
        Run Dijkstra between *source* and *destination*.
        Returns (path_node_list, total_distance_meters).
        Raises nx.NetworkXNoPath if no path exists.
        """
        path = nx.dijkstra_path(self._graph, source, destination, weight="weight")
        length = nx.dijkstra_path_length(self._graph, source, destination, weight="weight")
        return path, length

    def edge_hint(self, from_node: str, to_node: str) -> str:
        """Return the step hint for an edge (may be empty)."""
        data = self._graph.get_edge_data(from_node, to_node) or {}
        return data.get("hint", "")

    def edge_distance(self, from_node: str, to_node: str) -> float:
        """Return the distance in meters for an edge."""
        data = self._graph.get_edge_data(from_node, to_node) or {}
        return data.get("weight", 0.0)

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def all_node_names(self) -> list[str]:
        return list(self._graph.nodes)


# Singleton instance shared across the process
campus_graph = CampusGraph()


# ── Query parsing ─────────────────────────────────────────────────────────────

# Prepositions/connectors that signal "I want to go FROM here TO there"
_ROUTE_CONNECTORS = [
    " to ", " from ", " toward ", " towards ",
    " -> ", " => ", "to the", "towards the",
]
# Phrases that indicate the user is asking about a single location
_LOCATION_PHRASES = [
    "where is", "where's", "how to reach", "how do i get to",
    "how do i find", "find ", "locate ", "directions to", "way to",
    "show me", "take me to",
]


def _parse_query(query: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract (source_hint, destination_hint) from a natural language query.
    Returns (None, destination_hint) if only a destination is mentioned.
    Returns (None, None) if nothing useful is found.
    """
    q = query.lower().strip()

    # Pattern: "from X to Y"
    if " from " in q and " to " in q:
        try:
            after_from = q.split(" from ", 1)[1]
            parts = after_from.split(" to ", 1)
            return parts[0].strip(), parts[1].strip()
        except IndexError:
            pass

    # Pattern: "X to Y" (without explicit "from")
    if " to " in q and not any(p in q for p in _LOCATION_PHRASES):
        parts = q.split(" to ", 1)
        # Check if the first part sounds like a location
        possible_src = campus_graph.fuzzy_match_node(parts[0].strip(), threshold=65)
        possible_dst = campus_graph.fuzzy_match_node(parts[1].strip(), threshold=65)
        if possible_src and possible_dst:
            return parts[0].strip(), parts[1].strip()

    # Single-location queries: "where is X", "how do I get to X"
    for phrase in _LOCATION_PHRASES:
        if phrase in q:
            after = q.split(phrase, 1)[1].strip()
            # Strip common trailing filler
            for filler in ["?", "please", ".", "!"]:
                after = after.rstrip(filler).strip()
            return None, after

    # Fallback: treat the whole query minus stop-words as the destination
    destination_hint = q
    for sw in ["where", "is", "the", "a", "an", "how", "can", "i", "go", "get", "find", "locate"]:
        destination_hint = destination_hint.replace(f" {sw} ", " ").strip()
    return None, destination_hint.strip() or None


# ── Main agent function ───────────────────────────────────────────────────────

DEFAULT_SOURCE = "Main Gate"


def run_navigation_agent(query: str) -> NavigationResult:
    """
    Process a navigation query and return a NavigationResult.

    Args:
        query: Natural language navigation question from the user.

    Returns:
        NavigationResult with directions or an error message.
    """
    if not campus_graph.is_loaded:
        return NavigationResult(
            success=False,
            source="",
            destination="",
            total_distance_meters=0,
            error_message="Campus map is not loaded yet. Please try again in a moment.",
        )

    source_hint, destination_hint = _parse_query(query)

    # Resolve destination (required)
    if not destination_hint:
        return NavigationResult(
            success=False,
            source="",
            destination="",
            total_distance_meters=0,
            error_message=(
                "I couldn't identify a destination in your query. "
                "Try something like: 'Where is the Library?' or "
                "'How do I get from the Canteen to Block A?'"
            ),
        )

    destination = campus_graph.fuzzy_match_node(destination_hint)
    if not destination:
        return NavigationResult(
            success=False,
            source="",
            destination=destination_hint,
            total_distance_meters=0,
            error_message=(
                f"I couldn't find a campus location matching '{destination_hint}'. "
                f"Known locations include: {', '.join(campus_graph.all_node_names())}."
            ),
        )

    # Resolve source (optional — default to Main Gate)
    defaulted_source = False
    if source_hint:
        source = campus_graph.fuzzy_match_node(source_hint)
        if not source:
            source = DEFAULT_SOURCE
            defaulted_source = True
    else:
        source = DEFAULT_SOURCE
        defaulted_source = True

    # Same-location check
    if source == destination:
        return NavigationResult(
            success=True,
            source=source,
            destination=destination,
            total_distance_meters=0,
            steps=[],
            directions_text=f"You are already at **{destination}**. No navigation needed!",
            defaulted_source=defaulted_source,
        )

    # Run Dijkstra
    try:
        path, total_distance = campus_graph.shortest_path(source, destination)
    except nx.NetworkXNoPath:
        return NavigationResult(
            success=False,
            source=source,
            destination=destination,
            total_distance_meters=0,
            error_message=(
                f"No walkable path found between '{source}' and '{destination}'. "
                "Please check with campus security for temporary route closures."
            ),
        )
    except nx.NodeNotFound as exc:
        return NavigationResult(
            success=False,
            source=source,
            destination=destination,
            total_distance_meters=0,
            error_message=f"Internal error: node not found in graph — {exc}",
        )

    # Build step objects
    steps: list[NavigationStep] = []
    for i in range(len(path) - 1):
        from_node = path[i]
        to_node = path[i + 1]
        dist = campus_graph.edge_distance(from_node, to_node)
        hint = campus_graph.edge_hint(from_node, to_node)
        steps.append(
            NavigationStep(
                step_number=i + 1,
                from_node=from_node,
                to_node=to_node,
                distance_meters=dist,
                hint=hint or f"Walk from {from_node} to {to_node} (~{int(dist)}m)",
            )
        )

    # Build human-readable directions text
    lines: list[str] = []
    if defaulted_source:
        lines.append(
            f"_(No starting point mentioned — defaulting to **{DEFAULT_SOURCE}**.)_\n"
        )
    lines.append(f"**Route: {source} → {destination}**")
    lines.append(f"Total walking distance: ~{int(total_distance)} metres\n")
    for step in steps:
        lines.append(f"**Step {step.step_number}** — {step.hint} (~{int(step.distance_meters)}m)")
    lines.append(f"\n🏁 You have arrived at **{destination}**.")

    return NavigationResult(
        success=True,
        source=source,
        destination=destination,
        total_distance_meters=total_distance,
        steps=steps,
        directions_text="\n".join(lines),
        defaulted_source=defaulted_source,
    )
