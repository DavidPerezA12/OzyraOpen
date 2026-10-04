import type { SettingsTab } from './types';
import { t, type TranslationKey } from '../../i18n';

const PRIMARY_TABS: { id: SettingsTab; labelKey: TranslationKey }[] = [
  { id: 'local_profile', labelKey: 'navProfile' },
  { id: 'customization', labelKey: 'tabCustomization' },
  { id: 'search', labelKey: 'navSearch' },
  { id: 'history', labelKey: 'tabHistory' },
  { id: 'models', labelKey: 'tabModels' },
];

const SECONDARY_TABS: { id: SettingsTab; labelKey: TranslationKey }[] = [
  { id: 'shortcuts', labelKey: 'navShortcuts' },
  { id: 'about', labelKey: 'navAbout' },
];

interface SettingsNavProps {
  readonly activeTab: SettingsTab;
  readonly onTabChange: (tab: SettingsTab) => void;
}

export default function SettingsNav({ activeTab, onTabChange }: SettingsNavProps) {
  return (
    <nav className="cfg-nav">
      <span className="cfg-nav-label">{t('sidebarSettings')}</span>
      {PRIMARY_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`cfg-nav-item ${activeTab === tab.id ? 'cfg-nav-item--active' : ''}`}
        >
          {t(tab.labelKey)}
        </button>
      ))}

      <div className="cfg-nav-spacer" />

      {SECONDARY_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`cfg-nav-item cfg-nav-item--muted ${
            activeTab === tab.id ? 'cfg-nav-item--active' : ''
          }`}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </nav>
  );
}
