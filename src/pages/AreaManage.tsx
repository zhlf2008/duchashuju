import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, message, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import type { Area } from '../types'

function AreaManage() {
  const [data, setData] = useState<Area[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('area').select('*').order('id')
    if (!error) setData(data)
    setLoading(false)
  }

  const handleAdd = async (values: { area_name: string; remark?: string }) => {
    const { error } = await supabase.from('area').insert([values])
    if (error) {
      message.error('添加失败: ' + error.message)
    } else {
      message.success('添加成功')
      setModalVisible(false)
      form.resetFields()
      fetchData()
    }
  }

  const handleEdit = async (values: { area_name: string; remark?: string }) => {
    if (!editingId) return
    const { error } = await supabase.from('area').update(values).eq('id', editingId)
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
    const { error } = await supabase.from('area').delete().eq('id', id)
    if (error) {
      message.error('删除失败: ' + error.message)
    } else {
      message.success('删除成功')
      fetchData()
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '地区名称', dataIndex: 'area_name' },
    { title: '备注', dataIndex: 'remark' },
    {
      title: '操作',
      render: (_: any, record: Area) => (
        <>
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
            title="确定删除此地区？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>地区管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingId(null)
            form.resetFields()
            setModalVisible(true)
          }}
        >
          新增地区
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
      />
      <Modal
        title={editingId ? '编辑地区' : '新增地区'}
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
            name="area_name"
            label="地区名称"
            rules={[{ required: true, message: '请输入地区名称' }]}
          >
            <Input placeholder="如：华东地区、华北地区" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AreaManage
