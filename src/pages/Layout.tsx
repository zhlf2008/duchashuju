import { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Dropdown, message } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  EnvironmentOutlined,
  ApartmentOutlined,
  TeamOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  FormOutlined,
  BarChartOutlined,
  TrophyOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { supabase } from '../services/supabase'

const { Header, Sider, Content } = Layout

function LayoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<number>(0)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('email', user.email)
          .single()
        if (data) setUserRole(data.role)
      }
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    message.success('已退出登录')
    navigate('/login')
  }

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '首页' },
    { key: '/area', icon: <EnvironmentOutlined />, label: '地区管理' },
    { key: '/org', icon: <ApartmentOutlined />, label: '组织管理' },
    { key: '/user', icon: <TeamOutlined />, label: '人员管理' },
    { key: '/semester', icon: <CalendarOutlined />, label: '学期管理' },
    { key: '/assessment', icon: <CheckSquareOutlined />, label: '考核项目管理' },
    { key: '/attendance', icon: <FormOutlined />, label: '考勤填报' },
    { key: '/summary', icon: <BarChartOutlined />, label: '数据汇总' },
    { key: '/ranking', icon: <TrophyOutlined />, label: '周排名' },
  ]

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        breakpoint="lg"
        collapsedWidth="0"
        onBreakpoint={(broken) => console.log(broken)}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold'
        }}>
          考勤督察系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Dropdown menu={{ items: userMenuItems, onClick: ({ key }) => key === 'logout' && handleLogout() }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <span>{user?.email || '用户'}</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                {userRole === 2 ? '管理员' : userRole === 1 ? '填报人' : '成员'}
              </span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, background: '#fff', padding: 24, borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default LayoutPage
