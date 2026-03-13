import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/client/locales/en.json'
import de from '@/client/locales/de.json'
import fr from '@/client/locales/fr.json'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    fr: { translation: fr },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
