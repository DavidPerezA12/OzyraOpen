import { AlertTriangle, DownloadCloud, Trash2, UploadCloud } from 'lucide-react';
import React from 'react';
import type { TranslationKey } from '../../../i18n';

interface HistorySectionProps {
  readonly isDarkMode: boolean;
  readonly onImport: () => void;
  readonly onExport: () => void;
  readonly onDeleteAll: () => void;
  readonly t: (key: TranslationKey) => string;
}

const HistorySection: React.FC<HistorySectionProps> = ({ onImport, onExport, onDeleteAll, t }) => {
  return (
    <div className="cfg-page">
      <div className="cfg-page-header">
        <h2 className="cfg-page-title">{t('historyTitle')}</h2>
        <p className="cfg-page-desc">{t('historyDescription')}</p>
      </div>

      {/* Import / Export */}
      <div className="cfg-section">
        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('import')}</span>
            <span className="cfg-row-hint">
              Restaura chats desde un archivo JSON exportado previamente.
            </span>
          </div>
          <button type="button" onClick={onImport} className="cfg-btn">
            <UploadCloud size={14} />
            {t('import')}
          </button>
        </div>
        <div className="cfg-row">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('export')}</span>
            <span className="cfg-row-hint">
              Descarga todas tus conversaciones en un archivo JSON.
            </span>
          </div>
          <button type="button" onClick={onExport} className="cfg-btn">
            <DownloadCloud size={14} />
            {t('export')}
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="cfg-section cfg-section--danger">
        <span
          className="cfg-section-label"
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <AlertTriangle size={12} />
          {t('dangerZone')}
        </span>
        <div className="cfg-row">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('deleteChatHistory')}</span>
            <span className="cfg-row-hint">{t('deleteHistoryDescription')}</span>
          </div>
          <button type="button" onClick={onDeleteAll} className="cfg-btn cfg-btn--danger">
            <Trash2 size={14} />
            {t('deleteChatHistory')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistorySection;
