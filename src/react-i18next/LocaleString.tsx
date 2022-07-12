import React from 'react';
import { InternationalString } from '@iiif/presentation-3';
import { LanguageString } from './LanguageString';
import { useLocaleString } from './use-locale-string';

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
