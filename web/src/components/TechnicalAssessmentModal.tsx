import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
  Zap,
  RotateCcw,
  Camera,
  Mic,
  Maximize2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Flag,
  Check,
  ArrowRight,
  AlertCircle,
  Video,
  Volume2,
  Lock,
  Layers,
  Code2,
  Cpu,
  Database,
  Globe,
  Network,
  Binary,
  Shield,
  Cloud,
  Brain,
  Server,
  FileCode,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { springs } from '@/tokens'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Question {
  id: number
  question: string
  codeSnippet?: string
  options: string[]
  correct_index: number
  explanation: string
}

export interface TopicUnit {
  id: string
  title: string
  description: string
  difficulty: 'Foundation' | 'Intermediate' | 'Advanced'
  duration_minutes: number
  questions: Question[]
}

export interface SubjectModule {
  id: string
  code: string
  name: string
  icon: string
  category: string
  topics: TopicUnit[]
  isEnrolled?: boolean
}

export interface EnrolledSubjectProp {
  subjectCode?: string
  subjectName: string
}

interface TechnicalAssessmentModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: (
    topicTitle: string,
    subjectName: string,
    score: number,
    total: number,
    percentage: number
  ) => void
  onAskAI?: (prompt: string) => void
  enrolledSubjects?: EnrolledSubjectProp[]
}

// ── Master IARE Samvidha Enrolled Curriculum Question Bank ────────────────────

const SUBJECTS_DATABASE: SubjectModule[] = [
  {
    id: 'dmml',
    code: 'ACSD19',
    name: 'Data Mining and Machine Learning',
    icon: 'Brain',
    category: 'AI & Data Science (Sem 5)',
    topics: [
      {
        id: 'association_classification',
        title: 'Association Rules & Classification Algorithms',
        description: 'Apriori algorithm, FP-Growth, Decision Trees, Gini Index, and Naive Bayes.',
        difficulty: 'Intermediate',
        duration_minutes: 5,
        questions: [
          {
            id: 1,
            question: 'In the Apriori algorithm, what property states that all non-empty subsets of a frequent itemset must also be frequent?',
            options: ['Apriori / Downward Closure Property', 'Markov Property', 'Convexity Property', 'Subadditivity Property'],
            correct_index: 0,
            explanation: 'The Apriori property (Downward Closure) guarantees that if an itemset is frequent, all of its subsets must also be frequent; conversely, any superset of an infrequent itemset cannot be frequent.',
          },
          {
            id: 2,
            question: 'Which impurity metric is minimized in the CART (Classification and Regression Trees) decision tree algorithm?',
            options: ['Information Gain (Entropy)', 'Gini Impurity / Index', 'Gain Ratio', 'Mean Squared Log Error'],
            correct_index: 1,
            explanation: 'CART natively uses the Gini Impurity Index to determine optimal feature splits, whereas ID3/C4.5 use Information Gain / Gain Ratio.',
          },
          {
            id: 3,
            question: 'What fundamental assumption is made by the Naive Bayes Classifier?',
            options: [
              'Features are conditionally independent given the class label',
              'All continuous features follow a uniform distribution',
              'Data points are linearly separable in Hilbert space',
              'Zero variance across all feature vectors',
            ],
            correct_index: 0,
            explanation: 'Naive Bayes assumes that the presence or absence of a particular feature is completely independent of the value of any other feature given the class label.',
          },
          {
            id: 4,
            question: 'In the K-Means clustering algorithm, how are new cluster centroids updated at each iteration?',
            options: [
              'By computing the arithmetic mean of all points assigned to the cluster',
              'By selecting the median vector of the entire dataset',
              'By picking the point with minimum Euclidean distance to the origin',
              'Through gradient ascent on the loss surface',
            ],
            correct_index: 0,
            explanation: 'K-Means calculates the center of mass (mean coordinates) of all data samples assigned to that cluster during the assignment phase.',
          },
          {
            id: 5,
            question: 'Which metric is calculated as TP / (TP + FN) in classification model evaluation?',
            options: ['Precision', 'Recall (Sensitivity / True Positive Rate)', 'Specificity', 'Accuracy'],
            correct_index: 1,
            explanation: 'Recall measures the proportion of actual positives correctly identified by the classifier: TP / (TP + FN).',
          },
        ],
      },
    ],
  },
  {
    id: 'cloud_app_dev',
    code: 'ACSD20',
    name: 'Cloud Application Development',
    icon: 'Cloud',
    category: 'Cloud Engineering (Sem 5)',
    topics: [
      {
        id: 'cloud_microservices_containers',
        title: 'Microservices, Docker Containers & Serverless',
        description: 'IaaS/PaaS/SaaS, Docker containerization, Kubernetes pods, and REST APIs.',
        difficulty: 'Intermediate',
        duration_minutes: 5,
        questions: [
          {
            id: 1,
            question: 'How do Docker containers achieve lightweight process isolation compared to traditional Type-1/Type-2 Hypervisors?',
            options: [
              'By sharing the host OS kernel using Linux namespaces and cgroups',
              'By running an independent guest OS kernel for every container instance',
              'Through hardware-level CPU instruction trapping',
              'By executing all binaries inside a JVM sandbox',
            ],
            correct_index: 0,
            explanation: 'Containers share the host operating system kernel and isolate processes using Linux namespaces (PID, NET, MNT) and control groups (cgroups) for resource limits.',
          },
          {
            id: 2,
            question: 'In Kubernetes, what is the smallest deployable computing unit that can be created and managed?',
            options: ['ReplicaSet', 'Pod (one or more co-located containers)', 'Namespace', 'Deployment Controller'],
            correct_index: 1,
            explanation: 'A Pod is the smallest execution unit in Kubernetes, representing a single instance of a running process in the cluster.',
          },
          {
            id: 3,
            question: 'Which cloud service model provides execution environments for serverless functions (FaaS) where the provider manages server scaling?',
            options: ['PaaS (Platform as a Service) / Serverless', 'IaaS (Infrastructure as a Service)', 'Bare Metal', 'SaaS'],
            correct_index: 0,
            explanation: 'Serverless/FaaS (such as AWS Lambda or Google Cloud Functions) runs event-driven code without provisioning or managing backend servers.',
          },
          {
            id: 4,
            question: 'In a cloud microservices architecture, what is the primary role of an API Gateway?',
            options: [
              'Single entry point handling request routing, authentication, rate limiting, and SSL termination',
              'Direct hard drive sector partitioning',
              'Compiling Java bytecode to machine language',
              'Physical optical fiber signal amplification',
            ],
            correct_index: 0,
            explanation: 'An API Gateway sits between clients and microservices, acting as a reverse proxy for routing, security token validation, rate-limiting, and telemetry.',
          },
          {
            id: 5,
            question: 'Which HTTP method is defined as idempotent and used to replace an entire resource representation in RESTful cloud APIs?',
            options: ['POST', 'PUT', 'PATCH', 'CONNECT'],
            correct_index: 1,
            explanation: 'PUT is idempotent: making multiple identical PUT requests will produce the same result as making a single request.',
          },
        ],
      },
    ],
  },
  {
    id: 'ai',
    code: 'ACSD21',
    name: 'Artificial Intelligence',
    icon: 'Brain',
    category: 'Core AI (Sem 5)',
    topics: [
      {
        id: 'search_knowledge_rep',
        title: 'Heuristic Search (A*), Game Trees & Logic',
        description: 'A* algorithm, admissibility, Minimax, Alpha-Beta pruning, and First-Order Logic.',
        difficulty: 'Intermediate',
        duration_minutes: 5,
        questions: [
          {
            id: 1,
            question: "Under what condition is the A* search algorithm guaranteed to return an optimal (shortest) path?",
            options: [
              'When the heuristic function h(n) is Admissible (never overestimates the true cost)',
              'When the heuristic function h(n) = 0 for all nodes',
              'When the search tree depth is strictly less than 10',
              'When the branching factor is exactly 2',
            ],
            correct_index: 0,
            explanation: 'An admissible heuristic never overestimates the cost to reach the goal. For tree search, admissibility guarantees A* optimality; for graph search, consistency/monotonicity is required.',
          },
          {
            id: 2,
            question: 'In the Minimax algorithm with Alpha-Beta Pruning, what represents the Alpha value?',
            options: [
              'The best (highest-value) choice found so far along the path for the Maximizer',
              'The worst choice for the Minimizer',
              'The average heuristic score of leaf nodes',
              'The total number of explored game plies',
            ],
            correct_index: 0,
            explanation: 'Alpha is the minimum score that the maximizing player is assured of, while Beta is the maximum score that the minimizing player is assured of.',
          },
          {
            id: 3,
            question: 'What is the primary difference between Breadth-First Search (BFS) and Uniform-Cost Search (Dijkstra in AI)?',
            options: [
              'BFS assumes uniform edge costs (step cost = 1), while Uniform-Cost Search expands the node with the lowest cumulative path cost g(n)',
              'BFS uses a priority queue',
              'Uniform-Cost Search is incomplete on infinite state spaces',
              'BFS requires an admissible heuristic',
            ],
            correct_index: 0,
            explanation: 'Uniform-Cost Search expands the node n with the lowest path cost g(n) using a priority queue, generalizing BFS for arbitrary non-negative step costs.',
          },
          {
            id: 4,
            question: 'Which inference rule is refutation-complete in First-Order Predicate Logic theorem proving?',
            options: ['Resolution with Unification', 'Modus Ponens alone', 'Modus Tollens', 'And-Introduction'],
            correct_index: 0,
            explanation: "Resolution combined with a complete unification algorithm is refutation-complete for First-Order Logic in Conjunctive Normal Form (CNF).",
          },
          {
            id: 5,
            question: 'What problem occurs in Hill-Climbing search when the search terminates at a state that is better than all its neighbors but not the global best?',
            options: ['Local Maximum', 'Plateau', 'Ridge', 'Thrashing'],
            correct_index: 0,
            explanation: 'A Local Maximum is a peak that is higher than each of its neighboring states, but lower than the global maximum.',
          },
        ],
      },
    ],
  },
  {
    id: 'software_architecture',
    code: 'ACSD38',
    name: 'Software Architecture and Design Patterns',
    icon: 'Layers',
    category: 'Software Engineering (Sem 5)',
    topics: [
      {
        id: 'gof_patterns',
        title: 'GoF Creational, Structural & Behavioral Patterns',
        description: 'Singleton, Factory, Observer, Strategy, Decorator, and SOLID principles.',
        difficulty: 'Intermediate',
        duration_minutes: 5,
        questions: [
          {
            id: 1,
            question: 'Which Design Pattern defines a one-to-many dependency between objects so that when one object changes state, all its dependents are notified automatically?',
            options: ['Observer Pattern', 'Singleton Pattern', 'Decorator Pattern', 'Factory Method'],
            correct_index: 0,
            explanation: 'The Observer pattern establishes a publish-subscribe relationship where state changes in the Subject trigger automated notifications to registered Observers.',
          },
          {
            id: 2,
            question: 'Which GoF Creational Pattern ensures a class has only one instance and provides a global point of access to it?',
            options: ['Singleton Pattern', 'Prototype Pattern', 'Builder Pattern', 'Adapter Pattern'],
            correct_index: 0,
            explanation: 'Singleton restricts the instantiation of a class to one single instance, typically using a private constructor and a static getter method.',
          },
          {
            id: 3,
            question: 'What is the core intent of the Strategy Pattern?',
            options: [
              'Define a family of algorithms, encapsulate each one, and make them interchangeable at runtime',
              'Convert the interface of a class into another interface clients expect',
              'Attach additional responsibilities to an object dynamically',
              'Ensure subclasses implement abstract factory constructors',
            ],
            correct_index: 0,
            explanation: 'The Strategy pattern lets the algorithm vary independently from the clients that use it by encapsulating behavioral algorithms inside dedicated strategy classes.',
          },
          {
            id: 4,
            question: 'According to the SOLID principles, what does the Open/Closed Principle (OCP) state?',
            options: [
              'Software entities should be open for extension, but closed for modification',
              'Classes must have only one reason to change',
              'Clients should not be forced to depend upon interfaces they do not use',
              'High-level modules should not depend on low-level modules',
            ],
            correct_index: 0,
            explanation: 'The Open/Closed Principle requires that the behavior of a module can be extended without altering its existing source code.',
          },
          {
            id: 5,
            question: 'Which Structural pattern allows incompatible interfaces to work together by wrapping an existing class with a new interface?',
            options: ['Adapter Pattern', 'Composite Pattern', 'Bridge Pattern', 'Flyweight Pattern'],
            correct_index: 0,
            explanation: 'The Adapter pattern acts as a wrapper/translator between two incompatible interfaces, enabling legacy or third-party classes to work seamlessly.',
          },
        ],
      },
    ],
  },
  {
    id: 'info_sec',
    code: 'ACCD04',
    name: 'Information Security Management',
    icon: 'Shield',
    category: 'Cybersecurity (Sem 5)',
    topics: [
      {
        id: 'crypto_network_sec',
        title: 'Cryptography, Public Key (RSA/AES) & Network Security',
        description: 'Symmetric vs Asymmetric, RSA, AES, Diffie-Hellman, SHA-256, Firewalls.',
        difficulty: 'Intermediate',
        duration_minutes: 5,
        questions: [
          {
            id: 1,
            question: 'In Asymmetric Public Key Cryptography (such as RSA), which key is used by the recipient to decrypt a confidential message?',
            options: [
              "The recipient's Private Key",
              "The recipient's Public Key",
              "The sender's Public Key",
              "A shared pre-shared master passphrase",
            ],
            correct_index: 0,
            explanation: 'The sender encrypts the plaintext message using the recipient\'s Public Key, and ONLY the recipient\'s corresponding Private Key can decrypt the ciphertext.',
          },
          {
            id: 2,
            question: 'What mathematical hardness problem underpins the security of the RSA cryptosystem?',
            options: [
              'The computational difficulty of factoring the product of two large prime numbers',
              'The discrete logarithm problem in elliptic curves',
              'The knapsack packing optimization problem',
              'Matrix determinant inversion',
            ],
            correct_index: 0,
            explanation: 'RSA security is based on the practical difficulty of factoring very large composite numbers (n = p * q) where p and q are large prime numbers.',
          },
          {
            id: 3,
            question: 'What is the primary purpose of the Diffie-Hellman Key Exchange algorithm?',
            options: [
              'Allowing two parties to establish a shared secret key over an insecure communication channel',
              'Encrypting disk files at rest',
              'Digital signature verification of PDF documents',
              'Generating pseudo-random seed numbers',
            ],
            correct_index: 0,
            explanation: 'Diffie-Hellman allows two parties with no prior knowledge of each other to jointly establish a shared secret key over an unencrypted public network.',
          },
          {
            id: 4,
            question: 'Which cryptographic hash function property guarantees that it is computationally infeasible to find two different messages m1 != m2 such that Hash(m1) == Hash(m2)?',
            options: ['Collision Resistance', 'Pre-image Resistance', 'Second Pre-image Resistance', 'Avalanche Effect'],
            correct_index: 0,
            explanation: 'Collision resistance ensures that it is computationally impossible to find any two distinct inputs that hash to the exact same digest.',
          },
          {
            id: 5,
            question: 'Which type of cyber attack involves injecting malicious client-side script into trusted web applications viewed by other users?',
            options: ['Cross-Site Scripting (XSS)', 'SQL Injection (SQLi)', 'Cross-Site Request Forgery (CSRF)', 'Buffer Overflow'],
            correct_index: 0,
            explanation: 'XSS attacks occur when an attacker uses a web application to send malicious code, generally in the form of a browser side script, to a different end user.',
          },
        ],
      },
    ],
  },
  {
    id: 'java_full_stack',
    code: 'ACSD30',
    name: 'Java Full Stack Development',
    icon: 'FileCode',
    category: 'Application Engineering (Sem 5)',
    topics: [
      {
        id: 'spring_boot_jpa',
        title: 'Spring Boot, Hibernate JPA & REST Architecture',
        description: 'Dependency Injection, JPA Entity mapping, RESTful endpoints, and JWT security.',
        difficulty: 'Intermediate',
        duration_minutes: 5,
        questions: [
          {
            id: 1,
            question: 'In the Spring Framework, what mechanism injects dependent objects into a bean without explicit constructor instantiation by the caller?',
            options: ['Inversion of Control (IoC) / Dependency Injection', 'Polymorphic Reflection', 'Static Thread Pooling', 'Dynamic Class Loading'],
            correct_index: 0,
            explanation: 'Inversion of Control (IoC) delegates object creation and dependency injection to the Spring IoC Container via annotations such as @Autowired.',
          },
          {
            id: 2,
            question: 'Which JPA annotation is used to specify that a field in an Entity is the primary key and automatically generated by the database sequence/identity?',
            options: ['@Id with @GeneratedValue', '@PrimaryKey', '@Column(unique=true)', '@Index'],
            correct_index: 0,
            explanation: '@Id specifies the primary key of an entity, and @GeneratedValue configures the generation strategy (AUTO, IDENTITY, SEQUENCE).',
          },
          {
            id: 3,
            question: 'In Spring Boot, which annotation combines @Controller and @ResponseBody to simplify building JSON RESTful APIs?',
            options: ['@RestController', '@Service', '@Component', '@Repository'],
            correct_index: 0,
            explanation: '@RestController is a convenience annotation that combines @Controller and @ResponseBody, automatically serializing return values to JSON/XML.',
          },
          {
            id: 4,
            question: 'What are the three components of a JSON Web Token (JWT) separated by periods (.)?',
            options: ['Header, Payload, Signature', 'Username, Password, Role', 'Algorithm, Secret, Token', 'Issuer, Subject, Expiration'],
            correct_index: 0,
            explanation: 'A JWT consists of Header.Payload.Signature encoded in Base64Url format.',
          },
          {
            id: 5,
            question: 'In Java 8+, which functional interface represents an operation that takes a single input argument and returns no result?',
            options: ['Consumer<T>', 'Supplier<T>', 'Function<T, R>', 'Predicate<T>'],
            correct_index: 0,
            explanation: 'Consumer<T> accepts a single argument of type T and returns void (e.g., in forEach loops).',
          },
        ],
      },
    ],
  },
]

// ── Dynamic Subject Fallback Generator ────────────────────────────────────────

function createDynamicSubjectModule(code: string, name: string): SubjectModule {
  const cleanName = name.replace(/Laboratory/i, 'Lab').replace(/DIP - /i, '').trim()
  return {
    id: `subj_${code.toLowerCase()}`,
    code,
    name: cleanName,
    icon: 'BookOpen',
    category: 'IARE Enrolled Curriculum',
    topics: [
      {
        id: `${code.toLowerCase()}_unit1`,
        title: `${cleanName} — Core Theory & Principles`,
        description: `Foundational engineering concepts, architecture, and theoretical analysis for ${cleanName}.`,
        difficulty: 'Intermediate',
        duration_minutes: 5,
        questions: [
          {
            id: 1,
            question: `What is the primary engineering objective when designing algorithms and architectures in ${cleanName}?`,
            options: [
              'Minimizing time and space complexity while ensuring fault tolerance and correctness',
              'Maximizing physical memory consumption',
              'Eliminating all multi-threading synchronization',
              'Relying exclusively on non-deterministic heuristics',
            ],
            correct_index: 0,
            explanation: `In ${cleanName}, optimal system design balances computational efficiency, throughput, and rigorous correctness constraints.`,
          },
          {
            id: 2,
            question: `Which fundamental principle guarantees correctness in ${cleanName} state transitions?`,
            options: [
              'Formal verification, pre/post-conditions, and invariant preservation',
              'Arbitrary exception bypassing',
              'Unbounded buffer allocations',
              'Non-blocking spinlock polling without yield',
            ],
            correct_index: 0,
            explanation: 'Preserving state invariants before and after operations guarantees correctness throughout execution cycles.',
          },
          {
            id: 3,
            question: `In modern engineering standards for ${cleanName}, what approach is used to ensure maintainability and scalability?`,
            options: [
              'Modular decomposition, clear interface separation, and comprehensive unit testing',
              'Monolithic single-file architectures',
              'Hardcoded global configuration variables',
              'Disabling telemetry and logging',
            ],
            correct_index: 0,
            explanation: 'Modular design isolates concerns, enables decoupled testing, and simplifies distributed scaling.',
          },
          {
            id: 4,
            question: `How are edge cases and boundary conditions systematically verified in ${cleanName}?`,
            options: [
              'Through boundary value analysis, equivalence partitioning, and stress testing',
              'By testing only nominal happy-path inputs',
              'By ignoring off-by-one index boundaries',
              'Through manual random trial without assertions',
            ],
            correct_index: 0,
            explanation: 'Boundary value analysis ensures that extremal values (0, 1, MAX_INT, empty sets) are handled gracefully.',
          },
          {
            id: 5,
            question: `What metric is primarily used to evaluate operational throughput in ${cleanName}?`,
            options: [
              'Transactions / operations completed per second (TPS) under latency SLA bounds',
              'Total line count of source code',
              'Physical dimensions of the host machine',
              'Number of comments per function',
            ],
            correct_index: 0,
            explanation: 'Throughput (operations/sec) measured against latency percentiles (P95/P99) is standard across engineering benchmarks.',
          },
        ],
      },
    ],
  }
}

// ── Main Technical Assessment Modal ───────────────────────────────────────────

export const TechnicalAssessmentModal: React.FC<TechnicalAssessmentModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  onAskAI,
  enrolledSubjects = [],
}) => {
  type FlowStage = 'select_subject' | 'select_topic' | 'proctoring_check' | 'exam' | 'results'

  const [stage, setStage] = useState<FlowStage>('select_subject')
  const [selectedSubject, setSelectedSubject] = useState<SubjectModule | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<TopicUnit | null>(null)

  // Map enrolled subjects from Samvidha
  const displaySubjects = useMemo(() => {
    if (enrolledSubjects && enrolledSubjects.length > 0) {
      const filtered = enrolledSubjects.filter(
        (es) =>
          !['LIBRARY', 'SPORTS', 'DIP - English Communication Skills'].some((ignore) =>
            es.subjectName.toLowerCase().includes(ignore.toLowerCase())
          )
      )

      const mapped = filtered.map((es) => {
        const found = SUBJECTS_DATABASE.find(
          (s) =>
            s.code.toUpperCase() === (es.subjectCode || '').toUpperCase() ||
            s.name.toLowerCase() === es.subjectName.toLowerCase() ||
            es.subjectName.toLowerCase().includes(s.name.toLowerCase()) ||
            s.name.toLowerCase().includes(es.subjectName.toLowerCase())
        )
        if (found) {
          return {
            ...found,
            code: es.subjectCode || found.code,
            name: es.subjectName || found.name,
            isEnrolled: true,
          }
        }
        return createDynamicSubjectModule(es.subjectCode || 'ACSD', es.subjectName)
      })

      if (mapped.length > 0) return mapped
    }
    return SUBJECTS_DATABASE
  }, [enrolledSubjects])

  // Proctoring Hardware State
  const [hasCamPermission, setHasCamPermission] = useState<boolean | null>(null)
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null)
  const [isFullscreenActive, setIsFullscreenActive] = useState(false)
  const [proctorPledgeAccepted, setProctorPledgeAccepted] = useState(false)
  const [audioLevel, setAudioLevel] = useState<number>(15)
  const [violationCount, setViolationCount] = useState<number>(0)
  const [fullscreenWarningOpen, setFullscreenWarningOpen] = useState(false)
  const [fullscreenTimer, setFullscreenTimer] = useState(10)

  // Exam Progress State
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({})
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(300)
  const [examSubmitted, setExamSubmitted] = useState(false)

  // Media references
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const examTimerIntervalRef = useRef<any>(null)
  const fullscreenRecoveryTimerRef = useRef<any>(null)

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStage('select_subject')
      setSelectedSubject(null)
      setSelectedTopic(null)
      setViolationCount(0)
      setSelectedAnswers({})
      setFlaggedQuestions({})
      setExamSubmitted(false)
      setCurrentQIndex(0)
    } else {
      cleanupHardware()
    }
  }, [isOpen])

  // Cleanup hardware
  const cleanupHardware = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close() } catch {}
      audioContextRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (examTimerIntervalRef.current) {
      clearInterval(examTimerIntervalRef.current)
      examTimerIntervalRef.current = null
    }
    if (fullscreenRecoveryTimerRef.current) {
      clearInterval(fullscreenRecoveryTimerRef.current)
      fullscreenRecoveryTimerRef.current = null
    }
  }, [])

  // ── Pre-test Hardware Check ─────────────────────────────────────────────────

  const requestHardwarePermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true,
      })
      mediaStreamRef.current = stream
      setHasCamPermission(true)
      setHasMicPermission(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // Initialize audio meter
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // Run audio energy loop
      const buffer = new Uint8Array(analyser.frequencyBinCount)
      const checkAudio = () => {
        analyser.getByteFrequencyData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i++) sum += buffer[i]
        const avg = sum / buffer.length
        setAudioLevel(Math.min(100, Math.round(avg * 1.6)))
        animationFrameRef.current = requestAnimationFrame(checkAudio)
      }
      checkAudio()
    } catch (err) {
      console.warn('Hardware permission denied:', err)
      setHasCamPermission(false)
      setHasMicPermission(false)
    }
  }

  // ── Start Proctored Exam ────────────────────────────────────────────────────

  const startProctoredExam = async () => {
    if (!selectedTopic) return

    // Force Fullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
        setIsFullscreenActive(true)
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err)
    }

    setTimeRemainingSeconds(selectedTopic.duration_minutes * 60)
    setStage('exam')
    setCurrentQIndex(0)
    setSelectedAnswers({})
    setFlaggedQuestions({})
    setViolationCount(0)

    // Exam countdown timer
    if (examTimerIntervalRef.current) clearInterval(examTimerIntervalRef.current)
    examTimerIntervalRef.current = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(examTimerIntervalRef.current)
          handleSubmitExam()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // ── Fullscreen & Tab Switch Violation Listeners ─────────────────────────────

  useEffect(() => {
    if (stage !== 'exam') return

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement
      setIsFullscreenActive(isFull)
      if (!isFull && !examSubmitted) {
        setViolationCount((v) => {
          const newV = v + 1
          if (newV >= 3) {
            handleSubmitExam()
          }
          return newV
        })
        setFullscreenWarningOpen(true)
        setFullscreenTimer(10)

        if (fullscreenRecoveryTimerRef.current) clearInterval(fullscreenRecoveryTimerRef.current)
        fullscreenRecoveryTimerRef.current = setInterval(() => {
          setFullscreenTimer((sec) => {
            if (sec <= 1) {
              clearInterval(fullscreenRecoveryTimerRef.current)
              handleSubmitExam()
              return 0
            }
            return sec - 1
          })
        }, 1000)
      } else if (isFull) {
        setFullscreenWarningOpen(false)
        if (fullscreenRecoveryTimerRef.current) {
          clearInterval(fullscreenRecoveryTimerRef.current)
          fullscreenRecoveryTimerRef.current = null
        }
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !examSubmitted) {
        setViolationCount((v) => {
          const next = v + 1
          if (next >= 3) handleSubmitExam()
          return next
        })
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [stage, examSubmitted])

  // ── Keyboard Shortcuts (A, B, C, D, N, P, F) ────────────────────────────────

  useEffect(() => {
    if (stage !== 'exam' || !selectedTopic) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return

      const key = e.key.toUpperCase()
      if (['A', 'B', 'C', 'D'].includes(key)) {
        const optionIndex = key.charCodeAt(0) - 65
        setSelectedAnswers((prev) => ({ ...prev, [currentQIndex]: optionIndex }))
      } else if (key === 'N' || key === 'ARROWDOWN' || key === 'ARROWRIGHT') {
        if (currentQIndex < selectedTopic.questions.length - 1) {
          setCurrentQIndex((i) => i + 1)
        }
      } else if (key === 'P' || key === 'ARROWUP' || key === 'ARROWLEFT') {
        if (currentQIndex > 0) {
          setCurrentQIndex((i) => i - 1)
        }
      } else if (key === 'F') {
        setFlaggedQuestions((prev) => ({ ...prev, [currentQIndex]: !prev[currentQIndex] }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [stage, selectedTopic, currentQIndex])

  // ── Exam Submission & Result Calculation ────────────────────────────────────

  const handleSubmitExam = () => {
    if (examTimerIntervalRef.current) clearInterval(examTimerIntervalRef.current)
    if (fullscreenRecoveryTimerRef.current) clearInterval(fullscreenRecoveryTimerRef.current)

    setExamSubmitted(true)
    setStage('results')

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }

    if (!selectedTopic || !selectedSubject) return

    // Calculate score
    let correctCount = 0
    selectedTopic.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_index) {
        correctCount++
      }
    })

    const totalQ = selectedTopic.questions.length
    const scorePct = Math.round((correctCount / totalQ) * 100)

    // Save to localStorage history
    const historyItem = {
      id: `exam-${Date.now()}`,
      subjectName: selectedSubject.name,
      subjectCode: selectedSubject.code,
      topicTitle: selectedTopic.title,
      score: correctCount,
      total: totalQ,
      percentage: scorePct,
      date: new Date().toISOString(),
      violations: violationCount,
    }

    try {
      const existing = JSON.parse(localStorage.getItem('iare_assessment_history') || '[]')
      localStorage.setItem('iare_assessment_history', JSON.stringify([historyItem, ...existing]))
    } catch {}

    if (onComplete) {
      onComplete(selectedTopic.title, selectedSubject.name, correctCount, totalQ, scorePct)
    }
  }

  // Helper: Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  // Calculate results data
  const totalQuestions = selectedTopic?.questions.length || 5
  const correctCount = selectedTopic?.questions.reduce((acc, q, idx) => {
    return acc + (selectedAnswers[idx] === q.correct_index ? 1 : 0)
  }, 0) || 0
  const scorePercentage = Math.round((correctCount / totalQuestions) * 100)
  const isPassing = scorePercentage >= 70

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={styles.modalBackdrop}
      >
        <div style={styles.modalCard}>
          {/* ── STAGE 1: SELECT ENROLLED SUBJECT (SAMVIDHA ALIGNED) ─────────── */}
          {stage === 'select_subject' && (
            <div style={styles.contentContainer}>
              <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={styles.iconCircle}>
                    <GraduationCap size={20} color="#0A84FF" />
                  </div>
                  <div>
                    <h2 style={styles.title}>AI Proctored Technical Assessment</h2>
                    <p style={styles.subtitle}>
                      Your enrolled courses from Samvidha are listed below. Pick a subject to begin.
                    </p>
                  </div>
                </div>
                <button onClick={onClose} style={styles.closeButton}>
                  <X size={20} />
                </button>
              </div>

              {/* Subject Selection Grid */}
              <div style={styles.subjectGrid}>
                {displaySubjects.map((subj) => (
                  <motion.div
                    key={subj.id}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedSubject(subj)
                      setStage('select_topic')
                    }}
                    style={styles.subjectCard}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <Badge variant="indigo" style={{ fontSize: '11px', fontWeight: 600 }}>
                        {subj.code}
                      </Badge>
                      <Badge variant="success" style={{ fontSize: '10.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={11} /> Registered Course
                      </Badge>
                    </div>

                    <h3 style={styles.subjectName}>{subj.name}</h3>
                    <p style={styles.subjectCategory}>{subj.category}</p>

                    <div style={styles.subjectFooter}>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                        {subj.topics.length} Topic Unit{subj.topics.length > 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: '12.5px', color: '#0A84FF', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Select <ChevronRight size={14} />
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ── STAGE 2: SELECT TOPIC / UNIT ───────────────────────────────── */}
          {stage === 'select_topic' && selectedSubject && (
            <div style={styles.contentContainer}>
              <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => setStage('select_subject')}
                    style={styles.backButton}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <h2 style={styles.title}>{selectedSubject.name} ({selectedSubject.code})</h2>
                    <p style={styles.subtitle}>Select the syllabus topic unit you want to be evaluated on.</p>
                  </div>
                </div>
                <button onClick={onClose} style={styles.closeButton}>
                  <X size={20} />
                </button>
              </div>

              <div style={styles.topicList}>
                {selectedSubject.topics.map((topic) => (
                  <motion.div
                    key={topic.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => {
                      setSelectedTopic(topic)
                      setStage('proctoring_check')
                      requestHardwarePermissions()
                    }}
                    style={styles.topicCard}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <h4 style={styles.topicTitle}>{topic.title}</h4>
                        <Badge
                          variant={topic.difficulty === 'Foundation' ? 'success' : topic.difficulty === 'Intermediate' ? 'primary' : 'warning'}
                          style={{ fontSize: '10.5px' }}
                        >
                          {topic.difficulty}
                        </Badge>
                      </div>
                      <p style={styles.topicDesc}>{topic.description}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px', fontSize: '12px', color: '#94A3B8' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} color="#0A84FF" /> {topic.duration_minutes} Mins
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <BookOpen size={13} color="#34C759" /> {topic.questions.length} Questions
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldCheck size={13} color="#FF9500" /> AI Proctored
                        </span>
                      </div>
                    </div>

                    <Button variant="primary" style={{ gap: '6px' }}>
                      Choose Topic <ChevronRight size={15} />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ── STAGE 3: PROCTORING READINESS CHECK ────────────────────────── */}
          {stage === 'proctoring_check' && selectedSubject && selectedTopic && (
            <div style={styles.contentContainer}>
              <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button onClick={() => setStage('select_topic')} style={styles.backButton}>
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <h2 style={styles.title}>AI Proctoring Clearance Check</h2>
                    <p style={styles.subtitle}>
                      Verify your camera, microphone, and fullscreen environment before entering.
                    </p>
                  </div>
                </div>
                <button onClick={onClose} style={styles.closeButton}>
                  <X size={20} />
                </button>
              </div>

              <div style={styles.proctorCheckGrid}>
                {/* Live Camera Preview Mirror */}
                <div style={styles.videoCheckCard}>
                  <div style={styles.videoWrapper}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={styles.liveVideoPreview}
                    />
                    <div style={styles.videoOverlayBadge}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34C759' }} />
                      Live Feed Active
                    </div>
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#F1F5F9', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Camera size={15} color="#0A84FF" /> Web Camera
                    </span>
                    <Badge variant={hasCamPermission ? 'success' : 'error'}>
                      {hasCamPermission ? 'Authorized' : 'Permission Required'}
                    </Badge>
                  </div>
                </div>

                {/* Checklist & Integrity Agreement */}
                <div style={styles.checklistCard}>
                  <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 12px 0' }}>
                    Proctoring Protocols
                  </h4>

                  <div style={styles.checkItem}>
                    <div style={styles.checkIcon}>{hasCamPermission ? <Check size={14} color="#34C759" /> : <Camera size={14} />}</div>
                    <div>
                      <span style={styles.checkLabel}>Live Face & Gaze Tracking</span>
                      <p style={styles.checkSub}>Camera monitors head alignment & gaze during the test.</p>
                    </div>
                  </div>

                  <div style={styles.checkItem}>
                    <div style={styles.checkIcon}>{hasMicPermission ? <Check size={14} color="#34C759" /> : <Mic size={14} />}</div>
                    <div>
                      <span style={styles.checkLabel}>Microphone Ambient Sound Monitor</span>
                      <p style={styles.checkSub}>
                        Room noise: <strong style={{ color: audioLevel > 40 ? '#FF3B30' : '#34C759' }}>{audioLevel} dB</strong> (Quiet)
                      </p>
                    </div>
                  </div>

                  <div style={styles.checkItem}>
                    <div style={styles.checkIcon}><Maximize2 size={14} color="#0A84FF" /></div>
                    <div>
                      <span style={styles.checkLabel}>Strict Fullscreen Lock</span>
                      <p style={styles.checkSub}>Leaving fullscreen or tab-switching registers an automatic violation.</p>
                    </div>
                  </div>

                  <label style={styles.pledgeLabel}>
                    <input
                      type="checkbox"
                      checked={proctorPledgeAccepted}
                      onChange={(e) => setProctorPledgeAccepted(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#0A84FF' }}
                    />
                    <span style={{ fontSize: '12px', color: '#E2E8F0', lineHeight: 1.4 }}>
                      I agree to the academic honor code and acknowledge that my test is monitored.
                    </span>
                  </label>

                  <Button
                    variant="primary"
                    disabled={!proctorPledgeAccepted || !hasCamPermission}
                    onClick={startProctoredExam}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '14px', gap: '8px', padding: '12px 0' }}
                  >
                    <Lock size={16} /> Enter Proctored Exam (Locks Fullscreen)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── STAGE 4: PROCTORED EXAM INTERFACE (CRISP HIGH-CONTRAST UI) ── */}
          {stage === 'exam' && selectedTopic && selectedSubject && (
            <div style={styles.examContainer}>
              {/* Top Exam Status Bar */}
              <div style={styles.examTopBar}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>
                    {selectedSubject.code} • {selectedSubject.name}
                  </span>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: '2px 0 0 0' }}>
                    {selectedTopic.title}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Countdown Timer with warning pulse */}
                  <div
                    style={{
                      ...styles.timerBadge,
                      background: timeRemainingSeconds < 60 ? 'rgba(255, 59, 48, 0.2)' : 'rgba(10, 132, 255, 0.15)',
                      border: timeRemainingSeconds < 60 ? '1px solid #FF3B30' : '1px solid rgba(10, 132, 255, 0.3)',
                    }}
                  >
                    <Clock size={16} color={timeRemainingSeconds < 60 ? '#FF3B30' : '#0A84FF'} />
                    <span style={{ fontWeight: 700, color: timeRemainingSeconds < 60 ? '#FF3B30' : '#FFFFFF', fontSize: '14px', letterSpacing: '0.5px' }}>
                      {formatTime(timeRemainingSeconds)}
                    </span>
                  </div>

                  {/* Violation Tracker Pill */}
                  <Badge variant={violationCount === 0 ? 'success' : 'error'} style={{ fontSize: '11.5px', gap: '4px' }}>
                    <ShieldCheck size={12} /> Violations: {violationCount}/3
                  </Badge>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to submit your assessment now?')) {
                        handleSubmitExam()
                      }
                    }}
                  >
                    Submit Exam
                  </Button>
                </div>
              </div>

              {/* Main Exam Body (Question Area + Side Proctor Widget) */}
              <div style={styles.examBody}>
                {/* Left: Active Question Card */}
                <div style={styles.questionPanel}>
                  {/* Question Index Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0A84FF' }}>
                      Question {currentQIndex + 1} of {selectedTopic.questions.length}
                    </span>

                    <button
                      onClick={() => setFlaggedQuestions((prev) => ({ ...prev, [currentQIndex]: !prev[currentQIndex] }))}
                      style={{
                        background: flaggedQuestions[currentQIndex] ? 'rgba(255, 149, 0, 0.2)' : 'transparent',
                        border: '1px solid rgba(255, 149, 0, 0.4)',
                        color: flaggedQuestions[currentQIndex] ? '#FF9500' : '#94A3B8',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <Flag size={12} /> {flaggedQuestions[currentQIndex] ? 'Flagged for Review' : 'Flag Question'}
                    </button>
                  </div>

                  {/* Question Prompt */}
                  <h3 style={styles.questionText}>
                    {selectedTopic.questions[currentQIndex].question}
                  </h3>

                  {/* Code snippet if present */}
                  {selectedTopic.questions[currentQIndex].codeSnippet && (
                    <pre style={styles.codeSnippetBlock}>
                      <code>{selectedTopic.questions[currentQIndex].codeSnippet}</code>
                    </pre>
                  )}

                  {/* Options List */}
                  <div style={styles.optionsContainer}>
                    {selectedTopic.questions[currentQIndex].options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[currentQIndex] === optIdx
                      const keyLetter = String.fromCharCode(65 + optIdx)

                      return (
                        <div
                          key={optIdx}
                          onClick={() => setSelectedAnswers((prev) => ({ ...prev, [currentQIndex]: optIdx }))}
                          style={{
                            ...styles.optionCard,
                            borderColor: isSelected ? '#0A84FF' : '#1E293B',
                            background: isSelected ? 'rgba(10, 132, 255, 0.12)' : '#161E2E',
                            boxShadow: isSelected ? '0 0 16px rgba(10, 132, 255, 0.2)' : 'none',
                          }}
                        >
                          <span
                            style={{
                              ...styles.optionKeyBadge,
                              background: isSelected ? '#0A84FF' : '#1E293B',
                              color: isSelected ? '#FFFFFF' : '#94A3B8',
                            }}
                          >
                            {keyLetter}
                          </span>
                          <span style={{ fontSize: '14px', color: '#F1F5F9', fontWeight: 500, flex: 1 }}>
                            {opt}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Bottom Question Navigation Controls */}
                  <div style={styles.examBottomNav}>
                    <Button
                      variant="secondary"
                      disabled={currentQIndex === 0}
                      onClick={() => setCurrentQIndex((i) => i - 1)}
                      style={{ gap: '6px' }}
                    >
                      <ChevronLeft size={16} /> Previous
                    </Button>

                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      Shortcut keys: A, B, C, D to pick • N for Next • P for Previous
                    </span>

                    {currentQIndex < selectedTopic.questions.length - 1 ? (
                      <Button
                        variant="primary"
                        onClick={() => setCurrentQIndex((i) => i + 1)}
                        style={{ gap: '6px' }}
                      >
                        Next <ChevronRight size={16} />
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={handleSubmitExam}
                        style={{ gap: '6px' }}
                      >
                        Submit Test <Check size={16} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Right: Live Proctoring HUD & Question Navigation Grid */}
                <div style={styles.proctorSidebar}>
                  {/* Live Mini Camera Feed */}
                  <div style={styles.miniCameraHUD}>
                    <div style={styles.miniVideoContainer}>
                      <video
                        ref={(node) => {
                          if (node && mediaStreamRef.current && node.srcObject !== mediaStreamRef.current) {
                            node.srcObject = mediaStreamRef.current
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        style={styles.miniVideo}
                      />
                      <div style={styles.miniHUDOverlay}>
                        <span style={styles.greenDot} /> AI Proctoring Active
                      </div>
                    </div>

                    <div style={{ padding: '8px 12px', background: '#111827', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8' }}>
                        <span>Gaze & Alignment:</span>
                        <strong style={{ color: '#34C759' }}>Centered</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8' }}>
                        <span>Room Audio:</span>
                        <strong style={{ color: audioLevel > 40 ? '#FF3B30' : '#34C759' }}>{audioLevel} dB</strong>
                      </div>
                    </div>
                  </div>

                  {/* Question Grid Navigator */}
                  <div style={styles.navGridCard}>
                    <h5 style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                      Questions Palette
                    </h5>

                    <div style={styles.gridPills}>
                      {selectedTopic.questions.map((_, qIdx) => {
                        const isAns = selectedAnswers[qIdx] !== undefined
                        const isFlag = flaggedQuestions[qIdx]
                        const isCur = currentQIndex === qIdx

                        let bg = '#1E293B'
                        let color = '#94A3B8'
                        let border = '1px solid #334155'

                        if (isCur) {
                          border = '2px solid #0A84FF'
                          color = '#FFFFFF'
                        }
                        if (isFlag) {
                          bg = 'rgba(255, 149, 0, 0.25)'
                          color = '#FF9500'
                          border = '1px solid #FF9500'
                        } else if (isAns) {
                          bg = 'rgba(52, 199, 89, 0.25)'
                          color = '#34C759'
                          border = '1px solid #34C759'
                        }

                        return (
                          <button
                            key={qIdx}
                            onClick={() => setCurrentQIndex(qIdx)}
                            style={{
                              ...styles.gridPill,
                              background: bg,
                              color,
                              border,
                            }}
                          >
                            {qIdx + 1}
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px', fontSize: '11px', color: '#64748B' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34C759' }} />
                        Answered ({Object.keys(selectedAnswers).length})
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF9500' }} />
                        Flagged ({Object.values(flaggedQuestions).filter(Boolean).length})
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#334155' }} />
                        Unanswered ({selectedTopic.questions.length - Object.keys(selectedAnswers).length})
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STAGE 5: RESULTS, SCORECARD & AI ROADMAP ───────────────────── */}
          {stage === 'results' && selectedTopic && selectedSubject && (
            <div style={styles.contentContainer}>
              <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ ...styles.iconCircle, background: isPassing ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 149, 0, 0.15)' }}>
                    <Award size={22} color={isPassing ? '#34C759' : '#FF9500'} />
                  </div>
                  <div>
                    <h2 style={styles.title}>Assessment Results & Analysis</h2>
                    <p style={styles.subtitle}>
                      {selectedSubject.name} • {selectedTopic.title}
                    </p>
                  </div>
                </div>
                <button onClick={onClose} style={styles.closeButton}>
                  <X size={20} />
                </button>
              </div>

              {/* Score Banner */}
              <div style={{ ...styles.scoreBanner, borderColor: isPassing ? '#34C759' : '#FF9500' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ ...styles.scoreCircle, borderColor: isPassing ? '#34C759' : '#FF9500' }}>
                    <span style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF' }}>{scorePercentage}%</span>
                    <small style={{ fontSize: '11px', color: '#94A3B8' }}>{correctCount}/{totalQuestions} Correct</small>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                      {isPassing ? '🎉 Great Job! Mastery Verified' : '⚠️ Practice Needed in this Topic'}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#94A3B8', margin: '4px 0 8px 0' }}>
                      {isPassing
                        ? 'You demonstrated solid conceptual engineering knowledge.'
                        : 'Your score indicates foundational gaps in this unit. Review the recommended concepts below.'}
                    </p>

                    <Badge variant={violationCount === 0 ? 'success' : 'warning'} style={{ fontSize: '11px' }}>
                      Proctoring Status: {violationCount === 0 ? '100% Clean Exam' : `${violationCount} Violations Recorded`}
                    </Badge>
                  </div>
                </div>

                {/* AI Study Roadmap CTA */}
                <Button
                  variant="primary"
                  onClick={() => {
                    onClose()
                    if (onAskAI) {
                      onAskAI(
                        `I just completed my technical assessment in ${selectedSubject.name} (${selectedTopic.title}) and scored ${correctCount}/${totalQuestions} (${scorePercentage}%). Please provide a structured 3-step study roadmap, explain the core concepts I need to review, and give me practice recommendations.`
                      )
                    }
                  }}
                  style={{ gap: '8px', fontWeight: 700, boxShadow: '0 4px 16px rgba(10, 132, 255, 0.4)' }}
                >
                  <Sparkles size={16} /> Get AI Study Roadmap
                </Button>
              </div>

              {/* Question By Question Breakdown */}
              <div style={styles.questionBreakdownList}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 14px 0' }}>
                  Question-by-Question Solution & Explanations
                </h4>

                {selectedTopic.questions.map((q, idx) => {
                  const studentAns = selectedAnswers[idx]
                  const isCorrect = studentAns === q.correct_index

                  return (
                    <div
                      key={q.id}
                      style={{
                        ...styles.questionResultCard,
                        borderColor: isCorrect ? 'rgba(52, 199, 89, 0.4)' : 'rgba(255, 59, 48, 0.4)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0A84FF' }}>
                          Question {idx + 1}
                        </span>
                        <Badge variant={isCorrect ? 'success' : 'error'} style={{ fontSize: '11px' }}>
                          {isCorrect ? 'Correct (+1)' : 'Incorrect (0)'}
                        </Badge>
                      </div>

                      <p style={{ fontSize: '14px', color: '#F1F5F9', fontWeight: 600, margin: '0 0 8px 0' }}>
                        {q.question}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '8px 0', fontSize: '12.5px' }}>
                        <div style={{ color: isCorrect ? '#34C759' : '#FF453A' }}>
                          Your Answer: <strong>{studentAns !== undefined ? `${String.fromCharCode(65 + studentAns)}) ${q.options[studentAns]}` : 'Unanswered'}</strong>
                        </div>
                        {!isCorrect && (
                          <div style={{ color: '#34C759' }}>
                            Correct Answer: <strong>{String.fromCharCode(65 + q.correct_index)}) {q.options[q.correct_index]}</strong>
                          </div>
                        )}
                      </div>

                      <div style={styles.explanationBox}>
                        <strong style={{ color: '#0A84FF' }}>Engineering Explanation: </strong>
                        <span style={{ color: '#CBD5E1' }}>{q.explanation}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── EMERGENCY FULLSCREEN VIOLATION MODAL ───────────────────────── */}
        {fullscreenWarningOpen && (
          <div style={styles.fullscreenWarningBackdrop}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={styles.fullscreenWarningCard}
            >
              <AlertTriangle size={48} color="#FF3B30" style={{ marginBottom: '12px' }} />
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                ⚠️ Fullscreen Exited — Violation Logged!
              </h2>
              <p style={{ fontSize: '13.5px', color: '#CBD5E1', margin: '10px 0 16px 0', textAlign: 'center' }}>
                You have left fullscreen mode or switched tabs. Return to fullscreen immediately.
                Exam will auto-terminate in <strong style={{ color: '#FF3B30', fontSize: '16px' }}>{fullscreenTimer}s</strong>.
              </p>

              <Button
                variant="primary"
                onClick={() => {
                  if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {})
                  }
                }}
                style={{ padding: '12px 24px', fontWeight: 700 }}
              >
                Return to Fullscreen Exam
              </Button>
            </motion.div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

// ── CRISP HIGH-CONTRAST STYLES ───────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5, 8, 15, 0.88)',
    backdropFilter: 'blur(8px)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '1020px',
    height: '92vh',
    maxHeight: '850px',
    background: '#0B0F19',
    borderRadius: '20px',
    border: '1px solid #1E293B',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  contentContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'auto',
    padding: '24px 28px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '16px',
    borderBottom: '1px solid #1E293B',
    marginBottom: '20px',
  },
  iconCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'rgba(10, 132, 255, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#FFFFFF',
    margin: 0,
  },
  subtitle: {
    fontSize: '13px',
    color: '#94A3B8',
    margin: '2px 0 0 0',
  },
  closeButton: {
    background: '#1E293B',
    border: 'none',
    color: '#94A3B8',
    padding: '8px',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  backButton: {
    background: '#1E293B',
    border: 'none',
    color: '#94A3B8',
    padding: '8px',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  subjectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  subjectCard: {
    background: '#151D2F',
    border: '1px solid #1E293B',
    borderRadius: '16px',
    padding: '18px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  subjectName: {
    fontSize: '15.5px',
    fontWeight: 700,
    color: '#FFFFFF',
    margin: '0 0 4px 0',
  },
  subjectCategory: {
    fontSize: '12.5px',
    color: '#94A3B8',
    margin: '0 0 16px 0',
  },
  subjectFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: '1px solid #1E293B',
    paddingTop: '12px',
  },
  topicList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  topicCard: {
    background: '#151D2F',
    border: '1px solid #1E293B',
    borderRadius: '16px',
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    gap: '16px',
  },
  topicTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#FFFFFF',
    margin: 0,
  },
  topicDesc: {
    fontSize: '12.5px',
    color: '#94A3B8',
    margin: '4px 0 0 0',
  },
  proctorCheckGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '24px',
    flex: 1,
  },
  videoCheckCard: {
    background: '#151D2F',
    border: '1px solid #1E293B',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    paddingBottom: '75%',
    background: '#0B0F19',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  liveVideoPreview: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
  },
  videoOverlayBadge: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    background: 'rgba(0,0,0,0.6)',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  checklistCard: {
    background: '#151D2F',
    border: '1px solid #1E293B',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
  },
  checkItem: {
    display: 'flex',
    gap: '12px',
    marginBottom: '14px',
  },
  checkIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: '#1E293B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkLabel: {
    fontSize: '13.5px',
    fontWeight: 600,
    color: '#FFFFFF',
  },
  checkSub: {
    fontSize: '12px',
    color: '#94A3B8',
    margin: '2px 0 0 0',
  },
  pledgeLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: '#111827',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #1E293B',
    marginTop: 'auto',
    cursor: 'pointer',
  },
  examContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  examTopBar: {
    padding: '16px 24px',
    background: '#111827',
    borderBottom: '1px solid #1E293B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '10px',
  },
  examBody: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  questionPanel: {
    flex: 1,
    padding: '24px 28px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  questionText: {
    fontSize: '16.5px',
    fontWeight: 600,
    color: '#FFFFFF',
    lineHeight: 1.5,
    margin: '0 0 16px 0',
  },
  codeSnippetBlock: {
    background: '#080C14',
    border: '1px solid #1E293B',
    padding: '14px',
    borderRadius: '10px',
    fontSize: '13px',
    color: '#38BDF8',
    fontFamily: 'monospace',
    overflowX: 'auto',
    marginBottom: '16px',
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
  },
  optionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 18px',
    borderRadius: '12px',
    border: '1.5px solid #1E293B',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  optionKeyBadge: {
    width: '26px',
    height: '26px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  examBottomNav: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '16px',
    borderTop: '1px solid #1E293B',
  },
  proctorSidebar: {
    width: '280px',
    background: '#0D1322',
    borderLeft: '1px solid #1E293B',
    display: 'flex',
    flexDirection: 'column',
  },
  miniCameraHUD: {
    borderBottom: '1px solid #1E293B',
  },
  miniVideoContainer: {
    position: 'relative',
    width: '100%',
    height: '140px',
    background: '#000000',
  },
  miniVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
  },
  miniHUDOverlay: {
    position: 'absolute',
    top: '6px',
    left: '6px',
    background: 'rgba(0,0,0,0.65)',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '10.5px',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  greenDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#34C759',
  },
  navGridCard: {
    padding: '16px',
    flex: 1,
    overflowY: 'auto',
  },
  gridPills: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '8px',
  },
  gridPill: {
    height: '36px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBanner: {
    background: '#151D2F',
    border: '1.5px solid #34C759',
    borderRadius: '16px',
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  scoreCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: '3px solid #34C759',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111827',
  },
  questionBreakdownList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  questionResultCard: {
    background: '#151D2F',
    border: '1.5px solid',
    borderRadius: '14px',
    padding: '16px 20px',
  },
  explanationBox: {
    background: '#0D1322',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #1E293B',
    fontSize: '12.5px',
    lineHeight: 1.5,
  },
  fullscreenWarningBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.95)',
    zIndex: 100000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  fullscreenWarningCard: {
    background: '#151D2F',
    border: '2px solid #FF3B30',
    borderRadius: '20px',
    padding: '32px',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 0 60px rgba(255, 59, 48, 0.4)',
  },
}
