# 参考资料

## 本地上下文

### 当前 `init-project` Skill

参考来源：

```text
/Users/larysong/.agents/skills/init-project/SKILL.md
```

当前行为：

- 生成或接受 kebab-case 项目名。
- 在 `~/repo/projects` 下创建项目目录。
- 创建 `docs/kickoff/`。
- 写入 README。
- 执行 `git init`。
- 通过 `gh repo create` 创建同名私有仓库。
- 执行首次提交和 push。

主要限制：

流程以 prose 描述，agent 每次都要重新构造机械操作，稳定性、上下文成本和审计性都不理想。

### Entry 协议

相关本地文件：

```text
/Users/larysong/entry/protocol/DEFAULT_ENTRY.md
/Users/larysong/entry/protocol/SYNC_BINOMIAL_FOREST.md
```

需要保留的原则：

- 原话 append-only。
- 摘要是派生视图。
- 项目从 durable seed 中提升。
- activity event 记录 created、promoted、archived、connected 等事实。
- 跨设备同步保留 leaves，通过 manifest/frontier 拼接视图。

## 外部参考

### Flue

- https://flueframework.com/
- https://github.com/withastro/flue

对本项目的启发：

- agent 等于 model 加 programmable harness。
- workflow 可以通过 CLI、本地开发服务器或 HTTP endpoint 触发。
- sandbox/filesystem 权限应是 harness 设计的一部分。
- token 和 secret 应留在受控 shell/API 调用之外，不进入模型上下文。

本仓库只把 Flue 作为薄适配壳。核心流程仍在 `src/workflows` 和 `src/cli`。
