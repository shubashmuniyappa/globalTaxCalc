'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Calculator, Moon, Sun, User, Settings } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Calculator', href: '/calculator' },
  { name: 'Tax Guide', href: '/guide' },
  { name: 'Tools', href: '/tools' },
  { name: 'Support', href: '/support' },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:bg-gray-900/60">
      <div className="container-wide">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and brand */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center space-x-2 text-xl font-bold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              onClick={closeMenu}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 text-white">
                <Calculator className="h-5 w-5" />
              </div>
              <span className="hidden sm:block">GlobalTaxCalc</span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden md:flex md:items-center md:space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary-600 dark:hover:text-primary-400',
                  pathname === item.href
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-300'
                )}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {/* Theme toggle */}
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            )}

            {/* User menu */}
            <Button variant="ghost" size="icon" aria-label="User account">
              <User className="h-5 w-5" />
            </Button>

            {/* CTA button */}
            <Button
              onClick={() => router.push('/calculator')}
              className="shadow-sm"
            >
              Start Calculating
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center space-x-2 md:hidden">
            {/* Mobile theme toggle */}
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMenu}
              aria-label="Open main menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="space-y-1 border-t border-gray-200 bg-white px-4 pb-3 pt-2 dark:border-gray-800 dark:bg-gray-900">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'block rounded-md px-3 py-2 text-base font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800',
                  pathname === item.href
                    ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-300'
                )}
                onClick={closeMenu}
              >
                {item.name}
              </Link>
            ))}

            {/* Mobile actions */}
            <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-800">
              <Link
                href="/account"
                className="flex items-center space-x-3 rounded-md px-3 py-2 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={closeMenu}
              >
                <User className="h-5 w-5" />
                <span>Account</span>
              </Link>

              <Link
                href="/settings"
                className="flex items-center space-x-3 rounded-md px-3 py-2 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={closeMenu}
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>

              <div className="pt-2">
                <Button
                  onClick={() => {
                    closeMenu();
                    router.push('/calculator');
                  }}
                  className="w-full justify-center"
                >
                  Start Calculating
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu backdrop */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}
    </header>
  );
}