// Shared overlay styles generation

export function generateOverlayStyles(darkMode: boolean): string {
  const bgColor = darkMode ? '#1a1a1a' : '#fefdf7';
  const textColor = darkMode ? '#e0e0e0' : '#333';
  
  return `
    /* Reset all inherited styles on the overlay root */
    #keep-focus-overlay {
      all: unset !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
      font-size: 16px !important;
      font-weight: normal !important;
      font-style: normal !important;
      line-height: normal !important;
      letter-spacing: normal !important;
      text-align: initial !important;
      text-decoration: none !important;
      text-transform: none !important;
      text-indent: 0 !important;
      text-shadow: none !important;
      color: ${textColor} !important;
      background: ${bgColor} !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      min-height: 100vh !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 20px !important;
      padding-bottom: 90px !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: 999999 !important;
      overflow-y: auto !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      direction: ltr !important;
      unicode-bidi: normal !important;
      writing-mode: horizontal-tb !important;
    }
    
    #keep-focus-overlay *,
    #keep-focus-overlay *::before,
    #keep-focus-overlay *::after {
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: inherit !important;
      font-size: inherit !important;
      font-weight: inherit !important;
      font-style: inherit !important;
      line-height: inherit !important;
      color: inherit !important;
      text-align: inherit !important;
      text-decoration: inherit !important;
      text-transform: inherit !important;
      text-indent: 0 !important;
      text-shadow: none !important;
      letter-spacing: inherit !important;
      direction: inherit !important;
      unicode-bidi: inherit !important;
      writing-mode: inherit !important;
    }
    
    #keep-focus-overlay .focus-blocker {
      width: 100% !important;
      max-width: 600px !important;
      display: block !important;
    }
    
    #keep-focus-overlay .focus-card {
      background: ${darkMode ? '#2d2d2d' : 'white'} !important;
      border-radius: 16px !important;
      padding: 40px !important;
      box-shadow: 0 20px 60px ${darkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(212, 184, 150, 0.15)'} !important;
      text-align: center !important;
      display: block !important;
    }
    
    #keep-focus-overlay h2 {
      font-size: 40px !important;
      font-weight: 700 !important;
      margin-bottom: 12px !important;
      color: ${darkMode ? '#e0e0e0' : '#212529'} !important;
      letter-spacing: -0.5px !important;
      display: block !important;
      white-space: nowrap !important;
    }
    
    #keep-focus-overlay .subtitle {
      font-size: 16px !important;
      color: ${darkMode ? '#a0a0a0' : '#6c757d'} !important;
      margin-bottom: 32px !important;
      line-height: 1.5 !important;
      display: block !important;
    }
    
    #keep-focus-overlay .reason-input {
      width: 100% !important;
      padding: 14px !important;
      border: 2px solid ${darkMode ? 'rgba(64, 64, 64, 0.3)' : 'rgba(233, 236, 239, 0.3)'} !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      margin-bottom: 20px !important;
      transition: border-color 0.2s !important;
      font-family: inherit !important;
      display: none !important;
      background: ${darkMode ? '#2d2d2d' : 'white'} !important;
      color: ${darkMode ? '#e0e0e0' : '#333'} !important;
    }
    
    #keep-focus-overlay .reason-input.visible {
      display: block !important;
    }
    
    #keep-focus-overlay .reason-input:focus {
      outline: none !important;
      border-color: ${darkMode ? 'rgba(64, 64, 64, 0.3)' : 'rgba(233, 236, 239, 0.3)'} !important;
    }
    
    #keep-focus-overlay .reason-input:disabled {
      background: ${darkMode ? '#252525' : '#f5f7fa'} !important;
      cursor: not-allowed !important;
      opacity: 0.7 !important;
    }
    
    #keep-focus-overlay .timer-section {
      margin-bottom: 0 !important;
      margin-top: 0 !important;
      display: none !important;
    }
    
    #keep-focus-overlay .timer-section.visible {
      display: block !important;
    }
    
    #keep-focus-overlay .timer-display {
      font-size: 48px !important;
      font-weight: 700 !important;
      color: #d4b896 !important;
      margin-bottom: 8px !important;
      display: block !important;
    }
    
    #keep-focus-overlay .timer-label {
      font-size: 14px !important;
      color: ${darkMode ? '#a0a0a0' : '#6c757d'} !important;
      display: block !important;
    }
    
    #keep-focus-overlay .close-tab-btn-card {
      width: 100% !important;
      padding: 14px 28px !important;
      background: #28a745 !important;
      color: white !important;
      border: none !important;
      border-radius: 8px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      font-family: inherit !important;
      margin-bottom: 12px !important;
      margin-top: 0 !important;
      display: block !important;
    }
    
    #keep-focus-overlay .close-tab-btn-card:hover {
      background: #218838 !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3) !important;
    }
    
    #keep-focus-overlay .close-tab-btn-card:active {
      transform: translateY(0) !important;
    }
    
    #keep-focus-overlay .close-tab-btn-card.hidden {
      display: none !important;
    }
    
    #keep-focus-overlay .more-time-btn {
      width: 100% !important;
      padding: 0 !important;
      background: transparent !important;
      color: ${darkMode ? '#606060' : '#adb5bd'} !important;
      border: none !important;
      border-radius: 0 !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      font-family: inherit !important;
      margin-bottom: 0 !important;
      margin-top: 0 !important;
      display: block !important;
      text-align: center !important;
      text-decoration: none !important;
      opacity: 0.6 !important;
    }
    
    #keep-focus-overlay .more-time-btn:hover:not(:disabled) {
      color: ${darkMode ? '#606060' : '#adb5bd'} !important;
    }
    
    #keep-focus-overlay .more-time-btn:disabled {
      cursor: not-allowed !important;
    }
    
    #keep-focus-overlay .more-time-btn.hidden {
      display: none !important;
    }
    
    #keep-focus-overlay .submit-reason-link {
      width: 100% !important;
      padding: 0 !important;
      background: transparent !important;
      color: ${darkMode ? '#606060' : '#adb5bd'} !important;
      border: none !important;
      border-radius: 0 !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      font-family: inherit !important;
      margin-bottom: 0 !important;
      margin-top: 0 !important;
      display: none !important;
      text-align: center !important;
      text-decoration: none !important;
      opacity: 0.6 !important;
    }
    
    #keep-focus-overlay .submit-reason-link.visible {
      display: block !important;
    }
    
    #keep-focus-overlay .submit-reason-link:hover:not(:disabled) {
      color: ${darkMode ? '#606060' : '#adb5bd'} !important;
    }
    
    #keep-focus-overlay .submit-reason-link:disabled {
      cursor: not-allowed !important;
    }
    
    #keep-focus-overlay .submit-reason-link.hidden {
      display: none !important;
    }
    
    #keep-focus-overlay .continue-btn {
      width: 100% !important;
      padding: 0 !important;
      background: transparent !important;
      color: ${darkMode ? '#606060' : '#adb5bd'} !important;
      border: none !important;
      border-radius: 0 !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      font-family: inherit !important;
      display: none !important;
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      text-align: center !important;
      text-decoration: none !important;
      opacity: 0.6 !important;
    }
    
    #keep-focus-overlay .continue-btn.visible {
      display: block !important;
    }
    
    #keep-focus-overlay .continue-btn:hover:not(:disabled) {
      color: ${darkMode ? '#606060' : '#adb5bd'} !important;
    }
    
    #keep-focus-overlay .continue-btn:disabled {
      cursor: not-allowed !important;
    }
    
    #keep-focus-overlay .quote-section {
      margin-top: 32px !important;
      padding-top: 24px !important;
      border-top: 1px solid ${darkMode ? '#404040' : '#e9ecef'} !important;
      display: block !important;
    }
    
    #keep-focus-overlay .simplified-view {
      text-align: center !important;
      margin-bottom: 0 !important;
      margin-top: 0 !important;
      display: block !important;
    }
    
    #keep-focus-overlay .simplified-view.visible {
      margin-bottom: 32px !important;
      margin-top: 40px !important;
    }
    
    #keep-focus-overlay .quote {
      font-size: 20px !important;
      font-style: italic !important;
      color: ${darkMode ? '#c0c0c0' : '#495057'} !important;
      line-height: 1.8 !important;
      margin-bottom: 16px !important;
      max-width: 600px !important;
      margin-left: auto !important;
      margin-right: auto !important;
      font-weight: 400 !important;
      display: block !important;
    }
    
    #keep-focus-overlay .quote-author {
      font-size: 14px !important;
      color: ${darkMode ? '#a0a0a0' : '#6c757d'} !important;
      font-weight: 500 !important;
      display: block !important;
    }
    
    #keep-focus-overlay .close-tab-btn {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      padding: 18px 28px !important;
      background: #28a745 !important;
      color: white !important;
      border: none !important;
      border-radius: 0 !important;
      font-size: 18px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      font-family: inherit !important;
      z-index: 1000000 !important;
      box-shadow: 0 -4px 12px rgba(40, 167, 69, 0.3) !important;
      text-align: center !important;
      display: block !important;
    }
    
    #keep-focus-overlay .close-tab-btn:hover {
      background: #218838 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 -6px 16px rgba(40, 167, 69, 0.4) !important;
    }
    
    #keep-focus-overlay .close-tab-btn:active {
      transform: translateY(0) !important;
      box-shadow: 0 -2px 8px rgba(40, 167, 69, 0.3) !important;
    }
  `;
}

export function getOverlayInlineStyles(darkMode: boolean): string {
  const bgColor = darkMode ? '#1a1a1a' : '#fefdf7';
  const textColor = darkMode ? '#e0e0e0' : '#333';
  
  return `
    all: unset !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
    font-size: 16px !important;
    font-weight: normal !important;
    font-style: normal !important;
    line-height: normal !important;
    letter-spacing: normal !important;
    text-align: initial !important;
    text-decoration: none !important;
    text-transform: none !important;
    text-indent: 0 !important;
    text-shadow: none !important;
    color: ${textColor} !important;
    background: ${bgColor} !important;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    min-height: 100vh !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 20px !important;
    padding-bottom: 90px !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 999999 !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    direction: ltr !important;
    unicode-bidi: normal !important;
    writing-mode: horizontal-tb !important;
  `;
}

