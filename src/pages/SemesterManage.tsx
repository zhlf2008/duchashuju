import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, DatePicker, Switch, message, Popconfirm, Space, Card, Tag } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import dayjs from 'dayjs'
import type { Semester } from '../types'

const { RangePicker } = DatePicker

function SemesterManage() {
  const [data, setData] = useState<Semester[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('semester').select('*').order('id', { ascending: false })
    if (!error) setData(data)
    setLoading(false)
  }

  const generateSchedules = async (semesterId: number, startDate: string, endDate: string) => {
    const start = dayjs(startDate)
    const end = dayjs(endDate)
    const schedules: any[] = []
    let current = start

    while (current.isBefore(end) || current.isSame(end)) {
      schedules.push({
        semester_id: semesterId,
        schedule_date: current.format('YYYY-MM-DD'),
        week_day: current.day() + 1,
        item_ids: '',
        is_valid: 1,
      })
      current = current.add(1, 'day')
    }

    const defaultItems = await supabase.from('assessment_item').select('id').eq('is_template', 1)
    const templateIds = defaultItems.data?.map((d: any) => d.id).join(',') || ''

    const schedulesWithItems = schedules.map((s) => ({
      ...s,
      item_ids: templateIds,
    }))

    await supabase.from('semester_schedule').insert(schedulesWithItems)
  }

  const handleAdd = async (values: { semester_name: string; date_range: [dayjs.Dayjs, dayjs.Dayjs]; is_current: boolean }) => {
    const start_date = values.date_range[0].format('YYYY-MM-DD')
    const end_date = values.date_range[1].format('YYYY-MM-DD')

    if (values.is_current) {
      await supabase.from('semester').update({ is_current: 0 }).eq('is_current', 1)
    }

    const { data, error } = await supabase.from('semester').insert([{
      semester_name: values.semester_name,
      start_date,
      end_date,
      is_current: values.is_current ? 1 : 0,
    }]).select().single()

    if (error) {
      message.error('添加失败: ' + error.message)
    } else {
      await generateSchedules(data.id, start_date, end_date)
      message.success('添加成功，已生成日程')
      setModalVisible(false)
      form.resetFields()
      fetchData()
    }
  }

  const handleEdit = async (values: { semester_name: string; date_range: [dayjs.Dayjs, dayjs.Dayjs]; is_current: boolean }) => {
    if (!editingId) return
    const start_date = values.date_range[0].format('YYYY-MM-DD')
    const end_date = values.date_range[1].format('YYYY-MM-DD')

    if (values.is_current) {
      await supabase.from('semester').update({ is_current: 0 }).eq('is_current', 1)
    }

    const { error } = await supabase.from('semester').update({
      semester_name: values.semester_name,
      start_date,
      end_date,
      is_current: values.is_current ? 1 : 0,
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
    const { error } = await supabase.from('semester').delete().eq('id', id)
    if (error) {
      message.error('删除失败: ' + error.message)
    } else {
      message.success('删除成功')
      fetchData()
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '学期名称', dataIndex: 'semester_name' },
    { title: '开始日期', dataIndex: 'start_date', width: 120 },
    { title: '结束日期', dataIndex: 'end_date', width: 120 },
    {
      title: '当前学期',
      dataIndex: 'is_current',
      width: 100,
      render: (isCurrent: number) => isCurrent ? <Tag color="green">是</Tag> : <Tag>否</Tag>
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: Semester) => (
        <Space>
          <Button
            type="link"
            icon={<CalendarOutlined />}
            onClick={() => {
              message.info('日程管理功能开发中')
            }}
          >
            日程
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingId(record.id)
              form.setFieldsValue({
                ...record,
                date_range: [dayjs(record.start_date), dayjs(record.end_date)],
                is_current: record.is_current === 1,
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
        <h2>学期管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingId(null)
            form.resetFields()
            setModalVisible(true)
          }}
        >
          新增学期
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
      />
      <Modal
        title={editingId ? '编辑学期' : '新增学期'}
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
            name="semester_name"
            label="学期名称"
            rules={[{ required: true, message: '请输入学期名称' }]}
          >
            <Input placeholder="如：2026年春季学期" />
          </Form.Item>
          <Form.Item
            name="date_range"
            label="学期日期范围"
            rules={[{ required: true, message: '请选择日期范围' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="is_current"
            label="设为当前学期"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SemesterManage
