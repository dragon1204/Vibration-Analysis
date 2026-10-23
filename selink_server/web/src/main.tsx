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
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#e9edf1' }}>
          <div style={{ maxWidth: 520, padding: 28, border: '1px solid #c3ccd6', background: '#fff', textAlign: 'center' }}>
            <h2>Không thể hiển thị màn hình này</h2>
            <p>Ứng dụng vừa gặp lỗi hiển thị. Dữ liệu thiết bị không bị ảnh hưởng.</p>
            <button onClick={() => window.location.reload()} style={{ padding: '9px 18px', border: 0, color: '#fff', background: '#2f6fa8', cursor: 'pointer' }}>
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
      // Industrial look: square corners, steel greys, colour reserved for machine state.
      token: {
        colorPrimary: '#2f6fa8', colorInfo: '#2f6fa8', colorSuccess: '#2fa84f',
        colorWarning: '#d9a406', colorError: '#d62f3a', colorBgBase: '#e9edf1',
        colorBgContainer: '#ffffff', colorBorder: '#c3ccd6', colorText: '#1b2430',
        borderRadius: 2, fontFamily: 'Inter, "Segoe UI", sans-serif',
      },
      components: {
        Card: { colorBgContainer: '#ffffff', headerBg: '#f3f5f8' },
        Layout: { bodyBg: '#e9edf1', headerBg: '#161d26', siderBg: '#f3f5f7' },
        Menu: { itemBg: '#f3f5f7', itemSelectedBg: '#ffffff', itemSelectedColor: '#1b2430' },
        Table: { headerBg: '#f3f5f8' },
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
