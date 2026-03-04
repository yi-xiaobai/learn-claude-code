#!/usr/bin/env node
/**
 * s05_skill_loading.js - Skills (JavaScript版本)
 *
 * 两层技能注入，避免系统提示词膨胀：
 *
 *     Layer 1（便宜）: 系统提示词中只放技能名称（~100 tokens/技能）
 *     Layer 2（按需）: 调用 load_skill 时返回完整技能内容
 *
 *     skills/
 *       pdf/
 *         SKILL.md          <-- frontmatter (name, description) + body
 *       code-review/
 *         SKILL.md
 *
 *     系统提示词:
 *     +--------------------------------------+
 *     | You are a coding agent.              |
 *     | Skills available:                    |
 *     |   - pdf: Process PDF files...        |  <-- Layer 1: 只有元数据
 *     |   - code-review: Review code...      |
 *     +--------------------------------------+
 *
 *     当模型调用 load_skill("pdf"):
 *     +--------------------------------------+
 *     | tool_result:                         |
 *     | <skill>                              |
 *     |   完整的PDF处理指令                   |  <-- Layer 2: 完整内容
 *     |   Step 1: ...                        |
 *     |   Step 2: ...                        |
 *     | </skill>                             |
 *     +--------------------------------------+
 *
 * 核心洞察: "不要把所有东西都放进系统提示词，按需加载。"
 */

import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import * as readline from "readline";
import * as fs from "fs/promises";
import * as fsSync from "fs";
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
const SKILLS_DIR = path.join(WORKDIR, "../skills");

// 初始化Anthropic客户端
const client = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.MODEL_ID || "claude-sonnet-4-20250514";

/**
 * SkillLoader - 扫描并加载 skills/<name>/SKILL.md 文件
 */
class SkillLoader {
  constructor(skillsDir) {
    this.skillsDir = skillsDir;
    this.skills = {};
    this._loadAll();
  }

  /**
   * 扫描所有技能文件
   */
  _loadAll() {
    if (!fsSync.existsSync(this.skillsDir)) {
      return;
    }

    // 递归查找所有 SKILL.md 文件
    const findSkillFiles = (dir) => {
      const files = [];
      try {
        const entries = fsSync.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...findSkillFiles(fullPath));
          } else if (entry.name === "SKILL.md") {
            files.push(fullPath);
          }
        }
      } catch (e) {
        // 忽略读取错误
      }
      return files;
    };

    const skillFiles = findSkillFiles(this.skillsDir).sort();

    for (const filePath of skillFiles) {
      try {
        const text = fsSync.readFileSync(filePath, "utf-8");
        const { meta, body } = this._parseFrontmatter(text);
        const name = meta.name || path.basename(path.dirname(filePath));
        this.skills[name] = { meta, body, path: filePath };
      } catch (e) {
        // 忽略解析错误
      }
    }
  }

  /**
   * 解析 YAML frontmatter（--- 之间的元数据）
   * @param {string} text - 文件内容
   * @returns {{meta: Object, body: string}}
   */
  _parseFrontmatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)/);
    if (!match) {
      return { meta: {}, body: text };
    }

    const meta = {};
    const frontmatter = match[1].trim();
    for (const line of frontmatter.split("\n")) {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        meta[key] = value;
      }
    }

    return { meta, body: match[2].trim() };
  }

  /**
   * Layer 1: 获取所有技能的简短描述（用于系统提示词）
   * @returns {string}
   */
  getDescriptions() {
    const names = Object.keys(this.skills);
    if (names.length === 0) {
      return "(no skills available)";
    }

    const lines = [];
    for (const name of names) {
      const skill = this.skills[name];
      const desc = skill.meta.description || "No description";
      const tags = skill.meta.tags || "";
      let line = `  - ${name}: ${desc}`;
      if (tags) {
        line += ` [${tags}]`;
      }
      lines.push(line);
    }

    return lines.join("\n");
  }

  /**
   * Layer 2: 获取指定技能的完整内容
   * @param {string} name - 技能名称
   * @returns {string}
   */
  getContent(name) {
    const skill = this.skills[name];
    if (!skill) {
      const available = Object.keys(this.skills).join(", ") || "none";
      return `Error: Unknown skill '${name}'. Available: ${available}`;
    }
    return `<skill name="${name}">\n${skill.body}\n</skill>`;
  }
}

// 全局 SkillLoader 实例
const SKILL_LOADER = new SkillLoader(SKILLS_DIR);

// Layer 1: 技能元数据注入到系统提示词
const SYSTEM = `You are a coding agent at ${WORKDIR}.
Use load_skill to access specialized knowledge before tackling unfamiliar topics.

Skills available:
${SKILL_LOADER.getDescriptions()}`;

/**
 * 安全路径检查
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
 * 编辑文件
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
  load_skill: ({ name }) => SKILL_LOADER.getContent(name),
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
    name: "load_skill",
    description: "Load specialized knowledge by name.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Skill name to load",
        },
      },
      required: ["name"],
    },
  },
];

/**
 * Agent核心循环
 * @param {Array} messages - 消息历史
 */
async function agentLoop(messages) {
  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages: messages,
      tools: TOOLS,
      max_tokens: 8000,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return;
    }

    const results = [];
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
    rl.question("\x1b[36ms05 >> \x1b[0m", async (query) => {
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
