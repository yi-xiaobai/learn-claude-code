#!/usr/bin/env python3
"""
GitHub Trending to Feishu
获取 GitHub Trending 热榜前十名，推送到飞书群
"""

import os
import sys
import json
import time
import hmac
import hashlib
import base64
import urllib.request
import urllib.error
import re
from html.parser import HTMLParser
from datetime import datetime


# ============ 配置区域 ============
SINCE = "daily"  # daily / weekly / monthly
LANGUAGE = ""    # 留空为全部，可设置为 "python", "javascript" 等
TOP_N = 10       # 获取前N个项目

# 飞书 Webhook 配置（如果开启了签名校验，需要填写 secret）
# 从飞书机器人设置中获取，格式: https://open.feishu.cn/open-apis/bot/v2/hook/xxx
# 如果开启了签名校验，还需要填写 secret（以 sec_ 开头）
WEBHOOK_URL = ""  # 直接填写 webhook 地址
SECRET = ""       # 签名密钥，以 sec_ 开头（选填）
# ================================


class TrendingParser(HTMLParser):
    """解析 GitHub Trending 页面"""

    def __init__(self):
        super().__init__()
        self.repos = []
        self.current_repo = None
        self.in_repo_article = False
        self.in_h2 = False
        self.in_desc = False
        self.in_stars = False
        self.in_forks = False
        self.in_today = False
        self.in_lang = False
        self.current_class = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        class_attr = attrs_dict.get('class', '')

        # 检测仓库卡片
        if tag == 'article' and 'Box-row' in class_attr:
            self.in_repo_article = True
            self.current_repo = {
                'name': '',
                'url': '',
                'desc': '',
                'stars': '0',
                'forks': '0',
                'today_stars': '0',
                'language': ''
            }
            return

        if not self.in_repo_article:
            return

        # 仓库名称和链接
        if tag == 'h2':
            self.in_h2 = True
            return

        if tag == 'a' and self.in_h2:
            self.current_repo['url'] = 'https://github.com' + attrs_dict.get('href', '')
            return

        # 描述
        if tag == 'p' and 'col-9' in class_attr:
            self.in_desc = True
            return

        # 星标数
        if tag == 'a' and '/stargazers' in attrs_dict.get('href', ''):
            self.in_stars = True
            return

        # Fork数
        if tag == 'a' and '/forks' in attrs_dict.get('href', ''):
            self.in_forks = True
            return

        # 今日新增星标
        if tag == 'span' and 'float-sm-right' in class_attr:
            self.in_today = True
            return

        # 语言
        if tag == 'span' and attrs_dict.get('itemprop') == 'programmingLanguage':
            self.in_lang = True
            return

    def handle_data(self, data):
        data = data.strip()
        if not data:
            return

        if self.in_h2 and self.current_repo:
            # 清理名称中的空白字符
            clean_name = ' '.join(data.split())
            if clean_name:
                self.current_repo['name'] = clean_name

        if self.in_desc and self.current_repo:
            self.current_repo['desc'] = data

        if self.in_stars and self.current_repo:
            self.current_repo['stars'] = data.replace(',', '')

        if self.in_forks and self.current_repo:
            self.current_repo['forks'] = data.replace(',', '')

        if self.in_today and self.current_repo:
            # 提取数字
            match = re.search(r'[\d,]+', data)
            if match:
                self.current_repo['today_stars'] = match.group().replace(',', '')

        if self.in_lang and self.current_repo:
            self.current_repo['language'] = data

    def handle_endtag(self, tag):
        if tag == 'article' and self.in_repo_article:
            self.in_repo_article = False
            if self.current_repo and self.current_repo['name']:
                self.repos.append(self.current_repo)
            self.current_repo = None

        if tag == 'h2':
            self.in_h2 = False
        if tag == 'p':
            self.in_desc = False
        if tag == 'a':
            self.in_stars = False
            self.in_forks = False
        if tag == 'span':
            self.in_today = False
            self.in_lang = False


def fetch_trending(since="daily", language=""):
    """获取 GitHub Trending 数据"""
    url = f"https://github.com/trending/{language}?since={since}"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }

    request = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            html = response.read().decode('utf-8')

        parser = TrendingParser()
        parser.feed(html)

        return parser.repos[:TOP_N]
    except urllib.error.URLError as e:
        print(f"网络请求失败: {e}")
        return []
    except Exception as e:
        print(f"解析失败: {e}")
        return []


def format_number(num_str):
    """格式化数字显示"""
    try:
        num = int(num_str)
        if num >= 1000:
            return f"{num/1000:.1f}k"
        return str(num)
    except:
        return num_str


def build_feishu_card(repos):
    """构建飞书卡片消息"""

    if not repos:
        return {
            "msg_type": "text",
            "content": {
                "text": "❌ 未能获取 GitHub Trending 数据，请稍后重试"
            }
        }

    today = datetime.now().strftime("%Y-%m-%d")

    # 构建项目列表元素
    project_elements = []

    for i, repo in enumerate(repos, 1):
        stars = format_number(repo.get('stars', '0'))
        today_stars = format_number(repo.get('today_stars', '0'))
        lang = repo.get('language', 'Unknown')
        desc = repo.get('desc', '暂无描述')[:60]  # 限制描述长度
        if len(repo.get('desc', '')) > 60:
            desc += "..."

        project_elements.append({
            "tag": "div",
            "text": {
                "tag": "lark_md",
                "content": f"**{i}. [{repo['name']}]({repo['url']})**\n{desc}"
            }
        })
        project_elements.append({
            "tag": "note",
            "elements": [
                {
                    "tag": "plain_text",
                    "content": f"⭐ {stars} (+{today_stars} today) | 🔀 {repo.get('forks', '0')} | 📝 {lang}"
                }
            ]
        })

        if i < len(repos):
            project_elements.append({"tag": "hr"})

    # 完整卡片结构
    card = {
        "msg_type": "interactive",
        "card": {
            "config": {
                "wide_screen_mode": True
            },
            "header": {
                "title": {
                    "tag": "plain_text",
                    "content": f"🔥 GitHub Trending"
                },
                "template": "blue"
            },
            "elements": [
                {
                    "tag": "div",
                    "text": {
                        "tag": "lark_md",
                        "content": f"📅 **{today}** | github trending | 数据来源: [GitHub Trending](https://github.com/trending)"
                    }
                },
                {"tag": "hr"},
                *project_elements,
                {"tag": "hr"},
                {
                    "tag": "note",
                    "elements": [
                        {
                            "tag": "plain_text",
                            "content": f"🤖 由 Claude Code 自动推送 | {datetime.now().strftime('%H:%M:%S')}"
                        }
                    ]
                }
            ]
        }
    }

    return card


def gen_sign(secret):
    """生成飞书签名"""
    timestamp = str(int(time.time()))
    string_to_sign = '{}\n{}'.format(timestamp, secret)
    hmac_code = hmac.new(string_to_sign.encode('utf-8'), digestmod=hashlib.sha256).digest()
    sign = base64.b64encode(hmac_code).decode('utf-8')
    return timestamp, sign


def send_to_feishu(webhook_url, card, secret=""):
    """发送消息到飞书"""
    # 如果提供了 secret，添加签名
    if secret:
        timestamp, sign = gen_sign(secret)
        card['timestamp'] = timestamp
        card['sign'] = sign

    data = json.dumps(card).encode('utf-8')

    headers = {
        'Content-Type': 'application/json',
    }

    request = urllib.request.Request(webhook_url, data=data, headers=headers)

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            print(f"飞书返回: {result}")
            return result.get('StatusCode') == 0 or result.get('code') == 0
    except urllib.error.HTTPError as e:
        print(f"HTTP错误: {e.code} - {e.read().decode('utf-8')}")
        return False
    except Exception as e:
        print(f"发送失败: {e}")
        return False


def main():
    # 获取 webhook（优先使用配置文件的值）
    webhook_url = WEBHOOK_URL or os.environ.get('FEISHU_WEBHOOK', '')

    # 获取 secret
    secret = SECRET or os.environ.get('FEISHU_SECRET', '')

    # 也支持命令行参数
    if '--webhook' in sys.argv:
        idx = sys.argv.index('--webhook')
        if idx + 1 < len(sys.argv):
            webhook_url = sys.argv[idx + 1]

    if '--secret' in sys.argv:
        idx = sys.argv.index('--secret')
        if idx + 1 < len(sys.argv):
            secret = sys.argv[idx + 1]

    if not webhook_url:
        print("错误: 请设置 FEISHU_WEBHOOK 环境变量或使用 --webhook 参数")
        print("用法: python fetch_and_send.py --webhook 'https://open.feishu.cn/...'")
        sys.exit(1)

    print(f"正在获取 GitHub Trending ({SINCE})...")
    repos = fetch_trending(SINCE, LANGUAGE)

    if not repos:
        print("未能获取数据")
        sys.exit(1)

    print(f"获取到 {len(repos)} 个项目")
    for i, repo in enumerate(repos, 1):
        print(f"  {i}. {repo['name']} - ⭐{repo['stars']} (+{repo['today_stars']})")

    print("\n构建飞书卡片...")
    card = build_feishu_card(repos)

    print("发送到飞书...")
    if send_to_feishu(webhook_url, card, secret):
        print("✅ 发送成功!")
    else:
        print("❌ 发送失败")
        sys.exit(1)


if __name__ == "__main__":
    main()
