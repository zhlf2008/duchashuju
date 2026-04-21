import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Space, Typography, Card, Cascader } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { supabase, supabaseAdmin } from '../services/supabase'
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
  // 编辑时级联选择器的回显值
  const [editingOrgPath, setEditingOrgPath] = useState<string[]>([])

  // 级联选择器选项
  const [orgCascaderOptions, setOrgCascaderOptions] = useState<any[]>([])

  useEffect(() => {
    const options: any[] = []
    orgs.forEach((org) => {
      const areaVal = `${org.area_id}-${org.area?.area_name}`
      const bcVal = `${org.big_class}`
      const classVal = `${org.class_name}`
      const groupVal = `${org.id}`

      let areaNode = options.find((n) => n.value === areaVal)
      if (!areaNode) {
        areaNode = { value: areaVal, label: org.area?.area_name || '', children: [] }
        options.push(areaNode)
      }
      let bcNode = areaNode.children.find((n: any) => n.value === `${areaVal}-${bcVal}`)
      if (!bcNode) {
        bcNode = { value: `${areaVal}-${bcVal}`, label: bcVal, children: [] }
        areaNode.children.push(bcNode)
      }
      let classNode = bcNode.children.find((n: any) => n.value === `${areaVal}-${bcVal}-${classVal}`)
      if (!classNode) {
        classNode = { value: `${areaVal}-${bcVal}-${classVal}`, label: classVal, children: [] }
        bcNode.children.push(classNode)
      }
      classNode.children.push({ value: groupVal, label: org.group_name })
    })
    setOrgCascaderOptions(options)
  }, [orgs])

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

  // 创建 auth 账号（密码=手机号后6位），返回 auth user email
  const createAuthUser = async (phone: string): Promise<string | null> => {
    if (!supabaseAdmin) {
      console.warn('supabaseAdmin not configured, skipping auth creation')
      return `manual_${Date.now()}@placeholder.local`
    }
    const password = phone.slice(-6)
    const email = `${phone}@phone.local`
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) {
      console.error('createAuthUser error:', error)
      return null
    }
    return email
  }

  const handleAdd = async (values: { name: string; phone: string; job_title?: string; org_id: number; role: number }) => {
    const email = await createAuthUser(values.phone)
    if (!email) {
      message.error('添加失败：无法创建登录账号（请检查 SERVICE_KEY 配置）')
      return
    }
    const { error } = await supabase.from('users').insert([{
      name: values.name,
      email,
      phone: values.phone,
      job_title: values.job_title || null,
      org_id: values.org_id,
      role: values.role,
    }])
    if (error) {
      message.error('添加失败: ' + error.message)
    } else {
      message.success('添加成功')
      setModalVisible(false)
      form.resetFields()
      fetchData()
    }
  }

  const handleEdit = async (values: { name: string; phone: string; job_title?: string; org_id: number; role: number }) => {
    if (!editingId) return
    const { error } = await supabase.from('users').update({
      name: values.name,
      phone: values.phone,
      job_title: values.job_title || null,
      org_id: values.org_id,
      role: values.role,
    }).eq('id', editingId)
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

  // 处理级联选择值变化，org_id 取数组最后一项（小组id）
  const handleOrgChange = (value: any) => {
    if (value && value.length > 0) {
      form.setFieldValue('org_id', Number(value[value.length - 1]))
    }
  }

  // 回显时还原级联选择路径
  const getOrgPath = (orgId: number): string[] => {
    const org = orgs.find((o) => o.id === orgId)
    if (!org) return []
    return [
      `${org.area_id}-${org.area?.area_name}`,
      `${org.area_id}-${org.area?.area_name}-${org.big_class}`,
      `${org.area_id}-${org.area?.area_name}-${org.big_class}-${org.class_name}`,
      String(org.id),
    ]
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
    const errors: string[] = []
    let successCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const parts = line.split(/[\t,]/).map((p) => p.trim())
      if (parts.length < 4) {
        errors.push(`第 ${i + 1} 行格式错误：需要4列（姓名、手机号、组织ID、角色）`)
        continue
      }

      const [name, phone, orgIdStr, roleStr] = parts
      const orgId = parseInt(orgIdStr)
      const role = parseInt(roleStr) || 0

      if (!name || !phone) {
        errors.push(`第 ${i + 1} 行：姓名和手机号不能为空`)
        continue
      }
      if (isNaN(orgId)) {
        errors.push(`第 ${i + 1} 行：组织ID必须是数字`)
        continue
      }

      const email = await createAuthUser(phone)
      if (!email) {
        errors.push(`第 ${i + 1} 行：创建登录账号失败`)
        continue
      }

      const { error } = await supabase.from('users').insert([{
        name, email, phone, org_id: orgId, role,
      }])
      if (error) {
        errors.push(`第 ${i + 1} 行：${error.message}`)
      } else {
        successCount++
      }
    }

    if (errors.length > 0) {
      message.error(errors.slice(0, 3).join('\n'))
    }
    if (successCount > 0) {
      message.success(`成功导入 ${successCount} 条记录`)
      setBatchModalVisible(false)
      setBatchText('')
      fetchData()
    }
  }

  const downloadTemplate = () => {
    const template = '姓名,手机号,组织ID,角色\n张三,13800138000,1,0\n李四,13900139000,2,1'
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '人员导入模板.csv'
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
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '职务', dataIndex: 'job_title', width: 80 },
    { title: '所属组织', dataIndex: 'org_id', width: 280, render: (orgId: number) => getOrgName(orgId) },
    {
      title: '角色',
      dataIndex: 'role',
      width: 80,
      render: (role: number) => role === 2 ? '管理员' : role === 1 ? '填报人' : '审核人'
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, record: User) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
            setEditingId(record.id)
            form.resetFields()
            form.setFieldsValue({ ...record, org_id: record.org_id })
            setEditingOrgPath(getOrgPath(record.org_id))
            setModalVisible(true)
          }} />
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); form.resetFields(); setEditingOrgPath([]); setModalVisible(true) }}>新增人员</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
      />

      <Modal title={editingId ? '编辑人员' : '新增人员'} open={modalVisible} onCancel={() => { setModalVisible(false); setEditingId(null); form.resetFields() }} onOk={() => form.submit()} width={500}>
        <Form form={form} onFinish={editingId ? handleEdit : handleAdd} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input placeholder="手机号（初始密码为手机号后6位）" />
          </Form.Item>
          <Form.Item name="job_title" label="职务">
            <Input placeholder="职务（可选）" />
          </Form.Item>
          {/* 隐藏的 org_id 字段，实际提交用 */}
          <Form.Item name="org_id" style={{ display: 'none' }}><Input /></Form.Item>
          <Form.Item label="所属组织" required>
            <Cascader
              value={editingOrgPath}
              placeholder="请选择组织（地区→大班→班级→小组）"
              options={orgCascaderOptions}
              onChange={(val) => { setEditingOrgPath(val || []); handleOrgChange(val) }}
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="请选择角色">
              <Select.Option value={0}>审核人</Select.Option>
              <Select.Option value={1}>填报人</Select.Option>
              <Select.Option value={2}>管理员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="批量导入人员" open={batchModalVisible} onCancel={() => { setBatchModalVisible(false); setBatchText('') }} footer={null} width={700}>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Text type="secondary">格式：每行一条记录，Tab 或逗号分隔。导入时自动创建登录账号（密码=手机号后6位）。</Text>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">模板示例：</Text>
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 400 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>姓名</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap', color: 'red' }}>手机号*</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>组织ID</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>角色</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: '6px 8px', whiteSpace: 'nowrap' }}>张三</td>
                    <td style={{ border: '1px solid #ddd', padding: '6px 8px', whiteSpace: 'nowrap' }}>13800138000</td>
                    <td style={{ border: '1px solid #ddd', padding: '6px 8px', whiteSpace: 'nowrap' }}>1</td>
                    <td style={{ border: '1px solid #ddd', padding: '6px 8px', whiteSpace: 'nowrap' }}>0</td>
                  </tr>
                  <tr style={{ background: '#fafafa' }}>
                    <td style={{ border: '1px solid #ddd', padding: '6px 8px', whiteSpace: 'nowrap' }}>李四</td>
                    <td style={{ border: '1px solid #ddd', padding: '6px 8px', whiteSpace: 'nowrap' }}>13900139000</td>
                    <td style={{ border: '1px solid #ddd', padding: '6px 8px', whiteSpace: 'nowrap' }}>2</td>
                    <td style={{ border: '1px solid #ddd', padding: '6px 8px', whiteSpace: 'nowrap' }}>1</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              角色说明：0=审核人，1=填报人，2=管理员
            </div>
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate} style={{ marginTop: 8 }}>下载模板</Button>
          </div>
        </Card>
        <Input.TextArea rows={10} value={batchText} onChange={(e) => setBatchText(e.target.value)} placeholder="从 Excel 复制数据粘贴到此处（支持 Tab 或逗号分隔）" />
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Button onClick={() => setBatchModalVisible(false)}>取消</Button>
          <Button type="primary" style={{ marginLeft: 8 }} onClick={handleBatchImport}>导入</Button>
        </div>
      </Modal>
    </div>
  )
}

export default UserManage