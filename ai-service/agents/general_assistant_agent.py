"""
general_assistant_agent.py — Warm, conversational academic Q&A, tutor, and reasoning agent.

Capabilities:
- Answers student queries naturally and dynamically without any fixed or boilerplate templates.
- Adapts answer structure and depth to match what the student actually requested (crisp definition vs. detailed explanation vs. casual chat).
- Robust LLM inference supporting Groq (primary) and Google Gemini (fallback) per AGENTS.md.
- Accurate academic topic/subject extraction (filtering out all command and conversational filler words like "just", "tell", "definition").
- Clean separation between internal weakness tracking metadata and student-visible response text.
- Inline visual diagrams (Imagen-3 / vector SVG charts) for conceptual clarity.
"""

import base64
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from config import settings

log = logging.getLogger(__name__)


# ── Stopwords for command phrasing & conversational filler ─────────────────────
COMMAND_STOPWORDS = {
    "a", "about", "all", "alright", "an", "and", "are", "as", "at", "be", "between", "brief",
    "bye", "can", "chill", "clarify", "concept", "cool", "could", "describe", "detail", "details",
    "difference", "definition", "define", "do", "does", "example", "examples", "explain",
    "explanation", "fine", "for", "give", "good", "got", "great", "hello", "help", "hey", "hi",
    "how", "i", "in", "is", "it", "just", "know", "like", "meaning", "me", "mute", "nah", "need",
    "nevermind", "no", "nope", "nothing", "notes", "of", "ok", "okay", "on", "or", "overview",
    "please", "quiet", "short", "show", "silent", "simple", "sorry", "sounds", "standby",
    "summarize", "summary", "sure", "tell", "thank", "thanks", "the", "this", "to", "understand",
    "what", "whats", "what's", "when", "where", "which", "who", "why", "with", "would", "write",
    "yeah", "yep", "yes", "you", "your"
}

# ── Academic Subject & Topic Dictionary ─────────────────────────────────────────
ACADEMIC_TOPIC_KNOWLEDGE: List[Tuple[str, str, List[str]]] = [
    # Artificial Intelligence & Data Science
    ("Artificial Intelligence & ML", "Artificial Intelligence", ["artificial intelligence", "ai", "agi", "turing test", "expert system", "intelligent agent"]),
    ("Artificial Intelligence & ML", "Machine Learning Fundamentals", ["machine learning", "ml", "supervised learning", "unsupervised learning", "reinforcement learning", "linear regression", "logistic regression", "gradient descent", "overfitting", "underfitting", "bias variance", "svm", "random forest", "decision tree"]),
    ("Artificial Intelligence & ML", "Deep Learning & Neural Networks", ["deep learning", "neural network", "ann", "cnn", "convolutional neural network", "rnn", "lstm", "transformer", "backpropagation", "activation function", "relu", "softmax", "loss function"]),
    ("Artificial Intelligence & ML", "Natural Language Processing", ["natural language processing", "nlp", "tokenization", "stemming", "lemmatization", "word2vec", "bert", "gpt", "large language model", "llm", "prompt engineering"]),
    ("Artificial Intelligence & ML", "Computer Vision", ["computer vision", "cv", "object detection", "image segmentation", "yolo", "opencv", "feature extraction"]),

    # Data Structures & Algorithms
    ("Data Structures & Algorithms", "Binary Search Trees", ["bst", "binary search tree", "avl tree", "tree traversal", "inorder", "preorder", "postorder", "binary tree", "red black tree"]),
    ("Data Structures & Algorithms", "Graphs & Shortest Path", ["dijkstra", "graph traversal", "bfs", "dfs", "topological sort", "kruskal", "prim", "minimum spanning tree", "mst", "bellman ford", "floyd warshall"]),
    ("Data Structures & Algorithms", "Dynamic Programming", ["dynamic programming", "dp", "knapsack", "memoization", "longest common subsequence", "lcs", "matrix chain multiplication", "coin change"]),
    ("Data Structures & Algorithms", "Sorting & Searching", ["quicksort", "merge sort", "heap sort", "bubble sort", "insertion sort", "binary search", "time complexity", "space complexity", "big o", "asymptotic notation"]),
    ("Data Structures & Algorithms", "Linear Data Structures", ["linked list", "singly linked list", "doubly linked list", "stack", "queue", "deque", "hash table", "hash map", "collision resolution"]),

    # Operating Systems
    ("Operating Systems", "Process Synchronization & Deadlocks", ["deadlock", "banker's algorithm", "banker algorithm", "semaphore", "mutex", "critical section", "dining philosophers", "race condition", "coffman conditions"]),
    ("Operating Systems", "Memory Management", ["paging", "segmentation", "virtual memory", "page replacement", "lru", "fifo", "thrashing", "tlb", "demand paging"]),
    ("Operating Systems", "CPU Scheduling & Processes", ["cpu scheduling", "round robin", "sjf", "fcfs", "process control block", "pcb", "context switch", "thread vs process", "multithreading"]),

    # Database Management Systems
    ("Database Management Systems", "SQL & Relational Queries", ["sql query", "sql", "join", "inner join", "outer join", "left join", "group by", "having", "normalization", "1nf", "2nf", "3nf", "bcnf", "foreign key", "primary key"]),
    ("Database Management Systems", "Transactions & ACID", ["acid properties", "acid", "transaction", "concurrency control", "serializability", "2pl", "two phase locking", "wal", "deadlock in dbms"]),
    ("Database Management Systems", "NoSQL & Indexing", ["nosql", "mongodb", "b tree index", "b+ tree", "indexing", "sharding", "replication"]),

    # Computer Networks
    ("Computer Networks", "OSI & TCP/IP Protocols", ["osi model", "tcp vs udp", "tcp", "udp", "three way handshake", "ip addressing", "ipv4", "ipv6", "subnetting", "dns", "http", "https", "dhcp", "arp"]),
    ("Computer Networks", "Routing & Network Security", ["routing protocol", "ospf", "bgp", "firewall", "ssl", "tls", "cryptography", "symmetric encryption", "rsa", "cybersecurity"]),

    # Programming Languages & Software Engineering
    ("Python Programming", "Python Core & Advanced", ["python", "list comprehension", "generator", "decorator", "oop in python", "lambda function", "gil"]),
    ("Java Programming", "Java Core & Collections", ["java", "jvm", "garbage collection", "hashmap", "arraylist", "multithreading in java", "interface vs abstract class", "polymorphism", "inheritance"]),
    ("Web Development", "Frontend & React", ["react", "usestate", "useeffect", "props", "javascript", "typescript", "css", "html", "dom", "component lifecycle"]),
    ("Web Development", "Backend & APIs", ["rest api", "fastapi", "spring boot", "node.js", "express", "jwt", "authentication", "cors", "microservices"]),

    # Mathematics & Engineering Sciences
    ("Mathematics", "Calculus & Linear Algebra", ["differential equation", "laplace transform", "fourier transform", "eigenvalue", "eigenvector", "matrix multiplication", "vector space", "determinant"]),
    ("Mathematics", "Probability & Statistics", ["probability", "bayes theorem", "poisson distribution", "normal distribution", "gaussian", "random variable", "hypothesis testing"]),
]


class GeneralAssistantAgent:
    """General Assistant Agent with warm study-partner personality and flexible generation."""

    def __init__(self):
        self.gemini_client = None
        self.groq_client = None

        # 1. Initialize Groq client (Primary per AGENTS.md)
        groq_key = settings.groq_api_key or os.environ.get("GROQ_API_KEY")
        if groq_key and not groq_key.startswith("gsk_YOUR") and groq_key != "your-groq-api-key-here":
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=groq_key)
                log.info("GeneralAssistantAgent: Groq client initialized with model %s", settings.groq_model)
            except Exception as e:
                log.warning("GeneralAssistantAgent: Groq client init failed: %s", e)

        # 2. Initialize Gemini client (Fallback per AGENTS.md)
        gemini_key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY")
        if gemini_key and not gemini_key.startswith("YOUR_") and gemini_key != "your-gemini-api-key-here":
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=gemini_key)
                log.info("GeneralAssistantAgent: google-genai client initialized with model %s", settings.gemini_model)
            except Exception as e:
                log.warning("GeneralAssistantAgent: google-genai client init failed: %s", e)

        if not self.groq_client and not self.gemini_client:
            log.info("GeneralAssistantAgent: Running with contextual academic knowledge engine (no external API keys set)")

    def _get_groq_client(self):
        """Dynamically retrieves or initializes the Groq client from environment."""
        if self.groq_client:
            return self.groq_client
        key = os.environ.get("GROQ_API_KEY") or settings.groq_api_key
        if key and not key.startswith("gsk_YOUR") and key != "your-groq-api-key-here" and len(key.strip()) > 10:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=key.strip())
                log.info("Groq client dynamically loaded with model %s", settings.groq_model)
                return self.groq_client
            except Exception as e:
                log.warning("Dynamic Groq client init failed: %s", e)
        return None

    def _get_gemini_client(self):
        """Dynamically retrieves or initializes the Google Gemini client from environment."""
        if self.gemini_client:
            return self.gemini_client
        key = os.environ.get("GEMINI_API_KEY") or settings.gemini_api_key
        if key and not key.startswith("YOUR_") and key != "your-gemini-api-key-here" and len(key.strip()) > 10:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=key.strip())
                log.info("google-genai client dynamically loaded with model %s", settings.gemini_model)
                return self.gemini_client
            except Exception as e:
                log.warning("Dynamic google-genai client init failed: %s", e)
        return None

    def handle(
        self,
        query: str,
        student_context: Optional[Dict[str, Any]] = None,
        onboarding_context: Optional[Dict[str, Any]] = None,
        weak_topics: Optional[List[str]] = None,
        recent_messages: Optional[List[Dict[str, str]]] = None,
        summary_memory: Optional[str] = None,
        active_events: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Processes an academic or general campus question.
        Returns:
            {
                "success": True,
                "agent": "general_assistant",
                "message": "...tailored markdown response...",
                "subject": "Artificial Intelligence & ML",
                "topic": "Artificial Intelligence",
                "is_weakness_trigger": False,
                "image_url": "data:image/...",
                "image_caption": "Visual Architecture: ..."
            }
        """
        weak_list = [w.lower().strip() for w in (weak_topics or [])]
        q_lower = query.lower().strip()

        # Check if query is asking about events/notices
        is_event_query = any(k in q_lower for k in [
            "event", "happening", "today", "this week", "upcoming", "drive",
            "placement", "workshop", "hackathon", "notice", "circular", "deadline",
            "what's going on", "what is going on", "activities"
        ])

        # Check if query is a conversational statement, dismissive remark, standby, or greeting
        name = (student_context or {}).get("fullName", "Friend")
        conv_response = self._handle_conversational_and_smalltalk(query, name)
        if conv_response:
            return {
                "success": True,
                "agent": "general_assistant",
                "message": conv_response,
                "subject": "General Conversation",
                "topic": "Casual Interaction",
                "is_weakness_trigger": False,
            }

        if is_event_query and active_events:
            subject = "Campus Events & Notices"
            topic = "Campus Notices"
            is_weak = False
        else:
            # Clean extraction of academic subject and topic
            subject, topic = self._extract_topic_and_subject(query, onboarding_context)
            is_weak = self._is_weak_topic(topic, subject, weak_list, onboarding_context, query)

        # Generate genuine, tailored answer
        answer = None
        groq_client = self._get_groq_client()
        if groq_client:
            answer = self._generate_with_groq(
                query, subject, topic, is_weak,
                student_context, onboarding_context,
                recent_messages, summary_memory,
                active_events, client=groq_client
            )

        if not answer:
            gemini_client = self._get_gemini_client()
            if gemini_client:
                answer = self._generate_with_gemini(
                    query, subject, topic, is_weak,
                    student_context, onboarding_context,
                    recent_messages, summary_memory,
                    active_events, client=gemini_client
                )

        if not answer:
            answer = self._generate_with_fallback(
                query, subject, topic, is_weak,
                student_context, onboarding_context,
                recent_messages, summary_memory,
                active_events
            )

        # Generate visual diagram only if conceptually helpful
        image_url, image_caption = None, None
        if self._should_generate_visual(query, topic):
            image_url, image_caption = self._generate_visual(query, topic, subject)

        result: Dict[str, Any] = {
            "success": True,
            "agent": "general_assistant",
            "message": answer,
            "subject": subject,
            "topic": topic,
            "is_weakness_trigger": is_weak,
        }

        if image_url:
            result["image_url"] = image_url
            result["image_caption"] = image_caption

        return result

    def _handle_conversational_and_smalltalk(self, query: str, full_name: str) -> Optional[str]:
        """
        Handles natural conversational statements, dismissive remarks, standby requests,
        greetings, and acknowledgements without assuming every spoken sentence is an exam subject.
        """
        q_clean = query.lower().strip()
        first_name = full_name.split()[0] if full_name and full_name != "Friend" else (full_name or "Friend")

        # 1. Standby / Mute / Be Cool / Chill / Nothing
        standby_patterns = [
            r"\b(nothing\s+just\s+be\s+cool)\b",
            r"\b(just\s+be\s+cool)\b",
            r"\b(be\s+cool)\b",
            r"\b(nothing\s+much)\b",
            r"\b(nothing\s+for\s+now)\b",
            r"\b(all\s+good)\b",
            r"\b(just\s+listening)\b",
            r"\b(no\s+worries)\b",
            r"^(nothing|chill|just\s+chill|be\s+quiet|stay\s+quiet|mute|standby|nevermind|shh|sleep|leave\s+it)[\.!\?]*$"
        ]
        if any(re.search(pat, q_clean) for pat in standby_patterns) or q_clean in ["nothing", "cool", "just be cool", "chill", "be cool", "nothing cool"]:
            return (
                f"Got it, {first_name}! 😎 I'll stay quiet on standby in the background. "
                f"Whenever you have a question or need anything, just speak or type and I'll jump right in!"
            )

        # 2. Acknowledgements & Gratitude
        if any(q_clean.startswith(w) or q_clean == w for w in ["thanks", "thank you", "thx", "appreciate it", "great thanks", "ok thanks", "okay thanks"]):
            return f"You're very welcome, {first_name}! 😊 Let me know if you need anything else."

        # 3. Simple OK / Alright / Got it / Cool
        if q_clean in ["ok", "okay", "got it", "cool", "alright", "sure", "sounds good", "perfect", "understood", "nice", "fine"]:
            return f"Awesome! Ready whenever you are, {first_name}."

        # 4. Casual Check-ins / Greetings
        if any(re.search(rf"^{w}[\.!\?]*$", q_clean) for w in ["hey", "hi", "hello", "good morning", "good afternoon", "good evening", "what's up", "whats up", "how are you", "how are you doing"]):
            return f"Hey {first_name}! 👋 I'm doing great and all your academic stats are synced. How can I help you right now?"

        return None

    def _extract_topic_and_subject(
        self,
        query: str,
        onboarding_context: Optional[Dict[str, Any]]
    ) -> Tuple[str, str]:
        """
        Extracts the genuine ACADEMIC SUBJECT and TOPIC, stripping all command language
        and conversational filler words (e.g. "just", "tell", "definition", "explain").
        """
        q_lower = query.lower().strip()

        # 1. Match against academic topic knowledge map
        for subj, top, keywords in ACADEMIC_TOPIC_KNOWLEDGE:
            for kw in keywords:
                pattern = rf"\b{re.escape(kw)}(?:s|es)?\b"
                if re.search(pattern, q_lower):
                    return subj, top

        # 2. Check enrolled courses from onboarding context
        if onboarding_context:
            courses = onboarding_context.get("enrolled_courses", "")
            if courses:
                for c in re.split(r"[,;]+", courses):
                    clean_c = c.strip()
                    if clean_c and re.search(rf"\b{re.escape(clean_c.lower())}(?:s|es)?\b", q_lower):
                        return clean_c, clean_c

        # 3. Clean token filtering (remove all command words and conversational filler)
        raw_words = re.findall(r"[a-zA-Z0-9+#]+", q_lower)
        filtered_words = [w for w in raw_words if len(w) >= 2 and w not in COMMAND_STOPWORDS]

        if filtered_words:
            candidate_topic = " ".join(filtered_words[:3]).title()
            return "General Studies", candidate_topic

        return "General Studies", "Academic Inquiry"

    def _is_weak_topic(
        self,
        topic: str,
        subject: str,
        weak_list: List[str],
        onboarding_context: Optional[Dict[str, Any]],
        query: str = ""
    ) -> bool:
        """Determines if the topic or query matches known weak areas."""
        topic_lower = topic.lower()
        subject_lower = subject.lower()
        query_lower = query.lower()

        for w in weak_list:
            pat = rf"\b{re.escape(w)}(?:s|es)?\b"
            if re.search(pat, topic_lower) or re.search(pat, subject_lower) or re.search(pat, query_lower) or (w in topic_lower):
                return True

        if onboarding_context:
            diff_subs = onboarding_context.get("difficult_subjects", "")
            if diff_subs:
                for s in re.split(r"[,;]+", diff_subs):
                    clean_s = s.strip().lower()
                    if clean_s:
                        pat = rf"\b{re.escape(clean_s)}(?:s|es)?\b"
                        if re.search(pat, topic_lower) or re.search(pat, subject_lower) or re.search(pat, query_lower) or (clean_s in topic_lower):
                            return True

        return False

    def _should_generate_visual(self, query: str, topic: str) -> bool:
        """Determines if a visual diagram or illustration will aid conceptual clarity."""
        q = query.lower()
        t = topic.lower()

        # Explicit visual inquiry triggers
        visual_words = [
            "diagram", "visualize", "visual", "draw", "flowchart", "sketch",
            "illustration", "show me a picture", "tree structure", "graph",
            "architecture", "schematic", "how it looks", "image"
        ]
        if any(w in q for w in visual_words):
            return True

        # Topics that strongly benefit from conceptual diagrams
        high_visual_topics = [
            "binary search tree", "avl tree", "tree", "dijkstra", "graph traversal",
            "deadlock", "banker", "osi model", "tcp vs udp", "tcp",
            "paging", "segmentation", "sorting", "merge sort", "quicksort"
        ]
        return any(vt in t or vt in q for vt in high_visual_topics)

    def _generate_visual(self, query: str, topic: str, subject: str) -> Tuple[Optional[str], Optional[str]]:
        """Generates an image via Imagen-3 or clean high-contrast SVG diagram."""
        if self.gemini_client:
            try:
                log.info("Attempting Imagen-3 visual generation for topic: %s", topic)
                prompt = (
                    f"A clean, minimalist educational vector diagram explaining '{topic}' in {subject}. "
                    f"Context: {query}. Modern dark background, high contrast luminous nodes, labeled components, "
                    f"crisp schematic typography, clean infographic style for university engineering students."
                )
                response = self.gemini_client.models.generate_images(
                    model="imagen-3.0-generate-002",
                    prompt=prompt,
                    config=dict(
                        number_of_images=1,
                        output_mime_type="image/png",
                        aspect_ratio="4:3",
                    )
                )
                if response.generated_images:
                    img_bytes = response.generated_images[0].image.image_bytes
                    b64 = base64.b64encode(img_bytes).decode("utf-8")
                    return f"data:image/png;base64,{b64}", f"Visual Architecture: {topic}"
            except Exception as e:
                log.info("Imagen-3 skipped (%s) — using precision vector SVG diagram", e)

        return self._generate_vector_svg(topic, query)

    def _generate_vector_svg(self, topic: str, query: str) -> Tuple[str, str]:
        """Generates a styled, dark-mode-optimized SVG visual explanation."""
        t_lower = topic.lower()
        q_lower = query.lower()

        if "tree" in t_lower or "bst" in t_lower or "avl" in t_lower or "tree" in q_lower:
            svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 280" width="100%" height="100%">
  <defs>
    <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A84FF"/>
      <stop offset="100%" stop-color="#0060DF"/>
    </linearGradient>
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#30D158"/>
      <stop offset="100%" stop-color="#248A3D"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <rect width="540" height="280" rx="16" fill="#0D1117" stroke="#30363D" stroke-width="1.5"/>
  <text x="270" y="28" fill="#F0F6FC" font-size="14" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">Binary Search Tree (BST) Property: Left &lt; Root &lt; Right</text>
  <line x1="270" y1="65" x2="150" y2="135" stroke="#58A6FF" stroke-width="2.5" stroke-dasharray="4,2"/>
  <line x1="270" y1="65" x2="390" y2="135" stroke="#58A6FF" stroke-width="2.5" stroke-dasharray="4,2"/>
  <line x1="150" y1="135" x2="90" y2="205" stroke="#3FB950" stroke-width="2"/>
  <line x1="150" y1="135" x2="210" y2="205" stroke="#3FB950" stroke-width="2"/>
  <line x1="390" y1="135" x2="330" y2="205" stroke="#3FB950" stroke-width="2"/>
  <line x1="390" y1="135" x2="450" y2="205" stroke="#3FB950" stroke-width="2"/>
  <circle cx="270" cy="65" r="22" fill="url(#nodeGrad)" filter="url(#glow)"/>
  <text x="270" y="71" fill="#FFFFFF" font-size="15" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">50</text>
  <circle cx="150" cy="135" r="20" fill="url(#nodeGrad)"/>
  <text x="150" y="141" fill="#FFFFFF" font-size="14" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">30</text>
  <circle cx="390" cy="135" r="20" fill="url(#nodeGrad)"/>
  <text x="390" y="141" fill="#FFFFFF" font-size="14" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">70</text>
  <circle cx="90" cy="205" r="18" fill="url(#leafGrad)"/>
  <text x="90" y="210" fill="#FFFFFF" font-size="13" font-weight="600" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">20</text>
  <circle cx="210" cy="205" r="18" fill="url(#leafGrad)"/>
  <text x="210" y="210" fill="#FFFFFF" font-size="13" font-weight="600" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">40</text>
  <circle cx="330" cy="205" r="18" fill="url(#leafGrad)"/>
  <text x="330" y="210" fill="#FFFFFF" font-size="13" font-weight="600" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">60</text>
  <circle cx="450" cy="205" r="18" fill="url(#leafGrad)"/>
  <text x="450" y="210" fill="#FFFFFF" font-size="13" font-weight="600" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">80</text>
  <rect x="70" y="244" width="400" height="24" rx="6" fill="#161B22" stroke="#30363D"/>
  <text x="270" y="260" fill="#58A6FF" font-size="11.5" font-weight="600" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">✨ Inorder Traversal (Sorted): 20 → 30 → 40 → 50 → 60 → 70 → 80</text>
</svg>"""
            caption = "Binary Search Tree (BST) Structural Hierarchy & Inorder Sorting"

        elif "tcp" in t_lower or "udp" in t_lower or "osi" in t_lower or "network" in t_lower:
            svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 260" width="100%" height="100%">
  <rect width="540" height="260" rx="16" fill="#0D1117" stroke="#30363D" stroke-width="1.5"/>
  <text x="270" y="28" fill="#F0F6FC" font-size="14" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">TCP 3-Way Handshake Connection Protocol</text>
  <rect x="60" y="55" width="90" height="34" rx="8" fill="#0A84FF"/>
  <text x="105" y="77" fill="#FFFFFF" font-size="13" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">Client</text>
  <line x1="105" y1="90" x2="105" y2="235" stroke="#30363D" stroke-width="2"/>
  <rect x="390" y="55" width="90" height="34" rx="8" fill="#30D158"/>
  <text x="435" y="77" fill="#FFFFFF" font-size="13" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">Server</text>
  <line x1="435" y1="90" x2="435" y2="235" stroke="#30363D" stroke-width="2"/>
  <line x1="105" y1="115" x2="435" y2="135" stroke="#58A6FF" stroke-width="2.5"/>
  <polygon points="435,135 423,130 425,138" fill="#58A6FF"/>
  <text x="270" y="118" fill="#79C0FF" font-size="11.5" font-weight="600" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">1. SYN (seq = x)</text>
  <line x1="435" y1="155" x2="105" y2="175" stroke="#3FB950" stroke-width="2.5"/>
  <polygon points="105,175 117,170 115,178" fill="#3FB950"/>
  <text x="270" y="160" fill="#7EE787" font-size="11.5" font-weight="600" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">2. SYN-ACK (seq = y, ack = x + 1)</text>
  <line x1="105" y1="195" x2="435" y2="215" stroke="#FFD33D" stroke-width="2.5"/>
  <polygon points="435,215 423,210 425,218" fill="#FFD33D"/>
  <text x="270" y="200" fill="#F0E68C" font-size="11.5" font-weight="600" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">3. ACK (ack = y + 1) → Connection ESTABLISHED</text>
</svg>"""
            caption = "TCP 3-Way Handshake (SYN → SYN-ACK → ACK) State Flow"

        elif "ai" in t_lower or "artificial intelligence" in t_lower or "machine learning" in t_lower:
            svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 260" width="100%" height="100%">
  <rect width="540" height="260" rx="16" fill="#0D1117" stroke="#30363D" stroke-width="1.5"/>
  <text x="270" y="28" fill="#F0F6FC" font-size="14" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">Hierarchy of Artificial Intelligence, ML &amp; Deep Learning</text>
  <!-- Outer Ring: AI -->
  <circle cx="270" cy="142" r="105" fill="rgba(10, 132, 255, 0.15)" stroke="#0A84FF" stroke-width="2"/>
  <text x="270" y="60" fill="#58A6FF" font-size="13" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">Artificial Intelligence (Broad Scope)</text>
  <!-- Middle Ring: ML -->
  <circle cx="270" cy="155" r="75" fill="rgba(48, 209, 88, 0.2)" stroke="#30D158" stroke-width="2"/>
  <text x="270" y="105" fill="#7EE787" font-size="12" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">Machine Learning (Learning from Data)</text>
  <!-- Inner Ring: Deep Learning -->
  <circle cx="270" cy="172" r="42" fill="rgba(255, 159, 10, 0.25)" stroke="#FF9F0A" stroke-width="2"/>
  <text x="270" y="166" fill="#FFD60A" font-size="11" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">Deep Learning</text>
  <text x="270" y="182" fill="#FFFFFF" font-size="9.5" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">(Multi-layer Neural Nets)</text>
</svg>"""
            caption = "Artificial Intelligence Hierarchy (AI ⊃ ML ⊃ Deep Learning)"

        else:
            svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 240" width="100%" height="100%">
  <rect width="540" height="240" rx="16" fill="#0D1117" stroke="#30363D" stroke-width="1.5"/>
  <text x="270" y="32" fill="#F0F6FC" font-size="14" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">Conceptual Overview: {topic}</text>
  <rect x="50" y="80" width="120" height="50" rx="8" fill="#0A84FF"/>
  <text x="110" y="110" fill="#FFFFFF" font-size="12" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">1. Input / Context</text>
  <line x1="170" y1="105" x2="210" y2="105" stroke="#58A6FF" stroke-width="2"/>
  <rect x="210" y="80" width="120" height="50" rx="8" fill="#30D158"/>
  <text x="270" y="110" fill="#FFFFFF" font-size="12" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">2. Core Logic</text>
  <line x1="330" y1="105" x2="370" y2="105" stroke="#30D158" stroke-width="2"/>
  <rect x="370" y="80" width="120" height="50" rx="8" fill="#FF9F0A"/>
  <text x="430" y="110" fill="#FFFFFF" font-size="12" font-weight="700" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">3. Output / Result</text>
  <text x="270" y="180" fill="#8B949E" font-size="11.5" font-family="-apple-system, system-ui, sans-serif" text-anchor="middle">Structured Academic Reasoning Architecture</text>
</svg>"""
            caption = f"{topic}: Architecture & Flow"

        b64_svg = base64.b64encode(svg.encode("utf-8")).decode("utf-8")
        return f"data:image/svg+xml;base64,{b64_svg}", caption

    def _generate_with_groq(
        self,
        query: str,
        subject: str,
        topic: str,
        is_weak: bool,
        student_context: Optional[Dict[str, Any]],
        onboarding_context: Optional[Dict[str, Any]],
        recent_messages: Optional[List[Dict[str, str]]],
        summary_memory: Optional[str],
        active_events: Optional[List[Dict[str, Any]]] = None,
        client: Any = None
    ) -> Optional[str]:
        """Generates a real-time generative answer via Groq LLM API."""
        groq_c = client or self._get_groq_client()
        if not groq_c:
            return None
        system_prompt = self._build_system_prompt(
            subject, topic, is_weak,
            student_context, onboarding_context,
            recent_messages, summary_memory,
            active_events
        )
        messages = [{"role": "system", "content": system_prompt}]
        if recent_messages:
            for m in recent_messages[-6:]:
                messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        messages.append({"role": "user", "content": query})

        models_to_try = [settings.groq_model, "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
        for mdl in dict.fromkeys(models_to_try):
            try:
                completion = groq_c.chat.completions.create(
                    model=mdl,
                    messages=messages,
                    temperature=0.4,
                    max_tokens=1200,
                )
                ans = completion.choices[0].message.content.strip()
                if ans:
                    return ans
            except Exception as e:
                log.warning("Groq model %s error: %s", mdl, e)
        return None

    def _generate_with_gemini(
        self,
        query: str,
        subject: str,
        topic: str,
        is_weak: bool,
        student_context: Optional[Dict[str, Any]],
        onboarding_context: Optional[Dict[str, Any]],
        recent_messages: Optional[List[Dict[str, str]]],
        summary_memory: Optional[str],
        active_events: Optional[List[Dict[str, Any]]] = None,
        client: Any = None
    ) -> Optional[str]:
        """Generates a real-time generative answer via Google Gemini API."""
        gemini_c = client or self._get_gemini_client()
        system_prompt = self._build_system_prompt(
            subject, topic, is_weak,
            student_context, onboarding_context,
            recent_messages, summary_memory,
            active_events
        )

        # 1. Try google-genai SDK
        if gemini_c:
            models_to_try = [settings.gemini_model, "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
            for mdl in dict.fromkeys(models_to_try):
                try:
                    response = gemini_c.models.generate_content(
                        model=mdl,
                        contents=[
                            {"role": "user", "parts": [{"text": f"{system_prompt}\n\nUser Question:\n{query}"}]}
                        ]
                    )
                    if response and response.text:
                        return response.text.strip()
                except Exception as e:
                    log.warning("Gemini SDK model %s error: %s", mdl, e)

        # 2. Direct HTTP REST fallback if SDK client has connectivity/version nuance
        raw_key = os.environ.get("GEMINI_API_KEY") or settings.gemini_api_key
        if raw_key and not raw_key.startswith("YOUR_") and raw_key != "your-gemini-api-key-here" and len(raw_key.strip()) > 10:
            import urllib.request
            import json as py_json
            for mdl in ["gemini-2.0-flash", "gemini-1.5-flash"]:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{mdl}:generateContent?key={raw_key.strip()}"
                    payload = {
                        "system_instruction": {"parts": [{"text": system_prompt}]},
                        "contents": [{"parts": [{"text": query}]}],
                        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1200}
                    }
                    req = urllib.request.Request(
                        url,
                        data=py_json.dumps(payload).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    )
                    with urllib.request.urlopen(req, timeout=12) as res:
                        data = py_json.loads(res.read().decode("utf-8"))
                        text = data["candidates"][0]["content"]["parts"][0]["text"]
                        if text:
                            return text.strip()
                except Exception as e:
                    log.warning("Direct Gemini REST call to %s failed: %s", mdl, e)

        return None

    def _generate_with_fallback(
        self,
        query: str,
        subject: str,
        topic: str,
        is_weak: bool,
        student_context: Optional[Dict[str, Any]],
        onboarding_context: Optional[Dict[str, Any]],
        recent_messages: Optional[List[Dict[str, str]]],
        summary_memory: Optional[str],
        active_events: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        Transparent fallback when no LLM API key is present in the environment.
        Instructs how to activate live LLM generation.
        """
        name = (student_context or {}).get("fullName", "Student")
        first_name = name.split()[0] if name and name != "Student" else (name or "Student")

        # If student asked about their actual database attendance or timetable, provide telemetry directly
        q_lower = query.lower()
        if "timetable" in q_lower or "schedule" in q_lower or "class" in q_lower:
            today_sched = (student_context or {}).get("todaySchedule", [])
            if today_sched:
                lines = [f"Here is your class schedule for today, **{first_name}**: 📅\n"]
                for s in today_sched:
                    lines.append(f"• **{s.get('timeSlotStart')} - {s.get('timeSlotEnd')}**: **{s.get('subjectName')}**\n  📍 Venue: *{s.get('room')}* | 👤 Faculty: *{s.get('facultyName')}*")
                return "\n".join(lines)

        if "attendance" in q_lower:
            att = (student_context or {}).get("overallAttendance", 0.0)
            bunks = (student_context or {}).get("safeBunksAvailable", 0)
            return f"Your overall attendance is **{att:.1f}%** ({bunks} safe buffer classes available above 75%), **{first_name}**!"

        return (
            f"I'm ready to answer anything you ask, {first_name}! 🚀\n\n"
            f"To enable live, unlimited generative reasoning for any question (like ChatGPT & Gemini), "
            f"please add your free **`GROQ_API_KEY`** or **`GEMINI_API_KEY`** in your Render environment settings."
        )

    def _build_system_prompt(
        self,
        subject: str,
        topic: str,
        is_weak: bool,
        student_context: Optional[Dict[str, Any]],
        onboarding_context: Optional[Dict[str, Any]],
        recent_messages: Optional[List[Dict[str, str]]],
        summary_memory: Optional[str],
        active_events: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """Assembles natural, supportive study-partner system instructions with complete student & college telemetry."""
        ctx = student_context or {}
        name = ctx.get("fullName", "Student")
        roll = ctx.get("rollNo", "N/A")
        dept = ctx.get("department", "Computer Science and Engineering")
        year = ctx.get("yearOfStudy", 2)
        sem = ctx.get("semester", 4)
        sec = ctx.get("section", "A")
        att = ctx.get("overallAttendance", 0.0)
        safe_bunks = ctx.get("safeBunksAvailable", 0)

        # Timetable summary
        today_sched = ctx.get("todaySchedule", [])
        sched_lines = []
        for s in today_sched:
            sched_lines.append(f"  - {s.get('timeSlotStart')}-{s.get('timeSlotEnd')}: {s.get('subjectName')} (Room: {s.get('room')}, Faculty: {s.get('facultyName')})")
        today_sched_text = "\n".join(sched_lines) if sched_lines else "No active periods right now / Free slot"

        iare_knowledge_summary = (
            "IARE College Directory & Key Facts:\n"
            "- Principal: Dr. L. V. Narasimha Prasad (principal@iare.ac.in)\n"
            "- Dean Academics: Dr. C. Raghavendra (dean-academics@iare.ac.in) — Specialization: Machine Learning\n"
            "- Dean IQAC: Dr. Y. Mohana Roopa (iqac@iare.ac.in) — Specialization: Data Mining & Big Data\n"
            "- Dean Student Affairs: Dr. Gandham Ohm (dean-studentaffairs@iare.ac.in)\n"
            "- Head of CSE Department: Dr. K. Srinivasa Rao (cse_hod@iare.ac.in)\n"
            "- Placements: Highest 58.5 LPA, Average 6.8 LPA. Top Recruiters: Amazon, Microsoft, TCS, Infosys, Cognizant, Wipro\n"
            "- Location: Dundigal, Hyderabad (PIN 500043), near ORR Exit 5\n"
            "- Autonomous Regulations: R23 / R22 with 75% minimum mandatory attendance."
        )

        return (
            "You are the IARE Campus AI Companion, an ultra-smart, empathetic, and versatile generative AI assistant (like ChatGPT and Google Gemini) for university engineering students.\n"
            f"You are directly conversing with {name} (Roll No: {roll}), enrolled in {dept}, Year {year}, Sem {sem}, Section {sec}.\n\n"
            f"Student's Real Academic Telemetry:\n"
            f"- Overall Attendance: {att:.1f}% (Safe bunks buffer: {safe_bunks} classes)\n"
            f"- Today's Schedule:\n{today_sched_text}\n\n"
            f"{iare_knowledge_summary}\n\n"
            "Operating Guidelines:\n"
            "1. Answer ANY question asked by the student—spanning world knowledge, politics, leaders, science, mathematics, coding, system design, homework, career guidance, and campus life—accurately, richly, and concisely.\n"
            "2. Adapt your tone naturally: crisp and straightforward for quick factual questions, and comprehensive with code/diagrams for complex engineering concepts.\n"
            "3. If the student asks about their personal schedule or attendance, refer directly to their real academic telemetry.\n"
            "4. Never output hardcoded dummy strings or boilerplate quiz templates.\n"
        )
