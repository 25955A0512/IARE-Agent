/**
 * IARE Agent — Apple/macOS-Inspired Design System Tokens
 * 
 * Visual Language:
 * - Soft depth through multi-layer shadows
 * - Frosted-glass translucency (vibrancy/blur)
 * - System-native typography scale (SF Pro / System font stack)
 * - Spring-physics motion curves
 * - Restrained, purposeful Apple System Blue accent
 */

export const colors = {
  // Apple System Accent Family (Default: Refined Apple System Blue)
  accent: {
    base: '#0A84FF',
    light: '#0071E3',
    hover: '#0077ED',
    subtle: 'rgba(10, 132, 255, 0.12)',
    subtleBorder: 'rgba(10, 132, 255, 0.25)',
    gradient: 'linear-gradient(135deg, #0A84FF 0%, #0066CC 100%)',
    gradientLight: 'linear-gradient(135deg, #0071E3 0%, #0A84FF 100%)',
  },

  // Light Mode Palette (Clean macOS Canvas & Glass)
  light: {
    bgPage: '#F5F5F7',
    bgPageMesh: 'radial-gradient(at 10% 10%, rgba(10, 132, 255, 0.05) 0px, transparent 50%), radial-gradient(at 90% 90%, rgba(52, 199, 89, 0.04) 0px, transparent 50%), #F5F5F7',
    bgSidebar: 'rgba(255, 255, 255, 0.72)',
    bgCard: 'rgba(255, 255, 255, 0.82)',
    bgCardElevated: '#FFFFFF',
    bgCardHover: 'rgba(255, 255, 255, 0.95)',
    bgGlass: 'rgba(255, 255, 255, 0.75)',
    bgInput: 'rgba(0, 0, 0, 0.04)',
    bgInputFocus: '#FFFFFF',
    bgSegment: 'rgba(0, 0, 0, 0.06)',
    bgSegmentPill: '#FFFFFF',
    bgBadge: 'rgba(0, 0, 0, 0.05)',
    bgSunken: 'rgba(0, 0, 0, 0.02)',
    borderSubtle: 'rgba(0, 0, 0, 0.08)',
    borderCard: 'rgba(0, 0, 0, 0.06)',
    borderInput: 'rgba(0, 0, 0, 0.12)',
    borderGlass: 'rgba(255, 255, 255, 0.6)',
    textPrimary: '#1D1D1F',
    textSecondary: '#6E6E73',
    textMuted: '#86868B',
    textDim: '#A1A1A6',
    bubbleUser: '#0071E3',
    bubbleUserText: '#FFFFFF',
    bubbleAgent: 'rgba(255, 255, 255, 0.85)',
    bubbleAgentText: '#1D1D1F',
    bubbleAgentBorder: 'rgba(0, 0, 0, 0.06)',
  },

  // Dark Mode Palette (Deep Obsidian & Translucent Slate)
  dark: {
    bgPage: '#0A0D14',
    bgPageMesh: 'radial-gradient(at 10% 10%, rgba(10, 132, 255, 0.08) 0px, transparent 50%), radial-gradient(at 90% 90%, rgba(48, 209, 88, 0.05) 0px, transparent 50%), #0A0D14',
    bgSidebar: 'rgba(18, 22, 32, 0.75)',
    bgCard: 'rgba(26, 32, 46, 0.65)',
    bgCardElevated: 'rgba(32, 40, 58, 0.85)',
    bgCardHover: 'rgba(36, 45, 66, 0.85)',
    bgGlass: 'rgba(20, 26, 38, 0.75)',
    bgInput: 'rgba(255, 255, 255, 0.06)',
    bgInputFocus: 'rgba(255, 255, 255, 0.1)',
    bgSegment: 'rgba(255, 255, 255, 0.08)',
    bgSegmentPill: 'rgba(255, 255, 255, 0.18)',
    bgBadge: 'rgba(255, 255, 255, 0.08)',
    bgSunken: 'rgba(0, 0, 0, 0.3)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderCard: 'rgba(255, 255, 255, 0.09)',
    borderInput: 'rgba(255, 255, 255, 0.14)',
    borderGlass: 'rgba(255, 255, 255, 0.12)',
    textPrimary: '#F5F5F7',
    textSecondary: '#A1A1A6',
    textMuted: '#86868B',
    textDim: '#6E6E73',
    bubbleUser: '#0A84FF',
    bubbleUserText: '#FFFFFF',
    bubbleAgent: 'rgba(26, 32, 46, 0.85)',
    bubbleAgentText: '#F5F5F7',
    bubbleAgentBorder: 'rgba(255, 255, 255, 0.08)',
  },

  // Semantic Colors (Apple System Functional Colors)
  semantic: {
    success: '#34C759',
    successBg: 'rgba(52, 199, 89, 0.12)',
    successText: '#248A3D',
    warning: '#FF9500',
    warningBg: 'rgba(255, 149, 0, 0.12)',
    warningText: '#B26B00',
    error: '#FF3B30',
    errorBg: 'rgba(255, 59, 48, 0.12)',
    errorText: '#D70015',
    info: '#0A84FF',
    infoBg: 'rgba(10, 132, 255, 0.12)',
    indigo: '#5E5CE6',
    teal: '#64D2FF',
  }
} as const

// System-Native Typography Stack
export const font = {
  family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", "Menlo", "Monaco", "Consolas", monospace',
  
  // Scale
  scale: {
    display: { size: '2rem', lineHeight: '2.5rem', weight: '700', tracking: '-0.03em' },
    titleLarge: { size: '1.5rem', lineHeight: '1.875rem', weight: '700', tracking: '-0.025em' },
    titleMedium: { size: '1.125rem', lineHeight: '1.5rem', weight: '600', tracking: '-0.015em' },
    titleSmall: { size: '1rem', lineHeight: '1.375rem', weight: '600', tracking: '-0.01em' },
    body: { size: '0.875rem', lineHeight: '1.375rem', weight: '400', tracking: '-0.005em' },
    bodySmall: { size: '0.8125rem', lineHeight: '1.25rem', weight: '400', tracking: '0' },
    caption: { size: '0.71875rem', lineHeight: '1rem', weight: '500', tracking: '0.01em' },
    captionSmall: { size: '0.65625rem', lineHeight: '0.875rem', weight: '600', tracking: '0.03em' },
  }
} as const

// 8px-based Spacing Scale
export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const

// Consistently Rounded Apple Corner Radius Scale (12-24px)
export const radius = {
  xs: '8px',
  sm: '10px',
  md: '14px',
  lg: '18px',
  xl: '22px',
  '2xl': '26px',
  '3xl': '32px',
  full: '9999px',
} as const

// Soft Multi-Layer Elevation Shadows (Apple macOS/iOS style)
export const shadow = {
  subtle: '0 1px 2px rgba(0, 0, 0, 0.03)',
  card: '0 2px 8px -2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
  cardHover: '0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
  elevated: '0 12px 32px -6px rgba(0, 0, 0, 0.1), 0 4px 12px -2px rgba(0, 0, 0, 0.05)',
  modal: '0 24px 60px -12px rgba(0, 0, 0, 0.22), 0 8px 24px -4px rgba(0, 0, 0, 0.1)',
  popover: '0 16px 40px -8px rgba(0, 0, 0, 0.18)',
  accentGlow: '0 8px 20px -4px rgba(10, 132, 255, 0.35)',
} as const

// Framer Motion Spring Presets (Apple-like spring physics)
export const springs = {
  // Snappy, responsive feel for buttons, toggles, chips
  snappy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 30,
    mass: 0.8,
  },
  // Smooth, elegant feel for modals, sheets, card reveals
  smooth: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 28,
    mass: 0.9,
  },
  // Playful overshoot for alerts, success badges, checkmarks
  bouncy: {
    type: 'spring' as const,
    stiffness: 350,
    damping: 20,
    mass: 0.85,
  },
  // Gentle slide for sidebar indicators and tab highlights
  subtle: {
    type: 'spring' as const,
    stiffness: 450,
    damping: 35,
  },
} as const

export const glass = {
  light: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.45)',
  },
  dark: {
    background: 'rgba(20, 26, 38, 0.72)',
    backdropFilter: 'blur(24px) saturate(190%)',
    WebkitBackdropFilter: 'blur(24px) saturate(190%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
} as const
