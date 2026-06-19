import { ImageUploadPreview } from '../MessageComponents';
import type { UploadedImage } from './types';

interface AttachmentPreviewProps {
  readonly uploadedImages: readonly UploadedImage[];
  readonly isDarkMode: boolean;
  readonly onRemoveImage: (index: number) => void;
}

export const AttachmentPreview = ({
  uploadedImages,
  isDarkMode,
  onRemoveImage,
}: AttachmentPreviewProps) => (
  <ImageUploadPreview
    uploadedImages={uploadedImages}
    isDarkMode={isDarkMode}
    onRemoveImage={onRemoveImage}
  />
);
