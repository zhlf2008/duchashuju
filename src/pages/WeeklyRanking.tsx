import { useEffect, useState } from 'react'
import { Table, Card, Typography, Select, Spin, message } from 'antd'
import { supabase } from '../services/supabase'
import dayjs from 'dayjs'

const { Title, Text } = Typography

interface OrgRankItem {
  org_id: number
  org_name: string
  total_score: number
  fill_count: number
  avg_rate: number
}

interface WeekSummary {
  groups: OrgRankItem[]
  classes: OrgRankItem[]
  bigClasses: OrgRankItem[]
}

function WeeklyRanking() {
  const [semesters, setSemesters] = useState<any[]>([])
  const [currentSemester, setCurrentSemester] = useState<number | null>(null)
  const [weekNum, setWeekNum] = useState<string>('')
  const [weekSummary, setWeekSummary] = useState<WeekSummary>({ groups: [], classes: [], bigClasses: [] })
  const [orgPath, setOrgPath] = useState<string[]>([])
  const [orgOptions, setOrgOptions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    fetchSemesters()
    fetchOrgOptions()
  }, [])

  const fetchSemesters = async () => {
    const { data } = await supabase.from('semester').select('*').order('id', { ascending: false })
    if (data) {
      setSemesters(data)
      const current = data.find((s: any) => s.is_current === 1)
      if (current) {
        setCurrentSemester(current.id)
        const weekCount = getCurrentWeek(current.start_date)
        setWeekNum(String(weekCount))
      }
    }
  }

  const fetchOrgOptions = async () => {
    const { data } = await supabase
      .from('org')
      .select('*, area:area_id(id, area_name)')
      .order('id')
    if (data) {
      const grouped: any = {}
      data.forEach((org: any) => {
        const areaName = org.area?.area_name || ''
        if (!grouped[areaName]) grouped[areaName] = []
        grouped[areaName].push({ label: `${org.big_class} → ${org.class_name} → ${org.group_name}`, value: String(org.id), org })
      })
      const options = Object.entries(grouped).map(([area, classes]: [any, any]) => ({
        label: area,
        options: classes,
      }))
      setOrgOptions(options)
    }
  }

  const getCurrentWeek = (startDate: string) => {
    const start = dayjs(startDate)
    const now = dayjs()
    const diff = now.diff(start, 'week')
    return Math.max(1, diff + 1)
  }

  const getSemesterWeek = (semesterId: number, week: string) => {
    const semester = semesters.find((s) => s.id === semesterId)
    if (!semester) return week
    return `${semester.semester_name} 第${week}周`
  }

  const loadData = async () => {
    if (!currentSemester || !weekNum || orgPath.length < 3) {
      message.warning('请选择完整的组织路径（地区→大班→班级）')
      return
    }
    setLoading(true)
    const orgId = Number(orgPath[orgPath.length - 1])
    const orgRecord = orgOptions
      .flatMap((g: any) => g.options)
      .find((o: any) => o.value === String(orgId))?.org

    if (!orgRecord) { setLoading(false); return }

    const { area_id, big_class, class_name } = orgRecord

    const [{ data: groupData }, { data: classData }, { data: bigClassData }] = await Promise.all([
      supabase.from('week_summary').select('*').eq('semester_id', currentSemester).eq('week_num', weekNum).eq('area_id', area_id).eq('big_class', big_class).eq('class_name', class_name).order('total_score', { ascending: false }),
      supabase.from('week_summary').select('*').eq('semester_id', currentSemester).eq('week_num', weekNum).eq('area_id', area_id).eq('big_class', big_class).neq('class_name', class_name).order('total_score', { ascending: false }),
      supabase.from('week_summary').select('*').eq('semester_id', currentSemester).eq('week_num', weekNum).eq('area_id', area_id).neq('big_class', big_class).order('total_score', { ascending: false }),
    ])

    const toSummary = (data: any[] | null, type: 'group' | 'class' | 'bigclass'): OrgRankItem[] => {
      return (data || []).map((d: any) => ({
        org_id: d.org_id,
        org_name: type === 'group' ? d.group_name : type === 'class' ? d.class_name : d.big_class,
        total_score: d.total_score || 0,
        fill_count: d.fill_count || 0,
        avg_rate: d.avg_rate || 0,
      }))
    }

    setWeekSummary({
      groups: toSummary(groupData, 'group'),
      classes: toSummary(classData, 'class'),
      bigClasses: toSummary(bigClassData, 'bigclass'),
    })
    setHasData(true)
    setLoading(false)
  }

  const makeColumns = (title: string) => [
    { title: '排名', width: 60, render: (_: any, __: any, index: number) => index + 1 },
    { title, dataIndex: 'org_name', width: 150 },
    { title: '总分', dataIndex: 'total_score', width: 80 },
    { title: '填报次数', dataIndex: 'fill_count', width: 90 },
    {
      title: '平均上线率',
      dataIndex: 'avg_rate',
      width: 100,
      render: (v: number) => v ? `${v.toFixed(1)}%` : '-',
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>班级榜单</Title>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select
            placeholder="选择学期"
            value={currentSemester}
            onChange={(val) => setCurrentSemester(val)}
            style={{ width: 200 }}
          >
            {semesters.map((s) => (
              <Select.Option key={s.id} value={s.id}>{s.semester_name}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="周次"
            value={weekNum || undefined}
            onChange={(val) => setWeekNum(val)}
            style={{ width: 140 }}
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((w) => (
              <Select.Option key={w} value={String(w)}>
                {getSemesterWeek(currentSemester || 0, String(w))}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="选择组织（地区→大班→班级）"
            value={orgPath}
            onChange={(val) => setOrgPath(val as string[])}
            options={orgOptions}
            style={{ width: 300 }}
            showSearch
          />
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding: '4px 16px',
              background: '#1890ff',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '加载中...' : '查询'}
          </button>
        </div>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      )}

      {!loading && !hasData && (
        <Card>
          <Text type="secondary">请选择学期、周次和组织后点击"查询"</Text>
        </Card>
      )}

      {!loading && hasData && weekSummary.groups.length === 0 && weekSummary.classes.length === 0 && weekSummary.bigClasses.length === 0 && (
        <Card>
          <Text type="secondary">暂无本周排名数据，请确认是否在学期内且已有考勤填报记录。</Text>
        </Card>
      )}

      {!loading && hasData && weekSummary.groups.length > 0 && (
        <Card title="本班各小组排名" style={{ marginBottom: 16 }}>
          <Table
            columns={makeColumns('小组')}
            dataSource={weekSummary.groups.slice(0, 10)}
            rowKey="org_id"
            loading={loading}
            pagination={false}
            scroll={{ x: 500 }}
          />
        </Card>
      )}

      {!loading && hasData && weekSummary.classes.length > 0 && (
        <Card title="本大班各班级排名" style={{ marginBottom: 16 }}>
          <Table
            columns={makeColumns('班级')}
            dataSource={weekSummary.classes.slice(0, 10)}
            rowKey={(_, index) => `class-${index}`}
            loading={loading}
            pagination={false}
            scroll={{ x: 500 }}
          />
        </Card>
      )}

      {!loading && hasData && weekSummary.bigClasses.length > 0 && (
        <Card title="本地区各大班排名" style={{ marginBottom: 16 }}>
          <Table
            columns={makeColumns('大班')}
            dataSource={weekSummary.bigClasses.slice(0, 10)}
            rowKey={(_, index) => `bigclass-${index}`}
            loading={loading}
            pagination={false}
            scroll={{ x: 500 }}
          />
        </Card>
      )}
    </div>
  )
}

export default WeeklyRanking