'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useSkipLinks } from '@/hooks/use-screen-reader';

interface SkipLinksProps {
  links?: Array<{
    href: string;
    label: string;
  }>;
}

const defaultLinks = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#main-navigation', label: 'Skip to navigation' },
];

export function SkipLinks({ links = defaultLinks }: SkipLinksProps) {
  const { isVisible, showSkipLinks, hideSkipLinks } = useSkipLinks();

  return (
    <div
      className={cn(
        'fixed top-0 left-0 z-[9999] transform -translate-y-full',
        'focus-within:translate-y-0 transition-transform duration-200',
        isVisible && 'translate-y-0'
      )}
    >
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={cn(
            'sr-only focus:not-sr-only',
            'absolute left-4 top-4 z-[9999]',
            'bg-primary-600 text-white px-4 py-2 rounded-md',
            'text-sm font-medium',
            'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600'
          )}
          onFocus={showSkipLinks}
          onBlur={hideSkipLinks}
          onClick={(e) => {
            const target = document.querySelector(link.href);
            if (target) {
              e.preventDefault();
              target.scrollIntoView({ behavior: 'smooth' });
              // Set focus to the target element if it's focusable
              if (target instanceof HTMLElement && target.tabIndex >= 0) {
                target.focus();
              } else {
                // Make it focusable temporarily
                target.setAttribute('tabindex', '-1');
                (target as HTMLElement).focus();
                // Remove tabindex after focus to prevent it from being in tab order
                target.addEventListener('blur', () => {
                  target.removeAttribute('tabindex');
                }, { once: true });
              }
            }
            hideSkipLinks();
          }}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

export function SkipTarget({
  id,
  children,
  className
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={cn('focus:outline-none', className)} tabIndex={-1}>
      {children}
    </div>
  );
}