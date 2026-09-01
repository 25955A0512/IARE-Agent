import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { springs } from '@/tokens'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'glass' | 'accent-subtle'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  loading?: boolean
  children?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled,
  children,
  style,
  className = '',
  ...props
}) => {
  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: '6px 12px',
          fontSize: '0.8125rem',
          borderRadius: 'var(--radius-sm)',
          gap: '6px',
        }
      case 'lg':
        return {
          padding: '12px 22px',
          fontSize: '0.9375rem',
          borderRadius: 'var(--radius-lg)',
          gap: '10px',
        }
      case 'md':
      default:
        return {
          padding: '9px 16px',
          fontSize: '0.875rem',
          borderRadius: 'var(--radius-md)',
          gap: '8px',
        }
    }
  }

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--accent-gradient)',
          color: '#FFFFFF',
          border: 'none',
          boxShadow: 'var(--shadow-subtle), 0 2px 8px -1px rgba(10, 132, 255, 0.35)',
          fontWeight: 600,
        }
      case 'secondary':
        return {
          background: 'var(--bg-card-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-subtle)',
          fontWeight: 500,
        }
      case 'glass':
        return {
          background: 'var(--bg-glass)',
          color: 'var(--text-primary)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-subtle)',
          fontWeight: 500,
        }
      case 'accent-subtle':
        return {
          background: 'var(--accent-subtle)',
          color: 'var(--accent-color)',
          border: '1px solid var(--accent-border)',
          fontWeight: 600,
        }
      case 'destructive':
        return {
          background: 'rgba(255, 59, 48, 0.12)',
          color: '#FF3B30',
          border: '1px solid rgba(255, 59, 48, 0.25)',
          fontWeight: 600,
        }
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: 'none',
          fontWeight: 500,
        }
      default:
        return {}
    }
  }

  return (
    <motion.button
      whileHover={
        disabled || loading
          ? undefined
          : {
              opacity: variant === 'ghost' ? 1 : 0.94,
              filter: 'brightness(1.03)',
              transition: springs.snappy,
            }
      }
      whileTap={
        disabled || loading
          ? undefined
          : {
              scale: 0.965,
              transition: springs.snappy,
            }
      }
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        letterSpacing: '-0.01em',
        userSelect: 'none',
        transition: 'all 0.15s ease',
        ...getSizeStyles(),
        ...getVariantStyles(),
        ...style,
      }}
      className={className}
      {...props}
    >
      {loading ? (
        <span
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: 'currentColor',
            animation: 'spinSlow 0.7s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : (
        <>
          {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
          {children && <span>{children}</span>}
          {iconRight && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{iconRight}</span>}
        </>
      )}
    </motion.button>
  )
}
