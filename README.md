# dsh-plugins-index

shutongX 的 DSH 插件市场索引。一个 format 1 的 `index.json`，把独立插件仓库聚合起来；本身不包含插件代码。

## 在 DSH 里使用

1. DSH → 插件 → 实验性插件 → 更多 → 开启「自定义插件市场」。
2. 打开「发现」→ 添加索引源，粘贴：

```text
https://shutongX.github.io/dsh-plugins-index/index.json
```

3. 在「发现」里浏览并点安装。

> 市场目前不支持原地升级：升级 = 卸载后重新安装。

## 插件

| 插件 | 说明 | 仓库 |
|---|---|---|
| dsh-session-message | 跨会话发 user 消息 | https://github.com/shutongX/dsh-session-message |
| dsh-pocket-switch | 手机端多台 DSH 一键切换 | https://github.com/shutongX/dsh-pocket-switch |
| dsh-config-migrator | DSH 配置打包 / 迁移 | https://github.com/shutongX/dsh-config-migrator |
| dsh-perf | 性能采集与优化建议 | https://github.com/shutongX/dsh-perf |

## 安装（不走索引）

每个插件都是独立仓库，也可以直接装：

```sh
dsh plugin --profile desktop add https://github.com/shutongX/dsh-session-message
```

或在 DSH 插件页「添加插件」里粘贴同样的 GitHub 地址。

## 维护

- `scripts/build-index.mjs`：本地读同级插件目录，选最高的 SemVer release tag，生成 `index.json` 与图标；`--remote` 从 GitHub Releases 读取同一条规则，供 CI 用。
- 每次插件发版后运行 `npm run build`，提交 `index.json`。
- GitHub Actions 每天也会自动刷新一次（版本、commit、图标一起更新；没有 release 的仓库会直接报错，不会退回 main 的未发布提交）。
- 索引格式由 `@deepseek-ai/dsh-plugin-market-index` 校验；npm 装好后脚本会自动校验。

## License

MIT
