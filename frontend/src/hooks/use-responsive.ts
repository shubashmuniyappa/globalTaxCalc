import { useEffect, useState } from 'react';

interface BreakpointValues {
  sm: boolean;
  md: boolean;
  lg: boolean;
  xl: boolean;
  '2xl': boolean;
}

interface ScreenSize {
  width: number;
  height: number;
}

// Tailwind CSS breakpoints
const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export function useBreakpoints(): BreakpointValues {
  const [breakpointValues, setBreakpointValues] = useState<BreakpointValues>({
    sm: false,
    md: false,
    lg: false,
    xl: false,
    '2xl': false,
  });

  useEffect(() => {
    const updateBreakpoints = () => {
      if (typeof window === 'undefined') return;

      const width = window.innerWidth;
      setBreakpointValues({
        sm: width >= breakpoints.sm,
        md: width >= breakpoints.md,
        lg: width >= breakpoints.lg,
        xl: width >= breakpoints.xl,
        '2xl': width >= breakpoints['2xl'],
      });
    };

    // Initial check
    updateBreakpoints();

    // Add event listener
    window.addEventListener('resize', updateBreakpoints);

    // Cleanup
    return () => window.removeEventListener('resize', updateBreakpoints);
  }, []);

  return breakpointValues;
}

export function useScreenSize(): ScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const updateSize = () => {
      if (typeof window === 'undefined') return;

      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Initial check
    updateSize();

    // Add event listener
    window.addEventListener('resize', updateSize);

    // Cleanup
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return screenSize;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

export function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const updateOrientation = () => {
      if (typeof window === 'undefined') return;

      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    // Initial check
    updateOrientation();

    // Add event listener
    window.addEventListener('resize', updateOrientation);

    // Cleanup
    return () => window.removeEventListener('resize', updateOrientation);
  }, []);

  return orientation;
}

export function useMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

export function useTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

export function useDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

// Check if device supports hover (not touch-only)
export function useHover(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)');
}

// Check if device supports touch
export function useTouch(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

// Check if user prefers reduced motion
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// Check if user prefers high contrast
export function useHighContrast(): boolean {
  return useMediaQuery('(prefers-contrast: high)');
}

// Check if user prefers dark color scheme
export function useSystemDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

// Responsive grid columns helper
export function useResponsiveColumns(
  defaultColumns: number = 1,
  breakpoints: Partial<Record<keyof BreakpointValues, number>> = {}
): number {
  const bp = useBreakpoints();

  // Check from largest to smallest breakpoint
  if (bp['2xl'] && breakpoints['2xl']) return breakpoints['2xl'];
  if (bp.xl && breakpoints.xl) return breakpoints.xl;
  if (bp.lg && breakpoints.lg) return breakpoints.lg;
  if (bp.md && breakpoints.md) return breakpoints.md;
  if (bp.sm && breakpoints.sm) return breakpoints.sm;

  return defaultColumns;
}

// Container max-width helper based on screen size
export function useContainerMaxWidth(): string {
  const { width } = useScreenSize();

  if (width >= breakpoints['2xl']) return 'max-w-7xl';
  if (width >= breakpoints.xl) return 'max-w-6xl';
  if (width >= breakpoints.lg) return 'max-w-5xl';
  if (width >= breakpoints.md) return 'max-w-4xl';
  if (width >= breakpoints.sm) return 'max-w-2xl';

  return 'max-w-full';
}

// Safe area insets for mobile devices (iOS notch, etc.)
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      setInsets({
        top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
        right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0', 10),
        bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
        left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
      });
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);
    return () => window.removeEventListener('resize', updateInsets);
  }, []);

  return insets;
}

// Viewport height that accounts for mobile browser UI
export function useViewportHeight(): number {
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateHeight = () => {
      // Use visualViewport if available (better for mobile)
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    updateHeight();

    // Listen to both resize and visual viewport changes
    window.addEventListener('resize', updateHeight);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateHeight);
    }

    return () => {
      window.removeEventListener('resize', updateHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateHeight);
      }
    };
  }, []);

  return viewportHeight;
}