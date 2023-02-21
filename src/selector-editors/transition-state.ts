import { createStore } from 'zustand/vanilla';

interface TransitionState {
  isTransitioning: boolean;
  pointScale: number;
  points: [number, number][];
  initialPoints: [number, number][];
  boundingBox: { x: number; y: number; width: number; height: number };
  activePoints: number[];
  origin: [OriginUnit, OriginUnit];
  delta: [number, number];
  snaps: [number, number, number, number][];
  snapThreshold: number;
  currentRotation: number;
  currentTranslation: { x: number; y: number };
  currentSkew: { x: number; y: number };
  currentScale: { x: number; y: number };
  visibleSnaps: [number, number, number, number][];
  visibleSnapDistances: number[];
  initialTouches: [number, number][];
  initialTouchAngle: number;
  initialTouchDistance: number;
  initialScale: number;
}

type OriginUnit = number & { __unit__: 'origin' };

function asOrigin(origin: [number, number]): [OriginUnit, OriginUnit] {
  return origin as [OriginUnit, OriginUnit];
}

function fromOrigin(origin: [OriginUnit, OriginUnit], scale: number): [number, number] {
  // Pixel scale = 0.9
  // 100px real = 90px point scale
  return [origin[0] * scale, origin[1] * scale];
}
function toOrigin(origin: [number, number], scale: number): [OriginUnit, OriginUnit] {
  // Pixel scale = 0.9
  // 90px point scale = 100px real
  return asOrigin([origin[0] / scale, origin[1] / scale]);
}

function rotatePoint([cx, cy]: [number, number], [x, y]: [number, number], angle: number) {
  const radians = (Math.PI / 180) * angle;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const nx = cos * (x - cx) + sin * (y - cy) + cx;
  const ny = cos * (y - cy) - sin * (x - cx) + cy;
  return [nx, ny];
}

interface TransitionStateActions {
  startTransition(options: TransitionOptions): void;
  cancelTransition(): void;
  setPointScale(scale: number): void;
  finishTransition(): TransitionResult | undefined;
  transform(newOrigin: [number, number], options: TransformOptions): void;
  translate(newOrigin: [number, number], options: InteractionOptions): void;
  scale(newOrigin: [number, number], options: ScaleOptions): void;
  rotate(newOrigin: [number, number], options: RotateOptions): void;
  scaleAndRotate(touches: [number, number][], options: ScaleRotateOptions): void;
  apply(nextState: Partial<TransitionState>): void;
}

const initialState: TransitionState = {
  isTransitioning: false,
  pointScale: 1,
  points: [],
  initialPoints: [],
  activePoints: [],
  boundingBox: { x: 0, y: 0, width: 0, height: 0 },
  currentTranslation: { x: 0, y: 0 },
  currentSkew: { x: 0, y: 0 },
  currentScale: { x: 1, y: 1 },
  origin: asOrigin([0, 0]),
  delta: [0, 0],
  initialTouches: [],
  currentRotation: 0,
  initialTouchDistance: 0,
  snaps: [],
  snapThreshold: 0,
  visibleSnaps: [],
  visibleSnapDistances: [],
  initialTouchAngle: 0,
  initialScale: 1,
};

export const transitionState = () =>
  createStore<TransitionState & TransitionStateActions>()((setState, getState, store) => {
    const parseOrigin = (origin: [number, number]) => {
      const scale = getState().pointScale;
      return [origin[0] * scale, origin[1] * scale];
    };

    return {
      ...initialState,
      startTransition(options: TransitionOptions) {
        const state: Partial<TransitionState> = {
          points: options.points,
          initialPoints: options.points,
          activePoints: options.activePoints || [],
          pointScale: options.pointScale || 1,
          origin: options.origin ? asOrigin(options.origin) : asOrigin([0, 0]),
          initialScale: options.initialScale || 1,
        };

        if (state.activePoints && state.points) {
          const allX = state.activePoints.map((a) => state.points![a][0]);
          const allY = state.activePoints.map((a) => state.points![a][1]);
          const maxX = Math.max(...allX);
          const minX = Math.min(...allX);
          const maxY = Math.max(...allY);
          const minY = Math.min(...allY);
          state.boundingBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }

        // Multi-touch transitions.
        if (options.initialTouches?.length) {
          const [first, second] = options.initialTouches; // Ignore other touches.
          const dx = second[0] - first[0];
          const dy = second[1] - first[1];
          state.initialTouches = [first, second];
          state.initialTouchAngle = Math.atan2(dy, dx);
          state.initialTouchDistance = Math.sqrt(dx * dx + dy + dy);

          if (!options.origin) {
            // Center of the two initial touches.
            options.origin = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
          }
        }

        if (options.snaps?.length) {
          state.snaps = options.snaps;
          state.snapThreshold = options.snapThreshold;
        }

        setState(state);
      },
      cancelTransition() {
        setState(initialState);
      },
      setPointScale(scale: number) {
        setState({ pointScale: scale });
      },
      finishTransition(): TransitionResult | undefined {
        const state = getState();
        const result: TransitionResult = {
          points: state.points,
          activePoints: state.activePoints.map((idx) => state.points[idx]),
          // Changes (alternative to points)
          rotation: state.currentRotation,
          translation: { x: 0, y: 0 },
          skew: state.currentSkew,
          scale: state.currentScale,
          origin: state.origin as [number, number],
          originPoint: fromOrigin(state.origin, state.pointScale),
          // @todo add rotation to matrix.
          matrix: [
            state.currentScale.x,
            state.currentSkew.x,
            state.currentSkew.y,
            state.currentScale.y,
            state.currentTranslation.x,
            state.currentTranslation.y,
          ],
          apply(point) {
            // @todo apply transformations.
            return point;
          },
        };
        setState(initialState);
        return result;
      },
      transform(_newOrigin: [number, number], options: TransformOptions) {
        const state = getState();
        const newOrigin = fromOrigin(asOrigin(_newOrigin), state.pointScale);
        const origin = state.origin;
        const dx = newOrigin[0] - origin[0];
        const dy = newOrigin[1] - origin[1];
        const nextState: Partial<TransitionState> = {};

        // @todo real origin for transform will be opposite side.. I think.
        // @todo if options.mirror, the origin is center + distance doubled?

        switch (options.direction) {
          case 'north': {
            nextState.currentTranslation = { x: 0, y: -dy };
            nextState.currentScale = { x: 0, y: dy * 0.01 };
            break;
          }
          case 'east':
          case 'south':
          case 'west': {
            nextState.currentTranslation = { x: -dx, y: 0 };
            nextState.currentScale = { x: dx * 0.01, y: 0 };
            break;
          }
          case 'north-east':
          case 'south-east':
          case 'south-west':
          case 'north-west': {
            // @todo do something..
            break;
          }
        }
      },
      apply(nextState: Partial<TransitionState>) {
        const state = getState();
        const points = state.initialPoints;

        if (nextState.currentTranslation) {
          // @todo apply translation
        }
        if (nextState.currentSkew) {
          // @todo apply skew
        }
        if (nextState.currentRotation) {
          // @todo apply rotation.
        }
        if (nextState.currentScale) {
          // @todo apply scale
        }

        // @todo the result is [ state.points = fn(state.initialPoints) ]

        setState(nextState);
      },
      translate(_newOrigin: [number, number], options: InteractionOptions = {}) {
        const state = getState();
        const newOrigin = fromOrigin(asOrigin(_newOrigin), state.pointScale);
        const origin = state.origin;
        const dx = newOrigin[0] - origin[0];
        const dy = newOrigin[1] - origin[1];
        const nextState: Partial<TransitionState> = {};

        nextState.currentTranslation = { x: dx, y: dy };

        if (options.snap) {
          // @todo snap points.
        }

        state.apply(nextState);
      },
      scale(_newOrigin: [number, number], options: ScaleOptions) {
        const state = getState();
        const nextState: Partial<TransitionState> = {};
        const newOrigin = fromOrigin(asOrigin(_newOrigin), state.pointScale);
        const origin = fromOrigin(state.origin, state.pointScale);
        const dx = newOrigin[0] - origin[0];
        const dy = newOrigin[1] - origin[1];
        const dist = Math.sqrt(dx * dx + dy * dy);

        const scaleDistChange = dist - state.initialTouchDistance;
        const scale = state.initialScale + scaleDistChange * 0.01;
        nextState.currentScale = { x: scale, y: scale };

        if (options.snap) {
          // @todo implement snaps.
        }

        if (options.scaleAllDirections) {
          nextState.currentTranslation = { x: -dx, y: -dy };
          // Double the scale.
          nextState.currentScale.x += scaleDistChange * 0.01;
          nextState.currentScale.y += scaleDistChange * 0.01;
        }

        // @todo implement these.. but these might be skews?
        options.scaleVertically;
        options.scaleHorizontally;

        state.apply(nextState);
      },
      rotate(_newOrigin: [number, number], options: RotateOptions = {}) {
        const state = getState();
        const newOrigin = fromOrigin(asOrigin(_newOrigin), state.pointScale);
        const nextState: Partial<TransitionState> = {};
        const origin = fromOrigin(state.origin, state.pointScale);

        const dx = newOrigin[0] - origin[0];
        const dy = newOrigin[1] - origin[1];
        // rotate around origin.
        const angle = Math.atan2(dy, dx);

        if (options.snap && options.snapDegrees) {
          const threshold = options.snapThreshold || 360;
          // @todo pick best snap degree (and validate if fits in threshold)
        }

        nextState.currentRotation = (angle * 180) / Math.PI; // @todo maybe wrong..

        state.apply(nextState);
      },
      scaleAndRotate(_touches: [number, number][], options?: ScaleRotateOptions) {
        const state = getState();
        const touches = _touches.map(asOrigin).map((touch) => fromOrigin(touch, state.pointScale));
        const nextState: Partial<TransitionState> = {};
        const [first, second] = touches; // Ignore other touches.
        const newOrigin = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
        const dx = second[0] - first[0];
        const dy = second[1] - first[1];
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 1. Scale change
        const scaleDistChange = dist - state.initialTouchDistance;
        const scale = state.initialScale + scaleDistChange * 0.01;
        nextState.currentScale = { x: scale, y: scale };

        // 2. Rotation based on direction
        const angle = Math.atan2(dy, dx);
        const angleDelta = angle - state.initialTouchAngle;
        nextState.currentRotation = state.initialTouchAngle + (angleDelta * 180) / Math.PI;

        // 3. Translate based on new origin.
        const translateX = newOrigin[0] - state.origin[0];
        const translateY = newOrigin[1] - state.origin[1];
        nextState.currentTranslation = { x: translateX, y: translateY };

        state.apply(nextState);
      },
    };
  });

interface RotateOptions extends InteractionOptions {
  snap?: boolean;
  snapDegrees?: number[];
  snapThreshold?: number;
}

interface ScaleRotateOptions extends InteractionOptions {
  snap?: boolean;
  snapDegrees?: number[];
}

/**
 * Transform will add points to each corner of the shape, as well as points in
 * between each corner.
 */
interface TransformOptions extends InteractionOptions {
  direction: 'north-west' | 'north-east' | 'south-west' | 'south-east' | 'north' | 'east' | 'south' | 'west';
  mirror?: boolean;
}

/**
 * Scale allows you to resize the object.
 */
interface ScaleOptions extends InteractionOptions {
  direction: 'north-west' | 'north-east' | 'south-west' | 'south-east' | 'north' | 'east' | 'south' | 'west';
  maintainAspectRatio?: boolean;
  scaleAllDirections?: boolean;
  scaleVertically?: boolean;
  scaleHorizontally?: boolean;
}

interface TransitionResult {
  points: [number, number][];
  activePoints: [number, number][];
  rotation: number;
  origin: [number, number];
  originPoint: [number, number];
  scale: { x: number; y: number };
  translation: { x: number; y: number };
  skew: { x: number; y: number };
  matrix: [number, number, number, number, number, number];
  apply: (point: [number, number]) => [number, number];
}

interface InteractionOptions {
  snap?: boolean;
}

interface TransitionOptions {
  points: [number, number][];
  origin?: [number, number];
  multiTouch?: boolean;
  initialTouches?: [number, number][];
  /**
   * This will be used to translate origin units to point units.
   */
  pointScale?: number;
  activePoints?: number[];
  activePointElements?: SVGElement[];
  initialScale?: number;
  /**
   * Snaps are 2 points that represent a line.
   * [d1x, d1y, d2x, d2y]
   *
   *   * d1
   *    \
   *     \
   *      * d2
   *
   * This will act as snapping points. Each time the position
   * is translated, a distance calculation will be done to each of the
   * lines.
   *
   * If the distance is within the threshold then it will snap the projection
   * to that point.
   *
   * (https://stackoverflow.com/questions/14371841/finding-if-a-point-is-on-a-line/14372111#14372111)
   */
  snaps?: [number, number, number, number][];
  /**
   * Distance in pixels that a snap-line should snap.
   */
  snapThreshold?: number;
}