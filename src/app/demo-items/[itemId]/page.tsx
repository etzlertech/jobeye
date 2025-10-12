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
  item_type: string;
  category: string;
  tracking_mode: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  sku?: string;
  barcode?: string;
  current_quantity: number;
  unit_of_measure: string;
  min_quantity?: number;
  max_quantity?: number;
  reorder_point?: number;
  current_location_id?: string;
  home_location_id?: string;
  assigned_to_user_id?: string;
  assigned_to_job_id?: string;
  status: string;
  condition?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_value?: number;
  depreciation_method?: string;
  attributes?: Record<string, any>;
  tags?: string[];
  custom_fields?: Record<string, any>;
  primary_image_url?: string;
  image_urls?: string[];
  thumbnail_url?: string;
  medium_url?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
}

interface Transaction {
  id: string;
  transaction_type: string;
  quantity: number;
  from_user_id?: string;
  to_user_id?: string;
  job_id?: string;
  notes?: string;
  created_at: string;
  job?: {
    id: string;
    job_number: string;
    title: string;
  };
}

interface Job {
  id: string;
  job_number: string;
  title: string;
  status: string;
  customer_name?: string;
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
      setItem(itemData.item);
      setEditData(itemData.item);
      
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
        setAssociatedJobs(jobsData.jobs || []);
      }
      
      // Load additional files if any
      if (itemData.item.image_urls) {
        setAdditionalFiles(itemData.item.image_urls.filter((url: string) => 
          url !== itemData.item.primary_image_url &&
          url !== itemData.item.thumbnail_url &&
          url !== itemData.item.medium_url
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
  const lastTransaction = transactions.find(t => t.transaction_type === 'check_out');
  const lastUseDate = lastTransaction ? new Date(lastTransaction.created_at) : null;
  
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
                  {item.item_type} • {item.category}
                </p>
              </div>
              <button
                onClick={() => setEditMode(!editMode)}
                className="p-2 text-gray-600 hover:text-gray-800"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </div>
            
            {editMode ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Item name"
                />
                <textarea
                  value={editData.description || ''}
                  onChange={(e) => setEditData({...editData, description: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="Description"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={editData.manufacturer || ''}
                    onChange={(e) => setEditData({...editData, manufacturer: e.target.value})}
                    className="border rounded px-3 py-2"
                    placeholder="Manufacturer"
                  />
                  <input
                    type="text"
                    value={editData.model || ''}
                    onChange={(e) => setEditData({...editData, model: e.target.value})}
                    className="border rounded px-3 py-2"
                    placeholder="Model"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={updateItem}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setEditData(item);
                    }}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
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
                  {item.serial_number && (
                    <div>
                      <span className="text-sm text-gray-500">Serial Number</span>
                      <p className="font-medium">{item.serial_number}</p>
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
                <p className="font-medium">{item.tracking_mode}</p>
              </div>
              
              {item.assigned_to_job_id && (
                <div>
                  <span className="text-sm text-gray-500 flex items-center">
                    <Briefcase className="w-4 h-4 mr-1" />
                    Assigned to Job
                  </span>
                  <p className="font-medium text-blue-600">
                    Job #{item.assigned_to_job_id}
                  </p>
                </div>
              )}
              
              {item.current_location_id && (
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
          </div>
          
          {/* Inventory */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Inventory
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-gray-500">Current Qty</span>
                <p className="font-medium text-lg">{item.current_quantity} {item.unit_of_measure}</p>
              </div>
              {item.min_quantity && (
                <div>
                  <span className="text-sm text-gray-500">Min Qty</span>
                  <p className="font-medium">{item.min_quantity}</p>
                </div>
              )}
              {item.max_quantity && (
                <div>
                  <span className="text-sm text-gray-500">Max Qty</span>
                  <p className="font-medium">{item.max_quantity}</p>
                </div>
              )}
              {item.reorder_point && (
                <div>
                  <span className="text-sm text-gray-500">Reorder Point</span>
                  <p className="font-medium">{item.reorder_point}</p>
                </div>
              )}
            </div>
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
                  <Link
                    key={job.id}
                    href={`/demo-jobs/${job.id}`}
                    className="block p-3 border rounded hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          Job #{job.job_number}: {job.title}
                        </p>
                        {job.customer_name && (
                          <p className="text-sm text-gray-600">{job.customer_name}</p>
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
                  </Link>
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
            <h3 className="text-lg font-semibold mb-4">Item Image</h3>
            {item.primary_image_url ? (
              <div className="relative">
                <img 
                  src={item.primary_image_url} 
                  alt={item.name}
                  className="w-full rounded-lg"
                />
                <button
                  onClick={() => setUploadingImage(true)}
                  className="absolute top-2 right-2 p-2 bg-white rounded-full shadow hover:bg-gray-100"
                >
                  <Camera className="w-4 h-4" />
                </button>
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
                  currentImageUrl={item.primary_image_url}
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
          {(item.purchase_price || item.current_value) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Financial Info
              </h3>
              
              <div className="space-y-3">
                {item.purchase_price && (
                  <div>
                    <span className="text-sm text-gray-500">Purchase Price</span>
                    <p className="font-medium">${item.purchase_price.toFixed(2)}</p>
                  </div>
                )}
                {item.current_value && (
                  <div>
                    <span className="text-sm text-gray-500">Current Value</span>
                    <p className="font-medium">${item.current_value.toFixed(2)}</p>
                  </div>
                )}
                {item.purchase_date && (
                  <div>
                    <span className="text-sm text-gray-500">Purchase Date</span>
                    <p className="font-medium">
                      {new Date(item.purchase_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Maintenance */}
          {(item.last_maintenance_date || item.next_maintenance_date) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Tool className="w-5 h-5 mr-2" />
                Maintenance
              </h3>
              
              <div className="space-y-3">
                {item.last_maintenance_date && (
                  <div>
                    <span className="text-sm text-gray-500">Last Service</span>
                    <p className="font-medium">
                      {new Date(item.last_maintenance_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {item.next_maintenance_date && (
                  <div>
                    <span className="text-sm text-gray-500">Next Service Due</span>
                    <p className="font-medium text-orange-600">
                      {new Date(item.next_maintenance_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
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
                    {transaction.transaction_type === 'check_out' ? 'Checked Out' : 'Checked In'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {transaction.job?.job_number && `Job #${transaction.job.job_number} - `}
                    {transaction.notes || 'No notes'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm font-medium">
                    {transaction.quantity} {item.unit_of_measure}
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