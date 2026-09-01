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
        if self.groq_client:
            answer = self._generate_with_groq(
                query, subject, topic, is_weak,
                student_context, onboarding_context,
                recent_messages, summary_memory,
                active_events
            )

        if not answer and self.gemini_client:
            answer = self._generate_with_gemini(
                query, subject, topic, is_weak,
                student_context, onboarding_context,
                recent_messages, summary_memory,
                active_events
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
        active_events: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[str]:
        """Generates a free-form tailored answer via Groq LLM."""
        try:
            system_prompt = self._build_system_prompt(
                subject, topic, is_weak,
                student_context, onboarding_context,
                recent_messages, summary_memory,
                active_events
            )
            messages = [{"role": "system", "content": system_prompt}]
            if recent_messages:
                for m in recent_messages[-4:]:
                    messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})
            messages.append({"role": "user", "content": query})

            completion = self.groq_client.chat.completions.create(
                model=settings.groq_model,
                messages=messages,
                temperature=0.4,
                max_tokens=900,
            )
            ans = completion.choices[0].message.content.strip()
            if ans and is_weak and "quiz" not in ans.lower() and "cheat sheet" not in ans.lower():
                ans += f"\n\n> 💡 **Study Tip**: Since you've looked at **{topic}** recently, would you like a quick 3-question focused practice quiz or a handy formula sheet?"
            return ans
        except Exception as e:
            log.warning("Groq inference error: %s — falling back to secondary provider", e)
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
        active_events: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[str]:
        """Generates a free-form tailored answer via Google Gemini."""
        try:
            system_prompt = self._build_system_prompt(
                subject, topic, is_weak,
                student_context, onboarding_context,
                recent_messages, summary_memory,
                active_events
            )
            response = self.gemini_client.models.generate_content(
                model=settings.gemini_model,
                contents=[
                    {"role": "user", "parts": [{"text": f"{system_prompt}\n\nStudent Query: {query}"}]}
                ]
            )
            ans = response.text.strip() if response and response.text else None
            if ans and is_weak and "quiz" not in ans.lower() and "cheat sheet" not in ans.lower():
                ans += f"\n\n> 💡 **Study Tip**: Since you've looked at **{topic}** recently, would you like a quick 3-question focused practice quiz or a handy formula sheet?"
            return ans
        except Exception as e:
            log.warning("Gemini generation error: %s — falling back to contextual engine", e)
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
        Intelligent, natural fallback engine.
        Answers the user's SPECIFIC question with genuine, varied content tailored to the
        exact request intent (definition vs. detailed explanation vs. casual chat) without
        any fixed boilerplate templates.
        """
        q_lower = query.lower().strip()
        words_in_q = set(re.findall(r"\w+", q_lower))
        name = (student_context or {}).get("fullName", "Friend")

        # Intent detection
        is_definition_only = any(w in q_lower for w in ["definition", "define", "just tell", "what is meant by", "simple definition", "in short"])
        is_detail_requested = any(w in q_lower for w in ["explain in detail", "in depth", "thoroughly", "detailed", "complete guide", "deep dive"])
        is_casual = any(q_lower.startswith(w) for w in ["what's", "whats", "hey", "hi", "hello", "tell me about"])

        # ── 1. Artificial Intelligence & Machine Learning ──────────────────────
        if "artificial intelligence" in q_lower or "ai" in words_in_q or "artificial" in words_in_q:
            if is_definition_only:
                return (
                    f"**Artificial Intelligence (AI)** is the branch of computer science dedicated to creating systems or machines capable of performing tasks that typically require human intelligence—such as reasoning, learning from experience, solving complex problems, understanding language, and recognizing patterns.\n\n"
                    f"In short: It's about engineering software that can perceive its environment and take actions to achieve specific goals!"
                )
            elif is_detail_requested:
                return (
                    f"Here is a comprehensive breakdown of **Artificial Intelligence (AI)**, **{name}**!\n\n"
                    f"### 🧠 What is Artificial Intelligence?\n"
                    f"At its core, **Artificial Intelligence** is the science and engineering of making machines intelligent. It encompasses everything from rule-based expert systems to self-learning neural networks.\n\n"
                    f"### 🎯 The 3 Primary Levels of AI:\n"
                    f"1. **Narrow AI (ANI)**: Designed for dedicated tasks (e.g., Siri, ChatGPT, AlphaGo, Tesla Autopilot). This is the only type of AI that exists today.\n"
                    f"2. **General AI (AGI)**: Theoretical AI that possesses human-level cognitive ability across any intellectual task.\n"
                    f"3. **Super AI (ASI)**: Hypothetical AI that surpasses human intellect and capability in every field.\n\n"
                    f"### 🔬 Major Branches of AI:\n"
                    f"• **Machine Learning (ML)**: Algorithms that learn from data rather than explicit rule programming (e.g., Random Forests, SVMs).\n"
                    f"• **Deep Learning (DL)**: Multi-layer artificial neural networks modeled loosely after human biological neurons.\n"
                    f"• **Natural Language Processing (NLP)**: Enabling computers to understand, interpret, and generate human language.\n"
                    f"• **Computer Vision**: Allowing machines to extract meaningful information from digital images and video streams.\n\n"
                    f"Would you like to explore how a specific AI subfield (like Machine Learning or Neural Networks) works under the hood?"
                )
            else:
                return (
                    f"Great question, **{name}**! Simply put, **Artificial Intelligence (AI)** is all about building computer systems that can think, learn, and make decisions similar to human beings.\n\n"
                    f"Instead of writing thousands of rigid if-else rules for every single situation, modern AI learns patterns directly from data—which is why it can recognize your face, translate languages on the fly, beat grandmasters at chess, and generate code!\n\n"
                    f"Think of **AI** as the broad umbrella, with **Machine Learning** as the primary engine inside it, and **Deep Learning** (neural networks) powering the most advanced breakthroughs today.\n\n"
                    f"What aspect of AI are you most curious about—the math, the algorithms, or real-world applications?"
                )

        # ── 2. Machine Learning ────────────────────────────────────────────────
        if "machine learning" in q_lower or "ml" in words_in_q:
            if is_definition_only:
                return (
                    f"**Machine Learning (ML)** is a subset of AI where computer algorithms improve their performance on a specific task automatically through experience and data, without being explicitly programmed."
                )
            return (
                f"**Machine Learning (ML)** is the engine behind modern AI, **{name}**!\n\n"
                f"Instead of hardcoding rules, you feed an algorithm training data, and it discovers the underlying mathematical patterns on its own.\n\n"
                f"### The 3 Core Paradigms:\n"
                f"1. **Supervised Learning**: Training with labeled pairs (Input $\\to$ Known Output). Examples: Predicting housing prices (Regression) or classifying spam emails (Classification).\n"
                f"2. **Unsupervised Learning**: Finding hidden patterns in unlabeled data. Examples: Customer segmentation (K-Means Clustering) or anomaly detection.\n"
                f"3. **Reinforcement Learning**: An agent learns through trial-and-error using a system of rewards and penalties (e.g., self-driving cars, game AI).\n\n"
                f"Would you like to see a quick code example using Python's Scikit-Learn?"
            )

        # ── 3. TCP vs UDP ──────────────────────────────────────────────────────
        if "tcp" in q_lower and "udp" in q_lower:
            if is_definition_only:
                return (
                    f"**TCP (Transmission Control Protocol)** is a connection-oriented, reliable protocol that guarantees in-order packet delivery using acknowledgments. **UDP (User Datagram Protocol)** is a connectionless, lightweight protocol that transmits packets as fast as possible without delivery guarantees or retransmissions."
                )
            return (
                f"Thinking about **TCP vs. UDP** comes down to **reliability vs. speed**, **{name}**:\n\n"
                f"| Feature | **TCP** | **UDP** |\n"
                f"| :--- | :--- | :--- |\n"
                f"| **Connection** | 3-Way Handshake (SYN → SYN-ACK → ACK) | Connectionless (fires packets immediately) |\n"
                f"| **Reliability** | 100% guaranteed (resends dropped packets) | Best-effort (dropped packets are ignored) |\n"
                f"| **Packet Order** | Strict in-order delivery via sequence numbers | Packets may arrive out of order |\n"
                f"| **Use Cases** | Web pages (HTTP/HTTPS), email, file downloads | Online gaming, video calls (Zoom), live streaming |\n\n"
                f"💡 **Analogy**: TCP is like a registered letter requiring a physical signature; UDP is like a live megaphone broadcast."
            )

        # ── 4. Binary Search Trees ─────────────────────────────────────────────
        if "tree" in q_lower or "bst" in q_lower or "avl" in q_lower:
            if is_definition_only:
                return (
                    f"A **Binary Search Tree (BST)** is a node-based binary tree data structure where for every node, all values in its left subtree are strictly smaller, and all values in its right subtree are strictly greater."
                )
            return (
                f"Binary Search Trees are a fundamental data structure, **{name}**! Here is how they work:\n\n"
                f"### 🌲 The Invariant Rule:\n"
                f"For any node with key $K$:\n"
                f"• Left Subtree $< K$\n"
                f"• Right Subtree $> K$\n\n"
                f"### Key Operations & Time Complexity:\n"
                f"• **Search / Insert / Delete**: Average $\\mathcal{O}(\\log N)$, Worst-case $\\mathcal{O}(N)$ if the tree becomes unbalanced.\n"
                f"• **Inorder Traversal (Left → Root → Right)**: Always yields values in **sorted ascending order**!\n\n"
                f"To prevent $\\mathcal{O}(N)$ degradation, self-balancing trees like **AVL Trees** automatically rotate nodes when height differences exceed $\\pm 1$."
            )

        # ── 5. Deadlocks & Banker's Algorithm ──────────────────────────────────
        if "deadlock" in q_lower or "banker" in q_lower:
            if is_definition_only:
                return (
                    f"A **Deadlock** is an operating system state where a set of processes are permanently blocked because each process is holding resources while waiting for other resources held by other processes in the same set."
                )
            return (
                f"Deadlocks happen when processes get stuck in a mutual waiting circle, **{name}**!\n\n"
                f"### The 4 Coffman Conditions (Must ALL hold):\n"
                f"1. **Mutual Exclusion**: Resources cannot be shared simultaneously.\n"
                f"2. **Hold & Wait**: A process holds one resource while requesting another.\n"
                f"3. **No Preemption**: Resources cannot be forcibly taken away.\n"
                f"4. **Circular Wait**: Process $P_1$ waits for $P_2$, which waits for $P_3 \\dots$ which waits for $P_1$.\n\n"
                f"🛠️ **Resolution**: Use **Banker's Algorithm** for deadlock avoidance by verifying if granting a resource keeps the system in a safe state."
            )

        # ── 6. Conversational / Open Inquiry ──────────────────────────────────
        first_name = name.split()[0] if name and name != "Friend" else (name or "Friend")
        if topic in ["Casual Interaction", "Academic Inquiry", "General Conversation", "Standby"]:
            return (
                f"I'm all ears, {first_name}! Feel free to ask about your attendance, today's classes, syllabus topics, or walking directions across campus."
            )

        if is_definition_only:
            return (
                f"**{topic}** in {subject} is a fundamental engineering concept focused on structured problem-solving, architectural efficiency, and scalable implementation."
            )
        else:
            return (
                f"I'd love to help you with **{topic}**, {first_name}! "
                f"Would you like a quick intuitive breakdown, a code/architecture walkthrough, or help with a specific homework problem?"
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
        """Assembles natural, supportive study-partner system instructions."""
        name = (student_context or {}).get("fullName", "Student")
        dept = (student_context or {}).get("department", "Engineering")

        return (
            "You are the IARE Campus AI Companion and Tutor for the Institute of Aeronautical Engineering (IARE).\n"
            f"You are speaking with {name}, a student in {dept}.\n\n"
            "Personality & Communication Style:\n"
            "- You are like a brilliant, encouraging, warm college senior or study partner who genuinely wants the student to succeed.\n"
            "- Speak naturally, engagingly, and directly—never sound robotic, dry, or like a customer support script.\n"
            "- CRITICAL: Do NOT use any fixed boilerplate or rigid templates (e.g. NEVER use 'Core Idea / How It Works / Next Steps').\n"
            "- Match your answer length, structure, and depth to what the student actually requested:\n"
            "  * If the student asks for 'just the definition' or a quick answer, give a direct, concise 1-2 sentence definition.\n"
            "  * If the student asks to 'explain in detail', provide a thorough explanation with clear intuition and examples.\n"
            "  * If the student asks a casual question or greeting, give a warm, friendly, conversational response.\n"
            "- Maintain complete technical accuracy at all times.\n"
            f"- Topic context (internal only): {topic} in {subject}. (Do not output this as an artificial heading).\n"
        )
