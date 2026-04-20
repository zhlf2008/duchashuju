import { useEffect, useState, useMemo } from 'react'
import { Tree, Button, Modal, Form, Input, Select, message, Popconfirm, Space, Card, Typography, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
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
  // 当前要新增的层级
  const [addOrgLevel, setAddOrgLevel] = useState<'bigclass' | 'class' | 'group'>('bigclass')
  const [form] = Form.useForm()
  const [orgForm] = Form.useForm()
  // 级联选择状态
  const [formAreaId, setFormAreaId] = useState<number | undefined>()
  const [formBigClass, setFormBigClass] = useState<string | undefined>()
  // 级联下拉选项
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

  // 弹窗打开时，如果是编辑状态则初始化级联选择
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
    // 清理展开状态
    setExpandedKeys((prev) => prev.filter((k) => !String(k).startsWith(`area-${id}`)))
    const { error } = await supabase.from('area').delete().eq('id', id)
    if (error) {
      message.error('删除失败: ' + error.message)
    } else {
      message.success('删除成功')
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

  // 折叠的节点显示操作按钮，展开的节点隐藏按钮（让子级显示按钮）
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
      // bigclass key 格式: bigclass-${areaId}-${bigClass}
      const [, areaId, bigClassName] = node.key.split('-')
      actions.push(
        <Button key="edit-bigclass" type="link" size="small" icon={<EditOutlined />} onClick={() => {
          // 编辑任意一条属于该 bigclass 的 org 来修改 bigclass 名
          const existing = orgs.find((o) => o.area_id === Number(areaId) && o.big_class === bigClassName)
          if (existing) {
            setEditingOrgId(existing.id)
            orgForm.setFieldsValue(existing)
            setOrgModalVisible(true)
          }
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
      // class key 格式: class-${bigClass}-${className}
      const [, bigClassName, className] = node.key.split('-')
      const areaId = orgs.find((o) => o.big_class === bigClassName && o.class_name === className)?.area_id
      actions.push(
        <Button key="edit-class" type="link" size="small" icon={<EditOutlined />} onClick={() => {
          const existing = orgs.find((o) => o.big_class === bigClassName && o.class_name === className)
          if (existing) {
            setEditingOrgId(existing.id)
            orgForm.setFieldsValue(existing)
            setOrgModalVisible(true)
          }
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

  // 右上角新增按钮下拉菜单
  const addMenuItems: MenuProps['items'] = [
    {
      key: 'area',
      label: '新增地区',
      onClick: () => { setEditingAreaId(null); form.resetFields(); setAreaModalVisible(true) },
    },
    { type: 'divider' },
    {
      key: 'bigclass',
      label: '新增大班',
      onClick: () => openAddOrgModal('bigclass', {}),
    },
    {
      key: 'class',
      label: '新增班级',
      onClick: () => openAddOrgModal('class', {}),
    },
    {
      key: 'group',
      label: '新增小组',
      onClick: () => openAddOrgModal('group', {}),
    },
  ]

  // orgModal 的标题根据层级变化
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
        <Dropdown menu={{ items: addMenuItems }} trigger={['click']} placement="bottomRight">
          <Button type="primary" icon={<PlusOutlined />}>新增</Button>
        </Dropdown>
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

          {/* 大班：新增大班=输入；新增班级/小组=选择；编辑=选择 */}
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

          {/* 班级：新增小组=选择；其他=输入；编辑=选择 */}
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

          {/* 小组：新增=输入；编辑=输入（小组名不可选） */}
          <Form.Item name="group_name" label="小组" rules={[{ required: true, message: '请输入小组名称' }]}>
            <Input placeholder="如：第1小组" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OrgManage
