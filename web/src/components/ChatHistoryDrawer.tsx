import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getChatSessions,
  deleteChatSession,
  type ChatSessionItem,
} from '@/services/api'
import { Button } from '@/components/ui/Button'
import { springs } from '@/tokens'
import { MessageSquare, Plus, Trash2, X, Search, Clock, Calendar } from 'lucide-react'

interface ChatHistoryDrawerProps {
  isOpen: boolean
  activeSessionId?: string
  onClose: () => void
  onSelectSession: (sessionId: string) => void
  onNewChat: () => void
}

export function ChatHistoryDrawer({
  isOpen,
  activeSessionId,
  onClose,
  onSelectSession,
  onNewChat,
}: ChatHistoryDrawerProps) {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadSessions = async () => {
    setLoading(true)
    try {
      const data = await getChatSessions()
      setSessions(data.sessions || [])
    } catch (err) {
      console.error('Failed to load chat history', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadSessions()
    }
  }, [isOpen])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('Delete this conversation history?')) return
    setDeletingId(id)
    try {
      await deleteChatSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeSessionId === id) {
        onNewChat()
      }
    } catch (err) {
      console.error('Failed to delete session', err)
    } finally {
      setDeletingId(null)
    }
  }

  // Date Grouping Helper
  const groupSessionsByDate = (items: ChatSessionItem[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const filtered = searchQuery.trim()
      ? items.filter((s) => (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
      : items

    const groups: { [key: string]: ChatSessionItem[] } = {
      Today: [],
      Yesterday: [],
      'Previous 7 Days': [],
      Older: [],
    }

    for (const item of filtered) {
      const itemDate = new Date(item.updatedAt || item.createdAt)
      if (itemDate >= today) {
        groups['Today'].push(item)
      } else if (itemDate >= yesterday) {
        groups['Yesterday'].push(item)
      } else if (itemDate >= weekAgo) {
        groups['Previous 7 Days'].push(item)
      } else {
        groups['Older'].push(item)
      }
    }

    return groups
  }

  const grouped = groupSessionsByDate(sessions)

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={styles.backdropRoot}>
          {/* Frosted Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={styles.backdrop}
            onClick={onClose}
          />

          {/* Slide-in macOS Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={springs.smooth}
            style={styles.drawer}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={styles.header}>
              <div style={styles.headerTitleRow}>
                <div style={styles.headerIcon}>
                  <MessageSquare size={17} />
                </div>
                <div>
                  <h3 style={styles.title}>Conversations</h3>
                  <p style={styles.subtitle}>{sessions.length} saved sessions</p>
                </div>
              </div>

              <button onClick={onClose} style={styles.closeBtn} aria-label="Close history">
                <X size={16} />
              </button>
            </div>

            {/* Action Bar: New Chat */}
            <div style={styles.actionBar}>
              <Button
                variant="primary"
                size="md"
                icon={<Plus size={15} />}
                onClick={() => {
                  onNewChat()
                  onClose()
                }}
                style={{ width: '100%' }}
              >
                New Conversation
              </Button>
            </div>

            {/* Search Input */}
            <div style={styles.searchBox}>
              <div style={styles.searchInputWrap}>
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search past conversations…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Sessions List */}
            <div style={styles.listContainer}>
              {loading && (
                <div style={styles.emptyState}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid var(--border-subtle)',
                      borderTopColor: 'var(--accent-color)',
                      animation: 'spinSlow 0.8s linear infinite',
                      marginBottom: '10px',
                    }}
                  />
                  <p style={{ fontSize: '0.84375rem', color: 'var(--text-secondary)' }}>
                    Loading conversation history…
                  </p>
                </div>
              )}

              {!loading && sessions.length === 0 && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIconCircle}>
                    <MessageSquare size={24} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '8px' }}>
                    No conversations yet
                  </p>
                  <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Ask about navigation, timetables, or study concepts to start!
                  </p>
                </div>
              )}

              {!loading &&
                Object.entries(grouped).map(([label, items]) => {
                  if (items.length === 0) return null
                  return (
                    <div key={label} style={styles.groupSection}>
                      <div style={styles.groupHeading}>
                        <Calendar size={11} style={{ marginRight: '4px' }} />
                        {label}
                      </div>

                      <div style={styles.sessionList}>
                        {items.map((s) => {
                          const isActive = s.id === activeSessionId
                          return (
                            <motion.div
                              key={s.id}
                              whileHover={{ x: 2 }}
                              whileTap={{ scale: 0.985 }}
                              transition={springs.snappy}
                              onClick={() => {
                                onSelectSession(s.id)
                                onClose()
                              }}
                              style={isActive ? styles.sessionItemActive : styles.sessionItem}
                            >
                              <div style={styles.sessionItemContent}>
                                <div style={styles.sessionTitle}>{s.title || 'Conversation'}</div>
                                <div style={styles.sessionMeta}>
                                  <Clock size={11} />
                                  <span>
                                    {new Date(s.updatedAt || s.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                  <span>•</span>
                                  <span>{s.messageCount || 1} msgs</span>
                                </div>
                              </div>

                              <button
                                onClick={(e) => handleDelete(e, s.id)}
                                disabled={deletingId === s.id}
                                style={styles.deleteBtn}
                                title="Delete conversation"
                                aria-label="Delete conversation"
                              >
                                <Trash2 size={13} />
                              </button>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdropRoot: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  drawer: {
    position: 'relative',
    backgroundColor: 'var(--bg-glass-strong)',
    backdropFilter: 'var(--glass-blur-heavy)',
    WebkitBackdropFilter: 'var(--glass-blur-heavy)',
    borderLeft: '1px solid var(--border-glass)',
    width: '100%',
    maxWidth: '380px',
    height: '100%',
    boxShadow: 'var(--shadow-modal)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 20px',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-sunken)',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  headerIcon: {
    width: '34px',
    height: '34px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--accent-subtle)',
    color: 'var(--accent-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  closeBtn: {
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-full)',
    background: 'var(--bg-segment)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
  },
  actionBar: {
    padding: '14px 18px 10px',
  },
  searchBox: {
    padding: '0 18px 12px',
  },
  searchInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    padding: '7px 12px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.84375rem',
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  emptyState: {
    padding: '48px 16px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'var(--bg-sunken)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  groupHeading: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    paddingLeft: '4px',
  },
  sessionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  sessionItem: {
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: 'var(--shadow-subtle)',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  sessionItemActive: {
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--accent-subtle)',
    border: '1px solid var(--accent-border)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: 'var(--shadow-subtle)',
  },
  sessionItemContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    overflow: 'hidden',
    flex: 1,
  },
  sessionTitle: {
    fontSize: '0.84375rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sessionMeta: {
    fontSize: '0.71875rem',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-dim)',
    padding: '6px',
    borderRadius: 'var(--radius-xs)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s ease',
  },
}
