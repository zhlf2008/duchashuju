import { useEffect, useState } from 'react'
import { Card, List, Typography, Spin, Empty, Tag } from 'antd'
import { supabase } from '../../services/supabase'
import dayjs from 'dayjs'

const { Title, Text } = Typography

interface MobileHistoryProps {
  userOrgId: number | null
  userRole?: number
}

interface HistoryItem {
  id: number
  schedule_date: string
  week_day: number
  semester_name: string
  org_name: string
  fill_data: any
  result_data: any
  created_at: string
}

function MobileHistory({ userOrgId, userRole }: MobileHistoryProps) {
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    loadHistory()
  }, [userOrgId, userRole])

  const loadHistory = async () => {
    if (!userOrgId) { setLoading(false); return }

    setLoading(true)

    // 审核人(role=0)：查询本级及以下所有组织的数据
    // 填报人(role=1)：只查本组织
    let query = supabase
      .from('attendance')
      .select(`
        id,
        fill_data,
        result_data,
        created_at,
        org:org_id(id, group_name, class_name, big_class, area_id),
        schedule:schedule_id(id, schedule_date, week_day, semester_id),
        semester:semester_id(id, semester_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (userRole === 0) {
      // 审核人：查本组织及所有子组织
      const { data: orgData } = await supabase
        .from('org')
        .select('*')
        .eq('id', userOrgId)
        .maybeSingle()

      if (orgData) {
        const level = !orgData.group_name ? 'area'
          : !orgData.class_name ? 'bigclass'
          : !orgData.big_class ? 'class' : 'group'

        if (level === 'area') {
          // 地区级：查同一 area_id 下的所有组织
          const { data: subOrgs } = await supabase
            .from('org')
            .select('id')
            .eq('area_id', orgData.area_id)
          const ids = subOrgs?.map(o => o.id) ?? []
          query = query.in('org_id', ids)
        } else if (level === 'bigclass') {
          // 大班级：查同一大班下的所有组织
          const { data: subOrgs } = await supabase
            .from('org')
            .select('id')
            .eq('big_class', orgData.big_class)
          const ids = subOrgs?.map(o => o.id) ?? []
          query = query.in('org_id', ids)
        } else if (level === 'class') {
          // 班级：查同一班级下的所有小组
          const { data: subOrgs } = await supabase
            .from('org')
            .select('id')
            .eq('class_name', orgData.class_name)
          const ids = subOrgs?.map(o => o.id) ?? []
          query = query.in('org_id', ids)
        } else {
          // 小组：只查本组
          query = query.eq('org_id', userOrgId)
        }
      } else {
        query = query.eq('org_id', userOrgId)
      }
    } else {
      // 填报人：只查本组织
      query = query.eq('org_id', userOrgId)
    }

    const { data } = await query

    if (data) {
      const items: HistoryItem[] = data.map((d: any) => ({
        id: d.id,
        schedule_date: d.schedule?.schedule_date || '',
        week_day: d.schedule?.week_day || 1,
        semester_name: d.semester?.semester_name || '',
        org_name: `${d.org?.big_class || ''} → ${d.org?.class_name || ''} → ${d.org?.group_name || ''}`,
        fill_data: d.fill_data,
        result_data: d.result_data,
        created_at: d.created_at,
      }))
      setHistory(items)
    }
    setLoading(false)
  }

  const weekDayNames = ['', '周日', '周一', '周二', '周三', '周四', '周五', '周六']

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>

  return (
    <div style={{ paddingBottom: 80 }}>
      <Title level={4} style={{ margin: '0 0 12px 0' }}>填报历史</Title>

      {history.length === 0 ? (
        <Empty description="暂无填报记录" />
      ) : (
        <List
          dataSource={history}
          renderItem={(item) => (
            <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Card size="small" style={{ width: '100%' }} bodyStyle={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>{dayjs(item.schedule_date).format('MM/DD')}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>{weekDayNames[item.week_day]}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(item.created_at).format('HH:mm')}</Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.semester_name}</Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 13 }}>{item.org_name}</Text>
                </div>
                {item.fill_data && Object.keys(item.fill_data).length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {Object.entries(item.fill_data).map(([key, val]) => (
                      <Tag key={key} color="blue">{key}: {String(val)}</Tag>
                    ))}
                  </div>
                )}
                {item.result_data && Object.keys(item.result_data).length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {Object.entries(item.result_data).map(([key, val]) => (
                      <Tag key={key} color={parseFloat(String(val)) > 100 ? 'red' : 'green'}>
                        {key}: {String(val)}%
                      </Tag>
                    ))}
                  </div>
                )}
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  )
}

export default MobileHistory