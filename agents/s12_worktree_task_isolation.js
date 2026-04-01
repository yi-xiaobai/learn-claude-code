/**
 * s12_worktree_task_isolation.js - Worktree + Task Isolation
 *
 * Directory-level isolation for parallel task execution.
 * Tasks are the control plane and worktrees are the execution plane.
 *
 *    .tasks/task_12.json
 *      {
 *        "id": 12,
 *        "subject": "Implement auth refactor",
 *        "status": "in_progress",
 *        "worktree": "auth-refactor"
 *      }
 *
 *    .worktrees/index.json
 *      {
 *        "worktrees": [
 *          {
 *            "name": "auth-refactor",
 *            "path": ".../.worktrees/auth-refactor",
 *            "branch": "wt/auth-refactor",
 *            "task_id": 12,
 *            "status": "active"
 *          }
 *        ]
 *      }
 *
 * Key insight: "Isolate by directory, coordinate by task ID."
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const WORKDIR = process.cwd();
const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_API_KEY
});
const MODEL = process.env.MODEL_ID;

function detectRepoRoot(cwd) {
  try {
    const root = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
    return existsSync(root) ? root : null;
  } catch { return null; }
}

const REPO_ROOT = detectRepoRoot(WORKDIR) || WORKDIR;

const SYSTEM = `You are a coding agent at ${WORKDIR}. Use task + worktree tools for multi-task work. For parallel or risky changes: create tasks, allocate worktree lanes, run commands in those lanes, then choose keep/remove for closeout. Use worktree_events when you need lifecycle visibility.`;

// -- EventBus: append-only lifecycle events for observability --
class EventBus {
  constructor(eventLogPath) {
    this.path = eventLogPath;
    const dir = this.path.substring(0, this.path.lastIndexOf('/'));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(this.path)) writeFileSync(this.path, '');
  }

  emit(event, task = {}, worktree = {}, error = null) {
    const payload = { event, ts: Date.now(), task, worktree };
    if (error) payload.error = error;
    writeFileSync(this.path, JSON.stringify(payload) + '\n', { flag: 'a' });
  }

  listRecent(limit = 20) {
    const n = Math.max(1, Math.min(limit, 200));
    const lines = readFileSync(this.path, 'utf-8').trim().split('\n').filter(l => l);
    const recent = lines.slice(-n);
    return JSON.stringify(recent.map(l => { try { return JSON.parse(l); } catch { return { event: 'parse_error', raw: l }; } }), null, 2);
  }
}

// -- TaskManager: persistent task board with optional worktree binding --
class TaskManager {
  constructor(tasksDir) {
    this.dir = tasksDir;
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
    this._nextId = this._maxId() + 1;
  }

  _maxId() {
    const ids = readdirSync(this.dir).filter(f => f.startsWith('task_') && f.endsWith('.json'))
      .map(f => parseInt(f.replace('task_', '').replace('.json', ''), 10)).filter(n => !isNaN(n));
    return ids.length ? Math.max(...ids) : 0;
  }

  _path(taskId) { return join(this.dir, `task_${taskId}.json`); }

  _load(taskId) {
    const p = this._path(taskId);
    if (!existsSync(p)) throw new Error(`Task ${taskId} not found`);
    return JSON.parse(readFileSync(p, 'utf-8'));
  }

  _save(task) { writeFileSync(this._path(task.id), JSON.stringify(task, null, 2)); }

  exists(taskId) { return existsSync(this._path(taskId)); }

  create(subject, description = '') {
    const task = {
      id: this._nextId, subject, description, status: 'pending',
      owner: '', worktree: '', blockedBy: [],
      created_at: Date.now(), updated_at: Date.now()
    };
    this._save(task);
    this._nextId++;
    return JSON.stringify(task, null, 2);
  }

  get(taskId) { return JSON.stringify(this._load(taskId), null, 2); }

  update(taskId, status, owner) {
    const task = this._load(taskId);
    if (status) {
      if (!['pending', 'in_progress', 'completed'].includes(status)) throw new Error(`Invalid status: ${status}`);
      task.status = status;
    }
    if (owner !== undefined) task.owner = owner;
    task.updated_at = Date.now();
    this._save(task);
    return JSON.stringify(task, null, 2);
  }

  bindWorktree(taskId, worktree, owner = '') {
    const task = this._load(taskId);
    task.worktree = worktree;
    if (owner) task.owner = owner;
    if (task.status === 'pending') task.status = 'in_progress';
    task.updated_at = Date.now();
    this._save(task);
    return JSON.stringify(task, null, 2);
  }

  unbindWorktree(taskId) {
    const task = this._load(taskId);
    task.worktree = '';
    task.updated_at = Date.now();
    this._save(task);
    return JSON.stringify(task, null, 2);
  }

  listAll() {
    const files = readdirSync(this.dir).filter(f => f.startsWith('task_') && f.endsWith('.json')).sort();
    if (!files.length) return 'No tasks.';
    return files.map(f => {
      const t = JSON.parse(readFileSync(join(this.dir, f), 'utf-8'));
      const marker = { pending: '[ ]', in_progress: '[>]', completed: '[x]' }[t.status] || '[?]';
      const owner = t.owner ? ` owner=${t.owner}` : '';
      const wt = t.worktree ? ` wt=${t.worktree}` : '';
      return `${marker} #${t.id}: ${t.subject}${owner}${wt}`;
    }).join('\n');
  }
}

const TASKS = new TaskManager(join(REPO_ROOT, '.tasks'));
const EVENTS = new EventBus(join(REPO_ROOT, '.worktrees', 'events.jsonl'));

// -- WorktreeManager: create/list/run/remove git worktrees + lifecycle index --
class WorktreeManager {
  constructor(repoRoot, tasks, events) {
    this.repoRoot = repoRoot;
    this.tasks = tasks;
    this.events = events;
    this.dir = join(repoRoot, '.worktrees');
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
    this.indexPath = join(this.dir, 'index.json');
    if (!existsSync(this.indexPath)) writeFileSync(this.indexPath, JSON.stringify({ worktrees: [] }, null, 2));
    this.gitAvailable = this._isGitRepo();
  }

  _isGitRepo() {
    try { execSync('git rev-parse --is-inside-work-tree', { cwd: this.repoRoot, timeout: 10000 }); return true; }
    catch { return false; }
  }

  _runGit(args) {
    if (!this.gitAvailable) throw new Error('Not in a git repository. worktree tools require git.');
    const r = execSync(`git ${args.join(' ')}`, { cwd: this.repoRoot, encoding: 'utf-8', timeout: 120000 });
    return r.trim() || '(no output)';
  }

  _loadIndex() { return JSON.parse(readFileSync(this.indexPath, 'utf-8')); }
  _saveIndex(data) { writeFileSync(this.indexPath, JSON.stringify(data, null, 2)); }

  _find(name) {
    const idx = this._loadIndex();
    return (idx.worktrees || []).find(wt => wt.name === name) || null;
  }

  _validateName(name) {
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(name || '')) {
      throw new Error('Invalid worktree name. Use 1-40 chars: letters, numbers, ., _, -');
    }
  }

  create(name, taskId = null, baseRef = 'HEAD') {
    this._validateName(name);
    if (this._find(name)) throw new Error(`Worktree '${name}' already exists in index`);
    if (taskId !== null && taskId !== undefined && !this.tasks.exists(taskId)) throw new Error(`Task ${taskId} not found`);

    const path = join(this.dir, name);
    const branch = `wt/${name}`;
    const taskObj = taskId != null ? { id: taskId } : {};

    this.events.emit('worktree.create.before', taskObj, { name, base_ref: baseRef });
    try {
      this._runGit(['worktree', 'add', '-b', branch, path, baseRef]);
      const entry = { name, path, branch, task_id: taskId, status: 'active', created_at: Date.now() };
      const idx = this._loadIndex();
      idx.worktrees.push(entry);
      this._saveIndex(idx);
      if (taskId != null) this.tasks.bindWorktree(taskId, name);
      this.events.emit('worktree.create.after', taskObj, { name, path, branch, status: 'active' });
      return JSON.stringify(entry, null, 2);
    } catch (e) {
      this.events.emit('worktree.create.failed', taskObj, { name, base_ref: baseRef }, e.message);
      throw e;
    }
  }

  listAll() {
    const idx = this._loadIndex();
    const wts = idx.worktrees || [];
    if (!wts.length) return 'No worktrees in index.';
    return wts.map(wt => {
      const suffix = wt.task_id != null ? ` task=${wt.task_id}` : '';
      return `[${wt.status || 'unknown'}] ${wt.name} -> ${wt.path} (${wt.branch || '-'})${suffix}`;
    }).join('\n');
  }

  status(name) {
    const wt = this._find(name);
    if (!wt) return `Error: Unknown worktree '${name}'`;
    if (!existsSync(wt.path)) return `Error: Worktree path missing: ${wt.path}`;
    try {
      return execSync('git status --short --branch', { cwd: wt.path, encoding: 'utf-8', timeout: 60000 }).trim() || 'Clean worktree';
    } catch (e) { return `Error: ${e.message}`; }
  }

  run(name, command) {
    const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot', '> /dev/'];
    if (dangerous.some(d => command.includes(d))) return 'Error: Dangerous command blocked';
    const wt = this._find(name);
    if (!wt) return `Error: Unknown worktree '${name}'`;
    if (!existsSync(wt.path)) return `Error: Worktree path missing: ${wt.path}`;
    try {
      const out = execSync(command, { cwd: wt.path, encoding: 'utf-8', timeout: 300000 }).trim();
      return (out || '(no output)').slice(0, 50000);
    } catch (e) { return e.killed ? 'Error: Timeout (300s)' : `Error: ${e.message}`; }
  }

  remove(name, force = false, completeTask = false) {
    const wt = this._find(name);
    if (!wt) return `Error: Unknown worktree '${name}'`;
    const taskObj = wt.task_id != null ? { id: wt.task_id } : {};
    this.events.emit('worktree.remove.before', taskObj, { name, path: wt.path });
    try {
      const args = ['worktree', 'remove'];
      if (force) args.push('--force');
      args.push(wt.path);
      this._runGit(args);

      if (completeTask && wt.task_id != null) {
        const before = JSON.parse(this.tasks.get(wt.task_id));
        this.tasks.update(wt.task_id, 'completed');
        this.tasks.unbindWorktree(wt.task_id);
        this.events.emit('task.completed', { id: wt.task_id, subject: before.subject, status: 'completed' }, { name });
      }

      const idx = this._loadIndex();
      for (const item of idx.worktrees) {
        if (item.name === name) { item.status = 'removed'; item.removed_at = Date.now(); }
      }
      this._saveIndex(idx);
      this.events.emit('worktree.remove.after', taskObj, { name, path: wt.path, status: 'removed' });
      return `Removed worktree '${name}'`;
    } catch (e) {
      this.events.emit('worktree.remove.failed', taskObj, { name, path: wt.path }, e.message);
      throw e;
    }
  }

  keep(name) {
    const wt = this._find(name);
    if (!wt) return `Error: Unknown worktree '${name}'`;
    const idx = this._loadIndex();
    let kept = null;
    for (const item of idx.worktrees) {
      if (item.name === name) { item.status = 'kept'; item.kept_at = Date.now(); kept = item; }
    }
    this._saveIndex(idx);
    const taskObj = wt.task_id != null ? { id: wt.task_id } : {};
    this.events.emit('worktree.keep', taskObj, { name, path: wt.path, status: 'kept' });
    return kept ? JSON.stringify(kept, null, 2) : `Error: Unknown worktree '${name}'`;
  }
}

const WORKTREES = new WorktreeManager(REPO_ROOT, TASKS, EVENTS);

// -- Base tool implementations --
function safePath(p) {
  const path = resolve(WORKDIR, p);
  if (!path.startsWith(WORKDIR)) throw new Error(`Path escapes workspace: ${p}`);
  return path;
}

function runBash(command) {
  const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot', '> /dev/'];
  if (dangerous.some(d => command.includes(d))) return 'Error: Dangerous command blocked';
  try {
    return execSync(command, { cwd: WORKDIR, encoding: 'utf-8', timeout: 120000 }).trim().slice(0, 50000) || '(no output)';
  } catch (e) { return e.killed ? 'Error: Timeout (120s)' : `Error: ${e.message}`; }
}

function runRead(path, limit) {
  try {
    const content = readFileSync(safePath(path), 'utf-8');
    const lines = content.split('\n');
    if (limit && limit < lines.length) return lines.slice(0, limit).join('\n') + `\n... (${lines.length - limit} more)`;
    return content.slice(0, 50000);
  } catch (e) { return `Error: ${e.message}`; }
}

function runWrite(path, content) {
  try {
    const fp = safePath(path);
    const dir = fp.substring(0, fp.lastIndexOf('/'));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(fp, content);
    return `Wrote ${content.length} bytes`;
  } catch (e) { return `Error: ${e.message}`; }
}

function runEdit(path, oldText, newText) {
  try {
    const fp = safePath(path);
    const content = readFileSync(fp, 'utf-8');
    if (!content.includes(oldText)) return `Error: Text not found in ${path}`;
    writeFileSync(fp, content.replace(oldText, newText));
    return `Edited ${path}`;
  } catch (e) { return `Error: ${e.message}`; }
}

// -- Tool dispatch (17 tools) --
const TOOL_HANDLERS = {
  bash: ({ command }) => runBash(command),
  read_file: ({ path, limit }) => runRead(path, limit),
  write_file: ({ path, content }) => runWrite(path, content),
  edit_file: ({ path, old_text, new_text }) => runEdit(path, old_text, new_text),
  task_create: ({ subject, description }) => TASKS.create(subject, description || ''),
  task_list: () => TASKS.listAll(),
  task_get: ({ task_id }) => TASKS.get(task_id),
  task_update: ({ task_id, status, owner }) => TASKS.update(task_id, status, owner),
  task_bind_worktree: ({ task_id, worktree, owner }) => TASKS.bindWorktree(task_id, worktree, owner || ''),
  worktree_create: ({ name, task_id, base_ref }) => WORKTREES.create(name, task_id, base_ref || 'HEAD'),
  worktree_list: () => WORKTREES.listAll(),
  worktree_status: ({ name }) => WORKTREES.status(name),
  worktree_run: ({ name, command }) => WORKTREES.run(name, command),
  worktree_keep: ({ name }) => WORKTREES.keep(name),
  worktree_remove: ({ name, force, complete_task }) => WORKTREES.remove(name, force || false, complete_task || false),
  worktree_events: ({ limit }) => EVENTS.listRecent(limit || 20)
};

const TOOLS = [
  { name: 'bash', description: 'Run a shell command in the current workspace (blocking).',
    input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
  { name: 'read_file', description: 'Read file contents.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, limit: { type: 'integer' } }, required: ['path'] } },
  { name: 'write_file', description: 'Write content to file.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
  { name: 'edit_file', description: 'Replace exact text in file.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, required: ['path', 'old_text', 'new_text'] } },
  { name: 'task_create', description: 'Create a new task on the shared task board.',
    input_schema: { type: 'object', properties: { subject: { type: 'string' }, description: { type: 'string' } }, required: ['subject'] } },
  { name: 'task_list', description: 'List all tasks with status, owner, and worktree binding.',
    input_schema: { type: 'object', properties: {} } },
  { name: 'task_get', description: 'Get task details by ID.',
    input_schema: { type: 'object', properties: { task_id: { type: 'integer' } }, required: ['task_id'] } },
  { name: 'task_update', description: 'Update task status or owner.',
    input_schema: { type: 'object', properties: { task_id: { type: 'integer' }, status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] }, owner: { type: 'string' } }, required: ['task_id'] } },
  { name: 'task_bind_worktree', description: 'Bind a task to a worktree name.',
    input_schema: { type: 'object', properties: { task_id: { type: 'integer' }, worktree: { type: 'string' }, owner: { type: 'string' } }, required: ['task_id', 'worktree'] } },
  { name: 'worktree_create', description: 'Create a git worktree and optionally bind it to a task.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, task_id: { type: 'integer' }, base_ref: { type: 'string' } }, required: ['name'] } },
  { name: 'worktree_list', description: 'List worktrees tracked in .worktrees/index.json.',
    input_schema: { type: 'object', properties: {} } },
  { name: 'worktree_status', description: 'Show git status for one worktree.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'worktree_run', description: 'Run a shell command in a named worktree directory.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, command: { type: 'string' } }, required: ['name', 'command'] } },
  { name: 'worktree_remove', description: 'Remove a worktree and optionally mark its bound task completed.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, force: { type: 'boolean' }, complete_task: { type: 'boolean' } }, required: ['name'] } },
  { name: 'worktree_keep', description: 'Mark a worktree as kept in lifecycle state without removing it.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'worktree_events', description: 'List recent worktree/task lifecycle events.',
    input_schema: { type: 'object', properties: { limit: { type: 'integer' } } } }
];

async function agentLoop(messages) {
  while (true) {
    const response = await client.messages.create({
      model: MODEL, system: SYSTEM, messages, tools: TOOLS, max_tokens: 8000
    });
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason !== 'tool_use') return;

    const results = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const handler = TOOL_HANDLERS[block.name];
        let output;
        try { output = handler ? handler(block.input) : `Unknown tool: ${block.name}`; }
        catch (e) { output = `Error: ${e.message}`; }
        console.log(`> ${block.name}: ${String(output).slice(0, 200)}`);
        results.push({ type: 'tool_result', tool_use_id: block.id, content: String(output) });
      }
    }
    messages.push({ role: 'user', content: results });
  }
}

async function main() {
  console.log(`Repo root for s12: ${REPO_ROOT}`);
  if (!WORKTREES.gitAvailable) console.log('Note: Not in a git repo. worktree_* tools will return errors.');

  const readline = await import('readline');
  const history = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => {
    rl.question('\x1b[36ms12 >> \x1b[0m', async (query) => {
      if (['q', 'exit', ''].includes(query.trim().toLowerCase())) { rl.close(); return; }

      history.push({ role: 'user', content: query });
      await agentLoop(history);
      const rc = history[history.length - 1].content;
      if (Array.isArray(rc)) { for (const b of rc) { if (b.text) console.log(b.text); } }
      console.log();
      prompt();
    });
  };
  prompt();
}

main().catch(console.error);
