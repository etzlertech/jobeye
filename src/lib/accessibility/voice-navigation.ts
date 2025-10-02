/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/lib/accessibility/voice-navigation.ts
 * phase: 3
 * domain: accessibility
 * purpose: Voice-driven navigation and accessibility features for MVP app
 * spec_ref: 007-mvp-intent-driven/contracts/voice-navigation.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: {
 *   states: ['idle', 'listening', 'processing', 'navigating', 'announcing'],
 *   transitions: [
 *     'idle->listening: startVoiceNavigation()',
 *     'listening->processing: voiceCommandReceived()',
 *     'processing->navigating: commandRecognized()',
 *     'processing->announcing: needsGuidance()',
 *     'navigating->idle: navigationComplete()',
 *     'announcing->listening: announcementComplete()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "voiceNavigation": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/lib/voice/voice-processor',
 *     '@/core/logger/voice-logger'
 *   ],
 *   external: ['react'],
 *   supabase: []
 * }
 * exports: ['VoiceNavigator', 'NavigationCommand', 'AccessibilityManager']
 * voice_considerations: Core voice navigation system for accessibility
 * test_requirements: {
 *   coverage: 95,
 *   unit_tests: 'tests/lib/accessibility/voice-navigation.test.ts'
 * }
 * tasks: [
 *   'Implement voice-driven page navigation',
 *   'Add screen reader compatibility',
 *   'Create audio descriptions for visual elements',
 *   'Implement spatial audio cues'
 * ]
 */

import { voiceProcessor } from '@/lib/voice/voice-processor';
import { voiceLogger } from '@/core/logger/voice-logger';

export interface NavigationCommand {
  command: string;
  target: string;
  description: string;
  shortcut?: string;
  category: 'navigation' | 'action' | 'selection' | 'information';
}

export interface SpatialCue {
  type: 'cardinal' | 'clock' | 'relative';
  direction: string;
  distance?: 'near' | 'medium' | 'far';
  element: string;
}

export interface AudioDescription {
  element: string;
  description: string;
  context?: string;
  importance: 'critical' | 'important' | 'helpful';
}

export class VoiceNavigator {
  private static instance: VoiceNavigator;
  private isActive: boolean = false;
  private currentPage: string = '';
  private navigationCommands: Map<string, NavigationCommand> = new Map();
  private spatialMap: Map<string, SpatialCue> = new Map();
  private audioDescriptions: Map<string, AudioDescription> = new Map();
  private focusStack: string[] = [];
  private lastAnnouncement: number = 0;

  private constructor() {
    this.initializeCommands();
    this.setupKeyboardHandlers();
    this.setupFocusManagement();
  }

  static getInstance(): VoiceNavigator {
    if (!VoiceNavigator.instance) {
      VoiceNavigator.instance = new VoiceNavigator();
    }
    return VoiceNavigator.instance;
  }

  private initializeCommands(): void {
    const commands: NavigationCommand[] = [
      // Page navigation
      { command: 'go home', target: '/', description: 'Navigate to home page', category: 'navigation' },
      { command: 'go to dashboard', target: '/crew', description: 'Navigate to crew dashboard', category: 'navigation' },
      { command: 'go to jobs', target: '/crew', description: 'Navigate to jobs page', category: 'navigation' },
      { command: 'go to load verification', target: '/crew/load-verify', description: 'Navigate to load verification', category: 'navigation' },
      { command: 'go to supervisor', target: '/supervisor', description: 'Navigate to supervisor dashboard', category: 'navigation' },
      { command: 'go to admin', target: '/admin', description: 'Navigate to admin panel', category: 'navigation' },

      // Actions
      { command: 'take photo', target: 'camera', description: 'Open camera to take a photo', category: 'action' },
      { command: 'record voice', target: 'voice-record', description: 'Start voice recording', category: 'action' },
      { command: 'start job', target: 'start-job', description: 'Start the selected job', category: 'action' },
      { command: 'complete job', target: 'complete-job', description: 'Mark job as complete', category: 'action' },
      { command: 'verify load', target: 'verify-load', description: 'Start load verification process', category: 'action' },

      // Selection and focus
      { command: 'next item', target: 'focus-next', description: 'Move focus to next item', shortcut: 'Tab', category: 'selection' },
      { command: 'previous item', target: 'focus-previous', description: 'Move focus to previous item', shortcut: 'Shift+Tab', category: 'selection' },
      { command: 'select item', target: 'select', description: 'Select current item', shortcut: 'Enter', category: 'selection' },
      { command: 'go back', target: 'back', description: 'Go back to previous page', shortcut: 'Alt+Left', category: 'navigation' },

      // Information
      { command: 'where am I', target: 'location', description: 'Describe current page and location', category: 'information' },
      { command: 'what can I do', target: 'help', description: 'List available actions', category: 'information' },
      { command: 'describe this', target: 'describe', description: 'Describe current focused element', category: 'information' },
      { command: 'read page', target: 'read-page', description: 'Read page content aloud', category: 'information' },

      // Shortcuts
      { command: 'emergency stop', target: 'stop', description: 'Stop all voice operations', shortcut: 'Escape', category: 'action' }
    ];

    commands.forEach(cmd => {
      this.navigationCommands.set(cmd.command.toLowerCase(), cmd);
    });
  }

  private setupKeyboardHandlers(): void {
    document.addEventListener('keydown', (event) => {
      // Voice navigation toggle (Alt + V)
      if (event.altKey && event.key === 'v') {
        event.preventDefault();
        this.toggle();
        return;
      }

      // Help (Alt + H)
      if (event.altKey && event.key === 'h') {
        event.preventDefault();
        this.announceHelp();
        return;
      }

      // Emergency stop (Escape)
      if (event.key === 'Escape') {
        event.preventDefault();
        this.emergencyStop();
        return;
      }

      // Skip to main content (Alt + M)
      if (event.altKey && event.key === 'm') {
        event.preventDefault();
        this.skipToMain();
        return;
      }
    });
  }

  private setupFocusManagement(): void {
    // Track focus changes for better navigation
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (target && target.id) {
        this.updateFocusStack(target.id);
        if (this.isActive) {
          this.announceFocusChange(target);
        }
      }
    });

    // Handle focus trapping in modals
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && this.isModalOpen()) {
        this.handleModalFocus(event);
      }
    });
  }

  async activate(): Promise<void> {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    voiceLogger.info('Voice navigation activated');

    // Start listening for voice commands
    voiceProcessor.onCommandProcessed(this.handleVoiceCommand.bind(this));

    // Announce activation
    await this.announce('Voice navigation activated. Say "what can I do" for help.');

    // Describe current page
    setTimeout(() => {
      this.describeCurrentPage();
    }, 1000);
  }

  async deactivate(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    voiceLogger.info('Voice navigation deactivated');

    // Stop voice processor
    voiceProcessor.stopListening();
    voiceProcessor.stopSpeaking();

    // Announce deactivation
    await this.announce('Voice navigation deactivated.');
  }

  toggle(): void {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  private async handleVoiceCommand(data: { command: any; response: any }): Promise<void> {
    const transcript = data.command.transcript.toLowerCase();
    
    // Find matching navigation command
    const command = this.findBestMatch(transcript);
    
    if (command) {
      voiceLogger.info('Voice navigation command recognized', { 
        command: command.command,
        target: command.target 
      });

      await this.executeCommand(command);
    } else {
      // Try to extract navigation intent
      await this.handleUnrecognizedCommand(transcript);
    }
  }

  private findBestMatch(transcript: string): NavigationCommand | null {
    // Exact match first
    const exactMatch = this.navigationCommands.get(transcript);
    if (exactMatch) {
      return exactMatch;
    }

    // Fuzzy matching
    let bestMatch: NavigationCommand | null = null;
    let bestScore = 0;

    for (const [key, command] of this.navigationCommands) {
      const score = this.calculateSimilarity(transcript, key);
      if (score > bestScore && score > 0.7) {
        bestScore = score;
        bestMatch = command;
      }
    }

    return bestMatch;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple word overlap similarity
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    
    const overlap = words1.filter(word => words2.includes(word)).length;
    const maxLength = Math.max(words1.length, words2.length);
    
    return overlap / maxLength;
  }

  private async executeCommand(command: NavigationCommand): Promise<void> {
    switch (command.target) {
      case 'location':
        await this.announceLocation();
        break;
      case 'help':
        await this.announceHelp();
        break;
      case 'describe':
        await this.describeCurrentElement();
        break;
      case 'read-page':
        await this.readPageContent();
        break;
      case 'stop':
        await this.emergencyStop();
        break;
      case 'focus-next':
        this.focusNext();
        break;
      case 'focus-previous':
        this.focusPrevious();
        break;
      case 'select':
        this.selectCurrent();
        break;
      case 'back':
        this.goBack();
        break;
      default:
        if (command.target.startsWith('/')) {
          await this.navigateToPage(command.target);
        } else {
          await this.triggerAction(command.target);
        }
    }
  }

  private async handleUnrecognizedCommand(transcript: string): Promise<void> {
    // Try to extract navigation intent from natural language
    if (transcript.includes('go to') || transcript.includes('navigate to')) {
      const target = this.extractNavigationTarget(transcript);
      if (target) {
        await this.navigateToPage(target);
        return;
      }
    }

    if (transcript.includes('what') && transcript.includes('page')) {
      await this.announceLocation();
      return;
    }

    if (transcript.includes('help') || transcript.includes('commands')) {
      await this.announceHelp();
      return;
    }

    // Default response for unrecognized commands
    await this.announce('I didn\'t understand that command. Say "what can I do" for available options.');
  }

  private extractNavigationTarget(transcript: string): string | null {
    const pageMapping: { [key: string]: string } = {
      'dashboard': '/crew',
      'home': '/',
      'jobs': '/crew',
      'load verification': '/crew/load-verify',
      'verify load': '/crew/load-verify',
      'supervisor': '/supervisor',
      'admin': '/admin',
      'create job': '/supervisor/jobs/create'
    };

    for (const [key, path] of Object.entries(pageMapping)) {
      if (transcript.includes(key)) {
        return path;
      }
    }

    return null;
  }

  private async navigateToPage(path: string): Promise<void> {
    await this.announce(`Navigating to ${this.getPageName(path)}`);
    
    // Use Next.js router if available, otherwise fallback to window.location
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  }

  private async triggerAction(action: string): Promise<void> {
    const actionMap: { [key: string]: () => void } = {
      'camera': () => this.triggerCamera(),
      'voice-record': () => this.triggerVoiceRecord(),
      'start-job': () => this.triggerStartJob(),
      'complete-job': () => this.triggerCompleteJob(),
      'verify-load': () => this.triggerVerifyLoad()
    };

    const actionFn = actionMap[action];
    if (actionFn) {
      await this.announce(`Starting ${action.replace('-', ' ')}`);
      actionFn();
    }
  }

  private triggerCamera(): void {
    const cameraButton = document.querySelector('[data-testid="camera-button"]') as HTMLButtonElement;
    if (cameraButton) {
      cameraButton.click();
    } else {
      this.announce('Camera button not found on this page');
    }
  }

  private triggerVoiceRecord(): void {
    const voiceButton = document.querySelector('[data-testid="voice-record-button"]') as HTMLButtonElement;
    if (voiceButton) {
      voiceButton.click();
    } else {
      this.announce('Voice recording not available on this page');
    }
  }

  private triggerStartJob(): void {
    const startButton = document.querySelector('[data-action="start-job"]') as HTMLButtonElement;
    if (startButton) {
      startButton.click();
    } else {
      this.announce('No job available to start');
    }
  }

  private triggerCompleteJob(): void {
    const completeButton = document.querySelector('[data-action="complete-job"]') as HTMLButtonElement;
    if (completeButton) {
      completeButton.click();
    } else {
      this.announce('No job available to complete');
    }
  }

  private triggerVerifyLoad(): void {
    const verifyButton = document.querySelector('[data-action="verify-load"]') as HTMLButtonElement;
    if (verifyButton) {
      verifyButton.click();
    } else {
      this.announce('Load verification not available');
    }
  }

  private async announceLocation(): Promise<void> {
    const pageName = this.getPageName(window.location.pathname);
    const focusedElement = document.activeElement;
    
    let message = `You are on the ${pageName} page.`;
    
    if (focusedElement && focusedElement !== document.body) {
      const elementDesc = this.getElementDescription(focusedElement as HTMLElement);
      message += ` Focus is on ${elementDesc}.`;
    }

    await this.announce(message);
  }

  private async announceHelp(): Promise<void> {
    const pageCommands = this.getPageSpecificCommands();
    const generalCommands = [
      'Say "go home" to return to the main page',
      'Say "where am I" to know your current location',
      'Say "describe this" to hear about the focused element',
      'Say "next item" or "previous item" to navigate',
      'Press Alt+V to toggle voice navigation'
    ];

    let message = 'Available commands: ';
    
    if (pageCommands.length > 0) {
      message += pageCommands.join(', ') + '. ';
    }
    
    message += 'General commands: ' + generalCommands.join(', ');

    await this.announce(message);
  }

  private getPageSpecificCommands(): string[] {
    const path = window.location.pathname;
    const commands: string[] = [];

    if (path.includes('/crew')) {
      commands.push('Say "start job" to begin work', 'Say "take photo" to capture images');
    }
    
    if (path.includes('/supervisor')) {
      commands.push('Say "create job" to make new assignments');
    }
    
    if (path.includes('/load-verify')) {
      commands.push('Say "verify load" to check equipment');
    }

    return commands;
  }

  private async describeCurrentElement(): Promise<void> {
    const focusedElement = document.activeElement as HTMLElement;
    
    if (!focusedElement || focusedElement === document.body) {
      await this.announce('No specific element is focused. Try navigating with "next item" or "previous item".');
      return;
    }

    const description = this.getDetailedElementDescription(focusedElement);
    await this.announce(description);
  }

  private async readPageContent(): Promise<void> {
    const mainContent = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    const textContent = this.extractReadableText(mainContent);
    
    if (textContent.length > 0) {
      await this.announce(`Reading page content: ${textContent}`);
    } else {
      await this.announce('No readable content found on this page.');
    }
  }

  private extractReadableText(element: Element): string {
    // Extract text while preserving important structure
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Skip hidden elements
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip script and style elements
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textParts: string[] = [];
    let node;
    
    while (node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        textParts.push(text);
      }
    }

    return textParts.join(' ').slice(0, 500); // Limit to 500 characters
  }

  private async emergencyStop(): Promise<void> {
    voiceProcessor.stopListening();
    voiceProcessor.stopSpeaking();
    await this.announce('All voice operations stopped.');
  }

  private focusNext(): void {
    const focusableElements = this.getFocusableElements();
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + 1) % focusableElements.length;
    
    focusableElements[nextIndex]?.focus();
  }

  private focusPrevious(): void {
    const focusableElements = this.getFocusableElements();
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    const prevIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
    
    focusableElements[prevIndex]?.focus();
  }

  private selectCurrent(): void {
    const focused = document.activeElement as HTMLElement;
    if (focused) {
      focused.click();
    }
  }

  private goBack(): void {
    window.history.back();
  }

  private skipToMain(): void {
    const mainContent = document.querySelector('main') || 
                       document.querySelector('[role="main"]') ||
                       document.querySelector('#main-content');
    
    if (mainContent) {
      (mainContent as HTMLElement).focus();
      this.announce('Skipped to main content');
    }
  }

  private getFocusableElements(): HTMLElement[] {
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    
    return elements.filter(element => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             !element.disabled &&
             element.tabIndex >= 0;
    });
  }

  private updateFocusStack(elementId: string): void {
    this.focusStack.push(elementId);
    if (this.focusStack.length > 10) {
      this.focusStack = this.focusStack.slice(-10);
    }
  }

  private async announceFocusChange(element: HTMLElement): Promise<void> {
    // Throttle announcements to avoid overwhelming the user
    const now = Date.now();
    if (now - this.lastAnnouncement < 500) {
      return;
    }
    this.lastAnnouncement = now;

    const description = this.getElementDescription(element);
    await this.announce(description, { interrupt: false });
  }

  private getElementDescription(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type');
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const text = element.textContent?.trim() || '';

    // Use aria-label if available
    if (ariaLabel) {
      return `${this.getElementType(element)} "${ariaLabel}"`;
    }

    // Use text content
    if (text && text.length > 0 && text.length < 100) {
      return `${this.getElementType(element)} "${text}"`;
    }

    // Use other attributes
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      return `${this.getElementType(element)} with placeholder "${placeholder}"`;
    }

    const title = element.getAttribute('title');
    if (title) {
      return `${this.getElementType(element)} "${title}"`;
    }

    return this.getElementType(element);
  }

  private getDetailedElementDescription(element: HTMLElement): string {
    const basicDesc = this.getElementDescription(element);
    const position = this.getElementPosition(element);
    
    let description = basicDesc;
    
    if (position) {
      description += `. Located ${position}.`;
    }

    // Add state information
    if (element.hasAttribute('aria-expanded')) {
      const expanded = element.getAttribute('aria-expanded') === 'true';
      description += ` ${expanded ? 'Expanded' : 'Collapsed'}.`;
    }

    if (element.hasAttribute('aria-checked')) {
      const checked = element.getAttribute('aria-checked') === 'true';
      description += ` ${checked ? 'Checked' : 'Unchecked'}.`;
    }

    if (element.hasAttribute('disabled')) {
      description += ' Disabled.';
    }

    return description;
  }

  private getElementType(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type');
    const role = element.getAttribute('role');

    if (role) {
      return role;
    }

    switch (tagName) {
      case 'button':
        return 'button';
      case 'a':
        return 'link';
      case 'input':
        return type ? `${type} input` : 'input';
      case 'select':
        return 'dropdown';
      case 'textarea':
        return 'text area';
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return 'heading';
      default:
        return tagName;
    }
  }

  private getElementPosition(element: HTMLElement): string | null {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Determine horizontal position
    let horizontal = '';
    if (centerX < viewportWidth * 0.33) {
      horizontal = 'left';
    } else if (centerX > viewportWidth * 0.67) {
      horizontal = 'right';
    } else {
      horizontal = 'center';
    }

    // Determine vertical position
    let vertical = '';
    if (centerY < viewportHeight * 0.33) {
      vertical = 'top';
    } else if (centerY > viewportHeight * 0.67) {
      vertical = 'bottom';
    } else {
      vertical = 'middle';
    }

    if (horizontal === 'center' && vertical === 'middle') {
      return 'in the center of the screen';
    }

    return `in the ${vertical} ${horizontal} of the screen`;
  }

  private getPageName(path: string): string {
    const pageNames: { [key: string]: string } = {
      '/': 'home',
      '/crew': 'crew dashboard',
      '/crew/load-verify': 'load verification',
      '/supervisor': 'supervisor dashboard',
      '/supervisor/jobs/create': 'job creation',
      '/admin': 'admin panel'
    };

    return pageNames[path] || 'unknown page';
  }

  private isModalOpen(): boolean {
    return document.querySelector('[role="dialog"], [aria-modal="true"]') !== null;
  }

  private handleModalFocus(event: KeyboardEvent): void {
    const modal = document.querySelector('[role="dialog"], [aria-modal="true"]');
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  private async describeCurrentPage(): Promise<void> {
    const pageName = this.getPageName(window.location.pathname);
    const pageCommands = this.getPageSpecificCommands();
    
    let message = `Welcome to the ${pageName} page.`;
    
    if (pageCommands.length > 0) {
      message += ` Available actions: ${pageCommands.join(', ')}.`;
    }
    
    message += ' Say "what can I do" for more options.';
    
    await this.announce(message);
  }

  private async announce(
    text: string, 
    options: { interrupt?: boolean; priority?: 'low' | 'normal' | 'high' } = {}
  ): Promise<void> {
    const { interrupt = true, priority = 'normal' } = options;

    if (interrupt) {
      voiceProcessor.stopSpeaking();
    }

    try {
      await voiceProcessor.speak(text, {
        rate: 1.0,
        pitch: 1.0,
        volume: 0.8
      });
    } catch (error) {
      voiceLogger.error('Failed to announce message', { text, error });
    }
  }

  // Public API
  isNavigationActive(): boolean {
    return this.isActive;
  }

  setCurrentPage(page: string): void {
    this.currentPage = page;
  }

  addCustomCommand(command: NavigationCommand): void {
    this.navigationCommands.set(command.command.toLowerCase(), command);
  }

  removeCustomCommand(command: string): void {
    this.navigationCommands.delete(command.toLowerCase());
  }

  getAvailableCommands(): NavigationCommand[] {
    return Array.from(this.navigationCommands.values());
  }
}

// Export singleton instance
export const voiceNavigator = VoiceNavigator.getInstance();