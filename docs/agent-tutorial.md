# 用一个终端创建你的第一个 AI Agent

> 让 AI 从"只会说"变成"能动手"

---

## 什么是 Agent？

想象你有一个非常聪明的助手，但他**只会说话，不会动手**。

你问他："帮我看看当前文件夹有什么文件？"
他回答："你可以用 `ls` 命令查看。"

但他自己不能执行这个命令。

**Agent 的核心突破就是：让 AI 不仅能"说"，还能"做"。**

```
传统 AI：我建议你执行 ls 命令
Agent：我来帮你执行 ls... 当前目录有 a.txt, b.js, c.py
```

---

## Agent 的核心原理：一个循环

Agent 的本质就是一个 **while 循环**：

```
while (AI 还想用工具) {
    1. 把问题发给 AI
    2. AI 思考后决定要不要用工具
    3. 如果要用工具 → 执行工具 → 把结果告诉 AI
    4. 如果不用工具 → 输出答案，结束
}
```

用图来表示：

```
+----------+      +-------+      +---------+
|   你     | ---> |  AI   | ---> |  执行   |
|  提问    |      | 思考  |      |  工具   |
+----------+      +---+---+      +----+----+
                      ^               |
                      |   执行结果    |
                      +---------------+
                      (循环继续直到 AI 满意)
```

---

## 动手：50 行代码实现一个 Agent

创建文件 `my_agent.js`：

```javascript
import Anthropic from "@anthropic-ai/sdk";
import { exec } from "child_process";
import { promisify } from "util";
import * as readline from "readline";

const execAsync = promisify(exec);

// 初始化 AI 客户端
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 告诉 AI 它有什么工具可用
const TOOLS = [{
  name: "bash",
  description: "执行命令行命令",
  input_schema: {
    type: "object",
    properties: { command: { type: "string" } },
    required: ["command"],
  },
}];

// 执行命令的函数
async function runBash(command) {
  try {
    const { stdout } = await execAsync(command);
    return stdout.trim() || "(无输出)";
  } catch (error) {
    return `错误: ${error.message}`;
  }
}

// Agent 核心循环
async function agentLoop(messages) {
  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: "你是一个编程助手，可以执行命令来帮助用户。",
      messages, tools: TOOLS, max_tokens: 4000,
    });

    messages.push({ role: "assistant", content: response.content });

    // 如果 AI 不需要工具了，结束循环
    if (response.stop_reason !== "tool_use") return;

    // 执行 AI 请求的工具
    const results = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        console.log(`执行: ${block.input.command}`);
        const output = await runBash(block.input.command);
        console.log(output);
        results.push({ type: "tool_result", tool_use_id: block.id, content: output });
      }
    }
    messages.push({ role: "user", content: results });
  }
}

// 主程序
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const history = [];

function prompt() {
  rl.question("你: ", async (query) => {
    if (!query || query === "exit") { rl.close(); return; }
    history.push({ role: "user", content: query });
    await agentLoop(history);
    const last = history[history.length - 1].content;
    if (Array.isArray(last)) last.forEach(b => b.text && console.log("AI:", b.text));
    prompt();
  });
}
prompt();
```

运行后试试：

```
你: 列出当前目录的文件
执行: ls
my_agent.js  package.json
AI: 当前目录有 my_agent.js 和 package.json。

你: 创建一个 hello.txt，内容是 "Hello World"
执行: echo "Hello World" > hello.txt
AI: 已创建 hello.txt 文件。
```

**恭喜！你已经创建了一个能"动手"的 AI Agent！**

---

## 理解关键代码

### 1. 工具定义

```javascript
const TOOLS = [{
  name: "bash",
  description: "执行命令行命令",
  input_schema: { ... }
}];
```

这是告诉 AI："你有一个工具叫 bash，可以执行命令。"

### 2. 核心循环

```javascript
while (true) {
  const response = await client.messages.create({ ... });
  
  if (response.stop_reason !== "tool_use") {
    return;  // AI 不需要工具了，结束
  }
  
  // 执行工具，把结果告诉 AI，继续循环
}
```

### 3. stop_reason 的含义

| 值 | 含义 |
|-----|------|
| `tool_use` | AI 想用工具，继续循环 |
| `end_turn` | AI 说完了，结束循环 |

---

## 进阶：添加更多工具

Agent 的强大之处在于可以添加任意工具：

```javascript
const TOOLS = [
  { name: "bash", description: "执行命令" },
  { name: "read_file", description: "读取文件" },
  { name: "write_file", description: "写入文件" },
  { name: "search_web", description: "搜索网页" },
  // 你想加什么都可以...
];
```

每个工具对应一个处理函数：

```javascript
const TOOL_HANDLERS = {
  bash: (input) => runBash(input.command),
  read_file: (input) => fs.readFileSync(input.path, "utf-8"),
  write_file: (input) => fs.writeFileSync(input.path, input.content),
};
```

---

## 为什么 Agent 这么重要？

| 传统 AI | Agent |
|---------|-------|
| 只能聊天 | 能执行操作 |
| 给建议 | 直接帮你做 |
| 一问一答 | 自主完成多步任务 |

**Agent = AI + 工具 + 循环**

这就是从"聊天机器人"到"AI 助手"的进化。

---

## 总结

1. **Agent 本质**：一个让 AI 能调用工具的循环
2. **核心代码**：不到 100 行
3. **关键点**：
   - 定义工具（告诉 AI 能做什么）
   - 循环执行（AI 决定用什么工具）
   - 返回结果（让 AI 继续思考）

现在你已经理解了 Agent 的核心原理，可以开始构建自己的 AI 助手了！

---

## 下一步

- 添加文件读写工具
- 添加任务管理（TodoManager）
- 添加子代理（Subagent）
- 添加技能系统（Skills）

这些进阶功能都在 `agents/` 目录下的示例代码中，欢迎探索！
