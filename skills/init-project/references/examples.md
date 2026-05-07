# 示例

## 只看计划

```bash
foyer project init foyer-mono --desc "把 init-project 能力产品化为多交付形式系统" --dry-run --json
```

## 创建本地项目

```bash
foyer project init family-system --desc "家庭信息与决策记录系统" --lane family_system --owner both --json
```

## 创建 GitHub 仓库

```bash
foyer project init agent-workbench --desc "agent 工作台" --github --github-owner songlairui --json
```

## 获取上下文

```bash
foyer activity context --project agent-workbench --budget 6000 --format markdown
```
