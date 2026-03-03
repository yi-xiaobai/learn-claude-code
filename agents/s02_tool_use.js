#!/usr/bin/env node
/**
 * s02_tool_use.js - Tools (JavaScript版本)
 *
 * Agent循环没有改变，只是增加了更多工具和一个分发映射表。
 *
 *     +----------+      +-------+      +------------------+
 *     |   User   | ---> |  LLM  | ---> | Tool Dispatch    |
 *     |  prompt  |      |       |      | {                |
 *     +----------+      +---+---+      |   bash: runBash  |
 *                           ^          |   read: runRead  |
 *                           |          |   write: runWrite|
 *                           +----------+   edit: runEdit  |
 *                           tool_result| }                |
 *                                      +------------------+
 *
 * 核心洞察: "循环完全没变，我只是添加了工具。"
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
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use tools to solve tasks. Act, don't explain.`;

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
 * @param {string} command - 要执行的命令
 * @returns {Promise<string>} - 命令输出
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
 * @param {string} filePath - 文件路径
 * @param {number} [limit] - 限制读取的行数
 * @returns {Promise<string>} - 文件内容
 */
async function runRead(filePath, limit = null) {
  try {
    const fullPath = safePath(filePath);
    const text = await fs.readFile(fullPath, "utf-8");
    let lines = text.split("\n");

    if (limit && limit < lines.length) {
      lines = [...lines.slice(0, limit), `... (${lines.length - limit} more lines)`];
    }

    return lines.join("\n").slice(0, 50000);
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

/**
 * 写入文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @returns {Promise<string>} - 操作结果
 */
async function runWrite(filePath, content) {
  try {
    const fullPath = safePath(filePath);
    // 确保目录存在
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    return `Wrote ${content.length} bytes to ${filePath}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

/**
 * 编辑文件 - 替换指定文本
 * @param {string} filePath - 文件路径
 * @param {string} oldText - 要替换的文本
 * @param {string} newText - 替换后的文本
 * @returns {Promise<string>} - 操作结果
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

/**
 * 模糊查找文件
 * @param {string} pattern - 搜索模式（支持文件名模糊匹配）
 * @param {string} [dir] - 搜索目录，默认为工作目录
 * @returns {Promise<string>} - 匹配的文件列表
 */
async function runFind(pattern, dir = ".") {
  try {
    const searchDir = safePath(dir);
    // 使用 find 命令进行模糊搜索，-iname 忽略大小写
    const { stdout, stderr } = await execAsync(
      `find "${searchDir}" -type f -iname "*${pattern}*" 2>/dev/null | head -50`,
      { cwd: WORKDIR, timeout: 30000 }
    );
    const output = stdout.trim();
    if (!output) {
      return `No files found matching: ${pattern}`;
    }
    // 转换为相对路径，更易读
    const files = output.split("\n").map((f) => path.relative(WORKDIR, f));
    return `Found ${files.length} file(s):\n${files.join("\n")}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// -- 工具分发映射: {工具名: 处理函数} --
const TOOL_HANDLERS = {
  bash: ({ command }) => runBash(command),
  read_file: ({ path: filePath, limit }) => runRead(filePath, limit),
  write_file: ({ path: filePath, content }) => runWrite(filePath, content),
  edit_file: ({ path: filePath, old_text, new_text }) => runEdit(filePath, old_text, new_text),
  find_file: ({ pattern, dir }) => runFind(pattern, dir),
};

// 工具定义 - 告诉AI有哪些工具可用
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
    name: "find_file",
    description: "Find files by fuzzy matching filename. Returns list of matching files.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Filename pattern to search (case-insensitive)" },
        dir: { type: "string", description: "Directory to search in (default: current directory)" },
      },
      required: ["pattern"],
    },
  },
];

/**
 * Agent核心循环 - 与s01完全相同，只是工具更多了
 * @param {Array} messages - 消息历史
 */
async function agentLoop(messages) {
  while (true) {
    // 调用LLM
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages: messages,
      tools: TOOLS,
      max_tokens: 8000,
    });
    console.log('response', response)

    // 添加助手回复到消息历史
    messages.push({ role: "assistant", content: response.content });

    // 如果模型没有调用工具，循环结束
    if (response.stop_reason !== "tool_use") {
      return;
    }

    // 执行每个工具调用，收集结果
    const results = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const handler = TOOL_HANDLERS[block.name];
        console.log('block', block.input)
        const output = handler
          ? await handler(block.input)
          : `Unknown tool: ${block.name}`;

        console.log(`\x1b[33m> ${block.name}: ${output.slice(0, 200)}\x1b[0m`);

        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: output,
        });
      }
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
    rl.question("\x1b[36ms02 >> \x1b[0m", async (query) => {
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
