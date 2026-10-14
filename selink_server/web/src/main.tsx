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
