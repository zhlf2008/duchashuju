import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, message } from 'antd'
import { supabase } from '../../services/supabase'

function MobileSettings() {
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', user?.email)
        .maybeSingle()
      if (data) {
        form.setFieldsValue({ name: data.name, phone: data.phone || '', job_title: data.job_title || '' })
      }
    }
    getUser()
  }, [])

  const handleSaveProfile = async (values: { name: string; phone: string; job_title: string }) => {
    setSavingProfile(true)
    const { error } = await supabase
      .from('users')
      .update({ name: values.name, phone: values.phone || null, job_title: values.job_title || null })
      .eq('email', user?.email)
    setSavingProfile(false)
    if (error) message.error('保存失败: ' + error.message)
    else message.success('保存成功')
  }

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string }) => {
    setSavingPassword(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email,
      password: values.oldPassword,
    })
    if (signInError) {
      message.error('原密码错误')
      setSavingPassword(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: values.newPassword })
    setSavingPassword(false)
    if (error) message.error('修改失败: ' + error.message)
    else {
      message.success('密码修改成功')
      passwordForm.resetFields()
    }
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <Card title="个人信息" size="small" style={{ marginBottom: 12 }}>
        <Form form={form} layout="vertical" onFinish={handleSaveProfile}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="手机号" />
          </Form.Item>
          <Form.Item name="job_title" label="职位">
            <Input placeholder="职位" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={savingProfile} block>
            保存信息
          </Button>
        </Form>
      </Card>

      <Card title="修改密码" size="small">
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password placeholder="新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                  return Promise.reject(new Error('两次密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
          <Button htmlType="submit" loading={savingPassword} block>
            修改密码
          </Button>
        </Form>
      </Card>
    </div>
  )
}

export default MobileSettings