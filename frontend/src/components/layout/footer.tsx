'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calculator, Twitter, Facebook, LinkedIn, Github, Mail } from 'lucide-react';

const footerNavigation = {
  product: [
    { name: 'Tax Calculator', href: '/calculator' },
    { name: 'Tax Guide', href: '/guide' },
    { name: 'Tools', href: '/tools' },
    { name: 'API', href: '/api' },
  ],
  support: [
    { name: 'Help Center', href: '/support' },
    { name: 'Contact Us', href: '/contact' },
    { name: 'Documentation', href: '/docs' },
    { name: 'Status', href: '/status' },
  ],
  company: [
    { name: 'About', href: '/about' },
    { name: 'Blog', href: '/blog' },
    { name: 'Careers', href: '/careers' },
    { name: 'Press', href: '/press' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Cookie Policy', href: '/cookies' },
    { name: 'Disclaimer', href: '/disclaimer' },
  ],
};

const socialLinks = [
  {
    name: 'Twitter',
    href: 'https://twitter.com/globaltaxcalc',
    icon: Twitter,
  },
  {
    name: 'Facebook',
    href: 'https://facebook.com/globaltaxcalc',
    icon: Facebook,
  },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/company/globaltaxcalc',
    icon: LinkedIn,
  },
  {
    name: 'GitHub',
    href: 'https://github.com/globaltaxcalc',
    icon: Github,
  },
  {
    name: 'Email',
    href: 'mailto:contact@globaltaxcalc.com',
    icon: Mail,
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-900" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>

      <div className="container-wide">
        <div className="py-12 lg:py-16">
          <div className="xl:grid xl:grid-cols-3 xl:gap-8">
            {/* Brand section */}
            <div className="space-y-8 xl:col-span-1">
              <Link
                href="/"
                className="flex items-center space-x-2 text-xl font-bold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 text-white">
                  <Calculator className="h-5 w-5" />
                </div>
                <span>GlobalTaxCalc</span>
              </Link>

              <p className="text-gray-600 dark:text-gray-400 max-w-md">
                Free, accurate tax calculator helping individuals and businesses calculate taxes,
                find deductions, and maximize refunds worldwide.
              </p>

              {/* Social links */}
              <div className="flex space-x-6">
                {socialLinks.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Follow us on ${item.name}`}
                  >
                    <span className="sr-only">{item.name}</span>
                    <item.icon className="h-6 w-6" aria-hidden="true" />
                  </a>
                ))}
              </div>

              {/* Newsletter signup */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                  Stay Updated
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get the latest tax news and updates delivered to your inbox.
                </p>
                <form className="flex flex-col sm:flex-row gap-2">
                  <label htmlFor="email-address" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                    placeholder="Enter your email"
                  />
                  <button
                    type="submit"
                    className="flex-shrink-0 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>

            {/* Navigation links */}
            <div className="mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                    Product
                  </h3>
                  <ul role="list" className="mt-4 space-y-4">
                    {footerNavigation.product.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-12 md:mt-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                    Support
                  </h3>
                  <ul role="list" className="mt-4 space-y-4">
                    {footerNavigation.support.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                    Company
                  </h3>
                  <ul role="list" className="mt-4 space-y-4">
                    {footerNavigation.company.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-12 md:mt-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                    Legal
                  </h3>
                  <ul role="list" className="mt-4 space-y-4">
                    {footerNavigation.legal.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom section */}
          <div className="mt-12 border-t border-gray-200 pt-8 dark:border-gray-800">
            <div className="md:flex md:items-center md:justify-between">
              <div className="flex space-x-6 md:order-2">
                {/* Trust badges */}
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Trusted by 10,000+ users
                  </span>
                  <div className="flex items-center space-x-1">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      All systems operational
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-8 text-sm text-gray-500 dark:text-gray-400 md:order-1 md:mt-0">
                &copy; {currentYear} GlobalTaxCalc. All rights reserved.
              </p>
            </div>

            {/* Disclaimer */}
            <div className="mt-8 border-t border-gray-200 pt-8 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                <strong>Disclaimer:</strong> GlobalTaxCalc provides tax calculation tools for
                informational purposes only. Results should not be considered professional tax
                advice. Tax laws are complex and change frequently. For specific tax situations,
                please consult a qualified tax professional or the relevant tax authority. We do
                not guarantee the accuracy of calculations and are not liable for any errors or
                omissions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}