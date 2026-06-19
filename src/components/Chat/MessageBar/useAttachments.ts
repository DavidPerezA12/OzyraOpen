import { useEffect, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'react-hot-toast';
import type { UploadedImage } from './types';

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

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
    console.warn('Error liberando URL de imagen', error);
  }
};

export const useAttachments = ({ uploadedImages, setUploadedImages }: UseAttachmentsOptions) => {
  const trackedBlobUrlsRef = useRef<Set<string> | null>(null);
  if (trackedBlobUrlsRef.current === null) {
    trackedBlobUrlsRef.current = new Set();
  }
  const trackedBlobUrls = trackedBlobUrlsRef.current;

  const addFileAsImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error('La imagen es demasiado grande. Tamaño máximo: 5MB');
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
            toast.error(`Máximo ${MAX_IMAGES} imágenes por mensaje`);
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
      toast.error('No se pudo leer la imagen adjunta');
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
      addFileAsImage(file);
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
