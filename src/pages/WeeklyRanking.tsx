import { useEffect, useState, useMemo } from 'react'
import { Card, Table, Select, Row, Col, Typography, Tag, message } from 'antd'
import { TrophyOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import dayjs from 'dayjs'
import type { Semester } from '../types'

const { Title, Text } = Typography

/** 根据学期开始日期计算某日期在学期内的总周次（从1开始，含试晨读） */
function getSemesterWeek(date: dayjs.Dayjs, semesterStart: dayjs.Dayjs): number {
  const diff = date.diff(semesterStart, 'day')
  if (diff >= 0) {
    return Math.floor(diff / 7) + 1
  } else {
    return Math.ceil(Math.abs(diff) / 7)
  }
}

/** 获取指定学期周次的起止日期 */
function getSemesterWeekRange(
  semesterStart: dayjs.Dayjs,
  semesterWeek: number
): { start: dayjs.Dayjs; end: dayjs.Dayjs } {
  const start = semesterStart.add((semesterWeek - 1) * 7, 'day')
  const end = start.add(6, 'day')
  return { start, end }
}

/** 获取学期总周数 */
function getSemesterTotalWeeks(semesterStart: dayjs.Dayjs, semesterEnd: dayjs.Dayjs): number {
  return getSemesterWeek(semesterEnd, semesterStart)
}

/** 获取学期周次标签（试晨读/学期） */
function getSemesterWeekLabel(week: number, trialWeeks: number): string {
  if (trialWeeks > 0 && week <= trialWeeks) {
    return `试晨读第${week}周`
  }
  const semesterWeek = week - trialWeeks
  return `学期第${semesterWeek}周`
}

function WeeklyRanking() {
  const [loading, setLoading] = useState(false)
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null)
  const [weekSummary, setWeekSummary] = useState<{
    groups: any[]
    classes: any[]
    bigClasses: any[]
  }>({ groups: [], classes: [], bigClasses: [] })
  // 存储"学期周次"（从1开始）
  const [selectedSemesterWeek, setSelectedSemesterWeek] = useState<number>(1)

  // 当前选中学期对象
  const currentSemester = useMemo(
    () => semesters.find((s) => s.id === selectedSemester) || null,
    [semesters, selectedSemester]
  )

  useEffect(() => {
    fetchSemesters()
  }, [])

  useEffect(() => {
    if (selectedSemester) {
      fetchWeekSummary()
    }
  }, [selectedSemester, selectedSemesterWeek])

  const fetchSemesters = async () => {
    const { data } = await supabase.from('semester').select('*').order('id', { ascending: false })
    if (data) {
      setSemesters(data)
      const current = data.find((s: Semester) => s.is_current === 1)
      if (current) {
        setSelectedSemester(current.id)
        // 用学期当前周次初始化
        const semesterStart = dayjs(current.start_date)
        const week = getSemesterWeek(dayjs(), semesterStart)
        setSelectedSemesterWeek(week > 0 ? week : 1)
      } else if (data.length > 0) {
        setSelectedSemester(data[0].id)
      }
    }
  }

  const fetchWeekSummary = async () => {
    if (!currentSemester) return
    setLoading(true)
    setWeekSummary({ groups: [], classes: [], bigClasses: [] })

    const semesterStart = dayjs(currentSemester.start_date)
    const { start: weekStart, end: weekEnd } = getSemesterWeekRange(semesterStart, selectedSemesterWeek)

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*, org:org_id(*, area:area_id(area_name))')
      .eq('semester_id', selectedSemester)
      .gte('schedule_date', weekStart.format('YYYY-MM-DD'))
      .lte('schedule_date', weekEnd.format('YYYY-MM-DD'))

    if (!attendanceData || attendanceData.length === 0) {
      message.info('本周暂无考勤数据')
      setLoading(false)
      return
    }

    // ============ 1. 班级内小组排名 ============
    // group by org_id (each group), then average within same class for class-level grouping
    const groupMap = new Map<number, { total: number; count: number; org: any }>()
    // class-level: key = (big_class, class_name), value = array of group rates
    const classMap = new Map<string, { total: number; count: number; big_class: string; class_name: string }>()
    // big-class-level: key = (area, big_class), value = array of class rates
    const bigClassMap = new Map<string, { total: number; count: number; area: string; big_class: string }>()

    attendanceData.forEach((item: any) => {
      if (!groupMap.has(item.org_id)) {
        groupMap.set(item.org_id, { total: 0, count: 0, org: item.org })
      }
      groupMap.get(item.org_id)!.total += item.daily_rate || 0
      groupMap.get(item.org_id)!.count += 1

      const org = item.org
      if (!org) return
      const classKey = `${org.big_class}||${org.class_name}`
      if (!classMap.has(classKey)) {
        classMap.set(classKey, { total: 0, count: 0, big_class: org.big_class, class_name: org.class_name })
      }
      classMap.get(classKey)!.total += item.daily_rate || 0
      classMap.get(classKey)!.count += 1

      const bigClassKey = `${org.area?.area_name || ''}||${org.big_class}`
      if (!bigClassMap.has(bigClassKey)) {
        bigClassMap.set(bigClassKey, { total: 0, count: 0, area: org.area?.area_name || '', big_class: org.big_class })
      }
      bigClassMap.get(bigClassKey)!.total += item.daily_rate || 0
      bigClassMap.get(bigClassKey)!.count += 1
    })

    // 小组排名
    const groupRanking = Array.from(groupMap.entries()).map(([orgId, data]) => {
      const avgRate = data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0
      return {
        org_id: orgId,
        org_name: `${data.org?.class_name || ''} → ${data.org?.group_name || ''}`,
        week_rate: avgRate,
        rank: 0,
      }
    })
    groupRanking.sort((a, b) => b.week_rate - a.week_rate)
    const rankedGroups = groupRanking.map((item, index) => ({ ...item, rank: index + 1 }))

    // 班级排名（同一大班内的各班级）
    const classRanking = Array.from(classMap.entries()).map(([_classKey, data]) => {
      const avgRate = data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0
      return {
        org_name: `${data.big_class} → ${data.class_name}`,
        week_rate: avgRate,
        rank: 0,
      }
    })
    classRanking.sort((a, b) => b.week_rate - a.week_rate)
    const rankedClasses = classRanking.map((item, index) => ({ ...item, rank: index + 1 }))

    // 大班排名（同一地区内的各大班）
    const bigClassRanking = Array.from(bigClassMap.entries()).map(([_bigClassKey, data]) => {
      const avgRate = data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0
      return {
        org_name: `${data.area} → ${data.big_class}`,
        week_rate: avgRate,
        rank: 0,
      }
    })
    bigClassRanking.sort((a, b) => b.week_rate - a.week_rate)
    const rankedBigClasses = bigClassRanking.map((item, index) => ({ ...item, rank: index + 1 }))

    setWeekSummary({ groups: rankedGroups, classes: rankedClasses, bigClasses: rankedBigClasses })
    setLoading(false)
  }

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { background: '#FFD700', color: '#000' }
    if (rank === 2) return { background: '#C0C0C0', color: '#000' }
    if (rank === 3) return { background: '#CD7F32', color: '#fff' }
    return {}
  }

  const makeColumns = (title: string) => [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => (
        <Tag style={{ ...getRankStyle(rank), fontWeight: 'bold' }}>
          {rank <= 3 ? <TrophyOutlined /> : ''} {rank}
        </Tag>
      ),
    },
    { title: title, dataIndex: 'org_name', key: 'org_name', ellipsis: true },
    {
      title: '出勤率',
      dataIndex: 'week_rate',
      key: 'week_rate',
      render: (rate: number) => <Text strong>{rate}%</Text>,
    },
  ]

  // 根据学期日期范围生成周次选项（包含试晨读周）
  const semesterWeekOptions = useMemo(() => {
    if (!currentSemester) return []
    const start = dayjs(currentSemester.start_date)
    const end = dayjs(currentSemester.end_date)
    const formalWeeks = getSemesterTotalWeeks(start, end)
    const trialWeeks = currentSemester.trial_weeks || 0
    const totalWeeks = formalWeeks + trialWeeks
    return Array.from({ length: totalWeeks }, (_, i) => i + 1)
  }, [currentSemester])

  const hasData = weekSummary.groups.length > 0 || weekSummary.classes.length > 0 || weekSummary.bigClasses.length > 0

  return (
    <div>
      <Title level={3}>班级榜单</Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Select
              placeholder="选择学期"
              style={{ width: '100%' }}
              value={selectedSemester}
              onChange={(val) => {
                setSelectedSemester(val)
                const sem = semesters.find((s) => s.id === val)
                if (sem) {
                  const semStart = dayjs(sem.start_date)
                  const now = dayjs()
                  const week = getSemesterWeek(now, semStart)
                  setSelectedSemesterWeek(week > 0 ? week : 1)
                }
              }}
            >
              {semesters.map((s) => (
                <Select.Option key={s.id} value={s.id}>
                  {s.semester_name}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={12}>
            <Select
              placeholder="选择周次"
              style={{ width: '100%' }}
              value={selectedSemesterWeek}
              onChange={setSelectedSemesterWeek}
            >
              {semesterWeekOptions.map((w) => {
                const trialWeeks = currentSemester?.trial_weeks || 0
                const label = getSemesterWeekLabel(w, trialWeeks)
                const { start, end } = getSemesterWeekRange(dayjs(currentSemester?.start_date), w)
                return (
                  <Select.Option key={w} value={w}>
                    {label} ({start.format('MM/DD')}-{end.format('MM/DD')})
                  </Select.Option>
                )
              })}
            </Select>
          </Col>
        </Row>
      </Card>

      {!loading && !hasData && (
        <Card>
          <Text type="secondary">暂无本周排名数据，请确认是否在学期内且已有考勤填报记录。</Text>
        </Card>
      )}

      {!loading && weekSummary.classes.length > 0 && (
        <Card title="本大班各班级排名" style={{ marginBottom: 16 }}>
          <Table
            columns={makeColumns('班级')}
            dataSource={weekSummary.classes.slice(0, 10)}
            rowKey={(_, index) => `class-${index}`}
            loading={loading}
            pagination={false}
          />
        </Card>
      )}

      {!loading && weekSummary.bigClasses.length > 0 && (
        <Card title="本地区各大班排名" style={{ marginBottom: 16 }}>
          <Table
            columns={makeColumns('大班')}
            dataSource={weekSummary.bigClasses.slice(0, 10)}
            rowKey={(_, index) => `bigclass-${index}`}
            loading={loading}
            pagination={false}
          />
        </Card>
      )}

      {!loading && weekSummary.groups.length > 0 && (
        <Card title="本班各小组排名" style={{ marginBottom: 16 }}>
          <Table
            columns={makeColumns('小组')}
            dataSource={weekSummary.groups.slice(0, 10)}
            rowKey="org_id"
            loading={loading}
            pagination={false}
          />
        </Card>
      )}
    </div>
  )
}

export default WeeklyRanking
