# PRD：本地客户端 Computer Use（实验性）

> 状态：**实验性 / 下个版本预研**。本目录是产品设计 + 开发计划,尚未进入正式排期。
> 一句话：让每台装了 CentaurAI 本地客户端的电脑,获得 AI 直接操作本机桌面(截屏 / 键鼠 / GUI 自动化)的能力。

## 文档

| 文件 | 说明 |
| ---- | ---- |
| [design.md](design.md) | 架构设计、反向通道、各 OS 授权、安全护栏、分阶段计划 |
| [research-aioncore.md](research-aioncore.md) | **aioncore 扩展点调研(决策级)**:扩展缝排名、推荐路径 S3、精确集成点、被推翻假设 |
| [spike/](../../../experiments/local-computer-use-spike/) | Phase 0 技术验证脚本(nut.js 截屏+键鼠) |
| [gating-mcp/](../../../experiments/computer-use-gating-mcp/) | **P0.5 gating MCP server**(返回带暗号 PNG;实测 CLI 是否把 image 喂给模型);SDK 冒烟已过 |

## 调研结论(2026-06-23,见 research-aioncore.md)

可行,但**必须重编译 aioncore**。推荐路径 **S3 = 内置 stdio computer-use MCP shim + aioncore loopback `/tool` 桥**。
所有"零编译"路径已被对抗式验证否决。**单一最大未知**(CLI 是否把 MCP image 当真图喂模型)已于 2026-06-23
**实测通过(Claude 后端)** —— S3 命门解除,可投入 P2 Rust 改造。Codex/Gemini 后端待同法验证。

## 背景：为什么需要本地客户端

当前局域网形态下,用户经浏览器访问服务器上的 CentaurAI,agent 循环跑在服务器 aioncore 里。
凡是**作用于操作系统/桌面**的能力(computer use、截屏、键鼠、本机文件、外设),作用的都是
**服务器那台机器**,不是用户本机——浏览器只是远程显示层,无权碰运行它的 PC。

要让 AI 真正操作"用户自己这台电脑",执行点必须**搬回本机**。本地客户端(已具备 mDNS 发现 /
传输 / 客户端模式 / 独立打包)就是这个载体。

## 实验版 v1 范围(已拍板)

| 决策项 | 选择 |
| ------ | ---- |
| 首发 OS | **Windows 优先**(键鼠/截屏免授权最顺,且客户群以 Windows 为主) |
| executor 落点 | **内嵌现有 Electron 客户端**(复用客户端模式入口/传输/打包) |
| 后端 | 单后端先打通,模型接入(Claude computer-use 工具)放第二轮 |
| 触发 | 先手动触发闭环("服务器发指令 → 本机真的动了") |

## 功能点总览

| 编号 | 功能点 | 状态 | 阶段 |
| ---- | ------ | ---- | ---- |
| F-CU-00 | **gating 实测**:CLI 是否把 MCP image result 当 image block 喂模型 | ✅ PASS(Claude);Codex 大概率(待人工实证);Gemini 未装 | P0.5 |
| F-CU-03a | **P2 骨架**:`mcp-computeruse-stdio` 子命令 + 注入 + get_screen 直返图 | ✅ 实装+编译+单测+端到端验证(AionCore exp/computer-use-mcp-skeleton) | P2 |
| F-CU-03b | **P2 增量①**:get_screen 双模式 + loopback `/tool` 桥(subcommand 侧)+ 契约 | ✅ 8 单测(含 wiremock)+ 端到端(mock /tool + claude)验证 | P2 |
| F-CU-03c | **P2 增量②**:aioncore 进程侧 `/tool` handler(路由到 owning client) | 待做(=缺口1/2/3,需起全 app) | P2 |
| F-CU-01 | nut.js 截屏 + 键鼠注入可行性验证(Windows) | spike 已写,待 Windows 真测 | P0 |
| F-CU-02 | Executor 模块:动作协议 + 调度/校验(core)| ✅ core 实装+13单测+tsc+lint 绿(packages/desktop/src/process/executor) | P1 |
| F-CU-02b | 本机执行后端(nut.js ScreenController)| 参考实现已写(spike/NutScreenController.mjs,加载冒烟过);待 Windows 真机验证 + 加依赖移植入 src | P1 |
| F-CU-03 | 反向通道:S3 stdio MCP shim + loopback `/tool` 桥 + 客户端 executor | 待做(已定路径) | P2/P3 |
| F-CU-04 | aioncore session→conn 索引 + 真实 MessageRouter(替换 NoopMessageRouter) | 待做(**安全必修**,非便利) | P2 |
| F-CU-05 | 模型接入:经 MCP 注入 computer-use 工具,CLI 子进程模型调用 | 待做(已定路径) | P3 |
| F-CU-06 | 安全护栏:本机 arm 开关 + 常驻指示 + 急停热键 + 作用域 + 审计 | 待做 | P4 |
| F-CU-07 | `/ws` 升级走鉴权门(堵当前 WS 未过 auth gate 的敞口) | 待做 | P4 |
| F-CU-08 | 打包 + 各 OS 首次授权引导 | 待做 | P5 |
