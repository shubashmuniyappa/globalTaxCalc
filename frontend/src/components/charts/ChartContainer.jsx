import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Tooltip } from 'react-tooltip';
import './ChartContainer.css';

/**
 * Universal Chart Container Component
 * Provides responsive layout, loading states, error handling, and accessibility
 */
const ChartContainer = ({
  children,
  title,
  subtitle,
  className = '',
  loading = false,
  error = null,
  data = null,
  exportable = true,
  resizable = true,
  minHeight = 300,
  maxHeight = 600,
  aspectRatio,
  fullscreen = false,
  onExport,
  onFullscreen,
  tools = [],
  accessibility = {}
}) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(fullscreen);
  const [showTooltip, setShowTooltip] = useState(false);

  const { ref: inViewRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  });

  // Responsive dimensions
  useEffect(() => {
    if (!resizable || !containerRef.current) return;

    const updateDimensions = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      let height = rect.height;

      // Calculate height based on aspect ratio or constraints
      if (aspectRatio) {
        height = rect.width / aspectRatio;
      } else {
        height = Math.max(minHeight, Math.min(maxHeight, height || minHeight));
      }

      setDimensions({
        width: rect.width,
        height: isFullscreen ? window.innerHeight - 100 : height
      });
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    updateDimensions();

    return () => {
      resizeObserver.disconnect();
    };
  }, [resizable, aspectRatio, minHeight, maxHeight, isFullscreen]);

  // Handle export functionality
  const handleExport = async (format = 'png') => {
    if (!exportable || !containerRef.current) return;

    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const { saveAs } = await import('file-saver');

      const chartElement = containerRef.current.querySelector('.chart-content');
      if (!chartElement) return;

      switch (format) {
        case 'png':
        case 'jpg': {
          const canvas = await html2canvas(chartElement, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true
          });

          canvas.toBlob((blob) => {
            saveAs(blob, `chart-${Date.now()}.${format}`);
          }, `image/${format}`);
          break;
        }

        case 'pdf': {
          const canvas = await html2canvas(chartElement, {
            backgroundColor: '#ffffff',
            scale: 2
          });

          const pdf = new jsPDF('landscape');
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 280;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
          pdf.save(`chart-${Date.now()}.pdf`);
          break;
        }

        case 'svg': {
          const svgElement = chartElement.querySelector('svg');
          if (svgElement) {
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            saveAs(blob, `chart-${Date.now()}.svg`);
          }
          break;
        }

        case 'json': {
          if (data) {
            const jsonData = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            saveAs(blob, `chart-data-${Date.now()}.json`);
          }
          break;
        }
      }

      if (onExport) {
        onExport(format);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Handle fullscreen toggle
  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (onFullscreen) {
      onFullscreen(!isFullscreen);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!containerRef.current || !containerRef.current.contains(event.target)) return;

      switch (event.key) {
        case 'f':
        case 'F':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleFullscreen();
          }
          break;
        case 'e':
        case 'E':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleExport('png');
          }
          break;
        case 'Escape':
          if (isFullscreen) {
            handleFullscreen();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Loading component
  const LoadingSpinner = () => (
    <div className="chart-loading">
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring delay-1"></div>
        <div className="spinner-ring delay-2"></div>
      </div>
      <p className="loading-text">Loading chart data...</p>
    </div>
  );

  // Error component
  const ErrorDisplay = ({ error }) => (
    <div className="chart-error">
      <div className="error-icon">⚠️</div>
      <h3>Chart Error</h3>
      <p>{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="retry-button"
      >
        Retry
      </button>
    </div>
  );

  // No data component
  const NoDataDisplay = () => (
    <div className="chart-no-data">
      <div className="no-data-icon">📊</div>
      <h3>No Data Available</h3>
      <p>There's no data to display in this chart.</p>
    </div>
  );

  return (
    <motion.div
      ref={(node) => {
        containerRef.current = node;
        inViewRef(node);
      }}
      className={`chart-container ${className} ${isFullscreen ? 'fullscreen' : ''}`}
      style={{
        height: dimensions.height || minHeight,
        minHeight,
        maxHeight: isFullscreen ? '100vh' : maxHeight
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      role="img"
      aria-label={accessibility.ariaLabel || title}
      aria-describedby={accessibility.ariaDescribedby}
      tabIndex={0}
    >
      {/* Header */}
      <div className="chart-header">
        <div className="chart-title-section">
          {title && (
            <h3 className="chart-title" id={`chart-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="chart-subtitle">{subtitle}</p>
          )}
        </div>

        <div className="chart-controls">
          {/* Custom tools */}
          {tools.map((tool, index) => (
            <button
              key={index}
              onClick={tool.onClick}
              className={`chart-tool ${tool.className || ''}`}
              title={tool.tooltip}
              aria-label={tool.ariaLabel}
            >
              {tool.icon}
            </button>
          ))}

          {/* Export dropdown */}
          {exportable && (
            <div className="export-dropdown">
              <button
                className="chart-tool export-trigger"
                title="Export chart"
                aria-label="Export chart options"
                onClick={() => setShowTooltip(!showTooltip)}
              >
                📥
              </button>

              <AnimatePresence>
                {showTooltip && (
                  <motion.div
                    className="export-menu"
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button onClick={() => handleExport('png')}>PNG Image</button>
                    <button onClick={() => handleExport('jpg')}>JPG Image</button>
                    <button onClick={() => handleExport('svg')}>SVG Vector</button>
                    <button onClick={() => handleExport('pdf')}>PDF Document</button>
                    <button onClick={() => handleExport('json')}>JSON Data</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={handleFullscreen}
            className="chart-tool fullscreen-toggle"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
          >
            {isFullscreen ? '🗗' : '🗖'}
          </button>
        </div>
      </div>

      {/* Chart Content */}
      <div
        className="chart-content"
        style={{
          width: dimensions.width,
          height: dimensions.height - 60 // Account for header
        }}
      >
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <LoadingSpinner />
            </motion.div>
          )}

          {error && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ErrorDisplay error={error} />
            </motion.div>
          )}

          {!data && !loading && !error && (
            <motion.div
              key="no-data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <NoDataDisplay />
            </motion.div>
          )}

          {data && !loading && !error && (
            <motion.div
              key="chart"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="chart-wrapper"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Accessibility table (hidden but screen reader accessible) */}
      {data && accessibility.includeTable && (
        <div className="sr-only">
          <table
            role="table"
            aria-label={`Data table for ${title}`}
            className="chart-data-table"
          >
            <caption>{title} - Data representation</caption>
            <thead>
              <tr>
                {accessibility.tableHeaders?.map((header, index) => (
                  <th key={index} scope="col">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accessibility.tableData?.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Keyboard shortcuts help */}
      <div className="sr-only">
        <p>
          Keyboard shortcuts: Ctrl+F for fullscreen, Ctrl+E to export, Escape to exit fullscreen
        </p>
      </div>

      {/* Tooltips */}
      <Tooltip id="chart-tooltip" />
    </motion.div>
  );
};

export default ChartContainer;