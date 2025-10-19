/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/lib/voice/taskCommands.ts
 * phase: 3.6
 * domain: voice
 * purpose: Voice command handlers for task management operations
 * spec_ref: specs/011-making-task-lists/spec.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "intentRecognition": "$0.00 (pattern matching)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/lib/voice/voice-processor',
 *     '@/domains/workflow-task/types/workflow-task-types'
 *   ],
 *   external: [],
 *   supabase: []
 * }
 * exports: ['taskVoiceCommands', 'TaskCommandHandler']
 * voice_considerations: All commands must respond within 2 seconds target
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/lib/voice/taskCommands.test.ts',
 *   e2e_tests: 'tests/e2e/task-voice-commands.spec.ts'
 * }
 * tasks: [
 *   'Implement 6 task voice command patterns',
 *   'Add task navigation (next/previous)',
 *   'Support task completion via voice',
 *   'Enable task creation via voice'
 * ]
 */

import type { VoiceCommand, VoiceResponse } from './voice-processor';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';

export interface TaskCommandHandler {
  pattern: RegExp;
  intent: string;
  description: string;
  examples: string[];
  handler: (command: VoiceCommand, match: RegExpMatchArray) => Promise<VoiceResponse>;
}

// In-memory state for task navigation (in production, would use React context)
let currentTaskList: WorkflowTask[] = [];
let currentTaskIndex = 0;
let currentJobId: string | null = null;

/**
 * Set the current job's task list for voice navigation
 */
export function setTaskContext(jobId: string, tasks: WorkflowTask[]): void {
  currentJobId = jobId;
  currentTaskList = tasks.sort((a, b) => a.task_order - b.task_order);
  currentTaskIndex = 0;
}

/**
 * Clear task context when leaving job view
 */
export function clearTaskContext(): void {
  currentJobId = null;
  currentTaskList = [];
  currentTaskIndex = 0;
}

/**
 * Get current task context
 */
export function getTaskContext(): {
  jobId: string | null;
  tasks: WorkflowTask[];
  currentIndex: number;
} {
  return {
    jobId: currentJobId,
    tasks: currentTaskList,
    currentIndex: currentTaskIndex,
  };
}

/**
 * Command 1: Show/List Tasks
 * Pattern: "show (job |)tasks", "list (job |)tasks", "what are my tasks"
 */
const showTasksHandler: TaskCommandHandler = {
  pattern: /show\s+(job\s+)?tasks|list\s+(job\s+)?tasks|what\s+are\s+(my\s+)?(the\s+)?tasks/i,
  intent: 'list_tasks',
  description: 'List all tasks for the current job',
  examples: ['show job tasks', 'list tasks', 'what are my tasks'],
  handler: async (command: VoiceCommand) => {
    if (!currentJobId || currentTaskList.length === 0) {
      return {
        text: 'No tasks available. Please navigate to a job first.',
        shouldSpeak: true,
      };
    }

    const total = currentTaskList.length;
    const completed = currentTaskList.filter((t) => t.status === 'complete').length;
    const pending = currentTaskList.filter((t) => t.status === 'pending').length;

    // Build speech response
    let speechText = `You have ${total} tasks. ${completed} complete, ${pending} pending. `;

    // List first 3 pending tasks
    const pendingTasks = currentTaskList.filter((t) => t.status === 'pending').slice(0, 3);
    if (pendingTasks.length > 0) {
      speechText += 'Next tasks: ';
      pendingTasks.forEach((task, idx) => {
        const taskNum = currentTaskList.indexOf(task) + 1;
        speechText += `Task ${taskNum}: ${task.task_description}. `;
      });
    }

    return {
      text: speechText.trim(),
      actions: [
        {
          type: 'show_task_list',
          data: { jobId: currentJobId },
        },
      ],
      shouldSpeak: true,
    };
  },
};

/**
 * Command 2: Mark Task Complete
 * Pattern: "mark task (number) complete", "complete task (number)", "task (number) done"
 */
const completeTaskHandler: TaskCommandHandler = {
  pattern: /(?:mark\s+)?task\s+(\d+)\s+(?:complete|done|finished)|complete\s+task\s+(\d+)|finish\s+task\s+(\d+)/i,
  intent: 'complete_task',
  description: 'Mark a specific task as complete',
  examples: ['mark task 1 complete', 'complete task 2', 'task 3 done'],
  handler: async (command: VoiceCommand, match: RegExpMatchArray) => {
    if (!currentJobId || currentTaskList.length === 0) {
      return {
        text: 'No tasks available. Please navigate to a job first.',
        shouldSpeak: true,
      };
    }

    // Extract task number from any capture group
    const taskNumStr = match[1] || match[2] || match[3];
    const taskNumber = parseInt(taskNumStr, 10);

    if (isNaN(taskNumber) || taskNumber < 1 || taskNumber > currentTaskList.length) {
      return {
        text: `Invalid task number. You have ${currentTaskList.length} tasks.`,
        shouldSpeak: true,
      };
    }

    const taskIndex = taskNumber - 1;
    const task = currentTaskList[taskIndex];

    if (task.status === 'complete') {
      return {
        text: `Task ${taskNumber} is already complete.`,
        shouldSpeak: true,
      };
    }

    if (task.requires_photo_verification) {
      return {
        text: `Task ${taskNumber} requires photo verification. Please upload a photo first.`,
        shouldSpeak: true,
        actions: [
          {
            type: 'request_photo_verification',
            data: { taskId: task.id, taskNumber },
          },
        ],
      };
    }

    // Update task status (trigger API call via action)
    return {
      text: `Marking task ${taskNumber}, ${task.task_description}, as complete.`,
      actions: [
        {
          type: 'complete_task',
          data: {
            jobId: currentJobId,
            taskId: task.id,
            taskNumber,
          },
        },
      ],
      shouldSpeak: true,
    };
  },
};

/**
 * Command 3: Next Task
 * Pattern: "next task", "go to next task", "move forward"
 */
const nextTaskHandler: TaskCommandHandler = {
  pattern: /next\s+task|go\s+to\s+next(\s+task)?|move\s+forward/i,
  intent: 'navigate_next',
  description: 'Navigate to the next task in the list',
  examples: ['next task', 'go to next task', 'move forward'],
  handler: async (command: VoiceCommand) => {
    if (!currentJobId || currentTaskList.length === 0) {
      return {
        text: 'No tasks available. Please navigate to a job first.',
        shouldSpeak: true,
      };
    }

    // Move to next task
    if (currentTaskIndex < currentTaskList.length - 1) {
      currentTaskIndex++;
      const task = currentTaskList[currentTaskIndex];
      const taskNumber = currentTaskIndex + 1;

      let speechText = `Task ${taskNumber}: ${task.task_description}. `;
      if (task.status === 'complete') {
        speechText += 'This task is complete. ';
      } else if (task.status === 'in-progress') {
        speechText += 'This task is in progress. ';
      } else {
        speechText += 'This task is pending. ';
      }

      if (task.acceptance_criteria) {
        speechText += `Criteria: ${task.acceptance_criteria}`;
      }

      return {
        text: speechText.trim(),
        actions: [
          {
            type: 'scroll_to_task',
            data: { taskId: task.id, taskNumber },
          },
        ],
        shouldSpeak: true,
      };
    } else {
      return {
        text: 'You are at the last task.',
        shouldSpeak: true,
      };
    }
  },
};

/**
 * Command 4: Previous Task
 * Pattern: "previous task", "go to previous task", "move back", "go back"
 */
const previousTaskHandler: TaskCommandHandler = {
  pattern: /previous\s+task|go\s+to\s+previous(\s+task)?|move\s+back|go\s+back/i,
  intent: 'navigate_prev',
  description: 'Navigate to the previous task in the list',
  examples: ['previous task', 'go to previous task', 'move back'],
  handler: async (command: VoiceCommand) => {
    if (!currentJobId || currentTaskList.length === 0) {
      return {
        text: 'No tasks available. Please navigate to a job first.',
        shouldSpeak: true,
      };
    }

    // Move to previous task
    if (currentTaskIndex > 0) {
      currentTaskIndex--;
      const task = currentTaskList[currentTaskIndex];
      const taskNumber = currentTaskIndex + 1;

      let speechText = `Task ${taskNumber}: ${task.task_description}. `;
      if (task.status === 'complete') {
        speechText += 'This task is complete. ';
      } else if (task.status === 'in-progress') {
        speechText += 'This task is in progress. ';
      } else {
        speechText += 'This task is pending. ';
      }

      if (task.acceptance_criteria) {
        speechText += `Criteria: ${task.acceptance_criteria}`;
      }

      return {
        text: speechText.trim(),
        actions: [
          {
            type: 'scroll_to_task',
            data: { taskId: task.id, taskNumber },
          },
        ],
        shouldSpeak: true,
      };
    } else {
      return {
        text: 'You are at the first task.',
        shouldSpeak: true,
      };
    }
  },
};

/**
 * Command 5: Query Task Details
 * Pattern: "what's task (number)", "describe task (number)", "tell me about task (number)"
 */
const queryTaskHandler: TaskCommandHandler = {
  pattern: /(?:what'?s|describe|tell\s+me\s+about)\s+task\s+(\d+)/i,
  intent: 'query_task',
  description: 'Get detailed information about a specific task',
  examples: ["what's task 1", 'describe task 2', 'tell me about task 3'],
  handler: async (command: VoiceCommand, match: RegExpMatchArray) => {
    if (!currentJobId || currentTaskList.length === 0) {
      return {
        text: 'No tasks available. Please navigate to a job first.',
        shouldSpeak: true,
      };
    }

    const taskNumber = parseInt(match[1], 10);

    if (isNaN(taskNumber) || taskNumber < 1 || taskNumber > currentTaskList.length) {
      return {
        text: `Invalid task number. You have ${currentTaskList.length} tasks.`,
        shouldSpeak: true,
      };
    }

    const taskIndex = taskNumber - 1;
    const task = currentTaskList[taskIndex];

    let speechText = `Task ${taskNumber}: ${task.task_description}. `;
    speechText += `Status: ${task.status}. `;

    if (task.is_required) {
      speechText += 'This is a required task. ';
    }

    if (task.requires_photo_verification) {
      speechText += 'Photo verification required. ';
    }

    if (task.requires_supervisor_approval) {
      speechText += 'Requires supervisor approval. ';
    }

    if (task.acceptance_criteria) {
      speechText += `Acceptance criteria: ${task.acceptance_criteria}. `;
    }

    if (task.completed_at) {
      speechText += `Completed on ${new Date(task.completed_at).toLocaleString()}.`;
    }

    return {
      text: speechText.trim(),
      actions: [
        {
          type: 'scroll_to_task',
          data: { taskId: task.id, taskNumber },
        },
      ],
      shouldSpeak: true,
    };
  },
};

/**
 * Command 6: Add Task
 * Pattern: "add task: (description)", "create task: (description)", "new task: (description)"
 */
const addTaskHandler: TaskCommandHandler = {
  pattern: /(?:add|create|new)\s+task:?\s+(.+)/i,
  intent: 'add_task',
  description: 'Create a new task with voice-provided description',
  examples: ['add task: check oil', 'create task: inspect tires', 'new task: verify brakes'],
  handler: async (command: VoiceCommand, match: RegExpMatchArray) => {
    if (!currentJobId) {
      return {
        text: 'No job selected. Please navigate to a job first.',
        shouldSpeak: true,
      };
    }

    const taskDescription = match[1].trim();

    if (!taskDescription || taskDescription.length === 0) {
      return {
        text: 'Please provide a task description.',
        shouldSpeak: true,
      };
    }

    // Trigger task creation via action
    return {
      text: `Adding new task: ${taskDescription}`,
      actions: [
        {
          type: 'create_task',
          data: {
            jobId: currentJobId,
            taskDescription,
            taskOrder: currentTaskList.length, // Add at end
          },
        },
      ],
      shouldSpeak: true,
    };
  },
};

/**
 * Export all task voice commands
 */
export const taskVoiceCommands: TaskCommandHandler[] = [
  showTasksHandler,
  completeTaskHandler,
  nextTaskHandler,
  previousTaskHandler,
  queryTaskHandler,
  addTaskHandler,
];

/**
 * Process a voice command and check if it matches any task command
 */
export async function processTaskCommand(command: VoiceCommand): Promise<VoiceResponse | null> {
  const transcript = command.transcript.toLowerCase().trim();

  for (const handler of taskVoiceCommands) {
    const match = transcript.match(handler.pattern);
    if (match) {
      try {
        const response = await handler.handler(command, match);
        return response;
      } catch (error) {
        console.error(`[TaskCommands] Error processing ${handler.intent}:`, error);
        return {
          text: 'Sorry, I had trouble processing that task command. Please try again.',
          shouldSpeak: true,
        };
      }
    }
  }

  return null; // No match found
}

/**
 * Get help text for task commands
 */
export function getTaskCommandHelp(): string {
  let helpText = 'Available task commands:\n\n';
  taskVoiceCommands.forEach((cmd) => {
    helpText += `${cmd.description}\n`;
    helpText += `Examples: ${cmd.examples.join(', ')}\n\n`;
  });
  return helpText;
}
