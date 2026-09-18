import { useState } from 'react'
import { useI18n } from '@/i18n'
import {
  Button,
  ConfirmDialog,
  CopyField,
  EmptyState,
  Headline,
  Icon,
  Input,
  Modal,
  Segmented,
  Select,
  Spinner,
  StatusBadge,
  Stepper,
  Table,
  useToast,
} from '@/components'
import type { BadgeStatus, IconName } from '@/components'

const SWATCHES: { token: string; hex: string }[] = [
  { token: '--w-turquoise', hex: '#11D9CC' },
  { token: '--w-turquoise-80', hex: '#41E1D6' },
  { token: '--w-turquoise-60', hex: '#58E3DA' },
  { token: '--w-turquoise-40', hex: '#9CEDE7' },
  { token: '--w-turquoise-20', hex: '#CFF7F4' },
  { token: '--w-turquoise-text', hex: '#0B8F87' },
  { token: '--w-turquoise-deep', hex: '#0E6B66' },
  { token: '--w-orange', hex: '#FF4D00' },
  { token: '--w-black', hex: '#000000' },
  { token: '--w-text', hex: '#333333' },
  { token: '--w-text-muted', hex: '#808080' },
  { token: '--w-line', hex: '#D9D9D9' },
  { token: '--w-grid', hex: '#E6E6E6' },
  { token: '--w-bg-soft', hex: '#F7F7F7' },
]

const ICONS: IconName[] = [
  'search',
  'plus',
  'copy',
  'external',
  'check',
  'close',
  'warning',
  'download',
  'refresh',
  'eye',
  'eye-off',
  'chevron-down',
  'chevron-right',
  'trash',
]

const BADGES: BadgeStatus[] = [
  'paid',
  'completed',
  'authorized',
  'open',
  'pending',
  'failed',
  'cancelled',
  'expired',
]

type Row = { date: string; ref: string; customer: string; amount: string; status: BadgeStatus }
const ROWS: Row[] = [
  {
    date: '18.09.2026 14:32',
    ref: 'VT-2026-000123',
    customer: 'Anna Muster',
    amount: "1'234.50",
    status: 'paid',
  },
  {
    date: '18.09.2026 13:10',
    ref: 'VT-2026-000122',
    customer: 'Hotel Muster AG',
    amount: '480.00',
    status: 'pending',
  },
  {
    date: '17.09.2026 18:45',
    ref: 'VT-2026-000121',
    customer: 'Peter Beispiel',
    amount: '75.20',
    status: 'failed',
  },
  {
    date: '17.09.2026 09:05',
    ref: 'VT-2026-000120',
    customer: 'Lea Test',
    amount: '12.00',
    status: 'cancelled',
  },
]

/** Hidden route `#/styleguide`: shows every component in the wallee look. Not linked from the navigation. */
export function StyleguidePage() {
  const { t } = useI18n()
  const toast = useToast()
  const [env, setEnv] = useState<'PREVIEW' | 'LIVE'>('PREVIEW')
  const [step, setStep] = useState(1)
  const [modal, setModal] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [loadingTable, setLoadingTable] = useState(false)

  return (
    <>
      <Headline kicker={t('headline.styleguide.kicker')} title={t('headline.styleguide.title')} />

      <Section title="Headline & Typografie">
        <div className="sg-grid">
          <div>
            <div className="headline" style={{ marginBottom: 'var(--s-2)' }}>
              <span className="headline__kicker">Neuer Vorgang</span>
              <span className="headline__title">Zahlung erfassen</span>
            </div>
            <div className="section-title">Abschnittstitel 17 px Medium</div>
            <p>
              Fliesstext 15 px Regular in #333. Die Zeilenhöhe beträgt 1.5, links­bündig, ohne
              Kursive.
            </p>
            <p className="small muted">
              Label 13 px grau — für Formularbeschriftungen und Tabellenköpfe.
            </p>
            <p style={{ fontSize: 12, fontWeight: 300 }} className="muted">
              Fussnote 12 px Light — Statuszeile.
            </p>
          </div>
          <div>
            <div className="small muted">Total (Display)</div>
            <div className="display-amount">CHF 1&apos;234.50</div>
            <p className="small muted" style={{ marginTop: 'var(--s-1)' }}>
              inkl. MwSt 8.1 % = CHF 92.50
            </p>
          </div>
        </div>
      </Section>

      <Section title="Farben">
        <div className="sg-swatches">
          {SWATCHES.map((s) => (
            <div key={s.token}>
              <div className="sg-swatch__color" style={{ background: `var(${s.token})` }} />
              <div className="small" style={{ marginTop: 6 }}>
                {s.token}
              </div>
              <div className="small muted tnum">{s.hex}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="row">
          <Button>Primär</Button>
          <Button variant="secondary">Sekundär</Button>
          <Button variant="text">Textbutton</Button>
          <Button variant="danger">Destruktiv</Button>
          <Button loading>Lädt</Button>
          <Button disabled>Deaktiviert</Button>
          <Button icon={<Icon name="plus" />}>Mit Icon</Button>
        </div>
        <div style={{ marginTop: 'var(--s-2)', maxWidth: 420 }}>
          <Button size="lg" block>
            Zahlungsseite öffnen
          </Button>
        </div>
        <div
          className="on-turquoise"
          style={{
            background: 'var(--w-turquoise)',
            padding: 'var(--s-3)',
            borderRadius: 8,
            marginTop: 'var(--s-2)',
          }}
        >
          <div className="row">
            <Button>Primär auf Türkis</Button>
            <Button variant="secondary">Sekundär</Button>
            <Button variant="text">Textbutton</Button>
            <Spinner />
          </div>
        </div>
      </Section>

      <Section title="Formulare">
        <div className="sg-grid">
          <Input
            label="Application User ID"
            placeholder="12345"
            inputMode="numeric"
            hint="Zahl aus dem wallee-Backend"
          />
          <Input
            label="Authentication Key"
            type={showKey ? 'text' : 'password'}
            defaultValue="secret-key-value"
            trailing={
              <button
                type="button"
                className="field__trailing"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? t('common.hidePassword') : t('common.showPassword')}
                aria-pressed={showKey}
              >
                <Icon name={showKey ? 'eye-off' : 'eye'} />
              </button>
            }
          />
          <Input label="Space ID" defaultValue="abc" error="Bitte eine Zahl eingeben" />
          <Input label="Betrag" align="right" prefix="CHF" defaultValue="480.00" />
          <Select
            label="Standardwährung"
            defaultValue="CHF"
            options={['CHF', 'EUR', 'USD', 'GBP'].map((c) => ({ value: c, label: c }))}
          />
          <Segmented
            label="Umgebung"
            value={env}
            onChange={setEnv}
            options={[
              { value: 'PREVIEW', label: 'Test (PREVIEW)' },
              { value: 'LIVE', label: 'Live' },
            ]}
          />
          <label className="checkbox">
            <input type="checkbox" defaultChecked /> Zugangsdaten auf diesem Computer merken
          </label>
        </div>
      </Section>

      <Section title="Stepper">
        <Stepper
          steps={[
            { label: t('stepper.customer') },
            { label: t('stepper.items') },
            { label: t('stepper.review') },
          ]}
          current={step}
          onSelect={setStep}
        />
        <div className="row">
          <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            {t('common.back')}
          </Button>
          <Button onClick={() => setStep((s) => Math.min(2, s + 1))}>{t('common.next')}</Button>
        </div>
      </Section>

      <Section title="Status-Badges">
        <div className="row">
          {BADGES.map((b) => (
            <StatusBadge key={b} status={b} />
          ))}
          <StatusBadge status="test" />
        </div>
      </Section>

      <Section title="Tabelle">
        <div className="row" style={{ marginBottom: 'var(--s-2)' }}>
          <Button variant="secondary" onClick={() => setLoadingTable((v) => !v)}>
            Ladezustand umschalten
          </Button>
        </div>
        <Table<Row>
          caption="Beispielvorgänge"
          columns={[
            { key: 'date', header: 'Datum', render: (r) => <span className="tnum">{r.date}</span> },
            { key: 'ref', header: 'Referenz', render: (r) => r.ref },
            { key: 'customer', header: 'Kunde', render: (r) => r.customer },
            { key: 'amount', header: 'CHF', align: 'right', render: (r) => r.amount },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rows={loadingTable ? [] : ROWS}
          loading={loadingTable}
          rowKey={(r) => r.ref}
          onRowClick={(r) => toast.success(r.ref, 'Zeile gewählt')}
        />
      </Section>

      <Section title="Toast, Modal, Bestätigung">
        <div className="row">
          <Button
            variant="secondary"
            onClick={() => toast.success('Die Zahlung wurde abgeschlossen.', 'Bezahlt')}
          >
            Erfolgs-Toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.error('Der Application User hat keine Berechtigung im Space.', '403')
            }
          >
            Fehler-Toast
          </Button>
          <Button variant="secondary" onClick={() => setModal(true)}>
            Modal öffnen
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Bestätigungsdialog
          </Button>
        </div>
        <Modal
          open={modal}
          title="Empfänger ändern"
          onClose={() => setModal(false)}
          footer={<Button onClick={() => setModal(false)}>{t('common.save')}</Button>}
        >
          <Input label="E-Mail" type="email" defaultValue="gast@example.com" autoFocus />
        </Modal>
        <ConfirmDialog
          open={confirm}
          title="Auf Live umschalten?"
          message="Ab jetzt werden echte Zahlungen ausgeführt. Sind Sie sicher?"
          confirmLabel="Umschalten"
          danger
          onConfirm={() => setConfirm(false)}
          onCancel={() => setConfirm(false)}
        />
      </Section>

      <Section title="CopyField">
        <div style={{ maxWidth: 640 }}>
          <CopyField
            label="Zahlungslink"
            value="https://app-wallee.com/s/1234/payment/transaction/pay/98765?securityToken=abcdef"
            openable
          />
        </div>
        <div
          className="on-turquoise"
          style={{
            background: 'var(--w-turquoise)',
            padding: 'var(--s-3)',
            borderRadius: 8,
            marginTop: 'var(--s-2)',
            maxWidth: 640,
          }}
        >
          <CopyField value="VT-2026-000123" copyLabel="Referenz kopieren" />
        </div>
      </Section>

      <Section title="Split-Layout">
        <div className="split">
          <div className="split__pane split__pane--white">
            <div className="section-title">Zusammenfassung</div>
            <p>Anna Muster · Hotel Muster AG</p>
            <p className="small muted">VT-2026-000123 · Transaktion 98765</p>
            <div style={{ marginTop: 'var(--s-2)' }}>
              <StatusBadge status="pending" />
            </div>
          </div>
          <div className="split__pane split__pane--turquoise on-turquoise">
            <p className="statement">Die Zahlungsseite ist in einem separaten Fenster geöffnet.</p>
            <div className="display-amount" style={{ margin: 'var(--s-3) 0' }}>
              CHF 480.00
            </div>
            <div className="row">
              <Button>Fenster erneut öffnen</Button>
              <Button variant="secondary">Link kopieren</Button>
            </div>
            <div className="row" style={{ marginTop: 'var(--s-3)' }}>
              <Spinner /> <span>Warten auf Karteneingabe…</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Modus-Karten">
        <div className="choice-grid">
          <button type="button" className="choice" aria-pressed="true">
            <span className="choice__title">Telefon / MOTO</span>
            <span className="choice__text">
              Sie nehmen die Kartendaten am Telefon entgegen und erfassen sie auf der
              wallee-Zahlungsseite.
            </span>
          </button>
          <button type="button" className="choice" disabled>
            <span className="choice__title">Zahlungslink per E-Mail</span>
            <span className="choice__text">
              Der Kunde erhält einen Link und zahlt selbst. (Kein aktiver Charge Flow im Space.)
            </span>
          </button>
        </div>
      </Section>

      <Section title="Leerzustand, Spinner, Infobox, Icons">
        <EmptyState
          title="Noch keine Vorgänge"
          text="Starten Sie einen neuen Vorgang, um hier Einträge zu sehen."
          action={<Button>Neuen Vorgang starten</Button>}
        />
        <div className="row" style={{ margin: 'var(--s-2) 0' }}>
          <Spinner size="sm" /> <Spinner /> <Spinner size="lg" />
        </div>
        <div className="infobox" style={{ maxWidth: 640 }}>
          Produkte werden nur auf diesem Computer gespeichert. Exportieren Sie den Katalog, um ihn
          auf einem anderen Gerät zu nutzen.
        </div>
        <div className="row" style={{ marginTop: 'var(--s-2)', gap: 'var(--s-3)' }}>
          {ICONS.map((name) => (
            <span key={name} className="row" style={{ gap: 6 }}>
              <Icon name={name} />
              <span className="small muted">{name}</span>
            </span>
          ))}
        </div>
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sg-section" aria-labelledby={`sg-${title}`}>
      <h2 id={`sg-${title}`} className="section-title">
        {title}
      </h2>
      {children}
    </section>
  )
}
