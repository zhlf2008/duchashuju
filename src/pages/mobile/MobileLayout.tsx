import { useState } from 'react'
import { Layout, Avatar, Dropdown } from 'antd'
import { FormOutlined, HistoryOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { message } from 'antd'

const { Header, Content } = Layout

interface MobileLayoutProps {
  userOrgId?: number | null
}

function MobileLayout({ userOrgId: _userOrgId }: MobileLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    message.success('已退出登录')
    navigate('/login')
  }

  const menuItems = [
    { key: '/mobile/fill', icon: <FormOutlined />, label: '考勤填报' },
    { key: '/mobile/history', icon: <HistoryOutlined />, label: '填报历史' },
    { key: '/mobile/settings', icon: <SettingOutlined />, label: '个人设置' },
  ]

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header style={{
        background: '#fff',
        padding: '0 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #f0f0f0',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>考勤填报</div>
        <Dropdown
          menu={{ items: userMenuItems, onClick: ({ key }) => key === 'logout' && handleLogout() }}
          placement="bottomRight"
        >
          <Avatar size={36} style={{ cursor: 'pointer', background: '#1890ff' }}>
            {loggingOut ? '...' : '用'}
          </Avatar>
        </Dropdown>
      </Header>

      <Content style={{ padding: '12px', minHeight: 'calc(100vh - 64px)' }}>
        <Outlet />
      </Content>

      {/* 底部固定 TabBar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        zIndex: 10,
      }}>
        {menuItems.map((item) => {
          const active = location.pathname === item.key
          return (
            <div
              key={item.key}
              onClick={() => navigate(item.key)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 0',
                cursor: 'pointer',
                color: active ? '#1890ff' : '#999',
                fontSize: 11,
                gap: 2,
              }}
            >
              <div style={{ fontSize: 20 }}>{item.icon}</div>
              <span>{item.label}</span>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}

export default MobileLayout