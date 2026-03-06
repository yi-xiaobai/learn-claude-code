#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
github-trending.py - 获取 GitHub 热榜并推送到飞书群

使用方法:
  python3 github-trending.py              # 推送今日热榜
  python3 github-trending.py --language javascript  # 指定语言
  python3 github-trending.py --dry-run    # 测试模式，不实际推送

无需安装任何第三方库，使用 Python 标准库实现。
"""

import urllib.request
import urllib.error
import json
import re
import os
import sys
from datetime import datetime
from html.parser import HTMLParser

# ============ 配置 ============
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(SCRIPT_DIR, '.env')
TOP_N = 10
# ==============================


def load_env():
    """加载 .env 文件"""
    env = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env[key.strip()] = value.strip()
    return env


class GitHubTrendingParser(HTMLParser):
    """解析 GitHub Trending 页面的 HTML"""
    
    def __init__(self):
        super().__init__()
        self.repos = []
        self.current_repo = {}
        self.in_article = False
        self.in_repo_link = False
        self.in_description = False
        self.in_language = False
        self.in_stars = False
        self.in_today_stars = False
        self.capture_text = False
        self.current_text = ''
        self.tag_stack = []
        
    def handle_starttag(self, tag, attrs):
        self.tag_stack.append(tag)
        attrs_dict = dict(attrs)
        class_name = attrs_dict.get('class', '')
        
        if tag == 'article' and 'Box-row' in class_name:
            self.in_article = True
            self.current_repo = {}
            
        if self.in_article:
            # 仓库链接 - 在 h2 标签内的 a 标签
            if tag == 'a' and 'href' in attrs_dict:
                href = attrs_dict['href']
                # 检查是否是仓库链接格式 /owner/repo
                if href.startswith('/') and href.count('/') == 2:
                    if 'stargazers' not in href and 'network' not in href:
                        parts = href.strip('/').split('/')
                        if len(parts) == 2 and not self.current_repo.get('url'):
                            self.current_repo['owner'] = parts[0]
                            self.current_repo['name'] = parts[1]
                            self.current_repo['url'] = f'https://github.com{href}'
                            
                # 星标链接
                if href.endswith('/stargazers'):
                    self.in_stars = True
                    self.capture_text = True
                    self.current_text = ''
            
            # 描述
            if tag == 'p' and 'col-9' in class_name:
                self.in_description = True
                self.capture_text = True
                self.current_text = ''
                
            # 语言
            if tag == 'span' and attrs_dict.get('itemprop') == 'programmingLanguage':
                self.in_language = True
                self.capture_text = True
                self.current_text = ''
                
            # 今日星标
            if tag == 'span' and 'd-inline-block' in class_name and 'float-sm-right' in class_name:
                self.in_today_stars = True
                self.capture_text = True
                self.current_text = ''
    
    def handle_endtag(self, tag):
        if self.tag_stack and self.tag_stack[-1] == tag:
            self.tag_stack.pop()
            
        if tag == 'article' and self.in_article:
            self.in_article = False
            if self.current_repo.get('url'):
                self.current_repo.setdefault('description', '暂无描述')
                self.current_repo.setdefault('language', '-')
                self.current_repo.setdefault('stars', '0')
                self.current_repo.setdefault('todayStars', '')
                self.repos.append(self.current_repo)
            self.current_repo = {}
            
        if tag == 'a' and self.in_stars:
            self.in_stars = False
            self.capture_text = False
            stars = self.current_text.strip().replace(',', '')
            if stars:
                self.current_repo['stars'] = stars
                
        if tag == 'p' and self.in_description:
            self.in_description = False
            self.capture_text = False
            desc = self.current_text.strip()
            if desc:
                self.current_repo['description'] = desc[:80] + ('...' if len(desc) > 80 else '')
                
        if tag == 'span' and self.in_language:
            self.in_language = False
            self.capture_text = False
            lang = self.current_text.strip()
            if lang:
                self.current_repo['language'] = lang
                
        if tag == 'span' and self.in_today_stars:
            self.in_today_stars = False
            self.capture_text = False
            today = self.current_text.strip()
            today = re.sub(r'\s*stars?\s*(today|this week)?\s*', '', today, flags=re.I).strip()
            if today:
                self.current_repo['todayStars'] = today
    
    def handle_data(self, data):
        if self.capture_text:
            self.current_text += data


def fetch_github_trending(language=''):
    """获取 GitHub Trending 数据"""
    url = f'https://github.com/trending/{language}?since=daily' if language else 'https://github.com/trending?since=daily'
    
    print(f'🔍 正在获取: {url}')
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
    }
    
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            html = response.read().decode('utf-8')
    except urllib.error.URLError as e:
        raise Exception(f'网络请求失败: {e}')
    
    parser = GitHubTrendingParser()
    parser.feed(html)
    
    repos = parser.repos[:TOP_N]
    for i, repo in enumerate(repos):
        repo['rank'] = i + 1
        repo['fullName'] = f"{repo['owner']}/{repo['name']}"
    
    return repos


def build_feishu_card(repos, language=''):
    """构建飞书消息卡片"""
    today = datetime.now().strftime('%Y/%m/%d')
    
    title = f"🔥 GitHub {language.upper()} 热榜 Top {len(repos)}" if language else f"🔥 GitHub 今日热榜 Top {len(repos)}"
    
    # 构建项目列表
    lines = []
    for repo in repos:
        stars_info = f"⭐ {repo['stars']}"
        if repo['todayStars']:
            stars_info += f" (+{repo['todayStars']})"
        
        lines.append(f"**{repo['rank']}. [{repo['fullName']}]({repo['url']})**")
        lines.append(f"{stars_info} | 📝 {repo['language']}")
        lines.append(repo['description'])
        lines.append('')
        lines.append('---')
        lines.append('')
    
    content = '\n'.join(lines[:-2])  # 去掉最后的分隔线
    
    return {
        'msg_type': 'interactive',
        'card': {
            'header': {
                'title': {'tag': 'plain_text', 'content': title},
                'template': 'red'
            },
            'elements': [
                {
                    'tag': 'div',
                    'text': {'tag': 'plain_text', 'content': f'📅 {today} | 数据来源: github.com/trending'}
                },
                {'tag': 'hr'},
                {
                    'tag': 'div',
                    'text': {'tag': 'lark_md', 'content': content}
                },
                {'tag': 'hr'},
                {
                    'tag': 'note',
                    'elements': [{'tag': 'plain_text', 'content': '💡 点击项目名称可直接访问 GitHub 仓库'}]
                }
            ]
        }
    }


def push_to_feishu(card, webhook_url):
    """推送到飞书群"""
    print('📤 正在推送到飞书群...')
    
    data = json.dumps(card).encode('utf-8')
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
    except urllib.error.URLError as e:
        raise Exception(f'推送失败: {e}')
    
    if result.get('code', 0) != 0 and result.get('StatusCode', 0) != 0:
        raise Exception(f"飞书推送失败: {result}")
    
    print('✅ 推送成功！')
    return result


def print_to_console(repos):
    """打印热榜到控制台"""
    print('\n' + '=' * 60)
    print(f'🔥 GitHub 今日热榜 Top {len(repos)}')
    print('=' * 60)
    
    for repo in repos:
        stars_info = f"⭐ {repo['stars']}"
        if repo['todayStars']:
            stars_info += f" (+{repo['todayStars']})"
        
        print(f"\n{repo['rank']}. {repo['fullName']}")
        print(f"   {stars_info} | 📝 {repo['language']}")
        print(f"   {repo['description']}")
        print(f"   🔗 {repo['url']}")
    
    print('\n' + '=' * 60)


def main():
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    
    language = ''
    if '--language' in args:
        idx = args.index('--language')
        if idx + 1 < len(args):
            language = args[idx + 1]
    
    print('🚀 GitHub 热榜推送工具 (Python 版)')
    print(f'⏰ {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    
    # 加载环境变量
    env = load_env()
    webhook_url = env.get('FEISHU_WEBHOOK_URL', '')
    
    try:
        # 获取热榜数据
        repos = fetch_github_trending(language)
        
        if not repos:
            print('⚠️ 未获取到热榜数据')
            return
        
        print(f'📊 获取到 {len(repos)} 个热门项目')
        
        # 打印到控制台
        print_to_console(repos)
        
        if dry_run:
            print('\n🧪 测试模式，不实际推送')
            card = build_feishu_card(repos, language)
            print('\n📋 消息卡片 JSON:')
            print(json.dumps(card, ensure_ascii=False, indent=2))
            return
        
        # 检查 Webhook URL
        if not webhook_url:
            print('\n⚠️ 未配置 FEISHU_WEBHOOK_URL，跳过推送')
            print('请在 .env 文件中配置飞书群机器人 Webhook URL')
            return
        
        # 推送到飞书
        card = build_feishu_card(repos, language)
        push_to_feishu(card, webhook_url)
        
    except Exception as e:
        print(f'❌ 执行失败: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
