/**
 * Offline Page for GlobalTaxCalc PWA
 *
 * Provides offline functionality with cached calculators
 * and local data storage capabilities.
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Calculator, Wifi, WifiOff, RefreshCw, Download, Smartphone } from 'lucide-react';

const OfflinePage = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [cachedCalculators, setCachedCalculators] = useState([]);
  const [offlineData, setOfflineData] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load cached calculators
    loadCachedCalculators();

    // Load offline data
    loadOfflineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadCachedCalculators = async () => {
    try {
      // Check what calculators are available offline
      const calculators = [
        {
          id: 'income-tax',
          name: 'Income Tax Calculator',
          description: 'Calculate federal and state income tax',
          icon: '💰',
          available: await isCalculatorCached('income-tax'),
          url: '/calculators/income-tax'
        },
        {
          id: 'paycheck',
          name: 'Paycheck Calculator',
          description: 'Calculate take-home pay and deductions',
          icon: '💵',
          available: await isCalculatorCached('paycheck'),
          url: '/calculators/paycheck'
        },
        {
          id: 'tax-refund',
          name: 'Tax Refund Calculator',
          description: 'Estimate your tax refund',
          icon: '💸',
          available: await isCalculatorCached('tax-refund'),
          url: '/calculators/tax-refund'
        },
        {
          id: 'self-employment',
          name: 'Self-Employment Tax',
          description: 'Calculate self-employment taxes',
          icon: '🏢',
          available: await isCalculatorCached('self-employment'),
          url: '/calculators/self-employment'
        }
      ];

      setCachedCalculators(calculators);
    } catch (error) {
      console.error('Failed to load cached calculators:', error);
    }
  };

  const loadOfflineData = async () => {
    try {
      // Load offline app data
      const data = {
        taxRatesLastUpdated: localStorage.getItem('taxRatesLastUpdated'),
        calculationsCount: localStorage.getItem('offlineCalculationsCount') || '0',
        lastSync: localStorage.getItem('lastSyncTime')
      };

      setOfflineData(data);
      setLastSync(data.lastSync ? new Date(data.lastSync) : null);
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  };

  const isCalculatorCached = async (calculatorId) => {
    try {
      // Check if calculator page is cached
      const cache = await caches.open('globaltaxcalc-static-2024.1.0');
      const response = await cache.match(`/calculators/${calculatorId}`);
      return !!response;
    } catch (error) {
      return false;
    }
  };

  const handleRetryConnection = () => {
    if (navigator.onLine) {
      // Attempt to reload
      window.location.reload();
    } else {
      // Show retry message
      alert('Still offline. Please check your internet connection.');
    }
  };

  const handleSyncData = async () => {
    if (!navigator.onLine) {
      alert('Cannot sync while offline. Please connect to the internet.');
      return;
    }

    try {
      // Trigger background sync
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('user-data-sync');
        alert('Data sync initiated. Your offline data will be synchronized.');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please try again later.');
    }
  };

  const downloadForOffline = async () => {
    try {
      // Cache additional resources for offline use
      const resourcesToCache = [
        '/api/tax-rates',
        '/api/tax-brackets',
        '/api/deductions',
        '/calculators/income-tax',
        '/calculators/paycheck',
        '/calculators/tax-refund',
        '/calculators/self-employment'
      ];

      const cache = await caches.open('globaltaxcalc-static-2024.1.0');

      for (const resource of resourcesToCache) {
        try {
          await cache.add(resource);
        } catch (error) {
          console.warn(`Failed to cache ${resource}:`, error);
        }
      }

      // Update cached calculators
      await loadCachedCalculators();

      alert('Additional content downloaded for offline use!');
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again later.');
    }
  };

  return (
    <>
      <Head>
        <title>Offline - GlobalTaxCalc</title>
        <meta name="description" content="Use GlobalTaxCalc offline with cached calculators and data" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                <Calculator className="h-8 w-8 text-indigo-600" />
                <h1 className="text-2xl font-bold text-gray-900">GlobalTaxCalc</h1>
              </div>

              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isOnline ? (
                  <>
                    <Wifi className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-green-600 font-medium">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-5 w-5 text-red-500" />
                    <span className="text-sm text-red-600 font-medium">Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Offline Status Message */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-100 mb-4">
                <Smartphone className="h-8 w-8 text-indigo-600" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isOnline ? 'You\'re Back Online!' : 'You\'re Offline'}
              </h2>

              <p className="text-gray-600 mb-6">
                {isOnline
                  ? 'Your internet connection has been restored. You can now access all features.'
                  : 'No internet connection detected, but you can still use cached calculators and view your saved data.'
                }
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleRetryConnection}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isOnline ? 'Reload App' : 'Retry Connection'}
                </button>

                {!isOnline && (
                  <button
                    onClick={downloadForOffline}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download for Offline
                  </button>
                )}

                {isOnline && (
                  <button
                    onClick={handleSyncData}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Data
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Available Calculators */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Available Calculators</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cachedCalculators.map((calculator) => (
                <div
                  key={calculator.id}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    calculator.available
                      ? 'border-green-200 bg-green-50 hover:border-green-300'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">{calculator.icon}</div>

                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {calculator.name}
                      </h4>
                      <p className="text-sm text-gray-600 mb-3">
                        {calculator.description}
                      </p>

                      {calculator.available ? (
                        <a
                          href={calculator.url}
                          className="inline-flex items-center text-sm font-medium text-green-600 hover:text-green-700"
                        >
                          Use Calculator →
                        </a>
                      ) : (
                        <span className="inline-flex items-center text-sm text-gray-500">
                          Not available offline
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      calculator.available
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {calculator.available ? 'Cached' : 'Online Only'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Offline Data Summary */}
          {offlineData && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Offline Data</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {offlineData.calculationsCount}
                  </div>
                  <div className="text-sm text-blue-800">Saved Calculations</div>
                </div>

                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {cachedCalculators.filter(c => c.available).length}
                  </div>
                  <div className="text-sm text-green-800">Cached Calculators</div>
                </div>

                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-lg font-bold text-purple-600">
                    {lastSync ? lastSync.toLocaleDateString() : 'Never'}
                  </div>
                  <div className="text-sm text-purple-800">Last Sync</div>
                </div>
              </div>

              {offlineData.taxRatesLastUpdated && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Tax rates last updated:</strong>{' '}
                    {new Date(offlineData.taxRatesLastUpdated).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Offline Tips */}
          <div className="mt-8 bg-indigo-50 border border-indigo-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-indigo-900 mb-3">Offline Usage Tips</h3>

            <ul className="space-y-2 text-sm text-indigo-800">
              <li className="flex items-start space-x-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Your calculations are automatically saved locally and will sync when you're back online.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Tax rates and formulas are cached for offline calculations.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Use "Download for Offline" to cache additional content when online.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-600 mt-1">•</span>
                <span>Your data will automatically sync when your connection is restored.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default OfflinePage;