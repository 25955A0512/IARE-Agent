import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  sendQuery,
  logout,
  getCurrentUser,
  checkHealth,
  getOnboarding,
  getSessionMessages,
  getUnreadNotifications,
  type NavResult,
  type ChatMessageItem,
  type StudentEventNotification,
} from '@/services/api'
import { voiceManager, type VoiceUserSetting } from '@/services/voice'
import { ThemeToggle } from '@/context/ThemeContext'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import MapOverlay from '@/components/MapOverlay'
import { StudentMonitorModal } from '@/components/StudentMonitorModal'
import { OnboardingModal } from '@/components/OnboardingModal'
import { ChatHistoryDrawer } from '@/components/ChatHistoryDrawer'
import { EventsNoticesModal } from '@/components/EventsNoticesModal'
import { TechnicalAssessmentModal } from '@/components/TechnicalAssessmentModal'
import { springs } from '@/tokens'
import {
  Plus,
  MessageSquare,
  GraduationCap,
  Bell,
  LogOut,
  Send,
  Mic,
  Trash2,
  Sparkles,
  Zap,
  BarChart3,
  Calculator,
  Clock,
  Compass,
  MapPin,
  AlertTriangle,
  Lightbulb,
  Square,
  Award,
  Volume2,
  PhoneOff,
  Image as ImageIcon,
  Copy,
  Check,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  navResult?: NavResult
  timestamp: Date
  mode?: 'text' | 'voice'
  imageUrl?: string
  imageCaption?: string
}

type SidebarNavTab = 'chat' | 'history' | 'academic' | 'events'

// ── Main Chat & Workspace Page ────────────────────────────────────────────────

export default function ChatPage() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined)
  const [sessionTitle, setSessionTitle] = useState<string>('Current Conversation')
  const [activeNavTab, setActiveNavTab] = useState<SidebarNavTab>('chat')

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hey, **${user.name || 'Friend'}**! 👋\n\nWelcome to your **IARE Campus & Academic Companion**.\n\nYour academic attendance, weekly timetable, and CIE records are **automatically synchronized** from Samvidha.\n\nAsk me about **live attendance stats**, **today's schedule**, **homework concepts**, or **campus navigation**!`,
      timestamp: new Date(),
    },
  ])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceSetting, setVoiceSetting] = useState<VoiceUserSetting>(voiceManager.getSetting())
  const [activeEngineStatus, setActiveEngineStatus] = useState<string>('Auto (Smart Detect)')
  
  // Continuous Voice Session States
  const [isContinuousVoiceActive, setIsContinuousVoiceActive] = useState(false)
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false)
  const [voiceDurationSeconds, setVoiceDurationSeconds] = useState(0)
  const [interimText, setInterimText] = useState('')
  const [voiceStatusText, setVoiceStatusText] = useState('')
  const [backendHealthy, setBackendHealthy] = useState(true)

  // Modals & Drawers
  const [isStudentHubOpen, setIsStudentHubOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isEventsModalOpen, setIsEventsModalOpen] = useState(false)
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false)
  const [unreadNotifs, setUnreadNotifs] = useState<StudentEventNotification[]>([])
  const [dismissedBannerIds, setDismissedBannerIds] = useState<number[]>([])

  const timerIntervalRef = useRef<any>(null)

  // Check onboarding on initial render
  useEffect(() => {
    getOnboarding()
      .then((data) => {
        if (!data || !data.completed) {
          setIsOnboardingOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  // Periodic health check
  useEffect(() => {
    const probe = async () => {
      const healthy = await checkHealth()
      setBackendHealthy(healthy)
    }
    probe()
    const interval = setInterval(probe, 20000)
    return () => clearInterval(interval)
  }, [])

  // Periodic unread event notifications check
  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const notifs = await getUnreadNotifications()
        setUnreadNotifs(notifs || [])
      } catch {}
    }
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 20000)
    return () => clearInterval(interval)
  }, [])

  const activeBannerNotif = unreadNotifs.find((n) => !dismissedBannerIds.includes(n.id) && n.mandatory)

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      voiceManager.stopContinuousSession()
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, isContinuousVoiceActive])

  // ── Session Management ──────────────────────────────────────────────────────

  const handleSelectSession = async (sid: string) => {
    setActiveSessionId(sid)
    setLoading(true)
    try {
      const session = await getSessionMessages(sid)
      setSessionTitle(session.title || 'Conversation')
      if (session.messages && session.messages.length > 0) {
        setMessages(
          session.messages.map((m: ChatMessageItem) => ({
            id: String(m.id),
            role: m.role,
            text: m.content,
            mode: m.mode,
            navResult: m.navResult,
            imageUrl: m.navResult?.imageUrl || m.navResult?.image_url,
            imageCaption: m.navResult?.imageCaption || m.navResult?.image_caption,
            timestamp: new Date(m.createdAt),
          }))
        )
      } else {
        setMessages([])
      }
    } catch (e) {
      console.error('Error loading session messages', e)
    } finally {
      setLoading(false)
    }
  }

  const handleNewChat = () => {
    setActiveSessionId(undefined)
    setSessionTitle('New Conversation')
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        text: `Hey, **${user.name || 'Friend'}**! 👋\n\nStarting a new chat. What would you like to explore today?`,
        timestamp: new Date(),
      },
    ])
  }

  // ── Message handling ────────────────────────────────────────────────────────

  const addMessage = useCallback((msg: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
    ])
  }, [])

  const handleSend = async (text: string, mode: 'text' | 'voice' = 'text') => {
    if (!text.trim() || loading) return
    setInput('')
    setLoading(true)

    addMessage({ role: 'user', text, mode })

    try {
      const result = await sendQuery(text, mode, activeSessionId)
      if (result.sessionId) {
        setActiveSessionId(result.sessionId)
        if (result.sessionTitle) {
          setSessionTitle(result.sessionTitle)
        }
      }
      addMessage({
        role: 'assistant',
        text: result.message,
        navResult: result,
        imageUrl: result.imageUrl || result.image_url,
        imageCaption: result.imageCaption || result.image_caption,
      })
    } catch (err: any) {
      console.error('[sendQuery failed]', err)
      const detail =
        err.response?.data?.error || err.response?.data?.detail || err.message || 'Connection failed'
      addMessage({
        role: 'assistant',
        text: `⚠️ **Service Alert**: ${detail}. Please ensure backend services are running.`,
      })
    } finally {
      setLoading(false)
    }
  }

  // ── True Continuous & Interruptible Voice Handling ──────────────────────────

  const handleVoiceSettingChange = (newSetting: VoiceUserSetting) => {
    setVoiceSetting(newSetting)
    voiceManager.setSetting(newSetting)
  }

  const handleStartContinuousVoice = async () => {
    if (isContinuousVoiceActive) return
    setIsContinuousVoiceActive(true)
    setVoiceDurationSeconds(0)
    setInterimText('')
    setVoiceStatusText('Starting continuous voice session…')

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    timerIntervalRef.current = setInterval(() => {
      setVoiceDurationSeconds((prev) => prev + 1)
    }, 1000)

    try {
      const { engine } = await voiceManager.startContinuousSession({
        onTranscript: (text, isFinal) => {
          setInterimText(text)
          if (isFinal) {
            addMessage({ role: 'user', text, mode: 'voice' })
          }
        },
        onAgentSpeaking: (speaking, snippet) => {
          setIsAgentSpeaking(speaking)
          if (speaking) {
            setVoiceStatusText('Assistant Speaking… (Tap mic or speak to interrupt)')
          } else {
            setVoiceStatusText('Listening… Speak naturally')
          }
        },
        onTurnComplete: (userText, assistantText, navResult) => {
          addMessage({
            role: 'assistant',
            text: assistantText,
            navResult,
            imageUrl: navResult?.imageUrl || navResult?.image_url,
            imageCaption: navResult?.imageCaption || navResult?.image_caption,
          })
          setInterimText('')
        },
        onInterruption: () => {
          setIsAgentSpeaking(false)
          setVoiceStatusText('Interrupted! Listening to your new question…')
        },
        onError: (err) => {
          setVoiceStatusText(err)
        },
        onStatusChange: (status) => {
          setVoiceStatusText(status)
        },
      })
      setActiveEngineStatus(
        engine === 'gemini_live' ? 'Gemini Live (Cloud Voice)' : 'Browser Speech Engine (Local)'
      )

      if (messages.length <= 1) {
        const studentName = user.name || 'Friend'
        voiceManager.speak(
          `Hello ${studentName}! I am your IARE AI companion. Your attendance and timetable are up to date. How can I help you today?`
        )
      }
    } catch (e) {
      console.warn('Continuous voice session start failed:', e)
      setVoiceStatusText('Voice session error. Please check microphone permissions.')
    }
  }

  const handleStopSpeakingOrInterrupt = () => {
    if (isAgentSpeaking) {
      voiceManager.interruptOrStopSpeaking()
      setIsAgentSpeaking(false)
      setVoiceStatusText('Interrupted — Listening to you…')
    } else {
      handleEndContinuousVoice()
    }
  }

  const handleEndContinuousVoice = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    voiceManager.stopContinuousSession()
    setIsContinuousVoiceActive(false)
    setIsAgentSpeaking(false)
    setInterimText('')
    setVoiceDurationSeconds(0)
    setVoiceStatusText('')
  }

  // ── Auto-start Continuous Voice on Login & App Load ─────────────────────────
  useEffect(() => {
    let started = false
    const tryAutoStart = () => {
      if (started) return
      started = true
      handleStartContinuousVoice()
    }

    // Auto-start after a brief 500ms delay to let the page settle
    const timer = setTimeout(() => {
      tryAutoStart()
    }, 500)

    // Fallback: if browser audio permissions require initial user gesture, activate on first click/key
    const interactionHandler = () => {
      if (!voiceManager.isContinuousSessionActive()) {
        tryAutoStart()
      }
    }
    window.addEventListener('click', interactionHandler, { once: true })
    window.addEventListener('keydown', interactionHandler, { once: true })

    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', interactionHandler)
      window.removeEventListener('keydown', interactionHandler)
    }
  }, [])

  const formatRecordingTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remSecs = secs % 60
    return `${mins}:${remSecs < 10 ? '0' : ''}${remSecs}`
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={styles.appShell}>
      {/* ── macOS Finder/Mail-Style Sidebar ──────────────────────────────── */}
      <aside style={styles.sidebar}>
        {/* App Title & Brand Header */}
        <div style={styles.brand}>
          <div style={styles.brandLogoBox}>
            <img
              src="/iare_logo.png"
              alt="IARE Crest"
              style={styles.brandLogoImg}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const parent = e.currentTarget.parentElement
                if (parent && !parent.querySelector('.logo-fallback')) {
                  const fallback = document.createElement('span')
                  fallback.className = 'logo-fallback'
                  fallback.innerText = '🏛️'
                  fallback.style.fontSize = '1.2rem'
                  parent.appendChild(fallback)
                }
              }}
            />
          </div>
          <div>
            <div style={styles.brandTitle}>IARE Agent</div>
            <div style={styles.brandSubtitle}>Campus AI Companion</div>
          </div>
        </div>

        {/* New Conversation Button */}
        <motion.div whileTap={{ scale: 0.97 }} transition={springs.snappy}>
          <Button
            variant="primary"
            size="md"
            icon={<Plus size={15} />}
            onClick={handleNewChat}
            style={{ width: '100%' }}
          >
            New Conversation
          </Button>
        </motion.div>

        {/* Navigation Tabs with Smooth Sliding Pill */}
        <nav style={styles.navGroup}>
          {[
            { id: 'chat', label: 'Active Chat', icon: <MessageSquare size={15} /> },
            { id: 'history', label: 'Chat History', icon: <Clock size={15} />, action: () => setIsHistoryOpen(true) },
            { id: 'academic', label: 'Academic Hub', icon: <GraduationCap size={15} />, action: () => setIsStudentHubOpen(true) },
            {
              id: 'events',
              label: 'Notices & Feed',
              icon: <Bell size={15} />,
              badge: unreadNotifs.length > 0 ? unreadNotifs.length : undefined,
              action: () => setIsEventsModalOpen(true),
            },
          ].map((item) => {
            const isActive = activeNavTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNavTab(item.id as SidebarNavTab)
                  if (item.action) item.action()
                }}
                style={{
                  ...styles.navItem,
                  color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    style={styles.navActivePill}
                    transition={springs.smooth}
                  />
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1 }}>
                  {item.icon}
                  <span style={styles.navItemLabel}>{item.label}</span>
                </span>
                {item.badge && (
                  <Badge variant="error" size="sm" style={{ zIndex: 1 }}>
                    {item.badge}
                  </Badge>
                )}
              </button>
            )
          })}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Voice Engine Mode Selector */}
        <div style={styles.voiceConfigSection}>
          <div style={styles.sectionHeaderRow}>
            <span style={styles.sectionLabel}>Voice Engine</span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: backendHealthy ? '#34C759' : '#FF3B30',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ● {backendHealthy ? 'Ready' : 'Offline'}
            </span>
          </div>

          <SegmentedControl
            options={[
              { value: 'auto', label: '⚡ Auto' },
              { value: 'online', label: '✨ Gemini' },
              { value: 'offline', label: '🎙 Local' },
            ]}
            value={voiceSetting}
            onChange={(v) => handleVoiceSettingChange(v as VoiceUserSetting)}
            size="sm"
            fullWidth
          />
        </div>

        {/* User Profile Card & Sign Out */}
        <div style={styles.profileCard}>
          <div style={styles.profileAvatar}>
            {user.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user.name}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              (user.name || user.email || 'S').charAt(0).toUpperCase()
            )}
          </div>
          <div style={styles.profileInfo}>
            <div style={styles.profileName}>{user.name || 'IARE Student'}</div>
            <div style={styles.profileEmail}>{user.rollNo || user.email}</div>
          </div>
          <button
            onClick={handleLogout}
            style={styles.logoutBtn}
            title="Sign Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* ── Main Workspace Area ─────────────────────────────────────────── */}
      <main style={styles.main}>
        {/* Top Frosted Navbar */}
        <header style={styles.navbar}>
          <div style={styles.navLeft}>
            <span style={styles.navTitle}>{sessionTitle}</span>
            <span style={styles.navSubtitle}>AI Academic, Reasoning & Navigation Companion</span>
          </div>

          <div style={styles.navRight}>
            <Button
              variant="glass"
              size="sm"
              icon={<Bell size={14} />}
              onClick={() => setIsEventsModalOpen(true)}
            >
              <span>Notices</span>
              {unreadNotifs.length > 0 && (
                <Badge variant="error" size="sm" style={{ marginLeft: '4px' }}>
                  {unreadNotifs.length}
                </Badge>
              )}
            </Button>

            <Button
              variant="glass"
              size="sm"
              icon={<GraduationCap size={14} />}
              onClick={() => setIsStudentHubOpen(true)}
            >
              Academic Hub
            </Button>

            <ThemeToggle />
          </div>
        </header>

        {/* Top Mandatory Banner (Dismissible) */}
        {activeBannerNotif && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.snappy}
            style={styles.topMandatoryBanner}
          >
            <div style={styles.topBannerLeft}>
              <Badge variant="error" size="sm" icon={<AlertTriangle size={11} />}>
                MANDATORY DIRECTIVE
              </Badge>
              <span style={styles.topBannerText}>
                <strong>{activeBannerNotif.title}:</strong> {activeBannerNotif.message}
              </span>
            </div>
            <div style={styles.topBannerRight}>
              {activeBannerNotif.actionUrl && (
                <a
                  href={activeBannerNotif.actionUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.bannerActionLink}
                >
                  Register Now &rarr;
                </a>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEventsModalOpen(true)}
              >
                View Notice
              </Button>
              <button
                onClick={() => setDismissedBannerIds((prev) => [...prev, activeBannerNotif.id])}
                style={styles.bannerCloseBtn}
                title="Dismiss Banner"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}

        {/* Chat Feed / Messages */}
        <div style={styles.messagesContainer}>
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              onFollowUp={(q) => handleSend(q)}
            />
          ))}

          {loading && (
            <div style={styles.thinkingBubble} className="animate-fade-in">
              <span style={styles.dot} />
              <span style={{ ...styles.dot, animationDelay: '0.15s' }} />
              <span style={{ ...styles.dot, animationDelay: '0.30s' }} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Suggestion Cards (iOS Widget Layout) */}
        <div style={styles.quickActionsSection}>
          <div style={styles.quickActionsHeader}>
            <Lightbulb size={13} style={{ color: 'var(--accent-color)' }} />
            <span>Suggested Inquiries</span>
          </div>

          <div style={styles.quickActionsScroll}>
            {[
              { icon: <BarChart3 size={14} />, label: 'Academic Standing', action: () => handleSend('What is my current academic standing and overall attendance percentage?') },
              { icon: <Clock size={14} />, label: "Today's Schedule", action: () => handleSend('What is my class schedule and timetable for today?') },
              { icon: <Zap size={14} />, label: 'Lab Submissions', action: () => handleSend('Show my upcoming lab experiments, submissions, and deadlines') },
              { icon: <GraduationCap size={14} />, label: 'Faculty Directory', action: () => handleSend('Who is the faculty for Data Mining and Machine Learning in CSE?') },
              { icon: <ImageIcon size={14} />, label: 'Data Structures & Algorithms', action: () => handleSend('Explain Binary Search Trees with time complexities, code, and operations') },
              { icon: <Award size={14} />, label: 'Start Technical Assessment', action: () => setIsAssessmentOpen(true) },
            ].map((chip, idx) => (
              <motion.button
                key={idx}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                style={{
                  ...styles.quickActionChip,
                  border: chip.label === 'Start Technical Assessment' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                  background: chip.label === 'Start Technical Assessment' ? 'var(--accent-subtle)' : 'var(--bg-sunken)',
                }}
                onClick={chip.action}
                disabled={loading}
              >
                <span style={styles.quickActionIcon}>{chip.icon}</span>
                <span style={{
                  ...styles.quickActionLabel,
                  fontWeight: chip.label === 'Start Technical Assessment' ? 700 : 500,
                  color: chip.label === 'Start Technical Assessment' ? 'var(--accent-color)' : 'var(--text-primary)',
                }}>
                  {chip.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Floating Input Dock (Apple-Style Capsule with Spring Physics) */}
        <div style={styles.inputDock}>
          <motion.div
            layout
            transition={springs.smooth}
            style={isContinuousVoiceActive ? styles.inputCardRecording : styles.inputCard}
          >
            {isContinuousVoiceActive ? (
              <div style={styles.recordingBar}>
                {/* Timer & Pulsing Live Indicator */}
                <div style={styles.recordingTimerBox}>
                  <span style={styles.pulsingDot} />
                  <span style={styles.timerText}>{formatRecordingTime(voiceDurationSeconds)}</span>
                  <Badge variant="primary" size="sm" style={{ marginLeft: '6px' }}>
                    {isAgentSpeaking ? 'Agent Speaking' : 'Live Hot Mic'}
                  </Badge>
                </div>

                {/* Sound Waveform + Live Status / Speech Preview */}
                <div style={styles.recordingCenter}>
                  <AppleWaveform active={true} />
                  <span style={styles.recordingLiveText}>
                    {interimText || voiceStatusText || 'Listening continuously… Speak anytime'}
                  </span>
                </div>

                {/* Live Controls: Stop Speaking / Barge-In + End Session */}
                <div style={styles.recordingActions}>
                  {isAgentSpeaking && (
                    <button
                      onClick={handleStopSpeakingOrInterrupt}
                      style={styles.interruptVoiceBtn}
                      title="Tap to Stop Speaking (Interrupt Agent)"
                    >
                      <Square size={14} fill="currentColor" />
                      <span>Interrupt</span>
                    </button>
                  )}

                  <button
                    onClick={handleEndContinuousVoice}
                    style={styles.cancelVoiceBtn}
                    title="End Continuous Voice Session"
                  >
                    <PhoneOff size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your attendance, courses, deadlines, or campus navigation…"
                  style={styles.textarea}
                  rows={1}
                />

                <div style={styles.inputActions}>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    transition={springs.snappy}
                    onClick={handleStartContinuousVoice}
                    style={styles.micBtn}
                    title="Start Continuous Voice Session (Hands-Free)"
                  >
                    <Mic size={18} />
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    transition={springs.snappy}
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || loading}
                    style={{
                      ...styles.sendBtn,
                      opacity: !input.trim() || loading ? 0.45 : 1,
                    }}
                    title="Send message"
                  >
                    <Send size={16} />
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </main>

      {/* ── Modals & Drawers ──────────────────────────────────────────────── */}
      <StudentMonitorModal
        isOpen={isStudentHubOpen}
        onClose={() => setIsStudentHubOpen(false)}
        onAskAI={(prompt: string) => {
          setIsStudentHubOpen(false)
          handleSend(prompt)
        }}
      />

      <EventsNoticesModal
        isOpen={isEventsModalOpen}
        onClose={() => {
          setIsEventsModalOpen(false)
          getUnreadNotifications().then(setUnreadNotifs).catch(() => {})
        }}
      />

      <ChatHistoryDrawer
        isOpen={isHistoryOpen}
        activeSessionId={activeSessionId}
        onClose={() => setIsHistoryOpen(false)}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
      />

      <TechnicalAssessmentModal
        isOpen={isAssessmentOpen}
        onClose={() => setIsAssessmentOpen(false)}
        onComplete={(subject, score, total) => {
          setIsAssessmentOpen(false)
          handleSend(`I completed my proctored assessment in ${subject} with score ${score}/${total}! What areas should I focus on next?`)
        }}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onCompleted={() => {
          setIsOnboardingOpen(false)
          handleSend('Hello! I just finished my onboarding setup.')
        }}
      />
    </div>
  )
}

// ── Chat Bubble Component ─────────────────────────────────────────────────────

function ChatBubble({ message, onFollowUp }: { message: Message; onFollowUp: (q: string) => void }) {
  const isUser = message.role === 'user'
  const isWeak = message.navResult?.is_weakness_trigger
  const topic = message.navResult?.topic
  const [copied, setCopied] = useState(false)

  const rawText = message.text || message.navResult?.message || ''

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!rawText) return
    try {
      await navigator.clipboard.writeText(rawText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.warn('Copy to clipboard failed:', err)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springs.smooth}
      style={isUser ? styles.userRow : styles.assistantRow}
    >
      {!isUser && (
        <div style={styles.assistantAvatar}>
          <Sparkles size={16} color="var(--accent-color)" />
        </div>
      )}

      <div style={isUser ? styles.userBubble : styles.assistantBubble}>
        {message.mode === 'voice' && (
          <div style={{ marginBottom: '6px' }}>
            <Badge variant="primary" size="sm" icon={<Mic size={10} />}>
              Voice Turn
            </Badge>
          </div>
        )}

        {/* Generated Visual Diagram or Concept Illustration */}
        {message.imageUrl && (
          <div style={styles.visualImageCard}>
            <div style={styles.visualImageHeader}>
              <ImageIcon size={13} style={{ color: 'var(--accent-color)' }} />
              <span style={styles.visualImageTitle}>
                {message.imageCaption || 'Conceptual Visual Architecture'}
              </span>
            </div>
            <img
              src={message.imageUrl}
              alt={message.imageCaption || 'Visual explanation diagram'}
              style={styles.visualImage}
            />
          </div>
        )}

        {/* Markdown content rendering */}
        <div
          style={isUser ? styles.userBubbleText : styles.assistantBubbleText}
          dangerouslySetInnerHTML={{
            __html: (message.text || message.navResult?.message || '')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              .replace(
                /`([^`]+)`/g,
                `<code style="background:${
                  isUser ? 'rgba(255,255,255,0.25)' : 'var(--bg-sunken)'
                };color:${
                  isUser ? '#FFFFFF' : 'var(--text-primary)'
                };padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.85em;font-weight:600;">$1</code>`
              )
              .replace(/\n/g, '<br/>'),
          }}
        />

        {/* Weakness Detection Practice Suggestion Chips */}
        {!isUser && (isWeak || topic) && (
          <div style={styles.weaknessChipsContainer}>
            <div style={styles.weaknessLabel}>
              <Sparkles size={13} style={{ color: 'var(--accent-color)' }} />
              <span>Recommended Practice:</span>
            </div>
            <div style={styles.weaknessChipsRow}>
              <Button
                variant="accent-subtle"
                size="sm"
                onClick={() => onFollowUp(`Give me a 3-question focused practice quiz with answers on ${topic}`)}
              >
                🎯 3-Question Quiz on {topic}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onFollowUp(`Generate a high-yield concept summary and key formulas for ${topic}`)}
              >
                📝 Quick Cheat Sheet
              </Button>
            </div>
          </div>
        )}

        {/* ON-DEMAND ONLY INLINE CAMPUS MAP */}
        {message.navResult?.success &&
          message.navResult.route_stops &&
          message.navResult.route_stops.length > 1 && (
            <div style={{ marginTop: '12px' }}>
              <RouteCard result={message.navResult} />
              <div style={styles.inlineMapContainer}>
                <MapOverlay activeRoute={message.navResult} />
              </div>
            </div>
          )}

        {/* Message Footer: Timestamp & ChatGPT-Style Copy Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginTop: '6px',
          paddingTop: '2px',
        }}>
          <div style={isUser ? styles.userTimestamp : styles.assistantTimestamp}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>

          <button
            onClick={handleCopy}
            title={copied ? 'Copied to clipboard!' : 'Copy text'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 7px',
              borderRadius: 'var(--radius-sm)',
              background: isUser ? 'rgba(255, 255, 255, 0.18)' : 'var(--bg-sunken)',
              border: `1px solid ${isUser ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-subtle)'}`,
              color: isUser ? 'rgba(255, 255, 255, 0.95)' : 'var(--text-secondary)',
              fontSize: '0.7rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {copied ? (
              <>
                <Check size={11} style={{ color: isUser ? '#FFFFFF' : '#34C759' }} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Route Navigation Card ─────────────────────────────────────────────────────

function RouteCard({ result }: { result: NavResult }) {
  return (
    <div style={styles.routeCard}>
      <div style={styles.routeHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={15} color="var(--accent-color)" />
          <span style={styles.routeTitle}>
            {result.source_node} → {result.destination_node}
          </span>
        </div>
        <Badge variant="primary" size="sm">
          {Math.round(result.total_distance_meters || 0)}m
        </Badge>
      </div>

      <div style={styles.routeTimeline}>
        {(result.route_stops || []).map((stop, i) => (
          <div key={stop} style={styles.routeStepItem}>
            <div style={styles.routeStepIndex}>{i + 1}</div>
            <span style={styles.routeStopName}>{stop}</span>
            {i < (result.route_stops?.length || 0) - 1 && (
              <span style={styles.routeConnector}>→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Apple-Style Sound Waveform Graphic ────────────────────────────────────────

function AppleWaveform({ active }: { active: boolean }) {
  const bars = [8, 14, 22, 12, 28, 18, 10, 24, 16, 30, 20, 12, 26, 14, 8]
  return (
    <div style={styles.waWaveform}>
      {bars.map((h, i) => (
        <span
          key={i}
          style={{
            ...styles.waBar,
            height: active ? undefined : `${h * 0.4}px`,
            animation: active
              ? `waveformPulse 0.75s ease-in-out ${i * 0.05}s infinite alternate`
              : 'none',
          }}
        />
      ))}
    </div>
  )
}

// ── Styles (macOS/iOS Visual System) ──────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  appShell: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-page)',
    fontFamily: 'var(--font-family)',
  },

  // Sidebar
  sidebar: {
    width: '280px',
    minWidth: '280px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-sidebar)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    borderRight: '1px solid var(--border-subtle)',
    padding: '18px 16px',
    gap: '14px',
    overflowY: 'auto',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '4px 0',
  },
  brandLogoBox: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, rgba(10, 132, 255, 0.2), rgba(0, 113, 227, 0.1))',
    border: '1px solid var(--border-glass)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  brandLogoImg: {
    width: '26px',
    height: '26px',
    objectFit: 'contain',
  },
  brandLogoEmoji: {
    fontSize: '1.1rem',
    position: 'absolute',
  },
  brandTitle: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
  },
  brandSubtitle: {
    fontSize: '0.6875rem',
    color: 'var(--text-tertiary)',
    fontWeight: 500,
  },

  navGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    position: 'relative',
  },
  navItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '9px 12px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'color 0.15s ease',
  },
  navItemLabel: {
    fontSize: '0.8125rem',
    fontWeight: 600,
  },
  navActivePill: {
    position: 'absolute',
    inset: 0,
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--accent-subtle)',
    border: '1px solid var(--border-glass)',
    zIndex: 0,
  },

  voiceConfigSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--bg-glass)',
    border: '1px solid var(--border-glass)',
  },
  sectionHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  profileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-glass)',
    border: '1px solid var(--border-subtle)',
  },
  profileAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-color)',
    color: '#ffffff',
    fontSize: '0.8125rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  profileEmail: {
    fontSize: '0.6875rem',
    color: 'var(--text-tertiary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s, background-color 0.15s',
  },

  // Main Workspace
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-page)',
  },
  navbar: {
    height: '56px',
    minHeight: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    backgroundColor: 'var(--bg-navbar)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    borderBottom: '1px solid var(--border-subtle)',
    zIndex: 10,
  },
  navLeft: {
    display: 'flex',
    flexDirection: 'column',
  },
  navTitle: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  navSubtitle: {
    fontSize: '0.6875rem',
    color: 'var(--text-tertiary)',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  // Top Banner
  topMandatoryBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
    borderBottom: '1px solid rgba(255, 69, 58, 0.25)',
    gap: '12px',
    zIndex: 9,
  },
  topBannerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
  },
  topBannerText: {
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
  },
  topBannerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  bannerActionLink: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#FF453A',
    textDecoration: 'none',
    marginRight: '8px',
  },
  bannerCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '4px',
  },

  // Messages Container
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  assistantRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  assistantAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-glass)',
    border: '1px solid var(--border-glass)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '2px',
    flexShrink: 0,
  },
  userBubble: {
    maxWidth: '70%',
    backgroundColor: 'var(--bubble-user-bg)',
    color: 'var(--bubble-user-text)',
    padding: '12px 18px',
    borderRadius: '18px 18px 4px 18px',
    boxShadow: 'var(--shadow-card)',
  },
  assistantBubble: {
    maxWidth: '75%',
    backgroundColor: 'var(--bubble-assistant-bg)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: '1px solid var(--bubble-assistant-border)',
    color: 'var(--text-primary)',
    padding: '16px 20px',
    borderRadius: '18px 18px 18px 4px',
    boxShadow: 'var(--shadow-card)',
  },
  userBubbleText: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
    color: 'var(--bubble-user-text)',
  },
  assistantBubbleText: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: 'var(--bubble-assistant-text)',
  },
  userTimestamp: {
    fontSize: '0.6875rem',
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'right',
    marginTop: '4px',
  },
  assistantTimestamp: {
    fontSize: '0.6875rem',
    color: 'var(--text-tertiary)',
    textAlign: 'right',
    marginTop: '6px',
  },

  // Visual Image Card
  visualImageCard: {
    marginBottom: '14px',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-glass)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-card)',
  },
  visualImageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-glass)',
    borderBottom: '1px solid var(--border-glass)',
  },
  visualImageTitle: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
  },
  visualImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '340px',
    display: 'block',
    objectFit: 'contain',
    backgroundColor: '#0D1117',
  },

  // Inline Map Container (ON-DEMAND ONLY)
  inlineMapContainer: {
    marginTop: '10px',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    border: '1px solid var(--border-glass)',
    boxShadow: 'var(--shadow-card)',
  },

  // Weakness Chips
  weaknessChipsContainer: {
    marginTop: '12px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-glass)',
    border: '1px solid var(--border-glass)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  weaknessLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  weaknessChipsRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },

  // Route Card
  routeCard: {
    marginTop: '12px',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-glass)',
    border: '1px solid var(--border-glass)',
  },
  routeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  routeTitle: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  routeTimeline: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px',
  },
  routeStepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  routeStepIndex: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-subtle)',
    color: 'var(--accent-color)',
    fontSize: '0.6875rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeStopName: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  routeConnector: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
    marginLeft: '2px',
  },

  // Thinking Bubble
  thinkingBubble: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: 'var(--bubble-assistant-bg)',
    border: '1px solid var(--bubble-assistant-border)',
    borderRadius: '16px',
    alignSelf: 'flex-start',
    width: 'fit-content',
    marginLeft: '44px',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-color)',
    animation: 'waveformPulse 0.8s infinite alternate ease-in-out',
  },

  // Quick Action Suggestions
  quickActionsSection: {
    padding: '6px 32px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  quickActionsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  quickActionsScroll: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  quickActionChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--bg-glass)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: '1px solid var(--border-glass)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontSize: '0.75rem',
    fontWeight: 600,
    boxShadow: 'var(--shadow-card)',
  },
  quickActionIcon: {
    color: 'var(--accent-color)',
    display: 'flex',
  },
  quickActionLabel: {
    color: 'var(--text-primary)',
  },

  // Floating Input Dock
  inputDock: {
    padding: '12px 32px 20px',
  },
  inputCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px 8px 18px',
    borderRadius: '24px',
    backgroundColor: 'var(--bg-glass)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: '1px solid var(--border-glass)',
    boxShadow: 'var(--shadow-elevated)',
    gap: '10px',
  },
  inputCardRecording: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    borderRadius: '24px',
    backgroundColor: 'var(--bg-glass)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
    border: '1.5px solid var(--accent-color)',
    boxShadow: 'var(--shadow-modal)',
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-family)',
    resize: 'none',
    lineHeight: 1.4,
  },
  inputActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  micBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'var(--accent-subtle)',
    color: 'var(--accent-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.15s, background-color 0.15s',
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'var(--accent-color)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.15s, opacity 0.15s',
  },

  // Recording Dock
  recordingBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: '12px',
  },
  recordingTimerBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  pulsingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#FF3B30',
    animation: 'waveformPulse 0.6s infinite alternate ease-in-out',
  },
  timerText: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
  },
  recordingCenter: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    overflow: 'hidden',
  },
  recordingLiveText: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '380px',
  },
  recordingActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  interruptVoiceBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid rgba(255, 149, 0, 0.4)',
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    color: '#FF9500',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  cancelVoiceBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    color: '#FF3B30',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  // Waveform
  waWaveform: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    height: '24px',
  },
  waBar: {
    width: '3px',
    borderRadius: '2px',
    backgroundColor: 'var(--accent-color)',
    display: 'inline-block',
  },
}
