# CLI 输出格式：变量与标点的间隔

## 问题

终端会对路径（`/path/to/repo`）和 URL 自动添加可点击链接（下划线高亮）。当变量值紧贴中文标点或字符时，链接检测范围可能越界，导致下划线渲染异常。

```typescript
// ❌ 路径紧贴中文句号，终端下划线可能覆盖到句号
humanSummaryZh: `${slug} 已就绪于 ${targetPath}。`;

// ✅ 句号前加空格，断开终端链接检测
humanSummaryZh: `${slug} 已就绪于 ${targetPath} 。`;
```

## 规则

在 CLI 的 `humanSummaryZh`、`humanOutputZh` 等面向终端的输出字符串中：

1. **路径、URL 变量后跟中文标点时，中间加空格**：`${path}。` → `${path} 。`
2. **纯标识符变量（slug、数字）不受影响**：`${slug}` 不含 `/`，终端不会误检测
3. **变量在行末无后续字符时无需处理**：`path: ${projectPath}` 行末无标点

## 范围

- `humanSummaryZh` 字符串
- `humanOutputZh` 字符串
- `render*()` 函数输出的多行文本（如果包含路径/URL 后接中文标点）
- `EntryWorkflowError` 的 `humanMessageZh` 参数

## 相关

- 终端链接检测基于 OSC 8 hyperlink 或启发式正则匹配
- macOS Terminal.app、iTerm2、Warp 均有此行为
