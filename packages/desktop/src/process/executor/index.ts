/**
 * Computer-use executor module (EXPERIMENTAL).
 *
 * Public surface: the {@link Executor} and its protocol types. The real nut.js
 * {@link ScreenController} backend is added when the feature graduates from
 * experimental (it pulls a native dependency); until then the spike at
 * experiments/local-computer-use-spike/ holds the reference implementation.
 */

export { Executor, parseKeyCombo } from './Executor';
export type {
  CapturedImage,
  ExecutorAction,
  ExecutorErrorCode,
  ExecutorResult,
  MouseButton,
  Point,
  ScreenController,
  ScreenSize,
  ScrollDirection,
} from './types';
export { ExecutorError } from './types';
