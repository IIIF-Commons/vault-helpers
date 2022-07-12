import { InternationalString } from '@iiif/presentation-3';
import { useMemo } from 'react';
import { buildLocaleString } from '../i18n';
import { useClosestLanguage } from './use-closest-language';

export function useLocaleString(inputText: InternationalString | string | null | undefined, defaultText?: string) {
  const language = useClosestLanguage(() => Object.keys(inputText || {}), [inputText]);
  return [
    useMemo(() => {
      return buildLocaleString(inputText, language, {
        defaultText,
        closest: true,
      });
    }, [language, defaultText, inputText]),
    language,
  ] as const;
}
