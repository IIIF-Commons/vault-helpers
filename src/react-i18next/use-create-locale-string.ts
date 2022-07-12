import { useTranslation } from 'react-i18next';
import { InternationalString } from '@iiif/presentation-3';
import { buildLocaleString } from '../i18n';

export function useCreateLocaleString() {
  const { i18n } = useTranslation();

  const i18nLanguages = i18n && i18n.languages ? i18n.languages : [];
  const i18nLanguage = i18n && i18n.language ? i18n.language : 'en';

  return function createLocaleString(inputText: InternationalString | string | null | undefined, defaultText?: string) {
    return buildLocaleString(inputText, i18nLanguage, { fallbackLanguages: i18nLanguages, defaultText });
  };
}
