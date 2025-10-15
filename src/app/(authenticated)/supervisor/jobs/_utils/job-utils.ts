/*
AGENT DIRECTIVE BLOCK
file: /src/app/(authenticated)/supervisor/jobs/_utils/job-utils.ts
phase: phase3-feature-007
domain: supervisor
purpose: Utility functions for job management (authenticated supervisors)
spec_ref: specs/007-integrate-job-creation-workflow
complexity_budget: 100
dependencies:
  internal: []
  external: []
voice_considerations:
  - Format job details for voice readback
*/

export interface JobFormState {
  customerId: string;
  propertyId: string;
  title: string;
  description: string;
  scheduledDate: string;
  scheduledTime: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export function buildJobPayload(form: JobFormState) {
  // Combine date and time into scheduled_start TIMESTAMPTZ for schema
  let scheduled_start = form.scheduledDate;
  if (form.scheduledTime) {
    scheduled_start = `${form.scheduledDate}T${form.scheduledTime}:00`;
  } else {
    scheduled_start = `${form.scheduledDate}T09:00:00`; // Default to 9 AM
  }

  return {
    customer_id: form.customerId,
    property_id: form.propertyId || null,
    title: form.title.trim(),
    description: form.description.trim() || null,
    scheduled_start: scheduled_start,
    priority: form.priority,
    status: 'scheduled'
  };
}

export function formatJobStatus(status: string): string {
  const statusMap: Record<string, string> = {
    draft: 'Draft',
    scheduled: 'Scheduled',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  return statusMap[status] || status;
}

export function formatJobPriority(priority: string): string {
  const priorityMap: Record<string, string> = {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent'
  };
  return priorityMap[priority] || priority;
}

export function formatJobDateTime(scheduledStart: string | null): string {
  if (!scheduledStart) return 'Not scheduled';

  const dateObj = new Date(scheduledStart);

  // Check if date is valid
  if (isNaN(dateObj.getTime())) return 'Invalid date';

  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const hours = dateObj.getHours();
  const minutes = dateObj.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');

  return `${formattedDate} at ${displayHour}:${displayMinutes} ${ampm}`;
}

export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    draft: 'text-gray-500',
    scheduled: 'text-blue-600',
    assigned: 'text-purple-600',
    in_progress: 'text-yellow-600',
    completed: 'text-green-600',
    cancelled: 'text-red-600'
  };
  return colorMap[status] || 'text-gray-600';
}

export function getPriorityColor(priority: string): string {
  const colorMap: Record<string, string> = {
    low: 'bg-gray-100 text-gray-700',
    normal: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700'
  };
  return colorMap[priority] || 'bg-gray-100 text-gray-700';
}
