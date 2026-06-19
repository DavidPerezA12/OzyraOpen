import { ArrowUpRight, Code2, Compass, GraduationCap, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { WelcomeCategory } from '../../hooks/useAppUiState';

interface WelcomeCategoryItem {
  readonly label: WelcomeCategory;
  readonly icon: ReactNode;
  readonly hint: string;
  readonly suggestions: readonly string[];
}

const WELCOME_CATEGORIES: readonly WelcomeCategoryItem[] = [
  {
    label: 'Crear',
    icon: <Sparkles size={14} />,
    hint: 'Ideas, textos y borradores',
    suggestions: [
      'Escribe un relato corto sobre una ciudad que no duerme',
      'Dame diez nombres para una marca de café de especialidad',
      'Redacta un correo profesional para pedir un aumento',
    ],
  },
  {
    label: 'Explorar',
    icon: <Compass size={14} />,
    hint: 'Entiende cualquier tema a fondo',
    suggestions: [
      '¿Cómo funciona una IA por dentro?',
      'Explícame los agujeros negros como si tuviera 10 años',
      'Ayúdame a planificar una escapada de fin de semana',
    ],
  },
  {
    label: 'Programar',
    icon: <Code2 size={14} />,
    hint: 'Código, debugging y arquitectura',
    suggestions: [
      'Revisa este código y sugiere mejoras',
      'Explícame la diferencia entre async y await en JavaScript',
      'Diseña el esquema de una base de datos para un blog',
    ],
  },
  {
    label: 'Aprender',
    icon: <GraduationCap size={14} />,
    hint: 'Estudia y practica a tu ritmo',
    suggestions: [
      'Crea un plan de estudio de 30 días para aprender SQL',
      'Hazme un test rápido sobre la Revolución Francesa',
      'Resume el libro "Hábitos atómicos" en cinco puntos',
    ],
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
    WELCOME_CATEGORIES.find((category) => category.label === welcomeCategory) ??
    WELCOME_CATEGORIES[1];

  return (
    <div className="h-full flex flex-col items-center justify-center px-4 pb-32">
      <div className="welcome-container w-full max-w-xl mx-auto animate-fade-in relative flex flex-col items-start">
        {!isLocalProfileLoading && (
          <span className="welcome-eyebrow">Ozyra Open · local-first</span>
        )}

        <h2 className="welcome-heading">
          {isLocalProfileLoading ? (
            'Cargando…'
          ) : (
            <>
              ¿En qué te ayudo{userName ? `, ${userName}` : ''}
              <span className="welcome-heading-accent">?</span>
            </>
          )}
        </h2>

        {!isLocalProfileLoading && (
          <>
            <div className="welcome-pills-row">
              {WELCOME_CATEGORIES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="welcome-pill-btn"
                  data-active={item.label === welcomeCategory}
                  onClick={() => onWelcomeCategoryChange(item.label)}
                >
                  <span className="welcome-pill-icon">{item.icon}</span>
                  <span className="welcome-pill-label">{item.label}</span>
                </button>
              ))}
            </div>

            <p className="welcome-hint">{activeWelcomeCategory.hint}</p>

            <div className="welcome-suggestions-list-styled" key={activeWelcomeCategory.label}>
              {activeWelcomeCategory.suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  className="welcome-suggestion-row"
                  onClick={() => onSuggestionSelect(suggestion)}
                >
                  <span className="welcome-suggestion-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="welcome-suggestion-text">{suggestion}</span>
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
