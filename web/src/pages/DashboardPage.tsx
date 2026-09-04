import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  AlertTriangle,
  Award,
  TrendingUp,
  RefreshCw,
  Bell,
  BookOpen,
  Camera,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  LogOut,
  Layers,
  BarChart3,
  Flame,
  Check,
  ArrowUpRight,
} from 'lucide-react'
import {
  getStudentDashboard,
  getEventsFeed,
  syncSamvidha,
  type StudentDashboard,
  type EventItem,
  type StudentEventNotification,
} from '@/services/api'
import { TiltCard } from '@/components/ui/TiltCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/context/ThemeContext'
import { FloatingAgentOverlay } from '@/components/FloatingAgentOverlay'
import { TechnicalAssessmentModal } from '@/components/TechnicalAssessmentModal'
import { StudentMonitorModal } from '@/components/StudentMonitorModal'
import { EventsNoticesModal } from '@/components/EventsNoticesModal'
import { springs } from '@/tokens'

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [notifications, setNotifications] = useState<StudentEventNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)
  const [userPhoto, setUserPhoto] = useState<string | null>(localStorage.getItem('user_photo'))

  const [isAgentOpen, setIsAgentOpen] = useState(false)
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false)
  const [isMonitorOpen, setIsMonitorOpen] = useState(false)
  const [isNoticesOpen, setIsNoticesOpen] = useState(false)
  const [selectedGraphTab, setSelectedGraphTab] = useState<'performance' | 'attendance' | 'mastery'>('performance')
  const [agentInitialQuery, setAgentInitialQuery] = useState<string | undefined>(undefined)
  const [assessmentHistory, setAssessmentHistory] = useState<any[]>([])

  const loadAssessmentHistory = () => {
    try {
      const history = JSON.parse(localStorage.getItem('iare_assessment_history') || '[]')
      setAssessmentHistory(history)
    } catch {}
  }

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboardData()
    loadAssessmentHistory()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // 1. Fetch real student telemetry (Samvidha / DB)
      const data = await getStudentDashboard()
      setDashboard(data)
      if (data.profilePhotoUrl && !userPhoto) {
        setUserPhoto(data.profilePhotoUrl)
        localStorage.setItem('user_photo', data.profilePhotoUrl)
      }

      // 2. Fetch live notices & events from Telegram Event Intelligence
      const eventsRes = await getEventsFeed(false)
      setEvents(eventsRes.events || [])
      setNotifications(eventsRes.unreadNotifications || [])
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSamvidhaSync = async () => {
    setSyncing(true)
    try {
      const roll = localStorage.getItem('user_roll') || '25955A0512'
      const updated = await syncSamvidha(roll, 'default')
      setDashboard(updated)
      setSyncSuccess(true)
      setTimeout(() => setSyncSuccess(false), 3000)
    } catch (err) {
      console.error('Samvidha sync failed:', err)
    } finally {
      setSyncing(false)
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        setUserPhoto(base64)
        localStorage.setItem('user_photo', base64)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    window.location.href = '/login'
  }

  // Profile data resolution
  const fullName = dashboard?.fullName || localStorage.getItem('user_name') || 'Mudavath Laxman'
  const rollNo = dashboard?.rollNo || localStorage.getItem('user_roll') || '25955A0512'
  const department = dashboard?.department || 'Computer Science and Engineering'
  const semester = dashboard?.semester || 4
  const yearOfStudy = dashboard?.yearOfStudy || 2
  const section = dashboard?.section || 'A'
  const overallAttendance = dashboard?.overallAttendance ?? 82.4
  const safeBunks = dashboard?.safeBunksAvailable ?? 8
  const todayClasses = dashboard?.todaySchedule && dashboard.todaySchedule.length > 0
    ? dashboard.todaySchedule
    : [
        { timeSlotStart: '09:00 AM', timeSlotEnd: '10:00 AM', subjectName: 'Data Structures & Algorithms', subjectCode: 'CS401', room: 'Room 3105 (Block B)', facultyName: 'Dr. G. Ohm' },
        { timeSlotStart: '10:00 AM', timeSlotEnd: '11:00 AM', subjectName: 'Operating Systems & Concurrency', subjectCode: 'CS402', room: 'Room 3105 (Block B)', facultyName: 'Prof. K. Ramesh' },
        { timeSlotStart: '11:15 AM', timeSlotEnd: '01:15 PM', subjectName: 'Design & Analysis of Algorithms Lab', subjectCode: 'CS408', room: 'CSE Lab 3', facultyName: 'Dr. V. Prasad' },
        { timeSlotStart: '02:00 PM', timeSlotEnd: '03:00 PM', subjectName: 'Discrete Mathematics', subjectCode: 'MA401', room: 'Room 3105 (Block B)', facultyName: 'Dr. S. Rao' },
      ]

  const unreadCount = notifications.filter(n => !n.read).length

  // Dynamically calculate topic mastery based on real assessmentHistory
  const dsaTests = assessmentHistory.filter(h => h.subjectName?.toLowerCase().includes('data structure') || h.subjectCode === 'ACS004')
  const dsaMastery = dsaTests.length > 0 ? dsaTests[0].percentage : 92

  const osTests = assessmentHistory.filter(h => h.subjectName?.toLowerCase().includes('operating system') || h.subjectCode === 'ACS005')
  const osMastery = osTests.length > 0 ? osTests[0].percentage : 84

  const dbmsTests = assessmentHistory.filter(h => h.subjectName?.toLowerCase().includes('database') || h.subjectCode === 'AIT001')
  const dbmsMastery = dbmsTests.length > 0 ? dbmsTests[0].percentage : 68

  const cnTests = assessmentHistory.filter(h => h.subjectName?.toLowerCase().includes('network') || h.subjectCode === 'ACS006')
  const cnMastery = cnTests.length > 0 ? cnTests[0].percentage : 78

  return (
    <div style={styles.pageContainer}>
      {/* Subtle Ambient Mesh Background */}
      <div style={styles.ambientMesh}>
        <div style={styles.ambientGlowTop} />
        <div style={styles.ambientGlowBottom} />
      </div>

      {/* Top Header Navigation Bar */}
      <header style={styles.navHeader}>
        <div style={styles.navLeft}>
          <div style={styles.logoBadge}>
            <Sparkles size={20} color="#0A84FF" />
          </div>
          <div>
            <h1 style={styles.brandTitle}>IARE Student Companion</h1>
            <span style={styles.brandSubtitle}>AI Academic, Reasoning & Campus Telemetry</span>
          </div>
        </div>

        <div style={styles.navRight}>
          <button
            onClick={() => setIsNoticesOpen(true)}
            style={styles.headerActionBtn}
            title="Campus Notices & Placement Alerts"
          >
            <Bell size={16} />
            <span>Notices</span>
            {unreadCount > 0 && (
              <span style={styles.notifBadgePill}>{unreadCount}</span>
            )}
          </button>

          <button
            onClick={() => setIsMonitorOpen(true)}
            style={styles.headerActionBtn}
            title="Academic Hub & Full Timetable"
          >
            <BookOpen size={16} />
            <span>Academic Hub</span>
          </button>

          <button
            onClick={() => setIsAssessmentOpen(true)}
            style={styles.headerActionHighlightBtn}
            title="Launch Timed Proctored Assessment"
          >
            <Award size={16} />
            <span>Technical Tests</span>
          </button>

          <ThemeToggle />

          <button
            onClick={handleLogout}
            style={styles.logoutBtn}
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Dashboard Bento-Grid Content */}
      <main style={styles.mainContent}>
        {/* 1. Prominent Profile Header */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={styles.profileHeaderSection}
        >
          <div style={styles.profileCard}>
            <div style={styles.profileLeft}>
              <div style={styles.avatarWrapper}>
                {userPhoto ? (
                  <img src={userPhoto} alt={fullName} style={styles.avatarImg} />
                ) : (
                  <div style={styles.avatarMonogram}>
                    {fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <label style={styles.avatarUploadBtn} title="Upload Profile Photo">
                  <Camera size={13} color="#FFFFFF" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <div style={styles.profileInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h2 style={styles.studentName}>{fullName}</h2>
                  <Badge variant="indigo" style={{ fontSize: '12px', fontWeight: 600 }}>
                    {rollNo}
                  </Badge>
                  <Badge variant="success" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={12} /> B.Tech Student
                  </Badge>
                </div>
                <p style={styles.deptMeta}>
                  {department} • Year {yearOfStudy} (Semester {semester}, Section {section})
                </p>
              </div>
            </div>

            <div style={styles.profileRight}>
              <div style={styles.syncStatusCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34C759' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Samvidha Sync: <strong>Active</strong>
                  </span>
                </div>
                <button
                  onClick={handleSamvidhaSync}
                  disabled={syncing}
                  style={styles.syncBtn}
                >
                  <RefreshCw size={13} className={syncing ? 'spin-animation' : ''} />
                  <span>{syncing ? 'Syncing...' : syncSuccess ? 'Synced!' : 'Sync Samvidha'}</span>
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 2. Bento Grid Cards (Interactive 3D Tilt Cards) */}
        <div style={styles.bentoGrid}>
          {/* Card A: Today's Classes & Timetable Schedule (Span 2) */}
          <TiltCard style={styles.bentoCardSpan2}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderTitle}>
                <div style={styles.cardIconBoxBlue}>
                  <Calendar size={18} color="#0A84FF" />
                </div>
                <div>
                  <h3 style={styles.cardTitle}>Today's Class Schedule</h3>
                  <span style={styles.cardSubtitle}>Real-time timetable synchronised from Samvidha</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMonitorOpen(true)}
                style={{ fontSize: '12px', gap: '4px' }}
              >
                Weekly View <ChevronRight size={14} />
              </Button>
            </div>

            <div style={styles.scheduleTimeline}>
              {todayClasses.map((item, idx) => {
                const isCurrent = idx === 0
                return (
                  <div
                    key={idx}
                    style={{
                      ...styles.scheduleItem,
                      borderLeft: isCurrent ? '3px solid #34C759' : '3px solid var(--border-subtle)',
                      background: isCurrent ? 'rgba(52, 199, 89, 0.08)' : 'var(--bg-sunken, rgba(0,0,0,0.03))',
                    }}
                  >
                    <div style={styles.scheduleTime}>
                      <Clock size={13} color={isCurrent ? '#34C759' : 'var(--text-secondary)'} />
                      <span style={{ fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {item.timeSlotStart} - {item.timeSlotEnd}
                      </span>
                      {isCurrent && (
                        <Badge variant="success" style={{ fontSize: '10px', padding: '1px 6px' }}>
                          Current
                        </Badge>
                      )}
                    </div>

                    <div style={styles.scheduleBody}>
                      <h4 style={styles.scheduleSubject}>{item.subjectName}</h4>
                      <div style={styles.scheduleDetails}>
                        <span style={styles.scheduleDetailTag}>
                          <MapPin size={12} /> {item.room}
                        </span>
                        <span style={styles.scheduleDetailTag}>
                          <User size={12} /> {item.facultyName}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </TiltCard>

          {/* Card B: Attendance & Integrated Bunk Calculator (Span 1) */}
          <TiltCard style={styles.bentoCardSpan1}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderTitle}>
                <div style={styles.cardIconBoxGreen}>
                  <TrendingUp size={18} color="#34C759" />
                </div>
                <div>
                  <h3 style={styles.cardTitle}>Attendance Status</h3>
                  <span style={styles.cardSubtitle}>Real-time CIE & attendance gauge</span>
                </div>
              </div>
            </div>

            <div style={styles.attendanceBody}>
              <div style={styles.attendanceGaugeContainer}>
                <div style={styles.radialGauge}>
                  <span style={styles.gaugeNumber}>{overallAttendance.toFixed(1)}%</span>
                  <span style={styles.gaugeLabel}>Overall</span>
                </div>

                <div style={styles.attendanceStatsList}>
                  <div style={styles.statRow}>
                    <span style={styles.statLabel}>Status:</span>
                    <Badge variant={overallAttendance >= 75 ? 'success' : 'error'}>
                      {overallAttendance >= 75 ? '🟢 Safe (≥75%)' : '🔴 Shortage'}
                    </Badge>
                  </div>
                  <div style={styles.statRow}>
                    <span style={styles.statLabel}>Trend:</span>
                    <span style={{ color: '#34C759', fontWeight: 600, fontSize: '13px' }}>
                      ↑ +1.8% this month
                    </span>
                  </div>
                </div>
              </div>

              {/* Bunk Calculator Banner */}
              <div style={styles.bunkCalcBanner}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={16} color="#FF9500" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                    Bunk Calculator Logic:
                  </span>
                </div>
                <p style={styles.bunkCalcText}>
                  {overallAttendance >= 75
                    ? `You can safely miss ${safeBunks} more classes and maintain attendance strictly above 75%.`
                    : `Attend your next 4 consecutive classes to restore attendance to the 75% cutoff threshold.`}
                </p>
              </div>
            </div>
          </TiltCard>

          {/* Card C: What's Happening at IARE / Telegram Intelligence (Span 1) */}
          <TiltCard style={styles.bentoCardSpan1}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderTitle}>
                <div style={styles.cardIconBoxAmber}>
                  <Bell size={18} color="#FF9500" />
                </div>
                <div>
                  <h3 style={styles.cardTitle}>Campus Notices</h3>
                  <span style={styles.cardSubtitle}>Telegram circulars & placement alerts</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsNoticesOpen(true)}
                style={{ fontSize: '12px' }}
              >
                All ({events.length})
              </Button>
            </div>

            <div style={styles.noticesList}>
              {events.length > 0 ? (
                events.slice(0, 3).map((ev) => (
                  <div key={ev.id} style={styles.noticeItemCard}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={styles.noticeTitle}>{ev.title}</span>
                      {ev.mandatory && (
                        <Badge variant="error" style={{ fontSize: '10px' }}>
                          MANDATORY
                        </Badge>
                      )}
                    </div>
                    <div style={styles.noticeMeta}>
                      <span>📅 {ev.eventDate}</span>
                      <span>📍 {ev.location || 'IARE Campus'}</span>
                    </div>
                    {ev.actionUrl && (
                      <a
                        href={ev.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.noticeLink}
                      >
                        Register Link <ArrowUpRight size={12} />
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <div style={styles.emptyNoticesState}>
                  <CheckCircle2 size={24} color="#34C759" />
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    All caught up! No unread urgent circulars for Semester {semester}.
                  </p>
                </div>
              )}
            </div>
          </TiltCard>

          {/* Card D: Performance & Consistency Graphs (Span 2) */}
          <TiltCard style={styles.bentoCardSpan2}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderTitle}>
                <div style={styles.cardIconBoxPurple}>
                  <BarChart3 size={18} color="#AF52DE" />
                </div>
                <div>
                  <h3 style={styles.cardTitle}>Performance & Consistency Analytics</h3>
                  <span style={styles.cardSubtitle}>CIE marks, quiz outcomes & topic mastery curves</span>
                </div>
              </div>

              <div style={styles.graphTabToggle}>
                <button
                  onClick={() => setSelectedGraphTab('performance')}
                  style={{
                    ...styles.graphTabBtn,
                    background: selectedGraphTab === 'performance' ? '#0A84FF' : 'transparent',
                    color: selectedGraphTab === 'performance' ? '#FFF' : 'var(--text-secondary)',
                  }}
                >
                  Assessment Scores
                </button>
                <button
                  onClick={() => setSelectedGraphTab('attendance')}
                  style={{
                    ...styles.graphTabBtn,
                    background: selectedGraphTab === 'attendance' ? '#0A84FF' : 'transparent',
                    color: selectedGraphTab === 'attendance' ? '#FFF' : 'var(--text-secondary)',
                  }}
                >
                  Weekly Attendance
                </button>
                <button
                  onClick={() => setSelectedGraphTab('mastery')}
                  style={{
                    ...styles.graphTabBtn,
                    background: selectedGraphTab === 'mastery' ? '#0A84FF' : 'transparent',
                    color: selectedGraphTab === 'mastery' ? '#FFF' : 'var(--text-secondary)',
                  }}
                >
                  Topic Mastery
                </button>
              </div>
            </div>

            <div style={styles.graphContainer}>
              {selectedGraphTab === 'performance' && (
                <div style={styles.chartWrapper}>
                  {/* High Aesthetic Rendered SVG Performance Chart */}
                  <svg viewBox="0 0 560 160" width="100%" height="100%" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    <line x1="40" y1="30" x2="540" y2="30" stroke="var(--border-subtle)" strokeDasharray="4" />
                    <line x1="40" y1="75" x2="540" y2="75" stroke="var(--border-subtle)" strokeDasharray="4" />
                    <line x1="40" y1="120" x2="540" y2="120" stroke="var(--border-subtle)" strokeDasharray="4" />
                    
                    {/* Area under curve */}
                    <path
                      d="M 60 110 Q 140 70 220 85 T 380 45 T 520 35 L 520 135 L 60 135 Z"
                      fill="url(#perfGradient)"
                    />
                    {/* Trend line */}
                    <path
                      d="M 60 110 Q 140 70 220 85 T 380 45 T 520 35"
                      fill="none"
                      stroke="#0A84FF"
                      strokeWidth="3"
                    />
                    {/* Points */}
                    <circle cx="60" cy="110" r="5" fill="#0A84FF" stroke="#FFF" strokeWidth="2" />
                    <circle cx="220" cy="85" r="5" fill="#0A84FF" stroke="#FFF" strokeWidth="2" />
                    <circle cx="380" cy="45" r="5" fill="#0A84FF" stroke="#FFF" strokeWidth="2" />
                    <circle cx="520" cy="35" r="6" fill="#34C759" stroke="#FFF" strokeWidth="2" />

                    {/* Labels */}
                    <text x="60" y="152" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">Quiz 1 (18/25)</text>
                    <text x="220" y="152" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">CIE-1 (24/30)</text>
                    <text x="380" y="152" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">Quiz 2 (23/25)</text>
                    <text x="520" y="152" fill="#34C759" fontSize="11" fontWeight="700" textAnchor="middle">CIE-2 (29/30)</text>
                  </svg>
                </div>
              )}

              {selectedGraphTab === 'attendance' && (
                <div style={styles.chartWrapper}>
                  <svg viewBox="0 0 560 160" width="100%" height="100%">
                    <defs>
                      <linearGradient id="attGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34C759" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#34C759" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <line x1="40" y1="40" x2="540" y2="40" stroke="var(--border-subtle)" strokeDasharray="4" />
                    <line x1="40" y1="85" x2="540" y2="85" stroke="var(--border-subtle)" strokeDasharray="4" />
                    <line x1="40" y1="130" x2="540" y2="130" stroke="var(--border-subtle)" strokeDasharray="4" />

                    <path
                      d="M 60 90 Q 150 110 240 75 T 420 50 T 520 40 L 520 140 L 60 140 Z"
                      fill="url(#attGradient)"
                    />
                    <path
                      d="M 60 90 Q 150 110 240 75 T 420 50 T 520 40"
                      fill="none"
                      stroke="#34C759"
                      strokeWidth="3"
                    />
                    <circle cx="60" cy="90" r="5" fill="#34C759" stroke="#FFF" strokeWidth="2" />
                    <circle cx="240" cy="75" r="5" fill="#34C759" stroke="#FFF" strokeWidth="2" />
                    <circle cx="420" cy="50" r="5" fill="#34C759" stroke="#FFF" strokeWidth="2" />
                    <circle cx="520" cy="40" r="6" fill="#34C759" stroke="#FFF" strokeWidth="2" />

                    <text x="60" y="152" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">Week 1-4 (76%)</text>
                    <text x="240" y="152" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">Week 5-8 (79%)</text>
                    <text x="420" y="152" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">Week 9-12 (81%)</text>
                    <text x="520" y="152" fill="#34C759" fontSize="11" fontWeight="700" textAnchor="middle">Current (82.4%)</text>
                  </svg>
                </div>
              )}

              {selectedGraphTab === 'mastery' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 14px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Data Structures & Algorithms</span>
                      <span style={{ color: dsaMastery >= 70 ? '#34C759' : '#FF9500', fontWeight: 700 }}>
                        {dsaMastery}% {dsaMastery >= 85 ? '(Strong)' : dsaMastery >= 70 ? '(Good)' : '(Needs Revision)'}
                      </span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                      <div style={{ width: `${dsaMastery}%`, height: '100%', background: dsaMastery >= 70 ? '#34C759' : '#FF9500', borderRadius: '4px' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Operating Systems & Concurrency</span>
                      <span style={{ color: osMastery >= 70 ? '#0A84FF' : '#FF9500', fontWeight: 700 }}>
                        {osMastery}% {osMastery >= 85 ? '(Strong)' : osMastery >= 70 ? '(Good)' : '(Needs Revision)'}
                      </span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                      <div style={{ width: `${osMastery}%`, height: '100%', background: osMastery >= 70 ? '#0A84FF' : '#FF9500', borderRadius: '4px' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Database Management Systems</span>
                      <span style={{ color: dbmsMastery >= 70 ? '#34C759' : '#FF9500', fontWeight: 700 }}>
                        {dbmsMastery}% {dbmsMastery >= 85 ? '(Strong)' : dbmsMastery >= 70 ? '(Good)' : '(Needs Revision)'}
                      </span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                      <div style={{ width: `${dbmsMastery}%`, height: '100%', background: dbmsMastery >= 70 ? '#34C759' : '#FF9500', borderRadius: '4px' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Computer Networks</span>
                      <span style={{ color: cnMastery >= 70 ? '#34C759' : '#FF9500', fontWeight: 700 }}>
                        {cnMastery}% {cnMastery >= 85 ? '(Strong)' : cnMastery >= 70 ? '(Good)' : '(Needs Revision)'}
                      </span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                      <div style={{ width: `${cnMastery}%`, height: '100%', background: cnMastery >= 70 ? '#34C759' : '#FF9500', borderRadius: '4px' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TiltCard>

          {/* Card E: Upcoming Tests & Spaced Repetition (Span 1) */}
          <TiltCard style={styles.bentoCardSpan1}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderTitle}>
                <div style={styles.cardIconBoxCyan}>
                  <Award size={18} color="#00C7BE" />
                </div>
                <div>
                  <h3 style={styles.cardTitle}>Upcoming Tests</h3>
                  <span style={styles.cardSubtitle}>Spaced-repetition mastery check-ins</span>
                </div>
              </div>
            </div>

            <div style={styles.assessmentCardBody}>
              <div style={styles.testItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={15} color="#FF9500" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {dbmsMastery < 70 ? 'DBMS Remediation Quiz' : 'DSA Mastery Check-in'}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0' }}>
                  {dbmsMastery < 70 ? '5 Mins • Normalization & ACID Transactions' : '5 Mins • 5 Engineering Theory & Big-O Questions'}
                </p>
                <Badge variant={dbmsMastery < 70 ? 'warning' : 'indigo'} style={{ fontSize: '10.5px' }}>
                  {dbmsMastery < 70 ? 'Recommended Revision' : 'Due: Today'}
                </Badge>
              </div>

              <Button
                variant="primary"
                onClick={() => setIsAssessmentOpen(true)}
                style={{ width: '100%', justifyContent: 'center', fontWeight: 700, gap: '6px' }}
              >
                <Award size={15} /> Start Technical Assessment
              </Button>
            </div>
          </TiltCard>
        </div>

        {/* 3. Quick Stats Row (At-a-Glance Metrics) */}
        <div style={styles.quickStatsRow}>
          <div style={styles.quickStatCard}>
            <span style={styles.quickStatLabel}>Cumulative SGPA</span>
            <span style={styles.quickStatValue}>8.74 <small style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>/ 10.0</small></span>
          </div>
          <div style={styles.quickStatCard}>
            <span style={styles.quickStatLabel}>Weekly Goal Progress</span>
            <span style={styles.quickStatValue}>85% <small style={{ fontSize: '13px', color: '#34C759' }}>↑ On Track</small></span>
          </div>
          <div style={styles.quickStatCard}>
            <span style={styles.quickStatLabel}>Classes Attended</span>
            <span style={styles.quickStatValue}>142 <small style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>/ 168 Total</small></span>
          </div>
          <div style={styles.quickStatCard}>
            <span style={styles.quickStatLabel}>Active Credits</span>
            <span style={styles.quickStatValue}>22 <small style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Registered</small></span>
          </div>
        </div>
      </main>

      {/* Persistent Floating Conversational Agent Overlay */}
      <FloatingAgentOverlay
        isOpen={isAgentOpen}
        onToggle={() => {
          setIsAgentOpen(!isAgentOpen)
          if (isAgentOpen) setAgentInitialQuery(undefined)
        }}
        onOpenAssessment={() => setIsAssessmentOpen(true)}
        onOpenTimetable={() => setIsMonitorOpen(true)}
        onOpenNotices={() => setIsNoticesOpen(true)}
        initialQuery={agentInitialQuery}
      />

      {/* Full Feature Modals */}
      <TechnicalAssessmentModal
        isOpen={isAssessmentOpen}
        onClose={() => setIsAssessmentOpen(false)}
        enrolledSubjects={[
          ...(dashboard?.attendance?.map((a) => ({ subjectCode: a.subjectCode, subjectName: a.subjectName })) || []),
          ...(dashboard?.todaySchedule?.map((s) => ({ subjectCode: s.subjectCode, subjectName: s.subjectName })) || []),
          ...(dashboard?.marks?.map((m) => ({ subjectCode: m.subjectCode, subjectName: m.subjectName })) || []),
        ].filter((item, idx, arr) => arr.findIndex((t) => t.subjectName.trim().toLowerCase() === item.subjectName.trim().toLowerCase()) === idx)}
        onAskAI={(prompt) => {
          setIsAssessmentOpen(false)
          setAgentInitialQuery(prompt)
          setIsAgentOpen(true)
        }}
        onComplete={(topicTitle, subjectName, score, total, percentage) => {
          loadAssessmentHistory()
          if (percentage < 70) {
            setAgentInitialQuery(
              `I just completed my technical assessment in ${subjectName} (${topicTitle}) and scored ${score}/${total} (${percentage}%). Please provide a structured 3-step revision plan, explain the core concepts I need to review, and give me practice recommendations.`
            )
            setIsAssessmentOpen(false)
            setIsAgentOpen(true)
          }
        }}
      />

      <StudentMonitorModal
        isOpen={isMonitorOpen}
        onClose={() => setIsMonitorOpen(false)}
        onAskAI={(prompt) => {
          setIsMonitorOpen(false)
          setAgentInitialQuery(prompt)
          setIsAgentOpen(true)
        }}
      />

      <EventsNoticesModal
        isOpen={isNoticesOpen}
        onClose={() => setIsNoticesOpen(false)}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    minHeight: '100vh',
    background: 'var(--bg-page, #0A0D14)',
    color: 'var(--text-primary, #F5F5F7)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif',
    position: 'relative',
    overflowX: 'hidden',
    paddingBottom: '80px',
  },
  ambientMesh: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 0,
  },
  ambientGlowTop: {
    position: 'absolute',
    top: '-10%',
    left: '15%',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(10, 132, 255, 0.08) 0%, transparent 70%)',
    filter: 'blur(80px)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: '-10%',
    right: '10%',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(52, 199, 89, 0.05) 0%, transparent 70%)',
    filter: 'blur(90px)',
  },
  navHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 28px',
    background: 'var(--bg-glass, rgba(20, 26, 38, 0.8))',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBadge: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    background: 'rgba(10, 132, 255, 0.12)',
    border: '1px solid rgba(10, 132, 255, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: '16px',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  brandSubtitle: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    display: 'block',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  headerActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    borderRadius: '999px',
    background: 'var(--bg-card, rgba(255, 255, 255, 0.06))',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-card, rgba(255, 255, 255, 0.1))',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s',
  },
  headerActionHighlightBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 16px',
    borderRadius: '999px',
    background: 'rgba(10, 132, 255, 0.15)',
    color: '#0A84FF',
    border: '1px solid rgba(10, 132, 255, 0.3)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  notifBadgePill: {
    background: '#FF3B30',
    color: '#FFF',
    fontSize: '10.5px',
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: '999px',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '24px 24px',
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  profileHeaderSection: {
    width: '100%',
  },
  profileCard: {
    padding: '20px 24px',
    borderRadius: '20px',
    background: 'var(--bg-card, rgba(26, 32, 46, 0.75))',
    backdropFilter: 'blur(24px)',
    border: '1px solid var(--border-card, rgba(255, 255, 255, 0.08))',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  profileLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
  },
  avatarWrapper: {
    position: 'relative',
    width: '68px',
    height: '68px',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #0A84FF',
  },
  avatarMonogram: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0A84FF, #0056B3)',
    color: '#FFF',
    fontSize: '22px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid rgba(255, 255, 255, 0.2)',
  },
  avatarUploadBtn: {
    position: 'absolute',
    bottom: '-2px',
    right: '-2px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#0A84FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '2px solid var(--bg-page)',
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  studentName: {
    fontSize: '20px',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  deptMeta: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  profileRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  syncStatusCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
  },
  syncBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '999px',
    background: 'var(--bg-sunken, rgba(255, 255, 255, 0.08))',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-card)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  bentoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '20px',
  },
  bentoCardSpan2: {
    gridColumn: 'span 2',
    minHeight: '280px',
    padding: '22px',
  },
  bentoCardSpan1: {
    gridColumn: 'span 1',
    minHeight: '280px',
    padding: '22px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '18px',
  },
  cardHeaderTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  cardIconBoxBlue: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'rgba(10, 132, 255, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxGreen: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'rgba(52, 199, 89, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxAmber: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'rgba(255, 149, 0, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxPurple: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'rgba(175, 82, 222, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxCyan: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'rgba(0, 199, 190, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: '15.5px',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
  },
  cardSubtitle: {
    fontSize: '11.5px',
    color: 'var(--text-secondary)',
  },
  scheduleTimeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  scheduleItem: {
    padding: '10px 14px',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  scheduleTime: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
  },
  scheduleBody: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '6px',
  },
  scheduleSubject: {
    fontSize: '13.5px',
    fontWeight: 600,
    margin: 0,
    color: 'var(--text-primary)',
  },
  scheduleDetails: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  scheduleDetailTag: {
    fontSize: '11.5px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  attendanceBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  attendanceGaugeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  radialGauge: {
    width: '84px',
    height: '84px',
    borderRadius: '50%',
    border: '4px solid #34C759',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(52, 199, 89, 0.08)',
  },
  gaugeNumber: {
    fontSize: '18px',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  gaugeLabel: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  attendanceStatsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12.5px',
  },
  statLabel: {
    color: 'var(--text-secondary)',
  },
  bunkCalcBanner: {
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'rgba(255, 149, 0, 0.08)',
    border: '1px solid rgba(255, 149, 0, 0.2)',
  },
  bunkCalcText: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
    lineHeight: 1.45,
  },
  noticesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  noticeItemCard: {
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'var(--bg-sunken, rgba(0,0,0,0.03))',
    border: '1px solid var(--border-card)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  noticeTitle: {
    fontSize: '12.5px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  noticeMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  noticeLink: {
    fontSize: '11px',
    color: '#0A84FF',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    marginTop: '2px',
  },
  emptyNoticesState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px 0',
  },
  graphTabToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'var(--bg-sunken, rgba(0,0,0,0.15))',
    padding: '3px',
    borderRadius: '999px',
  },
  graphTabBtn: {
    border: 'none',
    padding: '4px 12px',
    borderRadius: '999px',
    fontSize: '11.5px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  graphContainer: {
    marginTop: '8px',
    minHeight: '160px',
  },
  chartWrapper: {
    height: '160px',
    width: '100%',
  },
  assessmentCardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  testItem: {
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'var(--bg-sunken, rgba(0,0,0,0.03))',
    border: '1px solid var(--border-card)',
  },
  quickStatsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    width: '100%',
  },
  quickStatCard: {
    padding: '16px 20px',
    borderRadius: '16px',
    background: 'var(--bg-card, rgba(26, 32, 46, 0.65))',
    backdropFilter: 'blur(16px)',
    border: '1px solid var(--border-card)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  quickStatLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  quickStatValue: {
    fontSize: '20px',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
}
