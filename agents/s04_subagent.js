#!/usr/bin/env node
/**
 * s04_subagent.js - Subagents (JavaScript版本)
 *
 * 派遣一个子代理，使用全新的 messages=[]。子代理在自己的上下文中工作，
 * 共享文件系统，但只返回摘要给主代理。
 *
 *     Parent agent                     Subagent
 *     +------------------+             +------------------+
 *     | messages=[...]   |             | messages=[]      |  <-- 全新上下文
 *     |                  |  dispatch   |                  |
 *     | tool: task       | ---------->| while tool_use:  |
 *     |   prompt="..."   |            |   call tools     |
 *     |   description="" |            |   append results |
 *     |                  |  summary   |                  |
 *     |   result = "..." | <--------- | return last text |
 *     +------------------+             +------------------+
 *               |
 *     主代理上下文保持干净
 *     子代理上下文被丢弃
 *
 * 核心洞察: "进程隔离免费提供了上下文隔离。"
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
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use the task tool to delegate exploration or subtasks.`;
const SUBAGENT_SYSTEM = `You are a coding subagent at ${WORKDIR}. Complete the given task, then summarize your findings.`;

/**
 * 安全路径检查 - 防止路径逃逸到工作目录之外
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

// -- 工具分发映射（主代理和子代理共用） --
const TOOL_HANDLERS = {
  bash: ({ command }) => runBash(command),
  read_file: ({ path: filePath, limit }) => runRead(filePath, limit),
  write_file: ({ path: filePath, content }) => runWrite(filePath, content),
  edit_file: ({ path: filePath, old_text, new_text }) => runEdit(filePath, old_text, new_text),
};

// 子代理工具（不包含 task，防止递归派遣）
const CHILD_TOOLS = [
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
];

/**
 * 子代理：全新上下文，受限工具，只返回摘要
 * @param {string} prompt - 子代理的任务提示
 * @returns {Promise<string>} - 子代理的摘要结果
 */
async function runSubagent(prompt) {
  // 全新的消息上下文
  const subMessages = [{ role: "user", content: prompt }];

  // 安全限制：最多30轮
  for (let i = 0; i < 30; i++) {
    const response = await client.messages.create({
      model: MODEL,
      system: SUBAGENT_SYSTEM,
      messages: subMessages,
      tools: CHILD_TOOLS,
      max_tokens: 8000,
    });

    subMessages.push({ role: "assistant", content: response.content });

    // 如果不再需要工具，退出循环
    if (response.stop_reason !== "tool_use") {
      // 只返回最终文本摘要，子代理的完整对话历史被丢弃
      const summary = response.content
        .filter((b) => b.type === "text" || b.text)
        .map((b) => b.text)
        .join("");
      return summary || "(no summary)";
    }

    // 执行工具调用
    const results = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const handler = TOOL_HANDLERS[block.name];
        const output = handler
          ? await handler(block.input)
          : `Unknown tool: ${block.name}`;
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: String(output).slice(0, 50000),
        });
      }
    }

    subMessages.push({ role: "user", content: results });
  }

  return "(subagent reached iteration limit)";
}

// 主代理工具（包含 task 用于派遣子代理）
const PARENT_TOOLS = [
  ...CHILD_TOOLS,
  {
    name: "task",
    description: "Spawn a subagent with fresh context. It shares the filesystem but not conversation history.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        description: {
          type: "string",
          description: "Short description of the task",
        },
      },
      required: ["prompt"],
    },
  },
];

/**
 * 主代理循环
 * @param {Array} messages - 消息历史
 */
async function agentLoop(messages) {
  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages: messages,
      tools: PARENT_TOOLS,
      max_tokens: 8000,
    });
    console.log('response', response)

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return;
    }

    const results = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        let output;

        if (block.name === "task") {
          // 派遣子代理
          const desc = block.input.description || "subtask";
          console.log(`\x1b[35m> task (${desc}): ${block.input.prompt.slice(0, 80)}\x1b[0m`);
          output = await runSubagent(block.input.prompt);
        } else {
          // 执行普通工具
          const handler = TOOL_HANDLERS[block.name];
          output = handler
            ? await handler(block.input)
            : `Unknown tool: ${block.name}`;
        }

        console.log(`\x1b[33m  ${String(output).slice(0, 200)}\x1b[0m`);

        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: String(output),
        });
      }
    }

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
    rl.question("\x1b[36ms04 >> \x1b[0m", async (query) => {
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
