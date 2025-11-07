// FIX: Removed a self-import of 'Page' which was causing a name conflict.
export type Page = 'Dashboard' | 'Inventory' | 'Sales' | 'Purchases' | 'Accounting' | 'Settings' | 'Reports';

// --- Activity Log Types ---
export type ActivityActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'BACKUP' | 'RESTORE';
export type ActivityEntityType = 
  | 'Drug' | 'Supplier' | 'PurchaseInvoice' | 'SaleInvoice' | 'Payment' 
  | 'ClinicService' | 'ServiceProvider' | 'ClinicTransaction' 
  | 'SimpleAccountingColumn' | 'SimpleAccountingEntry'
  | 'User' | 'Role' | 'SupplierAccount' | 'Settings' | 'Authentication';

export interface ActivityLog {
    id?: number;
    timestamp: string; // ISO string
    userId: number; // Changed back to number to match our custom 'users' table ID
    username: string;
    actionType: ActivityActionType;
    entity: ActivityEntityType;
    entityId: string;
    details: any; // Flexible object to store relevant data, e.g., { before: {}, after: {} } or { created: {} }
}


// --- Permissions for Role-Based Access Control (RBAC) ---
export const PERMISSIONS = {
  // Page Access
  'page:dashboard': 'مشاهده داشبورد',
  'page:inventory': 'دسترسی به انبارداری',
  'page:sales': 'دسترسی به فروش (POS)',
  'page:purchases': 'دسترسی به خریدها',
  'page:accounting': 'دسترسی به حسابداری',
  'page:reports': 'مشاهده گزارشات',
  'page:settings': 'دسترسی به تنظیمات',
  // Fine-grained Permissions
  'inventory:create': 'افزودن داروی جدید',
  'inventory:edit': 'ویرایش اطلاعات دارو',
  'inventory:delete': 'حذف دارو',
  'sales:create': 'ثبت فاکتور فروش',
  'sales:edit': 'ویرایش فاکتور فروش',
  'purchases:create': 'ثبت فاکتور خرید',
  'purchases:edit': 'ویرایش فاکتور خرید',
  'accounting:suppliers:manage': 'مدیریت تامین‌کنندگان و پرداخت‌ها',
  'accounting:clinic:manage': 'مدیریت خدمات و صندوق کلینیک',
  'accounting:simple:manage': 'مدیریت حسابداری ساده',
  'settings:users:view': 'مشاهده کاربران',
  'settings:users:manage': 'مدیریت کاربران (افزودن/ویرایش/حذف)',
  'settings:roles:view': 'مشاهده نقش‌ها',
  'settings:roles:manage': 'مدیریت نقش‌ها و دسترسی‌ها',
  'settings:portal:manage': 'مدیریت پورتال تامین‌کنندگان',
  'settings:backup:manage': 'پشتیبان‌گیری و بازیابی اطلاعات',
  'settings:alerts:manage': 'مدیریت هشدارها',
  'settings:profile:manage': 'مدیریت مشخصات داروخانه',
} as const;

export type Permission = keyof typeof PERMISSIONS;


export interface Role {
  id?: number;
  remoteId?: number;
  name: string;
  permissions: Permission[];
  isEditable: boolean; // To protect the default Admin role
}

export interface User {
  id?: number;
  remoteId?: number;
  username: string;
  roleId: number;
}

export interface SupplierAccount {
  id?: number;
  remoteId?: number;
  supplierId: number;
  username: string;
}


export enum DrugType {
  TABLET = 'قرص',
  SYRUP = 'شربت',
  INJECTION = 'آمپول',
  OINTMENT = 'پماد',
  DROPS = 'قطره',
  OTHER = 'غیره',
}

export interface DrugBatch {
  id?: number;
  remoteId?: number;
  drugId: number;
  lotNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantityInStock: number;
  purchasePrice: number; // Price for this specific batch
}

export interface Drug {
  id?: number;
  remoteId?: number;
  name: string;
  company: string;
  // lotNumber, expiryDate, and individual stock are now in DrugBatch
  purchasePrice: number; // Default/latest purchase price
  salePrice: number;
  totalStock: number; // Aggregated stock from all batches
  type: DrugType;
  internalBarcode?: string;
  barcode?: string; // This will store both barcode and QR code values
}

export interface Supplier {
  id?: number;
  remoteId?: number;
  name: string;
  contactPerson?: string;
  phone?: string;
  totalDebt: number;
}

export interface PurchaseInvoiceItem {
  drugId: number;
  name: string; // Denormalized for easier display in invoices
  quantity: number;
  purchasePrice: number;
  lotNumber: string;
  expiryDate: string;
}

export interface PurchaseInvoice {
  id?: number;
  remoteId?: number;
  invoiceNumber: string;
  supplierId: number;
  date: string;
  items: PurchaseInvoiceItem[];
  totalAmount: number;
  amountPaid: number; // Initially 0 when creating
}

export interface SaleItem {
  drugId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  deductions: { batchId: number; quantity: number }[]; // CRITICAL for editing/reversals
}

export interface SaleInvoice {
  id?: number;
  remoteId?: number;
  date: string;
  items: SaleItem[];
  totalAmount: number;
}

export interface Payment {
  id?: number;
  remoteId?: number;
  supplierId: number;
  amount: number;
  date: string;
  recipientName?: string;
  description?: string;
}

export interface ClinicService {
  id?: number;
  remoteId?: number;
  name: string;
  price: number;
  requiresProvider: boolean;
}

export interface ServiceProvider {
  id?: number;
  remoteId?: number;
  name: string;
  specialty?: string;
}

export interface ClinicTransaction {
  id?: number;
  remoteId?: number;
  serviceId: number;
  providerId?: number; // Optional, depends on the service
  patientName?: string;
  amount: number;
  date: string; // ISO string
  ticketNumber: number;
}

export interface SimpleAccountingColumn {
  id?: number;
  remoteId?: number;
  name: string;
  type: 'income' | 'expense';
  order: number;
}

export interface SimpleAccountingEntry {
  id?: number;
  remoteId?: number;
  date: string; // YYYY-MM-DD
  patientName: string;
  description: string;
  values: { [columnId: number]: number }; // e.g., { 1: 50.00, 3: 120.50 }
}

export interface SyncQueueItem {
    id?: number;
    table: string;
    action: 'create' | 'update' | 'delete';
    recordId: number | string; // The primary key of the record in the local DB
    payload: any;
    timestamp: number;
}

export type ExpiryThreshold = {
    value: number;
    unit: 'days' | 'weeks' | 'months';
}

export type AppSettingKey = 'expiryAlertThreshold' | 'lowStockThreshold' | 'pharmacyName' | 'pharmacyLogo';

export interface AppSetting {
  key: AppSettingKey;
  value: ExpiryThreshold | number | string;
}