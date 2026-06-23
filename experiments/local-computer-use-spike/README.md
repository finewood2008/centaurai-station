# Phase 0 Spike — Computer Use 可行性验证

独立小脚本(不依赖主仓),验证 **截屏 / 鼠标 / 键盘** 三项原子能力能否在目标 OS 上跑通。
这是整个本地客户端 computer-use 特性的成败前提。

## 怎么跑

```bash
cd experiments/local-computer-use-spike
npm install
npm run spike     # 5 秒后开始,先把焦点切到一个空文本框(记事本/搜索框)
```

脚本会**真实**移动鼠标、点击、敲字,并在当前目录产出 `screenshot.*`。

## 判定标准

| 结果 | 含义 |
| ---- | ---- |
| 截屏 ✓ + 鼠标 ✓ + 键盘 ✓ | 该 OS 可作为 executor 宿主,进入 P1 |
| 任一 ✗ | 看终端错误 + 下方各 OS 说明 |

## 各 OS 预期

- **Windows(v1 首发)**:三项应全 ✓,无需额外授权。**真正的验证必须在 Windows 机上跑。**
- **macOS**:首次运行弹「辅助功能」+「屏幕录制」授权,授权后重跑才会 ✓。
- **Linux / X11**:正常 ✓。
- **Linux / Wayland**:注入预期 ✗(系统默认禁止),需后续接 `ydotool`/`libei`,属已知项。

## 参考后端 NutScreenController.mjs

`NutScreenController.mjs` 是 executor 的 nut.js 后端**参考实现**,实现
`packages/desktop/src/process/executor/types.ts` 的 `ScreenController` 接口
(截屏/键鼠/滚动 + 按键映射)。加载冒烟已过,**真实输入/截屏行为需 Windows 验证**。
Executor 核心(协议+调度+校验)已在 `tests/unit/executor/` headless 单测;只剩这层 OS 绑定要真机验。
graduating 时:加 `@nut-tree-fork/nut-js` 到 packages/desktop 依赖 → 移植本文件为 TS 入 src →
`new Executor(new NutScreenController())`。

## 与设计文档的关系

对应 PRD 功能点 **F-CU-01**,见 [`docs/prds/local-computer-use/design.md`](../../docs/prds/local-computer-use/design.md) §5 阶段表 P0。
