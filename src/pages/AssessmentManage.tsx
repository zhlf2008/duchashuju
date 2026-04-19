import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Switch, message, Popconfirm, Space, Tag } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import type { AssessmentItem } from '../types'

function AssessmentManage() {
  const [data, setData] = useState<AssessmentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('assessment_item').select('*').order('id')
    if (!error) setData(data)
    setLoading(false)
  }

  const handleAdd = async (values: { item_name: string; fields: any; formula: string; is_template: boolean }) => {
    const { error } = await supabase.from('assessment_item').insert([{
      item_name: values.item_name,
      fields: typeof values.fields === 'string' ? JSON.parse(values.fields) : values.fields,
      formula: values.formula,
      is_template: values.is_template ? 1 : 0,
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

  const handleEdit = async (values: { item_name: string; fields: any; formula: string; is_template: boolean }) => {
    if (!editingId) return
    const { error } = await supabase.from('assessment_item').update({
      item_name: values.item_name,
      fields: typeof values.fields === 'string' ? JSON.parse(values.fields) : values.fields,
      formula: values.formula,
      is_template: values.is_template ? 1 : 0,
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

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('assessment_item').delete().eq('id', id)
    if (error) {
      message.error('删除失败: ' + error.message)
    } else {
      message.success('删除成功')
      fetchData()
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '项目名称', dataIndex: 'item_name' },
    {
      title: '填报字段',
      dataIndex: 'fields',
      render: (fields: any) => {
        if (typeof fields === 'string') fields = JSON.parse(fields)
        return Object.entries(fields).map(([key, val]) => (
          <Tag key={key} color={val === '必填' ? 'blue' : 'default'}>
            {key} ({val})
          </Tag>
        ))
      },
    },
    { title: '计算公式', dataIndex: 'formula', ellipsis: true },
    {
      title: '模板',
      dataIndex: 'is_template',
      width: 80,
      render: (isTemplate: number) => isTemplate ? <Tag color="green">是</Tag> : <Tag>否</Tag>
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: AssessmentItem) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingId(record.id)
              form.setFieldsValue({
                ...record,
                fields: typeof record.fields === 'string' ? record.fields : JSON.stringify(record.fields),
                is_template: record.is_template === 1,
              })
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
        <h2>考核项目管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingId(null)
            form.resetFields()
            setModalVisible(true)
          }}
        >
          新增考核项目
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
      />
      <Modal
        title={editingId ? '编辑考核项目' : '新增考核项目'}
        open={modalVisible}
        width={700}
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
            name="item_name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="如：上线率、作业率" />
          </Form.Item>
          <Form.Item
            name="fields"
            label="填报字段 (JSON格式)"
            rules={[{ required: true, message: '请输入填报字段' }]}
            extra='格式示例: {"应到人数": "必填", "实到人数": "必填"}'
          >
            <Input.TextArea rows={3} placeholder='{"字段名": "必填或非必填"}' />
          </Form.Item>
          <Form.Item
            name="formula"
            label="计算公式"
            rules={[{ required: true, message: '请输入计算公式' }]}
            extra='字段名使用中文，如: (实到人数+请假人数)/应到人数*100'
          >
            <Input.TextArea rows={2} placeholder="使用字段名和运算符，如: (实到人数+请假人数)/应到人数*100" />
          </Form.Item>
          <Form.Item
            name="is_template"
            label="设为模板"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AssessmentManage
