// Media control utilities for pausing videos and audio

// Global variable to track media observer
let mediaObserver: MutationObserver | null = null;

// Extend Window interface for our custom property
declare global {
  interface Window {
    _keepFocusPauseInterval?: number;
  }
}

// Pause all video and audio elements on the page
export function pauseAllMedia(): void {
  // Pause all video elements
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (!video.paused) {
      video.pause();
    }
    // Prevent autoplay by removing autoplay attribute
    video.removeAttribute('autoplay');
    video.autoplay = false;
  });
  
  // Pause all audio elements
  const audios = document.querySelectorAll('audio');
  audios.forEach(audio => {
    if (!audio.paused) {
      audio.pause();
    }
    // Prevent autoplay by removing autoplay attribute
    audio.removeAttribute('autoplay');
    audio.autoplay = false;
  });
  
  // Also try to pause any media elements in iframes (if accessible)
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    try {
      // Only access iframe content if same-origin
      const iframeDoc = iframe.contentDocument || (iframe.contentWindow as Window | null)?.document;
      if (iframeDoc) {
        const iframeVideos = iframeDoc.querySelectorAll('video');
        iframeVideos.forEach(video => {
          if (!video.paused) {
            video.pause();
          }
          video.removeAttribute('autoplay');
          video.autoplay = false;
        });
        
        const iframeAudios = iframeDoc.querySelectorAll('audio');
        iframeAudios.forEach(audio => {
          if (!audio.paused) {
            audio.pause();
          }
          audio.removeAttribute('autoplay');
          audio.autoplay = false;
        });
      }
    } catch (e) {
      // Cross-origin iframe, can't access - that's okay
    }
  });
}

// Start observing for new media elements and pause them
export function startMediaObserver(): void {
  // Stop any existing observer
  stopMediaObserver();
  
  // Pause existing media immediately
  pauseAllMedia();
  
  // Create observer to watch for new media elements
  mediaObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          const element = node as Element;
          // Check if the added node is a media element
          if (element.tagName === 'VIDEO' || element.tagName === 'AUDIO') {
            const mediaElement = element as HTMLVideoElement | HTMLAudioElement;
            if (!mediaElement.paused) {
              mediaElement.pause();
            }
            mediaElement.removeAttribute('autoplay');
            mediaElement.autoplay = false;
          }
          
          // Check for media elements within the added node
          const videos = element.querySelectorAll?.('video');
          if (videos) {
            videos.forEach(video => {
              if (!video.paused) {
                video.pause();
              }
              video.removeAttribute('autoplay');
              video.autoplay = false;
            });
          }
          
          const audios = element.querySelectorAll?.('audio');
          if (audios) {
            audios.forEach(audio => {
              if (!audio.paused) {
                audio.pause();
              }
              audio.removeAttribute('autoplay');
              audio.autoplay = false;
            });
          }
        }
      });
    });
  });
  
  // Start observing the document body for new elements
  if (document.body) {
    mediaObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Also periodically pause media as a backup (in case observer misses something)
  const pauseInterval = setInterval(() => {
    const overlay = document.getElementById('keep-focus-overlay');
    if (!overlay) {
      // Overlay removed, stop the interval
      clearInterval(pauseInterval);
      return;
    }
    pauseAllMedia();
  }, 1000); // Check every second
  
  // Store interval ID so we can clear it if needed
  if (!window._keepFocusPauseInterval) {
    window._keepFocusPauseInterval = pauseInterval;
  }
}

// Stop observing for new media elements
export function stopMediaObserver(): void {
  if (mediaObserver) {
    mediaObserver.disconnect();
    mediaObserver = null;
  }
  
  // Clear the periodic pause interval
  if (window._keepFocusPauseInterval) {
    clearInterval(window._keepFocusPauseInterval);
    window._keepFocusPauseInterval = undefined;
  }
}

