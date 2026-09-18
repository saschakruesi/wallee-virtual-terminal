import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '@/i18n'
import { ToastProvider } from '@/components'
import { ConfigProvider, RequireConfig } from './ConfigProvider'
import { Layout } from './Layout'
import { SetupPage } from '@/features/setup/SetupPage'
import { NewTransactionPage } from '@/features/moto/NewTransactionPage'
import { MotoPage } from '@/features/moto/MotoPage'
import { LinkPage } from '@/features/paymentlink/LinkPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { CustomersPage } from '@/features/customers/CustomersPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { StyleguidePage } from '@/features/styleguide/StyleguidePage'
import { NotFoundPage } from './NotFoundPage'

export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <ConfigProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="setup" element={<SetupPage />} />
                <Route path="styleguide" element={<StyleguidePage />} />
                <Route path="index.html" element={<Navigate to="/" replace />} />
                <Route element={<RequireConfig />}>
                  <Route index element={<NewTransactionPage />} />
                  <Route path="moto/:id" element={<MotoPage />} />
                  <Route path="link/:id" element={<LinkPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="customers/new" element={<CustomersPage />} />
                  <Route path="customers/:id" element={<CustomersPage />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </HashRouter>
        </ConfigProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
