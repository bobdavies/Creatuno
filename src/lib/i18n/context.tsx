'use client'

import { createContext, useContext, useMemo } from 'react'
import { translations } from './translations'
import { useSettings, type Language } from '@/hooks/use-settings'

interface LanguageContextValue {
  language: Language
  t: (key: string) => string
  setLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  t: (key: string) => key,
  setLanguage: () => {},
})

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return path // Return the key itself as fallback
    }
  }
  return typeof current === 'string' ? current : path
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSetting } = useSettings()
  const language = settings.language || 'en'

  const contextValue = useMemo<LanguageContextValue>(() => ({
    language,
    t: (key: string) => {
      const dict = translations[language] || translations.en
      return getNestedValue(dict as unknown as Record<string, unknown>, key)
    },
    setLanguage: (lang: Language) => {
      updateSetting('language', lang)
    },
  }), [language, updateSetting])

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  return useContext(LanguageContext)
}
