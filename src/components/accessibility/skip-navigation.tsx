/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/components/accessibility/skip-navigation.tsx
 * phase: 3
 * domain: accessibility
 * purpose: Skip navigation links for keyboard and screen reader users
 * spec_ref: 007-mvp-intent-driven/contracts/skip-navigation.md
 * complexity_budget: 150
 * migrations_touched: []
 * state_machine: {
 *   states: ['hidden', 'visible', 'focused'],
 *   transitions: [
 *     'hidden->visible: keyboardFocus()',
 *     'visible->focused: linkFocused()',
 *     'focused->hidden: linkBlurred()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "skipNavigation": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [],
 *   external: ['react'],
 *   supabase: []
 * }
 * exports: ['SkipNavigation']
 * voice_considerations: Voice navigation bypass for keyboard users
 * test_requirements: {
 *   coverage: 95,
 *   unit_tests: 'tests/components/accessibility/skip-navigation.test.tsx'
 * }
 * tasks: [
 *   'Create skip navigation component',
 *   'Add keyboard-only visibility',
 *   'Implement focus management',
 *   'Add voice announcement support'
 * ]
 */

'use client';

import { useEffect, useState } from 'react';

interface SkipLink {
  href: string;
  text: string;
  description?: string;
}

interface SkipNavigationProps {
  links?: SkipLink[];
  className?: string;
}

const defaultLinks: SkipLink[] = [
  {
    href: '#main-content',
    text: 'Skip to main content',
    description: 'Jump directly to the main page content'
  },
  {
    href: '#navigation',
    text: 'Skip to navigation',
    description: 'Jump to the main navigation menu'
  },
  {
    href: '#voice-controls',
    text: 'Skip to voice controls',
    description: 'Jump to voice navigation controls'
  }
];

export function SkipNavigation({ 
  links = defaultLinks, 
  className = '' 
}: SkipNavigationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [focusedLink, setFocusedLink] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Show skip links when Tab is pressed
      if (event.key === 'Tab' && !event.shiftKey) {
        setIsVisible(true);
      }
    };

    const handleClick = () => {
      // Hide skip links when mouse is used
      setIsVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  const handleLinkClick = (href: string) => {
    const targetElement = document.querySelector(href);
    if (targetElement) {
      // Ensure the target is focusable
      const originalTabIndex = targetElement.getAttribute('tabindex');
      if (!originalTabIndex) {
        targetElement.setAttribute('tabindex', '-1');
      }
      
      // Focus the target element
      (targetElement as HTMLElement).focus();
      
      // Remove the temporary tabindex if we added it
      if (!originalTabIndex) {
        setTimeout(() => {
          targetElement.removeAttribute('tabindex');
        }, 100);
      }
      
      // Scroll to the element
      targetElement.scrollIntoView({ behavior: 'smooth' });
      
      // Announce the navigation for screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = `Navigated to ${targetElement.getAttribute('aria-label') || 'main content'}`;
      
      document.body.appendChild(announcement);
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
    
    setIsVisible(false);
  };

  const handleLinkFocus = (href: string) => {
    setFocusedLink(href);
  };

  const handleLinkBlur = () => {
    setFocusedLink(null);
    // Hide skip links after a short delay if no other skip link is focused
    setTimeout(() => {
      if (!document.querySelector('.skip-link:focus')) {
        setIsVisible(false);
      }
    }, 100);
  };

  if (links.length === 0) {
    return null;
  }

  return (
    <div
      className={`skip-navigation fixed top-0 left-0 z-50 ${className}`}
      role="navigation"
      aria-label="Skip navigation"
    >
      <div
        className={`bg-blue-600 text-white p-2 shadow-lg transition-transform duration-200 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <ul className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-4">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={`skip-link block px-3 py-2 rounded text-sm font-medium 
                  focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 
                  focus:ring-offset-blue-600 hover:bg-blue-700 transition-colors
                  ${focusedLink === link.href ? 'bg-blue-700' : ''}
                `}
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(link.href);
                }}
                onFocus={() => handleLinkFocus(link.href)}
                onBlur={handleLinkBlur}
                aria-describedby={link.description ? `${link.href}-desc` : undefined}
              >
                {link.text}
              </a>
              
              {link.description && (
                <span
                  id={`${link.href}-desc`}
                  className="sr-only"
                >
                  {link.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      
      {/* Visual indicator for screen reader users */}
      <div className="sr-only" aria-live="polite">
        {isVisible && 'Skip navigation links available. Use Tab to navigate.'}
      </div>
    </div>
  );
}

// Utility function to add skip targets to page elements
export function addSkipTarget(
  elementId: string, 
  label?: string,
  landmark?: string
): void {
  const element = document.getElementById(elementId);
  if (element) {
    // Ensure the element can receive focus
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '-1');
    }
    
    // Add aria-label if provided
    if (label && !element.getAttribute('aria-label')) {
      element.setAttribute('aria-label', label);
    }
    
    // Add landmark role if provided
    if (landmark && !element.getAttribute('role')) {
      element.setAttribute('role', landmark);
    }
  }
}

// Utility function to setup common skip targets
export function setupDefaultSkipTargets(): void {
  // Setup main content target
  const mainContent = document.querySelector('main') || 
                     document.querySelector('[role="main"]') ||
                     document.getElementById('main-content');
  
  if (mainContent && !mainContent.id) {
    mainContent.id = 'main-content';
  }
  
  addSkipTarget('main-content', 'Main content area', 'main');
  
  // Setup navigation target
  const navigation = document.querySelector('nav') ||
                    document.querySelector('[role="navigation"]') ||
                    document.getElementById('navigation');
  
  if (navigation && !navigation.id) {
    navigation.id = 'navigation';
  }
  
  addSkipTarget('navigation', 'Main navigation menu', 'navigation');
  
  // Setup voice controls target if it exists
  const voiceControls = document.getElementById('voice-controls');
  if (voiceControls) {
    addSkipTarget('voice-controls', 'Voice navigation controls', 'region');
  }
}