/**
 * s08_background_tasks.js - Background Tasks
 *
 * Run commands in background threads. A notification queue is drained
 * before each LLM call to deliver results.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync, spawn } from 'child_process';
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Worker } from 'worker_threads';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const WORKDIR = process.cwd();
const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_API_KEY
});
const MODEL = process.env.MODEL_ID;

const SYSTEM = `You are a coding agent at ${WORKDIR}. Use background_run for long-running commands.`;

// -- BackgroundManager: threaded execution + notification queue --
class BackgroundManager {
  constructor() {
    this.tasks = {}; // task_id -> {status, result, command}
    this._notificationQueue = []; // completed task results
    this._lock = false;
  }

  _acquireLock() {
    while (this._lock) {
      // simple spin lock
    }
    this._lock = true;
  }

  _releaseLock() {
    this._lock = false;
  }

  run(command) {
    // Start a background thread, return task_id immediately.
    const taskId = crypto.randomUUID().slice(0, 8);
    this.tasks[taskId] = { status: 'running', result: null, command };

    // Use setTimeout to run in background (Node.js single-threaded, but non-blocking)
    setTimeout(() => this._execute(taskId, command), 0);

    return `Background task ${taskId} started: ${command.slice(0, 80)}`;
  }

  _execute(taskId, command) {
    // Thread target: run subprocess, capture output, push to queue.
    let output;
    let status;

    try {
      output = execSync(command, {
        cwd: WORKDIR,
        encoding: 'utf-8',
        timeout: 300000, // 5 minutes
        maxBuffer: 50 * 1024 * 1024
      }).trim().slice(0, 50000);
      status = 'completed';
    } catch (e) {
      if (e.killed) {
        output = 'Error: Timeout (300s)';
        status = 'timeout';
      } else {
        output = e.message || 'Error: Unknown';
        status = 'error';
      }
    }

    this.tasks[taskId].status = status;
    this.tasks[taskId].result = output || '(no output)';

    this._acquireLock();
    this._notificationQueue.push({
      task_id: taskId,
      status,
      command: command.slice(0, 80),
      result: (output || '(no output)').slice(0, 500)
    });
    this._releaseLock();
  }

  check(taskId) {
    // Check status of one task or list all.
    if (taskId) {
      const t = this.tasks[taskId];
      if (!t) {
        return `Error: Unknown task ${taskId}`;
      }
      return `[${t.status}] ${t.command.slice(0, 60)}\n${t.result || '(running)'}`;
    }

    const lines = [];
    for (const [tid, t] of Object.entries(this.tasks)) {
      lines.push(`${tid}: [${t.status}] ${t.command.slice(0, 60)}`);
    }
    return lines.length > 0 ? lines.join('\n') : 'No background tasks.';
  }

  drainNotifications() {
    // Return and clear all pending completion notifications.
    this._acquireLock();
    const notifs = [...this._notificationQueue];
    this._notificationQueue.length = 0;
    this._releaseLock();
    return notifs;
  }
}

const BG = new BackgroundManager();

// -- Tool implementations --
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
    const output = execSync(command, {
      cwd: WORKDIR,
      encoding: 'utf-8',
      timeout: 120000
    }).trim().slice(0, 50000);
    return output || '(no output)';
  } catch (e) {
    return e.killed ? 'Error: Timeout (120s)' : `Error: ${e.message}`;
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
  background_run: ({ command }) => BG.run(command),
  check_background: ({ task_id }) => BG.check(task_id)
};

const TOOLS = [
  {
    name: 'bash',
    description: 'Run a shell command (blocking).',
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
    name: 'background_run',
    description: 'Run command in background thread. Returns task_id immediately.',
    input_schema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command']
    }
  },
  {
    name: 'check_background',
    description: 'Check background task status. Omit task_id to list all.',
    input_schema: {
      type: 'object',
      properties: { task_id: { type: 'string' } }
    }
  }
];

async function agentLoop(messages) {
  while (true) {
    // Drain background notifications and inject as system message before LLM call
    const notifs = BG.drainNotifications();
    if (notifs.length > 0 && messages.length > 0) {
      const notifText = notifs
        .map(n => `[bg:${n.task_id}] ${n.status}: ${n.result}`)
        .join('\n');
      messages.push({
        role: 'user',
        content: `<background-results>\n${notifText}\n</background-results>`
      });
      messages.push({ role: 'assistant', content: 'Noted background results.' });
    }

    console.log('messages', JSON.stringify(messages, null , 2))
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages: messages,
      tools: TOOLS,
      max_tokens: 8000
    });

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
    rl.question('\x1b[36ms08 >> \x1b[0m', async (query) => {
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
