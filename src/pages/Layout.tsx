import { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Dropdown, Modal, Form, Input, Button, message } from 'antd'
import type { MenuProps } from 'antd'
import { SettingOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  ApartmentOutlined,
  TeamOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  FormOutlined,
  BarChartOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { supabase } from '../services/supabase'

const { Header, Sider, Content } = Layout

function LayoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<number>(0)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('email', user.email)
          .single()
        if (data) {
          setUserProfile(data)
          setUserRole(data.role)
          form.setFieldsValue({ name: data.name, phone: data.phone || '', job_title: data.job_title || '' })
        }
      }
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    message.success('已退出登录')
    navigate('/login')
  }

  const handleSaveProfile = async (values: { name: string; phone: string; job_title: string }) => {
    if (!userProfile) return
    setSavingProfile(true)
    const { error } = await supabase
      .from('users')
      .update({ name: values.name, phone: values.phone || null, job_title: values.job_title || null })
      .eq('id', userProfile.id)
    setSavingProfile(false)
    if (error) {
      message.error('保存失败: ' + error.message)
    } else {
      message.success('保存成功')
      setUserProfile((prev: any) => ({ ...prev, ...values }))
    }
  }

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string }) => {
    if (!user) return
    setSavingPassword(true)
    // 先用旧密码尝试登录验证
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: values.oldPassword,
    })
    if (signInError) {
      message.error('原密码错误')
      setSavingPassword(false)
      return
    }
    // 原密码正确，更新新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: values.newPassword,
    })
    setSavingPassword(false)
    if (updateError) {
      message.error('修改失败: ' + updateError.message)
    } else {
      message.success('密码修改成功')
      passwordForm.resetFields()
    }
  }

  const allMenuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '首页' },
    { key: '/org', icon: <ApartmentOutlined />, label: '组织管理' },
    { key: '/user', icon: <TeamOutlined />, label: '人员管理' },
    { key: '/semester', icon: <CalendarOutlined />, label: '学期管理' },
    { key: '/assessment', icon: <CheckSquareOutlined />, label: '考核项目' },
    { key: '/attendance', icon: <FormOutlined />, label: '考勤填报' },
    { key: '/summary', icon: <BarChartOutlined />, label: '数据汇总' },
    { key: '/ranking', icon: <TrophyOutlined />, label: '班级榜单' },
  ]

  // 非管理员（role!=2）只能看考勤填报和数据汇总
  const menuItems = userRole === 2
    ? allMenuItems
    : allMenuItems.filter((m) => ['/attendance', '/summary'].includes(m.key))

  const userMenuItems: NonNullable<MenuProps['items']>[number][] = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '个人设置',
      onClick: () => setSettingsVisible(true),
    },
    { type: 'divider' as const },
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
          督察管理系统
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

      <Modal
        title="个人设置"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={null}
        width={480}
      >
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16, color: '#666', fontSize: 13 }}>
            <strong>账号：</strong>{user?.email}
          </div>
          <Form form={form} layout="vertical" onFinish={handleSaveProfile} style={{ marginBottom: 32 }}>
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item name="phone" label="手机号">
              <Input placeholder="请输入手机号" />
            </Form.Item>
            <Form.Item name="job_title" label="职位">
              <Input placeholder="请输入职位" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={savingProfile}>
              保存信息
            </Button>
          </Form>

          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
            <div style={{ marginBottom: 12, fontWeight: 500 }}>修改密码</div>
            <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
              <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
                <Input.Password placeholder="请输入原密码" />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码至少6位' },
                ]}
              >
                <Input.Password placeholder="请输入新密码（至少6位）" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('两次密码不一致'))
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="请再次输入新密码" />
              </Form.Item>
              <Button htmlType="submit" loading={savingPassword}>
                修改密码
              </Button>
            </Form>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}

export default LayoutPage
