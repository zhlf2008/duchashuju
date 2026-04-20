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

  const generateSchedules = async (semesterId: number, startDate: string, endDate: string, trialStartDate: string | null = null) => {
    const formalStart = dayjs(startDate)
    const end = dayjs(endDate)
    const schedules: any[] = []

    // 生成试晨读日期（如果设置了试晨读日期范围）
    if (trialStartDate) {
      let current = dayjs(trialStartDate)
      while (current.isBefore(formalStart)) {
        schedules.push({
          semester_id: semesterId,
          schedule_date: current.format('YYYY-MM-DD'),
          week_day: current.day() + 1,
          item_ids: '',
          is_valid: 1,
        })
        current = current.add(1, 'day')
      }
    }

    // 生成正式学期日期
    let current = formalStart
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

  const handleAdd = async (values: { semester_name: string; date_range: [dayjs.Dayjs, dayjs.Dayjs]; trial_range: [dayjs.Dayjs, dayjs.Dayjs] | null; is_current: boolean }) => {
    const start_date = values.date_range[0].format('YYYY-MM-DD')
    const end_date = values.date_range[1].format('YYYY-MM-DD')
    const trial_start = values.trial_range ? values.trial_range[0].format('YYYY-MM-DD') : null

    if (values.is_current) {
      await supabase.from('semester').update({ is_current: 0 }).eq('is_current', 1)
    }

    const { data, error } = await supabase.from('semester').insert([{
      semester_name: values.semester_name,
      start_date,
      end_date,
      trial_start_date: trial_start,
      trial_weeks: 0,
      is_current: values.is_current ? 1 : 0,
    }]).select().single()

    if (error) {
      message.error('添加失败: ' + error.message)
    } else {
      await generateSchedules(data.id, start_date, end_date, trial_start)
      message.success('添加成功，已生成日程')
      setModalVisible(false)
      form.resetFields()
      fetchData()
    }
  }

  const handleEdit = async (values: { semester_name: string; date_range: [dayjs.Dayjs, dayjs.Dayjs]; trial_range: [dayjs.Dayjs, dayjs.Dayjs] | null; is_current: boolean }) => {
    if (!editingId) return
    const start_date = values.date_range[0].format('YYYY-MM-DD')
    const end_date = values.date_range[1].format('YYYY-MM-DD')
    const trial_start = values.trial_range ? values.trial_range[0].format('YYYY-MM-DD') : null

    if (values.is_current) {
      await supabase.from('semester').update({ is_current: 0 }).eq('is_current', 1)
    }

    // 获取原学期数据，比较是否需要重新生成日程（试晨读日期是否变更）
    const original = data.find((s) => s.id === editingId)
    const trialStartChanged = original && (original.trial_start_date || null) !== trial_start

    const { error } = await supabase.from('semester').update({
      semester_name: values.semester_name,
      start_date,
      end_date,
      trial_start_date: trial_start,
      trial_weeks: 0,
      is_current: values.is_current ? 1 : 0,
    }).eq('id', editingId)

    if (error) {
      message.error('修改失败: ' + error.message)
    } else {
      if (trialStartChanged) {
        // 删除旧日程，重新生成
        await supabase.from('semester_schedule').delete().eq('semester_id', editingId)
        await generateSchedules(editingId, start_date, end_date, trial_start)
        message.success('修改成功，已重新生成日程')
      } else {
        message.success('修改成功')
      }
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



  // Inline: 切换日程考核项目勾选
  const handleToggleScheduleItems = async (record: ScheduleDate, checkedIds: number[]) => {
    const { error } = await supabase
      .from('semester_schedule')
      .update({ item_ids: checkedIds.join(',') })
      .eq('id', record.id)
    if (error) {
      message.error('保存失败')
    } else {
      setSchedules((prev) =>
        prev.map((s) => s.id === record.id ? { ...s, item_ids: checkedIds.join(',') } : s)
      )
    }
  }

  // Inline: 切换日程状态
  const handleToggleScheduleValid = async (record: ScheduleDate, isValid: boolean) => {
    const { error } = await supabase
      .from('semester_schedule')
      .update({ is_valid: isValid ? 1 : 0 })
      .eq('id', record.id)
    if (error) {
      message.error('保存失败')
    } else {
      setSchedules((prev) =>
        prev.map((s) => s.id === record.id ? { ...s, is_valid: isValid ? 1 : 0 } : s)
      )
    }
  }

  const weekDayNames = ['', '周日', '周一', '周二', '周三', '周四', '周五', '周六']

  const scheduleColumns = [
    {
      title: '类型',
      width: 80,
      render: (_: any, record: ScheduleDate) => {
        if (!currentSemester) return '-'
        const trialStart = currentSemester.trial_start_date
        const formalStart = dayjs(currentSemester.start_date)
        const isTrial = trialStart && dayjs(record.schedule_date).isBefore(formalStart)
        return isTrial ? <Tag color="orange">试晨读</Tag> : <Tag color="green">正式</Tag>
      },
    },
    {
      title: '日期',
      dataIndex: 'schedule_date',
      width: 100,
      render: (date: string) => dayjs(date).format('MM/DD')
    },
    {
      title: '星期',
      dataIndex: 'week_day',
      width: 70,
      render: (day: number) => weekDayNames[day] || '-'
    },
    {
      title: '考核项目',
      width: 300,
      render: (_: any, record: ScheduleDate) => {
        const checked = record.item_ids ? record.item_ids.split(',').filter(Boolean).map(Number) : []
        return (
          <Checkbox.Group
            value={checked}
            onChange={(vals) => handleToggleScheduleItems(record, vals as number[])}
          >
            {assessmentItems.map((item) => (
              <Checkbox key={item.id} value={item.id}>{item.item_name}</Checkbox>
            ))}
          </Checkbox.Group>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'is_valid',
      width: 80,
      render: (valid: number, record: ScheduleDate) => (
        <Switch
          size="small"
          checked={valid === 1}
          onChange={(checked) => handleToggleScheduleValid(record, checked)}
          checkedChildren="有效"
          unCheckedChildren="无效"
        />
      ),
    },
  ]

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '学期名称', dataIndex: 'semester_name' },
    { title: '开始日期', dataIndex: 'start_date', width: 120 },
    { title: '结束日期', dataIndex: 'end_date', width: 120 },
    { title: '试晨读开始', dataIndex: 'trial_start_date', width: 120, render: (d: string | null) => d || '-' },
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
              trial_range: record.trial_start_date ? [dayjs(record.trial_start_date), dayjs(record.start_date).subtract(1, 'day')] : null,
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
          <Form.Item name="date_range" label="正式学期日期范围" rules={[{ required: true, message: '请选择日期范围' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="trial_range" label="试晨读日期范围" tooltip="试晨读在正式学期开始前，非必填">
            <RangePicker style={{ width: '100%' }} placeholder={['试晨读开始', '试晨读结束']} />
          </Form.Item>
          <Form.Item name="is_current" label="设为当前学期" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${currentSemester?.semester_name} - 日程管理`}
        open={scheduleModalVisible}
        onCancel={() => { setScheduleModalVisible(false); setCurrentSemester(null) }}
        width={900}
        footer={null}
      >
        <Card size="small" style={{ marginBottom: 16 }}>
          <Text type="secondary">直接在列表中勾选考核项目，保存后即时生效。</Text>
        </Card>
        <Table
          columns={scheduleColumns}
          dataSource={schedules}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 31 }}
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  )
}

export default SemesterManage
