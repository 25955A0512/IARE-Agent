import React from 'react'

export interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'indigo' | 'outline'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  style,
  className = '',
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'rgba(10, 132, 255, 0.12)',
          color: '#0A84FF',
          border: '1px solid rgba(10, 132, 255, 0.25)',
        }
      case 'success':
        return {
          background: 'rgba(52, 199, 89, 0.12)',
          color: '#34C759',
          border: '1px solid rgba(52, 199, 89, 0.25)',
        }
      case 'warning':
        return {
          background: 'rgba(255, 149, 0, 0.12)',
          color: '#FF9500',
          border: '1px solid rgba(255, 149, 0, 0.25)',
        }
      case 'error':
        return {
          background: 'rgba(255, 59, 48, 0.12)',
          color: '#FF3B30',
          border: '1px solid rgba(255, 59, 48, 0.25)',
        }
      case 'indigo':
        return {
          background: 'rgba(94, 92, 230, 0.12)',
          color: '#5E5CE6',
          border: '1px solid rgba(94, 92, 230, 0.25)',
        }
      case 'outline':
        return {
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
        }
      case 'neutral':
      default:
        return {
          background: 'var(--bg-badge)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
        }
    }
  }

  const isSm = size === 'sm'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        borderRadius: 'var(--radius-full)',
        padding: isSm ? '2px 7px' : '3px 10px',
        fontSize: isSm ? '0.6875rem' : '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...getVariantStyles(),
        ...style,
      }}
      className={className}
    >
      {icon && <span style={{ display: 'inline-flex', fontSize: '0.9em' }}>{icon}</span>}
      <span>{children}</span>
    </span>
  )
}
