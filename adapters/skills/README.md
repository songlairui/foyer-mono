# Skill 适配说明

默认 skill 位于 `skills/init-project/`。这个目录只保留交付说明：所有确定性操作都调用 `foyer` CLI。

宿主如果要求 skills 必须放在 adapter 内，可以复制 `skills/init-project/`，但不要复制 workflow 逻辑。
