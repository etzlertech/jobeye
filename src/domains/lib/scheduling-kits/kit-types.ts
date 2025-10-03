export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface KitItemInput {
  itemType: 'equipment' | 'material' | 'tool';
  quantity: number;
  unit: string;
  isRequired: boolean;
  metadata?: JsonValue;
}

export interface CreateKitInput {
  kitCode: string;
  name: string;
  isActive?: boolean;
  metadata?: JsonValue;
  items: KitItemInput[];
}

export interface KitItem {
  id: string;
  itemType: 'equipment' | 'material' | 'tool';
  quantity: number;
  unit: string;
  isRequired: boolean;
  metadata?: JsonValue;
}

export interface KitSummary {
  id: string;
  tenantId: string;
  kitCode: string;
  name: string;
  isActive: boolean;
  metadata?: JsonValue;
}

export interface KitDetail extends KitSummary {
  items: KitItem[];
}

export interface KitVariant {
  id: string;
  kitId: string;
  tenantId: string;
  variantCode: string;
  name: string;
  isDefault: boolean;
  metadata?: JsonValue;
}

export interface CreateKitVariantInput {
  kitId: string;
  tenantId: string;
  variantCode: string;
  name: string;
  isDefault?: boolean;
  metadata?: JsonValue;
}

export interface KitAssignment {
  id: string;
  tenantId: string;
  kitId: string;
  variantId?: string | null;
  externalRef: string;
  notes?: string | null;
  metadata?: JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKitAssignmentInput {
  tenantId: string;
  kitId: string;
  variantId?: string | null;
  externalRef: string;
  notes?: string | null;
  metadata?: JsonValue;
}

export interface CreateKitOverrideLogInput {
  tenantId: string;
  assignmentId: string;
  itemId?: string | null;
  reason: string;
  delta?: JsonValue;
  metadata?: JsonValue;
}
