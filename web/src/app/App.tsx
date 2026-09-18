import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '@/i18n'
import { ToastProvider } from '@/components'
import { Layout } from './Layout'
import { SetupPage } from '@/features/setup/SetupPage'
import { NewTransactionPage } from '@/features/moto/NewTransactionPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { CustomersPage } from '@/features/customers/CustomersPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { StyleguidePage } from '@/features/styleguide/StyleguidePage'
import { NotFoundPage } from './NotFoundPage'

export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<NewTransactionPage />} />
              <Route path="setup" element={<SetupPage />} />
              <Route path="moto/:id" element={<NewTransactionPage />} />
              <Route path="link/:id" element={<NewTransactionPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="customers/new" element={<CustomersPage />} />
              <Route path="customers/:id" element={<CustomersPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="styleguide" element={<StyleguidePage />} />
              <Route path="index.html" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </I18nProvider>
  )
}
