import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import ja from './locales/ja';

// Get device language
const deviceLanguage = getLocales()[0]?.languageCode || 'ja';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en,
            ja,
        },
        lng: deviceLanguage, // default language
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
    });

export default i18n;
