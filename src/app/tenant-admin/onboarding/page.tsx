/**
 * @file /src/app/tenant-admin/onboarding/page.tsx
 * @phase 3.4.1
 * @domain tenant-admin
 * @purpose Multi-step tenant onboarding wizard
 * @spec_ref docs/admin-ui-specs.md#tenant-onboarding-review
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ADMIN_CARD_CLASSES, ADMIN_CARD_ITEM_CLASSES } from '@/app/admin/_constants/admin-ui-constants';
import {
  Building2,
  Users,
  Zap,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  AlertCircle,
  FileText,
  Loader2,
  Check
} from 'lucide-react';

type OnboardingStep = 'company' | 'users' | 'integrations' | 'review';

interface CompanyDetails {
  name: string;
  domain: string;
  industry: string;
  size: string;
  address: string;
  phone: string;
  taxId?: string;
  documents: File[];
}

interface InitialUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'crew';
}

interface IntegrationConfig {
  voiceEnabled: boolean;
  visionEnabled: boolean;
  webhookUrl?: string;
  apiKey?: string;
}

const STEPS: Array<{ id: OnboardingStep; label: string; icon: any }> = [
  { id: 'company', label: 'Company Details', icon: Building2 },
  { id: 'users', label: 'Initial Users', icon: Users },
  { id: 'integrations', label: 'Integrations', icon: Zap },
  { id: 'review', label: 'Review & Submit', icon: CheckCircle2 }
];

export default function TenantOnboardingPage() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('company');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'pending' | 'submitted' | null>(null);
  
  // Form state
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails>({
    name: 'GreenWorks Landscaping',
    domain: 'greenworks.land',
    industry: 'Landscaping',
    size: '10-50',
    address: '123 Main St, Seattle, WA 98101',
    phone: '+1 (206) 555-0123',
    documents: []
  });

  const [initialUsers, setInitialUsers] = useState<InitialUser[]>([
    { id: '1', email: 'sarah@greenworks.land', name: 'Sarah Johnson', role: 'admin' },
    { id: '2', email: 'mike@greenworks.land', name: 'Mike Torres', role: 'supervisor' }
  ]);

  const [integrations, setIntegrations] = useState<IntegrationConfig>({
    voiceEnabled: true,
    visionEnabled: false,
    webhookUrl: '',
    apiKey: ''
  });

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setSubmissionStatus('submitted');
  };

  const addUser = () => {
    const newUser: InitialUser = {
      id: Date.now().toString(),
      email: '',
      name: '',
      role: 'crew'
    };
    setInitialUsers([...initialUsers, newUser]);
  };

  const updateUser = (id: string, field: keyof InitialUser, value: string) => {
    setInitialUsers(users =>
      users.map(user =>
        user.id === id ? { ...user, [field]: value } : user
      )
    );
  };

  const removeUser = (id: string) => {
    setInitialUsers(users => users.filter(user => user.id !== id));
  };

  if (submissionStatus === 'submitted') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className={ADMIN_CARD_CLASSES}>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-white">
              Onboarding Submitted Successfully
            </h3>
            <p className="mb-6 text-sm text-slate-400">
              Your application has been submitted and is pending review by our admin team.
              You'll receive an email notification once your account is approved.
            </p>
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <p className="text-sm text-slate-300">
                <strong>Status:</strong> Pending Review
              </p>
              <p className="text-sm text-slate-300">
                <strong>Submitted:</strong> {new Date().toLocaleString()}
              </p>
              <p className="text-sm text-slate-300">
                <strong>Reference:</strong> ONB-{Date.now()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section>
        <h2 className="text-2xl font-semibold text-white">Tenant Onboarding</h2>
        <p className="text-sm text-slate-400">
          Complete your organization setup to get started with JobEye.
        </p>
      </section>

      {/* Progress Bar */}
      <Card className={ADMIN_CARD_CLASSES}>
        <CardContent className="py-6">
          <div className="mb-4 flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;
              
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        isActive
                          ? 'bg-blue-500 text-white'
                          : isCompleted
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={`text-xs ${
                      isActive ? 'text-white font-medium' : 'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className="mb-6 h-px flex-1 bg-slate-700" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card className={ADMIN_CARD_CLASSES}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            {(() => {
              const StepIcon = STEPS[currentStepIndex].icon;
              return <StepIcon className="h-5 w-5" />;
            })()}
            {STEPS[currentStepIndex].label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Details Step */}
          {currentStep === 'company' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Company Name
                  </label>
                  <Input
                    value={companyDetails.name}
                    onChange={(e) => setCompanyDetails({ ...companyDetails, name: e.target.value })}
                    className="border-slate-700 bg-slate-900 text-white"
                    placeholder="Your Company Name"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Domain
                  </label>
                  <Input
                    value={companyDetails.domain}
                    onChange={(e) => setCompanyDetails({ ...companyDetails, domain: e.target.value })}
                    className="border-slate-700 bg-slate-900 text-white"
                    placeholder="company.com"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Industry
                  </label>
                  <select
                    value={companyDetails.industry}
                    onChange={(e) => setCompanyDetails({ ...companyDetails, industry: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  >
                    <option value="Landscaping">Landscaping</option>
                    <option value="Construction">Construction</option>
                    <option value="Property Management">Property Management</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Company Size
                  </label>
                  <select
                    value={companyDetails.size}
                    onChange={(e) => setCompanyDetails({ ...companyDetails, size: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  >
                    <option value="1-10">1-10 employees</option>
                    <option value="10-50">10-50 employees</option>
                    <option value="50-100">50-100 employees</option>
                    <option value="100+">100+ employees</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Business Address
                </label>
                <Input
                  value={companyDetails.address}
                  onChange={(e) => setCompanyDetails({ ...companyDetails, address: e.target.value })}
                  className="border-slate-700 bg-slate-900 text-white"
                  placeholder="123 Main St, City, State ZIP"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Phone Number
                  </label>
                  <Input
                    value={companyDetails.phone}
                    onChange={(e) => setCompanyDetails({ ...companyDetails, phone: e.target.value })}
                    className="border-slate-700 bg-slate-900 text-white"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Tax ID (Optional)
                  </label>
                  <Input
                    value={companyDetails.taxId}
                    onChange={(e) => setCompanyDetails({ ...companyDetails, taxId: e.target.value })}
                    className="border-slate-700 bg-slate-900 text-white"
                    placeholder="XX-XXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Verification Documents (Optional)
                </label>
                <div className="rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/50 p-6 text-center">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-slate-500" />
                  <p className="text-sm text-slate-400">
                    Drop business license or incorporation documents here
                  </p>
                  <Button variant="outline" size="sm" className="mt-3">
                    <FileText className="mr-2 h-3.5 w-3.5" />
                    Choose Files
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Initial Users Step */}
          {currentStep === 'users' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-blue-400" />
                  <div className="text-sm text-blue-300">
                    <p className="font-medium">Initial User Setup</p>
                    <p className="mt-1 text-blue-300/80">
                      Add the key users who will help manage your organization. You can add more users later.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {initialUsers.map((user, index) => (
                  <div key={user.id} className={ADMIN_CARD_ITEM_CLASSES}>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-medium text-slate-300">
                        {user.name ? user.name.charAt(0).toUpperCase() : index + 1}
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-xs text-slate-400">Name</label>
                            <Input
                              value={user.name}
                              onChange={(e) => updateUser(user.id, 'name', e.target.value)}
                              className="h-9 border-slate-700 bg-slate-900 text-white"
                              placeholder="Full Name"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-400">Email</label>
                            <Input
                              value={user.email}
                              onChange={(e) => updateUser(user.id, 'email', e.target.value)}
                              className="h-9 border-slate-700 bg-slate-900 text-white"
                              placeholder="user@company.com"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-400">Role</label>
                            <select
                              value={user.role}
                              onChange={(e) => updateUser(user.id, 'role', e.target.value as any)}
                              className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                            >
                              <option value="admin">Admin</option>
                              <option value="supervisor">Supervisor</option>
                              <option value="crew">Crew</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      {initialUsers.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUser(user.id)}
                          className="text-slate-400 hover:text-red-400"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={addUser}
                className="border-slate-700 text-slate-200"
              >
                <Users className="mr-2 h-3.5 w-3.5" />
                Add Another User
              </Button>
            </div>
          )}

          {/* Integrations Step */}
          {currentStep === 'integrations' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Optional Integrations</h3>
                <p className="text-sm text-slate-400">
                  Enable integrations to enhance your JobEye experience. You can configure these later.
                </p>
              </div>

              <div className="space-y-4">
                <div className={ADMIN_CARD_ITEM_CLASSES}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <input
                          type="checkbox"
                          id="voice"
                          checked={integrations.voiceEnabled}
                          onChange={(e) => setIntegrations({ ...integrations, voiceEnabled: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                        />
                      </div>
                      <div>
                        <label htmlFor="voice" className="block font-medium text-white">
                          Voice Commands
                        </label>
                        <p className="mt-1 text-sm text-slate-400">
                          Enable hands-free operation with voice commands for field crews
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/10 text-green-300">Recommended</Badge>
                  </div>
                </div>

                <div className={ADMIN_CARD_ITEM_CLASSES}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <input
                        type="checkbox"
                        id="vision"
                        checked={integrations.visionEnabled}
                        onChange={(e) => setIntegrations({ ...integrations, visionEnabled: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="vision" className="block font-medium text-white">
                        Vision Analysis
                      </label>
                      <p className="mt-1 text-sm text-slate-400">
                        AI-powered image analysis for job verification and inventory
                      </p>
                    </div>
                  </div>
                </div>

                <Separator className="bg-slate-700" />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-white">Advanced Configuration</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Webhook URL (Optional)
                      </label>
                      <Input
                        value={integrations.webhookUrl}
                        onChange={(e) => setIntegrations({ ...integrations, webhookUrl: e.target.value })}
                        className="border-slate-700 bg-slate-900 text-white"
                        placeholder="https://your-domain.com/webhook"
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        Receive real-time updates for job events
                      </p>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        API Key (Optional)
                      </label>
                      <Input
                        value={integrations.apiKey}
                        onChange={(e) => setIntegrations({ ...integrations, apiKey: e.target.value })}
                        className="border-slate-700 bg-slate-900 text-white"
                        placeholder="Your existing API key"
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        If you have an existing API key from a previous integration
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
                  <div className="text-sm text-green-300">
                    <p className="font-medium">Ready to Submit</p>
                    <p className="mt-1 text-green-300/80">
                      Review your information below. You can make changes after submission if needed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Company Summary */}
              <div>
                <h4 className="mb-3 text-base font-medium text-white">Company Information</h4>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Company</span>
                    <span className="text-sm text-white">{companyDetails.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Domain</span>
                    <span className="text-sm text-white">{companyDetails.domain}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Industry</span>
                    <span className="text-sm text-white">{companyDetails.industry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Size</span>
                    <span className="text-sm text-white">{companyDetails.size} employees</span>
                  </div>
                </div>
              </div>

              {/* Users Summary */}
              <div>
                <h4 className="mb-3 text-base font-medium text-white">Initial Users ({initialUsers.length})</h4>
                <div className="space-y-2">
                  {initialUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div>
                        <p className="text-sm font-medium text-white">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                      <Badge className="bg-blue-500/10 text-blue-300">
                        {user.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integrations Summary */}
              <div>
                <h4 className="mb-3 text-base font-medium text-white">Integrations</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <span className="text-sm text-slate-300">Voice Commands</span>
                    <Badge className={integrations.voiceEnabled ? 'bg-green-500/10 text-green-300' : 'bg-slate-600/10 text-slate-400'}>
                      {integrations.voiceEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <span className="text-sm text-slate-300">Vision Analysis</span>
                    <Badge className={integrations.visionEnabled ? 'bg-green-500/10 text-green-300' : 'bg-slate-600/10 text-slate-400'}>
                      {integrations.visionEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  {integrations.webhookUrl && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <p className="text-xs text-slate-400">Webhook URL</p>
                      <p className="text-sm text-white truncate">{integrations.webhookUrl}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardContent>
          <Separator className="mb-6 bg-slate-700" />
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
              className="border-slate-700 text-slate-200"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            {currentStep === 'review' ? (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-blue-500 text-white hover:bg-blue-400"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Application
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleNext}
                className="bg-blue-500 text-white hover:bg-blue-400"
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}