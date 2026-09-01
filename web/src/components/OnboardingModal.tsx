import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  saveOnboarding,
  getOnboarding,
  type OnboardingRequest,
  getCurrentUser,
} from '@/services/api'
import { Modal } from './ui/Modal'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { TextField } from './ui/TextField'
import { springs } from '@/tokens'
import {
  Sliders,
  GraduationCap,
  Target,
  BellRing,
  ShieldCheck,
  Plus,
  X,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onCompleted?: () => void
  isEditable?: boolean
}

export function OnboardingModal({
  isOpen,
  onClose,
  onCompleted,
  isEditable = false,
}: OnboardingModalProps) {
  const user = getCurrentUser()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Step 1: Academic
  const [semester, setSemester] = useState<number>(4)
  const [branch, setBranch] = useState('Computer Science and Engineering (CSE)')
  const [section, setSection] = useState('A')
  const [enrolledCourseInput, setEnrolledCourseInput] = useState('')
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([
    'Data Structures & Algorithms',
    'Database Management Systems',
    'Operating Systems',
    'Discrete Mathematics',
  ])
  const [difficultSubjectInput, setDifficultSubjectInput] = useState('')
  const [difficultSubjects, setDifficultSubjects] = useState<string[]>([])

  // Step 2: Goals & Interests
  const [collegeGoals, setCollegeGoals] = useState('Crack Tier-1 Product Placement')
  const [technicalInterests, setTechnicalInterests] = useState('AI/ML, Fullstack Web Development')
  const [clubsActivities, setClubsActivities] = useState('Coding Club, Tech Hackathons')

  // Step 3: Logistics & Engagement
  const [preferredNotificationTimes, setPreferredNotificationTimes] = useState('Morning 8:00 AM & Evening 6:00 PM')
  const [monitoredTelegramGroups, setMonitoredTelegramGroups] = useState('IARE CSE 2026 Official, Placement Hub')
  const [checkInFrequency, setCheckInFrequency] = useState('DAILY_BRIEF')
  const [moodCheckInsAllowed, setMoodCheckInsAllowed] = useState(true)

  // Step 4: Samvidha Connection
  const [connectSamvidha, setConnectSamvidha] = useState(false)
  const [samvidhaRollNo, setSamvidhaRollNo] = useState('')
  const [samvidhaPassword, setSamvidhaPassword] = useState('')

  useEffect(() => {
    if (isOpen) {
      setError('')
      setSuccessMessage('')
      getOnboarding()
        .then((data) => {
          if (data && data.completed) {
            if (data.semester) setSemester(data.semester)
            if (data.branch) setBranch(data.branch)
            if (data.section) setSection(data.section)
            if (data.enrolledCourses?.length) setEnrolledCourses(data.enrolledCourses)
            if (data.difficultSubjects?.length) setDifficultSubjects(data.difficultSubjects)
            if (data.collegeGoals) setCollegeGoals(data.collegeGoals)
            if (data.technicalInterests) setTechnicalInterests(data.technicalInterests)
            if (data.clubsActivities) setClubsActivities(data.clubsActivities)
            if (data.preferredNotificationTimes) setPreferredNotificationTimes(data.preferredNotificationTimes)
            if (data.monitoredTelegramGroups) setMonitoredTelegramGroups(data.monitoredTelegramGroups)
            if (data.checkInFrequency) setCheckInFrequency(data.checkInFrequency)
            if (data.moodCheckInsAllowed !== undefined) setMoodCheckInsAllowed(data.moodCheckInsAllowed)
            if (data.samvidhaConnected !== undefined) setConnectSamvidha(data.samvidhaConnected)
          } else {
            const userRoll = user.email.includes('@')
              ? user.email.substring(0, user.email.indexOf('@')).toUpperCase()
              : user.email
            if (userRoll && userRoll.length >= 6) {
              setSamvidhaRollNo(userRoll)
            }
          }
        })
        .catch(() => {})
    }
  }, [isOpen])

  const handleAddCourse = () => {
    const val = enrolledCourseInput.trim()
    if (val && !enrolledCourses.includes(val)) {
      setEnrolledCourses((prev) => [...prev, val])
      setEnrolledCourseInput('')
    }
  }

  const handleRemoveCourse = (c: string) => {
    setEnrolledCourses((prev) => prev.filter((item) => item !== c))
  }

  const handleAddDifficultSubject = () => {
    const val = difficultSubjectInput.trim()
    if (val && !difficultSubjects.includes(val)) {
      setDifficultSubjects((prev) => [...prev, val])
      setDifficultSubjectInput('')
    }
  }

  const handleRemoveDifficultSubject = (s: string) => {
    setDifficultSubjects((prev) => prev.filter((item) => item !== s))
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    try {
      const payload: OnboardingRequest = {
        semester,
        branch,
        section,
        enrolledCourses,
        difficultSubjects,
        collegeGoals,
        technicalInterests,
        clubsActivities,
        preferredNotificationTimes,
        monitoredTelegramGroups,
        checkInFrequency,
        moodCheckInsAllowed,
        connectSamvidha,
        samvidhaRollNo: connectSamvidha ? samvidhaRollNo : undefined,
        samvidhaPassword: connectSamvidha ? samvidhaPassword : undefined,
      }

      await saveOnboarding(payload)
      setSuccessMessage('Student preferences updated successfully!')
      if (onCompleted) onCompleted()
      setTimeout(() => {
        onClose()
      }, 700)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save preferences. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stepTitles = [
    { title: 'Academic Profile', icon: <GraduationCap size={14} /> },
    { title: 'Goals & Focus', icon: <Target size={14} /> },
    { title: 'Notifications', icon: <BellRing size={14} /> },
    { title: 'Samvidha Link', icon: <ShieldCheck size={14} /> },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Companion Setup"
      subtitle="Apple Setup Assistant • Tailor your AI experience"
      icon={<Sliders size={18} />}
      maxWidth="680px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Stepper Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          {stepTitles.map((st, i) => {
            const stepNum = (i + 1) as 1 | 2 | 3 | 4
            const isCurrent = step === stepNum
            const isDone = step > stepNum
            return (
              <button
                key={i}
                onClick={() => setStep(stepNum)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: isCurrent ? 'var(--accent-subtle)' : 'var(--bg-card)',
                  border: `1px solid ${isCurrent ? 'var(--accent-border)' : 'var(--border-card)'}`,
                  color: isCurrent ? 'var(--accent-color)' : isDone ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '0.78125rem',
                  fontWeight: isCurrent ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ display: 'inline-flex' }}>{isDone ? <CheckCircle2 size={14} color="#34C759" /> : st.icon}</span>
                <span>{st.title}</span>
              </button>
            )
          })}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={springs.snappy}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <TextField
                  label="Branch / Department"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. CSE, IT, ECE"
                />

                <TextField
                  label="Semester (1-8)"
                  type="number"
                  min={1}
                  max={8}
                  value={semester}
                  onChange={(e) => setSemester(parseInt(e.target.value) || 1)}
                />
              </div>

              {/* Enrolled Courses Chips */}
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                  Enrolled Subjects & Courses
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add subject (e.g. Algorithms)"
                    value={enrolledCourseInput}
                    onChange={(e) => setEnrolledCourseInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCourse()
                      }
                    }}
                    style={{
                      flex: 1,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      padding: '8px 12px',
                      fontSize: '0.84375rem',
                      outline: 'none',
                    }}
                  />
                  <Button variant="secondary" size="sm" onClick={handleAddCourse} icon={<Plus size={13} />}>
                    Add
                  </Button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {enrolledCourses.map((course) => (
                    <Badge key={course} variant="neutral" size="md">
                      <span>{course}</span>
                      <button
                        onClick={() => handleRemoveCourse(course)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', marginLeft: '4px' }}
                      >
                        <X size={11} />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Challenging Subjects */}
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                  Subjects Needing AI Tutoring / Practice Focus
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add challenging topic (e.g. OS Deadlocks, Dynamic Programming)"
                    value={difficultSubjectInput}
                    onChange={(e) => setDifficultSubjectInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddDifficultSubject()
                      }
                    }}
                    style={{
                      flex: 1,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      padding: '8px 12px',
                      fontSize: '0.84375rem',
                      outline: 'none',
                    }}
                  />
                  <Button variant="secondary" size="sm" onClick={handleAddDifficultSubject} icon={<Plus size={13} />}>
                    Add
                  </Button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {difficultSubjects.map((sub) => (
                    <Badge key={sub} variant="warning" size="md">
                      <span>{sub}</span>
                      <button
                        onClick={() => handleRemoveDifficultSubject(sub)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', marginLeft: '4px' }}
                      >
                        <X size={11} />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={springs.snappy}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <TextField
                label="Primary Career Goal"
                value={collegeGoals}
                onChange={(e) => setCollegeGoals(e.target.value)}
                placeholder="e.g. Product Placement, Higher Studies, Competitive Coding"
              />

              <TextField
                label="Technical Interests & Stacks"
                value={technicalInterests}
                onChange={(e) => setTechnicalInterests(e.target.value)}
                placeholder="e.g. AI Agents, LLM Fine-tuning, Distributed Systems"
              />

              <TextField
                label="Clubs & Extracurriculars"
                value={clubsActivities}
                onChange={(e) => setClubsActivities(e.target.value)}
                placeholder="e.g. IARE Coding Club, IEEE Student Branch"
              />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={springs.snappy}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <TextField
                label="Preferred Daily Briefing Times"
                value={preferredNotificationTimes}
                onChange={(e) => setPreferredNotificationTimes(e.target.value)}
                placeholder="e.g. Morning 8:00 AM & Evening 6:00 PM"
              />

              <TextField
                label="Consented Telegram Group Channels"
                value={monitoredTelegramGroups}
                onChange={(e) => setMonitoredTelegramGroups(e.target.value)}
                hint="Privacy Consent Required"
                placeholder="e.g. IARE CSE Official 2026, Placement Notice Board"
              />

              <div className="settings-group">
                <div className="settings-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      Wellness & Academic Burnout Check-ins
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Gentle periodic prompts during exam weeks
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={moodCheckInsAllowed}
                    onChange={(e) => setMoodCheckInsAllowed(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={springs.snappy}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <Card variant="glass" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={20} color="var(--accent-color)" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.90625rem', color: 'var(--text-primary)' }}>
                        Automated Samvidha Telemetry Sync
                      </div>
                      <div style={{ fontSize: '0.78125rem', color: 'var(--text-secondary)' }}>
                        Live attendance percentage, daily timetable, and CIE internal marks
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={connectSamvidha}
                    onChange={(e) => setConnectSamvidha(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                  />
                </div>
              </Card>

              {connectSamvidha && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <TextField
                    label="Samvidha Roll Number"
                    value={samvidhaRollNo}
                    onChange={(e) => setSamvidhaRollNo(e.target.value)}
                    placeholder="e.g. 21951A0501"
                  />
                  <TextField
                    label="Samvidha Password"
                    type="password"
                    value={samvidhaPassword}
                    onChange={(e) => setSamvidhaPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div style={{ color: '#FF3B30', fontSize: '0.8125rem', fontWeight: 500 }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{ color: '#34C759', fontSize: '0.8125rem', fontWeight: 500 }}>
            {successMessage}
          </div>
        )}

        {/* Footer Navigation Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          {step > 1 ? (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setStep((prev) => (prev - 1) as any)}
              icon={<ArrowLeft size={14} />}
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setStep((prev) => (prev + 1) as any)}
              iconRight={<ArrowRight size={14} />}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              loading={loading}
              onClick={handleSave}
              icon={<Sparkles size={14} />}
            >
              Complete Setup
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
