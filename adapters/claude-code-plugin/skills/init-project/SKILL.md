---
name: entry-init-project:init-project
description: Claude Code plugin 入口。识别项目初始化请求，调用 entry CLI dry-run/execute，不复制业务逻辑。
---

# entry-init-project:init-project

优先调用仓库构建出的 `entry` CLI：

```bash
entry project init <slug> --desc "<中文描述>" --dry-run --json
```

如插件环境未把 `entry` 放入 PATH，使用 `bin/entry` shim。详细规则见根目录 `skills/init-project/SKILL.md`。
