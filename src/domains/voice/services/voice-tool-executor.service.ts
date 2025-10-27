/**
 * @file Voice Tool Executor Service
 * @purpose Execute function calls from Gemini Live API with database access
 * @phase 3
 * @domain Voice
 */

import { createClient } from '@/lib/supabase/server';
import { ToolCall, ToolResponse } from './gemini-live.service';

export interface ToolExecutionContext {
  userId: string;
  tenantId: string;
}

/**
 * Execute tool calls with database access
 */
export class VoiceToolExecutor {
  private context: ToolExecutionContext;

  constructor(context: ToolExecutionContext) {
    this.context = context;
  }

  /**
   * Execute a tool call and return response
   */
  async execute(toolCall: ToolCall): Promise<ToolResponse> {
    const responses = [];

    for (const fn of toolCall.functionCalls) {
      console.log(`[ToolExecutor] Executing function: ${fn.name}`, fn.args);

      try {
        let result;

        switch (fn.name) {
          case 'search_inventory':
            result = await this.searchInventory(fn.args);
            break;

          case 'get_inventory_details':
            result = await this.getInventoryDetails(fn.args);
            break;

          case 'create_material':
            result = await this.createMaterial(fn.args);
            break;

          case 'create_tool':
            result = await this.createTool(fn.args);
            break;

          case 'create_vehicle':
            result = await this.createVehicle(fn.args);
            break;

          case 'check_out_equipment':
            result = await this.checkOutEquipment(fn.args);
            break;

          case 'check_in_equipment':
            result = await this.checkInEquipment(fn.args);
            break;

          case 'get_available_jobs':
            result = await this.getAvailableJobs();
            break;

          default:
            throw new Error(`Unknown function: ${fn.name}`);
        }

        responses.push({
          id: fn.id,
          name: fn.name,
          response: result,
        });
      } catch (error) {
        console.error(`[ToolExecutor] Error executing ${fn.name}:`, error);
        responses.push({
          id: fn.id,
          name: fn.name,
          response: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    return { functionResponses: responses };
  }

  /**
   * Search for inventory items
   */
  private async searchInventory(args: { searchTerm: string; category?: string }) {
    const supabase = await createClient();

    let query = supabase
      .from('equipment')
      .select('id, name, category, current_quantity, location_name, unit')
      .eq('tenant_id', this.context.tenantId)
      .ilike('name', `%${args.searchTerm}%`)
      .order('name')
      .limit(5);

    if (args.category) {
      query = query.eq('category', args.category);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      found: data.length > 0,
      count: data.length,
      items: data.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.current_quantity,
        location: item.location_name,
        unit: item.unit,
      })),
    };
  }

  /**
   * Get detailed information about an item
   */
  private async getInventoryDetails(args: { itemId: string }) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('id', args.itemId)
      .eq('tenant_id', this.context.tenantId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Item not found' };
    }

    return {
      success: true,
      item: {
        id: data.id,
        name: data.name,
        category: data.category,
        quantity: data.current_quantity,
        location: data.location_name,
        unit: data.unit,
        serialNumber: data.serial_number,
        createdAt: data.created_at,
      },
    };
  }

  /**
   * Create new material
   */
  private async createMaterial(args: {
    name: string;
    category?: string;
    initialQuantity?: number;
    unit?: string;
  }) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('equipment')
      .insert({
        name: args.name,
        category: args.category || 'material',
        current_quantity: args.initialQuantity || 0,
        unit: args.unit || 'units',
        location_name: 'Warehouse',
        tenant_id: this.context.tenantId,
        created_by: this.context.userId,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      material: {
        id: data.id,
        name: data.name,
        category: data.category,
        quantity: data.current_quantity,
      },
    };
  }

  /**
   * Create new tool
   */
  private async createTool(args: {
    name: string;
    category?: string;
    serialNumber?: string;
  }) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('equipment')
      .insert({
        name: args.name,
        category: args.category || 'tool',
        current_quantity: 1,
        unit: 'units',
        serial_number: args.serialNumber,
        location_name: 'Warehouse',
        tenant_id: this.context.tenantId,
        created_by: this.context.userId,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      tool: {
        id: data.id,
        name: data.name,
        category: data.category,
        serialNumber: data.serial_number,
      },
    };
  }

  /**
   * Create new vehicle
   */
  private async createVehicle(args: {
    name: string;
    vehicleType?: string;
    licensePlate?: string;
    vin?: string;
  }) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('equipment')
      .insert({
        name: args.name,
        category: args.vehicleType || 'vehicle',
        current_quantity: 1,
        unit: 'units',
        location_name: 'Yard',
        tenant_id: this.context.tenantId,
        created_by: this.context.userId,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      vehicle: {
        id: data.id,
        name: data.name,
        category: data.category,
      },
    };
  }

  /**
   * Check out equipment to a job
   */
  private async checkOutEquipment(args: {
    itemId: string;
    jobId: string;
    quantity: number;
  }) {
    const supabase = await createClient();

    // First, verify item exists and has enough quantity
    const { data: item, error: itemError } = await supabase
      .from('equipment')
      .select('current_quantity, name')
      .eq('id', args.itemId)
      .eq('tenant_id', this.context.tenantId)
      .single();

    if (itemError || !item) {
      return { success: false, error: 'Item not found' };
    }

    if (item.current_quantity < args.quantity) {
      return {
        success: false,
        error: `Insufficient quantity. Available: ${item.current_quantity}`,
      };
    }

    // Create transaction
    const { error: transactionError } = await supabase.from('equipment_transactions').insert({
      equipment_id: args.itemId,
      job_id: args.jobId,
      transaction_type: 'check_out',
      quantity: args.quantity,
      user_id: this.context.userId,
      tenant_id: this.context.tenantId,
    });

    if (transactionError) {
      return { success: false, error: transactionError.message };
    }

    // Update quantity
    const { error: updateError } = await supabase
      .from('equipment')
      .update({
        current_quantity: item.current_quantity - args.quantity,
      })
      .eq('id', args.itemId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      checkedOut: {
        itemName: item.name,
        quantity: args.quantity,
        remainingQuantity: item.current_quantity - args.quantity,
      },
    };
  }

  /**
   * Check in equipment from a job
   */
  private async checkInEquipment(args: {
    itemId: string;
    jobId: string;
    quantity: number;
  }) {
    const supabase = await createClient();

    // Get current quantity
    const { data: item, error: itemError } = await supabase
      .from('equipment')
      .select('current_quantity, name')
      .eq('id', args.itemId)
      .eq('tenant_id', this.context.tenantId)
      .single();

    if (itemError || !item) {
      return { success: false, error: 'Item not found' };
    }

    // Create transaction
    const { error: transactionError } = await supabase.from('equipment_transactions').insert({
      equipment_id: args.itemId,
      job_id: args.jobId,
      transaction_type: 'check_in',
      quantity: args.quantity,
      user_id: this.context.userId,
      tenant_id: this.context.tenantId,
    });

    if (transactionError) {
      return { success: false, error: transactionError.message };
    }

    // Update quantity
    const { error: updateError } = await supabase
      .from('equipment')
      .update({
        current_quantity: item.current_quantity + args.quantity,
      })
      .eq('id', args.itemId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      checkedIn: {
        itemName: item.name,
        quantity: args.quantity,
        newQuantity: item.current_quantity + args.quantity,
      },
    };
  }

  /**
   * Get available jobs
   */
  private async getAvailableJobs() {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('jobs')
      .select('id, title, status, customer_name')
      .eq('tenant_id', this.context.tenantId)
      .in('status', ['scheduled', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      count: data.length,
      jobs: data.map((job) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        customer: job.customer_name,
      })),
    };
  }
}
