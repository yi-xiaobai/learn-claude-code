/**
 * s09_agent_teams.js - Agent Teams
 *
 * Persistent named agents with file-based JSONL inboxes. Each teammate runs
 * its own agent loop in a separate thread. Communication via append-only inboxes.
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
const TEAM_DIR = join(WORKDIR, '.team');
const INBOX_DIR = join(TEAM_DIR, 'inbox');

const SYSTEM = `You are a team lead at ${WORKDIR}. Spawn teammates and communicate via inboxes.`;

const VALID_MSG_TYPES = new Set([
  'message',
  'broadcast',
  'shutdown_request',
  'shutdown_response',
  'plan_approval_response'
]);

// -- MessageBus: JSONL inbox per teammate --
class MessageBus {
  constructor(inboxDir) {
    this.dir = inboxDir;
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  send(sender, to, content, msgType = 'message', extra = null) {
    if (!VALID_MSG_TYPES.has(msgType)) {
      return `Error: Invalid type '${msgType}'. Valid: ${[...VALID_MSG_TYPES].join(', ')}`;
    }

    const msg = {
      type: msgType,
      from: sender,
      content: content,
      timestamp: Date.now()
    };
    if (extra) {
      Object.assign(msg, extra);
    }

    const inboxPath = join(this.dir, `${to}.jsonl`);
    writeFileSync(inboxPath, JSON.stringify(msg) + '\n', { flag: 'a' });
    return `Sent ${msgType} to ${to}`;
  }

  readInbox(name) {
    const inboxPath = join(this.dir, `${name}.jsonl`);
    if (!existsSync(inboxPath)) {
      return [];
    }

    const content = readFileSync(inboxPath, 'utf-8').trim();
    if (!content) {
      return [];
    }

    const messages = content.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    // Drain the inbox
    writeFileSync(inboxPath, '');
    return messages;
  }

  broadcast(sender, content, teammates) {
    let count = 0;
    for (const name of teammates) {
      if (name !== sender) {
        this.send(sender, name, content, 'broadcast');
        count++;
      }
    }
    return `Broadcast to ${count} teammates`;
  }
}

const BUS = new MessageBus(INBOX_DIR);

// -- TeammateManager: persistent named agents with config.json --
class TeammateManager {
  constructor(teamDir) {
    this.dir = teamDir;
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
    this.configPath = join(this.dir, 'config.json');
    this.config = this._loadConfig();
    this.threads = {};
  }

  _loadConfig() {
    if (existsSync(this.configPath)) {
      return JSON.parse(readFileSync(this.configPath, 'utf-8'));
    }
    return { team_name: 'default', members: [] };
  }

  _saveConfig() {
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  _findMember(name) {
    return this.config.members.find(m => m.name === name) || null;
  }

  spawn(name, role, prompt) {
    const member = this._findMember(name);

    if (member) {
      if (member.status !== 'idle' && member.status !== 'shutdown') {
        return `Error: '${name}' is currently ${member.status}`;
      }
      member.status = 'working';
      member.role = role;
    } else {
      this.config.members.push({
        name,
        role,
        status: 'working'
      });
    }
    this._saveConfig();

    // Run teammate loop in background (setTimeout for non-blocking)
    setTimeout(() => this._teammateLoop(name, role, prompt), 0);
    return `Spawned '${name}' (role: ${role})`;
  }

  _teammateLoop(name, role, prompt) {
    const sysPrompt = `You are '${name}', role: ${role}, at ${WORKDIR}. Use send_message to communicate. Complete your task.`;
    const messages = [{ role: 'user', content: prompt }];
    const tools = this._teammateTools();

    for (let i = 0; i < 50; i++) {
      // Read inbox messages
      const inbox = BUS.readInbox(name);
      for (const msg of inbox) {
        messages.push({ role: 'user', content: JSON.stringify(msg) });
      }

      try {
        var response = client.messages.create({
          model: MODEL,
          system: sysPrompt,
          messages: messages,
          tools: tools,
          max_tokens: 8000
        });
      } catch (e) {
        console.error(`[${name}] Error: ${e.message}`);
        break;
      }

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason !== 'tool_use') {
        break;
      }

      const results = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const output = this._exec(name, block.name, block.input);
          console.log(`  [${name}] ${block.name}: ${String(output).slice(0, 120)}`);
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: String(output)
          });
        }
      }
      messages.push({ role: 'user', content: results });
    }

    // Set to idle when done
    const member = this._findMember(name);
    if (member && member.status !== 'shutdown') {
      member.status = 'idle';
      this._saveConfig();
    }
  }

  _exec(sender, toolName, args) {
    // Base tools
    if (toolName === 'bash') {
      return runBash(args.command);
    }
    if (toolName === 'read_file') {
      return runRead(args.path);
    }
    if (toolName === 'write_file') {
      return runWrite(args.path, args.content);
    }
    if (toolName === 'edit_file') {
      return runEdit(args.path, args.old_text, args.new_text);
    }
    if (toolName === 'send_message') {
      return BUS.send(sender, args.to, args.content, args.msg_type || 'message');
    }
    if (toolName === 'read_inbox') {
      return JSON.stringify(BUS.readInbox(sender), null, 2);
    }
    return `Unknown tool: ${toolName}`;
  }

  _teammateTools() {
    return [
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
          properties: { path: { type: 'string' } },
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
        name: 'send_message',
        description: 'Send message to a teammate.',
        input_schema: {
          type: 'object',
          properties: {
            to: { type: 'string' },
            content: { type: 'string' },
            msg_type: { type: 'string', enum: [...VALID_MSG_TYPES] }
          },
          required: ['to', 'content']
        }
      },
      {
        name: 'read_inbox',
        description: 'Read and drain your inbox.',
        input_schema: { type: 'object', properties: {} }
      }
    ];
  }

  listAll() {
    if (!this.config.members || this.config.members.length === 0) {
      return 'No teammates.';
    }
    const lines = [`Team: ${this.config.team_name}`];
    for (const m of this.config.members) {
      lines.push(`  ${m.name} (${m.role}): ${m.status}`);
    }
    return lines.join('\n');
  }

  memberNames() {
    return this.config.members.map(m => m.name);
  }
}

const TEAM = new TeammateManager(TEAM_DIR);

// -- Base tool implementations --
function safePath(p) {
  const path = resolve(WORKDIR, p);
  if (!path.startsWith(WORKDIR)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return path;
}

function runBash(command) {
  const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot'];
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

// -- Lead tool dispatch (9 tools) --
const TOOL_HANDLERS = {
  bash: ({ command }) => runBash(command),
  read_file: ({ path, limit }) => runRead(path, limit),
  write_file: ({ path, content }) => runWrite(path, content),
  edit_file: ({ path, old_text, new_text }) => runEdit(path, old_text, new_text),
  spawn_teammate: ({ name, role, prompt }) => TEAM.spawn(name, role, prompt),
  list_teammates: () => TEAM.listAll(),
  send_message: ({ to, content, msg_type }) => BUS.send('lead', to, content, msg_type || 'message'),
  read_inbox: () => JSON.stringify(BUS.readInbox('lead'), null, 2),
  broadcast: ({ content }) => BUS.broadcast('lead', content, TEAM.memberNames())
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
    name: 'spawn_teammate',
    description: 'Spawn a persistent teammate that runs in its own thread.',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' }, role: { type: 'string' }, prompt: { type: 'string' } },
      required: ['name', 'role', 'prompt']
    }
  },
  {
    name: 'list_teammates',
    description: 'List all teammates with name, role, status.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'send_message',
    description: 'Send a message to a teammate inbox.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        content: { type: 'string' },
        msg_type: { type: 'string', enum: [...VALID_MSG_TYPES] }
      },
      required: ['to', 'content']
    }
  },
  {
    name: 'read_inbox',
    description: 'Read and drain the lead inbox.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'broadcast',
    description: 'Send a message to all teammates.',
    input_schema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content']
    }
  }
];

async function agentLoop(messages) {
  while (true) {
    // Check inbox for lead
    const inbox = BUS.readInbox('lead');
    if (inbox.length > 0) {
      messages.push({
        role: 'user',
        content: `<inbox>${JSON.stringify(inbox, null, 2)}</inbox>`
      });
      messages.push({ role: 'assistant', content: 'Noted inbox messages.' });
    }

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
  const readline = await import('readline');
  const history = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = () => {
    rl.question('\x1b[36ms09 >> \x1b[0m', async (query) => {
      if (query.trim().toLowerCase() === 'q' || query.trim().toLowerCase() === 'exit' || query.trim() === '') {
        rl.close();
        return;
      }

      if (query.trim() === '/team') {
        console.log(TEAM.listAll());
        prompt();
        return;
      }

      if (query.trim() === '/inbox') {
        console.log(JSON.stringify(BUS.readInbox('lead'), null, 2));
        prompt();
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
