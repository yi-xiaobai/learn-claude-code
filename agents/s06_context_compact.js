#!/usr/bin/env node
/**
 * s06_context_compact.js - 三层上下文压缩管道
 *
 * 让AI代理能够"永远工作"的核心机制：
 *
 *     每轮对话:
 *     +------------------+
 *     | Tool call result |
 *     +------------------+
 *             |
 *             v
 *     [Layer 1: micro_compact]        (静默执行，每轮)
 *       将超过最近3个的工具结果替换为
 *       "[Previous: used {tool_name}]"
 *             |
 *             v
 *     [检查: tokens > 50000?]
 *        |               |
 *        否              是
 *        |               |
 *        v               v
 *     继续执行    [Layer 2: auto_compact]
 *                   保存完整对话到 .transcripts/
 *                   调用LLM生成摘要
 *                   用摘要替换所有消息
 *                         |
 *                         v
 *                 [Layer 3: compact tool]
 *                   模型调用compact工具 -> 立即压缩
 *                   与auto_compact相同，但手动触发
 *
 * 核心思想: "代理可以策略性地遗忘，从而永远工作下去。"
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// 获取当前脚本所在目录，加载上级目录的 .env 文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

// 配置常量
const WORKDIR = process.cwd();
const MODEL = process.env.MODEL_ID || 'claude-sonnet-4-20250514';
const THRESHOLD = 50000;  // token阈值，超过则触发自动压缩
const TRANSCRIPT_DIR = path.join(WORKDIR, '.transcripts');
const KEEP_RECENT = 3;    // 保留最近3个工具结果

// 初始化Anthropic客户端
const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM = `You are a coding agent at ${WORKDIR}. Use tools to solve tasks.`;

/**
 * 估算token数量
 * 粗略计算：约4个字符 = 1个token
 */
function estimateTokens(messages) {
  return Math.ceil(JSON.stringify(messages).length / 4);
}

/**
 * Layer 1: micro_compact - 微压缩
 * 将旧的工具调用结果替换为占位符，减少上下文体积
 */
function microCompact(messages) {
  const toolResults = [];

  // 收集所有tool_result条目
  for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
    const msg = messages[msgIdx];
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      for (let partIdx = 0; partIdx < msg.content.length; partIdx++) {
        const part = msg.content[partIdx];
        if (part && part.type === 'tool_result') {
          toolResults.push({ msgIdx, partIdx, part });
        }
      }
    }
  }

  // 如果工具结果数量不超过保留数，直接返回
  if (toolResults.length <= KEEP_RECENT) {
    return messages;
  }

  // 从assistant消息中构建tool_name映射表
  const toolNameMap = {};
  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_use') {
          toolNameMap[block.id] = block.name;
        }
      }
    }
  }

  // 清理旧结果（保留最近KEEP_RECENT个）
  const toClear = toolResults.slice(0, -KEEP_RECENT);
  for (const { part } of toClear) {
    if (typeof part.content === 'string' && part.content.length > 100) {
      const toolId = part.tool_use_id || '';
      const toolName = toolNameMap[toolId] || 'unknown';
      part.content = `[Previous: used ${toolName}]`;
    }
  }

  return messages;
}

/**
 * Layer 2: auto_compact - 自动压缩
 * 保存完整对话记录，调用LLM生成摘要，用摘要替换所有历史消息
 */
async function autoCompact(messages) {
  // 确保transcript目录存在
  if (!fs.existsSync(TRANSCRIPT_DIR)) {
    fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });
  }

  // 保存完整对话到磁盘
  const transcriptPath = path.join(TRANSCRIPT_DIR, `transcript_${Date.now()}.jsonl`);
  const writeStream = fs.createWriteStream(transcriptPath);

  for (const msg of messages) {
    writeStream.write(JSON.stringify(msg) + '\n');
  }
  writeStream.end();

  console.log(`[transcript saved: ${transcriptPath}]`);

  // 调用LLM生成摘要
  const conversationText = JSON.stringify(messages).slice(0, 80000);
  const response = await client.messages.create({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `Summarize this conversation for continuity. Include: 1) What was accomplished, 2) Current state, 3) Key decisions made. Be concise but preserve critical details.\n\n${conversationText}`
    }],
    max_tokens: 2000,
  });

  const summary = response.content[0].text;

  // 用压缩后的摘要替换所有消息
  return [
    { role: 'user', content: `[Conversation compressed. Transcript: ${transcriptPath}]\n\n${summary}` },
    { role: 'assistant', content: 'Understood. I have the context from the summary. Continuing.' }
  ];
}

// ==================== 工具实现 ====================

/**
 * 安全路径检查 - 防止路径逃逸
 */
function safePath(p) {
  const resolved = path.resolve(WORKDIR, p);
  if (!resolved.startsWith(WORKDIR)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return resolved;
}

/**
 * 执行bash命令
 */
function runBash(command) {
  // 危险命令黑名单
  const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot', '> /dev/'];
  if (dangerous.some(d => command.includes(d))) {
    return 'Error: Dangerous command blocked';
  }

  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, cwd: WORKDIR });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    // 120秒超时
    const timeout = setTimeout(() => {
      child.kill();
      resolve('Error: Timeout (120s)');
    }, 120000);

    child.on('close', () => {
      clearTimeout(timeout);
      const out = (stdout + stderr).trim();
      resolve(out ? out.slice(0, 50000) : '(no output)');
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      resolve(`Error: ${err.message}`);
    });
  });
}

/**
 * 读取文件内容
 */
function runRead(filePath, limit) {
  try {
    const content = fs.readFileSync(safePath(filePath), 'utf-8');
    const lines = content.split('\n');
    if (limit && limit < lines.length) {
      lines.splice(limit, lines.length - limit, `... (${lines.length - limit} more)`);
    }
    return lines.join('\n').slice(0, 50000);
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

/**
 * 写入文件
 */
function runWrite(filePath, content) {
  try {
    const fp = safePath(filePath);
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fp, content);
    return `Wrote ${content.length} bytes`;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

/**
 * 编辑文件 - 替换指定文本
 */
function runEdit(filePath, oldText, newText) {
  try {
    const fp = safePath(filePath);
    const content = fs.readFileSync(fp, 'utf-8');
    if (!content.includes(oldText)) {
      return `Error: Text not found in ${filePath}`;
    }
    const newContent = content.replace(oldText, newText);
    fs.writeFileSync(fp, newContent);
    return `Edited ${filePath}`;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

// 工具处理器映射
const TOOL_HANDLERS = {
  bash: async (args) => runBash(args.command),
  read_file: (args) => runRead(args.path, args.limit),
  write_file: (args) => runWrite(args.path, args.content),
  edit_file: (args) => runEdit(args.path, args.old_text, args.new_text),
  compact: async () => 'Compressing...'
};

// 工具定义（供Claude API使用）
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
      properties: { 
        path: { type: 'string' }, 
        old_text: { type: 'string' }, 
        new_text: { type: 'string' } 
      },
      required: ['path', 'old_text', 'new_text']
    }
  },
  {
    name: 'compact',
    description: 'Trigger manual conversation compression.',
    input_schema: {
      type: 'object',
      properties: { 
        focus: { type: 'string', description: 'What to preserve in the summary' } 
      }
    }
  }
];

/**
 * 代理主循环
 * 处理用户输入，调用LLM，执行工具，管理上下文压缩
 */
async function agentLoop(messages) {
  while (true) {
    console.log('messages', JSON.stringify(messages, null, 2))
    // Layer 1: 每次LLM调用前执行微压缩
    microCompact(messages);

    // Layer 2: 如果token估算超过阈值，执行自动压缩
    if (estimateTokens(messages) > THRESHOLD) {
      console.log('[auto_compact triggered]');
      const compacted = await autoCompact(messages);
      messages.length = 0;
      messages.push(...compacted);
    }

    // 调用Claude API
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages: messages,
      tools: TOOLS,
      max_tokens: 8000
    });

    messages.push({ role: 'assistant', content: response.content });

    // 如果不是工具调用，结束循环
    if (response.stop_reason !== 'tool_use') {
      return;
    }

    // 处理工具调用
    const results = [];
    let manualCompact = false;

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        let output;
        if (block.name === 'compact') {
          manualCompact = true;
          output = 'Compressing...';
        } else {
          const handler = TOOL_HANDLERS[block.name];
          try {
            output = handler ? await handler(block.input) : `Unknown tool: ${block.name}`;
          } catch (e) {
            output = `Error: ${e.message}`;
          }
        }

        console.log(`> ${block.name}: ${String(output).slice(0, 200)}`);
        results.push({ type: 'tool_result', tool_use_id: block.id, content: String(output) });
      }
    }

    messages.push({ role: 'user', content: results });

    // Layer 3: 如果模型调用了compact工具，执行手动压缩
    if (manualCompact) {
      console.log('[manual compact]');
      const compacted = await autoCompact(messages);
      messages.length = 0;
      messages.push(...compacted);
    }
  }
}

/**
 * 主函数 - CLI交互循环
 */
async function main() {
  const history = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = () => {
    rl.question('\x1b[36ms06 >> \x1b[0m', async (query) => {
      if (query.trim().toLowerCase() === 'q' || 
          query.trim().toLowerCase() === 'exit' || 
          query.trim() === '') {
        rl.close();
        return;
      }

      history.push({ role: 'user', content: query });
      await agentLoop(history);

      // 输出助手响应
      const responseContent = history[history.length - 1].content;
      if (Array.isArray(responseContent)) {
        for (const block of responseContent) {
          if (block.type === 'text') {
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

// 启动程序
main().catch(console.error);
