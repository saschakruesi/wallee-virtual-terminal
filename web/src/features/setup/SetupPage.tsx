import { useI18n, LANGS } from '@/i18n'
import type { Lang } from '@/i18n'
import { Headline, Segmented, Split } from '@/components'
import logoWhite from '@/assets/wallee_logo_white.svg'
import { PhasePlaceholder } from '@/app/PhasePlaceholder'

/**
 * Phase 1: layout shell with the app language switcher. The credentials form,
 * connection test and storage follow in phase 2 (docs/03-ui-flows.md).
 */
export function SetupPage() {
  const { t, lang, setLang } = useI18n()
  return (
    <>
      <Headline kicker={t('headline.setup.kicker')} title={t('headline.setup.title')} />
      <Split
        ratio="even"
        turquoise="left"
        left={
          <div
            className="stack"
            style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}
          >
            <img src={logoWhite} alt={t('app.wordmarkAlt')} style={{ height: 40, width: 'auto' }} />
            <p className="statement">{t('setup.intro')}</p>
            <p style={{ fontWeight: 300 }}>{t('setup.claim')}</p>
          </div>
        }
        right={
          <div className="stack">
            <Segmented<Lang>
              label={t('setup.appLanguage')}
              value={lang}
              onChange={setLang}
              options={LANGS.map((l) => ({ value: l, label: t(`lang.${l}`) }))}
            />
            <hr className="hairline" />
            <PhasePlaceholder phase={2} />
          </div>
        }
      />
    </>
  )
}
