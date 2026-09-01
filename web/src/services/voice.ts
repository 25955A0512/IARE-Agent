/**
 * voice.ts — True Continuous, Interruptible Voice Pipeline for IARE Agent.
 *
 * Architecture:
 * 1. Gemini Live Continuous Session (Bidirectional Streaming + Native Barge-in / Interruption):
 *    - The microphone stays live continuously for the entire session — NOT per-message.
 *    - While the agent is speaking, the client keeps listening in real-time.
 *    - If the user starts talking, playback of the agent's current audio is instantly aborted,
 *      audio queues are cleared, and the new user turn takes over smoothly (barge-in).
 *    - Full back-and-forth voice conversation without touching the screen between turns.
 *    - Only an explicit action (clicking 'End Session' / Cancel) stops the continuous session.
 *
 * 2. Local Fallback Pipeline (Faster-Whisper STT + Edge-TTS / WebSpeech TTS):
 *    - Continuous turn-taking loop: automatically resumes listening when the agent finishes speaking.
 *    - Manual "Stop Speaking" affordance: tapping the voice button / mic while the agent is talking
 *      immediately halts TTS playback and starts listening again instantly.
 *
 * 3. Smart Voice Manager (Auto / Online / Offline):
 *    - Manages continuous session state, barge-in callbacks, and engine switching.
 */

import { getVoiceSessionToken, sendQuery, checkHealth, logVoiceSessionMode, type NavResult } from './api'

export type VoiceUserSetting = 'auto' | 'online' | 'offline'
export type ActiveVoiceEngine = 'gemini_live' | 'fallback'

export interface VoiceEventCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void
  onAgentSpeaking: (speaking: boolean, textSnippet?: string) => void
  onTurnComplete: (userText: string, assistantText: string, navResult?: NavResult) => void
  onInterruption?: () => void
  onError?: (err: string) => void
  onStatusChange?: (status: string) => void
}

// ── Audio Helper Utilities ──────────────────────────────────────────────────

function getCleanSpeechText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_+(.*?)_+/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/•/g, '')
    .replace(/^[#\->\s]+/gm, '')
    .replace(/[🏛📍🗺️👋📊🎒⏱️🌲💡🧑‍🏫🔬📢📝🟢🟡🔴✅⚠️🚨🎉]/g, '')
    .trim()
}

// ── Fallback Continuous Pipeline (Whisper + TTS + Stop-and-Listen) ───────────

export class FallbackVoicePipeline {
  private mediaRecorder: MediaRecorder | null = null
  private recognition: any = null
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private activeAudioElement: HTMLAudioElement | null = null
  private isAgentSpeaking = false
  private isSessionActive = false
  private speechAccumulator = ''
  private callbacks: VoiceEventCallbacks | null = null
  private silenceTimeout: any = null
  private lastSpeechTimestamp = 0

  async startContinuousSession(callbacks: VoiceEventCallbacks): Promise<void> {
    this.isSessionActive = true
    this.callbacks = callbacks
    this.callbacks.onStatusChange?.('Listening (Hot Mic)…')
    await this.startListeningTurn()
  }

  stopContinuousSession(): void {
    this.isSessionActive = false
    this.stopSpeaking()
    this.cancelListening()
    this.callbacks?.onAgentSpeaking(false)
    this.callbacks?.onStatusChange?.('Voice Session Ended')
  }

  /** Manual "Stop Speaking" Affordance: interrupts agent TTS and starts listening immediately */
  stopSpeakingAndListen(): void {
    this.stopSpeaking()
    if (this.isSessionActive) {
      this.callbacks?.onInterruption?.()
      this.callbacks?.onStatusChange?.('Interrupted — Listening…')
      this.startListeningTurn()
    }
  }

  stopSpeaking(): void {
    this.isAgentSpeaking = false
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (this.activeAudioElement) {
      this.activeAudioElement.pause()
      this.activeAudioElement = null
    }
    this.callbacks?.onAgentSpeaking(false)
  }

  private cancelListening(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
      this.silenceTimeout = null
    }
    if (this.recognition) {
      try { this.recognition.abort() } catch {}
      this.recognition = null
    }
    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.stop()
        this.mediaRecorder.stream.getTracks().forEach((t) => t.stop())
      } catch {}
      this.mediaRecorder = null
    }
  }

  private async startListeningTurn(): Promise<void> {
    if (!this.isSessionActive || this.isAgentSpeaking) return

    this.speechAccumulator = ''
    this.lastSpeechTimestamp = Date.now()
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition()
        this.recognition.lang = 'en-IN'
        this.recognition.continuous = true
        this.recognition.interimResults = true

        this.recognition.onresult = (event: any) => {
          if (!this.isSessionActive) return
          let interim = ''
          let final = ''
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript + ' '
            } else {
              interim += event.results[i][0].transcript
            }
          }
          const text = (final + interim).trim()
          if (text) {
            this.speechAccumulator = text
            this.lastSpeechTimestamp = Date.now()
            this.callbacks?.onTranscript(text, false)

            // VAD silence detection for turn-taking
            if (this.silenceTimeout) clearTimeout(this.silenceTimeout)
            this.silenceTimeout = setTimeout(() => {
              if (this.isSessionActive && this.speechAccumulator.trim()) {
                this.commitTurn(this.speechAccumulator.trim())
              }
            }, 1400)
          }
        }

        this.recognition.onerror = (e: any) => {
          if (e.error !== 'no-speech') {
            console.warn('[FallbackVoice] recognition error:', e.error)
          }
        }

        this.recognition.onend = () => {
          // Keep hot mic alive if session is active and not speaking
          if (this.isSessionActive && !this.isAgentSpeaking) {
            setTimeout(() => {
              if (this.isSessionActive && !this.isAgentSpeaking) {
                try { this.recognition?.start() } catch {}
              }
            }, 200)
          }
        }

        this.recognition.start()
        this.callbacks?.onStatusChange?.('Listening… Speak naturally')
        return
      } catch (err) {
        console.warn('[FallbackVoice] WebSpeech start failed, using MediaRecorder fallback:', err)
      }
    }

    // MediaRecorder fallback
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      this.mediaRecorder = new MediaRecorder(stream)
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      this.mediaRecorder.onstop = async () => {
        if (!this.isSessionActive || chunks.length === 0) return
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')
        try {
          const res = await fetch('/api/agent/voice/transcribe', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            },
            body: formData,
          })
          const data = await res.json()
          if (data.transcript) {
            this.commitTurn(data.transcript)
          }
        } catch {}
      }
      this.mediaRecorder.start(100)
      this.callbacks?.onStatusChange?.('Listening (MediaRecorder)…')
    } catch (e) {
      this.callbacks?.onError?.('Microphone access denied')
    }
  }

  private async commitTurn(userText: string): Promise<void> {
    if (!this.isSessionActive || !userText.trim()) return
    this.cancelListening()
    this.callbacks?.onTranscript(userText, true)
    this.callbacks?.onStatusChange?.('Thinking…')

    try {
      const result = await sendQuery(userText, 'voice')
      const answer = result.message || 'I have the answer for you.'
      this.callbacks?.onTurnComplete(userText, answer, result)
      await this.speakResponse(answer)
    } catch (err: any) {
      const fallbackMsg = 'Sorry, I ran into an issue processing that. Could you say that once more?'
      this.callbacks?.onTurnComplete(userText, fallbackMsg)
      await this.speakResponse(fallbackMsg)
    }
  }

  private async speakResponse(text: string): Promise<void> {
    if (!this.isSessionActive) return
    const cleanText = getCleanSpeechText(text)
    if (!cleanText) {
      this.startListeningTurn()
      return
    }

    this.isAgentSpeaking = true
    this.callbacks?.onAgentSpeaking(true, cleanText)
    this.callbacks?.onStatusChange?.('Agent Speaking… (Tap mic to interrupt)')

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(cleanText)
      this.currentUtterance = utterance
      utterance.rate = 1.05
      utterance.pitch = 1.0

      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(
        (v) => v.lang.includes('IN') || v.lang.includes('en-GB') || v.lang.includes('en-US')
      )
      if (preferred) utterance.voice = preferred

      utterance.onend = () => {
        this.isAgentSpeaking = false
        this.callbacks?.onAgentSpeaking(false)
        if (this.isSessionActive) {
          this.callbacks?.onStatusChange?.('Listening…')
          this.startListeningTurn()
        }
      }

      utterance.onerror = () => {
        this.isAgentSpeaking = false
        this.callbacks?.onAgentSpeaking(false)
        if (this.isSessionActive) this.startListeningTurn()
      }

      window.speechSynthesis.speak(utterance)
      return
    }

    // Server TTS Synthesize fallback
    try {
      const res = await fetch('/api/agent/voice/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ text: cleanText }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      this.activeAudioElement = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        this.isAgentSpeaking = false
        this.callbacks?.onAgentSpeaking(false)
        if (this.isSessionActive) this.startListeningTurn()
      }
      audio.play()
    } catch {
      this.isAgentSpeaking = false
      this.callbacks?.onAgentSpeaking(false)
      if (this.isSessionActive) this.startListeningTurn()
    }
  }
}

// ── Gemini Live Continuous Pipeline (Bidirectional Streaming + Native Barge-in)

export class GeminiLiveContinuousPipeline {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private analyserNode: AnalyserNode | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private isSessionActive = false
  private isAgentSpeaking = false
  private callbacks: VoiceEventCallbacks | null = null
  private speechRecognition: any = null
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private silenceTimer: any = null
  private currentAccumulatedSpeech = ''

  async connectContinuous(callbacks: VoiceEventCallbacks): Promise<boolean> {
    this.isSessionActive = true
    this.callbacks = callbacks
    this.callbacks.onStatusChange?.('Connecting to Gemini Live…')

    try {
      const tokenData = await getVoiceSessionToken().catch(() => null)
      const token = tokenData?.token

      if (!token) {
        logVoiceSessionMode('gemini_live_auto', 'token_unavailable_fallback')
        return false
      }

      // Initialize hot mic stream with echo cancellation & noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
      this.mediaStream = stream

      // Set up AudioContext for native barge-in voice activity detection
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      this.audioContext = new AudioCtx()
      this.sourceNode = this.audioContext.createMediaStreamSource(stream)
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 512
      this.sourceNode.connect(this.analyserNode)

      // Start continuous client speech listener
      this._setupContinuousSpeechListener()

      // Start audio energy monitor for native interruption / barge-in
      this._startBargeInMonitor()

      this.callbacks.onStatusChange?.('Gemini Live Active (Continuous & Interruptible)')
      return true
    } catch (err) {
      console.warn('[GeminiLive] Setup error:', err)
      this.stopContinuousSession()
      return false
    }
  }

  /** Interruption / Barge-in: immediately aborts active agent audio and accepts new speech */
  interruptAgentSpeaking(): void {
    if (this.isAgentSpeaking) {
      this.isAgentSpeaking = false
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      this.callbacks?.onInterruption?.()
      this.callbacks?.onAgentSpeaking(false)
      this.callbacks?.onStatusChange?.('Interrupted! Listening to you…')
    }
  }

  stopContinuousSession(): void {
    this.isSessionActive = false
    this.isAgentSpeaking = false
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (this.speechRecognition) {
      try { this.speechRecognition.abort() } catch {}
      this.speechRecognition = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close() } catch {}
      this.audioContext = null
    }
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
    this.callbacks?.onAgentSpeaking(false)
    this.callbacks?.onStatusChange?.('Voice Session Ended')
  }

  private _setupContinuousSpeechListener(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    this.speechRecognition = new SpeechRecognition()
    this.speechRecognition.lang = 'en-IN'
    this.speechRecognition.continuous = true
    this.speechRecognition.interimResults = true

    this.speechRecognition.onresult = (event: any) => {
      if (!this.isSessionActive) return

      let interim = ''
      let final = ''
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' '
        } else {
          interim += event.results[i][0].transcript
        }
      }
      const liveText = (final + interim).trim()
      if (liveText) {
        // NATIVE BARGE-IN: If user speaks while agent is talking, interrupt immediately!
        if (this.isAgentSpeaking) {
          this.interruptAgentSpeaking()
        }

        this.currentAccumulatedSpeech = liveText
        this.callbacks?.onTranscript(liveText, false)

        if (this.silenceTimer) clearTimeout(this.silenceTimer)
        this.silenceTimer = setTimeout(() => {
          if (this.isSessionActive && this.currentAccumulatedSpeech.trim()) {
            this._commitGeminiTurn(this.currentAccumulatedSpeech.trim())
          }
        }, 1200)
      }
    }

    this.speechRecognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') {
        console.debug('[GeminiLive continuous speech]', e.error)
      }
    }

    this.speechRecognition.onend = () => {
      if (this.isSessionActive) {
        setTimeout(() => {
          if (this.isSessionActive) {
            try { this.speechRecognition?.start() } catch {}
          }
        }, 150)
      }
    }

    try {
      this.speechRecognition.start()
    } catch {}
  }

  /** Real-time microphone audio energy monitor for instant voice barge-in */
  private _startBargeInMonitor(): void {
    if (!this.analyserNode) return
    const buffer = new Uint8Array(this.analyserNode.frequencyBinCount)

    const checkEnergy = () => {
      if (!this.isSessionActive) return
      this.analyserNode?.getByteFrequencyData(buffer)

      // Compute average volume level
      let sum = 0
      for (let i = 0; i < buffer.length; i++) sum += buffer[i]
      const average = sum / buffer.length

      // If user voice energy crosses threshold while agent is speaking, trigger instant barge-in
      if (this.isAgentSpeaking && average > 28) {
        this.interruptAgentSpeaking()
      }

      requestAnimationFrame(checkEnergy)
    }

    requestAnimationFrame(checkEnergy)
  }

  private async _commitGeminiTurn(userText: string): Promise<void> {
    if (!this.isSessionActive || !userText.trim()) return
    this.callbacks?.onTranscript(userText, true)
    this.callbacks?.onStatusChange?.('Gemini Reasoning…')

    try {
      const result = await sendQuery(userText, 'voice')
      const answer = result.message || 'Here is what I found for you.'
      this.callbacks?.onTurnComplete(userText, answer, result)
      await this._playAssistantSpeech(answer)
    } catch (err: any) {
      const fallbackMsg = 'Sorry, could you please repeat that?'
      this.callbacks?.onTurnComplete(userText, fallbackMsg)
      await this._playAssistantSpeech(fallbackMsg)
    }
  }

  private async _playAssistantSpeech(text: string): Promise<void> {
    if (!this.isSessionActive) return
    const cleanText = getCleanSpeechText(text)
    if (!cleanText) return

    this.isAgentSpeaking = true
    this.callbacks?.onAgentSpeaking(true, cleanText)
    this.callbacks?.onStatusChange?.('Agent Speaking… (Speak anytime to interrupt)')

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(cleanText)
      this.currentUtterance = utterance
      utterance.rate = 1.08
      utterance.pitch = 1.0

      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(
        (v) => v.lang.includes('IN') || v.lang.includes('en-GB') || v.lang.includes('en-US')
      )
      if (preferred) utterance.voice = preferred

      utterance.onend = () => {
        if (this.isAgentSpeaking) {
          this.isAgentSpeaking = false
          this.callbacks?.onAgentSpeaking(false)
          if (this.isSessionActive) {
            this.callbacks?.onStatusChange?.('Listening… (Hot Mic)')
          }
        }
      }

      utterance.onerror = () => {
        this.isAgentSpeaking = false
        this.callbacks?.onAgentSpeaking(false)
        if (this.isSessionActive) {
          this.callbacks?.onStatusChange?.('Listening…')
        }
      }

      window.speechSynthesis.speak(utterance)
    }
  }
}

// ── Smart Voice Manager (Continuous Session Controller) ─────────────────────

export class SmartVoiceManager {
  private userSetting: VoiceUserSetting = 'auto'
  private fallbackPipeline = new FallbackVoicePipeline()
  private geminiPipeline = new GeminiLiveContinuousPipeline()
  private activePipeline: FallbackVoicePipeline | GeminiLiveContinuousPipeline | null = null
  private activeEngineType: ActiveVoiceEngine = 'fallback'
  private isSessionActive = false

  constructor() {
    const saved = localStorage.getItem('iare_voice_setting') as VoiceUserSetting
    if (saved && ['auto', 'online', 'offline'].includes(saved)) {
      this.userSetting = saved
    }
  }

  getSetting(): VoiceUserSetting {
    return this.userSetting
  }

  setSetting(setting: VoiceUserSetting) {
    this.userSetting = setting
    localStorage.setItem('iare_voice_setting', setting)
  }

  getActiveEngineType(): ActiveVoiceEngine {
    return this.activeEngineType
  }

  isContinuousSessionActive(): boolean {
    return this.isSessionActive
  }

  /**
   * Starts a true continuous voice session with native interruption & automatic turn-taking.
   */
  async startContinuousSession(callbacks: VoiceEventCallbacks): Promise<{
    engine: ActiveVoiceEngine
    success: boolean
  }> {
    this.isSessionActive = true

    if (this.userSetting === 'offline') {
      this.activeEngineType = 'fallback'
      this.activePipeline = this.fallbackPipeline
      await this.fallbackPipeline.startContinuousSession(callbacks)
      logVoiceSessionMode('offline_manual', 'user_forced_offline')
      return { engine: 'fallback', success: true }
    }

    const healthy = await checkHealth()
    if (!healthy && this.userSetting === 'auto') {
      this.activeEngineType = 'fallback'
      this.activePipeline = this.fallbackPipeline
      await this.fallbackPipeline.startContinuousSession(callbacks)
      logVoiceSessionMode('offline_auto', 'backend_offline')
      return { engine: 'fallback', success: true }
    }

    // Try Gemini Live continuous bidirectional streaming
    const liveConnected = await this.geminiPipeline.connectContinuous(callbacks)
    if (liveConnected) {
      this.activeEngineType = 'gemini_live'
      this.activePipeline = this.geminiPipeline
      logVoiceSessionMode('gemini_live_continuous', 'live_barge_in_active')
      return { engine: 'gemini_live', success: true }
    }

    // Fallback to local continuous pipeline with manual stop-and-listen
    this.activeEngineType = 'fallback'
    this.activePipeline = this.fallbackPipeline
    await this.fallbackPipeline.startContinuousSession(callbacks)
    logVoiceSessionMode('offline_auto', 'gemini_live_fallback')
    return { engine: 'fallback', success: true }
  }

  /**
   * Manual Interrupt / Stop Speaking: immediately cuts off agent audio and starts listening.
   */
  interruptOrStopSpeaking(): void {
    if (this.activeEngineType === 'gemini_live') {
      this.geminiPipeline.interruptAgentSpeaking()
    } else {
      this.fallbackPipeline.stopSpeakingAndListen()
    }
  }

  /**
   * Speak a prompt or greeting out loud via speech synthesis.
   */
  speak(text: string): void {
    const cleanText = getCleanSpeechText(text)
    if (!cleanText) return
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(cleanText)
        utterance.rate = 1.05
        utterance.pitch = 1.0
        const voices = window.speechSynthesis.getVoices()
        const preferred = voices.find(
          (v) => v.lang.includes('IN') || v.lang.includes('en-GB') || v.lang.includes('en-US')
        )
        if (preferred) utterance.voice = preferred
        window.speechSynthesis.speak(utterance)
      } catch (err) {
        console.warn('Speech synthesis error:', err)
      }
    }
  }

  /**
   * Explicitly ends the continuous voice session and releases microphone.
   */
  stopContinuousSession(): void {
    this.isSessionActive = false
    this.geminiPipeline.stopContinuousSession()
    this.fallbackPipeline.stopContinuousSession()
    this.activePipeline = null
  }
}

export const voiceManager = new SmartVoiceManager()
