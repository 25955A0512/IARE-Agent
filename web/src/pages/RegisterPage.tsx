import React, { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { register } from '@/services/api'
import { ThemeToggle } from '@/context/ThemeContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { springs } from '@/tokens'
import { User, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(fullName, email, password)
      navigate('/dashboard')
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (err.code === 'ERR_NETWORK' || !err.response
          ? 'Cannot connect to backend-core (:8080). Please ensure the backend server is running.'
          : err.message || 'Registration failed. Please try again.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* Ambient Moving Gradient Mesh */}
      <div style={styles.ambientMeshContainer}>
        <div style={styles.ambientBlob1} />
        <div style={styles.ambientBlob2} />
      </div>

      <div style={styles.topBar}>
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={springs.smooth}
        style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 2 }}
      >
        <Card variant="glass" style={styles.card}>
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
                  const fallback = document.getElementById('reg-fallback-crest')
                  if (fallback) fallback.style.display = 'block'
                }}
              />
              <span id="reg-fallback-crest" style={styles.crest}>🏛</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.snappy, delay: 0.15 }}
              style={{ textAlign: 'center' }}
            >
              <h1 style={styles.title}>Create Account</h1>
              <p style={styles.subtitle}>Join IARE AI Student Workspace</p>
            </motion.div>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <TextField
              label="Full Name"
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              placeholder="e.g. Rahul Sharma"
              icon={<User size={16} />}
            />

            <TextField
              label="Roll Number / Email"
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="e.g. 21951A0501 or roll@iare.ac.in"
              icon={<Mail size={16} />}
            />

            <TextField
              label="Password"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
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
              {loading ? 'Creating Account…' : 'Create Student Account'}
            </Button>
          </form>

          <div style={styles.footer}>
            <p style={styles.footerText}>
              Already have an account?{' '}
              <Link to="/login" style={styles.link}>
                Sign in
              </Link>
            </p>
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
  },
  footerText: {
    color: 'var(--text-secondary)',
    fontSize: '0.84375rem',
  },
  link: {
    color: 'var(--accent-color)',
    fontWeight: 600,
  },
}
