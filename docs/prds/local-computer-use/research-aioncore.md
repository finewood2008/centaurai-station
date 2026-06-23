# 调研：aioncore 工具注册与拦截扩展点(决策级)

> 方法:6 路并行深读 aioncore Rust 源(`/home/user/桌面/_仓库/AionCore/crates/*`)+ TS 客户端协议,
> 再对最承重假设逐条回源码**对抗式证伪**。20 agents,12 条假设:8 确认 / 1 推翻 / 3 部分。
> 对应 PRD 功能点 F-CU-03/04/05。

## 结论 (TL;DR)

**可行,但必须重新编译 aioncore(recompile = YES)。** 没有"零编译"路径能满足真实目标(executor 在**远端用户客户端**)。

唯一能让模型"看到"截图并把操作下发到终端用户机器的缝是 **S3:内置 stdio computer-use MCP shim
+ aioncore 自托管 loopback `/tool` 桥**(完整复刻已有的 team/guide 模板),借用 permission 回环的
oneshot/pending-map 关联机制,以及 `show-open` 的单播到客户端先例。

所有"零编译"幻想已被验证否决:
- 外部 HTTP/SSE MCP 被 stdio-only 能力过滤(`session_injection.rs` Default `http:false,sse:false`;`factory/acp.rs:121-128`)
- 外部 stdio MCP 由 CLI 在**服务器主机**上 spawn,拿不到 per-session 客户端路由
- ACP permission 回环只回 `option_id` 且终结于服务器

三处 load-bearing 缺口必须新写 Rust:① `ClientInfo` 加 session/user 身份 + session→conn 索引;
② 用真实 `MessageRouter` 替换两处 `NoopMessageRouter`;③ loopback `/tool` 桥 + 关联等待。
外加一个 Windows-first 的 Electron 客户端 executor。

~~**最大残余风险在 aioncore 之外**:Claude Code CLI 是否把 MCP image 结果当 image block 喂给模型~~ → **✅ 已实测通过(Claude 后端,2026-06-23)**,见 §下一步 步骤 0。S3 命门解除。Codex/Gemini 后端待同法验证。

## 扩展缝排名

| # | 缝 | 复用 | 必须新建 | 重编译? | 验证后裁决 |
|---|---|---|---|---|---|
| S1 | 外部用户配置 MCP server(`acp_assembler.rs:114 servers.extend(user_mcp_servers)`) | 全套 MCP 配置 UI+DB+注入 | 一个自带客户端注册表并转发的独立进程 | No | **打折**:仅单主机/loopback 可用;HTTP/SSE 被能力过滤,stdio 在服务器主机 spawn 无 per-session 客户端路由。`available_no_recompile` 对我们目标是**误导** |
| S2 | ACP `ext_request`/`ext_notify`(`acp.rs:267/281`) | 通用 ACP 扩展通道 | 暴露 computer-use 方法的 CLI 后端 | No | **否决**:aioncore→agent 方向,非模型可调工具,服务器本地终结 |
| **S3** | **内置 stdio MCP shim → loopback `/tool` 桥到 owning client**(复刻 `acp_assembler.rs:157` + `guide/server.rs:33`) | 整套 team/guide 模板:stdio 注入、loopback HTTP、env 传 session 身份、stdio-only 能力路径 | `mcp-computeruse-stdio` 子命令 + `/tool`→client 桥(session↔conn 索引 + send_to + pending-oneshot + 真实 MessageRouter + 客户端 executor) | **Yes** | **推荐**:唯一原生定位 per-session 客户端、不泄漏、把截图作为真实 tool result 返回 |
| S4 | 克隆 permission 回环为 executor RPC(`permission_router.rs:18 PendingPermission` oneshot) | dispatch/await/resolve 骨架:oneshot + pending map + 归属校验 HTTP 回复 | 新事件变体、带 payload 的结果类型、新 results 端点、喂回模型途径 | Yes | **仅作模式用**:验证证实只回 `option_id`、终结服务器、非模型可见 tool result。借其关联模式 |
| S5 | 全新协议级 reverse-RPC(新 crate) | 几乎只有 `send_to` | S3 全部 + 通用 RPC 层 | Yes(最多) | 过度工程,v1 不取 |

## 推荐路径 (v1) = S3

executor 嵌入 Windows Electron 客户端(浏览器沙箱无法做 OS 输入/截图)。精确集成点:

**注入工具(模型可调):**
- `aionui-ai-agent/src/factory/acp_assembler.rs:98-116 resolve_mcp_servers` — 加 `servers.push(computer_use_mcp_server(...))`
- `acp_assembler.rs:157-169 guide_mcp_server` — **复刻**;复用 env 身份 `:166-168`(`AION_MCP_CONVERSATION_ID`/`AION_MCP_USER_ID`)
- `acp_assembler.rs:42-49 new_session_request → req.mcp_servers(...)` — 确认注入达 `session/new`

**loopback `/tool` 桥(复刻 team/guide):**
- `aionui-team/src/guide/server.rs:33 TcpListener::bind("127.0.0.1:0")` + `:49 .route("/tool", post(...))` — executor host 模板。`/tool` handler **不本地执行**:从 session 解析 `conn_id` → `send_to` → pending map 停 oneshot(请求 id 为键)→ await → 把截图作为 MCP **image content block** 返回
- 新 `mcp-computeruse-stdio` 子命令,平行于 team stdio shim(参 `cmd_team_stdio.rs`)

**缺口 1 — 连接↔会话身份(安全必修,非便利):**
- `aionui-realtime/src/types.rs:140-147 struct ClientInfo { token, last_ping, tx }` — 加 user_id/session 绑定(从 token JWT 解)
- `aionui-realtime/src/manager.rs:37-47 add_client` — 穿入身份;加 `session→ConnectionId` 索引 DashMap
- `aionui-realtime/src/manager.rs:107 send_to` — 复用单播原语(`show-open` 已用)

**缺口 2 — 入站结果路由:**
- `aionui-app/src/router/state.rs:754` 和 `:767 router: Arc::new(NoopMessageRouter)` — **两处生产路径都替换**
- `aionui-realtime/src/router.rs:8-14 fn route(conn_id, name, data) -> bool` — 当前唯一实现 NoopMessageRouter 丢弃返回 false;`route` 签名只返回 bool、fire-and-forget,**无回传通道,关联机制需新建**
- `aionui-realtime/src/handler.rs:200-204` 入站业务消息派发点

**缺口 3 — await/correlate(复刻 S4):**
- `aionui-ai-agent/src/manager/acp/permission_router.rs:18-21 PendingPermission { responder: oneshot::Sender<...> }` + pending map — 复刻为 `pending_computer_use`

**客户端 executor(TS,Windows-first):**
- `handler.rs:217-252 handle_subscribe_show_open → send_to(conn_id, "show-open-request")` — 最接近的先例,但 show-open 是**客户端发起**、结果只在前端本地 Promise resolve(`browser.ts:254-256`),**不回服务器**;executor 必须**新建客户端→服务器 WS 回传**
- `packages/desktop/src/` — 监听 `computerUse.invoke` 跑截图/键鼠,发 `computerUse.result`

### 映射到计划阶段
- **P2(server-side Rust)** = 缺口 1+2+3 + `computer_use_mcp_server()` + `/tool` 桥 + `mcp-computeruse-stdio`。重编译核心,可独立合入并用单主机 loopback 自测
- **P3(client executor + 端到端)** = TS Electron executor + `computerUse.result` 回传 + 关键的 Claude Code image-block 实测

## 被推翻/打折的假设

1. **「外部 MCP 零编译即可」— 打折/对本目标否决**。HTTP/SSE 被 stdio-only 能力过滤,外部 stdio 在服务器主机 spawn 无客户端路由。对 Windows-first/executor-在远端,`needs_aioncore_change` 才正确
2. **「ACP/permission 回环白送 reverse channel」— 否决为交付路径**。只回 `option_id`、终结服务器(`permission_router.rs:125-140`;`acp.rs:66-71` PermissionDecision 无 payload)。仅借关联模式
3. **「image content block 是一等公民」— 被 REFUTED(最重要降级)**。aioncore **模型输入路径根本不带 image**:ACP 出站 prompt 是纯文本 String(`agent_session_flow.rs:256-261`);aionrs 原生后端 `ContentBlock` 无 Image 变体,MCP image 被字符串化为 `[image: image/png]` 占位符(`aion-mcp/src/manager.rs:279-280`)。**但关键限定**:S3 的 image 是由**外部 ACP CLI 自己**作为 MCP client 调 `tools/call` 拿到、在子进程内喂给它自己的模型——**完全绕过 aioncore Rust**(aioncore 从不调外部 MCP `tools/call`,仅 initialize+tools/list 连通测试)。所以 S3 仍成立,但**"模型能看到截图"完全取决于 CLI 后端行为,必须实测**——单一最大残余风险,且在 aioncore 代码之外
4. **「无 in-process tool loop / 无 Tool trait」— PARTIALLY TRUE**。aioncore 有第二后端 **Aionrs**,确有 in-process tool loop + 真实 `ToolRegistry`/`Tool` trait(`factory/aionrs.rs:195-196`;aion-tools `registry.register(Box<dyn Tool>)`)。对 Aionrs 后端,computer-use 可经 `registry.register()` 以 in-process Rust Tool 注册。但 ACP CLI 后端(Claude/Codex/Gemini)模型 loop 在子进程,MCP 注入仍是唯一缝。**v1 选 S3/MCP**(覆盖主力 ACP 后端);Aionrs in-process Tool 作后续可选第二实现
5. **「show-open 是现成回环」— PARTIALLY TRUE/打折**。`send_to` 单播真实,但 show-open 客户端发起、结果只前端本地 resolve、不回服务器;入站 router 是 noop。**回传腿不存在**,S3 必须新建客户端→服务器结果通道 + 关联
6. **广播泄漏 — 升级为安全要求**。当前 agent 路径 broadcast-only(`routes.rs:59 broadcast_all`;ClientInfo 无 session 身份)。复用广播+自过滤会把 computer-use 请求泄漏给每个连接客户端,**任意客户端可代他人机器执行**。缺口 1 是安全必修,绝不可 broadcast

## 剩余未知 + 下一步

**步骤 0(gating)— ✅ 已完成且通过(2026-06-23,Claude 后端)。** 件:`experiments/computer-use-gating-mcp/`。
方法:`claude -p ... --mcp-config ... --allowedTools mcp__gating__get_test_image`(headless,等价于 aioncore spawn Claude 后端注入 MCP)。
结果:模型答出暗号 **CU-GATE-9F3K7** + 背景 teal + 圆 yellow,并主动指出"圆在右上角"(此方位信息不在任何文字里,只能从像素读出)→ **Claude Code CLI 确实把 MCP image content block 当真图喂给模型**。S3 命门解除,可投入 P2 Rust 改造。
- **Codex 后端**:未实证。codex 0.140 默认开启 guardian 审批分类器,headless 下自动取消 MCP 工具调用,且无窄授权开关(唯一绕法是全量 bypass,不取)。但 codex 二进制内含显式 MCP image 转发代码("forward an MCP tool image … ImageContent block from result.content"),**大概率支持**,需人工交互批准跑一次实证(且其配的是自定义 gpt-5.5 代理,视觉能力另说)。
- **Gemini 后端**:本机未安装,跳过。

**P2 最小骨架 — ✅ 已实装 + 编译 + 单测 + 端到端验证(2026-06-23)。** 分支 `exp/computer-use-mcp-skeleton`(AionCore 仓)。
- 新增:`crates/aionui-app/src/commands/cmd_computeruse_stdio.rs`(rmcp self-contained stdio server,`get_screen` 工具返回内嵌测试图,仿 cmd_team_guide);子命令 `mcp-computeruse-stdio` 注册(cli.rs/mod.rs/main.rs);注入 `computer_use_mcp_server()` + `resolve_mcp_servers` 按 `AION_COMPUTERUSE_EXPERIMENT` 开关注入(acp_assembler.rs);base64 移入 `[dependencies]`;测试图 `assets/computeruse-test-image.png`。
- 验证:`cargo check` 绿;新模块 3 单测 + acp_assembler 12 注入测试全过;**端到端**用 `claude` 驱动编译出的 `aioncore mcp-computeruse-stdio`(`experiments/computer-use-gating-mcp/aioncore-mcp-config.json`),模型经此 aioncore 子命令读出 CU-GATE-9F3K7/teal/右上角黄圆 → 子命令作为真 MCP server + 图喂模型 **全链路打通**。
- 本骨架范围:`get_screen` 直接返回固定图,证明 **aioncore 自身注入链路**(resolve_mcp_servers→session/new→CLI spawn→模型调用→看到图)。
- 仅自动化未覆盖:**实跑中的注入**(aioncore server 运行 + 经 CentaurAI 开 Claude 会话且置 `AION_COMPUTERUSE_EXPERIMENT=1`)——留作手动自测。

**P2 增量 ① loopback `/tool` 桥(subcommand 侧)— ✅ 已实装 + 单测 + 端到端(2026-06-23)。**
- `get_screen` 改为**双模式**:无 `AION_COMPUTERUSE_PORT`=直返 demo 图(保留自测);设了 port=转发到 `http://127.0.0.1:{port}/tool`(仿 `cmd_team_guide::forward_tool`,Bearer token,错误不泄漏 body)。定义了 `/tool` JSON 契约(req `{tool,conversation_id,user_id}` → resp `{image,mime_type,text}` / `{error}`)。
- 验证:8 单测(含 wiremock 转发/错误/连接失败用例)全过;**端到端** mock `/tool` 服务器(`experiments/computer-use-gating-mcp/mock-tool-bridge.mjs`)+ `aioncore-bridge-mcp-config.json` + claude → 图经 subcommand→loopback HTTP→模型,Claude 读出暗号全链路通。
- **证明的关键**:图能经一个 HTTP hop(JSON round-trip)回传后仍作为 image block 被模型看到——这是客户端路由的前置(真流程=subcommand→aioncore `/tool`→client→回)。
- **仍未做**(增量 ②):aioncore 进程侧的 `/tool` handler 本身(把 mock 换成真的)——它要单播到 owning client + await,即缺口 1/2/3。需起全 app + 客户端,会和脏树纠缠,留作下一步。

**P2 顺序(server-side Rust)** — 第 4 项骨架(子命令+注入+直返图)✅ 已完成,余下为 loopback 桥 + 客户端路由:
1. `ClientInfo` 加 user_id/session + `session→ConnectionId` 索引,从 JWT 解身份(安全必修)
2. 真实 `MessageRouter` 替换两处 `NoopMessageRouter`;`computerUse.result` 入站 handler 解析 pending oneshot
3. 复刻 `pending_computer_use` oneshot+map
4. ~~`computer_use_mcp_server()` + `mcp-computeruse-stdio`~~ ✅ 已完成(直返固定图);**下一增量**:把 `get_screen` 直返改为转发到 loopback `/tool`(复刻 `cmd_team_guide::forward_tool`),`/tool` handler 单播到 owning client + await,返回客户端真实截图

**P3:** Windows Electron executor + `computerUse.result` WS 回传;端到端实测(含步骤 0 验证)

**安全前置(与既有 memory 一致):** LAN 远程未鉴权敞口(`--local` 关 JWT/CSRF、反代零鉴权、`/api/shell` 任意命令执行)在引入 computer-use 前**必先堵**,否则 reverse channel 成放大器。
