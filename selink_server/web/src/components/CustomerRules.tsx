import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Form, Input, InputNumber, message, Modal, Popconfirm, Skeleton, Space, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SafetyCertificateOutlined, SaveOutlined } from '@ant-design/icons'
import { api, put } from '../api/client'
import { useAuth } from '../auth'

type Rule = { code: string; name: string; order: number; min_count: number; occurrence_pct: number; relative_pct: number }
const defaults = { order: 2, min_count: 1, occurrence_pct: 50, relative_pct: 5 }

export default function CustomerRules({ machineId, machineName, result }: { machineId: string; machineName?: string; result: any }) {
  const { can } = useAuth()
  const qc = useQueryClient()
  const query = useQuery<{ rules: Rule[] }>({ queryKey: ['customer-rules', machineId], queryFn: () => api(`/machines/${machineId}/customer-rules`), refetchOnWindowFocus: false })
  const [rules, setRules] = useState<Rule[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<string>()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<Rule>()
  useEffect(() => { setRules(query.data?.rules || []); setDirty(false); setOpen(false); setEditing(undefined); form.resetFields() }, [query.data, machineId, form])
  const startEdit = (rule?: Rule) => {
    setEditing(rule?.code)
    form.resetFields()
    form.setFieldsValue(rule || defaults)
    setOpen(true)
  }
  const save = async () => {
    setSaving(true)
    try {
      const data = await put(`/machines/${machineId}/customer-rules`, { rules })
      qc.setQueryData(['customer-rules', machineId], data)
      setDirty(false)
      message.success('Đã lưu. Bấm Phân tích để cập nhật kết quả theo quy tắc mới.')
    } catch (error: any) { message.error(error.message) } finally { setSaving(false) }
  }
  const submit = (rule: Rule) => {
    if (!editing && rules.length >= 30) { message.error('Tối đa 30 quy tắc'); return }
    const clean = { ...rule, code: rule.code.trim(), name: rule.name.trim() }
    if (rules.some(r => r.code !== editing && r.code.toLowerCase() === clean.code.toLowerCase())) { form.setFields([{ name: 'code', errors: ['Mã lỗi này đã tồn tại'] }]); return }
    setRules(editing ? rules.map(r => r.code === editing ? clean : r) : [...rules, clean])
    setDirty(true); setOpen(false); setEditing(undefined); form.resetFields()
  }
  return <section className="customer-rules" aria-label="Mã lỗi và quy tắc theo máy">
    <div className="customer-rules-header">
      <div className="customer-rules-heading"><span className="customer-rules-icon"><SafetyCertificateOutlined /></span><div>
        <h3>Mã lỗi & quy tắc khách hàng <span className="customer-rules-count">{rules.length}</span></h3>
        <p>Cấu hình riêng cho <strong>{machineName || machineId}</strong></p>
      </div></div>
      {can('engineer') && <Button type="primary" icon={<PlusOutlined aria-hidden />} disabled={!query.isSuccess || saving || rules.length >= 30} onClick={() => startEdit()}>Thêm quy tắc</Button>}
    </div>
    {query.isError && <Alert type="error" showIcon message="Không tải được quy tắc" action={<Button onClick={() => query.refetch()}>Thử lại</Button>} />}
    {query.isPending ? <Skeleton active paragraph={{ rows: 2 }} /> : !rules.length ? <div className="customer-rules-empty">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><b>Chưa có quy tắc cho máy này</b><span>Thêm mã lỗi và điều kiện để tự động đối chiếu khi phân tích.</span></>} />
    </div> : <div className="customer-rule-list">{rules.map(rule => {
      const row = result?.customer_rules?.find((r: Rule) => r.code === rule.code)
      const current = !dirty && row && !Object.keys(rule).some(k => row[k] !== rule[k as keyof Rule])
      return <article className="customer-rule" key={rule.code}>
        <div className="customer-rule-title"><div><Tag color="blue">{rule.code}</Tag><strong>{rule.name}</strong></div>
          {can('engineer') && <Space size={4}>
            <Button icon={<EditOutlined aria-hidden />} disabled={saving} onClick={() => startEdit(rule)}>Sửa</Button>
            <Popconfirm title={`Xóa quy tắc ${rule.code}?`} description="Thay đổi có hiệu lực sau khi lưu." okText="Xóa" cancelText="Hủy" onConfirm={() => { setRules(rules.filter(r => r.code !== rule.code)); setDirty(true) }}>
              <Button danger type="text" icon={<DeleteOutlined aria-hidden />} disabled={saving}>Xóa</Button>
            </Popconfirm>
          </Space>}
        </div>
        <div className="customer-rule-metrics">
          <div><span>Bậc hài</span><b>{rule.order}X</b></div>
          <div><span>Số lần tối thiểu</span><b>{rule.min_count}<small> lần</small></b></div>
          <div><span>Tỷ lệ xuất hiện</span><b>≥ {rule.occurrence_pct}<small>%</small></b></div>
          <div><span>Biên độ so với 1X</span><b>{rule.relative_pct ? <>≥ {rule.relative_pct}<small>%</small></> : 'Không giới hạn'}</b></div>
        </div>
        <div className="customer-rule-result"><Tag color={current && row.status === 'matched' ? 'orange' : 'default'}>{!current ? 'Chờ phân tích' : row.status === 'matched' ? 'Đạt điều kiện' : row.status === 'no_data' ? 'Thiếu dữ liệu' : 'Chưa đạt'}</Tag>
          <span>{current ? `${row.count}/${row.captures} lần đo · ${row.actual_pct}% xuất hiện` : 'Bấm Phân tích để đối chiếu dữ liệu.'}</span>
        </div>
      </article>
    })}</div>}
    <div className="customer-rules-footer">
      <div><span className={`customer-rules-status${dirty ? ' is-dirty' : ''}`}>{dirty ? 'Có thay đổi chưa lưu' : `${rules.length} quy tắc đã lưu`}</span><p>Áp dụng cho trục và loại phổ đang chọn. Kết quả là dấu hiệu cần kiểm tra.</p></div>
      {can('engineer') && <Button type="primary" icon={<SaveOutlined aria-hidden />} loading={saving} disabled={!dirty || !query.isSuccess} onClick={save}>Lưu quy tắc</Button>}
    </div>
    <Modal title={editing ? 'Sửa quy tắc' : 'Thêm quy tắc mới'} open={open} onCancel={() => setOpen(false)} width={640}
      okText={editing ? 'Cập nhật quy tắc' : 'Thêm vào danh sách'} cancelText="Hủy" onOk={() => form.submit()} className="customer-rule-modal">
      <p className="customer-rule-modal-note">Máy: <strong>{machineName || machineId}</strong></p>
      <Form form={form} layout="vertical" initialValues={defaults} onFinish={submit} requiredMark="optional">
        <div className="customer-rule-form-identity">
          <Form.Item name="code" label="Mã lỗi" rules={[{ required: true, whitespace: true, message: 'Nhập mã lỗi' }]}><Input placeholder="VD: E02" maxLength={40} /></Form.Item>
          <Form.Item name="name" label="Tên lỗi" rules={[{ required: true, whitespace: true, message: 'Nhập tên lỗi' }]}><Input placeholder="VD: Rung mạnh tại bậc 2X" maxLength={120} /></Form.Item>
        </div>
        <div className="customer-rule-form-divider">Điều kiện phát hiện <span>Đồng thời thỏa các ngưỡng bên dưới</span></div>
        <div className="customer-rule-form-grid">
          <Form.Item name="order" label="Bậc hài" rules={[{ required: true, message: 'Nhập bậc hài' }]}><InputNumber min={1} max={30} precision={0} addonAfter="X" /></Form.Item>
          <Form.Item name="min_count" label="Số lần xuất hiện tối thiểu" rules={[{ required: true, message: 'Nhập số lần' }]}><InputNumber min={1} max={500} precision={0} addonAfter="lần" /></Form.Item>
          <Form.Item name="occurrence_pct" label="Tỷ lệ xuất hiện tối thiểu" rules={[{ required: true, message: 'Nhập tỷ lệ' }]}><InputNumber min={0} max={100} addonAfter="%" /></Form.Item>
          <Form.Item name="relative_pct" label="Biên độ tối thiểu so với 1X" extra="Nhập 0 để bỏ điều kiện này." rules={[{ required: true, message: 'Nhập ngưỡng biên độ' }]}><InputNumber min={0} max={10000} addonAfter="%" /></Form.Item>
        </div>
        <div className="customer-rule-modal-note">Biên độ được so với 1X trong cùng lần đo. Sau khi thêm hoặc sửa, bấm <strong>Lưu quy tắc</strong> để áp dụng cho máy.</div>
      </Form>
    </Modal>
  </section>
}
