import { useState } from 'react'
import { Form, Input, Button, Card, message, Tabs } from 'antd'
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'

function Login() {
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { phone: string; password: string }) => {
    setLoading(true)
    try {
      // 通过手机号查到用户的 email
      const { data: userRecord, error: findError } = await supabase
        .from('users')
        .select('email')
        .eq('phone', values.phone)
        .maybeSingle()
      if (findError || !userRecord) {
        message.error('该手机号未注册')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: userRecord.email,
        password: values.password,
      })
      if (error) throw error
      message.success('登录成功')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('email', user.email)
          .maybeSingle()
        window.location.href = profile?.role === 2 ? '/' : '/attendance'
      } else {
        window.location.href = '/'
      }
    } catch (error: any) {
      message.error(error.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async (values: { name: string; phone: string; password: string }) => {
    setLoading(true)
    try {
      // 注册时同时创建 users 记录
      const email = `${values.phone}@phone.local`
      const { error } = await supabase.auth.signUp({
        email,
        password: values.password,
        options: { data: { name: values.name } }
      })
      if (error) throw error
      // 插入 users 表（auth trigger 会自动创建一条，这里再插入一条确保有记录）
      const { error: insertError } = await supabase.from('users').insert([{
        name: values.name,
        email,
        phone: values.phone,
        role: 0,
      }])
      if (insertError) console.error('users insert error:', insertError)
      message.success('注册成功，请登录')
    } catch (error: any) {
      message.error(error.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card style={{ width: 400 }}>
        <h1 style={{ textAlign: 'center', marginBottom: 24 }}>阳明心学考勤督察系统</h1>
        <Tabs
          defaultActiveKey="login"
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form name="login" onFinish={onFinish} autoComplete="off">
                  <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
                    <Input prefix={<PhoneOutlined />} placeholder="手机号" size="large" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} block size="large">
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form name="register" onFinish={onRegister} autoComplete="off">
                  <Form.Item name="name" rules={[{ required: true, message: '请输入姓名' }]}>
                    <Input prefix={<UserOutlined />} placeholder="姓名" size="large" />
                  </Form.Item>
                  <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
                    <Input prefix={<PhoneOutlined />} placeholder="手机号" size="large" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码（至少6位）" size="large" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} block size="large">
                      注册
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

export default Login