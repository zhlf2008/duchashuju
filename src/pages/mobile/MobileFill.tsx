import { useEffect, useState } from 'react'
import { Card, Select, Form, Input, Button, message, Spin, Typography } from 'antd'
import { supabase } from '../../services/supabase'
import dayjs from 'dayjs'

const { Text } = Typography
const { TextArea } = Input

interface MobileFillProps {
  userOrgId: number | null
}

interface OrgInfo {
  id: number
  area_id: number
  big_class: string
  class_name: string
  group_name: string
  area_name: string
  // 用户所在层级
  level: 'area' | 'bigclass' | 'class' | 'group'
}

interface AssessmentItem {
  id: number
  item_name: string
  fields: any
  formula: string
}

interface SemesterInfo {
  id: number
  semester_name: string
  start_date: string
  trial_start_date: string | null
}

interface ScheduleInfo {
  id: number
  schedule_date: string
  week_day: number
  item_ids: string
  is_valid: number
}

function MobileFill({ userOrgId }: MobileFillProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null)
  const [semester, setSemester] = useState<SemesterInfo | null>(null)
  const [currentWeek, setCurrentWeek] = useState<string>('')
  const [schedule, setSchedule] = useState<ScheduleInfo | null>(null)
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItem[]>([])

  const [formData, setFormData] = useState<Record<string, string>>({})
  const [computedResults, setComputedResults] = useState<Record<string, string>>({})


  const weekDayNames = ['', '周日', '周一', '周二', '周三', '周四', '周五', '周六']

  // 填报员需要选择具体填报的小组
  const [targetOrgOptions, setTargetOrgOptions] = useState<any[]>([])
  const [targetOrgId, setTargetOrgId] = useState<number | null>(null)
  const [targetOrgInfo, setTargetOrgInfo] = useState<OrgInfo | null>(null)

  useEffect(() => {
    if (!userOrgId) {
      message.error('用户未分配组织，请联系管理员')
      setLoading(false)
      return
    }
    loadData()
  }, [userOrgId])

  const loadData = async () => {
    setLoading(true)
    // 查用户所在组织信息
    const { data: orgData } = await supabase
      .from('org')
      .select('*, area:area_id(area_name)')
      .eq('id', userOrgId)
      .single()

    if (!orgData) {
      message.error('组织信息不存在')
      setLoading(false)
      return
    }

    // 判断用户层级
    const level = !orgData.group_name ? 'area' : !orgData.class_name ? 'bigclass' : !orgData.big_class ? 'class' : 'group'
    const orgInfo: OrgInfo = {
      ...orgData,
      area_name: (orgData.area as any)?.area_name || '',
      level: level as any,
    }
    setOrgInfo(orgInfo)

    // 如果是审核员(没有小组)但层级在班级或以上，可以查看和填报下级小组
    if (level !== 'group') {
      await loadSubOrgs(orgData, level)
    } else {
      // 填报员只能填报自己所在的小组
      setTargetOrgId(userOrgId)
      setTargetOrgInfo(orgInfo)
    }

    // 加载学期和日程
    await loadSemesterAndSchedule(orgInfo, level)

    setLoading(false)
  }

  const loadSubOrgs = async (org: OrgInfo, level: string) => {
    let query = supabase.from('org').select('*, area:area_id(area_name)')

    if (level === 'area') {
      query = query.eq('area_id', org.area_id)
    } else if (level === 'bigclass') {
      query = query.eq('area_id', org.area_id).eq('big_class', org.big_class)
    } else if (level === 'class') {
      query = query.eq('area_id', org.area_id).eq('big_class', org.big_class).eq('class_name', org.class_name)
    }

    const { data: subOrgs } = await query
    const groupOrgs = (subOrgs || []).filter((o: any) => o.group_name)

    const options = groupOrgs.map((o: any) => ({
      label: `${o.area?.area_name || ''} → ${o.big_class} → ${o.class_name} → ${o.group_name}`,
      value: o.id,
      org: {
        ...o,
        area_name: (o.area as any)?.area_name || '',
        level: 'group' as const,
      },
    }))

    setTargetOrgOptions(options)
    if (options.length > 0) {
      setTargetOrgId(options[0].value)
      setTargetOrgInfo(options[0].org)
    }
  }

  const loadSemesterAndSchedule = async (_org: OrgInfo, _level: string) => {
    // 找当前学期
    const { data: semesterData } = await supabase
      .from('semester')
      .select('*')
      .eq('is_current', 1)
      .maybeSingle()

    if (!semesterData) {
      message.warning('当前无有效学期')
      return
    }

    const sem: SemesterInfo = {
      id: semesterData.id,
      semester_name: semesterData.semester_name,
      start_date: semesterData.start_date,
      trial_start_date: semesterData.trial_start_date,
    }
    setSemester(sem)

    // 计算当前学期周次
    const trialStart = sem.trial_start_date
    const formalStart = sem.start_date
    const now = dayjs()
    const formalWeek = now.isAfter(dayjs(formalStart).subtract(1, 'day'))
      ? Math.ceil(now.diff(dayjs(formalStart), 'week', true)) + 1
      : 0
    const trialWeek = trialStart && now.isBefore(dayjs(formalStart))
      ? Math.ceil(dayjs(formalStart).diff(dayjs(trialStart), 'week', true))
      : 0
    const week = formalWeek > 0 ? formalWeek : -trialWeek
    setCurrentWeek(week > 0 ? `第${week}周` : '试晨读')

    // 查找当前日期对应的日程
    const { data: scheduleData } = await supabase
      .from('semester_schedule')
      .select('*')
      .eq('semester_id', sem.id)
      .eq('is_valid', 1)
      .lte('schedule_date', now.format('YYYY-MM-DD'))
      .order('schedule_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!scheduleData) {
      message.warning('今日无有效日程')
      return
    }

    const sched: ScheduleInfo = {
      id: scheduleData.id,
      schedule_date: scheduleData.schedule_date,
      week_day: scheduleData.week_day,
      item_ids: scheduleData.item_ids,
      is_valid: scheduleData.is_valid,
    }
    setSchedule(sched)

    // 加载考核项目
    const selectedIds = sched.item_ids ? sched.item_ids.split(',').filter(Boolean).map(Number) : []

    const { data: itemsData } = await supabase
      .from('assessment_item')
      .select('*')
      .in('id', selectedIds)

    setAssessmentItems(itemsData || [])
  }

  // 解析字段定义
  const parseFields = (fields: any) => {
    if (typeof fields === 'string') {
      try { return JSON.parse(fields) } catch { return {} }
    }
    return fields || {}
  }

  // 计算公式
  const evaluateFormula = (formula: string, data: Record<string, string>) => {
    try {
      // 替换字段名为实际值
      let expr = formula
      Object.entries(data).forEach(([key, val]) => {
        const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        expr = expr.replace(re, val || '0')
      })
      // 安全计算（仅允许数字和运算符）
      if (/^[\d\s+\-*/().]+$/.test(expr)) {
        const result = Function(`"use strict"; return (${expr})`)()
        return typeof result === 'number' ? result.toFixed(2) : String(result)
      }
    } catch { /* ignore */ }
    return ''
  }

  const handleFieldChange = (key: string, value: string) => {
    const newData = { ...formData, [key]: value }
    setFormData(newData)

    // 重新计算公式
    const item = assessmentItems[0]
    if (item?.formula) {
      const result = evaluateFormula(item.formula, newData)
      if (result) setComputedResults((prev: Record<string, string>) => ({ ...prev, [item.item_name]: result }))
    }
  }

  const handleSubmit = async () => {
    if (!targetOrgId || !schedule) {
      message.error('请选择要填报的组织')
      return
    }

    // 必填验证
    const allFields = assessmentItems.flatMap((item) => {
      const fields = parseFields(item.fields)
      return Object.entries(fields).map(([name, def]) => ({ item, name, def: def as string }))
    })

    for (const { name, def } of allFields) {
      const val = formData[`${name}`]
      if (def.includes('+必填') && !val) {
        message.error(`"${name}" 为必填项`)
        return
      }
    }

    // 超100%拦截
    for (const [itemName, result] of Object.entries(computedResults)) {
      if (parseFloat(result as string) > 100) {
        message.error(`"${itemName}" 计算结果超过100%，请检查数据`)
        return
      }
    }

    setSubmitting(true)

    const fillData: Record<string, string> = {}
    Object.entries(formData).forEach(([key, val]) => {
      fillData[key] = String(val)
    })

    const { error } = await supabase.from('attendance').upsert([{
      org_id: targetOrgId,
      semester_id: semester?.id,
      schedule_id: schedule.id,
      fill_data: fillData,
      result_data: computedResults,
      fill_user_id: (await supabase.auth.getUser()).data.user?.id,
    }], { onConflict: 'org_id,schedule_id' })

    setSubmitting(false)

    if (error) {
      message.error('提交失败: ' + error.message)
    } else {
      message.success('提交成功')
      setFormData({})
      setComputedResults({})
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>

  const displayOrg = targetOrgInfo || orgInfo

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* 顶部信息卡 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <Text type="secondary">{semester?.semester_name}</Text>
          <Text type="secondary">{currentWeek}</Text>
        </div>
        {schedule && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
            <Text type="secondary">{dayjs(schedule.schedule_date).format('MM/DD')}</Text>
            <Text type="secondary">{weekDayNames[schedule.week_day] || ''}</Text>
          </div>
        )}
        {displayOrg && (
          <div style={{ marginTop: 4, fontSize: 13, color: '#333' }}>
            填报组织：{displayOrg.area_name} → {displayOrg.big_class} → {displayOrg.class_name}
            {displayOrg.group_name ? ` → ${displayOrg.group_name}` : <Text type="danger" style={{ marginLeft: 4 }}>（选择小组）</Text>}
          </div>
        )}
      </Card>

      {/* 填报员选择具体小组 */}
      {orgInfo?.level !== 'group' && targetOrgOptions.length > 0 && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>选择填报小组</Text>
          <Select
            value={targetOrgId}
            onChange={(val) => {
              setTargetOrgId(val)
              const opt = targetOrgOptions.find((o) => o.value === val)
              setTargetOrgInfo(opt?.org || null)
            }}
            options={targetOrgOptions}
            style={{ width: '100%', marginTop: 4 }}
            placeholder="请选择要填报的小组"
          />
        </Card>
      )}

      {/* 考核项目字段 */}
      {assessmentItems.map((item) => {
        const fields = parseFields(item.fields)
        return (
          <Card key={item.id} title={item.item_name} size="small" style={{ marginBottom: 12 }}>
            {item.formula && computedResults[item.item_name] && (
              <div style={{ marginBottom: 8, fontSize: 13, color: parseFloat(computedResults[item.item_name]) > 100 ? '#ff4d4f' : '#52c41a' }}>
                计算结果：{computedResults[item.item_name]}%
              </div>
            )}
            <Form layout="vertical">
              {Object.entries(fields).map(([fieldName, fieldDef]) => {
                const def = fieldDef as string
                const required = def.includes('+必填') && !def.includes('非必填')
                const fieldKey = `${item.id}_${fieldName}`

                let inputEl: React.ReactNode = null
                if (def.includes('数字')) {
                  inputEl = <Input type="number" placeholder={`请输入${fieldName}`} onChange={(e) => handleFieldChange(fieldKey, e.target.value)} />
                } else if (def.includes('文本')) {
                  inputEl = <TextArea rows={2} placeholder={`请输入${fieldName}`} onChange={(e) => handleFieldChange(fieldKey, e.target.value)} />
                } else if (def.includes('单选') || def.includes('多选') || def.includes('下拉多选')) {
                  const eqIdx = def.indexOf('=')
                  const options = eqIdx !== -1 ? def.substring(eqIdx + 1).split(',') : []
                  inputEl = (
                    <Select placeholder={`请选择${fieldName}`} style={{ width: '100%' }} onChange={(val) => handleFieldChange(fieldKey, val)}>
                      {options.map((opt) => <Select.Option key={opt} value={opt}>{opt}</Select.Option>)}
                    </Select>
                  )
                } else {
                  inputEl = <Input placeholder={`请输入${fieldName}`} onChange={(e) => handleFieldChange(fieldKey, e.target.value)} />
                }

                return (
                  <Form.Item key={fieldKey} label={fieldName + (required ? ' *' : '')} required={required}>
                    {inputEl}
                  </Form.Item>
                )
              })}
            </Form>
          </Card>
        )
      })}

      {assessmentItems.length === 0 && (
        <Card>
          <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
            今日无考核项目或暂无权限填报
          </Text>
        </Card>
      )}

      <Button
        type="primary"
        block
        size="large"
        loading={submitting}
        onClick={handleSubmit}
        style={{ marginTop: 12 }}
        disabled={!targetOrgId || assessmentItems.length === 0}
      >
        提交填报
      </Button>
    </div>
  )
}

export default MobileFill