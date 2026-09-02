import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { springs } from '@/tokens'

interface Question {
  id: number
  question: string
  options: string[]
  correct_index?: number
  explanation?: string
}

interface AssessmentTopic {
  id: string
  title: string
  subject: string
  duration_minutes: number
  questions: Question[]
}

const TOPICS_DATA: Record<string, AssessmentTopic> = {
  data_structures: {
    id: 'data_structures',
    title: 'Data Structures & Algorithms',
    subject: 'Core Computer Science',
    duration_minutes: 5,
    questions: [
      {
        id: 1,
        question: 'What is the worst-case time complexity of searching for an element in an unbalanced Binary Search Tree (BST)?',
        options: ['O(log N)', 'O(1)', 'O(N)', 'O(N log N)'],
        correct_index: 2,
        explanation: 'In a skewed (unbalanced) BST, the tree degenerates into a linear linked list where search takes O(N) comparisons.',
      },
      {
        id: 2,
        question: 'Which data structure is natively used to implement Depth First Search (DFS) on a graph?',
        options: ['Queue', 'Stack / Recursion Call Stack', 'Priority Queue', 'Circular Ring Buffer'],
        correct_index: 1,
        explanation: 'DFS follows a Last-In-First-Out (LIFO) traversal order, which is natively backed by a Stack data structure.',
      },
      {
        id: 3,
        question: "In Dijkstra's algorithm for single-source shortest paths with non-negative edge weights, what is the optimal complexity using a Fibonacci Heap?",
        options: ['O(V^2)', 'O(E + V log V)', 'O(E log V)', 'O(V * E)'],
        correct_index: 1,
        explanation: 'Using a Fibonacci heap, decrease-key takes amortized O(1), leading to an overall runtime of O(E + V log V).',
      },
      {
        id: 4,
        question: 'Which sorting algorithm guarantees O(N log N) worst-case time complexity while also being stable?',
        options: ['Quick Sort', 'Heap Sort', 'Merge Sort', 'Selection Sort'],
        correct_index: 2,
        explanation: 'Merge Sort guarantees O(N log N) time in all cases and preserves the relative order of duplicate elements (stable).',
      },
    ],
  },
  operating_systems: {
    id: 'operating_systems',
    title: 'Operating Systems & Concurrency',
    subject: 'System Architecture',
    duration_minutes: 5,
    questions: [
      {
        id: 1,
        question: 'Which of the following is NOT one of the 4 necessary Coffman conditions for Deadlock?',
        options: ['Mutual Exclusion', 'Hold and Wait', 'Preemption Allowed', 'Circular Wait'],
        correct_index: 2,
        explanation: 'The Coffman condition is "No Preemption". If resources can be forcibly preempted, deadlocks cannot persist.',
      },
      {
        id: 2,
        question: "What is the primary role of Banker's Algorithm in operating systems?",
        options: ['Deadlock Detection', 'Deadlock Avoidance', 'CPU Scheduling', 'Page Replacement'],
        correct_index: 1,
        explanation: "Banker's Algorithm simulates resource allocation to ensure a Safe State exists before granting requests.",
      },
      {
        id: 3,
        question: "What occurs during virtual memory 'Thrashing'?",
        options: [
          'CPU spends 100% time computing instructions',
          'Processes spend more time paging in/out than executing code',
          'Hardware registers overheat',
          'Permanent disk sector corruption',
        ],
        correct_index: 1,
        explanation: 'Thrashing occurs when total working set sizes exceed physical RAM, causing constant page faults and near-zero CPU throughput.',
      },
    ],
  },
  machine_learning: {
    id: 'machine_learning',
    title: 'Machine Learning & AI Engineering',
    subject: 'Artificial Intelligence',
    duration_minutes: 5,
    questions: [
      {
        id: 1,
        question: 'What problem does the ReLU activation function mitigate compared to Sigmoid in deep networks?',
        options: ['Overfitting', 'Vanishing Gradient Problem', 'Underfitting', 'High Latency'],
        correct_index: 1,
        explanation: 'For positive inputs, the derivative of ReLU is 1.0, which prevents gradients from decaying exponentially across deep layers.',
      },
      {
        id: 2,
        question: 'What does high variance in a machine learning predictive model indicate?',
        options: [
          'The model is underfitting the training dataset',
          'The model is overfitting and highly sensitive to training fluctuations',
          'The dataset is too large',
          'The learning rate is zero',
        ],
        correct_index: 1,
        explanation: 'High variance indicates the model learned noise and idiosyncrasies of the training data (overfitting).',
      },
      {
        id: 3,
        question: 'What is the core attention mechanism in the Transformer architecture (Vaswani et al.)?',
        options: ['Recurrent LSTM Cells', 'Convolutional Pooling', 'Multi-Head Self-Attention', 'Markov Chains'],
        correct_index: 2,
        explanation: 'Transformers compute parallel token relationships globally using Multi-Head Self-Attention matrices.',
      },
    ],
  },
}

interface TechnicalAssessmentModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: (subject: string, score: number, total: number) => void
}

export function TechnicalAssessmentModal({ isOpen, onClose, onComplete }: TechnicalAssessmentModalProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string>('data_structures')
  const [examState, setExamState] = useState<'intro' | 'active' | 'results'>('intro')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState<number>(300)
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0)

  const currentTopic = TOPICS_DATA[selectedTopicId] || TOPICS_DATA.data_structures

  // Proctoring: Track window blur / tab switches
  useEffect(() => {
    if (examState !== 'active') return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [examState])

  // Timer countdown
  useEffect(() => {
    if (examState !== 'active') return
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handleSubmitExam()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [examState])

  const handleStartExam = (topicId: string) => {
    setSelectedTopicId(topicId)
    setAnswers({})
    setTimeLeft((TOPICS_DATA[topicId]?.duration_minutes || 5) * 60)
    setTabSwitchCount(0)
    setExamState('active')
  }

  const handleSelectOption = (questionId: number, optionIdx: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIdx }))
  }

  const handleSubmitExam = () => {
    setExamState('results')
    const correctCount = currentTopic.questions.filter((q) => answers[q.id] === q.correct_index).length
    onComplete?.(currentTopic.title, correctCount, currentTopic.questions.length)
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  if (!isOpen) return null

  const correctCount = currentTopic.questions.filter((q) => answers[q.id] === q.correct_index).length
  const totalQuestions = currentTopic.questions.length
  const scorePct = Math.round((correctCount / totalQuestions) * 100)

  return (
    <div style={styles.backdrop}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={springs.smooth}
        style={styles.dialogCard}
      >
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.headerIconBox}>
              <GraduationCap size={20} color="var(--accent-color)" />
            </div>
            <div>
              <h2 style={styles.headerTitle}>Engineering Technical Assessment & Proctoring</h2>
              <p style={styles.headerSubtitle}>Subject Mastery & Timed Exam Proctoring Engine</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={styles.body}>
          {examState === 'intro' && (
            <div>
              <p style={styles.introDesc}>
                Select an engineering discipline to launch an AI-proctored technical assessment. Questions test core theory, time complexities, and system design principles.
              </p>

              <div style={styles.topicGrid}>
                {Object.values(TOPICS_DATA).map((topic) => (
                  <div
                    key={topic.id}
                    style={{
                      ...styles.topicCard,
                      border: selectedTopicId === topic.id ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                      background: selectedTopicId === topic.id ? 'var(--accent-subtle)' : 'var(--bg-sunken)',
                    }}
                    onClick={() => setSelectedTopicId(topic.id)}
                  >
                    <div style={styles.topicHeaderRow}>
                      <span style={styles.topicSubjectBadge}>{topic.subject}</span>
                      <span style={styles.topicDuration}>
                        <Clock size={12} style={{ marginRight: '4px' }} />
                        {topic.duration_minutes} Mins
                      </span>
                    </div>
                    <h3 style={styles.topicTitle}>{topic.title}</h3>
                    <p style={styles.topicMeta}>{topic.questions.length} Rigorous Engineering Questions</p>
                  </div>
                ))}
              </div>

              <div style={styles.proctorNotice}>
                <ShieldCheck size={16} color="#34C759" />
                <span>
                  <strong>AI Proctoring Active:</strong> Tab switching and window defocusing are automatically tracked during the exam.
                </span>
              </div>

              <div style={styles.footerRow}>
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" icon={<Zap size={16} />} onClick={() => handleStartExam(selectedTopicId)}>
                  Start Timed Exam
                </Button>
              </div>
            </div>
          )}

          {examState === 'active' && (
            <div>
              {/* Active Exam Status Bar */}
              <div style={styles.examStatusBar}>
                <div style={styles.examStatusItem}>
                  <Clock size={16} color="var(--accent-color)" />
                  <span style={styles.timerBold}>{formatTimer(timeLeft)}</span>
                  <span style={styles.timerLabel}>Remaining</span>
                </div>

                <div style={styles.examStatusItem}>
                  <ShieldCheck size={16} color={tabSwitchCount > 0 ? '#FF9500' : '#34C759'} />
                  <span>
                    Proctoring: <strong>{tabSwitchCount === 0 ? 'Optimal' : `${tabSwitchCount} Tab Switches`}</strong>
                  </span>
                </div>

                <div style={styles.examStatusItem}>
                  <span>
                    Answered: <strong>{Object.keys(answers).length} / {currentTopic.questions.length}</strong>
                  </span>
                </div>
              </div>

              {/* Questions List */}
              <div style={styles.questionsContainer}>
                {currentTopic.questions.map((q, qIndex) => (
                  <div key={q.id} style={styles.questionCard}>
                    <div style={styles.questionTitleRow}>
                      <span style={styles.questionNumber}>Q{qIndex + 1}</span>
                      <h4 style={styles.questionText}>{q.question}</h4>
                    </div>

                    <div style={styles.optionsGrid}>
                      {q.options.map((opt, optIdx) => {
                        const isSelected = answers[q.id] === optIdx
                        return (
                          <div
                            key={optIdx}
                            onClick={() => handleSelectOption(q.id, optIdx)}
                            style={{
                              ...styles.optionCard,
                              borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-color)',
                              background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                            }}
                          >
                            <span
                              style={{
                                ...styles.optionLetter,
                                background: isSelected ? 'var(--accent-color)' : 'var(--bg-sunken)',
                                color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                              }}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span style={styles.optionText}>{opt}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.footerRow}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Submit before timer runs out to record your score.
                </span>
                <Button variant="primary" icon={<CheckCircle2 size={16} />} onClick={handleSubmitExam}>
                  Submit Assessment
                </Button>
              </div>
            </div>
          )}

          {examState === 'results' && (
            <div>
              {/* Score Summary Banner */}
              <div style={styles.scoreBanner}>
                <div style={styles.scoreBadgeBox}>
                  <Award size={36} color="var(--accent-color)" />
                </div>
                <div>
                  <h3 style={styles.scoreTitle}>
                    {scorePct >= 80 ? 'Distinction Achievement 🌟' : scorePct >= 60 ? 'Proficient Mastery 👏' : 'Needs Topic Review 📚'}
                  </h3>
                  <p style={styles.scoreSubtitle}>
                    You scored <strong>{correctCount} / {totalQuestions}</strong> ({scorePct}%) in <em>{currentTopic.title}</em>
                  </p>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <h4 style={{ margin: '18px 0 12px', fontSize: '1rem', fontWeight: 600 }}>Detailed Solution & Concept Breakdown</h4>
              <div style={styles.questionsContainer}>
                {currentTopic.questions.map((q, qIndex) => {
                  const chosenIdx = answers[q.id]
                  const isCorrect = chosenIdx === q.correct_index
                  return (
                    <div
                      key={q.id}
                      style={{
                        ...styles.questionCard,
                        borderLeft: `4px solid ${isCorrect ? '#34C759' : '#FF3B30'}`,
                      }}
                    >
                      <div style={styles.questionTitleRow}>
                        {isCorrect ? (
                          <CheckCircle2 size={18} color="#34C759" style={{ flexShrink: 0, marginTop: '2px' }} />
                        ) : (
                          <XCircle size={18} color="#FF3B30" style={{ flexShrink: 0, marginTop: '2px' }} />
                        )}
                        <span style={styles.questionNumber}>Q{qIndex + 1}</span>
                        <h4 style={styles.questionText}>{q.question}</h4>
                      </div>

                      <div style={styles.answerReviewRow}>
                        <div>
                          <span style={styles.answerReviewLabel}>Your Answer: </span>
                          <strong style={{ color: isCorrect ? '#34C759' : '#FF3B30' }}>
                            {chosenIdx !== undefined ? q.options[chosenIdx] : 'Not Attempted'}
                          </strong>
                        </div>
                        {!isCorrect && (
                          <div>
                            <span style={styles.answerReviewLabel}>Correct Answer: </span>
                            <strong style={{ color: '#34C759' }}>{q.options[q.correct_index || 0]}</strong>
                          </div>
                        )}
                      </div>

                      <div style={styles.explanationBox}>
                        <Sparkles size={14} color="var(--accent-color)" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span style={styles.explanationText}>
                          <strong>Concept Insight:</strong> {q.explanation}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={styles.footerRow}>
                <Button variant="secondary" icon={<RotateCcw size={15} />} onClick={() => setExamState('intro')}>
                  Take Another Topic
                </Button>
                <Button variant="primary" onClick={onClose}>
                  Done & Return to Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  dialogCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '780px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-sunken)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerIconBox: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'var(--accent-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  headerSubtitle: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '8px',
  },
  body: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  introDesc: {
    fontSize: '0.925rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: '0 0 20px',
  },
  topicGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    marginBottom: '20px',
  },
  topicCard: {
    padding: '16px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
  },
  topicHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  topicSubjectBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--accent-color)',
  },
  topicDuration: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
  },
  topicTitle: {
    margin: '0 0 4px',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  topicMeta: {
    margin: 0,
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  proctorNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '10px',
    background: 'rgba(52, 199, 89, 0.08)',
    border: '1px solid rgba(52, 199, 89, 0.25)',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    marginBottom: '24px',
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-color)',
    marginTop: '20px',
  },
  examStatusBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    borderRadius: '10px',
    background: 'var(--bg-sunken)',
    border: '1px solid var(--border-color)',
    marginBottom: '20px',
  },
  examStatusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.875rem',
  },
  timerBold: {
    fontSize: '1.1rem',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-color)',
  },
  timerLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  questionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    maxHeight: '480px',
    overflowY: 'auto',
    paddingRight: '6px',
  },
  questionCard: {
    padding: '16px',
    borderRadius: '12px',
    background: 'var(--bg-sunken)',
    border: '1px solid var(--border-color)',
  },
  questionTitleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '12px',
  },
  questionNumber: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '6px',
    background: 'var(--accent-subtle)',
    color: 'var(--accent-color)',
    fontFamily: 'var(--font-mono)',
  },
  questionText: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.4,
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '10px',
  },
  optionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  optionLetter: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  optionText: {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
  },
  scoreBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    padding: '20px',
    borderRadius: '14px',
    background: 'var(--accent-subtle)',
    border: '1px solid var(--accent-color)',
    marginBottom: '18px',
  },
  scoreBadgeBox: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreTitle: {
    margin: '0 0 4px',
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  scoreSubtitle: {
    margin: 0,
    fontSize: '0.925rem',
    color: 'var(--text-secondary)',
  },
  answerReviewRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '18px',
    fontSize: '0.85rem',
    margin: '10px 0',
  },
  answerReviewLabel: {
    color: 'var(--text-secondary)',
  },
  explanationBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    marginTop: '10px',
  },
  explanationText: {
    fontSize: '0.825rem',
    color: 'var(--text-primary)',
    lineHeight: 1.45,
  },
}
