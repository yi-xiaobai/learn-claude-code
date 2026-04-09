# CLAUDE.md

Claude Code 学习仓库 - Agent 示例 + 可复用技能集合

## 项目结构

```
agents/              # 12 个渐进式 Agent 示例（s01-s12）
skills/              # Claude Code 技能集合
  ├── turtle/        # Turtle 项目自动化（构建/发布）
  ├── work-log/      # 工作日志管理
  ├── skill-lint/    # 技能合规检查
  └── <name>/
      ├── SKILL.md   # 技能定义（YAML frontmatter + 文档）
      └── scripts/   # 实现脚本（.sh / .py）
```

## 开发规范

### Skills 变更流程

修改 `skills/` 后必须执行：
1. `cp -r skills/<name> ~/.claude/skills/` - 同步到本地
2. 更新 `README.md` 技能列表
3. `bash skills/skill-lint/scripts/lint.sh` - 验证合规

### Commit 规范

格式: `type(scope): message`

```bash
feat(turtle): 新增构建功能
fix(work-log): 修复日期格式
chore(build): 更新依赖
```

### 环境配置

```bash
cp .env.example .env  # ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY, MODEL_ID
yarn install          # 安装依赖
```
