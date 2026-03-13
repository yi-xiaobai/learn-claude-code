#!/usr/bin/env python3
"""技能合规检查器 - 扫描 SKILL.md 文件中的问题"""

import os
import re
import argparse
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class Issue:
    """问题描述"""
    file: str
    line_num: int
    line_content: str
    issue_type: str
    severity: str  # "error" or "warning"
    suggestion: str


# 检测规则
RULES = [
    # 硬编码用户路径（排除占位符）
    {
        "pattern": r"/Users/(?!xxx|某用户|your|user)[^/\s]+/",
        "type": "硬编码用户路径",
        "severity": "error",
        "suggestion": "使用 ~ 或 $HOME 替代",
    },
    {
        "pattern": r"/home/(?!xxx|某用户|your|user)[^/\s]+/",
        "type": "硬编码用户路径",
        "severity": "error",
        "suggestion": "使用 ~ 或 $HOME 替代",
    },
    # 常见公司域名（示例）
    {
        "pattern": r"(lanhuapp|jwzg|feishu|alibaba|tencent)\.(com|cn|app)",
        "type": "可能的公司信息",
        "severity": "warning",
        "suggestion": "使用占位符替代，如 your-company.com",
    },
    # 硬编码 IP
    {
        "pattern": r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b",
        "type": "硬编码 IP 地址",
        "severity": "warning",
        "suggestion": "使用域名或环境变量替代",
    },
    # 私有 Token/Key 模式
    {
        "pattern": r"(token|key|secret|password|pwd)\s*[=:]\s*['\"]?[a-zA-Z0-9]{16,}['\"]?",
        "type": "可能的敏感信息",
        "severity": "error",
        "suggestion": "使用环境变量，不要硬编码",
    },
]


def find_skill_files(base_dir: Path) -> List[Path]:
    """查找所有 SKILL.md 文件"""
    return list(base_dir.rglob("SKILL.md"))


def check_gitignore(base_dir: Path) -> List[str]:
    """检查 .gitignore 是否包含 .env"""
    issues = []
    gitignore_path = base_dir.parent / ".gitignore"

    if gitignore_path.exists():
        content = gitignore_path.read_text()
        # 检查是否有 .env 规则
        if not re.search(r"^\.env$|^skills/\.env$|^skills/\*/\.env$", content, re.MULTILINE):
            issues.append("⚠️  .gitignore 未包含 .env 规则")
    else:
        issues.append("⚠️  未找到 .gitignore 文件")

    return issues


def lint_file(file_path: Path) -> Tuple[List[Issue], List[str]]:
    """检查单个文件，返回 (问题列表, 检查项列表)"""
    issues = []
    checks = []
    lines = file_path.read_text().splitlines()
    content = file_path.read_text()

    for line_num, line in enumerate(lines, 1):
        # 跳过注释和空行
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        for rule in RULES:
            matches = re.findall(rule["pattern"], line, re.IGNORECASE)
            if matches:
                # 避免重复报告同一行同一类型问题
                issue = Issue(
                    file=str(file_path),
                    line_num=line_num,
                    line_content=line.strip(),
                    issue_type=rule["type"],
                    severity=rule["severity"],
                    suggestion=rule["suggestion"],
                )
                issues.append(issue)
                break  # 每行只报告一个最严重的问题

    # 检查 .env 文件是否被正确引入
    skill_dir = file_path.parent
    env_file = skill_dir / ".env"

    if env_file.exists():
        # 检查是否有引入 .env 的方式：
        # 1. SKILL.md 中有 source .env 命令
        # 2. 脚本内部有 load_env_file 或类似函数
        has_source = re.search(r"source\s+.*\.env", content)

        # 检查脚本目录
        scripts_dir = skill_dir / "scripts"
        has_script_loader = False
        if scripts_dir.exists():
            for script in scripts_dir.glob("*.py"):
                script_content = script.read_text()
                if re.search(r"(load_env|\.env|environ)", script_content):
                    has_script_loader = True
                    break

        if not has_source and not has_script_loader:
            checks.append(f"⚠️  {skill_dir.name}: 存在 .env 文件但未在 SKILL.md 中引入")

    return issues, checks


def format_output(
    all_issues: List[Issue],
    all_checks: List[str],
    gitignore_issues: List[str],
    skill_files: List[Path],
    base_dir: Path,
) -> str:
    """格式化输出"""
    output = []

    output.append("🔍 技能合规检查")
    output.append(f"目录: {base_dir}/")
    output.append("")
    output.append("━" * 50)

    # 按文件分组
    files_with_issues = set(i.file for i in all_issues)

    for skill_file in sorted(skill_files):
        file_issues = [i for i in all_issues if i.file == str(skill_file)]
        rel_path = skill_file.relative_to(base_dir)

        output.append(f"\n📄 {rel_path}")

        if not file_issues:
            output.append("  ✅ 无问题")
        else:
            for issue in file_issues:
                icon = "❌" if issue.severity == "error" else "⚠️ "
                output.append(f"")
                output.append(f"  {icon} 第 {issue.line_num} 行: {issue.issue_type}")
                # 截断过长的行
                line_display = issue.line_content[:60]
                if len(issue.line_content) > 60:
                    line_display += "..."
                output.append(f"     {line_display}")
                output.append(f"     💡 {issue.suggestion}")

    # .env 引入检查
    if all_checks:
        output.append("")
        output.append("📦 配置检查")
        for check in all_checks:
            output.append(f"  {check}")

    # .gitignore 检查
    if gitignore_issues:
        output.append("")
        output.append("🔐 安全检查")
        for issue in gitignore_issues:
            output.append(f"  {issue}")

    # 汇总
    output.append("")
    output.append("━" * 50)

    errors = sum(1 for i in all_issues if i.severity == "error")
    warnings = sum(1 for i in all_issues if i.severity == "warning")

    if errors + warnings == 0:
        output.append("\n📊 汇总: ✅ 所有检查通过")
    else:
        parts = []
        if errors:
            parts.append(f"{errors} 错误")
        if warnings:
            parts.append(f"{warnings} 警告")
        output.append(f"\n📊 汇总: {', '.join(parts)}")

    return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(description="技能合规检查器")
    parser.add_argument(
        "--dir",
        type=str,
        default="~/.claude/skills/",
        help="要检查的目录（默认 ~/.claude/skills/）",
    )
    args = parser.parse_args()

    base_dir = Path(args.dir).expanduser()

    if not base_dir.exists():
        print(f"❌ 目录不存在: {base_dir}")
        return 1

    # 查找所有 SKILL.md 文件
    skill_files = find_skill_files(base_dir)

    if not skill_files:
        print(f"❌ 未找到 SKILL.md 文件: {base_dir}")
        return 1

    # 检查每个文件
    all_issues = []
    all_checks = []
    for skill_file in skill_files:
        issues, checks = lint_file(skill_file)
        all_issues.extend(issues)
        all_checks.extend(checks)

    # 检查 .gitignore
    gitignore_issues = check_gitignore(base_dir)

    # 输出结果
    print(format_output(all_issues, all_checks, gitignore_issues, skill_files, base_dir))

    # 返回退出码
    errors = sum(1 for i in all_issues if i.severity == "error")
    return 1 if errors > 0 else 0


if __name__ == "__main__":
    exit(main())
