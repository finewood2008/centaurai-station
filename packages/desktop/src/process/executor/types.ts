/**
 * Computer-use executor protocol (EXPERIMENTAL).
 *
 * Action set aligned with Anthropic's computer-use tool, executed against the
 * LOCAL machine (the client that owns the session). The OS-interaction
 * primitives are abstracted behind {@link ScreenController} so the
 * {@link Executor} dispatch/validation logic is unit-testable without a real
 * display; the real backend (nut.js) implements the same interface.
 *
 * See docs/prds/local-computer-use/design.md.
 */

export type MouseButton = 'left' | 'right' | 'middle';

export type Point = { x: number; y: number };

export type ScreenSize = { width: number; height: number };

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

/** A captured screen image (base64-encoded, with pixel dimensions). */
export type CapturedImage = {
  /** Base64-encoded image bytes (no data: prefix). */
  data: string;
  /** e.g. "image/png". */
  mimeType: string;
  width: number;
  height: number;
};

/**
 * Discriminated union of executor actions.
 *
 * Coordinates are in logical screen pixels matching {@link ScreenController.screenSize};
 * the real backend is responsible for DPI / multi-monitor mapping.
 */
export type ExecutorAction =
  | { type: 'screenshot' }
  | { type: 'cursor_position' }
  | { type: 'mouse_move'; x: number; y: number }
  | { type: 'left_click'; x: number; y: number }
  | { type: 'right_click'; x: number; y: number }
  | { type: 'middle_click'; x: number; y: number }
  | { type: 'double_click'; x: number; y: number }
  | { type: 'left_click_drag'; from: Point; to: Point }
  | { type: 'type'; text: string }
  /** Key combo, e.g. "ctrl+c" or "enter". */
  | { type: 'key'; keys: string }
  | { type: 'scroll'; x: number; y: number; direction: ScrollDirection; amount: number };

export type ExecutorResult =
  | { kind: 'image'; image: CapturedImage }
  | { kind: 'position'; x: number; y: number }
  | { kind: 'ok' };

/**
 * OS-interaction primitives. Implemented by the real nut.js backend and by a
 * fake controller in tests. Keeping Executor dependent on this interface (not
 * nut.js directly) is what makes the dispatch logic testable headless.
 */
export type ScreenController = {
  screenSize(): Promise<ScreenSize>;
  capture(): Promise<CapturedImage>;
  cursorPosition(): Promise<Point>;
  moveMouse(x: number, y: number): Promise<void>;
  click(button: MouseButton, x: number, y: number): Promise<void>;
  doubleClick(x: number, y: number): Promise<void>;
  drag(from: Point, to: Point): Promise<void>;
  typeText(text: string): Promise<void>;
  /** Pre-parsed key combo, e.g. ['ctrl', 'c']. */
  pressKeys(keys: string[]): Promise<void>;
  scroll(x: number, y: number, direction: ScrollDirection, amount: number): Promise<void>;
};

export type ExecutorErrorCode =
  | 'invalid_action'
  | 'out_of_bounds'
  | 'empty_input'
  | 'controller_failure';

export class ExecutorError extends Error {
  readonly code: ExecutorErrorCode;

  constructor(code: ExecutorErrorCode, message: string) {
    super(message);
    this.name = 'ExecutorError';
    this.code = code;
  }
}
