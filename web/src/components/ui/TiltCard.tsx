import React, { useRef, useState, MouseEvent } from 'react'
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion'

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  intensity?: number
  enableGlare?: boolean
  onClick?: () => void
}

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  style = {},
  intensity = 12,
  enableGlare = true,
  onClick,
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  // Motion values for smooth 3D tilt
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Smooth spring physics for natural settling
  const springConfig = { damping: 20, stiffness: 260, mass: 0.6 }
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [intensity, -intensity]), springConfig)
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-intensity, intensity]), springConfig)
  const scale = useSpring(isHovered ? 1.015 : 1, springConfig)

  // Glare position
  const glareX = useTransform(x, [-0.5, 0.5], ['0%', '100%'])
  const glareY = useTransform(y, [-0.5, 0.5], ['0%', '100%'])

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Normalize from -0.5 to 0.5
    const xPct = mouseX / width - 0.5
    const yPct = mouseY / height - 0.5

    x.set(xPct)
    y.set(yPct)
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        perspective: 1200,
        transformStyle: 'preserve-3d',
        rotateX,
        rotateY,
        scale,
        position: 'relative',
        borderRadius: 'var(--radius-lg, 18px)',
        background: 'var(--bg-card, rgba(26, 32, 46, 0.72))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border-card, rgba(255, 255, 255, 0.08))',
        boxShadow: isHovered
          ? '0 20px 40px -15px rgba(0, 0, 0, 0.35), 0 0 20px 2px var(--accent-subtle, rgba(10, 132, 255, 0.12))'
          : '0 8px 24px -12px rgba(0, 0, 0, 0.25)',
        transition: 'box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        ...style,
      }}
      className={`bento-tilt-card ${className}`}
      {...(rest as any)}
    >
      {/* Glare sheen */}
      {enableGlare && isHovered && (
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 1,
            borderRadius: 'inherit',
            background: `radial-gradient(circle 320px at ${glareX.get()} ${glareY.get()}, rgba(255, 255, 255, 0.08), transparent 70%)`,
          }}
        />
      )}

      {/* Content wrapper with depth preservation */}
      <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
        {children}
      </div>
    </motion.div>
  )
}
