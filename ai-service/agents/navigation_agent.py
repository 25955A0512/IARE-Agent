"""
navigation_agent.py — Dijkstra-based campus navigation with Gemini NLU.

Loads campus_overview.json at startup. Uses NetworkX for shortest-path.
Uses google-genai SDK for:
  1. NL→node extraction (understanding "Admin office" → "Admin Block")
  2. Composing the final human-friendly answer

Falls back to rapidfuzz keyword matching if GEMINI_API_KEY is not set.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import networkx as nx
from rapidfuzz import process as rf_process, fuzz

from config import settings

log = logging.getLogger(__name__)


@dataclass
class NavResult:
    """Structured result from the navigation agent."""
    success: bool
    agent: str = "navigation"
    source_node: str = ""
    destination_node: str = ""
    route_stops: list[str] = field(default_factory=list)
    step_hints: list[str] = field(default_factory=list)
    total_distance_meters: float = 0.0
    message: str = ""
    error: str = ""

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "agent": self.agent,
            "source_node": self.source_node,
            "destination_node": self.destination_node,
            "route_stops": self.route_stops,
            "step_hints": self.step_hints,
            "total_distance_meters": self.total_distance_meters,
            "message": self.message,
            "error": self.error,
        }


class NavigationAgent:
    """
    Campus navigation agent.
    Loads real campus data from campus_overview.json.
    Never fabricates placeholder responses — fails clearly if data is missing.
    """

    DEFAULT_SOURCE = "Main Gate"

    def __init__(self) -> None:
        data_path = Path(settings.campus_data_path)
        if not data_path.exists():
            raise FileNotFoundError(f"Campus data not found: {data_path}")

        with data_path.open(encoding="utf-8") as f:
            raw = json.load(f)

        # Build node lookup
        self.nodes: dict[int, dict] = {n["id"]: n for n in raw["nodes"]}
        self.node_names: list[str] = [n["name"] for n in raw["nodes"]]

        # Build alias→name map
        self.alias_map: dict[str, str] = {}
        for n in raw["nodes"]:
            self.alias_map[n["name"].lower()] = n["name"]
            for alias in n.get("aliases", "").split(","):
                a = alias.strip().lower()
                if a:
                    self.alias_map[a] = n["name"]

        # Build weighted NetworkX graph
        self.graph = nx.Graph()
        for n in raw["nodes"]:
            self.graph.add_node(n["name"])
        for e in raw["edges"]:
            src = self.nodes[e["source"]]["name"]
            tgt = self.nodes[e["target"]]["name"]
            self.graph.add_edge(
                src, tgt,
                weight=e["distance_meters"],
                step_hint=e.get("step_hint", "")
            )

        log.info("NavigationAgent loaded: %d nodes, %d edges",
                 len(self.nodes), self.graph.number_of_edges())

    # ── Public API ────────────────────────────────────────────────────────────

    def handle(self, query: str) -> dict:
        """Entry point called by the router agent."""
        source_raw, dest_raw = self._extract_locations(query)
        source = self._resolve_node(source_raw) if source_raw else None
        dest = self._resolve_node(dest_raw) if dest_raw else None

        if not dest:
            return NavResult(
                success=False,
                error="destination_not_found",
                message=(
                    f"I couldn't identify a campus location in your query. "
                    f"Try: 'How do I get to the Library?' or "
                    f"'Directions from Canteen to Block A'."
                )
            ).to_dict()

        if not source:
            source = self.DEFAULT_SOURCE

        return self._compute_route(source, dest, defaulted=(source_raw is None))

    # ── Location extraction ───────────────────────────────────────────────────

    def _extract_locations(self, query: str) -> tuple[Optional[str], Optional[str]]:
        """
        Extract source and destination from a natural language query.
        Tries Gemini first; falls back to keyword matching.
        """
        if settings.gemini_api_key:
            try:
                return self._gemini_extract_locations(query)
            except Exception as e:
                log.warning("Gemini extraction failed (%s) — using keyword fallback", e)

        return self._keyword_extract_locations(query)

    def _gemini_extract_locations(self, query: str) -> tuple[Optional[str], Optional[str]]:
        """Use Gemini to extract source/destination campus node names."""
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)
        node_list = ", ".join(self.node_names)

        prompt = f"""You are a campus navigation assistant for IARE college.
Extract the SOURCE and DESTINATION campus locations from this query.

Known campus locations: {node_list}

Query: "{query}"

Rules:
- If only one location is mentioned, it is the DESTINATION. Source is null.
- Match aliases (e.g. "admin office" = "Admin Block", "library" = "Library").
- Return ONLY a JSON object: {{"source": "exact node name or null", "destination": "exact node name or null"}}
- Use exact node names from the list above.
- If no location found, return {{"source": null, "destination": null}}
"""
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )
        text = response.text.strip()
        # Parse JSON from response
        match = re.search(r'\{.*?\}', text, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return data.get("source"), data.get("destination")
        return None, None

    def _keyword_extract_locations(self, query: str) -> tuple[Optional[str], Optional[str]]:
        """
        Keyword/fuzzy fallback for location extraction.
        Handles: "from X to Y", "X to Y", "where is X", etc.
        """
        q = query.lower()

        # Try "from X to Y" pattern
        from_to = re.search(
            r'\b(?:from|starting at|starting from)\b\s+(.+?)\s+\b(?:to|toward|towards|and go to)\b\s+(.+)',
            q
        )
        if from_to:
            src_raw, dst_raw = from_to.group(1).strip(), from_to.group(2).strip()
            # Remove trailing filler words
            for filler in ["please", "now", "quickly"]:
                dst_raw = dst_raw.replace(filler, "").strip()
            return src_raw, dst_raw

        # "to Y" / "reach Y" / "find Y" / "where is Y" — single destination
        single = re.search(
            r'\b(?:to|reach|find|get to|take me to|go to|where is|where\'s|directions? to|how to get to)\b\s+(.+)',
            q
        )
        if single:
            return None, single.group(1).strip()

        # Last resort: just try the whole query as destination
        return None, q

    # ── Node resolution ───────────────────────────────────────────────────────

    def _resolve_node(self, raw: str | None) -> Optional[str]:
        """Fuzzy-match a raw location string to a known node name."""
        if not raw:
            return None
        raw_lower = raw.lower().strip()

        # Exact alias match
        if raw_lower in self.alias_map:
            return self.alias_map[raw_lower]

        # Fuzzy match against all aliases
        all_aliases = list(self.alias_map.keys())
        best = rf_process.extractOne(raw_lower, all_aliases, scorer=fuzz.partial_ratio)
        if best and best[1] >= 75:
            return self.alias_map[best[0]]

        # Fuzzy match against node names directly
        best_name = rf_process.extractOne(raw_lower, self.node_names, scorer=fuzz.partial_ratio)
        if best_name and best_name[1] >= 75:
            return best_name[0]

        return None

    # ── Route computation ─────────────────────────────────────────────────────

    def _compute_route(self, source: str, dest: str, defaulted: bool = False) -> dict:
        """Run Dijkstra and compose a human-readable response."""
        try:
            path = nx.dijkstra_path(self.graph, source, dest, weight="weight")
            distance = nx.dijkstra_path_length(self.graph, source, dest, weight="weight")
        except nx.NetworkXNoPath:
            return NavResult(
                success=False,
                error="no_path",
                message=f"I couldn't find a route from {source!r} to {dest!r}. "
                        f"The campus map may not connect these locations directly."
            ).to_dict()
        except nx.NodeNotFound as e:
            return NavResult(
                success=False, error="node_not_found",
                message=str(e)
            ).to_dict()

        # Collect step hints along the path
        hints = []
        for i in range(len(path) - 1):
            edge_data = self.graph.get_edge_data(path[i], path[i + 1], {})
            hint = edge_data.get("step_hint", f"Walk from {path[i]} to {path[i+1]}")
            hints.append(hint)

        # Build human-friendly message (with Gemini or template)
        route_str = " → ".join(path)
        message = self._compose_message(source, dest, path, hints, distance, defaulted)

        return NavResult(
            success=True,
            source_node=source,
            destination_node=dest,
            route_stops=path,
            step_hints=hints,
            total_distance_meters=float(distance),
            message=message,
        ).to_dict()

    def _compose_message(
        self, source: str, dest: str,
        path: list[str], hints: list[str],
        distance: float, defaulted: bool
    ) -> str:
        """Compose a friendly natural-language route description."""
        if settings.gemini_api_key:
            try:
                return self._gemini_compose_message(source, dest, path, hints, distance, defaulted)
            except Exception as e:
                log.warning("Gemini message composition failed: %s — using template", e)

        # Template fallback
        prefix = f"_(Starting from **{source}** since no starting location was specified.)_ \n\n" if defaulted else ""
        steps_text = "\n".join(
            f"• **Step {i+1}**: {hint}" for i, hint in enumerate(hints)
        )
        minutes = max(1, int(distance // 60))
        return (
            f"{prefix}Here's the quickest walking path to **{dest}** from **{source}** (~{int(distance)}m, about {minutes} min walk): 🚶\n\n"
            f"{steps_text}\n\n"
            f"📍 *Path summary: {' → '.join(path)}*"
        )

    def _gemini_compose_message(
        self, source: str, dest: str,
        path: list[str], hints: list[str],
        distance: float, defaulted: bool
    ) -> str:
        """Use Gemini to write a polished, conversational route description."""
        from google import genai
        client = genai.Client(api_key=settings.gemini_api_key)

        route_desc = " → ".join(path)
        steps = "\n".join(f"{i+1}. {h}" for i, h in enumerate(hints))
        defaulted_note = f"(The user didn't specify a starting point; we defaulted to {source}.)" if defaulted else ""

        prompt = f"""You are a friendly campus guide at IARE college.
Write a clear, natural navigation answer for a student.

Route: {route_desc}
Distance: approximately {int(distance)} metres
Turn-by-turn steps:
{steps}
{defaulted_note}

Instructions:
- Be warm and conversational, not robotic.
- Mention key landmarks along the way.
- Keep it concise (under 100 words).
- If the source was defaulted, gently mention you're starting them from {source}.
- Do NOT say "I" or "we" — use "you" and "your".
"""
        response = client.models.generate_content(
            model=settings.gemini_model, contents=prompt
        )
        return response.text.strip()
