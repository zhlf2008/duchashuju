import { useEffect, useState, useMemo } from 'react'
import { Card, Table, Select, Row, Col, Statistic, Typography, Popconfirm, message, Cascader } from 'antd'
import { supabase } from '../services/supabase'
import dayjs from 'dayjs'
import type { Attendance, Org, Semester } from '../types'

const { Title } = Typography

function DataSummary() {
  const [loading, setLoading] = useState(false)
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null)
  const [orgs, setOrgs] = useState<Org[]>([])
  // 级联选择状态 [areaId, bigClass, className] 或 null
  const [orgPath, setOrgPath] = useState<string[] | null>(null)
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
  }, [selectedSemester, orgPath])

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
      .select('*, org:org_id(*, area:area_id(area_name)), schedule:schedule_id(schedule_date), user:fill_user_id(name)')
      .eq('semester_id', selectedSemester)

    // 按级联选择过滤
    if (orgPath && orgPath.length > 0) {
      const [areaId, bigClass, className] = orgPath
      if (areaId) query = query.eq('org.area_id', areaId)
      if (bigClass) query = query.eq('org.big_class', bigClass as string)
      if (className) query = query.eq('org.class_name', className as string)
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
      render: (org: Org) => (
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={getOrgName(org)}>
          {getOrgName(org)}
        </span>
      ),
      width: 280,
    },
    {
      title: '日期',
      dataIndex: 'schedule_date',
      key: 'schedule_date',
      width: 110,
      render: (_: any, record: any) => record.schedule?.schedule_date || '-',
    },
    {
      title: '出勤率',
      dataIndex: 'daily_rate',
      key: 'daily_rate',
      width: 90,
      render: (rate: number) => `${rate}%`,
    },
    {
      title: '填报人',
      dataIndex: 'fill_user_id',
      key: 'fill_user_id',
      width: 90,
      render: (_: any, record: any) => record.user?.name || '-',
    },
    {
      title: '填报时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: any) => (
        <Popconfirm
          title="确定删除该条填报记录？"
          onConfirm={async () => {
            const { error } = await supabase.from('attendance').delete().eq('id', record.id)
            if (error) {
              message.error('删除失败')
            } else {
              message.success('已删除')
              fetchData()
            }
          }}
        >
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>
      ),
    },
  ]

  // 构建级联选择数据：area → big_class → class_name
  const cascaderOptions = useMemo(() => {
    interface ClassNode { label: string; value: string; children: { label: string; value: string }[] }
    interface AreaNode { label: string; value: string; children: ClassNode[] }
    const areaMap = new Map<string, AreaNode>()
    orgs.forEach((o) => {
      const areaName = o.area?.area_name || '未知'
      const areaId = String(o.area_id)
      if (!areaMap.has(areaName)) {
        areaMap.set(areaName, { label: areaName, value: areaId, children: [] })
      }
      const areaNode = areaMap.get(areaName)!
      if (!areaNode.children.find((c) => c.value === o.big_class)) {
        areaNode.children.push({ label: o.big_class, value: o.big_class, children: [] })
      }
      const bigClassNode = areaNode.children.find((c) => c.value === o.big_class)!
      if (!bigClassNode.children.find((c) => c.value === o.class_name)) {
        bigClassNode.children.push({ label: o.class_name, value: o.class_name })
      }
    })
    return Array.from(areaMap.values())
  }, [orgs])

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
            <Cascader
              style={{ width: '100%' }}
              placeholder="选择组织（可选）"
              value={orgPath as any}
              onChange={(val: any) => setOrgPath(Array.isArray(val?.[0]) ? val[0] : val?.[0] ? [val[0]] : null)}
              options={cascaderOptions}
              changeOnSelect
              allowClear
            />
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 900 }}
      />
    </div>
  )
}

export default DataSummary
