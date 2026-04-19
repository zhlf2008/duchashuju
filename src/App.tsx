import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './services/supabase'
import Login from './pages/Login'
import Layout from './pages/Layout'
import Dashboard from './pages/Dashboard'
import AreaManage from './pages/AreaManage'
import OrgManage from './pages/OrgManage'
import UserManage from './pages/UserManage'
import SemesterManage from './pages/SemesterManage'
import AssessmentManage from './pages/AssessmentManage'
import AttendanceFill from './pages/AttendanceFill'
import DataSummary from './pages/DataSummary'
import WeeklyRanking from './pages/WeeklyRanking'

function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>加载中...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="area" element={<AreaManage />} />
        <Route path="org" element={<OrgManage />} />
        <Route path="user" element={<UserManage />} />
        <Route path="semester" element={<SemesterManage />} />
        <Route path="assessment" element={<AssessmentManage />} />
        <Route path="attendance" element={<AttendanceFill />} />
        <Route path="summary" element={<DataSummary />} />
        <Route path="ranking" element={<WeeklyRanking />} />
      </Route>
    </Routes>
  )
}

export default App
