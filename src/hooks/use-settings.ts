'use client'

import { useState, useEffect, useCallback } from 'react'

const SETTINGS_KEY = 'creatuno_settings'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Language = 'en' | 'krio'

export interface AppSettings {
  theme: ThemeMode
  language: Language
  notifications: boolean
  emailNotifications: boolean
  syncOnWifiOnly: boolean
  autoCompressImages: boolean
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'en',
  notifications: true,
  emailNotifications: false,
  syncOnWifiOnly: false,
  autoCompressImages: true,
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettings>
        // Migrate old darkMode boolean to new theme field
        const migrated = { ...defaultSettings, ...parsed }
        if ('darkMode' in parsed && !('theme' in parsed)) {
          migrated.theme = (parsed as { darkMode?: boolean }).darkMode ? 'dark' : 'light'
        }
        setSettings(migrated)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
    setIsLoaded(true)
  }, [])

  // Save settings to localStorage whenever they change
  const saveSettings = useCallback((newSettings: AppSettings) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }, [])

  const updateSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value }
      saveSettings(updated)
      return updated
    })
  }, [saveSettings])

  const toggleSetting = useCallback((key: keyof AppSettings) => {
    setSettings(prev => {
      const current = prev[key]
      if (typeof current !== 'boolean') return prev
      const updated = { ...prev, [key]: !current }
      saveSettings(updated)
      return updated
    })
  }, [saveSettings])

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings)
    saveSettings(defaultSettings)
  }, [saveSettings])

  return {
    settings,
    isLoaded,
    updateSetting,
    toggleSetting,
    resetSettings,
  }
}
