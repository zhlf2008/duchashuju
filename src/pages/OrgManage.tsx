import { useEffect, useState } from 'react'
import { Tree, Button, Modal, Form, Input, Select, message, Popconfirm, Space, Card, Typography } from 'antd'
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
  const [areaModalVisible, setAreaModalVisible] = useState(false)
  const [orgModalVisible, setOrgModalVisible] = useState(false)
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null)
  const [editingOrgId, setEditingOrgId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [orgForm] = Form.useForm()

  useEffect(() => {
    fetchData()
  }, [])

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
          key: `bigclass-${bigClass}`,
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
    const { error } = await supabase.from('area').delete().eq('id', id)
    if (error) {
      message.error('删除失败: ' + error.message)
    } else {
      message.success('删除成功')
      fetchData()
    }
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
    const { error } = await supabase.from('org').delete().eq('id', id)
    if (error) {
      message.error('删除失败: ' + error.message)
    } else {
      message.success('删除成功')
      fetchData()
    }
  }

  const renderTreeActions = (node: any) => {
    const actions: React.ReactNode[] = []

    if (node.key.startsWith('area-')) {
      actions.push(
        <Button
          key="edit-area"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            setEditingAreaId(node.id)
            form.setFieldsValue({ area_name: node.area_name, remark: node.remark })
            setAreaModalVisible(true)
          }}
        />
      )
      actions.push(
        <Popconfirm
          key="delete-area"
          title="确定删除？该操作会删除地区下所有组织"
          onConfirm={() => handleDeleteArea(node.id)}
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
      actions.push(
        <Button
          key="add-org"
          type="link"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingOrgId(null)
            orgForm.resetFields()
            orgForm.setFieldsValue({ area_id: node.id })
            setOrgModalVisible(true)
          }}
        />
      )
    } else if (node.isOrg && node.orgId) {
      actions.push(
        <Button
          key="edit-org"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            const org = orgs.find((o) => o.id === node.orgId)
            if (org) {
              setEditingOrgId(org.id)
              orgForm.setFieldsValue(org)
              setOrgModalVisible(true)
            }
          }}
        />
      )
      actions.push(
        <Popconfirm
          key="delete-org"
          title="确定删除？"
          onConfirm={() => handleDeleteOrg(node.orgId)}
        >
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>组织管理（四级架构）</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingAreaId(null); form.resetFields(); setAreaModalVisible(true) }}>
            新增地区
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => { setEditingOrgId(null); orgForm.resetFields(); setOrgModalVisible(true) }}>
            新增组织
          </Button>
        </Space>
      </div>

      <Card loading={loading}>
        <Tree
          treeData={treeData}
          titleRender={titleRender}
          defaultExpandAll
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
        title={editingOrgId ? '编辑组织' : '新增组织'}
        open={orgModalVisible}
        onCancel={() => { setOrgModalVisible(false); setEditingOrgId(null); orgForm.resetFields() }}
        onOk={() => orgForm.submit()}
        width={500}
      >
        <Form form={orgForm} onFinish={editingOrgId ? handleEditOrg : handleAddOrg} layout="vertical">
          <Form.Item name="area_id" label="地区" rules={[{ required: true, message: '请选择地区' }]}>
            <Select placeholder="请选择地区">
              {areas.map((a) => (
                <Select.Option key={a.id} value={a.id}>{a.area_name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="big_class" label="大班" rules={[{ required: true, message: '请输入大班名称' }]}>
            <Input placeholder="如：精进大班" />
          </Form.Item>
          <Form.Item name="class_name" label="班级" rules={[{ required: true, message: '请输入班级名称' }]}>
            <Input placeholder="如：1班" />
          </Form.Item>
          <Form.Item name="group_name" label="小组" rules={[{ required: true, message: '请输入小组名称' }]}>
            <Input placeholder="如：第1小组" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OrgManage
