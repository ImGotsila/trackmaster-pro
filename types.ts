export interface Shipment {
  id: string;
  trackingNumber: string;
  customerName: string;
  phoneNumber: string;
  codAmount: number;
  shippingCost: number;
  zipCode: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Returned' | 'รับฝาก';
  courier: string;
  importDate: string; // ISO String YYYY-MM-DD
  importTime?: string; // HH:mm format
  timestamp: number;
  sequenceNumber?: string; // For the "718." prefix
}

export type Courier = 'Thailand Post - EMS' | 'Kerry Express' | 'J&T Express' | 'Flash Express';

export interface ImportStats {
  totalItems: number;
  totalCOD: number;
}

export interface ActionLog {
  id: string;
  action: 'import' | 'sync' | 'delete';
  timestamp: number;
  details: string;
  status: 'success' | 'error';
}