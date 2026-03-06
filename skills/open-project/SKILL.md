---
name: open-project
description: 用 Windsurf IDE 打开指定路径的项目，支持模糊匹配项目名
tags: windsurf, ide, open
args: <path_or_keyword>
---

# 打开项目 Skill

用户说"用 Windsurf 打开 xxx 项目"时使用此 skill。

## 默认项目目录

```
~/Documents/1_project
```

## 执行流程

1. **完整路径**：直接打开
   ```bash
   open -a "Windsurf" /full/path/to/project
   ```

2. **关键词/项目名**：在默认目录下查找
   
   **Step 1: 查找匹配的目录**
   ```bash
   find ~/Documents/1_project -maxdepth 2 -type d -iname "*<keyword>*" 2>/dev/null | head -5
   ```
   
   **Step 2: 检查找到的目录是否有子目录**
   ```bash
   # 如果找到的目录下有子目录，打开第一个子目录
   # 否则直接打开找到的目录
   
   FOUND_PATH=<matched_path>
   SUBDIR=$(find "$FOUND_PATH" -maxdepth 1 -mindepth 1 -type d | head -1)
   
   if [ -n "$SUBDIR" ]; then
     # 有子目录，打开子目录
     open -a "Windsurf" "$SUBDIR"
   else
     # 没有子目录，打开找到的目录
     open -a "Windsurf" "$FOUND_PATH"
   fi
   ```

## 示例

| 用户说 | 执行 |
|-------|-----|
| "打开 enterprise-admin" | 查找 `*enterprise-admin*` 并打开 |
| "打开 h5 项目" | 查找 `*h5*` 并打开 |
| "打开 /Users/luoyi/xxx" | 直接打开完整路径 |

## 匹配规则

- 不区分大小写
- 支持部分匹配（包含关键词即可）
- 如果有多个匹配，列出让用户选择
- 搜索深度：最多 2 层子目录

## 注意

- 如果路径包含空格，需要用引号包裹
- 找不到匹配时提示用户检查关键词
