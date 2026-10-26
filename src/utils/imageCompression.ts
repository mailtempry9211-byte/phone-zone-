
export const compressImage = async (file: File, maxSizeKB: number = 300): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Shrink first so a 3-6 MB iPhone photo is never re-decoded more than
        // necessary. For flat document photos (Aadhaar, bills) 1200px is already
        // generous; for bigger product shots this is still plenty.
        const MAX_LONG = 1200;
        const long = Math.max(img.width, img.height);
        const scale = long > MAX_LONG ? MAX_LONG / long : 1;
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        canvas.width = width;
        canvas.height = height;

        ctx!.imageSmoothingEnabled = true;
        ctx!.imageSmoothingQuality = 'high';
        ctx!.drawImage(img, 0, 0, width, height);

        // Always JPEG for upload. Quicker quality descent than before so the
        // phone does not sit spinning inside repeated toBlob calls.
        let quality = 0.85;
        const compress = () => {
          ctx!.canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              const sizeKB = blob.size / 1024;

              if (sizeKB <= maxSizeKB || quality <= 0.4) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                quality = Math.max(0.4, quality - 0.15);
                compress();
              }
            },
            'image/jpeg',
            quality,
          );
        };

        compress();
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};
