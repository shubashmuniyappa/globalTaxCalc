/**
 * App Shortcuts Component
 *
 * Handles app shortcuts registration and quick calculator widget display.
 */

import { useEffect, useState } from 'react';
import { AppShortcutManager, QuickCalculatorWidget } from '../../lib/pwa/app-shortcuts';
import { PWACapabilities } from '../../lib/pwa/native-features';

const AppShortcuts = () => {
  const [shortcutManager, setShortcutManager] = useState(null);
  const [widgetManager, setWidgetManager] = useState(null);
  const [showWidget, setShowWidget] = useState(false);
  const [currentWidget, setCurrentWidget] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && PWACapabilities.isPWAInstalled()) {
      const manager = new AppShortcutManager();
      const widget = new QuickCalculatorWidget();

      setShortcutManager(manager);
      setWidgetManager(widget);

      // Initialize shortcuts
      manager.init();

      // Listen for widget requests
      window.addEventListener('show-quick-calculator', handleShowWidget);
      window.addEventListener('hide-quick-calculator', handleHideWidget);

      return () => {
        window.removeEventListener('show-quick-calculator', handleShowWidget);
        window.removeEventListener('hide-quick-calculator', handleHideWidget);
      };
    }
  }, []);

  const handleShowWidget = (event) => {
    const { calculatorType, position } = event.detail || {};
    if (widgetManager && !showWidget) {
      widgetManager.showWidget(calculatorType || 'income-tax', position || 'bottom-right');
      setShowWidget(true);
      setCurrentWidget(calculatorType || 'income-tax');
    }
  };

  const handleHideWidget = () => {
    if (widgetManager && showWidget) {
      widgetManager.hideWidget();
      setShowWidget(false);
      setCurrentWidget(null);
    }
  };

  const toggleWidget = (calculatorType = 'income-tax') => {
    if (showWidget) {
      handleHideWidget();
    } else {
      handleShowWidget({ detail: { calculatorType } });
    }
  };

  // Floating Action Button for widget trigger
  return (
    <>
      {PWACapabilities.isPWAInstalled() && (
        <div className="widget-fab-menu">
          <button
            className="widget-fab"
            onClick={() => toggleWidget('income-tax')}
            aria-label="Quick Calculator"
            title="Open Quick Calculator"
          >
            <span>🧮</span>
          </button>

          {showWidget && (
            <div className="fab-menu-items">
              <button
                className="fab-menu-item"
                onClick={() => toggleWidget('income-tax')}
              >
                Income Tax
              </button>
              <button
                className="fab-menu-item"
                onClick={() => toggleWidget('paycheck')}
              >
                Paycheck
              </button>
              <button
                className="fab-menu-item"
                onClick={() => toggleWidget('sales-tax')}
              >
                Sales Tax
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AppShortcuts;