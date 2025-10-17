/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/components/supervisor/CrewAssignmentSection.tsx
 * phase: 3
 * domain: supervisor-job-assignment
 * purpose: Crew assignment UI for supervisors
 * spec_ref: 010-job-assignment-and
 * complexity_budget: 250
 * task: T027
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Users, X, Plus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name?: string;
}

interface Assignment {
  user_id: string;
  user?: User;
}

interface CrewAssignmentSectionProps {
  jobId: string;
  currentAssignments: Assignment[];
  onAssignmentChange: () => void;
}

export function CrewAssignmentSection({
  jobId,
  currentAssignments,
  onAssignmentChange
}: CrewAssignmentSectionProps) {
  const [availableCrew, setAvailableCrew] = useState<User[]>([]);
  const [isLoadingCrew, setIsLoadingCrew] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load available crew members
  useEffect(() => {
    const loadCrew = async () => {
      setIsLoadingCrew(true);
      try {
        console.log('[CrewAssignmentSection] Fetching crew from /api/users?role=technician');
        const response = await fetch('/api/users?role=technician');
        console.log('[CrewAssignmentSection] Response status:', response.status, response.ok);

        if (!response.ok) throw new Error('Failed to load crew members');

        const data = await response.json();
        console.log('[CrewAssignmentSection] API response data:', data);
        console.log('[CrewAssignmentSection] data.users:', data.users);
        console.log('[CrewAssignmentSection] data.users length:', data.users?.length);

        setAvailableCrew(data.users || []);
      } catch (err) {
        console.error('[CrewAssignmentSection] Error loading crew:', err);
        setError('Failed to load crew members');
      } finally {
        setIsLoadingCrew(false);
      }
    };

    loadCrew();
  }, []);

  const handleAssign = async () => {
    if (selectedUserIds.length === 0) {
      setError('Please select at least one crew member');
      return;
    }

    setIsAssigning(true);
    setError(null);

    try {
      console.log('[CrewAssignmentSection] Assigning users:', selectedUserIds);
      console.log('[CrewAssignmentSection] Request body:', { user_ids: selectedUserIds });

      const response = await fetch(`/api/jobs/${jobId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: selectedUserIds })
      });

      const data = await response.json();
      console.log('[CrewAssignmentSection] Response:', { status: response.status, data });

      if (!response.ok) {
        console.error('[CrewAssignmentSection] Assignment failed:', data);
        throw new Error(data.message || data.error || 'Failed to assign crew');
      }

      setSuccess(`${selectedUserIds.length} crew member(s) assigned successfully`);
      setShowDropdown(false);
      setSelectedUserIds([]);
      setTimeout(() => setSuccess(null), 3000);

      // Notify parent to refresh
      onAssignmentChange();
    } catch (err: any) {
      setError(err.message || 'Failed to assign crew');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this crew member?')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/unassign?user_id=${userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to unassign crew');
      }

      setSuccess('Crew unassigned successfully');
      setTimeout(() => setSuccess(null), 3000);

      // Notify parent to refresh
      onAssignmentChange();
    } catch (err: any) {
      setError(err.message || 'Failed to unassign crew');
      setTimeout(() => setError(null), 5000);
    }
  };

  // Filter out already assigned crew
  const assignedUserIds = currentAssignments.map(a => a.user_id);
  const unassignedCrew = availableCrew.filter(user => !assignedUserIds.includes(user.id));

  // Debug logging
  console.log('[CrewAssignmentSection] availableCrew:', availableCrew.length);
  console.log('[CrewAssignmentSection] currentAssignments:', currentAssignments.length);
  console.log('[CrewAssignmentSection] unassignedCrew:', unassignedCrew.length);
  console.log('[CrewAssignmentSection] isLoadingCrew:', isLoadingCrew);
  console.log('[CrewAssignmentSection] Button disabled:', isLoadingCrew || unassignedCrew.length === 0);

  return (
    <div className="crew-assignment-section">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title">
          <Users className="w-5 h-5 inline-block mr-2" />
          Assigned Crew
        </h3>
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="btn-assign"
          disabled={isLoadingCrew || unassignedCrew.length === 0}
        >
          <Plus className="w-4 h-4 mr-1" />
          Assign Crew
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="notification error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="notification success">
          <CheckCircle className="w-4 h-4" />
          <span>{success}</span>
        </div>
      )}

      {/* Assignment Dropdown */}
      {showDropdown && (
        <div className="dropdown-container">
          <p className="select-label">Select crew members to assign:</p>
          <div className="crew-checkbox-list">
            {unassignedCrew.map(user => (
              <label key={user.id} className="crew-checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUserIds([...selectedUserIds, user.id]);
                    } else {
                      setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                    }
                  }}
                  disabled={isAssigning}
                  className="crew-checkbox"
                />
                <span className="crew-checkbox-label">
                  {user.full_name || user.email}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleAssign}
              disabled={isAssigning || selectedUserIds.length === 0}
              className="btn-primary flex-1"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Assigning...
                </>
              ) : (
                `Assign ${selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''}`
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDropdown(false);
                setSelectedUserIds([]);
              }}
              className="btn-secondary flex-1"
              disabled={isAssigning}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Current Assignments */}
      <div className="assignments-list">
        {currentAssignments.length === 0 ? (
          <p className="no-assignments">No crew assigned yet</p>
        ) : (
          currentAssignments.map((assignment) => (
            <div key={assignment.user_id} className="assignment-item">
              <div className="flex-1">
                <p className="crew-name">
                  {assignment.user?.full_name || assignment.user?.email || 'Unknown User'}
                </p>
                {assignment.user?.email && assignment.user?.full_name && (
                  <p className="crew-email">{assignment.user.email}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleUnassign(assignment.user_id)}
                className="btn-remove"
                title="Remove crew member"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .crew-assignment-section {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #FFD700;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
        }

        .btn-assign {
          display: flex;
          align-items: center;
          padding: 0.375rem 0.75rem;
          background: rgba(255, 215, 0, 0.2);
          color: #FFD700;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 0.375rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-assign:hover:not(:disabled) {
          background: rgba(255, 215, 0, 0.3);
        }

        .btn-assign:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .notification {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          margin-bottom: 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
        }

        .notification.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .notification.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
        }

        .dropdown-container {
          margin-bottom: 0.75rem;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.375rem;
        }

        .select-label {
          font-size: 0.875rem;
          color: #FFD700;
          margin: 0 0 0.75rem 0;
          font-weight: 600;
        }

        .crew-checkbox-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 200px;
          overflow-y: auto;
        }

        .crew-checkbox-item {
          display: flex;
          align-items: center;
          padding: 0.5rem 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.15);
          border-radius: 0.375rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .crew-checkbox-item:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 215, 0, 0.3);
        }

        .crew-checkbox {
          width: 1rem;
          height: 1rem;
          margin-right: 0.75rem;
          cursor: pointer;
          accent-color: #FFD700;
        }

        .crew-checkbox-label {
          font-size: 0.875rem;
          color: white;
        }

        .crew-select {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .crew-select:focus {
          outline: none;
          border-color: #FFD700;
        }

        .crew-select option {
          background: #1a1a1a;
          color: white;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 1rem;
          background: #FFD700;
          color: #000;
          font-weight: 600;
          border-radius: 0.375rem;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #FFC700;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
          border-radius: 0.375rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .assignments-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .no-assignments {
          text-align: center;
          padding: 1rem;
          color: #9CA3AF;
          font-size: 0.875rem;
        }

        .assignment-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 215, 0, 0.15);
          border-radius: 0.375rem;
        }

        .crew-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: white;
          margin: 0;
        }

        .crew-email {
          font-size: 0.75rem;
          color: #9CA3AF;
          margin: 0.25rem 0 0 0;
        }

        .btn-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          border-radius: 0.375rem;
          border: 1px solid rgba(239, 68, 68, 0.3);
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-remove:hover {
          background: rgba(239, 68, 68, 0.3);
        }
      `}</style>
    </div>
  );
}
