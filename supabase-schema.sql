-- 阳明心学考勤督察管理系统 - 数据库表结构

-- 1. 地区表
CREATE TABLE IF NOT EXISTS area (
  id SERIAL PRIMARY KEY,
  area_name VARCHAR(100) NOT NULL,
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 组织表（四级关联）
CREATE TABLE IF NOT EXISTS org (
  id SERIAL PRIMARY KEY,
  area_id INTEGER REFERENCES area(id) ON DELETE CASCADE,
  big_class VARCHAR(100) NOT NULL,
  class_name VARCHAR(100) NOT NULL,
  group_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(area_id, big_class, class_name, group_name)
);

-- 3. 学期表
CREATE TABLE IF NOT EXISTS semester (
  id SERIAL PRIMARY KEY,
  semester_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current INTEGER DEFAULT 0 CHECK (is_current IN (0, 1)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 考核项目表
CREATE TABLE IF NOT EXISTS assessment_item (
  id SERIAL PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL,
  fields JSONB NOT NULL DEFAULT '{}',
  formula TEXT NOT NULL,
  is_template INTEGER DEFAULT 0 CHECK (is_template IN (0, 1)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 学期日程表
CREATE TABLE IF NOT EXISTS semester_schedule (
  id SERIAL PRIMARY KEY,
  semester_id INTEGER REFERENCES semester(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  week_day INTEGER NOT NULL CHECK (week_day BETWEEN 1 AND 7),
  item_ids TEXT DEFAULT '',
  is_valid INTEGER DEFAULT 1 CHECK (is_valid IN (0, 1)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(semester_id, schedule_date)
);

-- 6. 人员表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  account VARCHAR(20) NOT NULL UNIQUE,
  org_id INTEGER REFERENCES org(id) ON DELETE SET NULL,
  role INTEGER DEFAULT 0 CHECK (role IN (0, 1, 2)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 考勤数据表
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES org(id) ON DELETE CASCADE,
  semester_id INTEGER REFERENCES semester(id) ON DELETE CASCADE,
  schedule_id INTEGER REFERENCES semester_schedule(id) ON DELETE CASCADE,
  fill_data JSONB NOT NULL DEFAULT '{}',
  result_data JSONB NOT NULL DEFAULT '{}',
  daily_rate DECIMAL(5,2) DEFAULT 0,
  fill_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, schedule_id)
);

-- 8. 周汇总表
CREATE TABLE IF NOT EXISTS week_summary (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES org(id) ON DELETE CASCADE,
  semester_id INTEGER REFERENCES semester(id) ON DELETE CASCADE,
  year_week VARCHAR(10) NOT NULL,
  week_rate DECIMAL(5,2) DEFAULT 0,
  rank_group INTEGER DEFAULT 0,
  rank_class INTEGER DEFAULT 0,
  rank_big_class INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, year_week)
);

-- 启用 Row Level Security (RLS)
ALTER TABLE area ENABLE ROW LEVEL SECURITY;
ALTER TABLE org ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE week_summary ENABLE ROW LEVEL SECURITY;

-- 公开访问策略（根据需要调整）
CREATE POLICY "Allow all access to area" ON area FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to org" ON org FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to semester" ON semester FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to assessment_item" ON assessment_item FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to semester_schedule" ON semester_schedule FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to week_summary" ON week_summary FOR ALL USING (true) WITH CHECK (true);

-- 创建默认考核项目模板
INSERT INTO assessment_item (item_name, fields, formula, is_template) VALUES
  ('上线率', '{"应到人数": "必填", "实到人数": "必填", "请假人数": "必填", "视频人数": "必填"}', '((实到人数+请假人数)/应到人数-请假人数*0.01)*100', 1),
  ('作业率', '{"应做作业人数": "必填", "作业完成人数": "必填"}', '作业完成人数/应做作业人数*100', 1),
  ('视频率', '{"视频人数": "必填", "实到人数": "必填"}', '视频人数/实到人数*100', 1);
