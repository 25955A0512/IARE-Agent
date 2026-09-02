"""
assessment_engine.py — Engineering Technical Assessment & Proctoring Engine.

Generates subject-specific timed quizzes and technical assessments for engineering students
(Data Structures, Algorithms, OS, DBMS, Networks, Machine Learning, Python, Java),
evaluates student submissions, provides instant explanations, and tracks topic mastery.
"""

import json
import logging
import random
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

# Curated Engineering Technical Assessment Bank
ENGINEERING_ASSESSMENTS: Dict[str, Dict[str, Any]] = {
    "data_structures": {
        "title": "Data Structures & Algorithms Mastery Assessment",
        "subject": "Data Structures & Algorithms",
        "duration_minutes": 5,
        "questions": [
            {
                "id": 1,
                "question": "What is the worst-case time complexity of searching for an element in an unbalanced Binary Search Tree (BST)?",
                "options": ["O(log N)", "O(1)", "O(N)", "O(N log N)"],
                "correct_index": 2,
                "explanation": "In an unbalanced (skewed) BST, elements form a linear chain like a linked list, degrading search time complexity to O(N)."
            },
            {
                "id": 2,
                "question": "Which data structure is primarily used to implement Depth First Search (DFS) on a graph?",
                "options": ["Queue", "Stack", "Priority Queue", "Circular Buffer"],
                "correct_index": 1,
                "explanation": "DFS operates on a Last-In-First-Out (LIFO) order, which is natively implemented using a Stack (or call stack recursion)."
            },
            {
                "id": 3,
                "question": "In Dijkstra's algorithm for single-source shortest paths with non-negative edge weights, what is the optimal time complexity using a Fibonacci Heap?",
                "options": ["O(V^2)", "O(E + V log V)", "O(E log V)", "O(V * E)"],
                "correct_index": 1,
                "explanation": "Using a Fibonacci Heap, Dijkstra's algorithm achieves O(E + V log V), making it optimal for dense and sparse non-negative graphs."
            },
            {
                "id": 4,
                "question": "What is the space complexity of Breadth First Search (BFS) on a balanced tree with branching factor b and depth d?",
                "options": ["O(d)", "O(b * d)", "O(b^d)", "O(1)"],
                "correct_index": 2,
                "explanation": "BFS stores all nodes at the current level in memory within the queue. At depth d, the frontier contains up to O(b^d) nodes."
            },
            {
                "id": 5,
                "question": "Which sorting algorithm is guaranteed to have O(N log N) time complexity in the worst-case while also being stable?",
                "options": ["Quick Sort", "Heap Sort", "Merge Sort", "Selection Sort"],
                "correct_index": 2,
                "explanation": "Merge Sort always divides the array evenly, guaranteeing O(N log N) worst-case time complexity, and maintains the relative order of equal elements (stable)."
            }
        ]
    },
    "operating_systems": {
        "title": "Operating Systems & Concurrency Assessment",
        "subject": "Operating Systems",
        "duration_minutes": 5,
        "questions": [
            {
                "id": 1,
                "question": "Which of the following is NOT one of the four necessary Coffman conditions for a Deadlock to occur?",
                "options": ["Mutual Exclusion", "Hold and Wait", "Preemption Allowed", "Circular Wait"],
                "correct_index": 2,
                "explanation": "The condition is 'No Preemption'. If preemption is allowed, deadlocks cannot persist because resources can be reclaimed forcibly."
            },
            {
                "id": 2,
                "question": "What is the primary role of the Banker's Algorithm in modern operating systems?",
                "options": ["Deadlock Detection", "Deadlock Avoidance", "CPU Scheduling", "Page Replacement"],
                "correct_index": 1,
                "explanation": "Banker's Algorithm is a Deadlock Avoidance algorithm that simulates resource allocation to ensure the system remains in a safe state before granting requests."
            },
            {
                "id": 3,
                "question": "What happens during 'Thrashing' in virtual memory systems?",
                "options": [
                    "CPU utilization reaches 100% due to computation",
                    "Processes spend more time paging in/out than executing instructions",
                    "Deadlock occurs across multiple process threads",
                    "Hardware registers overheat due to clock frequency"
                ],
                "correct_index": 1,
                "explanation": "Thrashing occurs when the total working sets of active processes exceed available physical RAM, causing continuous page faults."
            },
            {
                "id": 4,
                "question": "Which CPU scheduling algorithm is mathematically proven to achieve the minimal average waiting time for a given set of stationary processes?",
                "options": ["Round Robin (RR)", "Shortest Job First (SJF)", "First-Come First-Served (FCFS)", "Priority Scheduling"],
                "correct_index": 1,
                "explanation": "Shortest Job First (SJF / SRTF) is provably optimal for minimizing average waiting time by executing shorter bursts first."
            },
            {
                "id": 5,
                "question": "How does a counting semaphore differ from a binary mutex?",
                "options": [
                    "A mutex can have values up to N, while semaphores are only 0 or 1",
                    "A counting semaphore manages access to a finite pool of N identical resources",
                    "Semaphores only operate in kernel space, mutexes in user space",
                    "There is no difference"
                ],
                "correct_index": 1,
                "explanation": "A counting semaphore initialized with value N allows up to N concurrent threads to access a pool of shared resources."
            }
        ]
    },
    "machine_learning": {
        "title": "Machine Learning & AI Engineering Assessment",
        "subject": "Artificial Intelligence & ML",
        "duration_minutes": 5,
        "questions": [
            {
                "id": 1,
                "question": "What problem does the ReLU (Rectified Linear Unit) activation function primarily mitigate compared to Sigmoid in deep networks?",
                "options": ["Overfitting", "Vanishing Gradient Problem", "Underfitting", "High Computational Latency"],
                "correct_index": 1,
                "explanation": "For positive inputs, the derivative of ReLU is 1.0, preventing gradients from shrinking exponentially across multiple deep layers."
            },
            {
                "id": 2,
                "question": "In the Bias-Variance Tradeoff, what does high variance in a predictive model typically indicate?",
                "options": ["The model is underfitting the training data", "The model is overfitting and highly sensitive to training fluctuations", "The dataset is too large", "The learning rate is too low"],
                "correct_index": 1,
                "explanation": "High variance means the model captures noise in the training set (overfitting), leading to poor generalization on unseen test data."
            },
            {
                "id": 3,
                "question": "What is the core mechanism of the Transformer architecture (Vaswani et al., 2017)?",
                "options": ["Recurrent LSTM Cells", "Convolutional Max-Pooling", "Multi-Head Self-Attention", "Markov Decision Processes"],
                "correct_index": 2,
                "explanation": "Transformers rely entirely on Multi-Head Self-Attention to compute relationships between all tokens in parallel without recurrence."
            },
            {
                "id": 4,
                "question": "Which metric is most appropriate for evaluating a classification model on an extremely imbalanced dataset (e.g., 99% negative, 1% positive)?",
                "options": ["Accuracy", "F1-Score / PR-AUC", "Mean Squared Error", "R-Squared"],
                "correct_index": 1,
                "explanation": "Accuracy is misleading on imbalanced datasets (predicting all negatives yields 99% accuracy). F1-Score (harmonic mean of Precision & Recall) evaluates true performance."
            },
            {
                "id": 5,
                "question": "In Supervised Learning, how does L1 Regularization (Lasso) differ from L2 Regularization (Ridge)?",
                "options": [
                    "L1 produces sparse weights (feature selection), while L2 shrinks weights smoothly",
                    "L2 produces sparse weights, L1 does not",
                    "L1 cannot be used for linear regression",
                    "L2 is only used in unsupervised clustering"
                ],
                "correct_index": 0,
                "explanation": "L1 regularization adds the absolute value of coefficients (|w|), driving uninformative feature weights strictly to zero (sparse feature selection)."
            }
        ]
    },
    "database_systems": {
        "title": "DBMS & Distributed Systems Assessment",
        "subject": "Database Management Systems",
        "duration_minutes": 5,
        "questions": [
            {
                "id": 1,
                "question": "What does the 'I' in ACID transaction properties stand for?",
                "options": ["Integrity", "Isolation", "Indexing", "Immutability"],
                "correct_index": 1,
                "explanation": "Isolation ensures that concurrent execution of transactions leaves the database in the same state as if transactions were executed serially."
            },
            {
                "id": 2,
                "question": "Which normal form requires the elimination of transitive functional dependencies on the primary key?",
                "options": ["1NF", "2NF", "3NF", "BCNF"],
                "correct_index": 2,
                "explanation": "Third Normal Form (3NF) requires a relation to be in 2NF and have no non-prime attribute transitively dependent on any candidate key."
            },
            {
                "id": 3,
                "question": "Why are B+ Trees preferred over standard Binary Search Trees for disk-based database indexing?",
                "options": [
                    "B+ Trees have lower fan-out and deeper depth",
                    "High fan-out minimizes disk I/O reads, and leaf linked-lists enable fast range scans",
                    "B+ Trees do not require rebalancing",
                    "B+ Trees store all data exclusively in RAM"
                ],
                "correct_index": 1,
                "explanation": "B+ Trees have massive fan-out (hundreds of keys per block), drastically reducing disk I/O operations, with doubly linked leaf nodes for rapid range queries."
            }
        ]
    }
}


class AssessmentEngine:
    """Handles generation and evaluation of engineering assessments."""

    def get_available_topics(self) -> List[Dict[str, Any]]:
        """Returns list of active technical subjects for assessment."""
        topics = []
        for key, val in ENGINEERING_ASSESSMENTS.items():
            topics.append({
                "id": key,
                "title": val["title"],
                "subject": val["subject"],
                "questions_count": len(val["questions"]),
                "duration_minutes": val["duration_minutes"]
            })
        return topics

    def start_assessment(self, topic_id: str) -> Dict[str, Any]:
        """Generates an assessment session for a student."""
        assessment = ENGINEERING_ASSESSMENTS.get(topic_id)
        if not assessment:
            topic_id = "data_structures"
            assessment = ENGINEERING_ASSESSMENTS["data_structures"]

        client_questions = []
        for q in assessment["questions"]:
            client_questions.append({
                "id": q["id"],
                "question": q["question"],
                "options": q["options"]
            })

        return {
            "success": True,
            "topic_id": topic_id,
            "title": assessment["title"],
            "subject": assessment["subject"],
            "duration_minutes": assessment["duration_minutes"],
            "questions": client_questions
        }

    def evaluate_submission(self, topic_id: str, student_answers: Dict[int, int]) -> Dict[str, Any]:
        """Evaluates student answers and provides detailed scoring and explanations."""
        assessment = ENGINEERING_ASSESSMENTS.get(topic_id, ENGINEERING_ASSESSMENTS["data_structures"])
        questions = assessment["questions"]
        total = len(questions)
        correct_count = 0
        breakdown = []

        for q in questions:
            qid = q["id"]
            correct_idx = q["correct_index"]
            chosen_idx = student_answers.get(qid, student_answers.get(str(qid)))
            is_correct = (chosen_idx == correct_idx)
            if is_correct:
                correct_count += 1

            breakdown.append({
                "id": qid,
                "question": q["question"],
                "chosen_option": q["options"][chosen_idx] if chosen_idx is not None and 0 <= chosen_idx < len(q["options"]) else "Not Attempted",
                "correct_option": q["options"][correct_idx],
                "is_correct": is_correct,
                "explanation": q["explanation"]
            })

        score_pct = (correct_count / total) * 100.0 if total > 0 else 0.0
        grade = "Distinction 🌟" if score_pct >= 80 else ("Proficient 👏" if score_pct >= 60 else "Needs Review 📚")

        return {
            "success": True,
            "topic_id": topic_id,
            "subject": assessment["subject"],
            "title": assessment["title"],
            "score": correct_count,
            "total_questions": total,
            "percentage": score_pct,
            "grade": grade,
            "breakdown": breakdown
        }
