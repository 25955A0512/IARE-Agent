import React, { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { login } from '@/services/api'
import { ThemeToggle } from '@/context/ThemeContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Badge } from '@/components/ui/Badge'
import { springs } from '@/tokens'
import { Sparkles, ShieldCheck, Lock, User, AlertCircle, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      console.error('Login error:', err)
      const status = err.response?.status
      let msg =
        err.response?.data?.error ||
        err.response?.data?.message
      
      if (!msg) {
        if (status === 405) {
          msg = 'HTTP 405 Method Not Allowed. Please ensure VITE_API_BASE_URL is set in Vercel to your backend-core URL (https://<backend-core>.onrender.com) and that backend-core is redeployed.'
        } else if (status === 404) {
          msg = 'HTTP 404 Not Found. Please verify that VITE_API_BASE_URL points to the backend-core service (port 8080), not the AI service.'
        } else if (err.code === 'ERR_NETWORK' || !err.response) {
          msg = 'Cannot connect to backend-core. Please ensure backend-core is awake on Render and VITE_API_BASE_URL is configured.'
        } else {
          msg = err.message || 'Login failed. Please verify credentials.'
        }
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* Ambient Moving Gradient Mesh (Apple Style) */}
      <div style={styles.ambientMeshContainer}>
        <div style={styles.ambientBlob1} />
        <div style={styles.ambientBlob2} />
      </div>

      {/* Top Bar with Theme Toggle */}
      <div style={styles.topBar}>
        <ThemeToggle />
      </div>

      {/* Centered Frosted Glass Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={springs.smooth}
        style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 2 }}
      >
        <Card variant="glass" style={styles.card}>
          {/* Logo & Header with Spring Entrance */}
          <div style={styles.header}>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...springs.bouncy, delay: 0.1 }}
              style={styles.logoBadge}
            >
              <img
                src="/iare_logo.png"
                alt="IARE Logo"
                style={styles.logoImg}
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  const fallback = document.getElementById('login-fallback-crest')
                  if (fallback) fallback.style.display = 'block'
                }}
              />
              <span id="login-fallback-crest" style={styles.crest}>🏛</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.snappy, delay: 0.15 }}
              style={{ textAlign: 'center' }}
            >
              <h1 style={styles.title}>IARE Campus Portal</h1>
              <p style={styles.subtitle}>AI Academic & Navigation Workspace</p>
            </motion.div>
          </div>

          {/* Samvidha Notice Box */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.snappy, delay: 0.2 }}
            style={styles.samvidhaNotice}
          >
            <div style={styles.samvidhaIcon}>
              <Sparkles size={16} />
            </div>
            <div style={styles.samvidhaNoticeText}>
              Sign in with your <strong>Roll Number</strong> (e.g. <code>21951A0501</code>) and <strong>Samvidha Password</strong> for live attendance & timetable sync.
            </div>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={styles.form}>
            <TextField
              label="Roll Number / Email"
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="e.g. 21951A0501 or roll@iare.ac.in"
              icon={<User size={16} />}
            />

            <TextField
              label="Samvidha Password"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your Samvidha password"
              icon={<Lock size={16} />}
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={springs.snappy}
                style={styles.errorBox}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </motion.div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              iconRight={<ArrowRight size={16} />}
              style={{ width: '100%', marginTop: '6px' }}
            >
              {loading ? 'Authenticating…' : 'Sign In to Workspace'}
            </Button>
          </form>

          {/* Footer */}
          <div style={styles.footer}>
            <p style={styles.footerText}>
              New to IARE Agent?{' '}
              <Link to="/register" style={styles.link}>
                Create Account
              </Link>
            </p>

            <div style={styles.securedBadge}>
              <Badge variant="neutral" size="sm" icon={<ShieldCheck size={12} />}>
                End-to-End Encrypted • Official IARE System
              </Badge>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-page)',
    padding: '32px 16px',
    position: 'relative',
    overflow: 'hidden',
  },
  ambientMeshContainer: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 0,
  },
  ambientBlob1: {
    position: 'absolute',
    top: '15%',
    left: '25%',
    width: '450px',
    height: '450px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(10, 132, 255, 0.12) 0%, rgba(10, 132, 255, 0) 70%)',
    filter: 'blur(50px)',
    animation: 'ambientGlow 14s ease-in-out infinite',
  },
  ambientBlob2: {
    position: 'absolute',
    bottom: '15%',
    right: '20%',
    width: '480px',
    height: '480px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(52, 199, 89, 0.08) 0%, rgba(52, 199, 89, 0) 70%)',
    filter: 'blur(60px)',
    animation: 'ambientGlow 18s ease-in-out infinite reverse',
  },
  topBar: {
    position: 'absolute',
    top: '20px',
    right: '24px',
    zIndex: 10,
  },
  card: {
    padding: '36px 32px',
    borderRadius: 'var(--radius-2xl)',
    boxShadow: 'var(--shadow-modal)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '22px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoBadge: {
    width: '60px',
    height: '60px',
    borderRadius: 'var(--radius-xl)',
    background: 'var(--bg-glass-strong)',
    border: '1px solid var(--border-glass)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '14px',
    boxShadow: 'var(--shadow-card)',
  },
  logoImg: {
    height: '40px',
    maxWidth: '40px',
    objectFit: 'contain',
  },
  crest: {
    fontSize: '1.85rem',
    display: 'none',
  },
  title: {
    fontSize: '1.45rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.025em',
    marginBottom: '3px',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.84375rem',
    fontWeight: 500,
  },
  samvidhaNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    backgroundColor: 'var(--accent-subtle)',
    border: '1px solid var(--accent-border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    marginBottom: '22px',
  },
  samvidhaIcon: {
    color: 'var(--accent-color)',
    flexShrink: 0,
    marginTop: '2px',
    display: 'flex',
  },
  samvidhaNoticeText: {
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    lineHeight: 1.45,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#FF3B30',
    fontSize: '0.8125rem',
    background: 'rgba(255, 59, 48, 0.1)',
    border: '1px solid rgba(255, 59, 48, 0.25)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    fontWeight: 500,
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  footerText: {
    color: 'var(--text-secondary)',
    fontSize: '0.84375rem',
  },
  link: {
    color: 'var(--accent-color)',
    fontWeight: 600,
  },
  securedBadge: {
    display: 'flex',
    justifyContent: 'center',
  },
}
