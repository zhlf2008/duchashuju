import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Switch, message, Popconfirm, Space, Tag, Checkbox, Select, Card, Typography } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import type { AssessmentItem } from '../types'

function AssessmentManage() {
  const [data, setData] = useState<AssessmentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  // 可视化字段编辑状态
  type FieldType = 'number' | 'text' | 'radio' | 'checkbox' | 'multiSelect' | 'image'
  const [fieldList, setFieldList] = useState<{ name: string; type: FieldType; required: boolean }[]>([])
  const [hasFormula, setHasFormula] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('assessment_item').select('*').order('id')
    if (!error) setData(data)
    setLoading(false)
  }

  const handleAddField = () => {
    setFieldList((prev) => [...prev, { name: '', type: 'number', required: true }])
  }

  const handleRemoveField = (index: number) => {
    setFieldList((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFieldChange = (index: number, key: 'name' | 'type' | 'required', value: string | boolean) => {
    setFieldList((prev) => prev.map((f, i) => i === index ? { ...f, [key]: value } : f))
  }

  const buildFieldsObj = () => {
    const obj: Record<string, string> = {}
    fieldList.forEach((f) => {
      if (f.name.trim()) {
        obj[f.name.trim()] = f.required ? '必填' : '非必填'
      }
    })
    return obj
  }

  const handleAdd = async (values: { item_name: string; formula?: string; is_template: boolean }) => {
    const fields = buildFieldsObj()
    const { error } = await supabase.from('assessment_item').insert([{
      item_name: values.item_name,
      fields,
      formula: hasFormula ? (values.formula || '') : '',
      is_template: values.is_template ? 1 : 0,
    }])
    if (error) {
      message.error('添加失败: ' + error.message)
    } else {
      message.success('添加成功')
      setModalVisible(false)
      setEditingId(null)
      setFieldList([])
      setHasFormula(false)
      form.resetFields()
      fetchData()
    }
  }

  const handleEdit = async (values: { item_name: string; formula?: string; is_template: boolean }) => {
    if (!editingId) return
    const fields = buildFieldsObj()
    const { error } = await supabase.from('assessment_item').update({
      item_name: values.item_name,
      fields,
      formula: hasFormula ? (values.formula || '') : '',
      is_template: values.is_template ? 1 : 0,
    }).eq('id', editingId)
    if (error) {
      message.error('修改失败: ' + error.message)
    } else {
      message.success('修改成功')
      setModalVisible(false)
      setEditingId(null)
      setFieldList([])
      setHasFormula(false)
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

  const handleBatchSetTemplate = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要设置的考核项目')
      return
    }
    const { error } = await supabase
      .from('assessment_item')
      .update({ is_template: 1 })
      .in('id', selectedRowKeys)
    if (error) {
      message.error('批量设置失败: ' + error.message)
    } else {
      message.success(`已成功设置 ${selectedRowKeys.length} 个项目为模板`)
      setSelectedRowKeys([])
      fetchData()
    }
  }

  const handleToggleTemplate = async (id: number, currentStatus: number) => {
    const { error } = await supabase
      .from('assessment_item')
      .update({ is_template: currentStatus ? 0 : 1 })
      .eq('id', id)
    if (error) {
      message.error('切换状态失败: ' + error.message)
    } else {
      fetchData()
    }
  }

  const columns = [
    {
      title: '',
      dataIndex: 'is_template',
      width: 50,
      render: (isTemplate: number, record: AssessmentItem) => (
        <Checkbox
          checked={isTemplate === 1}
          onChange={() => handleToggleTemplate(record.id, isTemplate)}
        />
      ),
    },
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '项目名称', dataIndex: 'item_name' },
    {
      title: '填报字段',
      dataIndex: 'fields',
      render: (fields: any) => {
        if (!fields) return '-'
        if (typeof fields === 'string') fields = JSON.parse(fields)
        return Object.entries(fields).map(([key, val]) => {
          const valStr = val as string
          let color = 'default'
          if (valStr.includes('必填')) color = 'blue'
          if (valStr.includes('数字')) color = 'green'
          if (valStr.includes('图片')) color = 'purple'
          if (valStr.includes('单选') || valStr.includes('多选')) color = 'orange'
          return <Tag key={key} color={color}>{key}</Tag>
        })
      },
    },
    {
      title: '计算公式',
      dataIndex: 'formula',
      width: 150,
      ellipsis: true,
      render: (formula: string) => formula ? formula : '-',
    },
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
              let fieldsObj: Record<string, string> = {}
              if (record.fields) {
                fieldsObj = typeof record.fields === 'string' ? JSON.parse(record.fields) : record.fields
              }
              const list = Object.entries(fieldsObj).map(([name, val]) => {
                let type: FieldType = 'text'
                if ((val as string).includes('数字')) type = 'number'
                else if ((val as string).includes('单选')) type = 'radio'
                else if ((val as string).includes('多选')) type = 'checkbox'
                else if ((val as string).includes('图片')) type = 'image'
                return {
                  name,
                  type,
                  required: (val as string).includes('必填'),
                }
              })
              setFieldList(list)
              setHasFormula(!!record.formula && record.formula.trim() !== '')
              form.setFieldsValue({
                item_name: record.item_name,
                formula: record.formula,
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

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>考核项目管理</h2>
        <Space>
          <Button onClick={handleBatchSetTemplate}>批量设为模板</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingId(null)
              setFieldList([])
              setHasFormula(false)
              form.resetFields()
              setModalVisible(true)
            }}
          >
            新增考核项目
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
      />
      <Modal
        title={editingId ? '编辑考核项目' : '新增考核项目'}
        open={modalVisible}
        width={700}
        onCancel={() => {
          setModalVisible(false)
          setEditingId(null)
          setFieldList([])
          setHasFormula(false)
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
          <Form.Item label="需要计算">
            <Switch checked={hasFormula} onChange={(v) => setHasFormula(v)} checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item label="填报字段">
            <Card size="small">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <Button size="small" icon={<PlusOutlined />} onClick={handleAddField}>添加字段</Button>
              </div>
              {fieldList.length === 0 && (
                <Typography.Text type="secondary">暂无字段，请点击「添加字段」</Typography.Text>
              )}
              {fieldList.map((field, index) => (
                <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <Input
                    placeholder="字段名"
                    value={field.name}
                    onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <Select
                    value={field.type}
                    onChange={(val) => handleFieldChange(index, 'type', val)}
                    style={{ flex: 1 }}
                  >
                    <Select.Option value="number">数字</Select.Option>
                    <Select.Option value="text">文本</Select.Option>
                    <Select.Option value="radio">单选</Select.Option>
                    <Select.Option value="checkbox">多选</Select.Option>
                    <Select.Option value="multiSelect">下拉多选</Select.Option>
                    <Select.Option value="image">图片上传</Select.Option>
                  </Select>
                  <Checkbox
                    checked={field.required}
                    onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                  >必填</Checkbox>
                  <Button
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveField(index)}
                  />
                </div>
              ))}
            </Card>
          </Form.Item>
          {hasFormula && (
            <Form.Item
              name="formula"
              label="计算公式"
              extra='字段名使用中文，如: (实到人数+请假人数)/应到人数*100'
            >
              <Input.TextArea rows={2} placeholder="使用字段名和运算符，如: (实到人数+请假人数)/应到人数*100" />
            </Form.Item>
          )}
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
