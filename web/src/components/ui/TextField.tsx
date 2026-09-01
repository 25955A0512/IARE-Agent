import React from 'react'

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  hint,
  error,
  icon,
  iconRight,
  style,
  id,
  ...props
}) => {
  const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label
            htmlFor={generatedId}
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {label}
          </label>
          {hint && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</span>}
        </div>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {icon && (
          <div
            style={{
              position: 'absolute',
              left: '12px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            {icon}
          </div>
        )}

        <input
          id={generatedId}
          style={{
            width: '100%',
            background: 'var(--bg-input)',
            border: `1px solid ${error ? 'var(--semantic-error, #FF3B30)' : 'var(--border-input)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            padding: `10px ${iconRight ? '36px' : '14px'} 10px ${icon ? '36px' : '14px'}`,
            fontSize: '0.90625rem',
            outline: 'none',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-subtle)',
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-color)'
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-subtle)'
            e.currentTarget.style.background = 'var(--bg-input-focus)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? '#FF3B30' : 'var(--border-input)'
            e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'
            e.currentTarget.style.background = 'var(--bg-input)'
          }}
          {...props}
        />

        {iconRight && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {iconRight}
          </div>
        )}
      </div>

      {error && (
        <span style={{ fontSize: '0.75rem', color: '#FF3B30', fontWeight: 500, marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  )
}
