import { InternationalString } from '@iiif/presentation-3';
import { useTranslation } from 'react-i18next';
import React, { useMemo } from 'react';
import { buildLocaleString, getClosestLanguage } from './i18n';

function LanguageString({
  as: Component,
  language,
  children,
  ...props
}: { as?: string | React.FC<any>; language: string } & Record<any, any>) {
  const { i18n } = useTranslation();

  const viewingDirection = useMemo(() => (i18n.dir ? i18n.dir(language) : 'ltr'), [language]);

  const isSame = useMemo(() => {
    if (!i18n.services) {
      return false;
    }

    return (
      i18n.services.languageUtils.getLanguagePartFromCode(i18n.language) ===
      i18n.services.languageUtils.getLanguagePartFromCode(language)
    );
  }, [i18n.language, language]);

  if (isSame) {
    if (Component) {
      return <Component {...props}>{children}</Component>;
    }

    return <span {...props}>{children}</span>;
  }

  if (Component) {
    return (
      <Component {...props} lang={language} dir={viewingDirection}>
        {children}
      </Component>
    );
  }

  return (
    <span {...props} lang={language} dir={viewingDirection}>
      {children}
    </span>
  );
}

export function useClosestLanguage(getLanguages: () => string[], deps: any[] = []): string | undefined {
  const { i18n } = useTranslation();

  const i18nLanguages = i18n && i18n.languages ? i18n.languages : [];
  const i18nLanguage = i18n && i18n.language ? i18n.language : 'en';

  return useMemo(() => {
    const languages = getLanguages();

    return getClosestLanguage(i18nLanguage, languages, i18nLanguages);
  }, [i18nLanguages, i18nLanguage, ...deps]);
}

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

export function useCreateLocaleString() {
  const { i18n } = useTranslation();

  const i18nLanguages = i18n && i18n.languages ? i18n.languages : [];
  const i18nLanguage = i18n && i18n.language ? i18n.language : 'en';

  return function createLocaleString(inputText: InternationalString | string | null | undefined, defaultText?: string) {
    return buildLocaleString(inputText, i18nLanguage, { fallbackLanguages: i18nLanguages, defaultText });
  };
}

export const LocaleString: React.FC<{
  as?: string | React.FC<any>;
  defaultText?: string;
  to?: string;
  enableDangerouslySetInnerHTML?: boolean;
  children: InternationalString | null | undefined;
  style?: React.CSSProperties;
}> = ({ as: Component, defaultText, enableDangerouslySetInnerHTML, children, ...props }) => {
  const [text, language] = useLocaleString(children, defaultText);

  if (language) {
    return (
      <LanguageString
        {...props}
        as={Component}
        language={language}
        title={enableDangerouslySetInnerHTML ? undefined : text}
        dangerouslySetInnerHTML={
          enableDangerouslySetInnerHTML
            ? {
                __html: text,
              }
            : undefined
        }
      >
        {enableDangerouslySetInnerHTML ? undefined : text}
      </LanguageString>
    );
  }

  if (Component) {
    return <Component {...props}>{text}</Component>;
  }

  return (
    <span
      {...props}
      title={enableDangerouslySetInnerHTML ? undefined : text}
      dangerouslySetInnerHTML={
        enableDangerouslySetInnerHTML
          ? {
              __html: text,
            }
          : undefined
      }
    >
      {enableDangerouslySetInnerHTML ? undefined : text}
    </span>
  );
};
