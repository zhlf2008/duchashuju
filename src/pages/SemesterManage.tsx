import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, DatePicker, Switch, message, Popconfirm, Space, Tag, Card, Typography, Checkbox } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import dayjs from 'dayjs'
import type { Semester, AssessmentItem, ScheduleDate } from '../types'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

function SemesterManage() {
  const [data, setData] = useState<Semester[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [currentSemester, setCurrentSemester] = useState<Semester | null>(null)
  const [schedules, setSchedules] = useState<ScheduleDate[]>([])
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>([])
  const [form] = Form.useForm()
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)
  const [scheduleForm] = Form.useForm()

  useEffect(() => {
    fetchData()
    fetchAssessmentItems()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: semesterData, error } = await supabase.from('semester').select('*').order('id', { ascending: false })
    if (!error) setData(semesterData || [])
    setLoading(false)
  }

  const fetchAssessmentItems = async () => {
    const { data } = await supabase.from('assessment_item').select('*').order('id')
    if (data) setAssessmentItems(data)
  }

  const fetchSchedules = async (semesterId: number) => {
    const { data } = await supabase
      .from('semester_schedule')
      .select('*')
      .eq('semester_id', semesterId)
      .order('schedule_date')
    if (data) setSchedules(data)
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

  const openScheduleModal = async (semester: Semester) => {
    setCurrentSemester(semester)
    await fetchSchedules(semester.id)
    setScheduleModalVisible(true)
  }

  const getItemNames = (itemIds: string) => {
    if (!itemIds) return '-'
    const ids = itemIds.split(',').filter(Boolean)
    return ids.map((id) => {
      const item = assessmentItems.find((i) => i.id === parseInt(id))
      return item ? item.item_name : null
    }).filter(Boolean).join(', ') || '-'
  }

  const weekDayNames = ['', '周日', '周一', '周二', '周三', '周四', '周五', '周六']

  const scheduleColumns = [
    {
      title: '日期',
      dataIndex: 'schedule_date',
      width: 120,
      render: (date: string) => dayjs(date).format('MM/DD')
    },
    {
      title: '星期',
      dataIndex: 'week_day',
      width: 80,
      render: (day: number) => weekDayNames[day] || '-'
    },
    {
      title: '考核项目',
      dataIndex: 'item_ids',
      render: (itemIds: string) => {
        const names = getItemNames(itemIds)
        if (names === '-' || names === '') return <Text type="secondary">未设置</Text>
        return <Text>{names}</Text>
      }
    },
    {
      title: '状态',
      dataIndex: 'is_valid',
      width: 80,
      render: (valid: number) => valid ? <Tag color="green">有效</Tag> : <Tag>无效</Tag>
    },
    {
      title: '操作',
      width: 100,
      render: (_: any, record: ScheduleDate) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setEditingScheduleId(record.id)
            const currentIds = record.item_ids ? record.item_ids.split(',').filter(Boolean).map(Number) : []
            scheduleForm.setFieldsValue({ item_ids: currentIds, is_valid: record.is_valid === 1 })
            setScheduleModalVisible(true)
          }}
        >
          编辑项目
        </Button>
      ),
    },
  ]

  const handleUpdateSchedule = async (values: { item_ids: number[]; is_valid: boolean }) => {
    if (!editingScheduleId) return
    const { error } = await supabase.from('semester_schedule').update({
      item_ids: values.item_ids.join(','),
      is_valid: values.is_valid ? 1 : 0,
    }).eq('id', editingScheduleId)

    if (error) {
      message.error('更新失败: ' + error.message)
    } else {
      message.success('更新成功')
      setEditingScheduleId(null)
      scheduleForm.resetFields()
      if (currentSemester) await fetchSchedules(currentSemester.id)
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
      width: 200,
      render: (_: any, record: Semester) => (
        <Space>
          <Button type="link" icon={<CalendarOutlined />} onClick={() => openScheduleModal(record)}>
            日程
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => {
            setEditingId(record.id)
            form.setFieldsValue({
              ...record,
              date_range: [dayjs(record.start_date), dayjs(record.end_date)],
              is_current: record.is_current === 1,
            })
            setModalVisible(true)
          }} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>学期管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); form.resetFields(); setModalVisible(true) }}>
          新增学期
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} />

      <Modal title={editingId ? '编辑学期' : '新增学期'} open={modalVisible} onCancel={() => { setModalVisible(false); setEditingId(null); form.resetFields() }} onOk={() => form.submit()} width={500}>
        <Form form={form} onFinish={editingId ? handleEdit : handleAdd} layout="vertical">
          <Form.Item name="semester_name" label="学期名称" rules={[{ required: true, message: '请输入学期名称' }]}>
            <Input placeholder="如：2026年春季学期" />
          </Form.Item>
          <Form.Item name="date_range" label="学期日期范围" rules={[{ required: true, message: '请选择日期范围' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_current" label="设为当前学期" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingScheduleId ? '编辑日程考核项目' : `${currentSemester?.semester_name} - 日程管理`}
        open={scheduleModalVisible}
        onCancel={() => { setScheduleModalVisible(false); setEditingScheduleId(null); setCurrentSemester(null); scheduleForm.resetFields() }}
        width={900}
        footer={editingScheduleId ? [
          <Button key="back" onClick={() => { setEditingScheduleId(null); scheduleForm.resetFields() }}>返回列表</Button>,
          <Button key="submit" type="primary" onClick={() => scheduleForm.submit()}>保存</Button>
        ] : null}
      >
        {editingScheduleId ? (
          <Form form={scheduleForm} layout="vertical" onFinish={handleUpdateSchedule}>
            <Form.Item name="item_ids" label="考核项目" rules={[{ required: true, message: '请选择考核项目' }]}>
              <Checkbox.Group>
                <Space direction="vertical">
                  {assessmentItems.map((item) => (
                    <Checkbox key={item.id} value={item.id}>{item.item_name}</Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </Form.Item>
            <Form.Item name="is_valid" label="状态" valuePropName="checked">
              <Switch checkedChildren="有效" unCheckedChildren="无效" />
            </Form.Item>
          </Form>
        ) : (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Text type="secondary">点击「编辑项目」可为单日设置考核项目。默认使用模板项目。</Text>
            </Card>
            <Table
              columns={scheduleColumns}
              dataSource={schedules}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 31 }}
              scroll={{ y: 400 }}
            />
          </>
        )}
      </Modal>
    </div>
  )
}

export default SemesterManage
