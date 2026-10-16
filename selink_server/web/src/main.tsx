import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider, theme } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import App from './App'
import { AuthProvider } from './auth'
import './styles.css'

dayjs.locale('vi')

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f6fb' }}>
          <div style={{ maxWidth: 520, padding: 28, borderRadius: 12, background: '#fff', boxShadow: '0 8px 30px rgba(15,39,92,.12)', textAlign: 'center' }}>
            <h2>Không thể hiển thị màn hình này</h2>
            <p>Ứng dụng vừa gặp lỗi hiển thị. Dữ liệu thiết bị không bị ảnh hưởng.</p>
            <button onClick={() => window.location.reload()} style={{ padding: '9px 18px', border: 0, borderRadius: 8, color: '#fff', background: '#2563eb', cursor: 'pointer' }}>
              Tải lại trang
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={viVN} theme={{
      algorithm: theme.defaultAlgorithm,
      token: {
        colorPrimary: '#2563eb', colorInfo: '#2563eb', colorSuccess: '#18a873',
        colorWarning: '#f59e0b', colorError: '#e5484d', colorBgBase: '#f4f6fb',
        colorBgContainer: '#ffffff', colorBorder: '#dfe4ee', colorText: '#17213a',
        borderRadius: 10, fontFamily: 'Inter, "Segoe UI", sans-serif',
      },
      components: {
        Card: { colorBgContainer: '#ffffff' },
        Layout: { bodyBg: '#f4f6fb', headerBg: '#10275c', siderBg: '#ffffff' },
        Menu: { itemBg: '#ffffff', itemSelectedBg: '#eaf1ff', itemSelectedColor: '#2563eb' },
      },
    }}>
      <AntApp>
        <QueryClientProvider client={qc}>
          <BrowserRouter>
            <AuthProvider>
              <AppErrorBoundary><App /></AppErrorBoundary>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}
