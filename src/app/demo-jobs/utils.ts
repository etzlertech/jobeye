/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-jobs/utils.ts
phase: dev-crud
domain: supervisor
purpose: Utility functions for job management
spec_ref: DEV_CRUD_PORT_PLAN.md
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
  notes: string;
}

export function buildJobPayload(form: JobFormState) {
  return {
    customer_id: form.customerId,
    property_id: form.propertyId || null,
    title: form.title.trim(),
    description: form.description.trim(),
    scheduled_date: form.scheduledDate,
    scheduled_time: form.scheduledTime || null,
    priority: form.priority,
    notes: form.notes.trim() || null,
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

export function formatJobDateTime(date: string | null, time: string | null): string {
  if (!date) return 'Not scheduled';
  
  const dateObj = new Date(date);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  
  if (!time) return formattedDate;
  
  // Parse time (HH:MM:SS or HH:MM format)
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  
  return `${formattedDate} at ${displayHour}:${minutes} ${ampm}`;
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