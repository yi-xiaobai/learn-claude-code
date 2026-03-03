#!/usr/bin/env node
/**
 * s03_todo_write.js - TodoWrite (JavaScript版本)
 *
 * AI通过TodoManager追踪自己的任务进度。如果AI忘记更新进度，
 * 系统会自动注入提醒。
 *
 *     +----------+      +-------+      +---------+
 *     |   User   | ---> |  LLM  | ---> | Tools   |
 *     |  prompt  |      |       |      | + todo  |
 *     +----------+      +---+---+      +----+----+
 *                           ^               |
 *                           |   tool_result |
 *                           +---------------+
 *                                 |
 *                     +-----------+-----------+
 *                     | TodoManager state     |
 *                     | [ ] task A            |
 *                     | [>] task B <- doing   |
 *                     | [x] task C            |
 *                     +-----------------------+
 *                                 |
 *                     if rounds_since_todo >= 3:
 *                       inject <reminder>
 *
 * 核心洞察: "AI可以追踪自己的进度——而我也能看到它。"
 */

import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import * as readline from "readline";
import * as fs from "fs/promises";
import * as path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// 获取当前脚本所在目录，加载上级目录的 .env 文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

const execAsync = promisify(exec);
const WORKDIR = process.cwd();

// 初始化Anthropic客户端
const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.MODEL_ID || "claude-sonnet-4-20250514";
const SYSTEM = `You are a coding agent at ${WORKDIR}.
Use the todo tool to plan multi-step tasks. Mark in_progress before starting, completed when done.
Prefer tools over prose.`;

/**
 * TodoManager - AI用来追踪任务进度的管理器
 */
class TodoManager {
  constructor() {
    this.items = [];
  }

  /**
   * 更新任务列表
   * @param {Array} items - 任务数组
   * @returns {string} - 渲染后的任务列表
   */
  update(items) {
    if (items.length > 20) {
      throw new Error("Max 20 todos allowed");
    }

    const validated = [];
    let inProgressCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const text = String(item.text || "").trim();
      const status = String(item.status || "pending").toLowerCase();
      const id = String(item.id || i + 1);

      if (!text) {
        throw new Error(`Item ${id}: text required`);
      }

      if (!["pending", "in_progress", "completed"].includes(status)) {
        throw new Error(`Item ${id}: invalid status '${status}'`);
      }

      if (status === "in_progress") {
        inProgressCount++;
      }

      validated.push({ id, text, status });
    }

    if (inProgressCount > 1) {
      throw new Error("Only one task can be in_progress at a time");
    }

    this.items = validated;
    return this.render();
  }

  /**
   * 渲染任务列表为可读格式
   * @returns {string} - 格式化的任务列表
   */
  render() {
    if (this.items.length === 0) {
      return "No todos.";
    }

    const markers = {
      pending: "[ ]",
      in_progress: "[>]",
      completed: "[x]",
    };

    const lines = this.items.map(
      (item) => `${markers[item.status]} #${item.id}: ${item.text}`
    );

    const done = this.items.filter((t) => t.status === "completed").length;
    lines.push(`\n(${done}/${this.items.length} completed)`);

    return lines.join("\n");
  }
}

// 全局TodoManager实例
const TODO = new TodoManager();

/**
 * 安全路径检查 - 防止路径逃逸到工作目录之外
 * @param {string} p - 相对路径
 * @returns {string} - 绝对路径
 */
function safePath(p) {
  const fullPath = path.resolve(WORKDIR, p);
  if (!fullPath.startsWith(WORKDIR)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return fullPath;
}

/**
 * 执行bash命令
 */
async function runBash(command) {
  const dangerous = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];
  if (dangerous.some((d) => command.includes(d))) {
    return "Error: Dangerous command blocked";
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: WORKDIR,
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
    });
    const output = (stdout + stderr).trim();
    return output ? output.slice(0, 50000) : "(no output)";
  } catch (error) {
    if (error.killed) {
      return "Error: Timeout (120s)";
    }
    const output = ((error.stdout || "") + (error.stderr || "")).trim();
    return output || `Error: ${error.message}`;
  }
}

/**
 * 读取文件内容
 */
async function runRead(filePath, limit = null) {
  try {
    const fullPath = safePath(filePath);
    const text = await fs.readFile(fullPath, "utf-8");
    let lines = text.split("\n");

    if (limit && limit < lines.length) {
      lines = [...lines.slice(0, limit), `... (${lines.length - limit} more)`];
    }

    return lines.join("\n").slice(0, 50000);
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

/**
 * 写入文件
 */
async function runWrite(filePath, content) {
  try {
    const fullPath = safePath(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    return `Wrote ${content.length} bytes`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

/**
 * 编辑文件 - 替换指定文本
 */
async function runEdit(filePath, oldText, newText) {
  try {
    const fullPath = safePath(filePath);
    const content = await fs.readFile(fullPath, "utf-8");

    if (!content.includes(oldText)) {
      return `Error: Text not found in ${filePath}`;
    }

    const newContent = content.replace(oldText, newText);
    await fs.writeFile(fullPath, newContent, "utf-8");
    return `Edited ${filePath}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// -- 工具分发映射 --
const TOOL_HANDLERS = {
  bash: ({ command }) => runBash(command),
  read_file: ({ path: filePath, limit }) => runRead(filePath, limit),
  write_file: ({ path: filePath, content }) => runWrite(filePath, content),
  edit_file: ({ path: filePath, old_text, new_text }) => runEdit(filePath, old_text, new_text),
  todo: ({ items }) => TODO.update(items),
};

// 工具定义
const TOOLS = [
  {
    name: "bash",
    description: "Run a shell command.",
    input_schema: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Read file contents.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        limit: { type: "integer" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Replace exact text in file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" },
      },
      required: ["path", "old_text", "new_text"],
    },
  },
  {
    name: "todo",
    description: "Update task list. Track progress on multi-step tasks.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "completed"],
              },
            },
            required: ["id", "text", "status"],
          },
        },
      },
      required: ["items"],
    },
  },
];

/**
 * Agent核心循环 - 带有提醒注入机制
 * @param {Array} messages - 消息历史
 */
async function agentLoop(messages) {
  let roundsSinceTodo = 0; // 距离上次使用todo工具的轮数

  while (true) {
    // 调用LLM
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages: messages,
      tools: TOOLS,
      max_tokens: 8000,
    });

    // 添加助手回复到消息历史
    messages.push({ role: "assistant", content: response.content });

    // 如果模型没有调用工具，循环结束
    if (response.stop_reason !== "tool_use") {
      return;
    }

    // 执行每个工具调用，收集结果
    const results = [];
    let usedTodo = false;

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const handler = TOOL_HANDLERS[block.name];
        let output;

        try {
          output = handler
            ? await handler(block.input)
            : `Unknown tool: ${block.name}`;
        } catch (error) {
          output = `Error: ${error.message}`;
        }

        console.log(`\x1b[33m> ${block.name}: ${String(output).slice(0, 200)}\x1b[0m`);

        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: String(output),
        });

        if (block.name === "todo") {
          usedTodo = true;
        }
      }
    }

    // 更新提醒计数器
    roundsSinceTodo = usedTodo ? 0 : roundsSinceTodo + 1;

    // 如果3轮没有更新todo，注入提醒
    if (roundsSinceTodo >= 3) {
      results.unshift({
        type: "text",
        text: "<reminder>Update your todos.</reminder>",
      });
    }

    // 将工具结果添加到消息历史
    messages.push({ role: "user", content: results });
  }
}

/**
 * 主函数 - 交互式REPL
 */
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const history = [];

  const prompt = () => {
    rl.question("\x1b[36ms03 >> \x1b[0m", async (query) => {
      if (!query || ["q", "exit"].includes(query.trim().toLowerCase())) {
        rl.close();
        return;
      }

      history.push({ role: "user", content: query });

      try {
        await agentLoop(history);

        // 打印最后的响应
        const responseContent = history[history.length - 1].content;
        if (Array.isArray(responseContent)) {
          for (const block of responseContent) {
            if (block.text) {
              console.log(block.text);
            }
          }
        }
        console.log();
      } catch (error) {
        console.error(`\x1b[31mError: ${error.message}\x1b[0m`);
      }

      prompt();
    });
  };

  prompt();
}

// 运行主函数
main();
