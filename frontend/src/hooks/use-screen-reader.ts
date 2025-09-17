import { useEffect, useState, useCallback } from 'react';

// Announce messages to screen readers
export function useScreenReaderAnnouncements() {
  const [announcements, setAnnouncements] = useState<string[]>([]);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Create a temporary element to announce the message
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.setAttribute('class', 'sr-only');
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove the announcement after a short delay
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);

    // Keep track of announcements for debugging
    setAnnouncements(prev => [...prev.slice(-9), message]);
  }, []);

  const announcePolite = useCallback((message: string) => {
    announce(message, 'polite');
  }, [announce]);

  const announceAssertive = useCallback((message: string) => {
    announce(message, 'assertive');
  }, [announce]);

  return {
    announce,
    announcePolite,
    announceAssertive,
    announcements,
  };
}

// Detect if user prefers reduced motion
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

// Detect high contrast mode
export function useHighContrast() {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isHighContrast;
}

// Generate unique IDs for accessibility
let idCounter = 0;
export function useId(prefix: string = 'id'): string {
  const [id] = useState(() => {
    idCounter += 1;
    return `${prefix}-${idCounter}`;
  });

  return id;
}

// Form field accessibility
export function useFieldAccessibility({
  label,
  error,
  description,
  required = false,
}: {
  label?: string;
  error?: string;
  description?: string;
  required?: boolean;
}) {
  const fieldId = useId('field');
  const errorId = useId('error');
  const descriptionId = useId('description');

  const fieldProps = {
    id: fieldId,
    'aria-required': required,
    'aria-invalid': !!error,
    'aria-describedby': [
      description && descriptionId,
      error && errorId,
    ].filter(Boolean).join(' ') || undefined,
  };

  const labelProps = {
    htmlFor: fieldId,
  };

  const errorProps = {
    id: errorId,
    role: 'alert',
    'aria-live': 'polite' as const,
  };

  const descriptionProps = {
    id: descriptionId,
  };

  return {
    fieldProps,
    labelProps,
    errorProps,
    descriptionProps,
  };
}

// Skip link functionality
export function useSkipLinks() {
  const [isVisible, setIsVisible] = useState(false);

  const showSkipLinks = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hideSkipLinks = useCallback(() => {
    setIsVisible(false);
  }, []);

  const skipToMain = useCallback(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.focus();
      main.scrollIntoView();
    }
  }, []);

  const skipToNavigation = useCallback(() => {
    const nav = document.getElementById('main-navigation');
    if (nav) {
      nav.focus();
      nav.scrollIntoView();
    }
  }, []);

  return {
    isVisible,
    showSkipLinks,
    hideSkipLinks,
    skipToMain,
    skipToNavigation,
  };
}

// Loading state announcements
export function useLoadingAnnouncements() {
  const { announcePolite, announceAssertive } = useScreenReaderAnnouncements();

  const announceLoading = useCallback((message: string = 'Loading') => {
    announcePolite(`${message}...`);
  }, [announcePolite]);

  const announceLoaded = useCallback((message: string = 'Content loaded') => {
    announcePolite(message);
  }, [announcePolite]);

  const announceError = useCallback((message: string = 'An error occurred') => {
    announceAssertive(message);
  }, [announceAssertive]);

  const announceSuccess = useCallback((message: string = 'Action completed successfully') => {
    announcePolite(message);
  }, [announcePolite]);

  return {
    announceLoading,
    announceLoaded,
    announceError,
    announceSuccess,
  };
}

// Form validation announcements
export function useFormAnnouncements() {
  const { announceAssertive, announcePolite } = useScreenReaderAnnouncements();

  const announceFieldError = useCallback((fieldName: string, error: string) => {
    announceAssertive(`Error in ${fieldName}: ${error}`);
  }, [announceAssertive]);

  const announceFormSubmitted = useCallback(() => {
    announcePolite('Form submitted successfully');
  }, [announcePolite]);

  const announceFormErrors = useCallback((errorCount: number) => {
    announceAssertive(`Form has ${errorCount} error${errorCount === 1 ? '' : 's'}`);
  }, [announceAssertive]);

  const announceStepChange = useCallback((currentStep: number, totalSteps: number, stepName?: string) => {
    const message = stepName
      ? `Step ${currentStep} of ${totalSteps}: ${stepName}`
      : `Step ${currentStep} of ${totalSteps}`;
    announcePolite(message);
  }, [announcePolite]);

  return {
    announceFieldError,
    announceFormSubmitted,
    announceFormErrors,
    announceStepChange,
  };
}

// Progress announcements
export function useProgressAnnouncements() {
  const { announcePolite } = useScreenReaderAnnouncements();

  const announceProgress = useCallback((current: number, total: number, description?: string) => {
    const percentage = Math.round((current / total) * 100);
    const message = description
      ? `${description}: ${percentage}% complete`
      : `${percentage}% complete`;
    announcePolite(message);
  }, [announcePolite]);

  const announceProgressComplete = useCallback((description?: string) => {
    const message = description
      ? `${description} completed`
      : 'Progress completed';
    announcePolite(message);
  }, [announcePolite]);

  return {
    announceProgress,
    announceProgressComplete,
  };
}