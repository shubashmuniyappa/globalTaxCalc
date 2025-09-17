import { useEffect, useCallback } from 'react';

interface KeyboardNavigationOptions {
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onTab?: () => void;
  onShiftTab?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation({
  onEscape,
  onEnter,
  onArrowUp,
  onArrowDown,
  onArrowLeft,
  onArrowRight,
  onTab,
  onShiftTab,
  enabled = true,
}: KeyboardNavigationOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onEscape?.();
          break;
        case 'Enter':
          if (!event.shiftKey) {
            event.preventDefault();
            onEnter?.();
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          onArrowUp?.();
          break;
        case 'ArrowDown':
          event.preventDefault();
          onArrowDown?.();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          onArrowLeft?.();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onArrowRight?.();
          break;
        case 'Tab':
          if (event.shiftKey) {
            onShiftTab?.();
          } else {
            onTab?.();
          }
          break;
        default:
          break;
      }
    },
    [enabled, onEscape, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onTab, onShiftTab]
  );

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown, enabled]);
}

// Hook for managing focus within a container
export function useFocusManagement(containerRef: React.RefObject<HTMLElement>) {
  const focusableElementsSelector =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll(focusableElementsSelector)
    ).filter((element) => {
      return !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden');
    }) as HTMLElement[];
  }, [containerRef]);

  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
    }
  }, [getFocusableElements]);

  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[elements.length - 1].focus();
    }
  }, [getFocusableElements]);

  const focusNext = useCallback(() => {
    const elements = getFocusableElements();
    const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + 1) % elements.length;
    elements[nextIndex]?.focus();
  }, [getFocusableElements]);

  const focusPrevious = useCallback(() => {
    const elements = getFocusableElements();
    const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
    const previousIndex = currentIndex === 0 ? elements.length - 1 : currentIndex - 1;
    elements[previousIndex]?.focus();
  }, [getFocusableElements]);

  return {
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    getFocusableElements,
  };
}

// Hook for managing modal focus trap
export function useFocusTrap(
  isActive: boolean,
  containerRef: React.RefObject<HTMLElement>
) {
  const { focusFirst, focusLast, focusNext, focusPrevious, getFocusableElements } =
    useFocusManagement(containerRef);

  useKeyboardNavigation({
    onTab: () => {
      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const currentElement = document.activeElement as HTMLElement;
      const currentIndex = elements.indexOf(currentElement);

      if (currentIndex === elements.length - 1) {
        focusFirst();
      }
    },
    onShiftTab: () => {
      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const currentElement = document.activeElement as HTMLElement;
      const currentIndex = elements.indexOf(currentElement);

      if (currentIndex === 0) {
        focusLast();
      }
    },
    enabled: isActive,
  });

  useEffect(() => {
    if (isActive) {
      focusFirst();
    }
  }, [isActive, focusFirst]);
}

// Hook for managing roving tabindex navigation
export function useRovingTabIndex(
  items: HTMLElement[],
  activeIndex: number,
  onActiveIndexChange: (index: number) => void
) {
  useEffect(() => {
    items.forEach((item, index) => {
      if (index === activeIndex) {
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-selected', 'true');
      } else {
        item.setAttribute('tabindex', '-1');
        item.setAttribute('aria-selected', 'false');
      }
    });
  }, [items, activeIndex]);

  const moveToNext = useCallback(() => {
    const nextIndex = (activeIndex + 1) % items.length;
    onActiveIndexChange(nextIndex);
    items[nextIndex]?.focus();
  }, [activeIndex, items, onActiveIndexChange]);

  const moveToPrevious = useCallback(() => {
    const prevIndex = activeIndex === 0 ? items.length - 1 : activeIndex - 1;
    onActiveIndexChange(prevIndex);
    items[prevIndex]?.focus();
  }, [activeIndex, items, onActiveIndexChange]);

  const moveToFirst = useCallback(() => {
    onActiveIndexChange(0);
    items[0]?.focus();
  }, [items, onActiveIndexChange]);

  const moveToLast = useCallback(() => {
    const lastIndex = items.length - 1;
    onActiveIndexChange(lastIndex);
    items[lastIndex]?.focus();
  }, [items, onActiveIndexChange]);

  return {
    moveToNext,
    moveToPrevious,
    moveToFirst,
    moveToLast,
  };
}