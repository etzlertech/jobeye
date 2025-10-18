'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  User as UserIcon,
  Loader2,
  Save,
  X,
  Upload
} from 'lucide-react';
import type { ProcessedImages } from '@/utils/image-processor';
import { ItemImageUpload } from '@/components/items/ItemImageUpload';

interface UserDetail {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  thumbnailImageUrl: string | null;
  mediumImageUrl: string | null;
  primaryImageUrl: string | null;
  timezone: string | null;
  preferredLanguage: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  displayName: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  timezone: string;
  preferredLanguage: string;
  isActive: boolean;
}

function UserDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.userId as string;

  // State
  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    displayName: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'technician',
    timezone: 'America/New_York',
    preferredLanguage: 'en-US',
    isActive: true
  });

  // Load user details on mount
  useEffect(() => {
    if (userId) {
      loadUser();
    }
  }, [userId]);

  const loadUser = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/supervisor/users/${userId}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      const userData = data.user;
      setUser(userData);

      // Initialize form data
      setFormData({
        displayName: userData.displayName || '',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phone: userData.phone || '',
        role: userData.role,
        timezone: userData.timezone || 'America/New_York',
        preferredLanguage: userData.preferredLanguage || 'en-US',
        isActive: userData.isActive
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        display_name: formData.displayName || null,
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        phone: formData.phone || null,
        role: formData.role,
        timezone: formData.timezone,
        preferred_language: formData.preferredLanguage,
        is_active: formData.isActive
      };

      const response = await fetch(`/api/supervisor/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update user');
      }

      setSuccess('User updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      setHasChanges(false);

      // Reload user data
      await loadUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        displayName: user.displayName || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        role: user.role,
        timezone: user.timezone || 'America/New_York',
        preferredLanguage: user.preferredLanguage || 'en-US',
        isActive: user.isActive
      });
      setHasChanges(false);
    }
  };

  const handleImageCapture = async (images: ProcessedImages) => {
    setIsUploadingImage(true);
    setError(null);

    try {
      const response = await fetch(`/api/supervisor/users/${userId}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ images })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload image');
      }

      setSuccess('Profile photo updated successfully!');
      setTimeout(() => setSuccess(null), 3000);

      await loadUser();
      setShowImageUpload(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading user...</p>
          </div>
        </div>
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
            padding: 0 0.5rem;
            box-sizing: border-box;
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-400">User not found</p>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
  const hasProfileImage = Boolean(user.mediumImageUrl || user.primaryImageUrl);

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="supervisor"
        onLogout={() => router.push('/sign-in')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">User Profile</h1>
          <p className="text-xs text-gray-500">{displayName}</p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="notification-bar error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="notification-bar success">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Profile Image */}
          <div className="profile-section">
            <div className="profile-avatar">
              {user.mediumImageUrl ? (
                <img
                  src={user.mediumImageUrl}
                  alt={displayName}
                  className="profile-avatar-img"
                />
              ) : (
                <UserIcon className="profile-avatar-icon" />
              )}
            </div>

            <div className="upload-area">
              {showImageUpload ? (
                <div className="upload-panel">
                  <ItemImageUpload
                    onImageCapture={handleImageCapture}
                    currentImageUrl={user.mediumImageUrl || user.primaryImageUrl || undefined}
                    disabled={isUploadingImage}
                  />
                  <button
                    type="button"
                    onClick={() => setShowImageUpload(false)}
                    className="upload-btn secondary"
                    disabled={isUploadingImage}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowImageUpload(true)}
                  disabled={isUploadingImage}
                  className="upload-btn"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                    <Upload className="w-4 h-4 mr-1" />
                    {hasProfileImage ? 'Update Photo' : 'Add Photo'}
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="text-xs text-gray-500 text-center mt-2">
              {user.email || 'No email'}
            </p>
            {user.lastLoginAt && (
              <p className="text-xs text-gray-600 text-center">
                Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Form */}
          <div className="form-section">
            <h2 className="section-title">Profile Information</h2>

            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => handleFormChange('displayName', e.target.value)}
                className="form-input"
                placeholder="Enter display name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">First Name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleFormChange('firstName', e.target.value)}
                className="form-input"
                placeholder="Enter first name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleFormChange('lastName', e.target.value)}
                className="form-input"
                placeholder="Enter last name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email (Read-only)</label>
              <input
                type="email"
                value={user.email || 'No email'}
                disabled
                className="form-input disabled"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleFormChange('phone', e.target.value)}
                className="form-input"
                placeholder="Enter phone number"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                value={formData.role}
                onChange={(e) => handleFormChange('role', e.target.value)}
                className="form-input"
              >
                <option value="technician">Technician</option>
                <option value="manager">Manager</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Timezone</label>
              <select
                value={formData.timezone}
                onChange={(e) => handleFormChange('timezone', e.target.value)}
                className="form-input"
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Language</label>
              <select
                value={formData.preferredLanguage}
                onChange={(e) => handleFormChange('preferredLanguage', e.target.value)}
                className="form-input"
              >
                <option value="en-US">English (US)</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleFormChange('isActive', e.target.checked)}
                  className="form-checkbox"
                />
                <span className="ml-2">Active User</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={() => router.push('/supervisor/users')}
          className="btn-secondary flex-1"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        {hasChanges && (
          <>
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary"
              disabled={isSaving}
            >
              <X className="w-5 h-5 mr-1" />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary flex-1"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save
                </>
              )}
            </button>
          </>
        )}
      </div>

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
          padding: 0 0.5rem;
          box-sizing: border-box;
        }

        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .notification-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin: 0.5rem 1rem;
          border-radius: 0.5rem;
        }

        .notification-bar.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .notification-bar.success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
        }

        .profile-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1.5rem 0;
        }

        .profile-avatar {
          width: 7rem;
          height: 7rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 215, 0, 0.15);
          border: 3px solid rgba(255, 215, 0, 0.3);
          overflow: hidden;
        }

        .profile-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-avatar-icon {
          width: 3.5rem;
          height: 3.5rem;
          color: #FFD700;
        }

        .upload-buttons {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .upload-area {
          width: 100%;
          margin-top: 0.75rem;
        }

        .upload-panel {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .upload-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 1rem;
          background: rgba(255, 215, 0, 0.2);
          color: #FFD700;
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .upload-btn:hover:not(:disabled) {
          background: rgba(255, 215, 0, 0.3);
          border-color: #FFD700;
        }

        .upload-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .upload-btn.secondary {
          background: transparent;
          border-color: rgba(148, 163, 184, 0.4);
          color: #d1d5db;
        }

        .upload-btn.secondary:hover:not(:disabled) {
          background: rgba(148, 163, 184, 0.15);
          border-color: rgba(148, 163, 184, 0.6);
        }

        .hidden {
          display: none;
        }

        .form-section {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
          padding: 1.5rem;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #FFD700;
          margin: 0 0 1rem 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: #9CA3AF;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-input {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
        }

        .form-input:focus {
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
        }

        .form-input.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-input::placeholder {
          color: #6b7280;
        }

        .form-input option {
          background: #1a1a1a;
          color: white;
        }

        .form-checkbox {
          width: 1.25rem;
          height: 1.25rem;
          cursor: pointer;
          accent-color: #FFD700;
        }

        .bottom-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.9);
          border-top: 1px solid #333;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: #FFD700;
          color: #000;
          font-weight: 600;
          border-radius: 0.5rem;
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
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 215, 0, 0.3);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          border-color: #FFD700;
        }

        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

// Main export wrapped in Suspense
export default function UserDetailPage() {
  return (
    <Suspense fallback={
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading...</p>
          </div>
        </div>
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
            padding: 0 0.5rem;
            box-sizing: border-box;
          }
        `}</style>
      </div>
    }>
      <UserDetailPageContent />
    </Suspense>
  );
}
