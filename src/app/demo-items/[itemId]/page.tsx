'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Edit2, 
  Package, 
  MapPin, 
  Calendar,
  DollarSign,
  Tool,
  User,
  Briefcase,
  Clock,
  Tag,
  FileText,
  Plus,
  X,
  Camera,
  Upload
} from 'lucide-react';
import TenantUserInfo from '@/components/demo/TenantUserInfo';
import ItemImageUpload from '@/components/items/ItemImageUpload';
import type { ProcessedImages } from '@/utils/image-processor';

interface Item {
  id: string;
  name: string;
  description?: string;
  itemType: string;
  category: string;
  trackingMode: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  sku?: string;
  barcode?: string;
  currentQuantity: number;
  unitOfMeasure: string;
  minQuantity?: number;
  maxQuantity?: number;
  reorderPoint?: number;
  currentLocationId?: string;
  homeLocationId?: string;
  assignedToUserId?: string;
  assignedToJobId?: string;
  status: string;
  condition?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  depreciationMethod?: string;
  attributes?: Record<string, any>;
  tags?: string[];
  customFields?: Record<string, any>;
  primaryImageUrl?: string;
  imageUrls?: string[];
  thumbnailUrl?: string;
  mediumUrl?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
}

interface Transaction {
  id: string;
  transactionType: string;
  quantity: number;
  fromUserId?: string;
  toUserId?: string;
  jobId?: string;
  notes?: string;
  createdAt: string;
  job?: {
    id: string;
    jobNumber: string;
    title: string;
  };
}

interface Job {
  id: string;
  jobNumber: string;
  title: string;
  status: string;
  customerName?: string;
}

export default function ItemProfilePage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.itemId as string;
  
  const [item, setItem] = useState<Item | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [associatedJobs, setAssociatedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [additionalFiles, setAdditionalFiles] = useState<string[]>([]);
  
  // Edit form state
  const [editData, setEditData] = useState<Partial<Item>>({});
  
  async function loadItemProfile() {
    console.log('Loading item profile for:', itemId);
    try {
      // Load item details
      const itemRes = await fetch(`/api/supervisor/items/${itemId}`, {
        headers: {
          'x-tenant-id': '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'
        }
      });
      
      if (!itemRes.ok) {
        console.error('Failed to load item');
        return;
      }
      
      const itemData = await itemRes.json();
      console.log('Loaded item data:', itemData.item);
      console.log('Item image URLs:', {
        primary: itemData.item?.primaryImageUrl,
        medium: itemData.item?.mediumUrl,
        thumbnail: itemData.item?.thumbnailUrl
      });
      setItem(itemData.item);
      setEditData({...itemData.item});
      
      // Load transactions
      const transRes = await fetch(`/api/supervisor/items/${itemId}/transactions`, {
        headers: {
          'x-tenant-id': '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'
        }
      });
      
      if (transRes.ok) {
        const transData = await transRes.json();
        setTransactions(transData.transactions || []);
      }
      
      // Load associated jobs
      const jobsRes = await fetch(`/api/supervisor/items/${itemId}/jobs`, {
        headers: {
          'x-tenant-id': '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'
        }
      });
      
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        const normalizedJobs = (jobsData.jobs || []).map((job: any) => ({
          id: job.id,
          jobNumber: job.jobNumber ?? job.job_number ?? '—',
          title: job.title ?? 'Untitled Job',
          status: job.status ?? 'unknown',
          customerName: job.customerName ?? job.customer_name ?? undefined
        }));
        setAssociatedJobs(normalizedJobs);
      }
      
      // Load additional files if any
      if (itemData.item.imageUrls) {
        setAdditionalFiles(itemData.item.imageUrls.filter((url: string) => 
          url !== itemData.item.primaryImageUrl &&
          url !== itemData.item.thumbnailUrl &&
          url !== itemData.item.mediumUrl
        ));
      }
      
    } catch (error) {
      console.error('Error loading item profile:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function updateItem() {
    try {
      const res = await fetch(`/api/supervisor/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'
        },
        body: JSON.stringify(editData)
      });
      
      if (res.ok) {
        const data = await res.json();
        setItem(data.item);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Error updating item:', error);
    }
  }
  
  async function handleImageUpload(images: ProcessedImages) {
    console.log('handleImageUpload called with images:', {
      thumbnailLength: images.thumbnail.length,
      mediumLength: images.medium.length,
      fullLength: images.full.length
    });
    
    try {
      console.log('Sending POST request to upload images...');
      const res = await fetch(`/api/supervisor/items/${itemId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'
        },
        body: JSON.stringify({ images })
      });
      
      console.log('Upload response status:', res.status);
      
      if (res.ok) {
        const responseData = await res.json();
        console.log('Upload successful, response:', responseData);
        console.log('Image URLs from upload:', responseData.imageUrls);
        
        // Add a small delay before reloading to ensure DB is updated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await loadItemProfile(); // Reload to get new image URLs
        setUploadingImage(false); // Close the upload interface
      } else {
        const errorText = await res.text();
        console.error('Failed to upload image:', errorText);
        alert('Failed to upload image. Please try again.');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    }
  }
  
  async function handleAdditionalFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // For now, we'll just show the file name
    // In a real implementation, you'd upload to Supabase Storage
    alert(`File upload feature coming soon for: ${file.name}`);
  }
  
  useEffect(() => {
    loadItemProfile();
  }, [itemId]);
  
  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">Loading item profile...</div>
      </div>
    );
  }
  
  if (!item) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">Item not found</div>
      </div>
    );
  }
  
  // Calculate last use from transactions
  const lastTransaction = transactions.find(t => t.transactionType === 'check_out');
  const lastUseDate = lastTransaction ? new Date(lastTransaction.createdAt) : null;
  
  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <Link 
          href="/demo-items" 
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Items
        </Link>
      </div>
      
      <TenantUserInfo />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold">{item.name}</h1>
                <p className="text-gray-600 mt-1">
                  {item.itemType} • {item.category}
                </p>
              </div>
              {editMode ? (
                <div className="flex gap-2">
                  <button
                    onClick={updateItem}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Save All Changes
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setEditData(item);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditData({...item});
                    setEditMode(true);
                  }}
                  className="p-2 text-gray-600 hover:text-gray-800"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {editMode ? (
              <div className="space-y-4">
                {/* Basic Information */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editData.name ?? ''}
                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Item name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editData.description ?? ''}
                    onChange={(e) => setEditData({...editData, description: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    rows={3}
                    placeholder="Description"
                  />
                </div>
                
                {/* Type and Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={editData.itemType ?? ''}
                      onChange={(e) => setEditData({...editData, itemType: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="equipment">Equipment</option>
                      <option value="material">Material</option>
                      <option value="tool">Tool</option>
                      <option value="consumable">Consumable</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={editData.category ?? ''}
                      onChange={(e) => setEditData({...editData, category: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Category"
                    />
                  </div>
                </div>
                
                {/* Manufacturer and Model */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                    <input
                      type="text"
                      value={editData.manufacturer ?? ''}
                      onChange={(e) => setEditData({...editData, manufacturer: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Manufacturer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                    <input
                      type="text"
                      value={editData.model ?? ''}
                      onChange={(e) => setEditData({...editData, model: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Model"
                    />
                  </div>
                </div>
                
                {/* Identifiers */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                    <input
                      type="text"
                      value={editData.serialNumber ?? ''}
                      onChange={(e) => setEditData({...editData, serialNumber: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Serial #"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                    <input
                      type="text"
                      value={editData.sku ?? ''}
                      onChange={(e) => setEditData({...editData, sku: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="SKU"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                    <input
                      type="text"
                      value={editData.barcode ?? ''}
                      onChange={(e) => setEditData({...editData, barcode: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Barcode"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {item.description && (
                  <p className="text-gray-700 mb-4">{item.description}</p>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  {item.manufacturer && (
                    <div>
                      <span className="text-sm text-gray-500">Manufacturer</span>
                      <p className="font-medium">{item.manufacturer}</p>
                    </div>
                  )}
                  {item.model && (
                    <div>
                      <span className="text-sm text-gray-500">Model</span>
                      <p className="font-medium">{item.model}</p>
                    </div>
                  )}
                  {item.serialNumber && (
                    <div>
                      <span className="text-sm text-gray-500">Serial Number</span>
                      <p className="font-medium">{item.serialNumber}</p>
                    </div>
                  )}
                  {item.sku && (
                    <div>
                      <span className="text-sm text-gray-500">SKU</span>
                      <p className="font-medium">{item.sku}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Status & Assignment */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Status & Assignment
            </h2>
            
            {editMode ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editData.status ?? 'active'}
                    onChange={(e) => setEditData({...editData, status: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="retired">Retired</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select
                    value={editData.condition ?? 'good'}
                    onChange={(e) => setEditData({...editData, condition: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Mode</label>
                  <select
                    value={editData.trackingMode ?? 'quantity'}
                    onChange={(e) => setEditData({...editData, trackingMode: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="individual">Individual</option>
                    <option value="quantity">Quantity</option>
                    <option value="batch">Batch</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Status</span>
                  <p className="font-medium">
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.status === 'active' ? 'bg-green-100 text-green-800' : 
                      item.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.status}
                    </span>
                  </p>
                </div>
              
                <div>
                  <span className="text-sm text-gray-500">Condition</span>
                  <p className="font-medium">{item.condition || 'Good'}</p>
                </div>
                
                <div>
                  <span className="text-sm text-gray-500">Tracking</span>
                  <p className="font-medium">{item.trackingMode}</p>
                </div>
                
                {item.assignedToJobId && (
                  <div>
                    <span className="text-sm text-gray-500 flex items-center">
                      <Briefcase className="w-4 h-4 mr-1" />
                      Assigned to Job
                    </span>
                    <p className="font-medium text-blue-600">
                      Job #{item.assignedToJobId}
                    </p>
                  </div>
                )}
                
                {item.currentLocationId && (
                  <div>
                    <span className="text-sm text-gray-500 flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      Location
                    </span>
                    <p className="font-medium">Warehouse A</p>
                  </div>
                )}
                
                {lastUseDate && (
                  <div>
                    <span className="text-sm text-gray-500 flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      Last Used
                    </span>
                    <p className="font-medium">
                      {lastUseDate.toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Inventory */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Inventory
            </h2>
            
            {editMode ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Qty</label>
                  <input
                    type="number"
                    value={editData.currentQuantity ?? 0}
                    onChange={(e) => setEditData({...editData, currentQuantity: parseFloat(e.target.value) || 0})}
                    className="w-full border rounded px-3 py-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={editData.unitOfMeasure ?? 'each'}
                    onChange={(e) => setEditData({...editData, unitOfMeasure: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="each, lbs, etc"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Qty</label>
                  <input
                    type="number"
                    value={editData.minQuantity ?? ''}
                    onChange={(e) => setEditData({...editData, minQuantity: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="w-full border rounded px-3 py-2"
                    step="0.01"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Qty</label>
                  <input
                    type="number"
                    value={editData.maxQuantity ?? ''}
                    onChange={(e) => setEditData({...editData, maxQuantity: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="w-full border rounded px-3 py-2"
                    step="0.01"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
                  <input
                    type="number"
                    value={editData.reorderPoint ?? ''}
                    onChange={(e) => setEditData({...editData, reorderPoint: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="w-full border rounded px-3 py-2"
                    step="0.01"
                    placeholder="Optional"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Current Qty</span>
                  <p className="font-medium text-lg">{item.currentQuantity} {item.unitOfMeasure}</p>
                </div>
                {item.minQuantity && (
                  <div>
                    <span className="text-sm text-gray-500">Min Qty</span>
                    <p className="font-medium">{item.minQuantity}</p>
                  </div>
                )}
                {item.maxQuantity && (
                  <div>
                    <span className="text-sm text-gray-500">Max Qty</span>
                    <p className="font-medium">{item.maxQuantity}</p>
                  </div>
                )}
                {item.reorderPoint && (
                  <div>
                    <span className="text-sm text-gray-500">Reorder Point</span>
                    <p className="font-medium">{item.reorderPoint}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Associated Jobs */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Briefcase className="w-5 h-5 mr-2" />
              Associated Jobs ({associatedJobs.length})
            </h2>
            
            {associatedJobs.length > 0 ? (
              <div className="space-y-2">
                {associatedJobs.map(job => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => router.push(`/demo-jobs?focus=${job.id}`)}
                    className="w-full text-left p-3 border rounded hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          Job #{job.jobNumber}: {job.title}
                        </p>
                        {job.customerName && (
                          <p className="text-sm text-gray-600">{job.customerName}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800' :
                        job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No jobs associated with this item yet.</p>
            )}
          </div>
        </div>
        
        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Main Image */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Item Image</h3>
              {editMode && item.primaryImageUrl && (
                <button
                  onClick={() => setUploadingImage(!uploadingImage)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Change Image
                </button>
              )}
            </div>
            {item.primaryImageUrl && !uploadingImage ? (
              <div className="relative">
                <img 
                  src={item.primaryImageUrl} 
                  alt={item.name}
                  className="w-full rounded-lg"
                />
                {editMode && (
                  <button
                    onClick={() => setUploadingImage(true)}
                    className="absolute top-2 right-2 p-2 bg-white rounded-full shadow hover:bg-gray-100"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Camera className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500 mb-4">No image uploaded</p>
                <button
                  onClick={() => setUploadingImage(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Image
                </button>
              </div>
            )}
            
            {uploadingImage && (
              <div className="mt-4">
                <ItemImageUpload
                  onImageCapture={handleImageUpload}
                  currentImageUrl={item.primaryImageUrl}
                />
                <button
                  onClick={() => setUploadingImage(false)}
                  className="mt-2 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          
          {/* Financial Info */}
          {(item.purchasePrice || item.currentValue || editMode) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Financial Info
              </h3>
              
              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
                    <input
                      type="number"
                      value={editData.purchasePrice ?? ''}
                      onChange={(e) => setEditData({...editData, purchasePrice: e.target.value ? parseFloat(e.target.value) : undefined})}
                      className="w-full border rounded px-3 py-2"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Value</label>
                    <input
                      type="number"
                      value={editData.currentValue ?? ''}
                      onChange={(e) => setEditData({...editData, currentValue: e.target.value ? parseFloat(e.target.value) : undefined})}
                      className="w-full border rounded px-3 py-2"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                    <input
                      type="date"
                      value={editData.purchaseDate ? editData.purchaseDate.split('T')[0] : ''}
                      onChange={(e) => setEditData({...editData, purchaseDate: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {item.purchasePrice && (
                    <div>
                      <span className="text-sm text-gray-500">Purchase Price</span>
                      <p className="font-medium">${item.purchasePrice.toFixed(2)}</p>
                    </div>
                  )}
                  {item.currentValue && (
                    <div>
                      <span className="text-sm text-gray-500">Current Value</span>
                      <p className="font-medium">${item.currentValue.toFixed(2)}</p>
                    </div>
                  )}
                  {item.purchaseDate && (
                    <div>
                      <span className="text-sm text-gray-500">Purchase Date</span>
                      <p className="font-medium">
                        {new Date(item.purchaseDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Maintenance */}
          {(item.lastMaintenanceDate || item.nextMaintenanceDate || editMode) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Tool className="w-5 h-5 mr-2" />
                Maintenance
              </h3>
              
              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Service</label>
                    <input
                      type="date"
                      value={editData.lastMaintenanceDate ? editData.lastMaintenanceDate.split('T')[0] : ''}
                      onChange={(e) => setEditData({...editData, lastMaintenanceDate: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Next Service Due</label>
                    <input
                      type="date"
                      value={editData.nextMaintenanceDate ? editData.nextMaintenanceDate.split('T')[0] : ''}
                      onChange={(e) => setEditData({...editData, nextMaintenanceDate: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {item.lastMaintenanceDate && (
                    <div>
                      <span className="text-sm text-gray-500">Last Service</span>
                      <p className="font-medium">
                        {new Date(item.lastMaintenanceDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {item.nextMaintenanceDate && (
                    <div>
                      <span className="text-sm text-gray-500">Next Service Due</span>
                      <p className="font-medium text-orange-600">
                        {new Date(item.nextMaintenanceDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Additional Files */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Additional Files
            </h3>
            
            {additionalFiles.length > 0 ? (
              <div className="space-y-2">
                {additionalFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm truncate">File {index + 1}</span>
                    <button className="text-red-600 hover:text-red-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm mb-4">
                No additional files uploaded
              </p>
            )}
            
            <label className="block mt-4">
              <input
                type="file"
                onChange={handleAdditionalFileUpload}
                accept="image/*,application/pdf,video/*"
                className="hidden"
              />
              <span className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer">
                <Plus className="w-4 h-4 mr-2" />
                Add File
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-2">
              Supports images, PDFs, and videos
            </p>
          </div>
          
          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Tag className="w-5 h-5 mr-2" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag, index) => (
                  <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Recent Activity
        </h2>
        
        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.slice(0, 5).map(transaction => (
              <div key={transaction.id} className="flex items-center justify-between p-3 border-b">
                <div>
                  <p className="font-medium">
                    {transaction.transactionType === 'check_out' ? 'Checked Out' : 'Checked In'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {transaction.job?.jobNumber ? `Job #${transaction.job.jobNumber} - ` : ''}
                    {transaction.notes || 'No notes'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm font-medium">
                    {transaction.quantity} {item.unitOfMeasure}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No activity recorded yet.</p>
        )}
      </div>
    </div>
  );
}
