import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './services/supabase'
import Login from './pages/Login'
import Layout from './pages/Layout'
import Dashboard from './pages/Dashboard'
import OrgManage from './pages/OrgManage'
import UserManage from './pages/UserManage'
import SemesterManage from './pages/SemesterManage'
import AssessmentManage from './pages/AssessmentManage'
import AttendanceFill from './pages/AttendanceFill'
import DataSummary from './pages/DataSummary'
import WeeklyRanking from './pages/WeeklyRanking'

function App() {
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('email', u.email)
          .maybeSingle()
        setUserRole(data?.role ?? 0)
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>加载中...</div>
  }

  // 路由守卫：非管理员（role!=2）只能访问考勤填报和数据汇总
  const ProtectedRoute = ({ children, path }: { children: React.ReactNode; path: string }) => {
    if (!user) return <Navigate to="/login" replace />
    // 非管理员访问管理页面 → 跳转考勤填报
    if (userRole !== 2 && ['/org', '/user', '/semester', '/assessment', '/ranking'].includes(path)) {
      return <Navigate to="/attendance" replace />
    }
    return <>{children}</>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/attendance" /> : <Login />} />
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<ProtectedRoute path="/"><Dashboard /></ProtectedRoute>} />
        <Route path="org" element={<ProtectedRoute path="/org"><OrgManage /></ProtectedRoute>} />
        <Route path="user" element={<ProtectedRoute path="/user"><UserManage /></ProtectedRoute>} />
        <Route path="semester" element={<ProtectedRoute path="/semester"><SemesterManage /></ProtectedRoute>} />
        <Route path="assessment" element={<ProtectedRoute path="/assessment"><AssessmentManage /></ProtectedRoute>} />
        <Route path="attendance" element={<AttendanceFill />} />
        <Route path="summary" element={<DataSummary />} />
        <Route path="ranking" element={<ProtectedRoute path="/ranking"><WeeklyRanking /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}

export default App
