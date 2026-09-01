import axios from 'axios'

const apiBase = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')}/api`
  : '/api'

const api = axios.create({
  baseURL: apiBase,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 & 403 — clear stale tokens and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user_email')
      localStorage.removeItem('user_name')
      localStorage.removeItem('user_role')
      localStorage.removeItem('onboarding_completed')
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  email: string
  fullName: string
  role: string
  rollNo?: string
  profilePhotoUrl?: string
  onboardingCompleted?: boolean
}

export async function register(
  fullName: string, email: string, password: string
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', { fullName, email, password })
  storeTokens(data)
  return data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
  storeTokens(data)
  return data
}

export async function refreshToken(): Promise<AuthResponse> {
  const refreshToken = localStorage.getItem('refresh_token')
  const { data } = await api.post<AuthResponse>('/auth/refresh', { refreshToken })
  storeTokens(data)
  return data
}

// ── Agent & Query ─────────────────────────────────────────────────────────────

export interface NavResult {
  success: boolean
  agent: string
  source_node?: string
  destination_node?: string
  route_stops?: string[]
  step_hints?: string[]
  total_distance_meters?: number
  message: string
  error?: string
  sessionId?: string
  sessionTitle?: string
  topic?: string
  subject?: string
  is_weakness_trigger?: boolean
  image_url?: string
  image_caption?: string
  imageUrl?: string
  imageCaption?: string
}

export async function sendQuery(message: string, mode = 'text', sessionId?: string): Promise<NavResult> {
  const { data } = await api.post<any>('/agent/query', { message, mode, sessionId })
  if (data && typeof data === 'object' && data.result && typeof data.result === 'object') {
    return {
      ...data.result,
      agent: data.result.agent || data.agent || 'assistant',
      message: data.result.message || '',
      sessionId: data.sessionId || data.result.sessionId,
      sessionTitle: data.sessionTitle || data.result.sessionTitle,
      topic: data.topic || data.result.topic,
      subject: data.subject || data.result.subject,
      is_weakness_trigger: data.is_weakness_trigger ?? data.result.is_weakness_trigger,
      imageUrl: data.image_url || data.result.image_url || data.imageUrl || data.result.imageUrl,
      imageCaption: data.image_caption || data.result.image_caption || data.imageCaption || data.result.imageCaption,
    }
  }
  if (data && typeof data === 'object') {
    return {
      ...data,
      imageUrl: data.image_url || data.imageUrl,
      imageCaption: data.image_caption || data.imageCaption,
    }
  }
  return data
}

// ── Onboarding Survey ─────────────────────────────────────────────────────────

export interface OnboardingRequest {
  semester?: number
  branch?: string
  section?: string
  enrolledCourses?: string[]
  difficultSubjects?: string[]
  collegeGoals?: string
  technicalInterests?: string
  clubsActivities?: string
  preferredNotificationTimes?: string
  monitoredTelegramGroups?: string
  checkInFrequency?: string
  moodCheckInsAllowed?: boolean
  connectSamvidha?: boolean
  samvidhaRollNo?: string
  samvidhaPassword?: string
}

export interface OnboardingData {
  completed: boolean
  semester?: number
  branch?: string
  section?: string
  enrolledCourses?: string[]
  difficultSubjects?: string[]
  collegeGoals?: string
  technicalInterests?: string
  clubsActivities?: string
  preferredNotificationTimes?: string
  monitoredTelegramGroups?: string
  checkInFrequency?: string
  moodCheckInsAllowed?: boolean
  samvidhaConnected?: boolean
  samvidhaError?: string
  completedAt?: string
  updatedAt?: string
  studentDashboard?: StudentDashboard
}

export async function getOnboarding(): Promise<OnboardingData> {
  const { data } = await api.get<OnboardingData>('/student/onboarding')
  return data
}

export async function saveOnboarding(req: OnboardingRequest): Promise<OnboardingData> {
  const { data } = await api.post<OnboardingData>('/student/onboarding', req)
  if (data.completed) {
    localStorage.setItem('onboarding_completed', 'true')
  }
  return data
}

// ── Persistent Chat History & Sessions ────────────────────────────────────────

export interface ChatMessageItem {
  id: number
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  mode?: 'text' | 'voice'
  agentType?: string
  navResult?: any
  createdAt: string
}

export interface ChatSessionItem {
  id: string
  title: string
  summaryMemory?: string
  messageCount: number
  lastMessageSnippet?: string
  createdAt: string
  updatedAt: string
  messages?: ChatMessageItem[]
}

export interface ChatHistoryData {
  sessions: ChatSessionItem[]
  totalSessions: number
}

export async function getChatSessions(): Promise<ChatHistoryData> {
  const { data } = await api.get<ChatHistoryData>('/chat/sessions')
  return data
}

export async function getSessionMessages(sessionId: string): Promise<ChatSessionItem> {
  const { data } = await api.get<ChatSessionItem>(`/chat/sessions/${sessionId}`)
  return data
}

export async function createChatSession(title?: string): Promise<ChatSessionItem> {
  const { data } = await api.post<ChatSessionItem>('/chat/sessions', title ? { title } : {})
  return data
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await api.delete(`/chat/sessions/${sessionId}`)
}

// ── Voice session token ───────────────────────────────────────────────────────

export interface VoiceSessionToken {
  token: string
  expires_in: number
  note?: string
}

export async function getVoiceSessionToken(): Promise<VoiceSessionToken> {
  const { data } = await api.get<VoiceSessionToken>('/voice/session-token')
  return data
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await axios.get('/api/health', { timeout: 2500 })
    return res.status === 200 && res.data?.status === 'UP'
  } catch {
    return false
  }
}

export async function logVoiceSessionMode(mode: string, reason = 'none'): Promise<void> {
  try {
    await api.post('/voice/log-mode', { mode, reason })
  } catch {
    // Non-blocking telemetry
  }
}

// ── Student & Samvidha ────────────────────────────────────────────────────────

export interface AttendanceItem {
  subjectCode: string
  subjectName: string
  attendedClasses: number
  totalClasses: number
  percentage: number
  status: 'GOOD' | 'WARNING' | 'CRITICAL' | string
}

export interface TimetableItem {
  dayOfWeek: number
  timeSlotStart: string
  timeSlotEnd: string
  subjectCode?: string
  subjectName: string
  room: string
  facultyName?: string
  isCurrent?: boolean
  isNext?: boolean
}

export interface MarksItem {
  subjectCode: string
  subjectName: string
  cie1?: number
  cie2?: number
  internalTotal?: number
}

export interface LabSubmissionItem {
  subjectCode: string
  subjectName: string
  experimentName: string
  dueDate: string
  status: string
  marksObtained?: number
  maxMarks?: number
}

export interface NoticeItem {
  title: string
  noticeDate?: string
  category: string
  linkUrl?: string
  description?: string
}

export interface StudentDashboard {
  rollNo: string
  fullName: string
  dob?: string
  profilePhotoUrl?: string
  gender?: string
  bloodGroup?: string
  email?: string
  department: string
  yearOfStudy: number
  semester: number
  section: string
  overallAttendance: number
  attendanceStatus: 'GOOD' | 'WARNING' | 'CRITICAL' | string
  safeBunksAvailable: number
  classesNeededFor75: number
  lastSyncedAt: string
  attendance: AttendanceItem[]
  todaySchedule: TimetableItem[]
  weeklySchedule: TimetableItem[]
  marks: MarksItem[]
  labSubmissions?: LabSubmissionItem[]
  notices?: NoticeItem[]
}

export async function getStudentDashboard(rollNo?: string): Promise<StudentDashboard> {
  const { data } = await api.get<StudentDashboard>('/student/dashboard', {
    params: rollNo ? { rollNo } : undefined,
  })
  return data
}

export async function syncSamvidha(rollNo: string, password: string): Promise<StudentDashboard> {
  const { data } = await api.post<StudentDashboard>('/student/samvidha-sync', {
    rollNo,
    password,
    consent: true,
  })
  return data
}

// ── Telegram Event Intelligence ──────────────────────────────────────────────

export interface EventItem {
  id: number
  sourceTelegramGroupId?: number
  sourceTelegramMessageId?: number
  title: string
  description?: string
  rawText?: string
  hasImage: boolean
  imageUrl?: string
  eventDate: string
  eventTime?: string
  location?: string
  organizer?: string
  targetSemester?: number
  targetBranch?: string
  targetSection?: string
  targetAudienceRaw?: string
  mandatory: boolean
  registrationDeadline?: string
  actionUrl?: string
  createdAt: string
}

export interface StudentEventNotification {
  id: number
  eventId?: number
  eventTitle: string
  eventDate?: string
  eventLocation?: string
  actionUrl?: string
  mandatory: boolean
  notificationType: string
  title: string
  message: string
  read: boolean
  scheduledFor?: string
  sentAt: string
  createdAt: string
}

export interface EventsFeedResponse {
  events: EventItem[]
  totalCount: number
  mandatoryCount: number
  unreadNotifications: StudentEventNotification[]
}

export async function getEventsFeed(mandatoryOnly = false): Promise<EventsFeedResponse> {
  const { data } = await api.get<EventsFeedResponse>('/events', {
    params: mandatoryOnly ? { mandatoryOnly: true } : undefined,
  })
  return data
}

export async function getUnreadNotifications(): Promise<StudentEventNotification[]> {
  const { data } = await api.get<StudentEventNotification[]>('/events/notifications')
  return data
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.post(`/events/notifications/${id}/read`)
}

export async function simulateTelegramMessage(payload: {
  groupId: number
  text: string
  imageBase64?: string
  chatType?: string
}): Promise<any> {
  // Calls the ai-service simulation endpoint via direct or proxy
  const { data } = await axios.post('http://localhost:8001/internal/telegram/simulate-message', {
    group_id: payload.groupId,
    text: payload.text,
    image_base64: payload.imageBase64,
    chat_type: payload.chatType || 'supergroup',
  }, {
    headers: {
      'X-Internal-Secret': 'CHANGE-ME-INTERNAL-SECRET',
      'Content-Type': 'application/json',
    },
  })
  return data
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function storeTokens(auth: AuthResponse) {
  localStorage.setItem('access_token', auth.accessToken)
  localStorage.setItem('refresh_token', auth.refreshToken)
  localStorage.setItem('user_email', auth.email)
  localStorage.setItem('user_name', auth.fullName)
  localStorage.setItem('user_role', auth.role)
  if (auth.rollNo) {
    localStorage.setItem('user_roll', auth.rollNo)
  }
  if (auth.profilePhotoUrl) {
    localStorage.setItem('user_photo', auth.profilePhotoUrl)
  }
  if (auth.onboardingCompleted !== undefined) {
    localStorage.setItem('onboarding_completed', String(auth.onboardingCompleted))
  }
}

export function logout() {
  localStorage.clear()
  window.location.href = '/login'
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('access_token')
}

export function getCurrentUser() {
  return {
    email: localStorage.getItem('user_email') ?? '',
    name:  localStorage.getItem('user_name') ?? '',
    role:  localStorage.getItem('user_role') ?? '',
    rollNo: localStorage.getItem('user_roll') ?? '',
    photoUrl: localStorage.getItem('user_photo') ?? '',
    onboardingCompleted: localStorage.getItem('onboarding_completed') === 'true',
  }
}
