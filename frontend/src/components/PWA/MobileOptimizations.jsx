/**
 * Mobile Optimizations Component
 *
 * React component that initializes and manages mobile-specific optimizations
 * for the GlobalTaxCalc PWA.
 */

import { useEffect, useState, useCallback } from 'react';
import { initializeMobileOptimizations } from '../../lib/pwa/mobile-optimizations';

const MobileOptimizations = ({ children }) => {
  const [optimizations, setOptimizations] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState('unknown');
  const [orientation, setOrientation] = useState('portrait');
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    // Initialize mobile optimizations
    const initOptimizations = async () => {
      try {
        const opts = initializeMobileOptimizations();
        setOptimizations(opts);

        // Set initial state
        setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
        setPlatform(opts.platformOptimizer.platform);

        // Listen for orientation changes
        opts.viewportManager.onOrientationChange(({ isLandscape }) => {
          setOrientation(isLandscape ? 'landscape' : 'portrait');
        });

        // Monitor keyboard state
        let initialHeight = window.innerHeight;
        const handleResize = () => {
          const currentHeight = window.innerHeight;
          const heightDifference = initialHeight - currentHeight;
          setKeyboardOpen(heightDifference > 150);
        };

        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
        };
      } catch (error) {
        console.error('Failed to initialize mobile optimizations:', error);
      }
    };

    initOptimizations();
  }, []);

  // Handle special mobile events
  useEffect(() => {
    if (!optimizations) return;

    // Handle pull-to-refresh
    const handlePullRefresh = (event) => {
      const { element } = event.detail;

      // Refresh calculator history or data
      if (element.classList.contains('calculator-history')) {
        refreshCalculatorHistory();
      } else if (element.classList.contains('results-container')) {
        refreshResults();
      }
    };

    // Handle shake gesture
    const handleShakeClear = () => {
      const clearEvent = new CustomEvent('calculator-clear', {
        detail: { source: 'shake' }
      });
      document.dispatchEvent(clearEvent);
    };

    // Handle long press
    const handleLongPress = (event) => {
      const { element } = event.detail;

      if (element.classList.contains('calculator-button')) {
        showCalculatorButtonMenu(element);
      } else if (element.classList.contains('result-item')) {
        showResultItemMenu(element);
      }
    };

    document.addEventListener('pullrefresh', handlePullRefresh);
    document.addEventListener('shakeclear', handleShakeClear);
    document.addEventListener('longpress', handleLongPress);

    return () => {
      document.removeEventListener('pullrefresh', handlePullRefresh);
      document.removeEventListener('shakeclear', handleShakeClear);
      document.removeEventListener('longpress', handleLongPress);
    };
  }, [optimizations]);

  const refreshCalculatorHistory = useCallback(async () => {
    try {
      // Refresh calculation history from IndexedDB
      const { IndexedDBManager } = await import('../../lib/offline/indexeddb-manager');
      const dbManager = new IndexedDBManager();
      await dbManager.init();

      const recent = await dbManager.getRecentCalculations(20);

      // Dispatch refresh event
      const refreshEvent = new CustomEvent('history-refreshed', {
        detail: { calculations: recent }
      });
      document.dispatchEvent(refreshEvent);
    } catch (error) {
      console.error('Failed to refresh calculator history:', error);
    }
  }, []);

  const refreshResults = useCallback(() => {
    // Refresh current calculation results
    const refreshEvent = new CustomEvent('results-refresh');
    document.dispatchEvent(refreshEvent);
  }, []);

  const showCalculatorButtonMenu = useCallback((button) => {
    const menu = document.createElement('div');
    menu.className = 'mobile-context-menu';
    menu.innerHTML = `
      <div class="context-menu-item" data-action="copy">Copy</div>
      <div class="context-menu-item" data-action="info">Info</div>
    `;

    // Position menu near button
    const rect = button.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = '10000';

    document.body.appendChild(menu);

    // Handle menu actions
    menu.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'copy') {
        navigator.clipboard?.writeText(button.textContent);
      } else if (action === 'info') {
        showButtonInfo(button);
      }
      menu.remove();
    });

    // Remove menu on outside click
    setTimeout(() => {
      document.addEventListener('click', () => {
        if (menu.parentNode) {
          menu.remove();
        }
      }, { once: true });
    }, 100);
  }, []);

  const showResultItemMenu = useCallback((item) => {
    const menu = document.createElement('div');
    menu.className = 'mobile-context-menu';
    menu.innerHTML = `
      <div class="context-menu-item" data-action="copy">Copy Result</div>
      <div class="context-menu-item" data-action="share">Share</div>
      <div class="context-menu-item" data-action="save">Save</div>
    `;

    // Position menu near item
    const rect = item.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = '10000';

    document.body.appendChild(menu);

    // Handle menu actions
    menu.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const resultText = item.textContent;

      if (action === 'copy') {
        navigator.clipboard?.writeText(resultText);
      } else if (action === 'share') {
        shareResult(resultText);
      } else if (action === 'save') {
        saveResult(resultText);
      }
      menu.remove();
    });

    // Remove menu on outside click
    setTimeout(() => {
      document.addEventListener('click', () => {
        if (menu.parentNode) {
          menu.remove();
        }
      }, { once: true });
    }, 100);
  }, []);

  const shareResult = useCallback(async (resultText) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Tax Calculation Result',
          text: resultText,
          url: window.location.href
        });
      } catch (error) {
        console.warn('Native sharing failed:', error);
        fallbackShare(resultText);
      }
    } else {
      fallbackShare(resultText);
    }
  }, []);

  const fallbackShare = useCallback((resultText) => {
    // Copy to clipboard as fallback
    navigator.clipboard?.writeText(resultText).then(() => {
      showToast('Result copied to clipboard');
    });
  }, []);

  const saveResult = useCallback(async (resultText) => {
    try {
      const { IndexedDBManager } = await import('../../lib/offline/indexeddb-manager');
      const dbManager = new IndexedDBManager();
      await dbManager.init();

      const savedResult = {
        id: Date.now().toString(),
        type: 'saved-result',
        content: resultText,
        timestamp: Date.now(),
        source: 'manual-save'
      };

      await dbManager.saveCalculation(savedResult);
      showToast('Result saved');
    } catch (error) {
      console.error('Failed to save result:', error);
      showToast('Failed to save result');
    }
  }, []);

  const showButtonInfo = useCallback((button) => {
    const modal = document.createElement('div');
    modal.className = 'mobile-info-modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <h3>Calculator Button</h3>
        <p><strong>Function:</strong> ${button.dataset.function || 'Calculate'}</p>
        <p><strong>Value:</strong> ${button.textContent}</p>
        <p><strong>Description:</strong> ${getButtonDescription(button)}</p>
        <button class="close-modal">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.close-modal').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('.modal-backdrop').addEventListener('click', () => {
      modal.remove();
    });
  }, []);

  const getButtonDescription = useCallback((button) => {
    const value = button.textContent;
    const descriptions = {
      '+': 'Addition operator',
      '-': 'Subtraction operator',
      '×': 'Multiplication operator',
      '÷': 'Division operator',
      '=': 'Calculate result',
      'C': 'Clear all',
      'CE': 'Clear entry',
      '%': 'Percentage calculation',
      '.': 'Decimal point'
    };

    return descriptions[value] || 'Numeric input';
  }, []);

  const showToast = useCallback((message) => {
    const toast = document.createElement('div');
    toast.className = 'mobile-toast';
    toast.textContent = message;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 2000);
  }, []);

  // Apply platform and state classes
  const containerClasses = [
    'mobile-optimized-container',
    isStandalone && 'standalone-mode',
    `platform-${platform}`,
    `orientation-${orientation}`,
    keyboardOpen && 'keyboard-open'
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {children}

      {/* Mobile-specific overlays and components */}
      <MobileStatusBar platform={platform} isStandalone={isStandalone} />
      <MobileKeyboardSpacer keyboardOpen={keyboardOpen} />

      {/* Install prompt for iOS */}
      {platform === 'ios' && !isStandalone && <IOSInstallPrompt />}
    </div>
  );
};

// Mobile Status Bar Component
const MobileStatusBar = ({ platform, isStandalone }) => {
  if (!isStandalone || platform !== 'ios') return null;

  return (
    <div className="mobile-status-bar safe-area-top">
      <div className="status-bar-content">
        <span className="status-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="status-indicators">
          <span className="signal-indicator">●●●</span>
          <span className="battery-indicator">🔋</span>
        </span>
      </div>
    </div>
  );
};

// Keyboard Spacer Component
const MobileKeyboardSpacer = ({ keyboardOpen }) => {
  if (!keyboardOpen) return null;

  return <div className="keyboard-spacer" style={{ height: '50vh' }} />;
};

// iOS Install Prompt Component
const IOSInstallPrompt = () => {
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const lastDismissed = localStorage.getItem('ios-install-dismissed');
    if (lastDismissed && Date.now() - parseInt(lastDismissed) < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true);
      return;
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    localStorage.setItem('ios-install-dismissed', Date.now().toString());
  };

  if (dismissed || !showPrompt) return null;

  return (
    <div className="ios-install-banner">
      <div className="install-content">
        <span>Add to Home Screen for the best experience</span>
        <button className="install-close" onClick={handleDismiss}>×</button>
      </div>
      <div className="install-instructions">
        Tap
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <path d="M6 0L10 4H8V10H4V4H2L6 0Z"/>
          <rect y="12" width="12" height="2"/>
        </svg>
        then "Add to Home Screen"
      </div>
    </div>
  );
};

export default MobileOptimizations;