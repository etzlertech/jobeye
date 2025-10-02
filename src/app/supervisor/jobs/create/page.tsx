/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/supervisor/jobs/create/page.tsx
 * phase: 3
 * domain: supervisor
 * purpose: Job creation page with voice instructions and equipment assignment
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-ui.md
 * complexity_budget: 400
 * migrations_touched: []
 * state_machine: {
 *   states: ['form_view', 'voice_recording', 'equipment_selection', 'crew_assignment', 'confirmation'],
 *   transitions: [
 *     'form_view->voice_recording: recordVoiceInstructions()',
 *     'form_view->equipment_selection: selectEquipment()',
 *     'form_view->crew_assignment: assignCrew()',
 *     'form_view->confirmation: submitJob()',
 *     'confirmation->form_view: editJob()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "voiceInstructions": "$0.02-0.05 per recording (STT)",
 *   "equipmentSuggestions": "$0.01-0.02 (LLM)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/components/ui/ButtonLimiter',
 *     '@/components/voice/VoiceCommandButton',
 *     '@/domains/supervisor/services/supervisor-workflow.service'
 *   ],
 *   external: ['react', 'next/navigation'],
 *   supabase: ['jobs', 'customers', 'properties', 'crews', 'equipment']
 * }
 * exports: ['default']
 * voice_considerations: Voice instructions recorded and stored for crew playback
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/supervisor-job-creation-flow.test.ts'
 * }
 * tasks: [
 *   'Create job creation form with customer/property selection',
 *   'Add voice instruction recording capability',
 *   'Implement equipment requirement selection',
 *   'Add crew assignment with daily limit validation'
 * ]
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Package,
  Mic,
  Save,
  Send,
  Play,
  Stop,
  Trash,
  AlertTriangle,
  CheckCircle,
  MapPin,
  FileText,
  Loader2
} from 'lucide-react';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';
import { VoiceCommandButton } from '@/components/voice/VoiceCommandButton';

interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
}

interface Property {
  id: string;
  customerId: string;
  address: string;
  propertyType: string;
  notes?: string;
}

interface Crew {
  id: string;
  name: string;
  members: string[];
  currentJobs: number;
  jobsRemaining: number;
  available: boolean;
}

interface Equipment {
  id: string;
  name: string;
  category: string;
  available: boolean;
  inUse: boolean;
}

interface JobTemplate {
  id: string;
  name: string;
  category: string;
  estimatedDuration: number;
  requiredEquipment: string[];
  instructions: string;
}

interface VoiceRecording {
  id: string;
  audioUrl: string;
  transcript: string;
  duration: number;
}

export default function SupervisorJobCreatePage() {
  const router = useRouter();
  const { actions, addAction, clearActions } = useButtonActions();

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    propertyId: '',
    templateId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '09:00',
    specialInstructions: '',
    assignedCrewIds: [] as string[],
    requiredEquipmentIds: [] as string[]
  });

  // Data lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [templates, setTemplates] = useState<JobTemplate[]>([]);

  // Voice state
  const [voiceRecording, setVoiceRecording] = useState<VoiceRecording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'form' | 'voice' | 'equipment' | 'crew' | 'review'>('form');

  // Setup button actions
  useEffect(() => {
    clearActions();

    if (step === 'form') {
      addAction({
        id: 'save-draft',
        label: 'Save Draft',
        priority: 'medium',
        icon: Save,
        onClick: handleSaveDraft,
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });

      addAction({
        id: 'voice-instructions',
        label: 'Voice Instructions',
        priority: 'high',
        icon: Mic,
        onClick: () => setStep('voice'),
        className: 'bg-blue-600 text-white hover:bg-blue-700'
      });

      addAction({
        id: 'equipment',
        label: 'Equipment',
        priority: 'high',
        icon: Package,
        onClick: () => setStep('equipment'),
        className: 'bg-purple-600 text-white hover:bg-purple-700'
      });

      addAction({
        id: 'create-job',
        label: 'Create Job',
        priority: 'critical',
        icon: Send,
        onClick: handleCreateJob,
        className: 'bg-emerald-600 text-white hover:bg-emerald-700',
        disabled: !isFormValid()
      });
    } else {
      addAction({
        id: 'back',
        label: 'Back',
        priority: 'high',
        icon: ArrowLeft,
        onClick: () => setStep('form'),
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });
    }
  }, [step, formData, clearActions, addAction]);

  // Load initial data
  useEffect(() => {
    loadFormData();
  }, []);

  // Filter properties when customer changes
  useEffect(() => {
    if (formData.customerId) {
      setFormData(prev => ({ ...prev, propertyId: '' }));
    }
  }, [formData.customerId]);

  const loadFormData = async () => {
    setIsLoading(true);
    
    try {
      // Load customers, crews, equipment, templates in parallel
      const [customersRes, crewsRes, equipmentRes, templatesRes] = await Promise.all([
        fetch('/api/supervisor/customers'),
        fetch('/api/supervisor/crews'),
        fetch('/api/supervisor/equipment'),
        fetch('/api/supervisor/job-templates')
      ]);

      const [customersData, crewsData, equipmentData, templatesData] = await Promise.all([
        customersRes.json(),
        crewsRes.json(),
        equipmentRes.json(),
        templatesRes.json()
      ]);

      setCustomers(customersData.customers || []);
      setCrews(crewsData.crews || []);
      setEquipment(equipmentData.equipment || []);
      setTemplates(templatesData.templates || []);

      // Load properties for all customers
      const propertiesRes = await fetch('/api/supervisor/properties');
      const propertiesData = await propertiesRes.json();
      setProperties(propertiesData.properties || []);

    } catch (error) {
      console.error('Failed to load form data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    
    try {
      const jobData = {
        ...formData,
        voiceInstructions: voiceRecording?.transcript,
        voiceInstructionsAudioUrl: voiceRecording?.audioUrl,
        requiredEquipment: formData.requiredEquipmentIds
      };

      const response = await fetch('/api/supervisor/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData)
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/supervisor/jobs/${result.data.id}`);
      } else {
        setValidationErrors({ submit: result.message });
      }
    } catch (error) {
      setValidationErrors({ submit: 'Failed to create job' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    // Save to localStorage for now
    localStorage.setItem('job-draft', JSON.stringify({
      ...formData,
      voiceRecording,
      timestamp: Date.now()
    }));
  };

  const handleVoiceRecordingComplete = (transcript: string, audioUrl: string) => {
    setVoiceRecording({
      id: `voice-${Date.now()}`,
      audioUrl,
      transcript,
      duration: 0 // Would be calculated from audio
    });
    setIsRecording(false);
  };

  const handleEquipmentToggle = (equipmentId: string) => {
    setFormData(prev => ({
      ...prev,
      requiredEquipmentIds: prev.requiredEquipmentIds.includes(equipmentId)
        ? prev.requiredEquipmentIds.filter(id => id !== equipmentId)
        : [...prev.requiredEquipmentIds, equipmentId]
    }));
  };

  const handleCrewToggle = (crewId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedCrewIds: prev.assignedCrewIds.includes(crewId)
        ? prev.assignedCrewIds.filter(id => id !== crewId)
        : [...prev.assignedCrewIds, crewId]
    }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.customerId) errors.customerId = 'Customer is required';
    if (!formData.propertyId) errors.propertyId = 'Property is required';
    if (!formData.scheduledDate) errors.scheduledDate = 'Date is required';
    if (!formData.scheduledTime) errors.scheduledTime = 'Time is required';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = (): boolean => {
    return !!(formData.customerId && formData.propertyId && formData.scheduledDate && formData.scheduledTime);
  };

  const getFilteredProperties = (): Property[] => {
    return properties.filter(prop => prop.customerId === formData.customerId);
  };

  const getSelectedCustomer = (): Customer | undefined => {
    return customers.find(c => c.id === formData.customerId);
  };

  const getSelectedProperty = (): Property | undefined => {
    return properties.find(p => p.id === formData.propertyId);
  };

  if (isLoading) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-golden mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading job creation form...</p>
        </div>
      </div>
    );
  }

  // Voice instructions step
  if (step === 'voice') {
    return (
      <div className="mobile-container">
        {/* Mobile Navigation */}
        <MobileNavigation 
          currentRole="supervisor" 
          onLogout={() => router.push('/sign-in')}
          showBackButton={true}
          onBack={() => setStep('form')}
        />
        
        <div className="header-bar">
          <div>
            <h1 className="text-xl font-semibold">Voice Instructions</h1>
          </div>
          <Mic className="w-6 h-6 text-golden" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {voiceRecording ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-900 bg-opacity-20 border border-emerald-600 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="font-medium text-emerald-300">Recording Complete</span>
                </div>
                <p className="text-sm text-gray-300 mb-4">{voiceRecording.transcript}</p>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (voiceRecording.audioUrl) {
                        const audio = new Audio(voiceRecording.audioUrl);
                        audio.play();
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Play className="w-4 h-4" />
                    Play
                  </button>
                  <button
                    onClick={() => setVoiceRecording(null)}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    <Trash className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <VoiceCommandButton
                onTranscript={handleVoiceRecordingComplete}
                size="lg"
                className="mx-auto mb-4"
              />
              <p className="text-gray-400 text-sm">
                Record voice instructions for the crew
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Include special requirements, hazards, or customer preferences
              </p>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="bottom-actions">
          <ButtonLimiter
            actions={actions}
            maxVisibleButtons={4}
            showVoiceButton={false}
            className="w-full"
            layout="grid"
          />
        </div>
      </div>
    );
  }

  // Equipment selection step
  if (step === 'equipment') {
    return (
      <div className="mobile-container">
        {/* Mobile Navigation */}
        <MobileNavigation 
          currentRole="supervisor" 
          onLogout={() => router.push('/sign-in')}
          showBackButton={true}
          onBack={() => setStep('form')}
        />
        
        <div className="header-bar">
          <div>
            <h1 className="text-xl font-semibold">Required Equipment</h1>
          </div>
          <Package className="w-6 h-6 text-golden" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            {equipment.map(item => (
              <div
                key={item.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  formData.requiredEquipmentIds.includes(item.id)
                    ? 'border-golden bg-golden bg-opacity-20'
                    : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                }`}
                onClick={() => handleEquipmentToggle(item.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{item.name}</h3>
                    <p className="text-sm text-gray-400 capitalize">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.available && (
                      <span className="px-2 py-1 bg-red-600 bg-opacity-20 border border-red-500 text-red-400 text-xs rounded">
                        Unavailable
                      </span>
                    )}
                    {formData.requiredEquipmentIds.includes(item.id) && (
                      <CheckCircle className="w-5 h-5 text-golden" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="bottom-actions">
          <ButtonLimiter
            actions={actions}
            maxVisibleButtons={4}
            showVoiceButton={false}
            className="w-full"
            layout="grid"
          />
        </div>
      </div>
    );
  }

  // Main form view
  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation 
        currentRole="supervisor" 
        onLogout={() => router.push('/sign-in')}
        showBackButton={true}
        backTo="/supervisor"
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">Create New Job</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-6">
            {/* Customer & Property */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Customer & Property</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Customer *
                  </label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))}
                    className="w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
                    required
                  >
                    <option value="">Select customer...</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  {validationErrors.customerId && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.customerId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Property *
                  </label>
                  <select
                    value={formData.propertyId}
                    onChange={(e) => setFormData(prev => ({ ...prev, propertyId: e.target.value }))}
                    className="w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden disabled:opacity-50"
                    disabled={!formData.customerId}
                    required
                  >
                    <option value="">Select property...</option>
                    {getFilteredProperties().map(property => (
                      <option key={property.id} value={property.id}>
                        {property.address}
                      </option>
                    ))}
                  </select>
                  {validationErrors.propertyId && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.propertyId}</p>
                  )}
                </div>
              </div>

              {getSelectedCustomer() && (
                <div className="mt-4 p-3 bg-gray-900 bg-opacity-50 border border-gray-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-golden mt-0.5" />
                    <div>
                      <p className="font-medium text-white">{getSelectedCustomer()!.name}</p>
                      <p className="text-sm text-gray-400">{getSelectedCustomer()!.address}</p>
                      <p className="text-sm text-gray-400">{getSelectedCustomer()!.phone}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Schedule */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Schedule</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                  {validationErrors.scheduledDate && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.scheduledDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Time *
                  </label>
                  <input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                    className="w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
                    required
                  />
                  {validationErrors.scheduledTime && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.scheduledTime}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Job Template */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Job Template (Optional)</h2>
              
              <select
                value={formData.templateId}
                onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                className="w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
              >
                <option value="">No template</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Special Instructions */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Special Instructions</h2>
              
              <textarea
                value={formData.specialInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                placeholder="Any special instructions or notes for the crew..."
                className="w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-golden focus:border-golden"
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="bottom-actions">
          <ButtonLimiter
            actions={actions}
            maxVisibleButtons={4}
            showVoiceButton={false}
            layout="grid"
            className="w-full"
          />
        </div>

        {/* Mobile Styling */}
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .header-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem;
            border-bottom: 1px solid #333;
            background: rgba(0, 0, 0, 0.9);
          }

          .bottom-actions {
            display: flex;
            gap: 0.75rem;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.9);
            border-top: 1px solid #333;
          }

          .golden { color: #FFD700; }
        `}</style>
    </div>
  );
}