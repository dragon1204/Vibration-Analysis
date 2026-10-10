import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { LockOutlined, MailOutlined, ThunderboltFilled, SafetyCertificateOutlined } from '@ant-design/icons'
import { login } from '../api/client'

export default function Login() {
  const [err, setErr] = useState<string>()
  const [loading, setLoading] = useState(false)
  const onFinish = async (v: { email: string; password: string }) => {
    setLoading(true)
    setErr(undefined)
    try {
      await login(v.email, v.password)
    } catch (e: any) {
      setErr(e.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="login-shell">
      <section className="login-visual">
        <div className="brand" style={{ border: 0, padding: 0 }}><div className="brand-mark"><ThunderboltFilled /></div><div><div className="brand-title">SMART MOTOR</div><div className="brand-subtitle">Powered by Selink</div></div></div>
        <div className="login-copy"><div className="page-kicker">Condition monitoring platform</div><h1>Thấu hiểu từng <span>nhịp rung.</span></h1><p>Nền tảng giám sát sức khỏe động cơ theo thời gian thực, kết hợp phân tích phổ, cảnh báo ISO và chẩn đoán thông minh ngay tại edge.</p></div>
        <div className="login-signal"><div><strong>24/7</strong>Giám sát liên tục</div><div><strong>&lt; 5 giây</strong>Dữ liệu realtime</div><div><strong><SafetyCertificateOutlined /> TLS</strong>Bảo mật đầu cuối</div></div>
      </section>
      <section className="login-panel">
      <Card className="login-card">
        <div className="login-icon"><ThunderboltFilled /></div>
        <Typography.Title level={2} style={{ margin: '22px 0 4px', letterSpacing: '-.04em' }}>Chào mừng trở lại</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 28 }}>Đăng nhập để truy cập trung tâm vận hành Smart Motor.</Typography.Paragraph>
        {err && <Alert type="error" message={err} style={{ marginBottom: 12 }} showIcon />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input size="large" prefix={<MailOutlined />} placeholder="operator@selink.vn" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}>
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••••" autoComplete="current-password" />
          </Form.Item>
          <Button size="large" type="primary" htmlType="submit" block loading={loading} style={{ fontWeight: 700 }}>Đăng nhập hệ thống</Button>
        </Form>
      </Card>
      </section>
    </div>
  )
}
