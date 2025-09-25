/**
 * Language Selector Component
 * Provides UI for switching between supported languages with cultural context
 */

import React, { useState, useRef, useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { ChevronDownIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../../lib/i18n/IntlProvider';
import { LOCALES } from '../../lib/i18n/config';

const LanguageSelector = ({
  variant = 'dropdown', // 'dropdown', 'modal', 'inline'
  size = 'medium', // 'small', 'medium', 'large'
  showFlag = true,
  showNativeName = true,
  showEnglishName = false,
  className = '',
  position = 'bottom-left' // 'bottom-left', 'bottom-right', 'top-left', 'top-right'
}) => {
  const { locale, setLocale, localeConfig, isLoading } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, []);

  // Filter locales based on search term
  const filteredLocales = Object.entries(LOCALES).filter(([code, config]) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      config.name.toLowerCase().includes(searchLower) ||
      config.nativeName.toLowerCase().includes(searchLower) ||
      code.toLowerCase().includes(searchLower) ||
      config.country.toLowerCase().includes(searchLower)
    );
  });

  // Handle locale change
  const handleLocaleChange = async (newLocale) => {
    setIsOpen(false);
    setSearchTerm('');

    if (newLocale !== locale) {
      await setLocale(newLocale);
    }
  };

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return {
          button: 'px-2 py-1 text-xs',
          dropdown: 'min-w-48',
          item: 'px-3 py-2 text-xs'
        };
      case 'large':
        return {
          button: 'px-4 py-3 text-base',
          dropdown: 'min-w-64',
          item: 'px-4 py-3 text-base'
        };
      default:
        return {
          button: 'px-3 py-2 text-sm',
          dropdown: 'min-w-56',
          item: 'px-3 py-2 text-sm'
        };
    }
  };

  // Get position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-right':
        return 'right-0 top-full mt-1';
      case 'top-left':
        return 'left-0 bottom-full mb-1';
      case 'top-right':
        return 'right-0 bottom-full mb-1';
      default:
        return 'left-0 top-full mt-1';
    }
  };

  const sizeClasses = getSizeClasses();
  const positionClasses = getPositionClasses();

  // Render dropdown variant
  if (variant === 'dropdown') {
    return (
      <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
        {/* Trigger Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className={`
            ${sizeClasses.button}
            inline-flex items-center justify-center
            bg-white border border-gray-300 rounded-md shadow-sm
            hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            transition-colors duration-200
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={`Current language: ${localeConfig.nativeName}. Click to change language.`}
        >
          {/* Current Language Display */}
          <div className="flex items-center space-x-2">
            {showFlag && (
              <span className="text-lg" role="img" aria-label={`${localeConfig.country} flag`}>
                {localeConfig.flag}
              </span>
            )}

            <div className="flex flex-col items-start">
              {showNativeName && (
                <span className="font-medium text-gray-900">
                  {localeConfig.nativeName}
                </span>
              )}
              {showEnglishName && showNativeName && (
                <span className="text-xs text-gray-500">
                  {localeConfig.name}
                </span>
              )}
              {showEnglishName && !showNativeName && (
                <span className="font-medium text-gray-900">
                  {localeConfig.name}
                </span>
              )}
            </div>
          </div>

          <ChevronDownIcon
            className={`ml-2 h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className={`
              absolute ${positionClasses} ${sizeClasses.dropdown} z-50
              bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5
              focus:outline-none
            `}
            role="listbox"
            aria-labelledby="language-selector"
          >
            {/* Search Input */}
            {filteredLocales.length > 8 && (
              <div className="p-2 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Search languages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            )}

            {/* Language List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredLocales.length > 0 ? (
                filteredLocales.map(([code, config]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleLocaleChange(code)}
                    className={`
                      ${sizeClasses.item}
                      w-full text-left flex items-center space-x-3
                      hover:bg-gray-50 focus:bg-gray-50 focus:outline-none
                      transition-colors duration-150
                      ${code === locale ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}
                    `}
                    role="option"
                    aria-selected={code === locale}
                  >
                    {/* Flag */}
                    {showFlag && (
                      <span className="text-lg flex-shrink-0" role="img" aria-label={`${config.country} flag`}>
                        {config.flag}
                      </span>
                    )}

                    {/* Language Names */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {config.nativeName}
                      </div>
                      {showEnglishName && config.name !== config.nativeName && (
                        <div className="text-xs text-gray-500 truncate">
                          {config.name}
                        </div>
                      )}
                    </div>

                    {/* Current Indicator */}
                    {code === locale && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                  <FormattedMessage
                    id="languageSelector.noResults"
                    defaultMessage="No languages found"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center justify-center text-xs text-gray-500">
                <GlobeAltIcon className="w-3 h-3 mr-1" />
                <FormattedMessage
                  id="languageSelector.footer"
                  defaultMessage="{count} languages available"
                  values={{ count: Object.keys(LOCALES).length }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render inline variant
  if (variant === 'inline') {
    return (
      <div className={`inline-flex flex-wrap gap-2 ${className}`}>
        {Object.entries(LOCALES).map(([code, config]) => (
          <button
            key={code}
            type="button"
            onClick={() => handleLocaleChange(code)}
            disabled={isLoading}
            className={`
              ${sizeClasses.button}
              inline-flex items-center space-x-1
              border rounded transition-colors duration-200
              ${code === locale
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            aria-pressed={code === locale}
            aria-label={`Switch to ${config.nativeName}`}
          >
            {showFlag && (
              <span className="text-base" role="img" aria-label={`${config.country} flag`}>
                {config.flag}
              </span>
            )}
            <span className="font-medium">
              {showNativeName ? config.nativeName : config.name}
            </span>
          </button>
        ))}
      </div>
    );
  }

  // Render modal variant (simplified for this example)
  if (variant === 'modal') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={isLoading}
          className={`
            ${sizeClasses.button}
            inline-flex items-center space-x-2
            bg-white border border-gray-300 rounded-md shadow-sm
            hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            transition-colors duration-200
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <GlobeAltIcon className="w-4 h-4" />
          <span>{localeConfig.nativeName}</span>
        </button>

        {/* Modal overlay and content would go here */}
        {isOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Overlay */}
              <div
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                onClick={() => setIsOpen(false)}
              ></div>

              {/* Modal content */}
              <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  <FormattedMessage
                    id="languageSelector.title"
                    defaultMessage="Select Language"
                  />
                </h3>

                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {Object.entries(LOCALES).map(([code, config]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleLocaleChange(code)}
                      className={`
                        p-3 text-left border rounded-lg transition-colors duration-200
                        hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
                        ${code === locale ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}
                      `}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{config.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {config.nativeName}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {config.name}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <FormattedMessage
                      id="common.close"
                      defaultMessage="Close"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default LanguageSelector;