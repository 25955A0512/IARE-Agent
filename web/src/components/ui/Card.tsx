import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { springs } from '@/tokens'

export interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'glass' | 'elevated' | 'sunken' | 'default' | 'accent'
  interactive?: boolean
  children?: React.ReactNode
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  interactive = false,
  children,
  style,
  className = '',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'glass':
        return {
          background: 'var(--bg-glass)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-card)',
        }
      case 'elevated':
        return {
          background: 'var(--bg-card-elevated)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-elevated)',
        }
      case 'sunken':
        return {
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
        }
      case 'accent':
        return {
          background: 'var(--accent-subtle)',
          border: '1px solid var(--accent-border)',
          boxShadow: 'var(--shadow-card)',
        }
      case 'default':
      default:
        return {
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-card)',
        }
    }
  }

  return (
    <motion.div
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        ...getVariantStyles(),
        ...style,
      }}
      whileHover={
        interactive
          ? {
              y: -2,
              boxShadow: 'var(--shadow-card-hover)',
              borderColor: 'var(--accent-border)',
              transition: springs.snappy,
            }
          : undefined
      }
      whileTap={
        interactive
          ? {
              scale: 0.985,
              transition: springs.snappy,
            }
          : undefined
      }
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}
