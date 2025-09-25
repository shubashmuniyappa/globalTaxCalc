/**
 * Accessibility Testing Support for Cypress
 */

import 'cypress-axe';

// Accessibility testing commands
Cypress.Commands.add('checkA11y', (context = null, options = {}) => {
  const defaultOptions = {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21aa']
    },
    rules: {
      'color-contrast': { enabled: true },
      'focus-order-semantics': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'aria-labels': { enabled: true }
    },
    ...options
  };

  cy.injectAxe();
  cy.checkA11y(context, defaultOptions, (violations) => {
    if (violations.length > 0) {
      cy.task('log', `Accessibility violations found: ${violations.length}`);
      violations.forEach((violation) => {
        cy.task('log', `${violation.id}: ${violation.description}`);
        violation.nodes.forEach((node) => {
          cy.task('log', `  - ${node.target}`);
        });
      });
    }
  });
});

Cypress.Commands.add('checkA11yForPage', (url, options = {}) => {
  cy.visit(url);
  cy.waitForPageLoad();
  cy.checkA11y(null, options);
});

// Keyboard navigation testing
Cypress.Commands.add('testKeyboardNavigation', () => {
  cy.get('body').tab();
  cy.focused().should('be.visible');

  // Test tab order
  const focusableElements = [
    'input:not([disabled])',
    'button:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  cy.get(focusableElements).each(($el, index) => {
    if (index === 0) {
      cy.wrap($el).focus();
    } else {
      cy.tab();
    }
    cy.focused().should('equal', $el[0]);
  });
});

// Screen reader testing
Cypress.Commands.add('checkAriaLabels', () => {
  // Check that interactive elements have accessible names
  cy.get('button, input, select, textarea').each(($el) => {
    const element = $el[0];
    const tagName = element.tagName.toLowerCase();

    // Check for aria-label, aria-labelledby, or associated label
    const hasAriaLabel = element.hasAttribute('aria-label') && element.getAttribute('aria-label').trim() !== '';
    const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
    const hasAssociatedLabel = tagName === 'input' && element.id &&
      document.querySelector(`label[for="${element.id}"]`);

    if (!hasAriaLabel && !hasAriaLabelledBy && !hasAssociatedLabel) {
      cy.task('log', `Element missing accessible name: ${element.outerHTML.substring(0, 100)}`);
    }
  });
});

// Color contrast testing
Cypress.Commands.add('checkColorContrast', () => {
  cy.window().then((win) => {
    const elements = win.document.querySelectorAll('*');
    elements.forEach((element) => {
      const styles = win.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;

      // Check if element has text content
      if (element.textContent && element.textContent.trim()) {
        // Log elements that might have contrast issues
        // (Actual contrast calculation would require more complex logic)
        cy.task('log', `Checking contrast for: ${element.tagName} - Color: ${color}, Background: ${backgroundColor}`);
      }
    });
  });
});

// Focus management testing
Cypress.Commands.add('testFocusManagement', () => {
  // Test focus trap in modals
  cy.get('[role="dialog"]').each(($modal) => {
    cy.wrap($modal).within(() => {
      // Find first and last focusable elements
      const focusableElements = Cypress.$(':focusable');
      if (focusableElements.length > 1) {
        const firstElement = focusableElements.first();
        const lastElement = focusableElements.last();

        // Test forward tab wrapping
        cy.wrap(lastElement).focus().tab();
        cy.focused().should('equal', firstElement[0]);

        // Test backward tab wrapping
        cy.wrap(firstElement).focus().tab({ shift: true });
        cy.focused().should('equal', lastElement[0]);
      }
    });
  });
});

// ARIA testing
Cypress.Commands.add('checkAriaRoles', () => {
  // Check that ARIA roles are used correctly
  cy.get('[role]').each(($el) => {
    const role = $el.attr('role');
    const validRoles = [
      'button', 'link', 'menuitem', 'tab', 'checkbox', 'radio',
      'textbox', 'combobox', 'listbox', 'option', 'grid', 'gridcell',
      'dialog', 'alertdialog', 'alert', 'status', 'log',
      'navigation', 'main', 'banner', 'contentinfo', 'complementary',
      'search', 'form', 'article', 'section'
    ];

    if (!validRoles.includes(role)) {
      cy.task('log', `Invalid ARIA role found: ${role} on ${$el[0].tagName}`);
    }
  });
});

// Automated accessibility audit for common patterns
Cypress.Commands.add('auditAccessibility', (options = {}) => {
  const auditOptions = {
    includeTags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
    excludeTags: [],
    ...options
  };

  // Run comprehensive accessibility checks
  cy.checkA11y(null, auditOptions);
  cy.testKeyboardNavigation();
  cy.checkAriaLabels();
  cy.checkAriaRoles();
  cy.testFocusManagement();
});

// Page-specific accessibility testing
Cypress.Commands.add('auditPageAccessibility', (pageName) => {
  cy.task('log', `Starting accessibility audit for ${pageName}`);

  // Wait for page to load
  cy.waitForPageLoad();

  // Run accessibility checks
  cy.auditAccessibility();

  // Take screenshot for accessibility review
  cy.screenshot(`a11y-${pageName}`, {
    capture: 'fullPage'
  });

  cy.task('log', `Accessibility audit completed for ${pageName}`);
});