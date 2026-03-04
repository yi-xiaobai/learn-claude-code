/**
 * s07_task_system.js - Tasks
 *
 * Tasks persist as JSON files in .tasks/ so they survive context compression.
 * Each task has a dependency graph (blockedBy/blocks).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前脚本所在目录，加载上级目录的 .env 文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const WORKDIR = process.cwd();
const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_API_KEY
});
const MODEL = process.env.MODEL_ID;
const TASKS_DIR = join(WORKDIR, '.tasks');

const SYSTEM = `You are a coding agent at ${WORKDIR}. Use task tools to plan and track work.`;

// -- TaskManager: CRUD with dependency graph, persisted as JSON files --
class TaskManager {
  constructor(tasksDir) {
    this.dir = tasksDir;
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
    this._nextId = this._maxId() + 1;
  }

  _maxId() {
    const files = readdirSync(this.dir).filter(f => f.startsWith('task_') && f.endsWith('.json'));
    if (files.length === 0) return 0;
    const ids = files.map(f => parseInt(f.split('_')[1].split('.')[0]));
    return Math.max(...ids);
  }

  _load(taskId) {
    const path = join(this.dir, `task_${taskId}.json`);
    if (!existsSync(path)) {
      throw new Error(`Task ${taskId} not found`);
    }
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  _save(task) {
    const path = join(this.dir, `task_${task.id}.json`);
    writeFileSync(path, JSON.stringify(task, null, 2));
  }

  create(subject, description = '') {
    const task = {
      id: this._nextId,
      subject,
      description,
      status: 'pending',
      blockedBy: [],
      blocks: [],
      owner: ''
    };
    this._save(task);
    this._nextId++;
    return JSON.stringify(task, null, 2);
  }

  get(taskId) {
    return JSON.stringify(this._load(taskId), null, 2);
  }

  update(taskId, { status, addBlockedBy, addBlocks }) {
    const task = this._load(taskId);

    if (status) {
      if (!['pending', 'in_progress', 'completed'].includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }
      task.status = status;
      // When a task is completed, remove it from all other tasks' blockedBy
      if (status === 'completed') {
        this._clearDependency(taskId);
      }
    }

    if (addBlockedBy) {
      task.blockedBy = [...new Set([...task.blockedBy, ...addBlockedBy])];
    }

    if (addBlocks) {
      task.blocks = [...new Set([...task.blocks, ...addBlocks])];
      // Bidirectional: also update the blocked tasks' blockedBy lists
      for (const blockedId of addBlocks) {
        try {
          const blocked = this._load(blockedId);
          if (!blocked.blockedBy.includes(taskId)) {
            blocked.blockedBy.push(taskId);
            this._save(blocked);
          }
        } catch (e) {
          // Task not found, ignore
        }
      }
    }

    this._save(task);
    return JSON.stringify(task, null, 2);
  }

  _clearDependency(completedId) {
    // Remove completedId from all other tasks' blockedBy lists
    const files = readdirSync(this.dir).filter(f => f.startsWith('task_') && f.endsWith('.json'));
    for (const file of files) {
      const task = JSON.parse(readFileSync(join(this.dir, file), 'utf-8'));
      if (task.blockedBy && task.blockedBy.includes(completedId)) {
        task.blockedBy = task.blockedBy.filter(id => id !== completedId);
        this._save(task);
      }
    }
  }

  listAll() {
    const files = readdirSync(this.dir).filter(f => f.startsWith('task_') && f.endsWith('.json'));
    if (files.length === 0) return 'No tasks.';

    const tasks = files.map(f => JSON.parse(readFileSync(join(this.dir, f), 'utf-8')))
      .sort((a, b) => a.id - b.id);

    const lines = [];
    for (const t of tasks) {
      const marker = { pending: '[ ]', in_progress: '[>]', completed: '[x]' }[t.status] || '[?]';
      const blocked = t.blockedBy && t.blockedBy.length > 0 ? ` (blocked by: ${t.blockedBy})` : '';
      lines.push(`${marker} #${t.id}: ${t.subject}${blocked}`);
    }
    return lines.join('\n');
  }
}

const TASKS = new TaskManager(TASKS_DIR);

// -- Base tool implementations --
function safePath(p) {
  const path = resolve(WORKDIR, p);
  if (!path.startsWith(WORKDIR)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return path;
}

function runBash(command) {
  const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot', '> /dev/'];
  if (dangerous.some(d => command.includes(d))) {
    return 'Error: Dangerous command blocked';
  }
  try {
    const output = execSync(command, { cwd: WORKDIR, encoding: 'utf-8', timeout: 120000 });
    return output.trim().slice(0, 50000) || '(no output)';
  } catch (e) {
    return e.message.slice(0, 50000);
  }
}

function runRead(path, limit) {
  try {
    const fp = safePath(path);
    const content = fp.toString();
    const lines = content.split('\n');
    if (limit && limit < lines.length) {
      return lines.slice(0, limit).join('\n') + `\n... (${lines.length - limit} more)`;
    }
    return content.slice(0, 50000);
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

function runWrite(path, content) {
  try {
    const fp = safePath(path);
    const dir = fp.substring(0, fp.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fp, content);
    return `Wrote ${content.length} bytes`;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

function runEdit(path, oldText, newText) {
  try {
    const fp = safePath(path);
    const content = fp.toString();
    if (!content.includes(oldText)) {
      return `Error: Text not found in ${path}`;
    }
    writeFileSync(fp, content.replace(oldText, newText, 1));
    return `Edited ${path}`;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

const TOOL_HANDLERS = {
  bash: ({ command }) => runBash(command),
  read_file: ({ path, limit }) => runRead(path, limit),
  write_file: ({ path, content }) => runWrite(path, content),
  edit_file: ({ path, old_text, new_text }) => runEdit(path, old_text, new_text),
  task_create: ({ subject, description = '' }) => TASKS.create(subject, description),
  task_update: ({ task_id, status, addBlockedBy, addBlocks }) =>
    TASKS.update(task_id, { status, addBlockedBy, addBlocks }),
  task_list: () => TASKS.listAll(),
  task_get: ({ task_id }) => TASKS.get(task_id),
};

const TOOLS = [
  {
    name: 'bash',
    description: 'Run a shell command.',
    input_schema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command']
    }
  },
  {
    name: 'read_file',
    description: 'Read file contents.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' }, limit: { type: 'integer' } },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to file.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit_file',
    description: 'Replace exact text in file.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } },
      required: ['path', 'old_text', 'new_text']
    }
  },
  {
    name: 'task_create',
    description: 'Create a new task.',
    input_schema: {
      type: 'object',
      properties: { subject: { type: 'string' }, description: { type: 'string' } },
      required: ['subject']
    }
  },
  {
    name: 'task_update',
    description: "Update a task's status or dependencies.",
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'integer' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
        addBlockedBy: { type: 'array', items: { type: 'integer' } },
        addBlocks: { type: 'array', items: { type: 'integer' } }
      },
      required: ['task_id']
    }
  },
  {
    name: 'task_list',
    description: 'List all tasks with status summary.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'task_get',
    description: 'Get full details of a task by ID.',
    input_schema: {
      type: 'object',
      properties: { task_id: { type: 'integer' } },
      required: ['task_id']
    }
  }
];

async function agentLoop(messages) {
  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages: messages,
      tools: TOOLS,
      max_tokens: 8000
    });
    console.log('response', response)

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      return;
    }

    const results = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const handler = TOOL_HANDLERS[block.name];
        let output;
        try {
          output = handler ? handler(block.input) : `Unknown tool: ${block.name}`;
        } catch (e) {
          output = `Error: ${e.message}`;
        }
        console.log(`> ${block.name}: ${String(output).slice(0, 200)}`);
        results.push({ type: 'tool_result', tool_use_id: block.id, content: String(output) });
      }
    }
    messages.push({ role: 'user', content: results });
  }
}

async function main() {
  const history = [];
  const readline = await import('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = () => {
    rl.question('\x1b[36ms07 >> \x1b[0m', async (query) => {
      if (query.trim().toLowerCase() === 'q' || query.trim().toLowerCase() === 'exit' || query.trim() === '') {
        rl.close();
        return;
      }

      history.push({ role: 'user', content: query });
      await agentLoop(history);

      const responseContent = history[history.length - 1].content;
      if (Array.isArray(responseContent)) {
        for (const block of responseContent) {
          if (block.text) {
            console.log(block.text);
          }
        }
      }
      console.log();
      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
