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
    createKit: (input: CreateKitInput, companyId: string) => Promise<KitDetail>;
    listKits: (companyId: string) => Promise<KitDetail[]>;
    getKitById: (kitId: string, companyId: string) => Promise<KitDetail | null>;
    findActiveKitByCode: (companyId: string, kitCode: string) => Promise<KitDetail | null>;
  };
  kitVariantRepository: {
    listVariantsForKit: (companyId: string, kitId: string) => Promise<KitVariant[]>;
  };
  kitAssignmentRepository: {
    createAssignment: (input: CreateKitAssignmentInput) => Promise<KitAssignment>;
    findByExternalRef: (companyId: string, externalRef: string) => Promise<KitAssignment | null>;
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

  async createKitWithSteps(input: CreateKitInput, companyId: string): Promise<KitDetail> {
    if (!input.items.length) {
      throw new Error('At least one kit item is required');
    }

    const created = await this.deps.kitRepository.createKit(input, companyId);
    return created;
  }

  listKits(companyId: string): Promise<KitDetail[]> {
    return this.deps.kitRepository.listKits(companyId);
  }

  async getKitOrThrow(companyId: string, kitId: string): Promise<KitDetail> {
    const kit = await this.deps.kitRepository.getKitById(kitId, companyId);
    if (!kit) {
      throw new Error('Kit not found');
    }
    return kit;
  }

  async assignKitByCode(params: {
    companyId: string;
    kitCode: string;
    externalRef: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KitAssignment> {
    const kit = await this.deps.kitRepository.findActiveKitByCode(params.companyId, params.kitCode);
    if (!kit) {
      throw new Error(`Kit ${params.kitCode} is not available for company ${params.companyId}`);
    }

    const variants = await this.deps.kitVariantRepository.listVariantsForKit(params.companyId, kit.id);
    const defaultVariant = variants.find((variant) => variant.isDefault) ?? null;

    const payload: CreateKitAssignmentInput = {
      companyId: params.companyId,
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
