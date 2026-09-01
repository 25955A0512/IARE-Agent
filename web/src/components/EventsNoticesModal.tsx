import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  EventItem,
  StudentEventNotification,
  getEventsFeed,
  markNotificationRead,
} from '../services/api'
import { Modal } from './ui/Modal'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { SegmentedControl } from './ui/SegmentedControl'
import { springs } from '@/tokens'
import {
  Bell,
  AlertTriangle,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Radio,
  Clock,
  MapPin,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

interface EventsNoticesModalProps {
  isOpen: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

export const EventsNoticesModal: React.FC<EventsNoticesModalProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
}) => {
  const [events, setEvents] = useState<EventItem[]>([])
  const [notifications, setNotifications] = useState<StudentEventNotification[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'mandatory'>('all')

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, activeTab])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const feed = await getEventsFeed(activeTab === 'mandatory')
      setEvents(feed.events || [])
      setNotifications(feed.unreadNotifications || [])
      if (onUnreadCountChange) {
        onUnreadCountChange(feed.unreadNotifications?.length || 0)
      }
    } catch (err: any) {
      console.error('Failed to load events feed', err)
      setError('Could not load events and notices. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDismissNotification = async (notifId: number) => {
    try {
      await markNotificationRead(notifId)
      const updated = notifications.filter((n) => n.id !== notifId)
      setNotifications(updated)
      if (onUnreadCountChange) {
        onUnreadCountChange(updated.length)
      }
    } catch (err) {
      console.error('Failed to mark notification read', err)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Campus Notices & Circulars Hub"
      subtitle="Live intelligence extracted automatically from official college Telegram channels"
      icon={<Bell size={18} />}
      maxWidth="720px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Live Automatic Telegram Channel Telemetry Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(52, 199, 89, 0.08)',
            border: '1px solid rgba(52, 199, 89, 0.22)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#34C759',
                boxShadow: '0 0 10px rgba(52, 199, 89, 0.6)',
                animation: 'pulse 2s infinite',
              }}
            />
            <div>
              <span style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Auto-Synced Telegram Intelligence
              </span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                Continuous real-time ingestion from 6 consented IARE department & placement channels.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
        </div>

        {/* Segmented Control Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <SegmentedControl
            options={[
              { value: 'all', label: 'All Notices', icon: <Bell size={13} /> },
              { value: 'mandatory', label: 'Mandatory Directives', icon: <AlertTriangle size={13} /> },
            ]}
            value={activeTab}
            onChange={(val) => setActiveTab(val as any)}
            size="sm"
          />

          {notifications.length > 0 && (
            <Badge variant="warning" size="sm" icon={<AlertTriangle size={11} />}>
              {notifications.length} Action Required
            </Badge>
          )}
        </div>

        {/* Notices Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Urgent Action Alerts */}
          <AnimatePresence>
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={springs.snappy}
              >
                <Card
                  style={{
                    borderLeft: '4px solid #FF9500',
                    background: 'var(--bg-card)',
                    padding: '16px 18px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 149, 0, 0.12)',
                          color: '#FF9500',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.90625rem', color: 'var(--text-primary)' }}>
                            {notif.title}
                          </span>
                          {notif.mandatory && (
                            <Badge variant="error" size="sm">
                              Mandatory
                            </Badge>
                          )}
                        </div>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.45 }}>
                          {notif.message}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDismissNotification(notif.id)}
                      icon={<CheckCircle2 size={13} />}
                    >
                      Acknowledge
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '2px solid var(--border-subtle)',
                  borderTopColor: 'var(--accent-color)',
                  animation: 'spinSlow 0.8s linear infinite',
                  margin: '0 auto 10px',
                }}
              />
              <p style={{ fontSize: '0.84375rem' }}>Synchronizing latest campus announcements…</p>
            </div>
          )}

          {!loading && events.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bell size={28} style={{ opacity: 0.4, marginBottom: '8px' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No active notices in this filter</p>
              <p style={{ fontSize: '0.8125rem' }}>You're all caught up with official updates.</p>
            </div>
          )}

          {/* List of Circulars */}
          {!loading &&
            events.map((event) => {
              const isMandatory = event.mandatory
              return (
                <Card
                  key={event.id}
                  interactive
                  style={{
                    borderLeft: isMandatory ? '3px solid var(--accent-color)' : '1px solid var(--border-card)',
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {event.title}
                        </h4>
                        {isMandatory ? (
                          <Badge variant="primary" size="sm">
                            Official Directive
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            Notice
                          </Badge>
                        )}
                        {event.targetBranch && (
                          <Badge variant="outline" size="sm">
                            {event.targetBranch}
                          </Badge>
                        )}
                      </div>

                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '10px' }}>
                        {event.description || event.rawText}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} />
                          {event.eventDate || new Date(event.createdAt || Date.now()).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {event.location && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} />
                            {event.location}
                          </span>
                        )}
                        {event.registrationDeadline && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FF9500', fontWeight: 600 }}>
                            <Clock size={12} />
                            Due: {event.registrationDeadline}
                          </span>
                        )}
                      </div>
                    </div>

                    {event.actionUrl && (
                      <a href={event.actionUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                        <Button variant="accent-subtle" size="sm" iconRight={<ExternalLink size={12} />}>
                          Link
                        </Button>
                      </a>
                    )}
                  </div>
                </Card>
              )
            })}
        </div>
      </div>
    </Modal>
  )
}
