export interface Package {
  id: string;
  ref_number: string;
  status: 'Pending' | 'Assigned' | 'In Transit' | 'Delivered' | 'Returned' | 'Archived';
  customer_name?: string; // Made optional
  customer_address?: string; // Made optional
  customer_phone?: string;
  customer_phone_2?: string;
  sender_name?: string;
  sender_company?: string;
  sender_phone?: string;
  date_of_arrive?: string;
  description?: string;
  weight?: string;
  price: number;
  is_paid: boolean;
  limit_date?: string; // Made optional
  gps_lat?: number;
  gps_lng?: number;
  assigned_to?: string;
  assigned_at?: string;
  accepted_at?: string;
  delivered_at?: string;
  return_reason?: string;
  supplement_info?: string;
  created_at?: string; // Added for package creation
  _lastModified?: string;
  _version?: string;
  is_archived?: boolean;
  archived_at?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  pin_code: string;
  is_active: boolean;
  created_at: string;
  source?: 'firebase' | 'stored' | 'random' | 'admin-created' | 'local';
  _lastModified?: string;
  _version?: string;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: 'packages' | 'drivers';
  data: any;
  timestamp: string;
  synced: boolean;
}

export interface SyncMetadata {
  lastSync: string;
  pendingCount: number;
}
