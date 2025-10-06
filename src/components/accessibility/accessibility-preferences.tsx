/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/components/accessibility/accessibility-preferences.tsx
 * phase: 3
 * domain: accessibility
 * purpose: User preferences component for accessibility settings
 * spec_ref: 007-mvp-intent-driven/contracts/accessibility-preferences.md
 * complexity_budget: 250
 * migrations_touched: []
 * state_machine: {
 *   states: ['viewing', 'editing', 'saving', 'saved'],
 *   transitions: [
 *     'viewing->editing: startEdit()',
 *     'editing->saving: savePreferences()',
 *     'saving->saved: saveComplete()',
 *     'saved->viewing: resetView()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "accessibilityPreferences": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/hooks/use-voice-navigation',
 *     '@/lib/accessibility/voice-navigation'
 *   ],
 *   external: ['react'],
 *   supabase: []
 * }
 * exports: ['AccessibilityPreferences']
 * voice_considerations: Voice-controlled preference settings
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/components/accessibility/accessibility-preferences.test.tsx'
 * }
 * tasks: [
 *   'Create accessibility preferences UI',
 *   'Add voice navigation settings',
 *   'Implement preference persistence',
 *   'Add keyboard navigation support'
 * ]
 */

'use client';

import { useState, useEffect } from 'react';
import { useVoiceNavigation } from '@/hooks/use-voice-navigation';

interface AccessibilitySettings {
  voiceNavigationEnabled: boolean;
  voiceRate: number;
  voicePitch: number;
  voiceVolume: number;
  highContrastMode: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReaderMode: boolean;
  keyboardNavigationHelp: boolean;
}

const defaultSettings: AccessibilitySettings = {
  voiceNavigationEnabled: false,
  voiceRate: 1.0,
  voicePitch: 1.0,
  voiceVolume: 0.8,
  highContrastMode: false,
  largeText: false,
  reducedMotion: false,
  screenReaderMode: false,
  keyboardNavigationHelp: true
};

export function AccessibilityPreferences() {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const voiceNav = useVoiceNavigation({
    context: 'accessibility-preferences',
    customCommands: [
      {
        command: 'toggle voice navigation',
        handler: () => toggleSetting('voiceNavigationEnabled'),
        description: 'Toggle voice navigation on or off'
      },
      {
        command: 'increase voice speed',
        handler: () => adjustVoiceRate(0.1),
        description: 'Increase voice speaking rate'
      },
      {
        command: 'decrease voice speed',
        handler: () => adjustVoiceRate(-0.1),
        description: 'Decrease voice speaking rate'
      },
      {
        command: 'save settings',
        handler: saveSettings,
        description: 'Save accessibility preferences'
      }
    ],
    onCommandProcessed: (command) => {
      voiceNav.announce(`Executed: ${command}`);
    }
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('accessibilitySettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.warn('Failed to parse saved accessibility settings');
      }
    }
  }, []);

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast mode
    if (settings.highContrastMode) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Large text
    if (settings.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }

    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Screen reader mode
    if (settings.screenReaderMode) {
      root.classList.add('screen-reader');
    } else {
      root.classList.remove('screen-reader');
    }
  }, [settings]);

  async function saveSettings() {
    setIsSaving(true);
    try {
      localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
      setSaveMessage('Settings saved successfully');
      voiceNav.announce('Accessibility settings saved');
      
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Failed to save settings');
      voiceNav.announce('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  const resetSettings = () => {
    setSettings(defaultSettings);
    setSaveMessage('Settings reset to defaults');
    voiceNav.announce('Settings reset to defaults');
  };

  const toggleSetting = (key: keyof AccessibilitySettings) => {
    if (typeof settings[key] === 'boolean') {
      setSettings(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
    }
  };

  const adjustVoiceRate = (delta: number) => {
    setSettings(prev => ({
      ...prev,
      voiceRate: Math.max(0.1, Math.min(2.0, prev.voiceRate + delta))
    }));
  };

  const adjustVoicePitch = (delta: number) => {
    setSettings(prev => ({
      ...prev,
      voicePitch: Math.max(0.1, Math.min(2.0, prev.voicePitch + delta))
    }));
  };

  const adjustVoiceVolume = (delta: number) => {
    setSettings(prev => ({
      ...prev,
      voiceVolume: Math.max(0.0, Math.min(1.0, prev.voiceVolume + delta))
    }));
  };

  return (
    <div className="accessibility-preferences" role="main" aria-labelledby="preferences-title">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <header>
          <h1 id="preferences-title" className="text-2xl font-bold mb-2">
            Accessibility Preferences
          </h1>
          <p className="text-gray-600">
            Customize your accessibility settings for the best experience.
            {voiceNav.isActive && ' Voice navigation is active.'}
          </p>
        </header>

        {saveMessage && (
          <div 
            className={`p-3 rounded-md ${
              saveMessage.includes('Failed') 
                ? 'bg-red-100 text-red-800' 
                : 'bg-green-100 text-green-800'
            }`}
            role="status"
            aria-live="polite"
          >
            {saveMessage}
          </div>
        )}

        <section aria-labelledby="voice-settings">
          <h2 id="voice-settings" className="text-xl font-semibold mb-4">
            Voice Navigation
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="voice-enabled" className="font-medium">
                Enable Voice Navigation
              </label>
              <button
                id="voice-enabled"
                type="button"
                role="switch"
                aria-checked={settings.voiceNavigationEnabled}
                onClick={() => toggleSetting('voiceNavigationEnabled')}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.voiceNavigationEnabled 
                    ? 'bg-blue-600' 
                    : 'bg-gray-300'
                } relative`}
              >
                <span 
                  className={`block w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.voiceNavigationEnabled 
                      ? 'translate-x-7' 
                      : 'translate-x-1'
                  } relative top-1`}
                />
                <span className="sr-only">
                  {settings.voiceNavigationEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="voice-rate" className="block font-medium mb-1">
                  Voice Speed: {settings.voiceRate.toFixed(1)}x
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => adjustVoiceRate(-0.1)}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    aria-label="Decrease voice speed"
                  >
                    -
                  </button>
                  <input
                    id="voice-rate"
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={settings.voiceRate}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      voiceRate: parseFloat(e.target.value) 
                    }))}
                    className="flex-1"
                    aria-describedby="voice-rate-desc"
                  />
                  <button
                    onClick={() => adjustVoiceRate(0.1)}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    aria-label="Increase voice speed"
                  >
                    +
                  </button>
                </div>
                <p id="voice-rate-desc" className="text-sm text-gray-600 mt-1">
                  Adjust how fast the voice speaks
                </p>
              </div>

              <div>
                <label htmlFor="voice-volume" className="block font-medium mb-1">
                  Voice Volume: {Math.round(settings.voiceVolume * 100)}%
                </label>
                <input
                  id="voice-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.voiceVolume}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    voiceVolume: parseFloat(e.target.value) 
                  }))}
                  className="w-full"
                  aria-describedby="voice-volume-desc"
                />
                <p id="voice-volume-desc" className="text-sm text-gray-600 mt-1">
                  Adjust voice announcement volume
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="visual-settings">
          <h2 id="visual-settings" className="text-xl font-semibold mb-4">
            Visual Preferences
          </h2>
          
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.highContrastMode}
                onChange={() => toggleSetting('highContrastMode')}
                className="w-4 h-4"
              />
              <span>High Contrast Mode</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.largeText}
                onChange={() => toggleSetting('largeText')}
                className="w-4 h-4"
              />
              <span>Large Text</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={() => toggleSetting('reducedMotion')}
                className="w-4 h-4"
              />
              <span>Reduced Motion</span>
            </label>
          </div>
        </section>

        <section aria-labelledby="navigation-settings">
          <h2 id="navigation-settings" className="text-xl font-semibold mb-4">
            Navigation
          </h2>
          
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.screenReaderMode}
                onChange={() => toggleSetting('screenReaderMode')}
                className="w-4 h-4"
              />
              <span>Screen Reader Optimized</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.keyboardNavigationHelp}
                onChange={() => toggleSetting('keyboardNavigationHelp')}
                className="w-4 h-4"
              />
              <span>Keyboard Navigation Help</span>
            </label>
          </div>
        </section>

        <section aria-labelledby="shortcuts-info">
          <h2 id="shortcuts-info" className="text-xl font-semibold mb-4">
            Keyboard Shortcuts
          </h2>
          
          <div className="bg-gray-50 p-4 rounded-md">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt><kbd className="px-2 py-1 bg-gray-200 rounded">Alt + V</kbd></dt>
                <dd>Toggle voice navigation</dd>
              </div>
              <div className="flex justify-between">
                <dt><kbd className="px-2 py-1 bg-gray-200 rounded">Alt + H</kbd></dt>
                <dd>Voice help</dd>
              </div>
              <div className="flex justify-between">
                <dt><kbd className="px-2 py-1 bg-gray-200 rounded">Alt + M</kbd></dt>
                <dd>Skip to main content</dd>
              </div>
              <div className="flex justify-between">
                <dt><kbd className="px-2 py-1 bg-gray-200 rounded">Escape</kbd></dt>
                <dd>Stop all voice operations</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="flex space-x-4 pt-6">
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            aria-describedby="save-desc"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
          
          <button
            onClick={resetSettings}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            aria-describedby="reset-desc"
          >
            Reset to Defaults
          </button>
        </div>

        <div className="text-sm text-gray-600">
          <p id="save-desc">Save your accessibility preferences to local storage.</p>
          <p id="reset-desc">Reset all settings to their default values.</p>
        </div>
      </div>
    </div>
  );
}
