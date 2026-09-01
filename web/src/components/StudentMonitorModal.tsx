import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  getStudentDashboard,
  syncSamvidha,
  StudentDashboard,
  AttendanceItem,
  TimetableItem,
  MarksItem,
  LabSubmissionItem,
} from '@/services/api'
import { Modal } from './ui/Modal'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { SegmentedControl } from './ui/SegmentedControl'
import { TextField } from './ui/TextField'
import { springs } from '@/tokens'
import {
  GraduationCap,
  RefreshCw,
  Clock,
  FlaskConical,
  Award,
  BookOpen,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface StudentMonitorModalProps {
  isOpen: boolean
  onClose: () => void
  onAskAI: (prompt: string) => void
}

export const StudentMonitorModal: React.FC<StudentMonitorModalProps> = ({
  isOpen,
  onClose,
  onAskAI,
}) => {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null)
  const [, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'timetable' | 'labs' | 'marks' | 'sync'>('overview')
  const [rollInput, setRollInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadDashboard()
    }
  }, [isOpen])

  const loadDashboard = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await getStudentDashboard()
      setDashboard(data)
      if (data.rollNo) setRollInput(data.rollNo)
    } catch (err: any) {
      setErrorMsg('Could not load student dashboard. Please sync your Samvidha account.')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rollInput.trim() || !passwordInput.trim()) {
      setErrorMsg('Please enter both Roll Number and Password')
      return
    }
    setSyncing(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const data = await syncSamvidha(rollInput.trim(), passwordInput.trim())
      setDashboard(data)
      setSuccessMsg('Successfully synchronized academic telemetry with Samvidha!')
      setPasswordInput('')
      setActiveTab('overview')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to sync with Samvidha. Please check credentials.')
    } finally {
      setSyncing(false)
    }
  }

  const overall = dashboard?.overallAttendance ?? 0
  const isGood = overall >= 75
  const isWarning = overall >= 65 && overall < 75

  // Subject attendance list with fallback demo data if empty
  const attendanceList: AttendanceItem[] =
    dashboard?.attendance && dashboard.attendance.length > 0
      ? dashboard.attendance
      : [
          { subjectCode: 'CS401', subjectName: 'Data Structures & Algorithms', attendedClasses: 22, totalClasses: 25, percentage: 88, status: 'GOOD' },
          { subjectCode: 'CS402', subjectName: 'Operating Systems', attendedClasses: 19, totalClasses: 25, percentage: 76, status: 'GOOD' },
          { subjectCode: 'CS403', subjectName: 'Database Management Systems', attendedClasses: 17, totalClasses: 25, percentage: 68, status: 'WARNING' },
          { subjectCode: 'CS404', subjectName: 'Computer Networks', attendedClasses: 21, totalClasses: 25, percentage: 84, status: 'GOOD' },
        ]

  // Timetable list with fallback demo data if empty
  const timetableList: TimetableItem[] =
    dashboard?.todaySchedule && dashboard.todaySchedule.length > 0
      ? dashboard.todaySchedule
      : [
          { dayOfWeek: 1, timeSlotStart: '09:00 AM', timeSlotEnd: '09:50 AM', subjectName: 'Data Structures & Algorithms', room: 'BH-204', facultyName: 'Dr. Srinivas' },
          { dayOfWeek: 1, timeSlotStart: '09:50 AM', timeSlotEnd: '10:40 AM', subjectName: 'Operating Systems', room: 'BH-204', facultyName: 'Prof. Anitha' },
          { dayOfWeek: 1, timeSlotStart: '11:00 AM', timeSlotEnd: '12:40 PM', subjectName: 'Database Management Lab', room: 'IT-Lab 3', facultyName: 'Lab Staff' },
          { dayOfWeek: 1, timeSlotStart: '01:30 PM', timeSlotEnd: '02:20 PM', subjectName: 'Computer Networks', room: 'BH-204', facultyName: 'Dr. Ramesh' },
        ]

  // Lab submissions list
  const labList: LabSubmissionItem[] =
    dashboard?.labSubmissions && dashboard.labSubmissions.length > 0
      ? dashboard.labSubmissions
      : [
          { subjectCode: 'CS403L', subjectName: 'DBMS Lab', experimentName: 'Exp 6: PL/SQL Triggers and Cursors', dueDate: 'Tomorrow 5:00 PM', status: 'PENDING' },
          { subjectCode: 'CS402L', subjectName: 'Operating Systems Lab', experimentName: 'Exp 5: Banker\'s Deadlock Avoidance Algorithm', dueDate: 'Friday 4:00 PM', status: 'PENDING' },
          { subjectCode: 'CS404L', subjectName: 'Networks Lab', experimentName: 'Exp 4: Socket Programming with TCP Client-Server', dueDate: 'Completed', status: 'SUBMITTED' },
        ]

  // Marks list
  const marksList: MarksItem[] =
    dashboard?.marks && dashboard.marks.length > 0
      ? dashboard.marks
      : [
          { subjectCode: 'CS401', subjectName: 'Data Structures & Algorithms', cie1: 28, cie2: 29, internalTotal: 30 },
          { subjectCode: 'CS402', subjectName: 'Operating Systems', cie1: 25, cie2: 27, internalTotal: 30 },
          { subjectCode: 'CS403', subjectName: 'Database Management Systems', cie1: 22, cie2: 26, internalTotal: 30 },
          { subjectCode: 'CS404', subjectName: 'Computer Networks', cie1: 27, cie2: 28, internalTotal: 30 },
        ]

  const nextClass = timetableList[0]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={dashboard?.fullName || 'Academic Telemetry Hub'}
      subtitle={dashboard?.rollNo ? `${dashboard.rollNo} • Live Samvidha Telemetry` : 'Official Academic Telemetry'}
      icon={
        dashboard?.profilePhotoUrl ? (
          <img
            src={dashboard.profilePhotoUrl}
            alt={dashboard.fullName}
            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <GraduationCap size={18} />
        )
      }
      maxWidth="780px"
      headerActions={
        <Button
          variant="secondary"
          size="sm"
          onClick={loadDashboard}
          icon={<RefreshCw size={13} className={syncing ? 'spin-icon' : ''} />}
        >
          Refresh
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Student Profile Header Bar */}
        {dashboard?.profilePhotoUrl && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--surface-glass)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <img
              src={dashboard.profilePhotoUrl}
              alt={dashboard.fullName}
              style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-color)' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {dashboard.fullName}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {dashboard.rollNo} • {dashboard.department} (Semester {dashboard.semester || 5})
              </div>
            </div>
            <Badge variant="success" size="sm" icon={<CheckCircle2 size={12} />}>
              Live Telemetry
            </Badge>
          </div>
        )}

        {/* iOS-Style Segmented Navigation */}
        <SegmentedControl
          options={[
            { value: 'overview', label: 'Overview', icon: <Sparkles size={13} /> },
            { value: 'timetable', label: 'Timetable', icon: <Clock size={13} /> },
            { value: 'labs', label: 'Labs & Deadlines', icon: <FlaskConical size={13} /> },
            { value: 'marks', label: 'Internal Marks', icon: <Award size={13} /> },
          ]}
          value={activeTab === 'sync' ? 'overview' : activeTab}
          onChange={(val) => setActiveTab(val as any)}
          size="sm"
        />

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Top Widgets Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {/* Overall Attendance Card */}
              <Card variant="glass" style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Total Attendance
                  </span>
                  <Badge variant={isGood ? 'success' : isWarning ? 'warning' : 'error'} size="sm">
                    {isGood ? 'Safe' : isWarning ? 'Condone Zone' : 'Critical'}
                  </Badge>
                </div>
                <div style={{ margin: '12px 0 6px' }}>
                  <span style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.03em', color: isGood ? '#34C759' : isWarning ? '#FF9500' : '#FF3B30' }}>
                    {overall.toFixed(1)}%
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onAskAI('Can I bunk any classes this week without dropping below 75% attendance?')
                    onClose()
                  }}
                  style={{ padding: '0', justifyContent: 'flex-start', fontSize: '0.78125rem', color: 'var(--accent-color)' }}
                >
                  Calculate safe bunks &rarr;
                </Button>
              </Card>

              {/* Semester & Branch Card */}
              <Card variant="glass" style={{ padding: '18px' }}>
                <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Academic Track
                </span>
                <div style={{ margin: '8px 0' }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {dashboard?.department || 'Computer Science and Engineering'}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Semester {dashboard?.semester || 4} • Section {dashboard?.section || 'A'}
                  </div>
                </div>
                <Badge variant="indigo" size="sm">
                  Autonomous Curriculum 2026
                </Badge>
              </Card>

              {/* Today's Next Class Card */}
              <Card variant="glass" style={{ padding: '18px' }}>
                <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Next Class
                </span>
                <div style={{ margin: '8px 0' }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {nextClass?.subjectName || 'No class right now'}
                  </div>
                  <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                    {nextClass ? `${nextClass.timeSlotStart} • Room ${nextClass.room}` : 'Free period'}
                  </div>
                </div>
                {nextClass && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onAskAI(`Where is Room ${nextClass.room} and how do I get there?`)
                      onClose()
                    }}
                    style={{ padding: '0', justifyContent: 'flex-start', fontSize: '0.78125rem', color: 'var(--accent-color)' }}
                  >
                    Directions to room &rarr;
                  </Button>
                )}
              </Card>
            </div>

            {/* Subject Attendance Breakdown */}
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Subject Attendance Telemetry
              </h4>

              <div className="settings-group">
                {attendanceList.map((sub: AttendanceItem, i: number) => {
                  const safe = sub.percentage >= 75
                  return (
                    <div key={i} className="settings-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: 'var(--radius-sm)',
                            background: safe ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 149, 0, 0.12)',
                            color: safe ? '#34C759' : '#FF9500',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          <BookOpen size={14} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {sub.subjectName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {sub.attendedClasses}/{sub.totalClasses} classes attended
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: safe ? 'var(--text-primary)' : '#FF9500' }}>
                          {sub.percentage}%
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onAskAI(`Explain key concepts and practice questions for ${sub.subjectName}`)
                            onClose()
                          }}
                          title="Ask AI about this subject"
                        >
                          <Sparkles size={14} color="var(--accent-color)" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Timetable */}
        {activeTab === 'timetable' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's Schedule & Room Map
            </h4>

            {timetableList.map((cls: TimetableItem, idx: number) => (
              <Card key={idx} interactive style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                      }}
                    >
                      <span>P{idx + 1}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.90625rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {cls.subjectName}
                      </div>
                      <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                        {cls.timeSlotStart} - {cls.timeSlotEnd} • Room {cls.room} {cls.facultyName ? `• ${cls.facultyName}` : ''}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onAskAI(`Give me directions from Main Gate to Room ${cls.room}`)
                      onClose()
                    }}
                    iconRight={<ChevronRight size={13} />}
                  >
                    Nav
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Tab 3: Labs & Deadlines */}
        {activeTab === 'labs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Lab Experiments & Record Deadlines
            </h4>

            {labList.map((lab: LabSubmissionItem, i: number) => (
              <Card key={i} style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.90625rem', color: 'var(--text-primary)' }}>
                        {lab.subjectName}
                      </span>
                      <Badge variant={lab.status === 'SUBMITTED' ? 'success' : 'warning'} size="sm">
                        {lab.status}
                      </Badge>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                      {lab.experimentName}
                    </p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Due: {lab.dueDate}
                    </div>
                  </div>

                  <Button
                    variant="accent-subtle"
                    size="sm"
                    onClick={() => {
                      onAskAI(`Help me solve and write the code for ${lab.experimentName} in ${lab.subjectName}`)
                      onClose()
                    }}
                    icon={<Sparkles size={13} />}
                  >
                    Lab AI Guide
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Tab 4: Internal Marks */}
        {activeTab === 'marks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Continuous Internal Evaluation (CIE)
            </h4>

            <div className="settings-group">
              {marksList.map((mark: MarksItem, i: number) => (
                <div key={i} className="settings-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {mark.subjectName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      CIE-1: {mark.cie1 ?? 0}/30 • CIE-2: {mark.cie2 ?? 0}/30
                    </div>
                  </div>

                  <Badge variant="primary" size="md">
                    Avg: {(((mark.cie1 ?? 0) + (mark.cie2 ?? 0)) / 2).toFixed(1)} / {mark.internalTotal ?? 30}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
