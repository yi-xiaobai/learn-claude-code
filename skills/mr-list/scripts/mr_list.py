#!/usr/bin/env python3
"""获取 GitLab MR 列表并以表格形式输出"""

import os
import sys
import subprocess
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path


def load_env_file():
    """从 .env 文件加载环境变量"""
    env_file = Path.home() / ".claude" / "skills" / "mr-list" / ".env"

    if not env_file.exists():
        print(f"❌ 错误：配置文件不存在，请先创建 {env_file}")
        sys.exit(1)

    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()


def get_project_path():
    """获取 GitLab 项目路径"""
    result = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print("❌ 错误：当前目录不是 git 仓库或没有 origin remote")
        sys.exit(1)

    remote_url = result.stdout.strip()

    # 解析项目路径
    # git@gitlab.company.com:group/project.git
    # https://gitlab.company.com/group/project.git
    if remote_url.startswith("git@"):
        project_path = remote_url.split(":")[1].replace(".git", "")
    else:
        parts = remote_url.replace(".git", "").split("/")
        project_path = "/".join(parts[3:])

    return project_path


def gitlab_api_request(url, token):
    """GitLab API 请求"""
    req = urllib.request.Request(url)
    req.add_header("PRIVATE-TOKEN", token)

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"❌ API 请求失败: {e.code}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 请求错误: {e}")
        sys.exit(1)


def get_gitlab_mrs(gitlab_host, token, project_path, show_all):
    """获取 GitLab MR 列表"""
    base_url = f"https://{gitlab_host}/api/v4"
    encoded_path = project_path.replace("/", "%2F")

    # 获取当前用户
    current_user = gitlab_api_request(f"{base_url}/user", token)
    current_username = current_user["username"]

    # 获取项目 ID
    project = gitlab_api_request(f"{base_url}/projects/{encoded_path}", token)
    project_id = project["id"]

    # 获取 open MR 列表
    mrs = gitlab_api_request(
        f"{base_url}/projects/{project_id}/merge_requests"
        "?state=opened&order_by=updated_at&sort=desc",
        token,
    )

    # 默认只显示当前用户的 MR
    if not show_all:
        mrs = [mr for mr in mrs if mr["author"]["username"] == current_username]

    status_icons = {
        "success": "✅",
        "failed": "❌",
        "running": "🔄",
        "pending": "⏳",
        "canceled": "⭕",
        "skipped": "⏭️",
    }

    mr_data = []
    for mr in mrs:
        mr_iid = mr["iid"]
        title = mr["title"][:45] + ("..." if len(mr["title"]) > 45 else "")
        author = mr["author"]["username"]
        updated_at = datetime.fromisoformat(
            mr["updated_at"].replace("Z", "+00:00")
        ).strftime("%Y-%m-%d")
        source_branch = mr["source_branch"]
        target_branch = mr["target_branch"]

        # 获取 Pipeline 状态
        pipeline_status = "N/A"
        try:
            pipelines = gitlab_api_request(
                f"{base_url}/projects/{project_id}/merge_requests/{mr_iid}/pipelines",
                token,
            )
            if pipelines:
                status = pipelines[0].get("status", "unknown")
                icon = status_icons.get(status, "❓")
                pipeline_status = f"{icon} {status}"
        except Exception:
            pass

        mr_link = f"https://{gitlab_host}/{project_path}/merge_requests/{mr_iid}"

        mr_data.append({
            "number": mr_iid,
            "title": title,
            "author": author,
            "source": source_branch,
            "target": target_branch,
            "updated": updated_at,
            "status": pipeline_status,
            "link": mr_link,
        })

    return mr_data, current_username, f"https://{gitlab_host}/{project_path}/merge_requests"


def main():
    parser = argparse.ArgumentParser(description="获取 GitLab MR 列表")
    parser.add_argument("--all", action="store_true", help="显示所有 MR（默认只显示当前用户的）")
    args = parser.parse_args()

    # 加载 .env 文件
    load_env_file()

    # 获取配置
    gitlab_token = os.environ.get("GITLAB_TOKEN")
    gitlab_host = os.environ.get("GITLAB_HOST")

    if not gitlab_token or not gitlab_host:
        print("❌ 错误：请设置 GITLAB_TOKEN 和 GITLAB_HOST 环境变量")
        sys.exit(1)

    # 获取项目路径
    project_path = get_project_path()

    # 获取 MR 列表
    mr_data, current_username, list_url = get_gitlab_mrs(
        gitlab_host, gitlab_token, project_path, args.all
    )

    if not mr_data:
        print(f"🎉 项目 **{project_path}** 当前没有 open 状态的 MR")
        return

    # 输出表格
    filter_hint = "（全部）" if args.all else f"（作者: {current_username}）"
    print(f"\n📋 **{project_path}** - Open MR 列表 {filter_hint} ({len(mr_data)} 个)\n")
    print("| # | 标题 | 作者 | 源分支 → 目标分支 | 更新时间 | 状态 |")
    print("|:---:|------|------|------------------|----------|----------|")

    for mr in mr_data:
        mr_link_text = f"[#{mr['number']}]({mr['link']})"
        print(
            f"| {mr_link_text} | {mr['title']} | {mr['author']} | "
            f"`{mr['source']}` → `{mr['target']}` | {mr['updated']} | {mr['status']} |"
        )

    print(f"\n💡 查看详情: {list_url}")


if __name__ == "__main__":
    main()
