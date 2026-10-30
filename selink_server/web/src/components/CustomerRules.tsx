import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, InputNumber, message, Space, Table, Tag } from 'antd'
import { api, put } from '../api/client'
import { useAuth } from '../auth'

type Rule = { code: string; name: string; order: number; min_count: number; occurrence_pct: number; relative_pct: number }

export default function CustomerRules({ machineId, result }: { machineId: string; result: any }) {
  const { can } = useAuth()
  const qc = useQueryClient()
  const query = useQuery<{ rules: Rule[] }>({ queryKey: ['customer-rules', machineId], queryFn: () => api(`/machines/${machineId}/customer-rules`), refetchOnWindowFocus: false })
  const [rules, setRules] = useState<Rule[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<string>()
  const [form] = Form.useForm()
  useEffect(() => { setRules(query.data?.rules || []); setDirty(false); form.resetFields() }, [query.data, machineId, form])
  const save = async () => {
    setSaving(true)
    try {
      const data = await put(`/machines/${machineId}/customer-rules`, { rules })
      qc.setQueryData(['customer-rules', machineId], data)
      setDirty(false)
      message.success('Đã lưu. Bấm Phân tích để cập nhật kết quả theo quy tắc mới.')
    } catch (error: any) { message.error(error.message) } finally { setSaving(false) }
  }
  return <Space direction="vertical" style={{ width: '100%' }}>
    <span className="muted">Quy tắc dùng cho máy này, trên trục và loại phổ đang phân tích. % so với 1X được kiểm tra trong cùng capture; 0% bỏ điều kiện này. Kết quả là dấu hiệu cần kiểm tra.</span>
    {query.isError && <Alert type="error" message="Không tải được quy tắc" action={<Button onClick={() => query.refetch()}>Thử lại</Button>} />}
    <Table size="small" rowKey="code" pagination={false} dataSource={rules} scroll={{ x: 850 }} columns={[
      { title: 'Mã lỗi', dataIndex: 'code' }, { title: 'Tên lỗi', dataIndex: 'name' },
      { title: 'Bậc', dataIndex: 'order', render: v => `${v}X` },
      { title: 'Số lần ≥', dataIndex: 'min_count' },
      { title: 'Xuất hiện ≥', dataIndex: 'occurrence_pct', render: v => `${v}%` },
      { title: 'So với 1X ≥', dataIndex: 'relative_pct', render: v => `${v}%` },
      { title: 'Kết quả', render: (_, rule) => {
        const row = result?.customer_rules?.find((r: Rule) => r.code === rule.code)
        if (dirty || !row || Object.keys(rule).some(k => row[k] !== rule[k as keyof Rule])) return 'Chờ phân tích'
        return <><Tag color={row.status === 'matched' ? 'orange' : 'default'}>{row.status === 'matched' ? 'Đạt điều kiện' : row.status === 'no_data' ? 'Thiếu dữ liệu' : 'Chưa đạt'}</Tag>{row.count}/{row.captures} ({row.actual_pct}%)</>
      } },
      ...(can('engineer') ? [{ title: '', render: (_: unknown, rule: Rule) => <Space>
        <Button size="small" onClick={() => { setEditing(rule.code); form.setFieldsValue(rule) }}>Sửa</Button>
        <Button danger size="small" onClick={() => { setRules(rules.filter(r => r.code !== rule.code)); setDirty(true); if (editing === rule.code) { setEditing(undefined); form.resetFields() } }}>Xóa</Button>
      </Space> }] : []),
    ]} />
    {can('engineer') && <>
      <Form form={form} layout="inline" initialValues={{ order: 2, min_count: 1, occurrence_pct: 50, relative_pct: 5 }} onFinish={(rule: Rule) => {
        if (!editing && rules.length >= 30) { message.error('Tối đa 30 quy tắc'); return }
        const clean = { ...rule, code: rule.code.trim(), name: rule.name.trim() }
        if (rules.some(r => r.code !== editing && r.code.toLowerCase() === clean.code.toLowerCase())) { message.error('Mã lỗi đã tồn tại'); return }
        setRules(editing ? rules.map(r => r.code === editing ? clean : r) : [...rules, clean]); setDirty(true); setEditing(undefined); form.resetFields()
      }}>
        <Form.Item name="code" label="Mã lỗi" rules={[{ required: true, whitespace: true }]}><Input maxLength={40} style={{ width: 110 }} /></Form.Item>
        <Form.Item name="name" label="Tên lỗi" rules={[{ required: true, whitespace: true }]}><Input maxLength={120} style={{ width: 170 }} /></Form.Item>
        <Form.Item name="order" label="Bậc X" rules={[{ required: true }]}><InputNumber min={1} max={30} precision={0} /></Form.Item>
        <Form.Item name="min_count" label="Số lần ≥" rules={[{ required: true }]}><InputNumber min={1} max={500} precision={0} /></Form.Item>
        <Form.Item name="occurrence_pct" label="Xuất hiện ≥ %" rules={[{ required: true }]}><InputNumber min={0} max={100} /></Form.Item>
        <Form.Item name="relative_pct" label="So với 1X ≥ %" rules={[{ required: true }]}><InputNumber min={0} max={10000} /></Form.Item>
        <Button htmlType="submit" disabled={!query.isSuccess}>{editing ? 'Cập nhật' : 'Thêm'}</Button>
        {editing && <Button onClick={() => { setEditing(undefined); form.resetFields() }}>Hủy sửa</Button>}
      </Form>
      <Button type="primary" loading={saving} disabled={!dirty || !query.isSuccess} onClick={save}>Lưu quy tắc</Button>
    </>}
  </Space>
}
