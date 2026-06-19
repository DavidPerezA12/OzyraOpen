import type React from 'react';
import { Paperclip } from 'lucide-react';

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
      title="Adjuntar imagen"
      aria-label="Adjuntar imagen"
    >
      <Paperclip size={15} />
    </label>
  </div>
);
