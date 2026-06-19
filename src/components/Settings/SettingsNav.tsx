import type { SettingsTab } from './types';

const PRIMARY_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'local_profile', label: 'Perfil' },
  { id: 'customization', label: 'Personalización' },
  { id: 'search', label: 'Búsqueda' },
  { id: 'history', label: 'Historial' },
  { id: 'models', label: 'Modelos' },
];

const SECONDARY_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'shortcuts', label: 'Atajos' },
  { id: 'about', label: 'Proyecto' },
];

interface SettingsNavProps {
  readonly activeTab: SettingsTab;
  readonly onTabChange: (tab: SettingsTab) => void;
}

export default function SettingsNav({ activeTab, onTabChange }: SettingsNavProps) {
  return (
    <nav className="cfg-nav">
      <span className="cfg-nav-label">Ajustes</span>
      {PRIMARY_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`cfg-nav-item ${activeTab === tab.id ? 'cfg-nav-item--active' : ''}`}
        >
          {tab.label}
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
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
