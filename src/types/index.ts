export interface Area {
  id: number
  area_name: string
  remark?: string
  created_at?: string
}

export interface Org {
  id: number
  area_id: number
  big_class: string
  class_name: string
  group_name: string
  created_at?: string
}

export interface Semester {
  id: number
  semester_name: string
  start_date: string
  end_date: string
  is_current: number
  created_at?: string
}

export interface AssessmentItem {
  id: number
  item_name: string
  fields: Record<string, '必填' | '非必填'>
  formula: string
  is_template: number
  created_at?: string
}

export interface ScheduleDate {
  id: number
  semester_id: number
  schedule_date: string
  week_day: number
  item_ids: string
  is_valid: number
  created_at?: string
}

export interface User {
  id: number
  name: string
  email: string
  org_id: number
  role: 0 | 1 | 2
  created_at?: string
}

export interface Attendance {
  id: number
  org_id: number
  semester_id: number
  schedule_id: number
  fill_data: Record<string, number>
  result_data: Record<string, number>
  daily_rate: number
  fill_user_id: number
  created_at?: string
}

export interface WeekSummary {
  id: number
  org_id: number
  semester_id: number
  year_week: string
  week_rate: number
  rank_group: number
  rank_class: number
  rank_big_class: number
  created_at?: string
}

export interface OrgFull extends Org {
  area_name?: string
}

export interface UserFull extends User {
  area_name?: string
  big_class?: string
  class_name?: string
  group_name?: string
}
