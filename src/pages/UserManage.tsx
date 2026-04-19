import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Space, Typography, Card } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import type { User, Org } from '../types'

const { Title, Text } = Typography

function UserManage() {
  const [data, setData] = useState<User[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [batchText, setBatchText] = useState('')

  useEffect(() => {
    fetchData()
    fetchOrgs()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('id')
    if (!error) setData(data)
    setLoading(false)
  }

  const fetchOrgs = async () => {
    const { data } = await supabase
      .from('org')
      .select('*, area:area_id(area_name)')
      .order('id')
    if (data) setOrgs(data)
  }

  const handleAdd = async (values: { name: string; email: string; phone?: string; job_title?: string; org_id: number; role: number }) => {
    const { error } = await supabase.from('users').insert([values])
    if (error) {
      message.error('添加失败: ' + error.message)
    } else {
      message.success('添加成功')
      setModalVisible(false)
      form.resetFields()
      fetchData()
    }
  }

  const handleEdit = async (values: { name: string; email: string; phone?: string; job_title?: string; org_id: number; role: number }) => {
    if (!editingId) return
    const { error } = await supabase.from('users').update(values).eq('id', editingId)
    if (error) {
      message.error('修改失败: ' + error.message)
    } else {
      message.success('修改成功')
      setModalVisible(false)
      setEditingId(null)
      form.resetFields()
      fetchData()
    }
  }

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) {
      message.error('删除失败: ' + error.message)
    } else {
      message.success('删除成功')
      fetchData()
    }
  }

  const handleBatchImport = async () => {
    if (!batchText.trim()) {
      message.warning('请输入要导入的数据')
      return
    }

    const lines = batchText.trim().split('\n')
    const users: any[] = []
    const errors: string[] = []

    lines.forEach((line, index) => {
      const parts = line.split('\t').map((p) => p.trim())
      if (parts.length < 4) {
        errors.push(`第 ${index + 1} 行格式错误：需要至少4列（姓名、邮箱、手机号、组织ID、角色）`)
        return
      }

      const [name, email, phone, orgIdStr, roleStr] = parts
      const orgId = parseInt(orgIdStr)
      const role = parseInt(roleStr) || 0

      if (!name || !email) {
        errors.push(`第 ${index + 1} 行：姓名和邮箱不能为空`)
        return
      }

      if (isNaN(orgId)) {
        errors.push(`第 ${index + 1} 行：组织ID必须是数字`)
        return
      }

      users.push({ name, email, phone, org_id: orgId, role })
    })

    if (errors.length > 0) {
      message.error(errors.slice(0, 3).join('\n'))
      return
    }

    const { error } = await supabase.from('users').insert(users)
    if (error) {
      message.error('批量导入失败: ' + error.message)
    } else {
      message.success(`成功导入 ${users.length} 条记录`)
      setBatchModalVisible(false)
      setBatchText('')
      fetchData()
    }
  }

  const downloadTemplate = () => {
    const template = '姓名\t邮箱\t手机号\t组织ID\t角色\n张三\tzhangsan@example.com\t13800138000\t1\t0'
    const blob = new Blob([template], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '人员导入模板.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const getOrgName = (orgId: number) => {
    const org = orgs.find((o) => o.id === orgId)
    if (!org) return '-'
    return `${org.area?.area_name || ''} → ${org.big_class} → ${org.class_name} → ${org.group_name}`
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '邮箱', dataIndex: 'email', width: 180 },
    { title: '手机号', dataIndex: 'phone', width: 120 },
    { title: '职务', dataIndex: 'job_title', width: 80 },
    { title: '所属组织', dataIndex: 'org_id', width: 250, render: (orgId: number) => getOrgName(orgId) },
    {
      title: '角色',
      dataIndex: 'role',
      width: 80,
      render: (role: number) => role === 2 ? '管理员' : role === 1 ? '填报人' : '成员'
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, record: User) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingId(record.id); form.setFieldsValue(record); setModalVisible(true) }} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>人员管理</Title>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setBatchModalVisible(true)}>批量导入</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); form.resetFields(); setModalVisible(true) }}>新增人员</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
      />

      <Modal title={editingId ? '编辑人员' : '新增人员'} open={modalVisible} onCancel={() => { setModalVisible(false); setEditingId(null); form.resetFields() }} onOk={() => form.submit()} width={500}>
        <Form form={form} onFinish={editingId ? handleEdit : handleAdd} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效邮箱' }]}>
            <Input placeholder="用于登录的邮箱" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="手机号（可选）" />
          </Form.Item>
          <Form.Item name="job_title" label="职务">
            <Input placeholder="职务（可选）" />
          </Form.Item>
          <Form.Item name="org_id" label="所属组织" rules={[{ required: true, message: '请选择所属组织' }]}>
            <Select placeholder="请选择组织">
              {orgs.map((org) => (
                <Select.Option key={org.id} value={org.id}>
                  {org.area?.area_name} → {org.big_class} → {org.class_name} → {org.group_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="请选择角色">
              <Select.Option value={0}>成员</Select.Option>
              <Select.Option value={1}>填报人</Select.Option>
              <Select.Option value={2}>管理员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="批量导入人员" open={batchModalVisible} onCancel={() => { setBatchModalVisible(false); setBatchText('') }} onOk={handleBatchImport} width={700}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} onClick={downloadTemplate}>下载模板</Button>,
          <Button key="cancel" onClick={() => setBatchModalVisible(false)}>取消</Button>,
          <Button key="import" type="primary" onClick={handleBatchImport}>导入</Button>
        ]}
      >
        <Card size="small" style={{ marginBottom: 16 }}>
          <Text type="secondary">格式说明：每行一条记录，列之间用 Tab 分隔。格式：姓名、邮箱、手机号、组织ID、角色（0=成员，1=填报人，2=管理员）</Text>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">示例：</Text>
            <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
姓名	邮箱	手机号	组织ID	角色
张三	zhangsan@example.com	13800138000	1	0
李四	lisi@example.com	13900139000	2	1
            </pre>
          </div>
        </Card>
        <Input.TextArea rows={10} value={batchText} onChange={(e) => setBatchText(e.target.value)} placeholder="请粘贴 Excel 数据（每行一条记录，Tab 分隔列）" />
      </Modal>
    </div>
  )
}

export default UserManage
