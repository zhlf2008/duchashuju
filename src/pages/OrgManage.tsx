import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Space } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import type { Area, Org } from '../types'

function OrgManage() {
  const [data, setData] = useState<(Org & { area_name?: string })[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchData()
    fetchAreas()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('org')
      .select('*, area:area_id(area_name)')
      .order('area_id')
    if (!error) setData(data)
    setLoading(false)
  }

  const fetchAreas = async () => {
    const { data } = await supabase.from('area').select('*').order('id')
    if (data) setAreas(data)
  }

  const handleAdd = async (values: { area_id: number; big_class: string; class_name: string; group_name: string }) => {
    const { error } = await supabase.from('org').insert([values])
    if (error) {
      message.error('添加失败: ' + error.message)
    } else {
      message.success('添加成功')
      setModalVisible(false)
      form.resetFields()
      fetchData()
    }
  }

  const handleEdit = async (values: { area_id: number; big_class: string; class_name: string; group_name: string }) => {
    if (!editingId) return
    const { error } = await supabase.from('org').update(values).eq('id', editingId)
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
    const { error } = await supabase.from('org').delete().eq('id', id)
    if (error) {
      message.error('删除失败: ' + error.message)
    } else {
      message.success('删除成功')
      fetchData()
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '地区', dataIndex: 'area_name', width: 120 },
    { title: '大班', dataIndex: 'big_class', width: 150 },
    { title: '班级', dataIndex: 'class_name', width: 150 },
    { title: '小组', dataIndex: 'group_name' },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: Org & { area_name?: string }) => (
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
        <h2>组织管理（四级架构）</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingId(null)
            form.resetFields()
            setModalVisible(true)
          }}
        >
          新增组织
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
      />
      <Modal
        title={editingId ? '编辑组织' : '新增组织'}
        open={modalVisible}
        width={600}
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
            name="area_id"
            label="地区"
            rules={[{ required: true, message: '请选择地区' }]}
          >
            <Select
              placeholder="请选择地区"
            >
              {areas.map((a) => (
                <Select.Option key={a.id} value={a.id}>
                  {a.area_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="big_class"
            label="大班"
            rules={[{ required: true, message: '请输入大班名称' }]}
          >
            <Input placeholder="如：精进大班" />
          </Form.Item>
          <Form.Item
            name="class_name"
            label="班级"
            rules={[{ required: true, message: '请输入班级名称' }]}
          >
            <Input placeholder="如：1班" />
          </Form.Item>
          <Form.Item
            name="group_name"
            label="小组"
            rules={[{ required: true, message: '请输入小组名称' }]}
          >
            <Input placeholder="如：第1小组" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OrgManage
