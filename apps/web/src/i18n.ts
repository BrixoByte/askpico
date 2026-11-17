import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;

const namespace = ['main', 'api', 'model'];
if (googleClientId) namespace.push('drive');

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: 'locales/{{lng}}/{{ns}}.json',
    },
    fallbackLng: {
      // `locales/yue` is a stub pointer to zh-HK (Cantonese); yue itself has no
      // files, so fall back to zh-HK before English.
      yue: ['zh-HK', 'en'],
      default: ['en'],
    },
    ns: namespace,
    defaultNS: 'main',
    interpolation: {
      // React already escapes rendered values; leaving this on turns '/' into '&#x2F;'.
      escapeValue: false,
    },
    // 'all' keeps regional codes (zh-CN/zh-TW/zh-HK) so their files load; the
    // flattened stubs (zh, yue, en-GB, fr-FR) then act as harmless 404s in the
    // middle of the chain instead of dead ends.
    load: 'all',
  });

export default i18n;
