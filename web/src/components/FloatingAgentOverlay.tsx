import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  Award,
  BookOpen,
  Calendar,
  Compass,
  CheckCircle2,
  ChevronRight,
  User,
  Volume2,
  VolumeX,
  Square,
  AlertCircle,
  Zap,
} from 'lucide-react'
import {
  sendQuery,
  type NavResult,
  getStudentDashboard,
} from '@/services/api'
import MapOverlay from './MapOverlay'
import { springs } from '@/tokens'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  navResult?: NavResult
  subject?: string
  topic?: string
  isWeaknessTrigger?: boolean
  imageUrl?: string
  imageCaption?: string
  mode?: 'text' | 'voice'
}

interface FloatingAgentOverlayProps {
  isOpen: boolean
  onToggle: () => void
  onOpenAssessment?: () => void
  onOpenTimetable?: () => void
  onOpenNotices?: () => void
  initialQuery?: string
}

function cleanSpeechText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_+(.*?)_+/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/•/g, '')
    .replace(/^[#\->\s]+/gm, '')
    .replace(/[🏛📍🗺️👋📊🎒⏱️🌲💡🧑‍🏫🔬📢📝🟢🟡🔴✅⚠️🚨🎉🎯]/g, '')
    .trim()
}

/**
 * FloatingAgentOverlay — Layered Conversational AI Assistant
 * Featuring real-time bidirectional voice (STT & TTS), suggestions, navigation overlays.
 */
export const FloatingAgentOverlay: React.FC<FloatingAgentOverlayProps> = ({
  isOpen,
  onToggle,
  onOpenAssessment,
  onOpenTimetable,
  onOpenNotices,
  initialQuery,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        '👋 Hello! I am your **IARE Campus & Academic Companion**.\n\nAsk me about your **live attendance stats**, **today\'s schedule**, **homework concepts**, or **campus directions**!',
      timestamp: 'Just now',
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const [voiceStatusText, setVoiceStatusText] = useState<string | null>(null)
  const [activeNavResult, setActiveNavResult] = useState<NavResult | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const isListeningRef = useRef<boolean>(false)

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  useEffect(() => {
    if (initialQuery) {
      handleSendQuery(initialQuery, 'text')
    }
  }, [initialQuery])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening()
      stopSpeaking()
    }
  }, [])

  // ── Speech Output (TTS) ───────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
    }
    if (activeAudioElementRef.current) {
      activeAudioElementRef.current.pause()
      activeAudioElementRef.current = null
    }
    currentUtteranceRef.current = null
    setIsSpeaking(false)
    setSpeakingMessageId(null)
  }, [])

  const speakText = useCallback(async (text: string, msgId?: string) => {
    stopSpeaking()
    const clean = cleanSpeechText(text)
    if (!clean) return

    setIsSpeaking(true)
    if (msgId) setSpeakingMessageId(msgId)

    // Primary: Web Speech API SpeechSynthesis
    if ('speechSynthesis' in window) {
      try {
        // Resume synthesis if stalled (Chromium bug workaround)
        window.speechSynthesis.resume()
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(clean)
        currentUtteranceRef.current = utterance
        utterance.rate = 1.05
        utterance.pitch = 1.0

        const voices = window.speechSynthesis.getVoices()
        const preferredVoice = voices.find(
          (v) =>
            v.lang.includes('en-IN') ||
            v.lang.includes('en_IN') ||
            v.name.includes('India') ||
            v.lang.includes('en-GB') ||
            v.lang.includes('en-US')
        )
        if (preferredVoice) utterance.voice = preferredVoice

        utterance.onend = () => {
          setIsSpeaking(false)
          setSpeakingMessageId(null)
          currentUtteranceRef.current = null
        }

        utterance.onerror = (e) => {
          console.warn('[SpeechSynthesis error]', e)
          setIsSpeaking(false)
          setSpeakingMessageId(null)
          currentUtteranceRef.current = null
        }

        window.speechSynthesis.speak(utterance)
        return
      } catch (err) {
        console.warn('Local speech synthesis failed, falling back to server TTS:', err)
      }
    }

    // Fallback: Server TTS Synthesis (/api/agent/voice/synthesize)
    try {
      const res = await fetch('/api/agent/voice/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify({ text: clean }),
      })

      if (!res.ok) throw new Error(`Server TTS error ${res.status}`)

      const blob = await res.blob()
      if (blob.size === 0) throw new Error('Empty audio stream returned')

      const audioUrl = URL.createObjectURL(blob)
      const audio = new Audio(audioUrl)
      activeAudioElementRef.current = audio

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        setIsSpeaking(false)
        setSpeakingMessageId(null)
        activeAudioElementRef.current = null
      }

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        setIsSpeaking(false)
        setSpeakingMessageId(null)
        activeAudioElementRef.current = null
      }

      await audio.play()
    } catch (err) {
      console.warn('Server TTS synthesis error:', err)
      setIsSpeaking(false)
      setSpeakingMessageId(null)
    }
  }, [stopSpeaking])

  // ── Query Sending ──────────────────────────────────────────────────────────

  const handleSendQuery = async (queryText?: string, mode: 'text' | 'voice' = 'text') => {
    const textToSend = queryText || inputText.trim()
    if (!textToSend || isLoading) return

    stopSpeaking()

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode,
    }

    setMessages((prev) => [...prev, userMsg])
    if (!queryText) setInputText('')
    setIsLoading(true)

    try {
      const res = await sendQuery(textToSend, mode)
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.message || 'I processed your request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        navResult: res.route_stops ? res : undefined,
        subject: res.subject,
        topic: res.topic,
        isWeaknessTrigger: res.is_weakness_trigger,
        imageUrl: res.imageUrl,
        imageCaption: res.imageCaption,
      }

      setMessages((prev) => [...prev, assistantMsg])
      if (res.route_stops && res.route_stops.length > 0) {
        setActiveNavResult(res)
      }

      // If user queried via voice, read back response out loud automatically!
      if (mode === 'voice' && assistantMsg.content) {
        speakText(assistantMsg.content, assistantMsg.id)
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '⚠️ I encountered an error connecting to the AI inference service. Please verify network or try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  // ── Speech Input (STT) ────────────────────────────────────────────────────

  const stopListening = useCallback(() => {
    setIsListening(false)
    setVoiceStatusText(null)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {}
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {}
      mediaRecorderRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    stopSpeaking()
    stopListening()

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition()
        recognitionRef.current = recognition
        recognition.lang = 'en-IN'
        recognition.continuous = false
        recognition.interimResults = true

        recognition.onstart = () => {
          setIsListening(true)
          setVoiceStatusText('Listening… Speak naturally')
        }

        recognition.onresult = (e: any) => {
          let transcript = ''
          for (let i = 0; i < e.results.length; i++) {
            transcript += e.results[i][0].transcript
          }
          if (transcript) {
            setInputText(transcript)
            setVoiceStatusText(`Heard: "${transcript}"`)
          }
          if (e.results[0] && e.results[0].isFinal) {
            stopListening()
            if (transcript.trim()) {
              handleSendQuery(transcript.trim(), 'voice')
            }
          }
        }

        recognition.onerror = (e: any) => {
          console.warn('[SpeechRecognition error]', e.error)
          if (e.error === 'not-allowed') {
            setVoiceStatusText('⚠️ Microphone blocked. Please allow mic in browser settings.')
          } else if (e.error === 'no-speech') {
            setVoiceStatusText('No speech detected. Please tap mic and try again.')
          } else {
            setVoiceStatusText(`Speech error (${e.error}). Falling back to audio recording…`)
            startMediaRecorderFallback()
            return
          }
          setTimeout(() => {
            if (!isListeningRef.current) setVoiceStatusText(null)
          }, 4000)
          setIsListening(false)
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognition.start()
        return
      } catch (err) {
        console.warn('SpeechRecognition failed, attempting MediaRecorder:', err)
      }
    }

    // Fallback: MediaRecorder Audio Recording
    startMediaRecorderFallback()
  }, [stopListening, stopSpeaking])

  const startMediaRecorderFallback = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstart = () => {
        setIsListening(true)
        setVoiceStatusText('🎙️ Recording voice (Whisper STT)… Tap to stop')
      }

      recorder.onstop = async () => {
        setIsListening(false)
        setVoiceStatusText('Transcribing audio with Whisper…')
        stream.getTracks().forEach((track) => track.stop())

        if (audioChunksRef.current.length === 0) {
          setVoiceStatusText(null)
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', audioBlob, 'speech.webm')

        try {
          const res = await fetch('/api/agent/voice/transcribe', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
            },
            body: formData,
          })

          const data = await res.json()
          setVoiceStatusText(null)
          if (data.transcript && data.transcript.trim()) {
            handleSendQuery(data.transcript.trim(), 'voice')
          } else {
            setVoiceStatusText('Could not detect clear speech. Please try again.')
            setTimeout(() => setVoiceStatusText(null), 3000)
          }
        } catch (err) {
          console.error('Transcription error:', err)
          setVoiceStatusText('Transcription service unavailable.')
          setTimeout(() => setVoiceStatusText(null), 3000)
        }
      }

      recorder.start()
    } catch (err: any) {
      console.error('Microphone access denied:', err)
      setIsListening(false)
      setVoiceStatusText('⚠️ Microphone permission denied. Please allow mic in browser.')
      setTimeout(() => setVoiceStatusText(null), 4000)
    }
  }

  const handleVoiceToggle = () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      } else {
        stopListening()
      }
    } else {
      startListening()
    }
  }

  const chips = [
    { label: '📊 Attendance Stats', query: 'What is my current attendance and safe bunks?' },
    { label: '📅 Today\'s Classes', query: 'What is my class schedule today?' },
    { label: '🎯 Start Assessment', action: onOpenAssessment },
    { label: '📍 Library Directions', query: 'Where is the central library and how do I reach it?' },
    { label: '📢 Campus Notices', action: onOpenNotices },
  ]

  return (
    <>
      {/* Floating Activation Trigger Icon (Bottom-Right) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            transition={springs.bouncy}
            style={{
              position: 'fixed',
              bottom: '28px',
              right: '28px',
              zIndex: 9990,
            }}
          >
            <motion.button
              whileHover={{ scale: 1.08, y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={onToggle}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0A84FF 0%, #5E5CE6 50%, #BF5AF2 100%)',
                border: '1.5px solid rgba(255, 255, 255, 0.35)',
                boxShadow: '0 8px 32px rgba(10, 132, 255, 0.45), 0 0 20px rgba(94, 92, 230, 0.3)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
              }}
              title="Open IARE AI Companion"
            >
              <Sparkles size={26} />

              {/* Status Pulse Ring */}
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#34C759',
                  border: '2px solid #0A0D14',
                  boxShadow: '0 0 8px #34C759',
                }}
              />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layered Conversational Agent Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Dimmer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                zIndex: 9998,
              }}
            />

            {/* Slide-in Overlay Panel */}
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={springs.smooth}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: isExpanded ? '850px' : '480px',
                maxWidth: '96vw',
                background: 'var(--bg-card, rgba(16, 20, 31, 0.95))',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                borderLeft: '1px solid var(--border-card, rgba(255, 255, 255, 0.12))',
                boxShadow: '-12px 0 48px rgba(0, 0, 0, 0.5)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Drawer Top Navigation Header */}
              <div
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-card, rgba(255, 255, 255, 0.08))',
                  background: 'var(--bg-sunken, rgba(0, 0, 0, 0.2))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #0A84FF 0%, #5E5CE6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      boxShadow: '0 4px 14px rgba(10, 132, 255, 0.35)',
                    }}
                  >
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '15.5px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        IARE Assistant
                      </h3>
                      <Badge variant="success" style={{ fontSize: '10px' }}>
                        Groq Online
                      </Badge>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Continuous Voice & Academic Specialist
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      padding: '7px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={isExpanded ? 'Collapse side panel' : 'Expand panel width'}
                  >
                    {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>

                  <button
                    onClick={onToggle}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      padding: '7px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Close overlay"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Chat Messages Body */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '88%',
                        padding: '12px 16px',
                        borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: msg.role === 'user' ? 'var(--accent-color, #0A84FF)' : 'var(--bg-card, rgba(26, 32, 46, 0.75))',
                        color: msg.role === 'user' ? '#FFFFFF' : 'var(--text-primary)',
                        border: msg.role === 'user' ? 'none' : '1px solid var(--border-card, rgba(255, 255, 255, 0.08))',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        fontSize: '13.5px',
                        lineHeight: 1.55,
                      }}
                    >
                      {/* Tag pill if weakness trigger */}
                      {msg.isWeaknessTrigger && (
                        <div style={{ marginBottom: '8px' }}>
                          <Badge variant="warning" style={{ fontSize: '10px' }}>
                            🎯 Weakness Area Practice Triggered
                          </Badge>
                        </div>
                      )}

                      <div
                        style={{ whiteSpace: 'pre-wrap' }}
                        dangerouslySetInnerHTML={{
                          __html: msg.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.25); padding: 2px 4px; border-radius: 4px;">$1</code>'),
                        }}
                      />

                      {/* Attached SVG Visual Image if returned */}
                      {msg.imageUrl && (
                        <div style={{ marginTop: '12px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-card)' }}>
                          <img src={msg.imageUrl} alt={msg.imageCaption || 'Diagram'} style={{ width: '100%', display: 'block' }} />
                          {msg.imageCaption && (
                            <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)' }}>
                              {msg.imageCaption}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Message Sub-bar with Timestamp & TTS Listen Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', padding: '0 4px' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-dim, #86868B)' }}>
                        {msg.timestamp}
                      </span>

                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => {
                            if (speakingMessageId === msg.id) {
                              stopSpeaking()
                            } else {
                              speakText(msg.content, msg.id)
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: speakingMessageId === msg.id ? '#0A84FF' : 'var(--text-dim, #86868B)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '11px',
                            borderRadius: '4px',
                          }}
                          title="Listen to response"
                        >
                          {speakingMessageId === msg.id ? (
                            <>
                              <Square size={11} color="#FF3B30" />
                              <span style={{ color: '#FF453A', fontWeight: 600 }}>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 size={12} />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: '16px',
                      background: 'var(--bg-card)',
                      width: 'fit-content',
                      border: '1px solid var(--border-card)',
                    }}
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    >
                      <Sparkles size={14} color="#0A84FF" />
                    </motion.div>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Reasoning via Groq...</span>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Active Voice / TTS Status Bar */}
              <AnimatePresence>
                {voiceStatusText && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      padding: '8px 18px',
                      background: isListening ? 'rgba(255, 59, 48, 0.12)' : 'rgba(10, 132, 255, 0.12)',
                      borderTop: isListening ? '1px solid rgba(255, 59, 48, 0.25)' : '1px solid rgba(10, 132, 255, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: isListening ? '#FF3B30' : '#0A84FF',
                          animation: 'pulse 1.2s infinite',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '12px',
                          color: isListening ? '#FF453A' : '#0A84FF',
                          fontWeight: 600,
                        }}
                      >
                        {voiceStatusText}
                      </span>
                    </div>

                    {isListening && (
                      <button
                        onClick={stopListening}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#FF453A',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </motion.div>
                )}

                {isSpeaking && !voiceStatusText && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      padding: '8px 18px',
                      background: 'rgba(10, 132, 255, 0.12)',
                      borderTop: '1px solid rgba(10, 132, 255, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Volume2 size={14} color="#0A84FF" />
                      <span style={{ fontSize: '12px', color: '#0A84FF', fontWeight: 600 }}>
                        Assistant speaking out loud…
                      </span>
                    </div>

                    <button
                      onClick={stopSpeaking}
                      style={{
                        background: 'rgba(10, 132, 255, 0.2)',
                        border: 'none',
                        color: '#0A84FF',
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Stop Speaking
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Suggestion Chips */}
              <div
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  borderTop: '1px solid var(--border-card, rgba(255, 255, 255, 0.05))',
                }}
              >
                {chips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (chip.action) chip.action()
                      else if (chip.query) handleSendQuery(chip.query, 'text')
                    }}
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '6px 12px',
                      borderRadius: '999px',
                      fontSize: '11.5px',
                      fontWeight: 500,
                      background: 'var(--bg-card, rgba(255, 255, 255, 0.06))',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-card, rgba(255, 255, 255, 0.1))',
                      cursor: 'pointer',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Chat Input Bar */}
              <div
                style={{
                  padding: '14px 18px',
                  borderTop: '1px solid var(--border-card, rgba(255, 255, 255, 0.08))',
                  background: 'var(--bg-sunken, rgba(0, 0, 0, 0.2))',
                }}
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSendQuery(undefined, 'text')
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--bg-input, rgba(255, 255, 255, 0.07))',
                    borderRadius: '16px',
                    padding: '4px 6px 4px 14px',
                    border: isListening ? '1.5px solid #FF3B30' : '1px solid var(--border-input, rgba(255, 255, 255, 0.12))',
                    boxShadow: isListening ? '0 0 12px rgba(255, 59, 48, 0.3)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <input
                    type="text"
                    placeholder={isListening ? "Listening... Speak now..." : "Ask about attendance, courses, navigation..."}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '13.5px',
                    }}
                  />

                  {/* Microphone Voice Toggle */}
                  <motion.button
                    type="button"
                    onClick={handleVoiceToggle}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    style={{
                      background: isListening ? '#FF3B30' : 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      color: isListening ? '#FFFFFF' : 'var(--text-secondary)',
                      padding: '8px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isListening ? '0 0 14px rgba(255, 59, 48, 0.6)' : 'none',
                    }}
                    title={isListening ? "Stop listening" : "Voice input (Speak to AI)"}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </motion.button>

                  <button
                    type="submit"
                    disabled={!inputText.trim() || isLoading}
                    style={{
                      background: inputText.trim() && !isLoading ? '#0A84FF' : 'rgba(255,255,255,0.1)',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '8px',
                      borderRadius: '12px',
                      cursor: inputText.trim() && !isLoading ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={15} />
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Navigation Map Overlay */}
      {activeNavResult && (
        <MapOverlay
          navResult={activeNavResult}
          onClose={() => setActiveNavResult(null)}
        />
      )}
    </>
  )
}
