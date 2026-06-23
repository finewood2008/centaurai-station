# CentaurAI computer-use MCP(实验性,**单机可真用**)

一个 stdio MCP 服务器,让 AI 智能体**真实地看到并操作它所运行的这台电脑**:真截屏、真鼠标、真键盘。

> **单机原理**:把它和 CentaurAI(或 Claude Code)跑在**同一台机器**上,模型操作的就是**这台机器**——
> 单机场景不需要"服务器→远端客户端"的反向通道(那条 LAN 路径还在开发中)。

> ⚠️ **安全**:这些工具会真的移动你的鼠标、打字、点击。第一次试请**先把焦点放在一个可丢弃的窗口**
> (如记事本),关掉 CentaurAI / 这个 MCP 即可立即收回控制权。

## 工具
`get_screen`(截屏)、`cursor_position`、`mouse_move`、`left_click`/`right_click`/`middle_click`、
`double_click`、`left_click_drag`、`type_text`、`key`(如 `ctrl+c`)、`scroll`。

---

## 在 Windows 上试用

### 1. 装 Node.js
装 Node.js LTS(≥18):https://nodejs.org 。装完在 PowerShell 验证:`node -v`。

### 2. 拿代码(GitHub)
这是你的私仓 `finewood2008/centaurai-station`,分支 `exp/local-computer-use-client`。两种方式任选:

- **git clone**(推荐):
  ```powershell
  git clone -b exp/local-computer-use-client https://github.com/finewood2008/centaurai-station.git
  cd centaurai-station\experiments\computer-use-mcp
  ```
- **或下载 ZIP**:GitHub 页面 → 切到 `exp/local-computer-use-client` 分支 → Code → Download ZIP → 解压 → 进入 `experiments\computer-use-mcp`。

> 只需要这个子目录就能试 computer-use,**不必**编译整个 CentaurAI 桌面端。

### 3. 安装依赖
```powershell
npm install
```
会装 `@nut-tree-fork/nut-js`(Windows 有预编译二进制,通常无需额外构建工具)和 MCP SDK。

### 4. 接到 CentaurAI(或 Claude Code)
把服务器的**绝对路径**记下(如 `C:\Users\you\centaurai-station\experiments\computer-use-mcp\server.mjs`)。

**A. 接到 CentaurAI 桌面端**:设置 → MCP → 新增 **stdio** 服务器:
- command:`node`
- args:`["C:\\Users\\you\\centaurai-station\\experiments\\computer-use-mcp\\server.mjs"]`

**B. 或接到 Claude Code CLI**:
```powershell
claude mcp add computeruse -- node "C:\Users\you\centaurai-station\experiments\computer-use-mcp\server.mjs"
```

### 5. 试一把
开一个 **Claude** 后端的会话(gating 已确认 Claude 能看到 MCP 返回的图),先把**记事本**打开并聚焦,然后对智能体说:

- 「先截个屏,告诉我屏幕上有什么。」→ 它调用 `get_screen`,应能描述你的真实桌面。
- 「在记事本里打 `hello from CentaurAI`。」→ 它调用 `type_text`。
- 「把鼠标移到屏幕中央并点一下。」→ `mouse_move` + `left_click`。

## Windows 注意
- 键鼠注入用 `SendInput`,**普通程序无需额外授权**(不像 macOS 要开辅助功能)。
- 控制**以管理员权限运行的窗口**需本程序也提权;UAC 弹窗无法操作。
- 若系统显示缩放 ≠ 100%,坐标可能与截图像素有偏差(已知项,后续做 DPI 换算)。

## 这是什么、不是什么
- ✅ **是**:单机上"AI 真能看/控这台 Windows"的可用版本,基于已单测的 executor 协议 + nut.js 后端。
- ❌ **不是**:还没有"把 computer-use 打进 CentaurAI 安装包"的一键版;也还不是"局域网里服务器遥控另一台远端 Windows 客户端"(那条 LAN 反向通道在 AionCore 侧开发中)。
