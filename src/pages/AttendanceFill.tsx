import { useEffect, useState } from 'react'
import { Card, Form, Input, Button, message, Alert, Typography, Divider, Row, Col } from 'antd'
import { supabase } from '../services/supabase'
import dayjs from 'dayjs'
import type { Semester, ScheduleDate, AssessmentItem } from '../types'

const { Title, Text } = Typography

function AttendanceFill() {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [semester, setSemester] = useState<Semester | null>(null)
  const [schedule, setSchedule] = useState<ScheduleDate | null>(null)
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>([])
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    checkTodayAttendance()
  }, [])

  const checkTodayAttendance = async () => {
    setLoading(true)
    const today = dayjs().format('YYYY-MM-DD')
    const weekDay = dayjs().day() + 1

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      message.error('请先登录')
      setLoading(false)
      return
    }
    setCurrentUser(user)

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('account', user.phone)
      .single()

    if (!userData) {
      message.error('用户信息不存在')
      setLoading(false)
      return
    }

    const { data: currentSemester } = await supabase
      .from('semester')
      .select('*')
      .eq('is_current', 1)
      .single()

    if (!currentSemester) {
      message.warning('当前没有设置学期，请联系管理员')
      setLoading(false)
      return
    }
    setSemester(currentSemester)

    const { data: todaySchedule } = await supabase
      .from('semester_schedule')
      .select('*')
      .eq('semester_id', currentSemester.id)
      .eq('schedule_date', today)
      .eq('is_valid', 1)
      .single()

    if (!todaySchedule) {
      message.info('今日无需填报')
      setLoading(false)
      return
    }
    setSchedule(todaySchedule)

    if (todaySchedule.item_ids) {
      const itemIds = todaySchedule.item_ids.split(',').filter(Boolean)
      if (itemIds.length > 0) {
        const { data: items } = await supabase
          .from('assessment_item')
          .select('*')
          .in('id', itemIds)
        setAssessmentItems(items || [])
      }
    }

    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('org_id', userData.org_id)
      .eq('schedule_id', todaySchedule.id)
      .single()

    if (existingAttendance) {
      setHasSubmitted(true)
      message.info('今日已填报，可编辑修改')
    }

    setLoading(false)
  }

  const calculateResult = (item: AssessmentItem, values: any): number => {
    try {
      let formula = item.formula
      const fields = typeof item.fields === 'string' ? JSON.parse(item.fields) : item.fields

      Object.keys(fields).forEach((fieldName) => {
        const regex = new RegExp(fieldName, 'g')
        formula = formula.replace(regex, values[fieldName] || 0)
      })

      let result = eval(formula)
      return Math.round(result * 100) / 100
    } catch {
      return 0
    }
  }

  const onFinish = async (values: any) => {
    if (!currentUser || !schedule || !semester) return

    setSubmitting(true)

    const { data: userData } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('account', currentUser.phone)
      .single()

    const resultData: Record<string, number> = {}
    let totalRate = 0

    assessmentItems.forEach((item) => {
      const result = calculateResult(item, values)
      resultData[item.item_name] = result
      totalRate += result
    })

    const dailyRate = assessmentItems.length > 0 ? Math.round((totalRate / assessmentItems.length) * 100) / 100 : 0

    const fillData: Record<string, number> = {}
    Object.keys(values).forEach((key) => {
      if (typeof values[key] === 'number') {
        fillData[key] = values[key]
      }
    })

    const { error } = await supabase.from('attendance').upsert({
      org_id: userData?.org_id,
      semester_id: semester.id,
      schedule_id: schedule.id,
      fill_data: fillData,
      result_data: resultData,
      daily_rate: dailyRate,
      fill_user_id: userData?.id,
    }, {
      onConflict: 'org_id,schedule_id',
    })

    if (error) {
      message.error('提交失败: ' + error.message)
    } else {
      message.success('提交成功')
      setHasSubmitted(true)
    }
    setSubmitting(false)
  }

  if (loading) {
    return <div style={{ padding: 50, textAlign: 'center' }}>加载中...</div>
  }

  if (!semester || !schedule) {
    return (
      <Card>
        <Alert message="今日无需填报考勤数据" type="info" showIcon />
      </Card>
    )
  }

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={4}>考勤数据填报</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Text type="secondary">日期：{dayjs().format('YYYY-MM-DD')}</Text>
            </Col>
            <Col span={8}>
              <Text type="secondary">学期：{semester?.semester_name}</Text>
            </Col>
            <Col span={8}>
              <Text type="secondary">星期：{['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs().day()]}</Text>
            </Col>
          </Row>
          {hasSubmitted && (
            <Alert message="今日已填报，提交后将覆盖原数据" type="warning" showIcon style={{ marginTop: 16 }} />
          )}
        </div>

        <Divider />

        <Form
          form={form}
          onFinish={onFinish}
          layout="vertical"
        >
          {assessmentItems.map((item) => {
            const fields = typeof item.fields === 'string' ? JSON.parse(item.fields) : item.fields
            return (
              <Card key={item.id} title={item.item_name} style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  {Object.entries(fields).map(([fieldName, required]) => (
                    <Col span={12} key={fieldName}>
                      <Form.Item
                        name={fieldName}
                        label={fieldName}
                        rules={[{ required: required === '必填', message: `请输入${fieldName}` }]}
                      >
                        <Input type="number" placeholder={`请输入${fieldName}`} />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                <Text type="secondary">公式：{item.formula}</Text>
              </Card>
            )
          })}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} size="large" block>
              提交考勤数据
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default AttendanceFill
