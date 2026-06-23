// Phase 0 Spike — Computer Use 可行性验证(独立脚本,不依赖主仓)
//
// 目的:在目标 OS 上证明三件事能跑通 —— 截屏 / 鼠标移动+点击 / 键盘输入。
// 首发目标:Windows(键鼠/截屏免授权)。Linux/macOS 仅作冒烟参考。
//
// 运行:
//   cd experiments/local-computer-use-spike
//   npm install            # 安装 @nut-tree-fork/nut-js + sharp
//   node spike.mjs         # 5 秒后开始,产出 screenshot.png 并演示键鼠
//
// ⚠️ 注意:
//   - 脚本会真实移动鼠标/敲键盘。请把焦点放在一个空文本框(如记事本)再运行。
//   - macOS 首次运行会要求「辅助功能」+「屏幕录制」授权。
//   - Linux/Wayland 注入默认被禁(预期失败),X11 正常。
//   - 真正的 Windows 验证必须在 Windows 机器上跑,Linux 上只是验证代码本身能加载/调用。

import { mouse, keyboard, screen, Point, Button, Key } from '@nut-tree-fork/nut-js';

const log = (...a) => console.log('[spike]', ...a);
const ok = (m) => console.log('  \x1b[32m✓\x1b[0m', m);
const fail = (m, e) => console.log('  \x1b[31m✗\x1b[0m', m, '—', e?.message ?? e);

async function main() {
  log(`平台: ${process.platform} | node ${process.version}`);
  log('5 秒后开始 —— 请把焦点切到一个空文本框(记事本/搜索框)...');
  await sleep(5000);

  // 1) 截屏
  let shotSize = null;
  try {
    const w = await screen.width();
    const h = await screen.height();
    shotSize = { w, h };
    await screen.captureRegion(
      'screenshot',
      { left: 0, top: 0, width: w, height: h, area: () => w * h },
      undefined,
      process.cwd()
    ).catch(async () => {
      // 退回到整屏抓取 API(不同版本命名不一)
      await screen.capture('screenshot', undefined, process.cwd());
    });
    ok(`截屏成功 (${w}x${h}) → 已写出 screenshot.*`);
  } catch (e) {
    fail('截屏失败', e);
  }

  // 2) 鼠标:移动 + 取坐标 + 点击
  try {
    const target = shotSize
      ? new Point(Math.floor(shotSize.w / 2), Math.floor(shotSize.h / 2))
      : new Point(400, 400);
    await mouse.move([target]);
    const pos = await mouse.getPosition();
    ok(`鼠标移动到 (${pos.x}, ${pos.y})`);
    await mouse.click(Button.LEFT);
    ok('左键点击成功');
  } catch (e) {
    fail('鼠标控制失败', e);
  }

  // 3) 键盘:输入文本 + 组合键
  try {
    await keyboard.type('CentaurAI computer-use spike ok');
    ok('键盘输入成功(应出现在你聚焦的文本框)');
    await keyboard.type(Key.LeftControl, Key.A); // 全选,验证组合键
    ok('组合键 Ctrl+A 成功');
  } catch (e) {
    fail('键盘控制失败', e);
  }

  log('完成。判定:三项均 ✓ 即该 OS 可作为 executor 宿主;任一 ✗ 看上面错误与授权说明。');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
main().catch((e) => { console.error(e); process.exit(1); });
