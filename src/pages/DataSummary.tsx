import { useEffect, useState } from 'react'
import { Card, Table, DatePicker, Select, Row, Col, Statistic, Typography, Button } from 'antd'
import { supabase } from '../services/supabase'
import dayjs from 'dayjs'
import type { Attendance, Org, Semester } from '../types'

const { Title } = Typography
const { RangePicker } = DatePicker

function DataSummary() {
  const [loading, setLoading] = useState(false)
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null)
  const [data, setData] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, avgRate: 0, count: 0 })

  useEffect(() => {
    fetchSemesters()
    fetchOrgs()
  }, [])

  useEffect(() => {
    if (selectedSemester) {
      fetchData()
    }
  }, [selectedSemester, selectedOrg])

  const fetchSemesters = async () => {
    const { data } = await supabase.from('semester').select('*').order('id', { ascending: false })
    if (data) {
      setSemesters(data)
      const current = data.find((s: Semester) => s.is_current === 1)
      if (current) setSelectedSemester(current.id)
    }
  }

  const fetchOrgs = async () => {
    const { data } = await supabase
      .from('org')
      .select('*, area:area_id(area_name)')
      .order('id')
    if (data) setOrgs(data)
  }

  const fetchData = async () => {
    setLoading(true)
    let query = supabase
      .from('attendance')
      .select('*, org:org_id(*, area:area_id(area_name))')
      .eq('semester_id', selectedSemester)

    if (selectedOrg) {
      query = query.eq('org_id', selectedOrg)
    }

    const { data: attendanceData } = await query.order('created_at', { ascending: false })

    if (attendanceData) {
      setData(attendanceData)

      const validData = attendanceData.filter((d: Attendance) => d.daily_rate > 0)
      const totalRate = validData.reduce((sum: number, d: Attendance) => sum + d.daily_rate, 0)
      setStats({
        total: validData.length,
        avgRate: validData.length > 0 ? Math.round((totalRate / validData.length) * 100) / 100 : 0,
        count: attendanceData.length,
      })
    }
    setLoading(false)
  }

  const getOrgName = (org: Org) => {
    if (!org) return '-'
    return `${org.area?.area_name || ''} → ${org.big_class} → ${org.class_name} → ${org.group_name}`
  }

  const columns = [
    {
      title: '组织',
      dataIndex: 'org',
      key: 'org',
      render: (org: Org) => getOrgName(org),
      width: 300,
    },
    {
      title: '日期',
      dataIndex: 'schedule_date',
      key: 'schedule_date',
      width: 120,
    },
    {
      title: '出勤率',
      dataIndex: 'daily_rate',
      key: 'daily_rate',
      width: 100,
      render: (rate: number) => `${rate}%`,
    },
    {
      title: '填报时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
  ]

  return (
    <div>
      <Title level={3}>数据汇总</Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="学期" value={semesters.find(s => s.id === selectedSemester)?.semester_name || '-'} />
          </Col>
          <Col span={6}>
            <Statistic title="填报记录数" value={stats.count} />
          </Col>
          <Col span={6}>
            <Statistic title="有效记录数" value={stats.total} />
          </Col>
          <Col span={6}>
            <Statistic title="平均出勤率" value={stats.avgRate} suffix="%" />
          </Col>
        </Row>
      </Card>

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
              placeholder="选择组织（可选）"
              style={{ width: '100%' }}
              allowClear
              value={selectedOrg}
              onChange={setSelectedOrg}
            >
              {orgs.map((o) => (
                <Select.Option key={o.id} value={o.id}>
                  {o.area?.area_name} → {o.big_class} → {o.class_name} → {o.group_name}
                </Select.Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 800 }}
      />
    </div>
  )
}

export default DataSummary
