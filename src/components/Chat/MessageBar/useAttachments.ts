import { useEffect, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'react-hot-toast';
import { t } from '../../../i18n';
import type { UploadedImage } from './types';
import { logger } from '../../../utils/logger';

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const getFileExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};

const isAllowedImage = (file: File): boolean => {
  // file.type es controlable por el cliente: exigir MIME + extensión coherentes.
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return false;
  }
  const ext = getFileExtension(file.name);
  if (file.type === 'image/png' && ext !== 'png') {
    return ext === '';
  }
  if (file.type === 'image/jpeg' && !['jpg', 'jpeg'].includes(ext)) {
    return ext === '';
  }
  if (file.type === 'image/webp' && ext !== 'webp') {
    return ext === '';
  }
  if (file.type === 'image/gif' && ext !== 'gif') {
    return ext === '';
  }
  return true;
};

interface UseAttachmentsOptions {
  readonly uploadedImages: readonly UploadedImage[];
  readonly setUploadedImages: Dispatch<SetStateAction<UploadedImage[]>>;
}

const isBlobUrl = (url: string): boolean => url.startsWith('blob:');

const revokeBlobUrl = (url: string): void => {
  if (!isBlobUrl(url)) {
    return;
  }

  try {
    URL.revokeObjectURL(url);
  } catch (error) {
    logger.warn('Error liberando URL de imagen', { detail: error });
  }
};

export const useAttachments = ({ uploadedImages, setUploadedImages }: UseAttachmentsOptions) => {
  const trackedBlobUrlsRef = useRef<Set<string> | null>(null);
  if (trackedBlobUrlsRef.current === null) {
    trackedBlobUrlsRef.current = new Set();
  }
  const trackedBlobUrls = trackedBlobUrlsRef.current;

  const addFileAsImage = (file: File) => {
    if (!isAllowedImage(file)) {
      toast.error(t('imageReadError'));
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(t('imageTooLarge', { maxSize: MAX_IMAGE_SIZE_BYTES / (1024 * 1024) }));
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        const data = event.target.result.split(',')[1] ?? '';
        setUploadedImages((currentImages) => {
          if (currentImages.length >= MAX_IMAGES) {
            revokeBlobUrl(imageUrl);
            toast.error(t('maxImagesPerMessage', { max: MAX_IMAGES }));
            return currentImages;
          }

          return [
            ...currentImages,
            {
              url: imageUrl,
              contentType: file.type,
              data,
            },
          ];
        });
      }
    };
    reader.onerror = () => {
      revokeBlobUrl(imageUrl);
      toast.error(t('imageReadError'));
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        addFileAsImage(file);
      }
    }

    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setUploadedImages((currentImages) =>
      currentImages.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  useEffect(() => {
    const nextBlobUrls = new Set<string>();
    for (const image of uploadedImages) {
      if (isBlobUrl(image.url)) {
        nextBlobUrls.add(image.url);
      }
    }

    for (const url of trackedBlobUrls) {
      if (!nextBlobUrls.has(url)) {
        revokeBlobUrl(url);
      }
    }
    trackedBlobUrls.clear();
    nextBlobUrls.forEach((url) => trackedBlobUrls.add(url));
  }, [trackedBlobUrls, uploadedImages]);

  useEffect(
    () => () => {
      trackedBlobUrls.forEach(revokeBlobUrl);
      trackedBlobUrls.clear();
    },
    [trackedBlobUrls]
  );

  return {
    addFileAsImage,
    handleImageUpload,
    isPreviewOpen: uploadedImages.length > 0,
    removeImage,
  };
};
