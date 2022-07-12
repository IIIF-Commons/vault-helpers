import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { getClosestLanguage } from '../i18n';

export function useClosestLanguage(getLanguages: () => string[], deps: any[] = []): string | undefined {
  const { i18n } = useTranslation();

  const i18nLanguages = i18n && i18n.languages ? i18n.languages : [];
  const i18nLanguage = i18n && i18n.language ? i18n.language : 'en';

  return useMemo(() => {
    const languages = getLanguages();

    return getClosestLanguage(i18nLanguage, languages, i18nLanguages);
  }, [i18nLanguages, i18nLanguage, ...deps]);
}
