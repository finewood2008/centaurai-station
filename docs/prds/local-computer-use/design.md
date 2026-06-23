# 设计：本地客户端 Computer Use

## 1. 架构:一条反向通道

现状(单向):客户端是瘦 UI,agent 循环在服务器 aioncore;工具调用后端执行完,经 WS 推回客户端**仅显示**(`normalizeToolCall.ts` 只重组不执行)。

Computer use 要操作**用户本机**,执行点必须在客户端。新增数据流:

```
aioncore(服务器) agent 循环
   │  computer-use 动作(screenshot/click/type/...)
   ▼  按 user/session 路由到「发起会话的那台客户端」连接
┌──────────────────────────────────────────────┐
│ 本地客户端(Electron, client mode)            │
│   executor 模块:动作 → 调用本机 OS            │
│   截屏 / 键鼠注入 / DPI·坐标换算 / 作用域校验  │
└──────────────────────────────────────────────┘
   ▲  截图(base64) + 执行结果
   └── 经现有 WS,沿用 { name, data } 协议回传 aioncore → agent 下一轮
```

这条「服务器 → 指定客户端 → 执行 → 回传」是**唯一硬骨头**,其余复用现成件。

> **⚠️ 已被 aioncore 源码调研落实(见 [research-aioncore.md](research-aioncore.md))**:上面这条反向通道**不能**简单地"在 httpBridge 上加 `executor.invoke`/`executor.result`"就完事。真实可行的缝是 **S3 = 内置 stdio computer-use MCP shim + aioncore loopback `/tool` 桥**,而且**必须重新编译 aioncore(Rust)**。原因:① 主力后端(Claude/Codex/Gemini)的模型 loop 在 ACP CLI 子进程里,模型能调用的工具**只能经 MCP 注入**;② 截图要让模型"看到",得作为 **MCP image tool result** 由 CLI 自己取回(aioncore 自身的模型输入路径根本不带 image);③ 把动作定向到"发起会话那台客户端"需要新写 session→connection 索引(当前是 broadcast,直接复用会把动作泄漏给所有客户端=安全漏洞)。详见研究文档的"扩展缝排名"与"被推翻假设"。

### 复用 vs 新建

| 复用(已存在) | 路径 |
| -------------- | ---- |
| mDNS 发现 / 广播 | `packages/desktop/src/process/discovery/lanDiscovery.ts` |
| 客户端模式入口(env/flag/marker) | `packages/desktop/src/index.ts` 183–253 |
| WS 传输 + `{name,data}` RPC | `packages/desktop/src/common/adapter/httpBridge.ts` |
| 连接/重连(WebUI/客户端) | `packages/desktop/src/common/adapter/browser.ts` |
| HTTP/WS 反代 | `packages/web-host/src/static-server.ts` |
| 独立打包(已砍 aioncore) | `packages/desktop/electron-builder.client.yml` |
| 鉴权门(LAN) | `packages/web-host/src/webui-auth-gate.ts` |

| 新建 | 落点 |
| ---- | ---- |
| Executor 模块 | `packages/desktop/src/process/executor/`(主进程,遵循 `.claude/skills/architecture`) |
| 反向通道消息对 | 扩展 httpBridge:`executor.invoke` / `executor.result` |
| aioncore 动作路由 + 工具拦截 | aioncore 后端(需确认扩展点) |
| 安全护栏 + 同意 UI | `src/renderer` + 主进程热键/审计 |
| 各 OS 授权引导页 | `src/renderer/pages/...` |

## 2. 动作协议(Executor)

对齐 Anthropic computer-use 动作集,最小集合:

```
screenshot                      → { image: base64-png, width, height }
mouse_move   { x, y }
left_click   { x, y } | right_click | middle_click | double_click
left_click_drag { from:{x,y}, to:{x,y} }
type         { text }
key          { combo: "ctrl+c" }
scroll       { x, y, dir, amount }
cursor_position                 → { x, y }
```

实现库:**nut.js**(`@nut-tree-fork/nut-js`,Node,契合 Electron 栈)。坐标空间必须显式换算:截图分辨率 ↔ 真实显示器 ↔ DPI 缩放 ↔ 多屏拼接,否则点歪。

## 3. 各 OS 授权现实

| 系统 | 键鼠注入 | 截屏 | 坑 |
| ---- | -------- | ---- | --- |
| **Windows(v1 首发)** | `SendInput` 基本免授权 | 免授权 | 控制提权窗口需自身提权;UAC 弹窗碰不到 |
| macOS | 需手动开「辅助功能」 | 需手动开「屏幕录制」 | TCC 逐 App 授权、无法静默绕过,必须首次引导 |
| Linux / X11 | XTEST,易 | 易 | 老桌面无碍 |
| Linux / Wayland | **默认禁注入** | 需 portal | 走 `ydotool`(uinput)或 `libei`/RemoteDesktop portal,工程量最大 |

## 4. 安全护栏(不可省)

本质是给产品内置「远程控制每台员工机」的能力 = 受控 RAT。上线前必须:

- **本机 arm 开关**:本地用户主动开启「允许被托管」,默认关
- **常驻可见指示**:正在被控制的悬浮标识
- **一键急停热键**:立即断开 + 撤销授权
- **作用域**:允许的 App/窗口黑白名单
- **全量审计日志**:每个动作可追溯(谁/何会话/何动作/何时)
- **逐会话用户同意**,非默认全开
- **堵 `/ws` 敞口**:当前 WebSocket 升级**未过** auth gate(见 `static-server.ts`),叠加 computer-use 会把后门做成功能,P4 必须连带修复

## 5. 分阶段计划

| 阶段 | 目标 | 产出 | 备注 |
| ---- | ---- | ---- | ---- |
| **P0 Spike** | 证明 Windows 截屏+键鼠可跑通 | 独立 nut.js 验证脚本 | 不碰主仓;Linux 仅冒烟,真验证需 Windows 机 |
| **P0.5 Gating** | 证明 CLI 把 MCP image result 当 image block 喂模型 | `experiments/computer-use-gating-mcp/` | ✅ **PASS(Claude 后端,2026-06-23)**,S3 命门解除;Codex/Gemini 待同法测 |
| **P1 Executor** | 本机执行动作(不接模型) | `src/process/executor/`(core ✅)+ spike/NutScreenController.mjs(参考后端) | ✅ core(协议+Executor 调度/校验+13单测,OS 经 ScreenController 接口依赖注入,headless 可测);nut.js 后端=参考实现待 Windows 验证 |
| **P2 反向通道(Rust,需重编译)** | 服务器发指令、本机真的动了 | aioncore:session→conn 索引 + 真实 MessageRouter + `pending_computer_use` + `mcp-computeruse-stdio` 子命令 + loopback `/tool` 桥 | S3 核心,见 research-aioncore.md 精确集成点;可单主机 loopback 自测 |
| **P3 模型接入 + 端到端** | agent 发出 computer-use 工具并经客户端执行 | TS Electron executor + `computerUse.result` WS 回传 | ⚠️ 依赖 P0.5;主力后端经 MCP 注入(已确认),Aionrs 后端可选 in-process Tool |
| **P4 安全** | 护栏 + 同意 UI + 堵 WS 敞口 | arm/指示/急停/审计/作用域 + session 定向(非 broadcast) | 放开给真实用户前必完成;broadcast 泄漏=安全必修 |
| **P5 打包** | 客户端发布 + 授权引导 | 接 `electron-builder.client.yml` + 引导页 | macOS TCC / Linux Wayland 引导 |

## 6. 开放问题 / 依赖

> 1、2 已由 [research-aioncore.md](research-aioncore.md) 调研定论,保留于此并标注结论。

1. ~~**aioncore 工具扩展点**~~ — **已定论**:经 MCP 注入(S3),需重编译 aioncore;精确集成点见研究文档。
2. ~~**computer-use 工具支持**~~ — **已定论**:不依赖 Anthropic computer-use beta,改为自定义 MCP 工具,由 ACP CLI 子进程的模型调用。
3. **(新增最大未知)CLI image-block 行为**:Claude Code/Codex/Gemini CLI 是否把 MCP image tool result 作为 image block 喂给模型?在 aioncore 之外,只能端到端实测(P0.5 gating)。
4. **多客户端路由键**:用 user_id 还是 session_id 绑定执行目标?一个用户多设备如何选?(P2 缺口 1 落地时定)
5. **截图带宽**:computer-use 截图密集,LAN 内 base64 是否需压缩/降分辨率/增量。
