import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Space } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import type { User, Org } from '../types'

function UserManage() {
  const [data, setData] = useState<User[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

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

  const handleAdd = async (values: { name: string; account: string; org_id: number; role: number }) => {
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

  const handleEdit = async (values: { name: string; account: string; org_id: number; role: number }) => {
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

  const getOrgName = (orgId: number) => {
    const org = orgs.find((o) => o.id === orgId)
    if (!org) return '-'
    return `${org.area?.area_name || ''} → ${org.big_class} → ${org.class_name} → ${org.group_name}`
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '账号', dataIndex: 'account', width: 130 },
    { title: '所属组织', dataIndex: 'org_id', render: (orgId: number) => getOrgName(orgId) },
    {
      title: '角色',
      dataIndex: 'role',
      width: 100,
      render: (role: number) => role === 2 ? '管理员' : role === 1 ? '填报人' : '成员'
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingId(record.id)
              form.setFieldsValue(record)
              setModalVisible(true)
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>人员管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingId(null)
            form.resetFields()
            setModalVisible(true)
          }}
        >
          新增人员
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
      />
      <Modal
        title={editingId ? '编辑人员' : '新增人员'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingId(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          onFinish={editingId ? handleEdit : handleAdd}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="account"
            label="手机号"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input placeholder="用于登录的手机号" />
          </Form.Item>
          <Form.Item
            name="org_id"
            label="所属组织"
            rules={[{ required: true, message: '请选择所属组织' }]}
          >
            <Select placeholder="请选择组织">
              {orgs.map((org) => (
                <Select.Option key={org.id} value={org.id}>
                  {org.area?.area_name} → {org.big_class} → {org.class_name} → {org.group_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Select.Option value={0}>成员</Select.Option>
              <Select.Option value={1}>填报人</Select.Option>
              <Select.Option value={2}>管理员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UserManage
