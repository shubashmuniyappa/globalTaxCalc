import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import TaxBracketChart from './TaxBracketChart';
import IncomeBreakdownChart from './IncomeBreakdownChart';
import ComparisonChart from './ComparisonChart';
import './ResponsiveChartLayout.css';

const ResponsiveChartLayout = ({
  data = {},
  layout = 'grid', // 'grid', 'masonry', 'dashboard', 'mobile'
  charts = ['taxBracket', 'incomeBreakdown', 'comparison'],
  animated = true,
  lazyLoad = true,
  adaptiveHeight = true,
  customBreakpoints = null
}) => {
  const [activeLayout, setActiveLayout] = useState(layout);
  const [screenSize, setScreenSize] = useState('desktop');
  const [visibleCharts, setVisibleCharts] = useState(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedChart, setSelectedChart] = useState(null);

  const containerRef = useRef(null);
  const layoutRef = useRef(null);

  // Default breakpoints
  const breakpoints = customBreakpoints || {
    mobile: 480,
    tablet: 768,
    desktop: 1024,
    wide: 1440
  };

  // Responsive screen size detection
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;

      if (width <= breakpoints.mobile) {
        setScreenSize('mobile');
        setActiveLayout('mobile');
      } else if (width <= breakpoints.tablet) {
        setScreenSize('tablet');
        setActiveLayout(activeLayout === 'masonry' ? 'grid' : activeLayout);
      } else if (width <= breakpoints.desktop) {
        setScreenSize('desktop');
        setActiveLayout(layout);
      } else {
        setScreenSize('wide');
        setActiveLayout(layout);
      }
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, [layout, breakpoints]);

  // Chart configurations with responsive settings
  const chartConfigs = useMemo(() => ({
    taxBracket: {
      component: TaxBracketChart,
      title: 'Tax Bracket Analysis',
      gridArea: 'bracket',
      height: {
        mobile: 350,
        tablet: 400,
        desktop: 450,
        wide: 500
      },
      priority: 1,
      props: {
        income: data.income || 75000,
        filingStatus: data.filingStatus || 'single',
        animated,
        interactive: screenSize !== 'mobile'
      }
    },
    incomeBreakdown: {
      component: IncomeBreakdownChart,
      title: 'Income Breakdown',
      gridArea: 'breakdown',
      height: {
        mobile: 400,
        tablet: 450,
        desktop: 500,
        wide: 550
      },
      priority: 2,
      props: {
        grossIncome: data.grossIncome || 100000,
        federalTax: data.federalTax || 18000,
        stateTax: data.stateTax || 5000,
        socialSecurity: data.socialSecurity || 6200,
        medicare: data.medicare || 1450,
        animated,
        chartType: screenSize === 'mobile' ? 'pie' : 'doughnut'
      }
    },
    comparison: {
      component: ComparisonChart,
      title: 'Tax Comparison',
      gridArea: 'comparison',
      height: {
        mobile: 450,
        tablet: 500,
        desktop: 550,
        wide: 600
      },
      priority: 3,
      props: {
        comparisonType: data.comparisonType || 'states',
        userIncome: data.income || 75000,
        animated,
        showRankings: screenSize !== 'mobile'
      }
    }
  }), [data, animated, screenSize]);

  // Layout configurations
  const layoutConfigs = {
    grid: {
      className: 'chart-layout-grid',
      columns: {
        mobile: '1fr',
        tablet: 'repeat(auto-fit, minmax(350px, 1fr))',
        desktop: 'repeat(auto-fit, minmax(400px, 1fr))',
        wide: 'repeat(3, 1fr)'
      },
      gap: {
        mobile: '16px',
        tablet: '20px',
        desktop: '24px',
        wide: '32px'
      }
    },
    masonry: {
      className: 'chart-layout-masonry',
      columns: {
        mobile: 1,
        tablet: 2,
        desktop: 3,
        wide: 3
      },
      gap: {
        mobile: '16px',
        tablet: '20px',
        desktop: '24px',
        wide: '32px'
      }
    },
    dashboard: {
      className: 'chart-layout-dashboard',
      template: {
        mobile: `
          "bracket bracket"
          "breakdown breakdown"
          "comparison comparison"
        `,
        tablet: `
          "bracket breakdown"
          "comparison comparison"
        `,
        desktop: `
          "bracket breakdown"
          "comparison comparison"
        `,
        wide: `
          "bracket breakdown comparison"
        `
      },
      gap: {
        mobile: '16px',
        tablet: '20px',
        desktop: '24px',
        wide: '32px'
      }
    },
    mobile: {
      className: 'chart-layout-mobile',
      direction: 'column',
      gap: '16px'
    }
  };

  const currentLayout = layoutConfigs[activeLayout] || layoutConfigs.grid;

  // Intersection observer for lazy loading
  const ChartWrapper = ({ chartKey, config, index }) => {
    const { ref, inView } = useInView({
      threshold: 0.1,
      triggerOnce: lazyLoad,
      skip: !lazyLoad
    });

    useEffect(() => {
      if (inView || !lazyLoad) {
        setVisibleCharts(prev => new Set([...prev, chartKey]));
      }
    }, [inView, chartKey]);

    const shouldRender = !lazyLoad || visibleCharts.has(chartKey);
    const ChartComponent = config.component;
    const height = adaptiveHeight ? config.height[screenSize] : config.height.desktop;

    return (
      <motion.div
        ref={ref}
        className={`chart-wrapper chart-${chartKey}`}
        style={{
          gridArea: activeLayout === 'dashboard' ? config.gridArea : undefined,
          order: activeLayout === 'mobile' ? config.priority : undefined
        }}
        initial={{ opacity: 0, y: 40 }}
        animate={inView || !animated ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{
          duration: 0.6,
          delay: animated ? index * 0.2 : 0,
          ease: 'easeOut'
        }}
      >
        {shouldRender ? (
          <ChartComponent
            {...config.props}
            height={height}
            className={`responsive-chart ${screenSize}`}
            onFullscreen={(isFs) => {
              setIsFullscreen(isFs);
              setSelectedChart(isFs ? chartKey : null);
            }}
          />
        ) : (
          <div
            className="chart-placeholder"
            style={{ height: `${height}px` }}
          >
            <div className="placeholder-content">
              <div className="placeholder-spinner"></div>
              <p>Loading {config.title}...</p>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  // Layout switcher for desktop/tablet
  const LayoutSwitcher = () => {
    if (screenSize === 'mobile') return null;

    const layoutOptions = [
      { key: 'grid', icon: '⊞', label: 'Grid' },
      { key: 'masonry', icon: '⊡', label: 'Masonry', disabled: screenSize === 'tablet' },
      { key: 'dashboard', icon: '⊟', label: 'Dashboard' }
    ];

    return (
      <div className="layout-switcher">
        <div className="switcher-label">Layout:</div>
        {layoutOptions.map(option => (
          <button
            key={option.key}
            className={`layout-option ${activeLayout === option.key ? 'active' : ''}`}
            onClick={() => !option.disabled && setActiveLayout(option.key)}
            disabled={option.disabled}
            title={option.label}
          >
            <span className="layout-icon">{option.icon}</span>
            <span className="layout-text">{option.label}</span>
          </button>
        ))}
      </div>
    );
  };

  // Masonry layout implementation
  const MasonryLayout = () => {
    const [masonryItems, setMasonryItems] = useState([]);

    useEffect(() => {
      if (activeLayout !== 'masonry') return;

      const updateMasonryLayout = () => {
        const container = layoutRef.current;
        if (!container) return;

        const items = Array.from(container.children);
        const containerWidth = container.clientWidth;
        const columns = currentLayout.columns[screenSize];
        const gap = parseInt(currentLayout.gap[screenSize]);
        const columnWidth = (containerWidth - (gap * (columns - 1))) / columns;

        const columnHeights = Array(columns).fill(0);
        const positions = [];

        items.forEach((item, index) => {
          const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));
          const x = shortestColumn * (columnWidth + gap);
          const y = columnHeights[shortestColumn];

          positions.push({ x, y, width: columnWidth });

          // Update column height (assuming item height can be calculated)
          const itemHeight = item.offsetHeight || chartConfigs[charts[index]]?.height[screenSize] || 400;
          columnHeights[shortestColumn] += itemHeight + gap;
        });

        setMasonryItems(positions);
        container.style.height = `${Math.max(...columnHeights)}px`;
      };

      updateMasonryLayout();
      window.addEventListener('resize', updateMasonryLayout);
      return () => window.removeEventListener('resize', updateMasonryLayout);
    }, [activeLayout, screenSize, currentLayout]);

    return (
      <div
        ref={layoutRef}
        className={currentLayout.className}
        style={{ position: 'relative' }}
      >
        {charts.map((chartKey, index) => {
          const config = chartConfigs[chartKey];
          const position = masonryItems[index];

          return (
            <div
              key={chartKey}
              style={position ? {
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${position.width}px`,
                transition: 'all 0.3s ease'
              } : {}}
            >
              <ChartWrapper
                chartKey={chartKey}
                config={config}
                index={index}
              />
            </div>
          );
        })}
      </div>
    );
  };

  // Regular layout implementation
  const RegularLayout = () => {
    const layoutStyle = {
      gap: currentLayout.gap[screenSize]
    };

    if (activeLayout === 'grid') {
      layoutStyle.gridTemplateColumns = currentLayout.columns[screenSize];
    } else if (activeLayout === 'dashboard') {
      layoutStyle.gridTemplateAreas = currentLayout.template[screenSize];
      layoutStyle.gridTemplateColumns = screenSize === 'wide' ? 'repeat(3, 1fr)' :
                                      screenSize === 'tablet' ? 'repeat(2, 1fr)' : '1fr';
    } else if (activeLayout === 'mobile') {
      layoutStyle.flexDirection = currentLayout.direction;
    }

    return (
      <div
        ref={layoutRef}
        className={currentLayout.className}
        style={layoutStyle}
      >
        {charts.map((chartKey, index) => {
          const config = chartConfigs[chartKey];
          if (!config) return null;

          return (
            <ChartWrapper
              key={chartKey}
              chartKey={chartKey}
              config={config}
              index={index}
            />
          );
        })}
      </div>
    );
  };

  // Performance indicator
  const PerformanceIndicator = () => {
    const [performance, setPerformance] = useState({ fps: 0, loadTime: 0 });

    useEffect(() => {
      const startTime = performance.now();
      let frameCount = 0;
      let lastTime = startTime;

      const measureFPS = () => {
        frameCount++;
        const currentTime = performance.now();

        if (currentTime - lastTime >= 1000) {
          setPerformance(prev => ({
            ...prev,
            fps: Math.round(frameCount * 1000 / (currentTime - lastTime))
          }));
          frameCount = 0;
          lastTime = currentTime;
        }

        if (currentTime - startTime < 5000) { // Measure for 5 seconds
          requestAnimationFrame(measureFPS);
        }
      };

      const loadEndTime = performance.now();
      setPerformance(prev => ({
        ...prev,
        loadTime: Math.round(loadEndTime - startTime)
      }));

      requestAnimationFrame(measureFPS);
    }, [activeLayout]);

    if (process.env.NODE_ENV !== 'development') return null;

    return (
      <div className="performance-indicator">
        <div className="perf-metric">
          <span className="perf-label">FPS:</span>
          <span className={`perf-value ${performance.fps < 30 ? 'warning' : 'good'}`}>
            {performance.fps}
          </span>
        </div>
        <div className="perf-metric">
          <span className="perf-label">Load:</span>
          <span className={`perf-value ${performance.loadTime > 1000 ? 'warning' : 'good'}`}>
            {performance.loadTime}ms
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`responsive-chart-layout ${screenSize} ${isFullscreen ? 'fullscreen' : ''}`}
    >
      <div className="layout-header">
        <div className="layout-info">
          <h2>Tax Visualization Dashboard</h2>
          <div className="screen-info">
            <span className="screen-size">{screenSize}</span>
            <span className="layout-type">{activeLayout}</span>
          </div>
        </div>

        <LayoutSwitcher />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeLayout}-${screenSize}`}
          className="chart-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeLayout === 'masonry' && screenSize !== 'tablet' ?
            <MasonryLayout /> :
            <RegularLayout />
          }
        </motion.div>
      </AnimatePresence>

      <PerformanceIndicator />

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            className="fullscreen-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => {
              setIsFullscreen(false);
              setSelectedChart(null);
            }}
          >
            <div className="fullscreen-backdrop" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResponsiveChartLayout;