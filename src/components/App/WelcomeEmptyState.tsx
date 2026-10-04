import { ArrowUpRight, Code2, Compass, GraduationCap, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { WelcomeCategory } from '../../hooks/useAppUiState';
import { t, type TranslationKey } from '../../i18n';

interface WelcomeCategoryItem {
  readonly id: WelcomeCategory;
  readonly icon: ReactNode;
  readonly labelKey: TranslationKey;
  readonly hintKey: TranslationKey;
  readonly suggestionKeys: readonly TranslationKey[];
}

const WELCOME_CATEGORIES: readonly WelcomeCategoryItem[] = [
  {
    id: 'create',
    icon: <Sparkles size={14} />,
    labelKey: 'welcomeCatCreate',
    hintKey: 'welcomeHintCreate',
    suggestionKeys: ['welcomeSugCreate1', 'welcomeSugCreate2', 'welcomeSugCreate3'],
  },
  {
    id: 'explore',
    icon: <Compass size={14} />,
    labelKey: 'welcomeCatExplore',
    hintKey: 'welcomeHintExplore',
    suggestionKeys: ['welcomeSugExplore1', 'welcomeSugExplore2', 'welcomeSugExplore3'],
  },
  {
    id: 'code',
    icon: <Code2 size={14} />,
    labelKey: 'welcomeCatCode',
    hintKey: 'welcomeHintCode',
    suggestionKeys: ['welcomeSugCode1', 'welcomeSugCode2', 'welcomeSugCode3'],
  },
  {
    id: 'learn',
    icon: <GraduationCap size={14} />,
    labelKey: 'welcomeCatLearn',
    hintKey: 'welcomeHintLearn',
    suggestionKeys: ['welcomeSugLearn1', 'welcomeSugLearn2', 'welcomeSugLearn3'],
  },
];

interface WelcomeEmptyStateProps {
  readonly isLocalProfileLoading: boolean;
  readonly userName: string;
  readonly welcomeCategory: WelcomeCategory;
  readonly onWelcomeCategoryChange: (category: WelcomeCategory) => void;
  readonly onSuggestionSelect: (suggestion: string) => void;
}

export function WelcomeEmptyState({
  isLocalProfileLoading,
  userName,
  welcomeCategory,
  onWelcomeCategoryChange,
  onSuggestionSelect,
}: WelcomeEmptyStateProps) {
  const activeWelcomeCategory =
    WELCOME_CATEGORIES.find((category) => category.id === welcomeCategory) ??
    WELCOME_CATEGORIES[1] ??
    WELCOME_CATEGORIES[0];

  if (!activeWelcomeCategory) {
    return null;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-4 pb-32">
      <div className="welcome-container w-full max-w-xl mx-auto animate-fade-in relative flex flex-col items-start">
        {!isLocalProfileLoading && (
          <span className="welcome-eyebrow">Ozyra Open · local-first</span>
        )}

        <h1 className="welcome-heading">
          {isLocalProfileLoading ? (
            t('welcomeLoading')
          ) : (
            <>
              {t('welcomeHeading')}
              {userName ? `, ${userName}` : ''}
              <span className="welcome-heading-accent">?</span>
            </>
          )}
        </h1>

        {!isLocalProfileLoading && (
          <>
            <div className="welcome-pills-row">
              {WELCOME_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="welcome-pill-btn"
                  data-active={item.id === welcomeCategory}
                  onClick={() => onWelcomeCategoryChange(item.id)}
                >
                  <span className="welcome-pill-icon">{item.icon}</span>
                  <span className="welcome-pill-label">{t(item.labelKey)}</span>
                </button>
              ))}
            </div>

            <p className="welcome-hint">{t(activeWelcomeCategory.hintKey)}</p>

            <div className="welcome-suggestions-list-styled" key={activeWelcomeCategory.id}>
              {activeWelcomeCategory.suggestionKeys.map((suggestionKey, index) => (
                <button
                  key={suggestionKey}
                  type="button"
                  className="welcome-suggestion-row"
                  onClick={() => onSuggestionSelect(t(suggestionKey))}
                >
                  <span className="welcome-suggestion-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="welcome-suggestion-text">{t(suggestionKey)}</span>
                  <ArrowUpRight className="welcome-suggestion-arrow" size={16} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
