"""
navigation_agent.py — Dijkstra-based campus navigation with Groq (Primary) and Gemini (Fallback) NLU.

Loads campus_overview.json at startup. Uses NetworkX for shortest-path.
Uses Groq (Primary) / Gemini (Fallback) LLM for:
  1. NL→node extraction (understanding "Admin office" → "Admin Block")
  2. Composing the final human-friendly answer

Falls back to rapidfuzz keyword matching and structured template if API keys are not set.
"""

import json
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

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
            candidate = Path(__file__).parent.parent / data_path
            if candidate.exists():
                data_path = candidate
            else:
                candidate2 = Path(__file__).parent.parent / "data" / "campus_overview.json"
                if candidate2.exists():
                    data_path = candidate2
                else:
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

        self.groq_client = None
        self.gemini_client = None

        log.info("NavigationAgent loaded: %d nodes, %d edges",
                 len(self.nodes), self.graph.number_of_edges())

    def _get_groq_client(self):
        """Dynamically retrieves or initializes the Groq client from environment."""
        if self.groq_client:
            return self.groq_client
        key = (
            os.environ.get("GROQ_API_KEY")
            or os.environ.get("GROQ_APT_KEY")
            or os.environ.get("GROQ_KEY")
            or settings.groq_api_key
        )
        if key and not key.startswith("gsk_YOUR") and key != "your-groq-api-key-here" and len(key.strip()) > 8:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=key.strip())
                return self.groq_client
            except Exception as e:
                log.warning("NavigationAgent: Groq client init failed: %s", e)
        return None

    def _get_gemini_client(self):
        """Dynamically retrieves or initializes the Google Gemini client from environment."""
        if self.gemini_client:
            return self.gemini_client
        key = (
            os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GOOGLE_API_KEY")
            or os.environ.get("GEMINI_KEY")
            or settings.gemini_api_key
        )
        if key and not key.startswith("YOUR_") and key != "your-gemini-api-key-here" and len(key.strip()) > 8:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=key.strip())
                return self.gemini_client
            except Exception as e:
                log.warning("NavigationAgent: google-genai client init failed: %s", e)
        return None

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
        Tries Groq first (Primary), then Gemini (Fallback), then keyword matching.
        """
        groq_c = self._get_groq_client()
        if groq_c:
            try:
                res = self._groq_extract_locations(query, groq_c)
                if res[0] is not None or res[1] is not None:
                    return res
            except Exception as e:
                log.warning("Groq location extraction failed (%s) — trying Gemini fallback", e)

        gemini_c = self._get_gemini_client()
        if gemini_c:
            try:
                res = self._gemini_extract_locations(query, gemini_c)
                if res[0] is not None or res[1] is not None:
                    return res
            except Exception as e:
                log.warning("Gemini extraction failed (%s) — using keyword fallback", e)

        return self._keyword_extract_locations(query)

    def _groq_extract_locations(self, query: str, client: Any) -> tuple[Optional[str], Optional[str]]:
        """Use Groq to extract source/destination campus node names."""
        node_list = ", ".join(self.node_names)
        prompt = (
            f"You are a campus navigation assistant for IARE college.\n"
            f"Extract the SOURCE and DESTINATION campus locations from this query.\n\n"
            f"Known campus locations: {node_list}\n\n"
            f"Query: \"{query}\"\n\n"
            f"Rules:\n"
            f"- If only one location is mentioned, it is the DESTINATION. Source is null.\n"
            f"- Match aliases (e.g. \"admin office\" = \"Admin Block\", \"library\" = \"Library\").\n"
            f"- Return ONLY valid JSON: {{\"source\": \"exact node name or null\", \"destination\": \"exact node name or null\"}}\n"
        )
        completion = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": "You are a JSON location extractor. Respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            max_tokens=150,
            response_format={"type": "json_object"} if hasattr(client, "chat") else None
        )
        text = completion.choices[0].message.content.strip()
        match = re.search(r'\{.*?\}', text, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return data.get("source"), data.get("destination")
        return None, None

    def _gemini_extract_locations(self, query: str, client: Any) -> tuple[Optional[str], Optional[str]]:
        """Use Gemini to extract source/destination campus node names."""
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

        # Build human-friendly message (with Groq/Gemini or template)
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
        """Compose a friendly natural-language route description using Groq (Primary), Gemini (Fallback), or Template."""
        groq_c = self._get_groq_client()
        if groq_c:
            try:
                return self._groq_compose_message(source, dest, path, hints, distance, defaulted, groq_c)
            except Exception as e:
                log.warning("Groq message composition failed: %s — trying Gemini fallback", e)

        gemini_c = self._get_gemini_client()
        if gemini_c:
            try:
                return self._gemini_compose_message(source, dest, path, hints, distance, defaulted, gemini_c)
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

    def _groq_compose_message(
        self, source: str, dest: str,
        path: list[str], hints: list[str],
        distance: float, defaulted: bool,
        client: Any
    ) -> str:
        """Use Groq to write a polished, conversational route description."""
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
        completion = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": "You are a concise, helpful campus navigation guide."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=250,
        )
        return completion.choices[0].message.content.strip()

    def _gemini_compose_message(
        self, source: str, dest: str,
        path: list[str], hints: list[str],
        distance: float, defaulted: bool,
        client: Any
    ) -> str:
        """Use Gemini to write a polished, conversational route description."""
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
