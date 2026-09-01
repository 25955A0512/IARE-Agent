import React from 'react'
import { motion } from 'framer-motion'
import { springs } from '@/tokens'

export interface SegmentOption<T extends string = string> {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  name?: string
  fullWidth?: boolean
  style?: React.CSSProperties
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  name = 'segmented-pill',
  fullWidth = false,
  style,
}: SegmentedControlProps<T>) {
  const isSm = size === 'sm'

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg-segment)',
        padding: isSm ? '2px' : '3px',
        borderRadius: isSm ? 'var(--radius-sm)' : 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        width: fullWidth ? '100%' : 'auto',
        position: 'relative',
        userSelect: 'none',
        ...style,
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              position: 'relative',
              flex: fullWidth ? 1 : 'initial',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: isSm ? '4px 10px' : '6px 14px',
              fontSize: isSm ? '0.78125rem' : '0.84375rem',
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              borderRadius: isSm ? 'var(--radius-xs)' : 'var(--radius-sm)',
              zIndex: 1,
              transition: 'color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {isSelected && (
              <motion.div
                layoutId={`segmented-active-${name}`}
                transition={springs.snappy}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--bg-segment-pill)',
                  borderRadius: isSm ? 'var(--radius-xs)' : 'var(--radius-sm)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
                  zIndex: -1,
                }}
              />
            )}
            {opt.icon && <span style={{ display: 'inline-flex', fontSize: '1em' }}>{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
