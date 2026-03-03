#!/usr/bin/env node
/**
 * s01_agent_loop.js - The Agent Loop (JavaScript版本)
 *
 * AI编程代理的核心模式：
 *
 *     while (stopReason === "tool_use") {
 *         response = LLM(messages, tools)
 *         execute tools
 *         append results
 *     }
 *
 *     +----------+      +-------+      +---------+
 *     |   User   | ---> |  LLM  | ---> |  Tool   |
 *     |  prompt  |      |       |      | execute |
 *     +----------+      +---+---+      +----+----+
 *                           ^               |
 *                           |   tool_result |
 *                           +---------------+
 *                           (loop continues)
 */

import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import * as readline from "readline";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// 获取当前脚本所在目录，加载上级目录的 .env 文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

const execAsync = promisify(exec);

// 初始化Anthropic客户端
const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.MODEL_ID || "claude-sonnet-4-20250514";
const SYSTEM = `You are a coding agent at ${process.cwd()}. Use bash to solve tasks. Act, don't explain.`;

// 工具定义
const TOOLS = [
  {
    name: "bash",
    description: "Run a shell command.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string" },
      },
      required: ["command"],
    },
  },
];

/**
 * 执行bash命令
 * @param {string} command - 要执行的命令
 * @returns {Promise<string>} - 命令输出
 */
async function runBash(command) {
  // 危险命令检测
  const dangerous = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];
  if (dangerous.some((d) => command.includes(d))) {
    return "Error: Dangerous command blocked";
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 120000, // 120秒超时
      maxBuffer: 1024 * 1024 * 10, // 10MB缓冲区
    });

    const output = (stdout + stderr).trim();
    return output ? output.slice(0, 50000) : "(no output)";
  } catch (error) {
    if (error.killed) {
      return "Error: Timeout (120s)";
    }
    // 返回错误信息，包含stdout和stderr
    const output = ((error.stdout || "") + (error.stderr || "")).trim();
    return output || `Error: ${error.message}`;
  }
}

/**
 * Agent核心循环
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
        console.log(`\x1b[33m$ ${block.input.command}\x1b[0m`);
        const output = await runBash(block.input.command);
        console.log(output.slice(0, 200));
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
    rl.question("\x1b[36ms01 >> \x1b[0m", async (query) => {
      // 退出条件
      if (!query || ["q", "exit"].includes(query.trim().toLowerCase())) {
        rl.close();
        return;
      }

      // 添加用户消息
      history.push({ role: "user", content: query });

      try {
        // 运行agent循环
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

      // 继续下一轮
      prompt();
    });
  };

  prompt();
}

// 运行主函数
main();
