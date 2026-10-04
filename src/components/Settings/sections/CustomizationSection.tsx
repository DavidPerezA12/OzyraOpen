import React from 'react';
import { t } from '../../../i18n';

interface CustomizationSectionProps {
  readonly userName: string;
  readonly setUserName: (v: string) => void;
  readonly userKnowledge: string;
  readonly setUserKnowledge: (v: string) => void;
  readonly userTraits: string;
  readonly setUserTraits: (v: string) => void;
  readonly userAdditionalInfo: string;
  readonly setUserAdditionalInfo: (v: string) => void;
  readonly showReasoning: boolean;
  readonly setShowReasoning: (v: boolean) => void;
  readonly onSavePreferences: () => void;
}

const PRESET_TRAITS = [
  { value: 'friendly', labelKey: 'traitFriendly' },
  { value: 'concise', labelKey: 'traitConcise' },
  { value: 'witty', labelKey: 'traitWitty' },
  { value: 'curious', labelKey: 'traitCurious' },
  { value: 'creative', labelKey: 'traitCreative' },
  { value: 'empathetic', labelKey: 'traitEmpathetic' },
  { value: 'patient', labelKey: 'traitPatient' },
] as const;

const CustomizationSection: React.FC<CustomizationSectionProps> = ({
  userName,
  setUserName,
  userKnowledge,
  setUserKnowledge,
  userTraits,
  setUserTraits,
  userAdditionalInfo,
  setUserAdditionalInfo,
  showReasoning,
  setShowReasoning,
  onSavePreferences,
}) => {
  const traitsArray = userTraits
    ? userTraits.split(',').flatMap((trait) => {
        const normalized = trait.trim().toLowerCase();
        return normalized ? [normalized] : [];
      })
    : [];

  const toggleTrait = (trait: string) => {
    const norm = trait.toLowerCase();
    let next: string;
    if (traitsArray.includes(norm)) {
      next = traitsArray.filter((t) => t !== norm).join(', ');
    } else {
      next = userTraits ? `${userTraits.trim()}, ${trait}` : trait;
    }
    setUserTraits(next);
  };

  return (
    <div className="cfg-page">
      <div className="cfg-page-header">
        <h2 className="cfg-page-title">{t('custTitle')}</h2>
        <p className="cfg-page-desc">{t('custDesc')}</p>
      </div>

      {/* Perfil */}
      <div className="cfg-section">
        <span className="cfg-section-label">{t('custProfileSection')}</span>

        {/* Nombre */}
        <div
          className="cfg-row cfg-row--border"
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}
        >
          <label htmlFor="customization-user-name" className="cfg-row-label">
            {t('custNameLabel')}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="customization-user-name"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="cfg-input"
              placeholder={t('yourNamePlaceholder')}
              maxLength={50}
            />
            <span className="cfg-char-count cfg-char-count--centered">{userName.length}/50</span>
          </div>
        </div>

        {/* Rol / Conocimiento */}
        <div
          className="cfg-row cfg-row--border"
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}
        >
          <label htmlFor="customization-user-knowledge" className="cfg-row-label">
            {t('custRoleLabel')}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="customization-user-knowledge"
              type="text"
              value={userKnowledge}
              onChange={(e) => setUserKnowledge(e.target.value)}
              className="cfg-input"
              placeholder={t('professionPlaceholder')}
              maxLength={100}
            />
            <span className="cfg-char-count cfg-char-count--centered">
              {userKnowledge.length}/100
            </span>
          </div>
        </div>

        {/* Traits */}
        <div
          className="cfg-row cfg-row--border"
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.625rem' }}
        >
          <div>
            <label htmlFor="customization-user-traits" className="cfg-row-label">
              {t('custTraitsLabel')}
            </label>
            <p className="cfg-row-hint" style={{ marginTop: '0.125rem' }}>
              {t('custTraitsHint')}
            </p>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              id="customization-user-traits"
              type="text"
              value={userTraits}
              onChange={(e) => setUserTraits(e.target.value)}
              className="cfg-input"
              placeholder="concise, friendly…"
              maxLength={100}
            />
            <span className="cfg-char-count cfg-char-count--centered">{userTraits.length}/100</span>
          </div>
          <div className="cfg-traits">
            {PRESET_TRAITS.map((trait) => {
              const active = traitsArray.includes(trait.value);
              return (
                <button
                  key={trait.value}
                  type="button"
                  onClick={() => toggleTrait(trait.value)}
                  className={`cfg-trait ${active ? 'cfg-trait--active' : ''}`}
                  aria-pressed={active}
                >
                  {t(trait.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info adicional */}
        <div
          className="cfg-row"
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}
        >
          <label htmlFor="customization-user-additional-info" className="cfg-row-label">
            {t('custMoreLabel')}
          </label>
          <div style={{ position: 'relative' }}>
            <textarea
              id="customization-user-additional-info"
              value={userAdditionalInfo}
              onChange={(e) => setUserAdditionalInfo(e.target.value)}
              rows={4}
              className="cfg-input"
              style={{ resize: 'none', paddingBottom: '1.5rem' }}
              placeholder={t('userKnowledgePlaceholder')}
              maxLength={3000}
            />
            <span className="cfg-char-count cfg-char-count--bottom">
              {userAdditionalInfo.length}/3000
            </span>
          </div>
        </div>
      </div>

      {/* Comportamiento */}
      <div className="cfg-section">
        <span className="cfg-section-label">{t('custBehaviorSection')}</span>

        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label" id="customization-reasoning-label">
              {t('custReasoningLabel')}
            </span>
            <span className="cfg-row-hint">{t('custReasoningHint')}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowReasoning(!showReasoning)}
            className={`cfg-toggle ${showReasoning ? 'cfg-toggle--on' : ''}`}
            role="switch"
            aria-checked={showReasoning}
            aria-labelledby="customization-reasoning-label"
          >
            <span className="cfg-toggle__knob" />
          </button>
        </div>

        <div className="cfg-row">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('custToolsLabel')}</span>
            <span className="cfg-row-hint">{t('custToolsHint')}</span>
          </div>
        </div>
      </div>

      {/* Guardar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onSavePreferences} className="cfg-btn cfg-btn--primary">
          {t('custSave')}
        </button>
      </div>
    </div>
  );
};

export default CustomizationSection;
