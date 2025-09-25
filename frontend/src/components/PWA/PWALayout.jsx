/**
 * PWA Layout Component for GlobalTaxCalc
 *
 * Provides native-like app interface with PWA-specific features,
 * touch interactions, and mobile-optimized navigation.
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  PWACapabilities,
  appInstaller,
  TouchGestureHandler,
  HapticFeedback,
  FullScreenManager,
  NativeSharing
} from '../../lib/pwa/native-features';
import { offlineStorage } from '../../lib/offline/indexeddb-manager';
import {
  Home,
  Calculator,
  History,
  Settings,
  Menu,
  X,
  Download,
  Share,
  Maximize,
  Minimize,
  ArrowLeft,
  MoreHorizontal,
  Bell,
  Wifi,
  WifiOff
} from 'lucide-react';

const PWALayout = ({ children, title, showBackButton = false, showShare = false }) => {
  const router = useRouter();
  const layoutRef = useRef(null);
  const gestureHandlerRef = useRef(null);

  // State management
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [navigationState, setNavigationState] = useState('home');
  const [recentCalculations, setRecentCalculations] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  // Initialize PWA features
  useEffect(() => {
    initializePWALayout();
    setupGestureHandling();
    setupNetworkStatus();
    loadRecentCalculations();

    return () => {
      if (gestureHandlerRef.current) {
        // Cleanup gesture handler if needed
      }
    };
  }, []);

  // Initialize PWA layout features
  const initializePWALayout = async () => {
    // Check installation status
    setIsInstalled(PWACapabilities.isInstalled());
    setCanInstall(appInstaller.isInstallable);

    // Set up install event listeners
    appInstaller.onInstallable(() => setCanInstall(true));
    appInstaller.onInstalled(() => {
      setIsInstalled(true);
      setCanInstall(false);
    });

    // Check fullscreen status
    setIsFullscreen(PWACapabilities.isFullscreen());

    // Set up fullscreen change listener
    FullScreenManager.onFullscreenChange(() => {
      setIsFullscreen(PWACapabilities.isFullscreen());
    });

    // Set navigation state based on current route
    const path = router.pathname;
    if (path === '/') {
      setNavigationState('home');
    } else if (path.startsWith('/calculators/')) {
      setNavigationState('calculator');
    } else if (path === '/history') {
      setNavigationState('history');
    } else if (path === '/settings') {
      setNavigationState('settings');
    }
  };

  // Set up gesture handling
  const setupGestureHandling = () => {
    if (layoutRef.current && PWACapabilities.hasTouch()) {
      gestureHandlerRef.current = new TouchGestureHandler(layoutRef.current);

      // Right swipe to go back
      gestureHandlerRef.current.onSwipe('right', (data) => {
        if (data.distance > 100 && showBackButton) {
          HapticFeedback.light();
          handleBack();
        }
      });

      // Left swipe to open menu
      gestureHandlerRef.current.onSwipe('left', (data) => {
        if (data.startX < 50 && data.distance > 100) {
          HapticFeedback.light();
          setShowMenu(true);
        }
      });

      // Double tap to toggle fullscreen
      let tapCount = 0;
      gestureHandlerRef.current.onTap(() => {
        tapCount++;
        setTimeout(() => {
          if (tapCount === 2) {
            handleFullscreenToggle();
          }
          tapCount = 0;
        }, 300);
      });
    }
  };

  // Set up network status monitoring
  const setupNetworkStatus = () => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  };

  // Load recent calculations
  const loadRecentCalculations = async () => {
    try {
      const calculations = await offlineStorage.getCalculations({
        limit: 3,
        sortBy: 'timestamp'
      });
      setRecentCalculations(calculations);
    } catch (error) {
      console.error('Failed to load recent calculations:', error);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    HapticFeedback.light();
    router.back();
  };

  // Handle app installation
  const handleInstall = async () => {
    try {
      HapticFeedback.medium();
      const outcome = await appInstaller.showInstallPrompt();
      console.log('Install outcome:', outcome);
    } catch (error) {
      console.error('Installation failed:', error);
      HapticFeedback.error();
    }
  };

  // Handle sharing
  const handleShare = async () => {
    try {
      HapticFeedback.light();

      const shareData = {
        title: title || 'GlobalTaxCalc',
        text: 'Check out this free tax calculator!',
        url: window.location.href
      };

      await NativeSharing.share(shareData);
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  // Handle fullscreen toggle
  const handleFullscreenToggle = async () => {
    try {
      HapticFeedback.medium();
      await FullScreenManager.toggle();
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  };

  // Navigation handlers
  const navigate = (path, state) => {
    HapticFeedback.light();
    setNavigationState(state);
    setShowMenu(false);
    router.push(path);
  };

  // App status indicator
  const AppStatusBar = () => (
    <div className="app-status-bar">
      <div className="status-indicators">
        {/* Network status */}
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? (
            <Wifi className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
        </div>

        {/* Notification indicator */}
        {notificationCount > 0 && (
          <div className="notification-indicator">
            <Bell className="h-4 w-4" />
            <span className="notification-badge">{notificationCount}</span>
          </div>
        )}

        {/* PWA indicator */}
        {isInstalled && (
          <div className="pwa-indicator">
            <div className="pwa-dot"></div>
          </div>
        )}
      </div>
    </div>
  );

  // Navigation header
  const NavigationHeader = () => (
    <header className="pwa-header">
      <div className="header-content">
        <div className="header-left">
          {showBackButton ? (
            <button
              onClick={handleBack}
              className="header-button back-button"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={() => setShowMenu(true)}
              className="header-button menu-button"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="header-center">
          <h1 className="header-title">{title || 'GlobalTaxCalc'}</h1>
        </div>

        <div className="header-right">
          {showShare && (
            <button
              onClick={handleShare}
              className="header-button share-button"
              aria-label="Share"
            >
              <Share className="h-5 w-5" />
            </button>
          )}

          <button
            onClick={() => setShowMenu(true)}
            className="header-button more-button"
            aria-label="More options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );

  // Side menu
  const SideMenu = () => (
    <div className={`side-menu ${showMenu ? 'open' : ''}`}>
      <div className="menu-overlay" onClick={() => setShowMenu(false)}></div>

      <div className="menu-content">
        <div className="menu-header">
          <h2 className="menu-title">GlobalTaxCalc</h2>
          <button
            onClick={() => setShowMenu(false)}
            className="menu-close"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="menu-navigation">
          <button
            onClick={() => navigate('/', 'home')}
            className={`menu-item ${navigationState === 'home' ? 'active' : ''}`}
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => navigate('/calculators', 'calculator')}
            className={`menu-item ${navigationState === 'calculator' ? 'active' : ''}`}
          >
            <Calculator className="h-5 w-5" />
            <span>Calculators</span>
          </button>

          <button
            onClick={() => navigate('/history', 'history')}
            className={`menu-item ${navigationState === 'history' ? 'active' : ''}`}
          >
            <History className="h-5 w-5" />
            <span>History</span>
          </button>

          <button
            onClick={() => navigate('/settings', 'settings')}
            className={`menu-item ${navigationState === 'settings' ? 'active' : ''}`}
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Recent calculations */}
        {recentCalculations.length > 0 && (
          <div className="menu-section">
            <h3 className="section-title">Recent Calculations</h3>
            <div className="recent-list">
              {recentCalculations.map((calc, index) => (
                <button
                  key={calc.id}
                  onClick={() => {
                    setShowMenu(false);
                    router.push(`/calculators/${calc.calculationType}?load=${calc.id}`);
                  }}
                  className="recent-item"
                >
                  <Calculator className="h-4 w-4" />
                  <span>{calc.calculationType.replace('-', ' ')}</span>
                  <span className="recent-date">
                    {new Date(calc.timestamp).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PWA actions */}
        <div className="menu-actions">
          {canInstall && (
            <button
              onClick={handleInstall}
              className="action-button install-button"
            >
              <Download className="h-4 w-4" />
              <span>Install App</span>
            </button>
          )}

          {FullScreenManager.isSupported() && (
            <button
              onClick={handleFullscreenToggle}
              className="action-button fullscreen-button"
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
          )}
        </div>

        {/* App info */}
        <div className="menu-footer">
          <div className="app-version">
            <span>Version 1.0.0</span>
            {isInstalled && <span className="installed-badge">Installed</span>}
          </div>
        </div>
      </div>
    </div>
  );

  // Bottom navigation (for mobile)
  const BottomNavigation = () => (
    <nav className="bottom-navigation">
      <button
        onClick={() => navigate('/', 'home')}
        className={`nav-item ${navigationState === 'home' ? 'active' : ''}`}
      >
        <Home className="h-5 w-5" />
        <span>Home</span>
      </button>

      <button
        onClick={() => navigate('/calculators', 'calculator')}
        className={`nav-item ${navigationState === 'calculator' ? 'active' : ''}`}
      >
        <Calculator className="h-5 w-5" />
        <span>Calculate</span>
      </button>

      <button
        onClick={() => navigate('/history', 'history')}
        className={`nav-item ${navigationState === 'history' ? 'active' : ''}`}
      >
        <History className="h-5 w-5" />
        <span>History</span>
      </button>

      <button
        onClick={() => navigate('/settings', 'settings')}
        className={`nav-item ${navigationState === 'settings' ? 'active' : ''}`}
      >
        <Settings className="h-5 w-5" />
        <span>Settings</span>
      </button>
    </nav>
  );

  return (
    <div ref={layoutRef} className="pwa-layout">
      <AppStatusBar />
      <NavigationHeader />

      <main className="pwa-main">
        {children}
      </main>

      <SideMenu />
      <BottomNavigation />

      {/* Install prompt (if applicable) */}
      {canInstall && !isInstalled && (
        <div className="install-prompt">
          <div className="install-content">
            <p>Install GlobalTaxCalc for a better experience!</p>
            <button onClick={handleInstall} className="install-button">
              Install
            </button>
            <button
              onClick={() => setCanInstall(false)}
              className="dismiss-button"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .pwa-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          background: var(--bg-primary, #ffffff);
          position: relative;
        }

        .app-status-bar {
          height: 24px;
          background: var(--status-bar-bg, #000000);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 16px;
          color: white;
          font-size: 12px;
        }

        .status-indicators {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
        }

        .status-indicator.offline {
          color: #ef4444;
        }

        .notification-indicator {
          position: relative;
          display: flex;
          align-items: center;
        }

        .notification-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          font-size: 10px;
          min-width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pwa-indicator {
          display: flex;
          align-items: center;
        }

        .pwa-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
        }

        .pwa-header {
          background: var(--header-bg, #667eea);
          color: white;
          padding: 12px 16px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left,
        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 60px;
        }

        .header-center {
          flex: 1;
          text-align: center;
        }

        .header-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-button {
          background: none;
          border: none;
          color: white;
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .header-button:active {
          background: rgba(255, 255, 255, 0.2);
        }

        .pwa-main {
          flex: 1;
          overflow-y: auto;
          padding-bottom: 80px; /* Space for bottom navigation */
        }

        .side-menu {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          visibility: hidden;
          opacity: 0;
          transition: visibility 0.3s, opacity 0.3s;
        }

        .side-menu.open {
          visibility: visible;
          opacity: 1;
        }

        .menu-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }

        .menu-content {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          background: white;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          overflow-y: auto;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
        }

        .side-menu.open .menu-content {
          transform: translateX(0);
        }

        .menu-header {
          padding: 20px;
          background: var(--header-bg, #667eea);
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .menu-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }

        .menu-close {
          background: none;
          border: none;
          color: white;
          padding: 4px;
          cursor: pointer;
        }

        .menu-navigation {
          padding: 16px 0;
        }

        .menu-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          transition: background-color 0.2s;
          font-size: 16px;
        }

        .menu-item:hover {
          background: rgba(102, 126, 234, 0.1);
        }

        .menu-item.active {
          background: rgba(102, 126, 234, 0.15);
          color: var(--primary-color, #667eea);
          font-weight: 600;
        }

        .menu-section {
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
        }

        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          margin: 0 0 12px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .recent-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          font-size: 14px;
          color: #6b7280;
        }

        .recent-date {
          margin-left: auto;
          font-size: 12px;
        }

        .menu-actions {
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
        }

        .action-button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #f3f4f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 8px;
          transition: background-color 0.2s;
        }

        .action-button:hover {
          background: #e5e7eb;
        }

        .install-button {
          background: var(--primary-color, #667eea);
          color: white;
        }

        .install-button:hover {
          background: var(--primary-dark, #5a67d8);
        }

        .menu-footer {
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
        }

        .app-version {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #6b7280;
        }

        .installed-badge {
          background: #10b981;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
        }

        .bottom-navigation {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          border-top: 1px solid #e5e7eb;
          display: flex;
          padding: 8px 0;
          z-index: 100;
        }

        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          color: #6b7280;
          transition: color 0.2s;
        }

        .nav-item.active {
          color: var(--primary-color, #667eea);
        }

        .install-prompt {
          position: fixed;
          bottom: 100px;
          left: 16px;
          right: 16px;
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 200;
          animation: slideUp 0.3s ease;
        }

        .install-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .install-content p {
          flex: 1;
          margin: 0;
          font-size: 14px;
        }

        .install-button {
          background: var(--primary-color, #667eea);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .dismiss-button {
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          font-size: 14px;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @media (min-width: 768px) {
          .app-status-bar {
            display: none;
          }

          .bottom-navigation {
            display: none;
          }

          .pwa-main {
            padding-bottom: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default PWALayout;