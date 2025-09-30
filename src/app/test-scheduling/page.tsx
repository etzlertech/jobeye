'use client';

/**
 * Simple Scheduling Test UI
 *
 * Interactive web interface for testing scheduling operations
 * No authentication required - uses service role for testing
 */

import { useState, useEffect } from 'react';

interface DayPlan {
  id: string;
  plan_date: string;
  status: string;
  user_id: string;
  created_at: string;
}

interface ScheduleEvent {
  id: string;
  event_type: string;
  job_id: string | null;
  sequence_order: number;
  scheduled_start: string;
  scheduled_duration_minutes: number;
  status: string;
  address: string | null;
}

export default function SchedulingTestPage() {
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<DayPlan | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [newPlanDate, setNewPlanDate] = useState('');
  const [newJobAddress, setNewJobAddress] = useState('');
  const [newJobDuration, setNewJobDuration] = useState('60');

  // Load day plans on mount
  useEffect(() => {
    loadDayPlans();
  }, []);

  // Load events when plan selected
  useEffect(() => {
    if (selectedPlan) {
      loadEvents(selectedPlan.id);
    }
  }, [selectedPlan]);

  const showMessage = (msg: string, isError = false) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  const loadDayPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/scheduling/day-plans?limit=20');
      const data = await response.json();

      if (Array.isArray(data)) {
        setDayPlans(data);
      } else if (data.plans) {
        setDayPlans(data.plans);
      }
    } catch (error: any) {
      showMessage(`Error loading plans: ${error.message}`, true);
    }
    setLoading(false);
  };

  const loadEvents = async (planId: string) => {
    try {
      const response = await fetch(`/api/scheduling/schedule-events?day_plan_id=${planId}`);
      const data = await response.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (error: any) {
      showMessage(`Error loading events: ${error.message}`, true);
    }
  };

  const createDayPlan = async () => {
    if (!newPlanDate) {
      showMessage('Please enter a date', true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/scheduling/day-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          user_id: '123e4567-e89b-12d3-a456-426614174000',
          plan_date: newPlanDate,
          schedule_events: []
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create plan');
      }

      const data = await response.json();
      showMessage(`✅ Day plan created for ${newPlanDate}`);
      setNewPlanDate('');
      loadDayPlans();
    } catch (error: any) {
      showMessage(`❌ Error: ${error.message}`, true);
    }
    setLoading(false);
  };

  const addJob = async () => {
    if (!selectedPlan) {
      showMessage('Please select a day plan first', true);
      return;
    }

    if (!newJobAddress) {
      showMessage('Please enter a job address', true);
      return;
    }

    setLoading(true);
    try {
      // Get current event count
      const currentCount = events.filter(e => e.event_type === 'job').length;

      if (currentCount >= 6) {
        showMessage('❌ Cannot add job: 6-job limit reached', true);
        setLoading(false);
        return;
      }

      const response = await fetch('/api/scheduling/schedule-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          day_plan_id: selectedPlan.id,
          event_type: 'job',
          job_id: `test-job-${Date.now()}`,
          sequence_order: events.length + 1,
          scheduled_start: new Date().toISOString(),
          scheduled_duration_minutes: parseInt(newJobDuration),
          address: newJobAddress,
          status: 'pending'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add job');
      }

      showMessage(`✅ Job added: ${newJobAddress}`);
      setNewJobAddress('');
      loadEvents(selectedPlan.id);
    } catch (error: any) {
      showMessage(`❌ Error: ${error.message}`, true);
    }
    setLoading(false);
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Delete this day plan and all its events?')) return;

    setLoading(true);
    try {
      // Note: Delete endpoint would need to be created
      // For now, we'll just show a message
      showMessage('Delete functionality pending - use database cleanup', true);
    } catch (error: any) {
      showMessage(`❌ Error: ${error.message}`, true);
    }
    setLoading(false);
  };

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🗓️ Scheduling Test UI
          </h1>
          <p className="text-gray-600">
            Interactive testing interface for scheduling operations
          </p>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('❌') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Day Plans */}
          <div className="space-y-6">
            {/* Create Day Plan */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Create Day Plan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plan Date
                  </label>
                  <input
                    type="date"
                    value={newPlanDate}
                    onChange={(e) => setNewPlanDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => setNewPlanDate(getTomorrowDate())}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Use tomorrow
                  </button>
                </div>
                <button
                  onClick={createDayPlan}
                  disabled={loading || !newPlanDate}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Day Plan'}
                </button>
              </div>
            </div>

            {/* Day Plans List */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Day Plans</h2>
                <button
                  onClick={loadDayPlans}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  🔄 Refresh
                </button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : dayPlans.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No day plans yet. Create one above!
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dayPlans.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedPlan?.id === plan.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">
                            {new Date(plan.plan_date).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {plan.status}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {plan.id.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Events */}
          <div className="space-y-6">
            {/* Add Job */}
            {selectedPlan && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">
                  Add Job to {new Date(selectedPlan.plan_date).toLocaleDateString()}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Job Address
                    </label>
                    <input
                      type="text"
                      value={newJobAddress}
                      onChange={(e) => setNewJobAddress(e.target.value)}
                      placeholder="123 Main Street"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={newJobDuration}
                      onChange={(e) => setNewJobDuration(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={addJob}
                    disabled={loading || !newJobAddress}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Adding...' : 'Add Job'}
                  </button>
                  <div className="text-sm text-gray-600">
                    {events.filter(e => e.event_type === 'job').length}/6 jobs scheduled
                  </div>
                </div>
              </div>
            )}

            {/* Events List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                {selectedPlan ? 'Schedule Events' : 'Select a Day Plan'}
              </h2>

              {!selectedPlan ? (
                <div className="text-center py-8 text-gray-500">
                  ← Select a day plan to view its events
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No events scheduled yet. Add a job above!
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map((event, index) => (
                    <div
                      key={event.id}
                      className="p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-gray-900">
                              #{event.sequence_order}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              event.event_type === 'job'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {event.event_type}
                            </span>
                          </div>
                          {event.address && (
                            <div className="text-sm text-gray-900 mt-1">
                              📍 {event.address}
                            </div>
                          )}
                          <div className="text-sm text-gray-500 mt-1">
                            ⏱️ {event.scheduled_duration_minutes} minutes
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(event.scheduled_start).toLocaleTimeString()}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          event.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : event.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {event.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 p-6 bg-white rounded-lg shadow">
          <h3 className="font-semibold mb-2">Quick Actions</h3>
          <div className="flex gap-4">
            <button
              onClick={loadDayPlans}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              🔄 Refresh All
            </button>
            <button
              onClick={() => {
                setSelectedPlan(null);
                setEvents([]);
                setNewPlanDate('');
                setNewJobAddress('');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              🗑️ Clear Selection
            </button>
            <a
              href="/api/scheduling/day-plans"
              target="_blank"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              📊 View API
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}