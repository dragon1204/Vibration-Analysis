import React from 'react'
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

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={viVN} theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#22d3ee', colorInfo: '#38bdf8', colorSuccess: '#34d399',
        colorWarning: '#fbbf24', colorError: '#fb7185', colorBgBase: '#050b16',
        colorBgContainer: '#0b1626', colorBorder: 'rgba(148,163,184,.16)',
        borderRadius: 12, fontFamily: 'Inter, "Segoe UI", sans-serif',
      },
      components: {
        Card: { colorBgContainer: 'rgba(11,22,38,.78)' },
        Layout: { bodyBg: '#050b16', headerBg: 'rgba(5,11,22,.74)', siderBg: '#07111f' },
        Menu: { darkItemBg: 'transparent', darkItemSelectedBg: 'rgba(34,211,238,.14)', darkItemSelectedColor: '#67e8f9' },
      },
    }}>
      <AntApp>
        <QueryClientProvider client={qc}>
          <BrowserRouter>
            <AuthProvider>
              <App />
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
