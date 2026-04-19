import { useEffect, useState } from 'react'
import { Card, Table, Select, Row, Col, Typography, Tag } from 'antd'
import { TrophyOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import dayjs from 'dayjs'
import type { Org, Semester, WeekSummary } from '../types'

const { Title, Text } = Typography

function WeeklyRanking() {
  const [loading, setLoading] = useState(false)
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [weekSummary, setWeekSummary] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState(dayjs().format('YYYY-WW'))

  useEffect(() => {
    fetchSemesters()
    fetchOrgs()
  }, [])

  useEffect(() => {
    if (selectedSemester) {
      fetchWeekSummary()
    }
  }, [selectedSemester, currentWeek])

  const fetchSemesters = async () => {
    const { data } = await supabase.from('semester').select('*').order('id', { ascending: false })
    if (data) {
      setSemesters(data)
      const current = data.find((s: Semester) => s.is_current === 1)
      if (current) setSelectedSemester(current.id)
      else if (data.length > 0) setSelectedSemester(data[0].id)
    }
  }

  const fetchOrgs = async () => {
    const { data } = await supabase
      .from('org')
      .select('*, area:area_id(area_name)')
      .order('id')
    if (data) setOrgs(data)
  }

  const fetchWeekSummary = async () => {
    setLoading(true)

    const { data: summaryData } = await supabase
      .from('week_summary')
      .select('*')
      .eq('semester_id', selectedSemester)
      .eq('year_week', currentWeek)
      .order('rank_group')

    if (summaryData && summaryData.length > 0) {
      const enrichedData = summaryData.map((item: WeekSummary) => {
        const org = orgs.find((o) => o.id === item.org_id)
        return {
          ...item,
          org_name: org ? `${org.area?.area_name} → ${org.big_class} → ${org.class_name} → ${org.group_name}` : '-',
          org_level: org ? {
            area: org.area?.area_name,
            big_class: org.big_class,
            class_name: org.class_name,
            group_name: org.group_name,
          } : null,
        }
      })
      setWeekSummary(enrichedData)
    } else {
      const weekStart = dayjs().startOf('week').format('YYYY-MM-DD')
      const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD')

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*, org:org_id(*, area:area_id(area_name))')
        .eq('semester_id', selectedSemester)
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd + ' 23:59:59')

      const orgRates: Record<number, { total: number; count: number; org: any }> = {}

      attendanceData?.forEach((item: any) => {
        if (!orgRates[item.org_id]) {
          orgRates[item.org_id] = { total: 0, count: 0, org: item.org }
        }
        orgRates[item.org_id].total += item.daily_rate
        orgRates[item.org_id].count += 1
      })

      const calculated = Object.entries(orgRates).map(([orgId, data]) => {
        const avgRate = data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0
        return {
          org_id: parseInt(orgId),
          org_name: `${data.org.area?.area_name} → ${data.org.big_class} → ${data.org.class_name} → ${data.org.group_name}`,
          week_rate: avgRate,
          rank_group: 0,
          org_level: {
            area: data.org.area?.area_name,
            big_class: data.org.big_class,
            class_name: data.org.class_name,
            group_name: data.org.group_name,
          },
        }
      })

      calculated.sort((a, b) => b.week_rate - a.week_rate)

      const ranked = calculated.map((item, index) => ({
        ...item,
        rank_group: index + 1,
      }))

      setWeekSummary(ranked)
    }
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

  return (
    <div>
      <Title level={3}>周排名光荣榜</Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
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
          <Col span={12}>
            <Select
              placeholder="选择周次"
              style={{ width: '100%' }}
              value={currentWeek}
              onChange={setCurrentWeek}
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const week = dayjs().subtract(i, 'week').format('YYYY-WW')
                return (
                  <Select.Option key={week} value={week}>
                    第 {dayjs().subtract(i, 'week').format('WW')} 周 ({dayjs().subtract(i, 'week').startOf('week').format('MM/DD')} - {dayjs().subtract(i, 'week').endOf('week').format('MM/DD')})
                  </Select.Option>
                )
              })}
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
