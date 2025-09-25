import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// Screen Reader Announcements
export const ScreenReaderAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);

  const announce = (message, priority = 'polite') => {
    const id = Date.now();
    const announcement = { id, message, priority };

    setAnnouncements(prev => [...prev, announcement]);

    // Remove announcement after it's been read
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, 1000);
  };

  // Make announce function globally available
  useEffect(() => {
    window.announceToScreenReader = announce;
    return () => {
      delete window.announceToScreenReader;
    };
  }, []);

  return (
    <div className="screen-reader-announcements">
      {announcements.map(announcement => (
        <div
          key={announcement.id}
          className="sr-only"
          aria-live={announcement.priority}
          aria-atomic="true"
        >
          {announcement.message}
        </div>
      ))}
    </div>
  );
};

// Keyboard Navigation Handler
export const useKeyboardNavigation = (elements, options = {}) => {
  const {
    wrap = true,
    orientation = 'vertical', // 'vertical', 'horizontal', 'both'
    onActivate = null,
    onEscape = null
  } = options;

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const elementsRef = useRef([]);

  const focusElement = (index) => {
    if (index >= 0 && index < elementsRef.current.length) {
      const element = elementsRef.current[index];
      if (element) {
        element.focus();
        setFocusedIndex(index);
      }
    }
  };

  const handleKeyDown = (event) => {
    const { key } = event;
    const currentIndex = focusedIndex;

    let nextIndex = currentIndex;

    switch (key) {
      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault();
          nextIndex = currentIndex + 1;
          if (nextIndex >= elementsRef.current.length) {
            nextIndex = wrap ? 0 : elementsRef.current.length - 1;
          }
          focusElement(nextIndex);
        }
        break;

      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault();
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) {
            nextIndex = wrap ? elementsRef.current.length - 1 : 0;
          }
          focusElement(nextIndex);
        }
        break;

      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault();
          nextIndex = currentIndex + 1;
          if (nextIndex >= elementsRef.current.length) {
            nextIndex = wrap ? 0 : elementsRef.current.length - 1;
          }
          focusElement(nextIndex);
        }
        break;

      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault();
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) {
            nextIndex = wrap ? elementsRef.current.length - 1 : 0;
          }
          focusElement(nextIndex);
        }
        break;

      case 'Home':
        event.preventDefault();
        focusElement(0);
        break;

      case 'End':
        event.preventDefault();
        focusElement(elementsRef.current.length - 1);
        break;

      case 'Enter':
      case ' ':
        if (onActivate && currentIndex >= 0) {
          event.preventDefault();
          onActivate(currentIndex, elementsRef.current[currentIndex]);
        }
        break;

      case 'Escape':
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        break;
    }
  };

  const registerElement = (element, index) => {
    if (element) {
      elementsRef.current[index] = element;
      element.addEventListener('keydown', handleKeyDown);
      element.addEventListener('focus', () => setFocusedIndex(index));

      return () => {
        element.removeEventListener('keydown', handleKeyDown);
        element.removeEventListener('focus', () => setFocusedIndex(index));
      };
    }
  };

  return { registerElement, focusedIndex, focusElement };
};

// Focus Management
export const FocusManager = ({ children, restoreFocus = true, trapFocus = false }) => {
  const containerRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (restoreFocus) {
      previousActiveElement.current = document.activeElement;
    }

    return () => {
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [restoreFocus]);

  const handleKeyDown = (event) => {
    if (trapFocus && event.key === 'Tab') {
      const focusableElements = containerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }
  };

  return (
    <div ref={containerRef} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
};

// Skip Links
export const SkipLinks = ({ links = [] }) => {
  const defaultLinks = [
    { href: '#main-content', label: 'Skip to main content' },
    { href: '#navigation', label: 'Skip to navigation' },
    { href: '#footer', label: 'Skip to footer' }
  ];

  const allLinks = links.length > 0 ? links : defaultLinks;

  return (
    <nav className="skip-links" aria-label="Skip links">
      {allLinks.map((link, index) => (
        <a
          key={index}
          href={link.href}
          className="skip-link"
          onClick={(e) => {
            e.preventDefault();
            const target = document.querySelector(link.href);
            if (target) {
              target.focus();
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
};

// High Contrast Mode Detection
export const useHighContrastMode = () => {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (e) => setIsHighContrast(e.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isHighContrast;
};

// Reduced Motion Detection
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

// Color Blindness Support
export const ColorBlindnessFilter = ({ type = 'none', children }) => {
  const filters = {
    none: '',
    protanopia: 'url(#protanopia)',
    deuteranopia: 'url(#deuteranopia)',
    tritanopia: 'url(#tritanopia)',
    protanomaly: 'url(#protanomaly)',
    deuteranomaly: 'url(#deuteranomaly)',
    tritanomaly: 'url(#tritanomaly)',
    achromatopsia: 'url(#achromatopsia)',
    achromatomaly: 'url(#achromatomaly)'
  };

  return (
    <>
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          {/* Protanopia (Red-blind) */}
          <filter id="protanopia">
            <feColorMatrix values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0" />
          </filter>

          {/* Deuteranopia (Green-blind) */}
          <filter id="deuteranopia">
            <feColorMatrix values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0" />
          </filter>

          {/* Tritanopia (Blue-blind) */}
          <filter id="tritanopia">
            <feColorMatrix values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0" />
          </filter>

          {/* Protanomaly (Red-weak) */}
          <filter id="protanomaly">
            <feColorMatrix values="0.817,0.183,0,0,0 0.333,0.667,0,0,0 0,0.125,0.875,0,0 0,0,0,1,0" />
          </filter>

          {/* Deuteranomaly (Green-weak) */}
          <filter id="deuteranomaly">
            <feColorMatrix values="0.8,0.2,0,0,0 0.258,0.742,0,0,0 0,0.142,0.858,0,0 0,0,0,1,0" />
          </filter>

          {/* Tritanomaly (Blue-weak) */}
          <filter id="tritanomaly">
            <feColorMatrix values="0.967,0.033,0,0,0 0,0.733,0.267,0,0 0,0.183,0.817,0,0 0,0,0,1,0" />
          </filter>

          {/* Achromatopsia (Total color blindness) */}
          <filter id="achromatopsia">
            <feColorMatrix values="0.299,0.587,0.114,0,0 0.299,0.587,0.114,0,0 0.299,0.587,0.114,0,0 0,0,0,1,0" />
          </filter>

          {/* Achromatomaly (Blue cone monochromacy) */}
          <filter id="achromatomaly">
            <feColorMatrix values="0.618,0.320,0.062,0,0 0.163,0.775,0.062,0,0 0.163,0.320,0.516,0,0 0,0,0,1,0" />
          </filter>
        </defs>
      </svg>

      <div style={{ filter: filters[type] }}>
        {children}
      </div>
    </>
  );
};

// Accessibility Toolbar
export const AccessibilityToolbar = ({ onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    colorBlindFilter: 'none',
    screenReader: false
  });

  const toggleSetting = (key, value = null) => {
    const newValue = value !== null ? value : !settings[key];
    const newSettings = { ...settings, [key]: newValue };
    setSettings(newSettings);

    // Apply settings to document
    document.documentElement.classList.toggle('high-contrast', newSettings.highContrast);
    document.documentElement.classList.toggle('large-text', newSettings.largeText);
    document.documentElement.classList.toggle('reduced-motion', newSettings.reducedMotion);
    document.documentElement.setAttribute('data-color-blind-filter', newSettings.colorBlindFilter);

    if (onToggle) {
      onToggle(key, newValue, newSettings);
    }

    // Announce changes to screen readers
    if (window.announceToScreenReader) {
      const settingName = key.replace(/([A-Z])/g, ' $1').toLowerCase();
      window.announceToScreenReader(
        `${settingName} ${newValue ? 'enabled' : 'disabled'}`,
        'assertive'
      );
    }
  };

  const colorBlindFilters = [
    { value: 'none', label: 'None' },
    { value: 'protanopia', label: 'Red-blind (Protanopia)' },
    { value: 'deuteranopia', label: 'Green-blind (Deuteranopia)' },
    { value: 'tritanopia', label: 'Blue-blind (Tritanopia)' },
    { value: 'protanomaly', label: 'Red-weak (Protanomaly)' },
    { value: 'deuteranomaly', label: 'Green-weak (Deuteranomaly)' },
    { value: 'tritanomaly', label: 'Blue-weak (Tritanomaly)' },
    { value: 'achromatopsia', label: 'Total color blindness' },
    { value: 'achromatomaly', label: 'Blue cone monochromacy' }
  ];

  return (
    <>
      <button
        className={`accessibility-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Accessibility options"
        aria-expanded={isOpen}
        aria-controls="accessibility-toolbar"
        title="Accessibility Options"
      >
        <span className="accessibility-icon">♿</span>
      </button>

      {isOpen && (
        <motion.div
          id="accessibility-toolbar"
          className="accessibility-toolbar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-label="Accessibility Settings"
        >
          <div className="toolbar-header">
            <h3>Accessibility Settings</h3>
            <button
              className="close-toolbar"
              onClick={() => setIsOpen(false)}
              aria-label="Close accessibility settings"
            >
              ×
            </button>
          </div>

          <div className="toolbar-content">
            <div className="setting-group">
              <h4>Visual Settings</h4>

              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.highContrast}
                  onChange={() => toggleSetting('highContrast')}
                />
                <span className="setting-label">High Contrast Mode</span>
                <span className="setting-description">
                  Increases contrast for better visibility
                </span>
              </label>

              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.largeText}
                  onChange={() => toggleSetting('largeText')}
                />
                <span className="setting-label">Large Text</span>
                <span className="setting-description">
                  Increases font size for better readability
                </span>
              </label>

              <div className="setting-item">
                <label htmlFor="color-blind-filter" className="setting-label">
                  Color Blind Filter
                </label>
                <select
                  id="color-blind-filter"
                  value={settings.colorBlindFilter}
                  onChange={(e) => toggleSetting('colorBlindFilter', e.target.value)}
                  className="setting-select"
                >
                  {colorBlindFilters.map(filter => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="setting-group">
              <h4>Motion Settings</h4>

              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={() => toggleSetting('reducedMotion')}
                />
                <span className="setting-label">Reduced Motion</span>
                <span className="setting-description">
                  Minimizes animations and transitions
                </span>
              </label>
            </div>

            <div className="setting-group">
              <h4>Screen Reader</h4>

              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.screenReader}
                  onChange={() => toggleSetting('screenReader')}
                />
                <span className="setting-label">Screen Reader Mode</span>
                <span className="setting-description">
                  Optimizes interface for screen readers
                </span>
              </label>
            </div>

            <div className="toolbar-actions">
              <button
                className="reset-settings"
                onClick={() => {
                  const defaultSettings = {
                    highContrast: false,
                    largeText: false,
                    reducedMotion: false,
                    colorBlindFilter: 'none',
                    screenReader: false
                  };
                  setSettings(defaultSettings);

                  // Reset document classes
                  document.documentElement.className = '';
                  document.documentElement.removeAttribute('data-color-blind-filter');

                  if (window.announceToScreenReader) {
                    window.announceToScreenReader('Accessibility settings reset to defaults', 'assertive');
                  }
                }}
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Color blind filter overlay */}
      <ColorBlindnessFilter type={settings.colorBlindFilter}>
        <div style={{ display: 'none' }}>Filter applied</div>
      </ColorBlindnessFilter>
    </>
  );
};

// Live Region for Dynamic Content Updates
export const LiveRegion = ({ message, priority = 'polite', children }) => {
  return (
    <div
      className="live-region"
      aria-live={priority}
      aria-atomic="true"
      aria-relevant="additions text"
    >
      {message && <span className="sr-only">{message}</span>}
      {children}
    </div>
  );
};

// Chart Accessibility Wrapper
export const ChartAccessibilityWrapper = ({
  children,
  title,
  description,
  data = [],
  dataTable = null,
  keyboardInstructions = null
}) => {
  const chartRef = useRef(null);
  const [showTable, setShowTable] = useState(false);

  const defaultInstructions = [
    'Use Tab to navigate between chart elements',
    'Use Arrow keys to navigate within chart data',
    'Press Enter or Space to interact with chart elements',
    'Press Escape to exit chart interaction mode'
  ];

  const instructions = keyboardInstructions || defaultInstructions;

  return (
    <div className="chart-accessibility-wrapper">
      {/* Chart title and description */}
      <div className="chart-header" id={`chart-${title?.replace(/\s+/g, '-').toLowerCase()}`}>
        {title && <h3 className="chart-title">{title}</h3>}
        {description && <p className="chart-description">{description}</p>}
      </div>

      {/* Keyboard instructions */}
      <details className="keyboard-instructions">
        <summary>Keyboard Navigation Instructions</summary>
        <ul>
          {instructions.map((instruction, index) => (
            <li key={index}>{instruction}</li>
          ))}
        </ul>
      </details>

      {/* Chart content */}
      <div
        ref={chartRef}
        className="chart-content"
        role="img"
        aria-labelledby={title ? `chart-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined}
        aria-describedby={description ? 'chart-description' : undefined}
        tabIndex={0}
      >
        {children}
      </div>

      {/* Data table toggle */}
      {dataTable && (
        <>
          <button
            className="toggle-data-table"
            onClick={() => setShowTable(!showTable)}
            aria-expanded={showTable}
            aria-controls="chart-data-table"
          >
            {showTable ? 'Hide' : 'Show'} Data Table
          </button>

          {showTable && (
            <div id="chart-data-table" className="chart-data-table-container">
              <h4 className="sr-only">Chart Data Table</h4>
              {dataTable}
            </div>
          )}
        </>
      )}

      {/* Live region for chart updates */}
      <LiveRegion priority="polite" />
    </div>
  );
};

export default {
  ScreenReaderAnnouncements,
  useKeyboardNavigation,
  FocusManager,
  SkipLinks,
  useHighContrastMode,
  useReducedMotion,
  ColorBlindnessFilter,
  AccessibilityToolbar,
  LiveRegion,
  ChartAccessibilityWrapper
};