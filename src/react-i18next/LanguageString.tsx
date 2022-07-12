import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export function LanguageString({
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
