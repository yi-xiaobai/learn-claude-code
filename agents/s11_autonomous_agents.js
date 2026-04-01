/**
 * s11_autonomous_agents.js - Autonomous Agents
 *
 * Idle cycle with task board polling, auto-claiming unclaimed tasks, and
 * identity re-injection after context compression. Builds on s10's protocols.
 *
 *    Teammate lifecycle:
 *    +-------+
 *    | spawn |
 *    +---+---+
 *        |
 *        v
 *    +-------+  tool_use    +-------+
 *    | WORK  | <----------- |  LLM  |
 *    +---+---+              +-------+
 *        |
 *        | stop_reason != tool_use
 *        v
 *    +--------+
 *    | IDLE   | poll every 5s for up to 60s
 *    +---+----+
 *        |
 *        +---> check inbox -> message? -> resume WORK
 *        |
 *        +---> scan .tasks/ -> unclaimed? -> claim -> resume WORK
 *        |
 *        +---> timeout (60s) -> shutdown
 *
 *    Identity re-injection after compression:
 *    messages = [identity_block, ...remaining...]
 *    "You are 'coder', role: backend, team: my-team"
 *
 * Key insight: "The agent finds work itself."
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
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
const TEAM_DIR = join(WORKDIR, '.team');
const INBOX_DIR = join(TEAM_DIR, 'inbox');
const TASKS_DIR = join(WORKDIR, '.tasks');

const POLL_INTERVAL = 5000; // 5s
const IDLE_TIMEOUT = 60000; // 60s

const SYSTEM = `You are a team lead at ${WORKDIR}. Teammates are autonomous -- they find work themselves.`;

const VALID_MSG_TYPES = new Set([
  'message', 'broadcast', 'shutdown_request', 'shutdown_response', 'plan_approval_response'
]);

// -- Request trackers --
const shutdownRequests = {};
const planRequests = {};

// -- MessageBus: JSONL inbox per teammate --
class MessageBus {
  constructor(inboxDir) {
    this.dir = inboxDir;
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
  }

  send(sender, to, content, msgType = 'message', extra = null) {
    if (!VALID_MSG_TYPES.has(msgType)) {
      return `Error: Invalid type '${msgType}'. Valid: ${[...VALID_MSG_TYPES].join(', ')}`;
    }
    const msg = { type: msgType, from: sender, content, timestamp: Date.now() };
    if (extra) Object.assign(msg, extra);
    writeFileSync(join(this.dir, `${to}.jsonl`), JSON.stringify(msg) + '\n', { flag: 'a' });
    return `Sent ${msgType} to ${to}`;
  }

  readInbox(name) {
    const p = join(this.dir, `${name}.jsonl`);
    if (!existsSync(p)) return [];
    const raw = readFileSync(p, 'utf-8').trim();
    if (!raw) return [];
    const msgs = raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
    writeFileSync(p, '');
    return msgs;
  }

  broadcast(sender, content, teammates) {
    let count = 0;
    for (const name of teammates) {
      if (name !== sender) { this.send(sender, name, content, 'broadcast'); count++; }
    }
    return `Broadcast to ${count} teammates`;
  }
}

const BUS = new MessageBus(INBOX_DIR);

// -- Task board scanning --
function scanUnclaimedTasks() {
  if (!existsSync(TASKS_DIR)) mkdirSync(TASKS_DIR, { recursive: true });
  const unclaimed = [];
  const files = readdirSync(TASKS_DIR).filter(f => f.startsWith('task_') && f.endsWith('.json')).sort();
  for (const f of files) {
    const task = JSON.parse(readFileSync(join(TASKS_DIR, f), 'utf-8'));
    if (task.status === 'pending' && !task.owner && (!task.blockedBy || task.blockedBy.length === 0)) {
      unclaimed.push(task);
    }
  }
  return unclaimed;
}

function claimTask(taskId, owner) {
  const p = join(TASKS_DIR, `task_${taskId}.json`);
  if (!existsSync(p)) return `Error: Task ${taskId} not found`;
  const task = JSON.parse(readFileSync(p, 'utf-8'));
  if (task.owner) return `Error: Task ${taskId} has already been claimed by ${task.owner}`;
  if (task.status !== 'pending') return `Error: Task ${taskId} cannot be claimed because its status is '${task.status}'`;
  if (task.blockedBy && task.blockedBy.length > 0) return `Error: Task ${taskId} is blocked`;
  task.owner = owner;
  task.status = 'in_progress';
  writeFileSync(p, JSON.stringify(task, null, 2));
  return `Claimed task #${taskId} for ${owner}`;
}

// -- Identity re-injection after compression --
function makeIdentityBlock(name, role, teamName) {
  return {
    role: 'user',
    content: `<identity>You are '${name}', role: ${role}, team: ${teamName}. Continue your work.</identity>`
  };
}

// -- Autonomous TeammateManager --
class TeammateManager {
  constructor(teamDir) {
    this.dir = teamDir;
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
    this.configPath = join(this.dir, 'config.json');
    this.config = this._loadConfig();
    this.threads = {};
  }

  _loadConfig() {
    if (existsSync(this.configPath)) return JSON.parse(readFileSync(this.configPath, 'utf-8'));
    return { team_name: 'default', members: [] };
  }

  _saveConfig() { writeFileSync(this.configPath, JSON.stringify(this.config, null, 2)); }

  _findMember(name) { return this.config.members.find(m => m.name === name) || null; }

  _setStatus(name, status) {
    const m = this._findMember(name);
    if (m) { m.status = status; this._saveConfig(); }
  }

  spawn(name, role, prompt) {
    const member = this._findMember(name);
    if (member) {
      if (member.status !== 'idle' && member.status !== 'shutdown') {
        return `Error: '${name}' is currently ${member.status}`;
      }
      member.status = 'working'; member.role = role;
    } else {
      this.config.members.push({ name, role, status: 'working' });
    }
    this._saveConfig();
    setTimeout(() => this._loop(name, role, prompt), 0);
    return `Spawned '${name}' (role: ${role})`;
  }

  async _loop(name, role, prompt) {
    const teamName = this.config.team_name;
    const sysPrompt = `You are '${name}', role: ${role}, team: ${teamName}, at ${WORKDIR}. Use idle tool when you have no more work. You will auto-claim new tasks.`;
    const messages = [{ role: 'user', content: prompt }];
    const tools = this._teammateTools();

    while (true) {
      // -- WORK PHASE --
      let idleRequested = false;
      for (let i = 0; i < 50; i++) {
        const inbox = BUS.readInbox(name);
        for (const msg of inbox) {
          if (msg.type === 'shutdown_request') { this._setStatus(name, 'shutdown'); return; }
          messages.push({ role: 'user', content: JSON.stringify(msg) });
        }
        let response;
        try {
          response = await client.messages.create({
            model: MODEL, system: sysPrompt, messages, tools, max_tokens: 8000
          });
        } catch (e) { this._setStatus(name, 'idle'); return; }

        messages.push({ role: 'assistant', content: response.content });
        if (response.stop_reason !== 'tool_use') break;

        const results = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            let output;
            if (block.name === 'idle') {
              idleRequested = true;
              output = 'Entering idle phase. Will poll for new tasks.';
            } else {
              output = this._exec(name, block.name, block.input);
            }
            console.log(`  [${name}] ${block.name}: ${String(output).slice(0, 120)}`);
            results.push({ type: 'tool_result', tool_use_id: block.id, content: String(output) });
          }
        }
        messages.push({ role: 'user', content: results });
        if (idleRequested) break;
      }

      // -- IDLE PHASE: poll for inbox messages and unclaimed tasks --
      this._setStatus(name, 'idle');
      let resume = false;
      const polls = Math.floor(IDLE_TIMEOUT / POLL_INTERVAL);

      for (let p = 0; p < polls; p++) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        const inbox = BUS.readInbox(name);
        if (inbox.length > 0) {
          for (const msg of inbox) {
            if (msg.type === 'shutdown_request') { this._setStatus(name, 'shutdown'); return; }
            messages.push({ role: 'user', content: JSON.stringify(msg) });
          }
          resume = true; break;
        }
        const unclaimed = scanUnclaimedTasks();
        if (unclaimed.length > 0) {
          const task = unclaimed[0];
          const result = claimTask(task.id, name);
          if (result.startsWith('Error:')) continue;
          const taskPrompt = `<auto-claimed>Task #${task.id}: ${task.subject}\n${task.description || ''}</auto-claimed>`;
          if (messages.length <= 3) {
            messages.unshift(makeIdentityBlock(name, role, teamName));
            messages.splice(1, 0, { role: 'assistant', content: `I am ${name}. Continuing.` });
          }
          messages.push({ role: 'user', content: taskPrompt });
          messages.push({ role: 'assistant', content: `Claimed task #${task.id}. Working on it.` });
          resume = true; break;
        }
      }

      if (!resume) { this._setStatus(name, 'shutdown'); return; }
      this._setStatus(name, 'working');
    }
  }

  _exec(sender, toolName, args) {
    if (toolName === 'bash') return runBash(args.command);
    if (toolName === 'read_file') return runRead(args.path);
    if (toolName === 'write_file') return runWrite(args.path, args.content);
    if (toolName === 'edit_file') return runEdit(args.path, args.old_text, args.new_text);
    if (toolName === 'send_message') return BUS.send(sender, args.to, args.content, args.msg_type || 'message');
    if (toolName === 'read_inbox') return JSON.stringify(BUS.readInbox(sender), null, 2);
    if (toolName === 'shutdown_response') {
      const { request_id, approve, reason } = args;
      if (shutdownRequests[request_id]) {
        shutdownRequests[request_id].status = approve ? 'approved' : 'rejected';
      }
      BUS.send(sender, 'lead', reason || '', 'shutdown_response', { request_id, approve });
      return `Shutdown ${approve ? 'approved' : 'rejected'}`;
    }
    if (toolName === 'plan_approval') {
      const planText = args.plan || '';
      const reqId = crypto.randomUUID().slice(0, 8);
      planRequests[reqId] = { from: sender, plan: planText, status: 'pending' };
      BUS.send(sender, 'lead', planText, 'plan_approval_response', { request_id: reqId, plan: planText });
      return `Plan submitted (request_id=${reqId}). Waiting for approval.`;
    }
    if (toolName === 'claim_task') return claimTask(args.task_id, sender);
    return `Unknown tool: ${toolName}`;
  }

  _teammateTools() {
    return [
      { name: 'bash', description: 'Run a shell command.',
        input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
      { name: 'read_file', description: 'Read file contents.',
        input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
      { name: 'write_file', description: 'Write content to file.',
        input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
      { name: 'edit_file', description: 'Replace exact text in file.',
        input_schema: { type: 'object', properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, required: ['path', 'old_text', 'new_text'] } },
      { name: 'send_message', description: 'Send message to a teammate.',
        input_schema: { type: 'object', properties: { to: { type: 'string' }, content: { type: 'string' }, msg_type: { type: 'string', enum: [...VALID_MSG_TYPES] } }, required: ['to', 'content'] } },
      { name: 'read_inbox', description: 'Read and drain your inbox.',
        input_schema: { type: 'object', properties: {} } },
      { name: 'shutdown_response', description: 'Respond to a shutdown request.',
        input_schema: { type: 'object', properties: { request_id: { type: 'string' }, approve: { type: 'boolean' }, reason: { type: 'string' } }, required: ['request_id', 'approve'] } },
      { name: 'plan_approval', description: 'Submit a plan for lead approval.',
        input_schema: { type: 'object', properties: { plan: { type: 'string' } }, required: ['plan'] } },
      { name: 'idle', description: 'Signal that you have no more work. Enters idle polling phase.',
        input_schema: { type: 'object', properties: {} } },
      { name: 'claim_task', description: 'Claim a task from the task board by ID.',
        input_schema: { type: 'object', properties: { task_id: { type: 'integer' } }, required: ['task_id'] } }
    ];
  }

  listAll() {
    if (!this.config.members.length) return 'No teammates.';
    const lines = [`Team: ${this.config.team_name}`];
    for (const m of this.config.members) lines.push(`  ${m.name} (${m.role}): ${m.status}`);
    return lines.join('\n');
  }

  memberNames() { return this.config.members.map(m => m.name); }
}

const TEAM = new TeammateManager(TEAM_DIR);

// -- Base tool implementations --
function safePath(p) {
  const path = resolve(WORKDIR, p);
  if (!path.startsWith(WORKDIR)) throw new Error(`Path escapes workspace: ${p}`);
  return path;
}

function runBash(command) {
  const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot'];
  if (dangerous.some(d => command.includes(d))) return 'Error: Dangerous command blocked';
  try {
    return execSync(command, { cwd: WORKDIR, encoding: 'utf-8', timeout: 120000 }).trim().slice(0, 50000) || '(no output)';
  } catch (e) {
    return e.killed ? 'Error: Timeout (120s)' : `Error: ${e.message}`;
  }
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

// -- Lead-specific protocol handlers --
function handleShutdownRequest(teammate) {
  const reqId = crypto.randomUUID().slice(0, 8);
  shutdownRequests[reqId] = { target: teammate, status: 'pending' };
  BUS.send('lead', teammate, 'Please shut down gracefully.', 'shutdown_request', { request_id: reqId });
  return `Shutdown request ${reqId} sent to '${teammate}'`;
}

function handlePlanReview(requestId, approve, feedback = '') {
  const req = planRequests[requestId];
  if (!req) return `Error: Unknown plan request_id '${requestId}'`;
  req.status = approve ? 'approved' : 'rejected';
  BUS.send('lead', req.from, feedback, 'plan_approval_response', { request_id: requestId, approve, feedback });
  return `Plan ${req.status} for '${req.from}'`;
}

function checkShutdownStatus(requestId) {
  return JSON.stringify(shutdownRequests[requestId] || { error: 'not found' });
}

// -- Lead tool dispatch (14 tools) --
const TOOL_HANDLERS = {
  bash: ({ command }) => runBash(command),
  read_file: ({ path, limit }) => runRead(path, limit),
  write_file: ({ path, content }) => runWrite(path, content),
  edit_file: ({ path, old_text, new_text }) => runEdit(path, old_text, new_text),
  spawn_teammate: ({ name, role, prompt }) => TEAM.spawn(name, role, prompt),
  list_teammates: () => TEAM.listAll(),
  send_message: ({ to, content, msg_type }) => BUS.send('lead', to, content, msg_type || 'message'),
  read_inbox: () => JSON.stringify(BUS.readInbox('lead'), null, 2),
  broadcast: ({ content }) => BUS.broadcast('lead', content, TEAM.memberNames()),
  shutdown_request: ({ teammate }) => handleShutdownRequest(teammate),
  shutdown_response: ({ request_id }) => checkShutdownStatus(request_id),
  plan_approval: ({ request_id, approve, feedback }) => handlePlanReview(request_id, approve, feedback || ''),
  idle: () => 'Lead does not idle.',
  claim_task: ({ task_id }) => claimTask(task_id, 'lead')
};

const TOOLS = [
  { name: 'bash', description: 'Run a shell command.',
    input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
  { name: 'read_file', description: 'Read file contents.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, limit: { type: 'integer' } }, required: ['path'] } },
  { name: 'write_file', description: 'Write content to file.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
  { name: 'edit_file', description: 'Replace exact text in file.',
    input_schema: { type: 'object', properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, required: ['path', 'old_text', 'new_text'] } },
  { name: 'spawn_teammate', description: 'Spawn an autonomous teammate.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, prompt: { type: 'string' } }, required: ['name', 'role', 'prompt'] } },
  { name: 'list_teammates', description: 'List all teammates.',
    input_schema: { type: 'object', properties: {} } },
  { name: 'send_message', description: 'Send a message to a teammate.',
    input_schema: { type: 'object', properties: { to: { type: 'string' }, content: { type: 'string' }, msg_type: { type: 'string', enum: [...VALID_MSG_TYPES] } }, required: ['to', 'content'] } },
  { name: 'read_inbox', description: "Read and drain the lead's inbox.",
    input_schema: { type: 'object', properties: {} } },
  { name: 'broadcast', description: 'Send a message to all teammates.',
    input_schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } },
  { name: 'shutdown_request', description: 'Request a teammate to shut down.',
    input_schema: { type: 'object', properties: { teammate: { type: 'string' } }, required: ['teammate'] } },
  { name: 'shutdown_response', description: 'Check shutdown request status.',
    input_schema: { type: 'object', properties: { request_id: { type: 'string' } }, required: ['request_id'] } },
  { name: 'plan_approval', description: "Approve or reject a teammate's plan.",
    input_schema: { type: 'object', properties: { request_id: { type: 'string' }, approve: { type: 'boolean' }, feedback: { type: 'string' } }, required: ['request_id', 'approve'] } },
  { name: 'idle', description: 'Enter idle state (for lead -- rarely used).',
    input_schema: { type: 'object', properties: {} } },
  { name: 'claim_task', description: 'Claim a task from the board by ID.',
    input_schema: { type: 'object', properties: { task_id: { type: 'integer' } }, required: ['task_id'] } }
];

async function agentLoop(messages) {
  while (true) {
    const inbox = BUS.readInbox('lead');
    if (inbox.length > 0) {
      messages.push({ role: 'user', content: `<inbox>${JSON.stringify(inbox, null, 2)}</inbox>` });
    }
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
  const readline = await import('readline');
  const history = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => {
    rl.question('\x1b[36ms11 >> \x1b[0m', async (query) => {
      const q = query.trim().toLowerCase();
      if (['q', 'exit', ''].includes(q)) { rl.close(); return; }
      if (query.trim() === '/team') { console.log(TEAM.listAll()); prompt(); return; }
      if (query.trim() === '/inbox') { console.log(JSON.stringify(BUS.readInbox('lead'), null, 2)); prompt(); return; }
      if (query.trim() === '/tasks') {
        if (!existsSync(TASKS_DIR)) mkdirSync(TASKS_DIR, { recursive: true });
        const files = readdirSync(TASKS_DIR).filter(f => f.startsWith('task_') && f.endsWith('.json')).sort();
        for (const f of files) {
          const t = JSON.parse(readFileSync(join(TASKS_DIR, f), 'utf-8'));
          const marker = { pending: '[ ]', in_progress: '[>]', completed: '[x]' }[t.status] || '[?]';
          const owner = t.owner ? ` @${t.owner}` : '';
          console.log(`  ${marker} #${t.id}: ${t.subject}${owner}`);
        }
        prompt(); return;
      }

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
