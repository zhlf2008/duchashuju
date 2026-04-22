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
import MobileLayout from './pages/mobile/MobileLayout'
import MobileFill from './pages/mobile/MobileFill'
import MobileHistory from './pages/mobile/MobileHistory'
import MobileSettings from './pages/mobile/MobileSettings'

function App() {
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<number>(0)
  const [userOrgId, setUserOrgId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const { data } = await supabase
          .from('users')
          .select('role, org_id')
          .eq('email', u.email)
          .maybeSingle()
        setUserRole(data?.role ?? 0)
        setUserOrgId(data?.org_id ?? null)
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>加载中...</div>
  }

  // 管理员专属路由守卫
  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) return <Navigate to="/login" replace />
    if (userRole !== 2) return <Navigate to="/mobile/fill" replace />
    return <>{children}</>
  }

  // 手机端路由守卫（非管理员专属）
  const MobileRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) return <Navigate to="/login" replace />
    if (userRole === 2) return <Navigate to="/" replace />
    return <>{children}</>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={userRole === 2 ? '/' : '/mobile/fill'} /> : <Login />} />

      {/* 管理后台（仅管理员可访问） */}
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="org" element={<AdminRoute><OrgManage /></AdminRoute>} />
        <Route path="user" element={<AdminRoute><UserManage /></AdminRoute>} />
        <Route path="semester" element={<AdminRoute><SemesterManage /></AdminRoute>} />
        <Route path="assessment" element={<AdminRoute><AssessmentManage /></AdminRoute>} />
        <Route path="attendance" element={<AdminRoute><AttendanceFill /></AdminRoute>} />
        <Route path="summary" element={<AdminRoute><DataSummary /></AdminRoute>} />
        <Route path="ranking" element={<AdminRoute><WeeklyRanking /></AdminRoute>} />
      </Route>

      {/* 手机端页面（非管理员专属） */}
      <Route path="/mobile" element={<MobileRoute><MobileLayout userOrgId={userOrgId} /></MobileRoute>}>
        <Route index element={<Navigate to="/mobile/fill" />} />
        <Route path="fill" element={<MobileFill userOrgId={userOrgId} />} />
        <Route path="history" element={<MobileHistory userOrgId={userOrgId} />} />
        <Route path="settings" element={<MobileSettings />} />
      </Route>
    </Routes>
  )
}

export default App