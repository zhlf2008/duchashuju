import { useEffect, useState } from 'react'
import { Card, Table, Select, Row, Col, Typography, Tag, message } from 'antd'
import { TrophyOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import type { Semester } from '../types'

dayjs.extend(weekOfYear)

const { Title, Text } = Typography

function WeeklyRanking() {
  const [loading, setLoading] = useState(false)
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null)
  const [weekSummary, setWeekSummary] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState(dayjs().year())
  const [selectedWeek, setSelectedWeek] = useState(dayjs().week())

  const currentWeekKey = `${selectedYear}-W${String(selectedWeek).padStart(2, '0')}`

  useEffect(() => {
    fetchSemesters()
  }, [])

  useEffect(() => {
    if (selectedSemester) {
      fetchWeekSummary()
    }
  }, [selectedSemester, currentWeekKey])

  const fetchSemesters = async () => {
    const { data } = await supabase.from('semester').select('*').order('id', { ascending: false })
    if (data) {
      setSemesters(data)
      const current = data.find((s: Semester) => s.is_current === 1)
      if (current) setSelectedSemester(current.id)
      else if (data.length > 0) setSelectedSemester(data[0].id)
    }
  }

  const fetchWeekSummary = async () => {
    setLoading(true)
    setWeekSummary([])

    const weekStart = dayjs().year(selectedYear).week(selectedWeek).startOf('week').format('YYYY-MM-DD')
    const weekEnd = dayjs().year(selectedYear).week(selectedWeek).endOf('week').format('YYYY-MM-DD')

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*, org:org_id(*, area:area_id(area_name))')
      .eq('semester_id', selectedSemester)
      .gte('attendance_date', weekStart)
      .lte('attendance_date', weekEnd)

    if (!attendanceData || attendanceData.length === 0) {
      message.info('本周暂无考勤数据')
      setLoading(false)
      return
    }

    const orgRates: Record<number, { total: number; count: number; org: any }> = {}

    attendanceData.forEach((item: any) => {
      if (!orgRates[item.org_id]) {
        orgRates[item.org_id] = { total: 0, count: 0, org: item.org }
      }
      orgRates[item.org_id].total += item.daily_rate || 0
      orgRates[item.org_id].count += 1
    })

    const calculated = Object.entries(orgRates).map(([orgId, data]) => {
      const avgRate = data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0
      return {
        org_id: parseInt(orgId),
        org_name: data.org ? `${data.org.area?.area_name || ''} → ${data.org.big_class || ''} → ${data.org.class_name || ''} → ${data.org.group_name || ''}` : '-',
        week_rate: avgRate,
        rank_group: 0,
        org_level: data.org ? {
          area: data.org.area?.area_name,
          big_class: data.org.big_class,
          class_name: data.org.class_name,
          group_name: data.org.group_name,
        } : null,
      }
    })

    calculated.sort((a, b) => b.week_rate - a.week_rate)

    const ranked = calculated.map((item, index) => ({
      ...item,
      rank_group: index + 1,
    }))

    setWeekSummary(ranked)
    setLoading(false)
  }

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { background: '#FFD700', color: '#000' }
    if (rank === 2) return { background: '#C0C0C0', color: '#000' }
    if (rank === 3) return { background: '#CD7F32', color: '#fff' }
    return {}
  }

  const groupRanking = weekSummary.filter((item) => item.org_level?.group_name)

  const groupColumns = [
    {
      title: '排名',
      dataIndex: 'rank_group',
      key: 'rank_group',
      width: 80,
      render: (rank: number) => (
        <Tag style={{ ...getRankStyle(rank), fontWeight: 'bold' }}>
          {rank <= 3 ? <TrophyOutlined /> : ''} {rank}
        </Tag>
      ),
    },
    { title: '小组', dataIndex: 'org_name', key: 'org_name' },
    {
      title: '周出勤率',
      dataIndex: 'week_rate',
      key: 'week_rate',
      render: (rate: number) => <Text strong>{rate}%</Text>,
    },
  ]

  const yearOptions = Array.from({ length: 3 }, (_, i) => dayjs().year() - i)
  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1)

  return (
    <div>
      <Title level={3}>周排名光荣榜</Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Select
              placeholder="选择学期"
              style={{ width: '100%' }}
              value={selectedSemester}
              onChange={setSelectedSemester}
            >
              {semesters.map((s) => (
                <Select.Option key={s.id} value={s.id}>
                  {s.semester_name}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <Select
              placeholder="选择年份"
              style={{ width: '100%' }}
              value={selectedYear}
              onChange={setSelectedYear}
            >
              {yearOptions.map((y) => (
                <Select.Option key={y} value={y}>{y} 年</Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <Select
              placeholder="选择周次"
              style={{ width: '100%' }}
              value={selectedWeek}
              onChange={setSelectedWeek}
            >
              {weekOptions.map((w) => (
                <Select.Option key={w} value={w}>
                  第 {w} 周 ({dayjs().year(selectedYear).week(w).startOf('week').format('MM/DD')}-{dayjs().year(selectedYear).week(w).endOf('week').format('MM/DD')})
                </Select.Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="🏆 小组周排名 TOP 10" style={{ marginBottom: 16 }}>
            <Table
              columns={groupColumns}
              dataSource={groupRanking.slice(0, 10)}
              rowKey="org_id"
              loading={loading}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      {weekSummary.length === 0 && !loading && (
        <Card>
          <Text type="secondary">暂无本周排名数据，请确认是否在学期内且已有考勤填报记录。</Text>
        </Card>
      )}
    </div>
  )
}

export default WeeklyRanking
