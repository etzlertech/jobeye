# Realtime Voice API Research: OpenAI vs Gemini Live

**Date**: 2025-10-27
**Purpose**: Evaluate OpenAI Realtime API and Gemini Live API for fluid voice conversations with real-time database access
**Author**: Research conducted for JobEye Voice Command Center enhancement

---

## Executive Summary

Both OpenAI Realtime API and Gemini Live API support:
- ✅ **WebSocket-based bidirectional streaming** (audio in/out)
- ✅ **Native function calling** (tools can be called during conversation)
- ✅ **Asynchronous tool execution** (conversation continues while tools run)
- ✅ **Real-time database access** (via custom function definitions)
- ✅ **CRUD execution** (through tool callbacks)

**Recommendation**: **Gemini Live API** is the better fit for JobEye due to:
1. Already using Gemini Flash for intent classification (consistency)
2. Lower cost (~$0.0015/min vs $0.06-0.24/min for OpenAI)
3. Better multilingual support (construction industry needs Spanish)
4. Half-cascade architecture option for production reliability
5. Native integration with Google Cloud (if needed for scaling)

---

## API Comparison

| Feature | OpenAI Realtime API | Gemini Live API |
|---------|-------------------|-----------------|
| **Model** | gpt-realtime (GPT-4o based) | Gemini 2.5 Flash Live |
| **Connection** | WebSocket | WebSocket |
| **Audio I/O** | Native (24kHz PCM16) | Native or Half-cascade |
| **Function Calling** | ✅ Yes (improved Feb 2025) | ✅ Yes (async support) |
| **Interruption Handling** | ✅ Yes | ✅ Yes (improved) |
| **Voice Activity Detection** | Built-in | Built-in |
| **Cost (per minute)** | $0.06 (input) + $0.24 (output) | ~$0.0015 |
| **Latency** | Very low | Very low |
| **Max Session Duration** | Unlimited (as of Feb 2025) | Based on pricing tier |
| **Offline Fallback** | ❌ Requires internet | ❌ Requires internet |
| **Client-to-Server** | ⚠️ Not recommended for production | ✅ Recommended with ephemeral tokens |

---

## Architecture: How Function Calling Works

### High-Level Flow

```
┌─────────────┐         ┌──────────────┐         ┌───────────────┐
│   User      │ Audio   │  Realtime    │ Tools   │  Your Server  │
│  (Browser)  │────────>│  API         │────────>│  (Next.js)    │
│             │<────────│ (WebSocket)  │<────────│               │
└─────────────┘         └──────────────┘         └───────────────┘
                              │                          │
                              │                          ├─> Supabase DB
                              │                          ├─> Intent Classification
                              │                          └─> CRUD Execution
```

### Function Calling Sequence (Gemini Live Example)

```typescript
// 1. User speaks: "add new material called superthrive fertilizer"

// 2. API transcribes and detects intent (real-time)

// 3. API calls your function (tool)
{
  "toolCall": {
    "functionCalls": [
      {
        "name": "check_inventory_items",
        "args": { "searchTerm": "superthrive" }
      }
    ]
  }
}

// 4. Your server executes function
const items = await supabase
  .from('equipment')
  .select('*')
  .ilike('name', '%superthrive%');

// 5. You send result back to API
{
  "toolResponse": {
    "functionResponses": [
      {
        "name": "check_inventory_items",
        "response": { "found": false, "suggestions": [] }
      }
    ]
  }
}

// 6. API speaks: "I didn't find that in inventory. Should I add it as new?"

// 7. User confirms: "yes"

// 8. API calls create function
{
  "toolCall": {
    "functionCalls": [
      {
        "name": "create_material",
        "args": {
          "name": "superthrive fertilizer",
          "category": "fertilizer"
        }
      }
    ]
  }
}

// 9. Your server creates record
const newItem = await supabase
  .from('equipment')
  .insert({ name: "superthrive fertilizer", ... });

// 10. API confirms: "I've added superthrive fertilizer to inventory"
```

---

## Proposed Architecture for JobEye

### Option A: Server-Side WebSocket Relay (Recommended)

```typescript
/**
 * Architecture:
 * 1. Browser connects to YOUR Next.js server via WebSocket
 * 2. Your server connects to Gemini Live API
 * 3. Your server handles all function calls and database access
 * 4. Audio streams through your server (relay)
 */

// /src/app/api/voice/realtime/route.ts
export async function GET(req: NextRequest) {
  // Upgrade HTTP to WebSocket
  const upgrade = req.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  // Accept client connection
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Connect to Gemini Live API
  const geminiWs = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent', {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GOOGLE_GEMINI_API_KEY,
    }
  });

  // Setup message relay
  clientSocket.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    // If audio data, forward to Gemini
    if (message.type === 'audio') {
      geminiWs.send(JSON.stringify({
        realtimeInput: {
          mediaChunks: [{ mimeType: 'audio/pcm', data: message.audio }]
        }
      }));
    }
  };

  // Handle Gemini responses
  geminiWs.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    // If tool call, execute locally
    if (message.toolCall) {
      const result = await executeToolCall(message.toolCall, req);

      // Send result back to Gemini
      geminiWs.send(JSON.stringify({
        toolResponse: result
      }));
    }

    // If audio output, forward to client
    if (message.serverContent?.modelTurn?.parts) {
      clientSocket.send(JSON.stringify({
        type: 'audio',
        audio: message.serverContent.modelTurn.parts[0].inlineData.data
      }));
    }
  };

  return response;
}

/**
 * Tool execution with database access
 */
async function executeToolCall(toolCall: any, req: NextRequest) {
  const context = await getRequestContext(req);
  const { user, tenantId } = context;

  for (const fn of toolCall.functionCalls) {
    switch (fn.name) {
      case 'search_inventory':
        return await searchInventory(fn.args, tenantId);

      case 'get_inventory_details':
        return await getInventoryDetails(fn.args, tenantId);

      case 'create_material':
        return await createMaterial(fn.args, user.id, tenantId);

      case 'check_material_availability':
        return await checkAvailability(fn.args, tenantId);

      case 'confirm_action':
        return { confirmed: true };

      default:
        throw new Error(`Unknown function: ${fn.name}`);
    }
  }
}

/**
 * Database access functions (tools)
 */
async function searchInventory(args: any, tenantId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('equipment')
    .select('id, name, category, current_quantity, location_name')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${args.searchTerm}%`)
    .limit(5);

  return {
    name: 'search_inventory',
    response: {
      found: data.length > 0,
      items: data.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.current_quantity,
        location: item.location_name
      }))
    }
  };
}

async function createMaterial(args: any, userId: string, tenantId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('equipment')
    .insert({
      name: args.name,
      category: args.category || 'material',
      current_quantity: args.quantity || 0,
      tenant_id: tenantId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    return {
      name: 'create_material',
      response: { success: false, error: error.message }
    };
  }

  return {
    name: 'create_material',
    response: {
      success: true,
      material: { id: data.id, name: data.name }
    }
  };
}
```

### Option B: Client-to-Server (Direct, Lower Latency)

```typescript
/**
 * Architecture:
 * 1. Browser connects DIRECTLY to Gemini Live API
 * 2. Use ephemeral tokens for security
 * 3. Function calls proxy through your server via HTTP
 */

// Client-side (browser)
const ws = new WebSocket('wss://generativelanguage.googleapis.com/ws/...');

ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);

  // If tool call, call our server
  if (message.toolCall) {
    const response = await fetch('/api/voice/tools', {
      method: 'POST',
      body: JSON.stringify(message.toolCall)
    });

    const result = await response.json();

    // Send result back to Gemini
    ws.send(JSON.stringify({
      toolResponse: result
    }));
  }
};

// Server endpoint for tool execution
// /src/app/api/voice/tools/route.ts
export async function POST(req: NextRequest) {
  const toolCall = await req.json();
  const result = await executeToolCall(toolCall, req);
  return NextResponse.json(result);
}
```

---

## Tool Definitions for JobEye

### Function Declarations to Register with API

```typescript
const JOBEYE_TOOLS = [
  {
    name: 'search_inventory',
    description: 'Search for materials, tools, or equipment in inventory by name',
    parameters: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Material/tool name to search for (e.g. "superthrive", "hammer")'
        },
        category: {
          type: 'string',
          enum: ['material', 'tool', 'vehicle', 'equipment'],
          description: 'Optional category filter'
        }
      },
      required: ['searchTerm']
    }
  },

  {
    name: 'get_inventory_details',
    description: 'Get detailed information about a specific inventory item',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: 'The ID of the inventory item'
        }
      },
      required: ['itemId']
    }
  },

  {
    name: 'create_material',
    description: 'Add a new material to inventory',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the material'
        },
        category: {
          type: 'string',
          enum: ['fertilizer', 'chemical', 'seed', 'other'],
          description: 'Category of material'
        },
        initialQuantity: {
          type: 'number',
          description: 'Starting quantity (optional)'
        }
      },
      required: ['name']
    }
  },

  {
    name: 'check_out_equipment',
    description: 'Check out equipment to a job',
    parameters: {
      type: 'object',
      properties: {
        itemName: {
          type: 'string',
          description: 'Name of equipment to check out'
        },
        jobId: {
          type: 'string',
          description: 'Job ID to assign equipment to'
        },
        quantity: {
          type: 'number',
          description: 'Quantity to check out'
        }
      },
      required: ['itemName', 'jobId', 'quantity']
    }
  },

  {
    name: 'get_available_jobs',
    description: 'Get list of active jobs that can receive equipment',
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  {
    name: 'confirm_action',
    description: 'Get user confirmation before executing a CRUD operation',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Description of action to confirm'
        }
      },
      required: ['action']
    }
  }
];
```

---

## How Clarification Works with Realtime APIs

The AI can ask clarification questions **naturally during conversation** without explicit "clarification flow":

### Example Conversation Flow

```
User: "add new material"
  ↓
API: [Calls search_inventory({ searchTerm: "" })]
  ↓ [Empty search, needs clarification]
API: "What's the name of the material you'd like to add?"
  ↓
User: "superthrive fertilizer"
  ↓
API: [Calls search_inventory({ searchTerm: "superthrive" })]
  ↓ [Not found]
API: [Calls get_available_categories()]
  ↓ [Returns: fertilizer, chemical, seed]
API: "I don't see that in inventory. It looks like a fertilizer. Should I add it to the fertilizer category?"
  ↓
User: "yes"
  ↓
API: [Calls create_material({ name: "superthrive fertilizer", category: "fertilizer" })]
  ↓ [Success]
API: "I've added superthrive fertilizer to your inventory."
```

**Key Insight**: The API handles the clarification loop **naturally** by calling tools multiple times during a single conversation. You don't need explicit clarification modals!

---

## How Confirmation Works

### Option 1: Implicit Confirmation (Tool-Based)

```typescript
// Define a confirm_action tool
{
  name: 'confirm_action',
  description: 'Request user confirmation before executing destructive operations',
  parameters: {
    action: 'string', // "create material: superthrive fertilizer"
    consequences: 'string' // "This will add a new item to inventory"
  }
}

// Conversation:
// API: "Should I add superthrive fertilizer to inventory?" [Calls confirm_action]
// User: "yes" → Tool returns { confirmed: true }
// API: [Calls create_material]
```

### Option 2: System Instructions (Preferred)

```typescript
const SYSTEM_INSTRUCTIONS = `
You are a voice assistant for JobEye, a construction inventory management system.

IMPORTANT RULES:
1. Before ANY create/update/delete operation, ALWAYS ask for explicit confirmation
2. Clearly state what will happen: "I'll add [X] to inventory. Is that correct?"
3. Wait for "yes", "confirm", "do it" before proceeding
4. If user says "no", "cancel", "wait" - stop and ask what they want to do instead
5. After successful operations, confirm what was done

Example:
User: "add new material called paint"
You: [Call search_inventory] → not found
You: "I don't see paint in inventory. Should I add it as a new material?"
User: "yes"
You: [Call create_material] → success
You: "I've added paint to your inventory."
`;
```

**Recommendation**: Use **Option 2 (System Instructions)** because:
- More natural conversation flow
- Easier to customize confirmation behavior
- No need for extra tool definitions
- Works across all CRUD operations consistently

---

## Cost Comparison

### Current Browser-Based Approach
- **STT**: Free (browser Web Speech API)
- **Intent**: ~$0.00015 per request (Gemini Flash text)
- **TTS**: Free (browser Speech Synthesis API)
- **Total per command**: ~$0.00015

### Gemini Live API Approach
- **Audio I/O + Processing**: ~$0.0015 per minute
- **Function calls**: Included
- **Average conversation**: 30 seconds = ~$0.00075
- **Total per command**: ~$0.00075 (5x current cost)

### OpenAI Realtime API Approach
- **Input audio**: $0.06 per minute
- **Output audio**: $0.24 per minute
- **Average conversation**: 30 seconds = $0.15
- **Total per command**: ~$0.15 (1000x current cost ❌)

**Cost Verdict**: Gemini Live is **affordable** at 5x current cost. OpenAI Realtime is **prohibitively expensive** for high-volume use.

---

## Offline/Weak Signal Fallback Strategy

### Hybrid Architecture

```typescript
/**
 * Connection quality detection
 */
async function detectConnectionQuality(): Promise<'excellent' | 'good' | 'poor' | 'offline'> {
  if (!navigator.onLine) return 'offline';

  // Test connection speed
  const start = Date.now();
  try {
    await fetch('/api/ping', { method: 'HEAD' });
    const latency = Date.now() - start;

    if (latency < 100) return 'excellent';
    if (latency < 300) return 'good';
    return 'poor';
  } catch {
    return 'offline';
  }
}

/**
 * Adaptive voice mode selection
 */
export function useAdaptiveVoice() {
  const [mode, setMode] = useState<'realtime' | 'browser'>('browser');

  useEffect(() => {
    const checkConnection = async () => {
      const quality = await detectConnectionQuality();

      // Use realtime API only with excellent connection
      if (quality === 'excellent' || quality === 'good') {
        setMode('realtime');
      } else {
        setMode('browser'); // Fallback to current approach
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10s

    return () => clearInterval(interval);
  }, []);

  return {
    mode,
    useRealtimeAPI: mode === 'realtime',
    useBrowserSTT: mode === 'browser'
  };
}

/**
 * Usage in Voice Command Center
 */
export default function VoiceCommandCenterPage() {
  const { mode, useRealtimeAPI } = useAdaptiveVoice();

  if (useRealtimeAPI) {
    return <GeminiLiveVoiceUI />; // New realtime component
  }

  return <CurrentBrowserVoiceUI />; // Existing component
}
```

### Graceful Degradation

```typescript
/**
 * If connection drops during realtime session
 */
geminiWs.onclose = () => {
  toast.warning('Connection lost. Switching to offline mode...');

  // Save partial conversation state
  saveConversationState(conversationHistory);

  // Switch to browser-based mode
  setMode('browser');
};

/**
 * Resume from saved state
 */
function resumeConversation(savedState: ConversationState) {
  // Load previous context
  const context = {
    previousIntent: savedState.lastIntent,
    gatheredEntities: savedState.entities,
    conversationHistory: savedState.messages
  };

  // Continue with browser STT/TTS
  processVoiceCommand(context);
}
```

---

## Migration Plan

### Phase 1: Add Gemini Live API (Parallel)
- ✅ Keep existing browser-based voice system
- ✅ Add new `/api/voice/realtime` endpoint
- ✅ Create new `<GeminiLiveVoiceUI>` component
- ✅ Add connection quality detection
- ✅ Feature flag: `ENABLE_REALTIME_VOICE`

### Phase 2: Test with Beta Users
- ✅ Enable realtime mode for supervisors only
- ✅ Monitor costs, latency, success rates
- ✅ Compare user satisfaction vs browser mode
- ✅ Iterate on tool definitions

### Phase 3: Gradual Rollout
- ✅ Enable for all users with good connection
- ✅ Keep browser mode as fallback
- ✅ Monitor adoption and cost

### Phase 4: Optimize
- ✅ Add conversation caching
- ✅ Optimize function call frequency
- ✅ Add voice activity detection tuning
- ✅ Consider half-cascade mode for production

---

## Code Changes Required

### New Files to Create

```
/src/domains/voice/services/
  ├── gemini-live.service.ts          # WebSocket connection management
  ├── realtime-audio.service.ts       # Audio encoding/decoding
  └── tool-executor.service.ts        # Function call routing

/src/app/api/voice/
  ├── realtime/route.ts               # WebSocket upgrade endpoint
  └── tools/route.ts                  # Tool execution endpoint (Option B)

/src/components/voice/
  ├── GeminiLiveVoiceUI.tsx          # New realtime voice UI
  └── ConnectionQualityIndicator.tsx  # Show connection status

/src/hooks/
  ├── use-gemini-live.ts             # Hook for Gemini Live WebSocket
  └── use-adaptive-voice.ts          # Connection quality detection
```

### Files to Modify

```
/src/app/voice/page.tsx
  - Add mode switching logic
  - Render appropriate UI component

/src/domains/intent/services/gemini-intent.service.ts
  - Keep for browser mode fallback
  - Add session context for realtime mode

/src/domains/inventory/services/inventory-voice-orchestrator.service.ts
  - Refactor to be callable from both browser and realtime modes
  - Extract pure functions for tool execution
```

---

## Recommendation: Gemini Live API (Half-Cascade Mode)

### Why Gemini Live?
1. ✅ **Already using Gemini ecosystem** - consistency with intent classification
2. ✅ **5x cost vs 1000x cost** - Gemini is affordable, OpenAI is not
3. ✅ **Better production reliability** - Half-cascade mode
4. ✅ **Client-to-server support** - Lower latency with ephemeral tokens
5. ✅ **Async function calling** - Conversation continues during tool execution
6. ✅ **Multilingual** - Important for construction industry (Spanish support)

### Architecture Choice: Server-Side Relay
- ✅ Full control over function execution
- ✅ Secure (API key never exposed)
- ✅ Easier debugging and logging
- ✅ Can add rate limiting, caching
- ⚠️ Slightly higher latency (~50-100ms) but acceptable

### Feature Flag Strategy
```typescript
// .env.local
ENABLE_REALTIME_VOICE=true  # Feature flag
GEMINI_LIVE_MODE=half-cascade  # native | half-cascade
REALTIME_CONNECTION_THRESHOLD=good  # excellent | good | poor
```

---

## Next Steps

1. **Prototype Server-Side Relay** (1-2 days)
   - Implement `/api/voice/realtime` WebSocket endpoint
   - Test basic audio streaming
   - Verify function calling works

2. **Define Tool Schema** (1 day)
   - Map existing CRUD operations to tools
   - Test with hardcoded conversations
   - Validate database access patterns

3. **Build GeminiLiveVoiceUI Component** (2-3 days)
   - Audio capture and playback
   - WebSocket connection management
   - Visual feedback (waveforms, status)

4. **Add Connection Detection** (1 day)
   - Implement quality monitoring
   - Add graceful fallback
   - Test switching between modes

5. **Beta Testing** (1 week)
   - Enable for internal users
   - Monitor costs and performance
   - Gather user feedback

**Total Estimated Effort**: 1-2 weeks for MVP, 3-4 weeks for production-ready

---

## Questions to Answer

1. **Session Management**: How long should WebSocket sessions last? Auto-disconnect after inactivity?
2. **Error Handling**: What happens if function call fails? How to retry?
3. **Conversation History**: Store in database or keep ephemeral?
4. **Multi-User**: Can multiple users share a session (supervisor + crew)?
5. **Analytics**: What metrics to track? (session duration, function call frequency, success rates)

---

## Appendices

### A. Gemini Live API WebSocket Message Format

```typescript
// Client → API (Audio Input)
{
  "clientContent": {
    "turns": [
      {
        "role": "user",
        "parts": [
          {
            "inlineData": {
              "mimeType": "audio/pcm",
              "data": "base64_audio_data"
            }
          }
        ]
      }
    ]
  }
}

// Client → API (Tool Response)
{
  "toolResponse": {
    "functionResponses": [
      {
        "name": "search_inventory",
        "response": {
          "found": true,
          "items": [...]
        }
      }
    ]
  }
}

// API → Client (Audio Output)
{
  "serverContent": {
    "modelTurn": {
      "parts": [
        {
          "inlineData": {
            "mimeType": "audio/pcm",
            "data": "base64_audio_data"
          }
        }
      ]
    }
  }
}

// API → Client (Tool Call)
{
  "toolCall": {
    "functionCalls": [
      {
        "name": "search_inventory",
        "args": {
          "searchTerm": "superthrive"
        },
        "id": "call_123"
      }
    ]
  }
}
```

### B. OpenAI Realtime API Event Format

```typescript
// Client → API (Audio Input)
{
  "type": "input_audio_buffer.append",
  "audio": "base64_audio_data"
}

// Client → API (Commit Audio)
{
  "type": "input_audio_buffer.commit"
}

// API → Client (Audio Output)
{
  "type": "response.audio.delta",
  "delta": "base64_audio_chunk"
}

// API → Client (Function Call)
{
  "type": "response.function_call_arguments.done",
  "call_id": "call_123",
  "name": "search_inventory",
  "arguments": "{\"searchTerm\":\"superthrive\"}"
}

// Client → API (Function Result)
{
  "type": "conversation.item.create",
  "item": {
    "type": "function_call_output",
    "call_id": "call_123",
    "output": "{\"found\":true,\"items\":[...]}"
  }
}
```

---

**End of Research Document**
