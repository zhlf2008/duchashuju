import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Table, Typography } from 'antd'
import {
  TeamOutlined,
  ApartmentOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import { supabase } from '../services/supabase'

const { Title } = Typography

function Dashboard() {
  const [stats, setStats] = useState({
    areas: 0,
    orgs: 0,
    users: 0,
    semesters: 0,
  })
  const [recentAttendance, setRecentAttendance] = useState<any[]>([])

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const [areas, orgs, users, semesters] = await Promise.all([
      supabase.from('area').select('id', { count: 'exact' }),
      supabase.from('org').select('id', { count: 'exact' }),
      supabase.from('user').select('id', { count: 'exact' }),
      supabase.from('semester').select('id', { count: 'exact' }),
    ])
    setStats({
      areas: areas.count || 0,
      orgs: orgs.count || 0,
      users: users.count || 0,
      semesters: semesters.count || 0,
    })
  }

  return (
    <div>
      <Title level={3}>系统概览</Title>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="地区数量"
              value={stats.areas}
              prefix={<EnvironmentOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="组织数量"
              value={stats.orgs}
              prefix={<ApartmentOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="人员数量"
              value={stats.users}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="学期数量"
              value={stats.semesters}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="快捷操作">
            <Typography.Text>欢迎使用阳明心学考勤督察管理系统</Typography.Text>
            <div style={{ marginTop: 16 }}>
              <Typography.Text type="secondary">
                请从左侧菜单选择功能模块进行操作。
              </Typography.Text>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
