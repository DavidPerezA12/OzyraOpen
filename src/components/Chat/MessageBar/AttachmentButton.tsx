import type React from 'react';
import { Paperclip } from 'lucide-react';
import { t } from '../../../i18n';

interface AttachmentButtonProps {
  readonly inputId: string;
  readonly isLoading: boolean;
  readonly onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AttachmentButton = ({ inputId, isLoading, onImageUpload }: AttachmentButtonProps) => (
  <div className="relative flex items-center justify-center">
    <input
      type="file"
      id={inputId}
      accept="image/*"
      multiple
      className="hidden"
      onChange={onImageUpload}
      disabled={isLoading}
    />
    <label
      htmlFor={inputId}
      className={`composer-icon-btn ${isLoading ? 'is-disabled' : ''}`}
      title={t('attachImage')}
      aria-label={t('attachImage')}
    >
      <Paperclip size={15} />
    </label>
  </div>
);
