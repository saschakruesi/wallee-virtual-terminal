import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { Button, EmptyState, Headline, Icon } from '@/components'
import { useConfig } from '@/app/ConfigProvider'
import { CustomerSearch } from './CustomerSearch'

/** `#/customers` — search and open customers, create new ones. */
export function CustomersPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { config } = useConfig()
  const cfg = config!
  const [text, setText] = useState('')

  return (
    <>
      <Headline
        kicker={t('headline.customers.kicker')}
        title={t('headline.customers.title')}
        actions={
          <Link to="/customers/new" className="btn btn--primary" style={{ textDecoration: 'none' }}>
            <Icon name="plus" />
            {t('customers.new')}
          </Link>
        }
      />
      <div style={{ maxWidth: 720 }}>
        <CustomerSearch
          creds={cfg}
          autoFocus
          inputId="customers-search"
          text={text}
          onTextChange={setText}
          onSelect={(c) => navigate(`/customers/${c.id}`)}
          footer={
            text.trim().length < 2 ? (
              <EmptyState title={t('customers.empty')} />
            ) : (
              <div>
                <Button variant="text" onClick={() => navigate('/customers/new')}>
                  {t('customers.emptyResults')}
                </Button>
              </div>
            )
          }
        />
      </div>
    </>
  )
}
