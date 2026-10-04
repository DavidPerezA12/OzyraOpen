import { t, type TranslationKey } from '../../../i18n';

const SHORTCUTS: {
  labelKey: TranslationKey;
  keys: string[];
  descKey: TranslationKey;
}[] = [
  { labelKey: 'cpTitle', keys: ['⌘', 'K'], descKey: 'shortcutCommandPaletteDesc' },
  { labelKey: 'asTitle', keys: ['⌘', 'F'], descKey: 'shortcutAdvancedSearchDesc' },
  { labelKey: 'shortcutSidebar', keys: ['⌘', 'B'], descKey: 'shortcutSidebarDesc' },
  { labelKey: 'shortcutFocusComposer', keys: ['/'], descKey: 'shortcutFocusComposerDesc' },
  { labelKey: 'shortcutCloseSettings', keys: ['Esc'], descKey: 'shortcutCloseSettingsDesc' },
];

export default function ShortcutsSection() {
  return (
    <div className="cfg-page">
      <div className="cfg-page-header">
        <h2 className="cfg-page-title">{t('shortcutsTitle')}</h2>
        <p className="cfg-page-desc">{t('shortcutsDesc')}</p>
      </div>

      <div className="cfg-section">
        {SHORTCUTS.map((shortcut, index) => (
          <div
            key={shortcut.labelKey}
            className={`cfg-row ${index < SHORTCUTS.length - 1 ? 'cfg-row--border' : ''}`}
          >
            <div className="cfg-row-info">
              <span className="cfg-row-label">{t(shortcut.labelKey)}</span>
              <span className="cfg-row-hint">{t(shortcut.descKey)}</span>
            </div>
            <div className="cfg-keys">
              {shortcut.keys.map((key) => (
                <kbd key={key} className="cfg-kbd">
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
