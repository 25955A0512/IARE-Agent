import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ChatPage from '@/pages/ChatPage'
import { isLoggedIn } from '@/services/api'

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/chat"     element={<RequireAuth><ChatPage /></RequireAuth>} />
          <Route path="*"         element={<Navigate to={isLoggedIn() ? '/chat' : '/login'} replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
