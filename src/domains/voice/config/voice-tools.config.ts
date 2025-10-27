/**
 * @file Voice Tools Configuration
 * @purpose Function declarations for Gemini Live API tools
 * @phase 3
 * @domain Voice
 */

import { FunctionDeclaration, ToolDeclaration } from '../services/gemini-live.service';

/**
 * Search inventory by name
 */
const searchInventory: FunctionDeclaration = {
  name: 'search_inventory',
  description:
    'Search for materials, tools, equipment, or vehicles in inventory by name. Use this to check if an item exists before creating it, or to find items for check-out/check-in operations.',
  parameters: {
    type: 'object',
    properties: {
      searchTerm: {
        type: 'string',
        description:
          'The name or partial name of the item to search for (e.g., "hammer", "fertilizer", "truck")',
      },
      category: {
        type: 'string',
        enum: ['material', 'tool', 'vehicle', 'equipment'],
        description: 'Optional: Filter by category type',
      },
    },
    required: ['searchTerm'],
  },
};

/**
 * Get detailed information about a specific item
 */
const getInventoryDetails: FunctionDeclaration = {
  name: 'get_inventory_details',
  description:
    'Get detailed information about a specific inventory item including current quantity, location, and transaction history.',
  parameters: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'The unique ID of the inventory item',
      },
    },
    required: ['itemId'],
  },
};

/**
 * Create new material
 */
const createMaterial: FunctionDeclaration = {
  name: 'create_material',
  description:
    'Add a new material (fertilizer, chemical, seed, etc.) to inventory. Only use after confirming the item does not already exist.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the material (e.g., "Superthrive Fertilizer")',
      },
      category: {
        type: 'string',
        enum: ['fertilizer', 'chemical', 'seed', 'mulch', 'soil', 'other'],
        description: 'Category of material',
      },
      initialQuantity: {
        type: 'number',
        description: 'Starting quantity in inventory (optional, defaults to 0)',
      },
      unit: {
        type: 'string',
        enum: ['bags', 'gallons', 'pounds', 'units'],
        description: 'Unit of measurement',
      },
    },
    required: ['name'],
  },
};

/**
 * Create new tool
 */
const createTool: FunctionDeclaration = {
  name: 'create_tool',
  description:
    'Add a new tool or equipment (hammer, drill, mower, etc.) to inventory. Only use after confirming the item does not already exist.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the tool (e.g., "Cordless Drill", "Lawn Mower")',
      },
      category: {
        type: 'string',
        enum: ['hand_tool', 'power_tool', 'mower', 'trimmer', 'blower', 'other'],
        description: 'Category of tool',
      },
      serialNumber: {
        type: 'string',
        description: 'Optional serial number for tracking',
      },
    },
    required: ['name'],
  },
};

/**
 * Create new vehicle
 */
const createVehicle: FunctionDeclaration = {
  name: 'create_vehicle',
  description:
    'Add a new vehicle (truck, trailer, etc.) to inventory. Only use after confirming the vehicle does not already exist.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name/identifier of the vehicle (e.g., "Truck 1", "Trailer A")',
      },
      vehicleType: {
        type: 'string',
        enum: ['truck', 'trailer', 'van', 'other'],
        description: 'Type of vehicle',
      },
      licensePlate: {
        type: 'string',
        description: 'Optional license plate number',
      },
      vin: {
        type: 'string',
        description: 'Optional VIN number',
      },
    },
    required: ['name'],
  },
};

/**
 * Check out equipment to a job
 */
const checkOutEquipment: FunctionDeclaration = {
  name: 'check_out_equipment',
  description:
    'Check out materials, tools, or equipment from inventory and assign them to a specific job.',
  parameters: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'ID of the item to check out',
      },
      jobId: {
        type: 'string',
        description: 'ID of the job to assign the equipment to',
      },
      quantity: {
        type: 'number',
        description: 'Quantity to check out',
      },
    },
    required: ['itemId', 'jobId', 'quantity'],
  },
};

/**
 * Check in equipment from a job
 */
const checkInEquipment: FunctionDeclaration = {
  name: 'check_in_equipment',
  description: 'Return materials, tools, or equipment back to inventory from a job.',
  parameters: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'ID of the item to check in',
      },
      jobId: {
        type: 'string',
        description: 'ID of the job the equipment is being returned from',
      },
      quantity: {
        type: 'number',
        description: 'Quantity to check in',
      },
    },
    required: ['itemId', 'jobId', 'quantity'],
  },
};

/**
 * Get list of available jobs
 */
const getAvailableJobs: FunctionDeclaration = {
  name: 'get_available_jobs',
  description:
    'Get a list of active jobs that can receive equipment. Use this when the user wants to check out equipment but hasn\'t specified which job.',
  parameters: {
    type: 'object',
    properties: {},
  },
};

/**
 * System instruction for voice assistant
 */
export const VOICE_ASSISTANT_SYSTEM_INSTRUCTION = `
You are a voice assistant for JobEye, a construction inventory management system.

Your primary role is to help supervisors and crew members manage their inventory through natural voice conversations.

IMPORTANT RULES:

1. **Search Before Creating**: ALWAYS search for an item before creating a new one to avoid duplicates.
   Example: User says "add hammer" → Call search_inventory first → If not found, then ask to create

2. **Explicit Confirmation**: Before ANY create/update/delete operation, ALWAYS ask for explicit verbal confirmation.
   Example: "I didn't find that item. Should I add it as a new [tool/material/vehicle]?"
   Wait for "yes", "confirm", "do it", "go ahead" before proceeding.

3. **Gather Details Naturally**: If the user doesn't provide all details, ask follow-up questions conversationally.
   Example: User says "add fertilizer" → You ask "What's the name of the fertilizer?"

4. **Be Proactive with Jobs**: If user wants to check out equipment but doesn't mention a job, call get_available_jobs and ask which one.
   Example: "I see you have 3 active jobs. Which one should I assign this to?"

5. **Confirm After Actions**: After successful operations, clearly confirm what was done.
   Example: "I've added the Superthrive Fertilizer to your inventory with 10 bags."

6. **Handle Ambiguity**: If the request is unclear, ask clarifying questions.
   Example: User says "update inventory" → You ask "What would you like to update?"

7. **Be Concise**: Keep responses short and conversational. Speak naturally, not like a robot.

8. **Error Handling**: If something fails, explain why in simple terms and suggest next steps.
   Example: "I couldn't add that because we already have an item with that name. Would you like to update the existing one?"

CONVERSATION EXAMPLES:

Example 1: Adding New Material
User: "add new material"
You: "What's the name of the material?"
User: "superthrive fertilizer"
You: [Call search_inventory] → Not found
You: "I don't see Superthrive Fertilizer in inventory. Should I add it as a new material?"
User: "yes"
You: [Call create_material] → Success
You: "I've added Superthrive Fertilizer to your materials inventory."

Example 2: Checking Out Equipment
User: "check out the lawn mower"
You: [Call search_inventory] → Found
You: [Call get_available_jobs] → Returns 2 jobs
You: "I found the lawn mower. You have 2 active jobs: Smith Residence and Park Maintenance. Which one should I assign it to?"
User: "smith residence"
You: [Call check_out_equipment] → Success
You: "The lawn mower has been checked out to Smith Residence."

Be helpful, accurate, and always prioritize data integrity by avoiding duplicate entries.
`;

/**
 * All tool declarations for JobEye
 */
export const JOBEYE_TOOLS: ToolDeclaration[] = [
  {
    functionDeclarations: [
      searchInventory,
      getInventoryDetails,
      createMaterial,
      createTool,
      createVehicle,
      checkOutEquipment,
      checkInEquipment,
      getAvailableJobs,
    ],
  },
];
