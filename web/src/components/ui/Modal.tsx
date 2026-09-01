import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springs } from '@/tokens'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  maxWidth?: string | number
  children: React.ReactNode
  headerActions?: React.ReactNode
  footer?: React.ReactNode
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = '580px',
  children,
  headerActions,
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          {/* Backdrop with Frosted Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Floating Frosted Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={springs.smooth}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth,
              maxHeight: 'calc(100vh - 40px)',
              background: 'var(--bg-glass-strong)',
              backdropFilter: 'var(--glass-blur-heavy)',
              WebkitBackdropFilter: 'var(--glass-blur-heavy)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-2xl)',
              boxShadow: 'var(--shadow-modal)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 1,
            }}
          >
            {/* Header */}
            {(title || headerActions) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px 22px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-sunken)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {icon && (
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {icon}
                    </div>
                  )}
                  <div>
                    {title && (
                      <h3
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          margin: 0,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {title}
                      </h3>
                    )}
                    {subtitle && (
                      <p
                        style={{
                          fontSize: '0.78125rem',
                          color: 'var(--text-secondary)',
                          margin: '2px 0 0 0',
                        }}
                      >
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {headerActions}
                  <button
                    onClick={onClose}
                    aria-label="Close modal"
                    style={{
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
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '22px',
              }}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div
                style={{
                  padding: '14px 22px',
                  borderTop: '1px solid var(--border-subtle)',
                  background: 'var(--bg-sunken)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
