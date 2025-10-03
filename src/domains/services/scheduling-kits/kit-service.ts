import {
  CreateKitAssignmentInput,
  CreateKitInput,
  CreateKitOverrideLogInput,
  KitAssignment,
  KitDetail,
  KitVariant,
} from '@/domains/lib/scheduling-kits/kit-types';

export interface KitServiceDependencies {
  kitRepository: {
    createKit: (input: CreateKitInput, tenantId: string) => Promise<KitDetail>;
    listKits: (tenantId: string) => Promise<KitDetail[]>;
    getKitById: (kitId: string, tenantId: string) => Promise<KitDetail | null>;
    findActiveKitByCode: (tenantId: string, kitCode: string) => Promise<KitDetail | null>;
  };
  kitVariantRepository: {
    listVariantsForKit: (tenantId: string, kitId: string) => Promise<KitVariant[]>;
  };
  kitAssignmentRepository: {
    createAssignment: (input: CreateKitAssignmentInput) => Promise<KitAssignment>;
    findByExternalRef: (tenantId: string, externalRef: string) => Promise<KitAssignment | null>;
  };
  kitOverrideLogRepository: {
    createOverride: (input: CreateKitOverrideLogInput) => Promise<{ id: string }>;
  };
  clock: {
    now: () => Date;
  };
}

export class KitService {
  constructor(private readonly deps: KitServiceDependencies) {}

  async createKitWithSteps(input: CreateKitInput, tenantId: string): Promise<KitDetail> {
    if (!input.items.length) {
      throw new Error('At least one kit item is required');
    }

    const created = await this.deps.kitRepository.createKit(input, tenantId);
    return created;
  }

  listKits(tenantId: string): Promise<KitDetail[]> {
    return this.deps.kitRepository.listKits(tenantId);
  }

  async getKitOrThrow(tenantId: string, kitId: string): Promise<KitDetail> {
    const kit = await this.deps.kitRepository.getKitById(kitId, tenantId);
    if (!kit) {
      throw new Error('Kit not found');
    }
    return kit;
  }

  async assignKitByCode(params: {
    tenantId: string;
    kitCode: string;
    externalRef: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KitAssignment> {
    const kit = await this.deps.kitRepository.findActiveKitByCode(params.tenantId, params.kitCode);
    if (!kit) {
      throw new Error(`Kit ${params.kitCode} is not available for company ${params.tenantId}`);
    }

    const variants = await this.deps.kitVariantRepository.listVariantsForKit(params.tenantId, kit.id);
    const defaultVariant = variants.find((variant) => variant.isDefault) ?? null;

    const payload: CreateKitAssignmentInput = {
      tenantId: params.tenantId,
      kitId: kit.id,
      variantId: defaultVariant?.id ?? null,
      externalRef: params.externalRef,
      notes: params.notes ?? null,
      metadata: {
        ...(params.metadata ?? {}),
        assignedAt: this.deps.clock.now().toISOString(),
        kitCode: kit.kitCode,
      },
    };

    return this.deps.kitAssignmentRepository.createAssignment(payload);
  }

  async recordOverride(input: CreateKitOverrideLogInput): Promise<{ id: string }> {
    if (!input.reason.trim()) {
      throw new Error('Override reason is required');
    }

    return this.deps.kitOverrideLogRepository.createOverride({
      ...input,
      delta: input.delta ?? {},
      metadata: input.metadata ?? {},
    });
  }
}
