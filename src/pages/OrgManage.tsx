import { useEffect, useState, useMemo } from 'react'
import { Tree, Button, Modal, Form, Input, Select, message, Popconfirm, Space, Card, Typography, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { supabase } from '../services/supabase'
import type { Area, Org } from '../types'

const { Title } = Typography

interface AreaWithOrgs extends Area {
  children?: any[]
}

function OrgManage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [areaModalVisible, setAreaModalVisible] = useState(false)
  const [orgModalVisible, setOrgModalVisible] = useState(false)
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null)
  const [editingOrgId, setEditingOrgId] = useState<number | null>(null)
  const [addOrgLevel, setAddOrgLevel] = useState<'bigclass' | 'class' | 'group'>('bigclass')
  // 大班/班级独立编辑
  const [editBigClassVisible, setEditBigClassVisible] = useState(false)
  const [editClassVisible, setEditClassVisible] = useState(false)
  const [editBigClassData, setEditBigClassData] = useState<{ area_id: number; old_big_class: string } | null>(null)
  const [editClassData, setEditClassData] = useState<{ area_id: number; big_class: string; old_class_name: string } | null>(null)
  const [form] = Form.useForm()
  const [orgForm] = Form.useForm()
  const [formAreaId, setFormAreaId] = useState<number | undefined>()
  const [formBigClass, setFormBigClass] = useState<string | undefined>()

  const bigClassOptions = useMemo(() => {
    if (!formAreaId) return []
    const areaOrgs = orgs.filter((o) => o.area_id === formAreaId)
    return [...new Set(areaOrgs.map((o) => o.big_class))].map((bc) => ({ value: bc, label: bc }))
  }, [orgs, formAreaId])

  const classOptions = useMemo(() => {
    if (!formAreaId || !formBigClass) return []
    const filtered = orgs.filter((o) => o.area_id === formAreaId && o.big_class === formBigClass)
    return [...new Set(filtered.map((o) => o.class_name))].map((cn) => ({ value: cn, label: cn }))
  }, [orgs, formAreaId, formBigClass])

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (orgModalVisible && editingOrgId) {
      const org = orgs.find((o) => o.id === editingOrgId)
      if (org) {
        setFormAreaId(org.area_id)
        setFormBigClass(org.big_class)
        orgForm.setFieldsValue({
          area_id: org.area_id,
          big_class: org.big_class,
          class_name: org.class_name,
          group_name: org.group_name,
        })
      }
    }
  }, [orgModalVisible])

  const fetchData = async () => {
    setLoading(true)
    const [areasData, orgsData] = await Promise.all([
      supabase.from('area').select('*').order('id'),
      supabase.from('org').select('*, area:area_id(area_name)').order('area_id'),
    ])
    if (areasData.data) setAreas(areasData.data)
    if (orgsData.data) setOrgs(orgsData.data)
    setLoading(false)
  }

  const buildTreeData = (): AreaWithOrgs[] => {
    return areas.map((area) => {
      const areaOrgs = orgs.filter((o) => o.area_id === area.id)
      const bigClasses = [...new Set(areaOrgs.map((o) => o.big_class))]

      const children = bigClasses.map((bigClass) => {
        const classOrgs = areaOrgs.filter((o) => o.big_class === bigClass)
        const classNames = [...new Set(classOrgs.map((o) => o.class_name))]

        const classChildren = classNames.map((className) => {
          const groupOrgs = classOrgs.filter((o) => o.class_name === className)
          const groupNames = [...new Set(groupOrgs.map((o) => o.group_name))]

          const groupChildren = groupNames.map((groupName) => {
            const groupOrg = groupOrgs.find((o) => o.group_name === groupName)
            return {
              title: groupName,
              key: `org-${groupOrg?.id}`,
              isOrg: true,
              orgId: groupOrg?.id,
            }
          })

          return {
            title: className,
            key: `class-${bigClass}-${className}`,
            children: groupChildren,
          }
        })

        return {
          title: bigClass,
          key: `bigclass-${area.id}-${bigClass}`,
          children: classChildren,
        }
      })

      return {
        ...area,
        title: area.area_name,
        key: `area-${area.id}`,
        children,
      }
    })
  }

  const handleExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys)
  }

  const handleAddArea = async (values: { area_name: string; remark?: string }) => {
    const { error } = await supabase.from('area').insert([values])
    if (error) {
      message.error('添加失败: ' + error.message)
    } else {
      message.success('添加成功')
      setAreaModalVisible(false)
      form.resetFields()
      fetchData()
    }
  }

  const handleEditArea = async (values: { area_name: string; remark?: string }) => {
    if (!editingAreaId) return
    const { error } = await supabase.from('area').update(values).eq('id', editingAreaId)
    if (error) {
      message.error('修改失败: ' + error.message)
    } else {
      message.success('修改成功')
      setAreaModalVisible(false)
      setEditingAreaId(null)
      form.resetFields()
      fetchData()
    }
  }

  const handleDeleteArea = async (id: number) => {
    setExpandedKeys((prev) => prev.filter((k) => !String(k).startsWith(`area-${id}`)))
    const { error } = await supabase.from('area').delete().eq('id', id)
    if (error) {
      message.error('删除失败: ' + error.message)
    } else {
      message.success('删除成功')
      fetchData()
    }
  }

  // 编辑大班名称（批量更新所有该大班下的org记录）
  const handleEditBigClass = async (values: { new_big_class: string }) => {
    if (!editBigClassData) return
    const { error } = await supabase
      .from('org')
      .update({ big_class: values.new_big_class })
      .eq('area_id', editBigClassData.area_id)
      .eq('big_class', editBigClassData.old_big_class)
    if (error) {
      message.error('修改失败: ' + error.message)
    } else {
      message.success('修改成功')
      setEditBigClassVisible(false)
      setEditBigClassData(null)
      fetchData()
    }
  }

  // 编辑班级名称（批量更新所有该班级下的org记录）
  const handleEditClass = async (values: { new_class_name: string }) => {
    if (!editClassData) return
    const { error } = await supabase
      .from('org')
      .update({ class_name: values.new_class_name })
      .eq('area_id', editClassData.area_id)
      .eq('big_class', editClassData.big_class)
      .eq('class_name', editClassData.old_class_name)
    if (error) {
      message.error('修改失败: ' + error.message)
    } else {
      message.success('修改成功')
      setEditClassVisible(false)
      setEditClassData(null)
      fetchData()
    }
  }

  const openAddOrgModal = (level: 'bigclass' | 'class' | 'group', context: { area_id?: number; big_class?: string; class_name?: string } = {}) => {
    setAddOrgLevel(level)
    setFormAreaId(context.area_id)
    setFormBigClass(context.big_class)
    orgForm.resetFields()
    orgForm.setFieldsValue(context)
    setOrgModalVisible(true)
  }

  const handleAddOrg = async (values: { area_id: number; big_class: string; class_name: string; group_name: string }) => {
    const { error } = await supabase.from('org').insert([values])
    if (error) {
      message.error('添加失败: ' + error.message)
    } else {
      message.success('添加成功')
      setOrgModalVisible(false)
      orgForm.resetFields()
      fetchData()
    }
  }

  const handleEditOrg = async (values: { area_id: number; big_class: string; class_name: string; group_name: string }) => {
    if (!editingOrgId) return
    const { error } = await supabase.from('org').update(values).eq('id', editingOrgId)
    if (error) {
      message.error('修改失败: ' + error.message)
    } else {
      message.success('修改成功')
      setOrgModalVisible(false)
      setEditingOrgId(null)
      orgForm.resetFields()
      fetchData()
    }
  }

  const handleDeleteOrg = async (id: number) => {
    setExpandedKeys((prev) => prev.filter((k) => !String(k).startsWith(`org-${id}`)))
    const { error } = await supabase.from('org').delete().eq('id', id)
    if (error) {
      message.error('删除失败: ' + error.message)
    } else {
      message.success('删除成功')
      fetchData()
    }
  }

  // 导出 CSV
  const handleExport = () => {
    const rows = [['地区', '大班', '班级', '小组']]
    orgs.forEach((o) => {
      const area = areas.find((a) => a.id === o.area_id)
      rows.push([area?.area_name || '', o.big_class, o.class_name, o.group_name])
    })
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '组织架构.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // 导入 CSV
  const uploadProps: UploadProps = {
    accept: '.csv',
    showUploadList: false,
    beforeUpload: async (file) => {
      const text = await file.text()
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) {
        message.warning('CSV 文件无有效数据')
        return false
      }
      const header = lines[0].split(',').map((h) => h.replace(/"/g, '').trim())
      const areaIdx = header.findIndex((h) => h.includes('地区'))
      const bcIdx = header.findIndex((h) => h.includes('大班'))
      const cIdx = header.findIndex((h) => h.includes('班级'))
      const gIdx = header.findIndex((h) => h.includes('小组'))
      if (areaIdx < 0 || bcIdx < 0 || cIdx < 0 || gIdx < 0) {
        message.error('CSV 格式不正确，请使用导出模板')
        return false
      }
      let imported = 0
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/"/g, '').trim())
        if (!cols[areaIdx] || !cols[bcIdx] || !cols[cIdx] || !cols[gIdx]) continue
        // 查找或创建地区
        let area = areas.find((a) => a.area_name === cols[areaIdx])
        if (!area) {
          const { data: newArea } = await supabase.from('area').insert({ area_name: cols[areaIdx] }).select().single()
          if (newArea) {
            area = newArea
            setAreas((prev) => [...prev, area!])
          }
        }
        if (!area) continue
        const { error } = await supabase.from('org').insert({
          area_id: area.id,
          big_class: cols[bcIdx],
          class_name: cols[cIdx],
          group_name: cols[gIdx],
        })
        if (!error) imported++
      }
      message.success(`成功导入 ${imported} 条组织`)
      fetchData()
      return false
    },
  }

  // 折叠的节点显示操作按钮，展开的节点隐藏按钮
  const renderTreeActions = (node: any) => {
    if (expandedKeys.includes(node.key)) return null

    const actions: React.ReactNode[] = []

    if (node.key.startsWith('area-')) {
      actions.push(
        <Button key="edit-area" type="link" size="small" icon={<EditOutlined />} onClick={() => {
          setEditingAreaId(node.id)
          form.setFieldsValue({ area_name: node.area_name, remark: node.remark })
          setAreaModalVisible(true)
        }} />
      )
      actions.push(
        <Popconfirm key="delete-area" title="确定删除？该操作会删除地区下所有组织" onConfirm={() => handleDeleteArea(node.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
      actions.push(
        <Button key="add-bigclass" type="link" size="small" icon={<PlusOutlined />} onClick={() => {
          openAddOrgModal('bigclass', { area_id: node.id })
        }} />
      )
    } else if (node.key.startsWith('bigclass-')) {
      const [, areaId, bigClassName] = node.key.split('-')
      actions.push(
        <Button key="edit-bigclass" type="link" size="small" icon={<EditOutlined />} onClick={() => {
          setEditBigClassData({ area_id: Number(areaId), old_big_class: bigClassName })
          setEditBigClassVisible(true)
        }} />
      )
      actions.push(
        <Popconfirm key="delete-bigclass" title="确定删除该大班及其所有下级？" onConfirm={async () => {
          const toDelete = orgs.filter((o) => o.area_id === Number(areaId) && o.big_class === bigClassName)
          for (const org of toDelete) {
            await supabase.from('org').delete().eq('id', org.id)
          }
          setExpandedKeys((prev) => prev.filter((k) => !String(k).startsWith(`bigclass-${areaId}-${bigClassName}`)))
          message.success('删除成功')
          fetchData()
        }}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
      actions.push(
        <Button key="add-class" type="link" size="small" icon={<PlusOutlined />} onClick={() => {
          openAddOrgModal('class', { area_id: Number(areaId), big_class: bigClassName })
        }} />
      )
    } else if (node.key.startsWith('class-')) {
      const [, bigClassName, className] = node.key.split('-')
      const areaId = orgs.find((o) => o.big_class === bigClassName && o.class_name === className)?.area_id
      actions.push(
        <Button key="edit-class" type="link" size="small" icon={<EditOutlined />} onClick={() => {
          setEditClassData({ area_id: areaId!, big_class: bigClassName, old_class_name: className })
          setEditClassVisible(true)
        }} />
      )
      actions.push(
        <Popconfirm key="delete-class" title="确定删除该班级及其所有小组？" onConfirm={async () => {
          const toDelete = orgs.filter((o) => o.big_class === bigClassName && o.class_name === className)
          for (const org of toDelete) {
            await supabase.from('org').delete().eq('id', org.id)
          }
          setExpandedKeys((prev) => prev.filter((k) => !String(k).startsWith(`class-${bigClassName}-${className}`)))
          message.success('删除成功')
          fetchData()
        }}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
      actions.push(
        <Button key="add-group" type="link" size="small" icon={<PlusOutlined />} onClick={() => {
          openAddOrgModal('group', { area_id: areaId, big_class: bigClassName, class_name: className })
        }} />
      )
    } else if (node.isOrg && node.orgId) {
      actions.push(
        <Button key="edit-org" type="link" size="small" icon={<EditOutlined />} onClick={() => {
          const org = orgs.find((o) => o.id === node.orgId)
          if (org) {
            setEditingOrgId(org.id)
            orgForm.setFieldsValue(org)
            setOrgModalVisible(true)
          }
        }} />
      )
      actions.push(
        <Popconfirm key="delete-org" title="确定删除？" onConfirm={() => handleDeleteOrg(node.orgId)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }

    return <Space size="small">{actions}</Space>
  }

  const treeData = buildTreeData()

  const titleRender = (nodeData: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <span>{nodeData.title}</span>
      {renderTreeActions(nodeData)}
    </div>
  )

  const orgModalTitle = (() => {
    if (editingOrgId) return '编辑组织'
    if (addOrgLevel === 'bigclass') return '新增大班'
    if (addOrgLevel === 'class') return '新增班级'
    return '新增小组'
  })()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>组织管理</Title>
        <Space>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />}>批量导入</Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
        </Space>
      </div>

      <Card loading={loading}>
        <Tree
          treeData={treeData}
          titleRender={titleRender}
          expandedKeys={expandedKeys}
          onExpand={handleExpand}
          showLine={{ showLeafIcon: false }}
        />
      </Card>

      <Modal
        title={editingAreaId ? '编辑地区' : '新增地区'}
        open={areaModalVisible}
        onCancel={() => { setAreaModalVisible(false); setEditingAreaId(null); form.resetFields() }}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={editingAreaId ? handleEditArea : handleAddArea} layout="vertical">
          <Form.Item name="area_name" label="地区名称" rules={[{ required: true, message: '请输入地区名称' }]}>
            <Input placeholder="如：北京地区" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="备注信息（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={orgModalTitle}
        open={orgModalVisible}
        onCancel={() => { setOrgModalVisible(false); setEditingOrgId(null); orgForm.resetFields() }}
        onOk={() => orgForm.submit()}
        width={500}
      >
        <Form form={orgForm} onFinish={editingOrgId ? handleEditOrg : handleAddOrg} layout="vertical">
          <Form.Item name="area_id" label="地区" rules={[{ required: true, message: '请选择地区' }]}>
            <Select
              placeholder="请选择地区"
              onChange={(val) => { setFormAreaId(val); setFormBigClass(undefined); orgForm.setFieldsValue({ big_class: undefined, class_name: undefined }) }}
            >
              {areas.map((a) => (
                <Select.Option key={a.id} value={a.id}>{a.area_name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          {(addOrgLevel === 'bigclass' && !editingOrgId) ? (
            <Form.Item name="big_class" label="大班" rules={[{ required: true, message: '请输入大班名称' }]}>
              <Input placeholder="如：精进大班" />
            </Form.Item>
          ) : (
            <Form.Item name="big_class" label="大班" rules={[{ required: true, message: '请选择大班' }]}>
              <Select placeholder="请选择大班" allowClear onChange={(val) => { setFormBigClass(val); orgForm.setFieldsValue({ class_name: undefined }) }}>
                {bigClassOptions.map((o) => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
              </Select>
            </Form.Item>
          )}

          {(addOrgLevel === 'class' && !editingOrgId) ? (
            <Form.Item name="class_name" label="班级" rules={[{ required: true, message: '请输入班级名称' }]}>
              <Input placeholder="如：1班" />
            </Form.Item>
          ) : (
            <Form.Item name="class_name" label="班级" rules={[{ required: true, message: '请选择班级' }]}>
              <Select placeholder="请选择班级" allowClear disabled={!formBigClass}>
                {classOptions.map((o) => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="group_name" label="小组" rules={[{ required: true, message: '请输入小组名称' }]}>
            <Input placeholder="如：第1小组" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑大班名称 Modal */}
      <Modal
        title="编辑大班"
        open={editBigClassVisible}
        onCancel={() => { setEditBigClassVisible(false); setEditBigClassData(null) }}
        onOk={() => {
          const newName = (document.getElementById('new-big-class-input') as HTMLInputElement)?.value
          if (newName) handleEditBigClass({ new_big_class: newName })
        }}
      >
        {editBigClassData && (
          <div>
            <div style={{ marginBottom: 8, color: '#666' }}>
              当前大班：<strong>{editBigClassData.old_big_class}</strong>
            </div>
            <Input
              id="new-big-class-input"
              placeholder="请输入新大班名称"
              defaultValue={editBigClassData.old_big_class}
            />
          </div>
        )}
      </Modal>

      {/* 编辑班级名称 Modal */}
      <Modal
        title="编辑班级"
        open={editClassVisible}
        onCancel={() => { setEditClassVisible(false); setEditClassData(null) }}
        onOk={() => {
          const newName = (document.getElementById('new-class-name-input') as HTMLInputElement)?.value
          if (newName) handleEditClass({ new_class_name: newName })
        }}
      >
        {editClassData && (
          <div>
            <div style={{ marginBottom: 8, color: '#666' }}>
              当前班级：<strong>{editClassData.old_class_name}</strong>
            </div>
            <Input
              id="new-class-name-input"
              placeholder="请输入新班级名称"
              defaultValue={editClassData.old_class_name}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default OrgManage
