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
  FileText
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job creation form...</p>
        </div>
      </div>
    );
  }

  // Voice instructions step
  if (step === 'voice') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Voice Instructions</h2>
          
          {voiceRecording ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium text-emerald-800">Recording Complete</span>
                </div>
                <p className="text-sm text-gray-700 mb-4">{voiceRecording.transcript}</p>
                
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
            <div className="text-center">
              <VoiceCommandButton
                onTranscript={handleVoiceRecordingComplete}
                size="lg"
                className="mx-auto mb-4"
              />
              <p className="text-gray-600 text-sm">
                Record voice instructions for the crew
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Include special requirements, hazards, or customer preferences
              </p>
            </div>
          )}

          <div className="mt-6">
            <ButtonLimiter
              actions={actions}
              maxVisibleButtons={4}
              showVoiceButton={false}
              className="justify-center"
            />
          </div>
        </div>
      </div>
    );
  }

  // Equipment selection step
  if (step === 'equipment') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Required Equipment</h2>
          
          <div className="space-y-3">
            {equipment.map(item => (
              <div
                key={item.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  formData.requiredEquipmentIds.includes(item.id)
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleEquipmentToggle(item.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600 capitalize">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.available && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                        Unavailable
                      </span>
                    )}
                    {formData.requiredEquipmentIds.includes(item.id) && (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <ButtonLimiter
              actions={actions}
              maxVisibleButtons={4}
              showVoiceButton={false}
              className="justify-center"
            />
          </div>
        </div>
      </div>
    );
  }

  // Main form view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Create New Job</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer & Property */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer & Property</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                  </label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                    <p className="text-red-600 text-sm mt-1">{validationErrors.customerId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Property *
                  </label>
                  <select
                    value={formData.propertyId}
                    onChange={(e) => setFormData(prev => ({ ...prev, propertyId: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                    <p className="text-red-600 text-sm mt-1">{validationErrors.propertyId}</p>
                  )}
                </div>
              </div>

              {getSelectedCustomer() && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">{getSelectedCustomer()!.name}</p>
                      <p className="text-sm text-gray-600">{getSelectedCustomer()!.address}</p>
                      <p className="text-sm text-gray-600">{getSelectedCustomer()!.phone}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Schedule */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                  {validationErrors.scheduledDate && (
                    <p className="text-red-600 text-sm mt-1">{validationErrors.scheduledDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time *
                  </label>
                  <input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  {validationErrors.scheduledTime && (
                    <p className="text-red-600 text-sm mt-1">{validationErrors.scheduledTime}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Job Template */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Template (Optional)</h2>
              
              <select
                value={formData.templateId}
                onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Special Instructions</h2>
              
              <textarea
                value={formData.specialInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                placeholder="Any special instructions or notes for the crew..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                rows={4}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              <ButtonLimiter
                actions={actions}
                maxVisibleButtons={4}
                showVoiceButton={false}
                layout="grid"
                className="w-full"
              />
            </div>

            {/* Voice Instructions Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Instructions</h3>
              {voiceRecording ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Recording saved</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <Mic className="w-5 h-5" />
                  <span className="text-sm">No recording</span>
                </div>
              )}
            </div>

            {/* Equipment Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Equipment</h3>
              {formData.requiredEquipmentIds.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    {formData.requiredEquipmentIds.length} items selected
                  </p>
                  <div className="space-y-1">
                    {formData.requiredEquipmentIds.slice(0, 3).map(id => {
                      const item = equipment.find(e => e.id === id);
                      return item ? (
                        <p key={id} className="text-xs text-gray-700">{item.name}</p>
                      ) : null;
                    })}
                    {formData.requiredEquipmentIds.length > 3 && (
                      <p className="text-xs text-gray-500">
                        +{formData.requiredEquipmentIds.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No equipment selected</p>
              )}
            </div>

            {/* Validation Errors */}
            {Object.keys(validationErrors).length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-800">Form Errors</span>
                </div>
                <ul className="text-sm text-red-700 space-y-1">
                  {Object.values(validationErrors).map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}