import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Typography } from 'antd'
import {
  TeamOutlined,
  ApartmentOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import { supabase } from '../services/supabase'

const { Title } = Typography

function Dashboard() {
  const [stats, setStats] = useState({
    areas: 0,
    bigClasses: 0,
    classes: 0,
    groups: 0,
    users: 0,
    semesters: 0,
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const [areas, users, semesters, orgData] = await Promise.all([
      supabase.from('area').select('id', { count: 'exact' }),
      supabase.from('user').select('id', { count: 'exact' }),
      supabase.from('semester').select('id', { count: 'exact' }),
      supabase.from('org').select('big_class, class_name, group_name'),
    ])
    const allOrgs = orgData.data || []
    const bigClasses = new Set(allOrgs.map((o) => o.big_class).filter(Boolean)).size
    const classes = new Set(allOrgs.map((o) => o.class_name).filter(Boolean)).size
    const groups = new Set(allOrgs.map((o) => o.group_name).filter(Boolean)).size
    setStats({
      areas: areas.count || 0,
      bigClasses,
      classes,
      groups,
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
              title="大班数量"
              value={stats.bigClasses}
              prefix={<ApartmentOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="班级数量"
              value={stats.classes}
              prefix={<ApartmentOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="小组数量"
              value={stats.groups}
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
