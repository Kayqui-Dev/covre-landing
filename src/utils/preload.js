/**
 * Intelligent Image Preloader
 * Caches images in the browser's memory and reports loading progress.
 * 
 * @param {string[]} urls Array of image URLs to preload
 * @param {function} onProgress Callback triggered on each image load: (progress: number, loadedCount: number)
 * @returns {Promise<HTMLImageElement[]>} Resolves with the array of preloaded Image objects
 */
export function preloadImages(urls, onProgress) {
  return new Promise((resolve) => {
    let loadedCount = 0;
    const totalCount = urls.length;
    const images = [];

    if (totalCount === 0) {
      resolve([]);
      return;
    }

    // Preload with high-priority since these are critical for the page's visual canvas scrub
    urls.forEach((url, index) => {
      const img = new Image();
      
      // Use fetch priority if supported
      img.fetchPriority = "high";
      
      img.onload = () => {
        loadedCount++;
        const progress = Math.round((loadedCount / totalCount) * 100);
        if (onProgress) {
          onProgress(progress, loadedCount);
        }
        if (loadedCount === totalCount) {
          resolve(images);
        }
      };

      img.onerror = () => {
        // Even if a frame fails, we increment count to not block the experience
        loadedCount++;
        const progress = Math.round((loadedCount / totalCount) * 100);
        if (onProgress) {
          onProgress(progress, loadedCount);
        }
        if (loadedCount === totalCount) {
          resolve(images);
        }
      };

      img.src = url;
      images[index] = img; // maintain original sequence order
    });
  });
}
