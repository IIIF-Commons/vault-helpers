import React, { useEffect, useMemo, useRef } from 'react';
import { render } from 'react-dom';
import { parseSelector } from '../annotation-targets/parse-selector';
import { useStore } from 'zustand';
import { svgSelectorEditor } from '../selector-editors/svg-selector-editor';
import { transitionState } from '../selector-editors/transition-state';

const parsed = parseSelector({
  type: 'SvgSelector',
  value: `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><g><rect x="100" y="100" width="300" height="300"></rect></g></svg>`,
});
const store = svgSelectorEditor(parsed.selector as any, {
  initiallyOpen: true,
  recalculateSvg: true,
  recalculateSvgAs: 'polygon',
  recalculateSelectedBounds: true,
});

const changes = [
  () => store.getState().pushPoint(120, 120),
  () => store.getState().pushPoint(140, 160),
  () => store.getState().pushPoint(150, 160),
  () => store.getState().pushPoint(250, 170),
];

const styles = `
    .controls {
        fill: #fff;
        stroke: #000;
        stroke-width: 1px;
    }
    .controls:hover {
        fill: pink;
    }
    .controls--selected {
        fill: red;
    }
    .controls--selected.controls--bounds {
      opacity: 0.5;
      fill: #fff;
    }
`;
function App() {
  /**
   * @todo Current problems and takeaways so far:
   *   - Lots of extra help needed on selecting/deselecting things.
   *      - select / deselect / toggle
   *   - Need a better "shadow" copy that can update based on mouse state.
   *   - MAYBE need to move mouse state / transition state into the store, although that might hammer subscriptions
   *   - MAYBE need to have a new store just for this mouse state.
   *      - Start transition
   *      - Update points
   *      - Cancel transition
   *      - Commit transition
   *   - SVG scaling will still be an issue. Need to confirm that SVG height and width will always match the canvas
   *   - Could build in scaling into the transition - allowing a transition to scale the points.
   *   - Different transition type could be used for creating a new polygon from scratch with the "Pen" tool.
   *   - Need some invisible controls for touch targets - e.g. line splitting
   *   - The controls / transition rendering could be it's own module - but for now focus on enabling easy creation
   *   - Sketch style editing entry point:
   *      - Click -> show bounding box (translate/scale)
   *      - Double-click -> show points (edit/add points)
   *      - Enter -> back to bounding box
   *   - Transition display needs to:
   *      - Hide the existing box (or restyle, could be class name)
   *      - Add new "transitional points" polygon
   *      - Hide or move the points that are part of the transition.
   *   - Keyboard controls:
   *     - select point(s) + nudge
   *     - Select point(s) + nudge with shift key (10x)
   *     - Delete key to remove point
   *     - Advanced - drag box around points
   *     - Advanced - select all points
   *     - Advanced - hold shift to create point in middle
   *   - Possibly new component, like BoxDraw that will go from zero -> selector
   *      - Vector/pen starting point
   *      - Rect / Box drawing?
   *      - Polygon shape
   *      - Circle? (CAN'T EDIT LIKE THIS - but good test of changing editing based on it)
   *      - Triangle (ALSO CAN'T EDIT)
   */

  const {
    svg,
    points,
    selectedBounds,
    toggleSelected,
    removeSelected,
    setSelected,
    selectedPoints,
    translatePointAtIndex,
    svgShape,
  } = useStore(store);
  const mousedown = useRef<number>(-1);
  const start = useRef<[number, number] | undefined>(undefined);
  const delta = useRef<[number, number]>([0, 0]);
  const current = useRef<SVGElement | undefined>(undefined);
  // New
  const transition = useMemo(() => transitionState(), []);
  const { startTransition, finishTransition, translate, transform } = useMemo(
    () => transition.getState(),
    [transition]
  );
  const shadow = useRef<SVGElement>(null);
  const bounds = useRef<SVGElement>(null);

  useEffect(() => {
    return transition.subscribe((state, prevState) => {
      // Moving the current point marker
      if (current.current) {
        // current.current.style.transform = `matrix(${state.currentMatrix.join(',')})`;
        current.current.style.transform = `translate(${state.currentTranslation.x}px, ${state.currentTranslation.y}px)`;
      }
      if (bounds.current) {
        bounds.current.style.transform = `translate(${state.currentTranslation.x}px, ${state.currentTranslation.y}px)`;
      }

      // Moving the shadow element.
      if (shadow.current) {
        if (state.isTransitioning) {
          // When isTransitioning changes false -> true
          if (!prevState.isTransitioning) {
            shadow.current.style.display = 'block';
          }

          // Otherwise update all the points.
          shadow.current.setAttribute('points', state.points.map((r) => r.join(',')).join(' '));
        } else if (prevState.isTransitioning) {
          // When isTransitioning changes true -> false
          shadow.current.style.display = 'none';
        }
      }
    });
  }, [transition]);

  const handleTransform = (direction: string) => (e: MouseEvent) => {
    e.preventDefault();
    startTransition({
      origin: [e.pageX, e.pageY],
      points: points,
      activePoints: selectedPoints,
      data: { type: 'transform', options: { direction } },
    });
  };
  const beginTranslate = (e: MouseEvent) => {
    e.preventDefault();
    startTransition({
      origin: [e.pageX, e.pageY],
      points: points,
      activePoints: selectedPoints,
      data: { type: 'translate' },
    });
  };

  const handleToggle = (point: [number, number], idx: number) => (e: MouseEvent) => {
    if (e.metaKey) {
      e.preventDefault();
      toggleSelected(idx);
    } else {
      const isMulti = selectedPoints.indexOf(idx) !== -1;
      startTransition({
        origin: [e.pageX, e.pageY],
        points: points,
        activePoints: isMulti ? selectedPoints : [idx],
        data: { type: 'translate' },
      });
      current.current = e.target as any;

      if (!isMulti) {
        e.preventDefault();
        setSelected([idx]);
      }
    }
  };
  const mouseup = (e: any) => {
    e.preventDefault();
    if (transition.getState().isTransitioning) {
      const result = finishTransition();
      if (result && result.points[0]) {
        for (const pointIdx of result.activePointsIndexes) {
          translatePointAtIndex(pointIdx, [result.translation.x, result.translation.y]);
        }
      }
      return;
    }
  };
  const mousemove = (e: any) => {
    if (transition.getState().isTransitioning) {
      e.stopPropagation();
      console.log('data', transition.getState().data);

      if (transition.getState().data?.type === 'translate') {
        translate([e.pageX, e.pageY]);
      }
      if (transition.getState().data?.type === 'transform') {
        transform([e.pageX, e.pageY], transition.getState().data?.options);
      }
    }
  };

  const clickOutside = (e: MouseEvent) => {
    console.log(e.target);
    if (!e.defaultPrevented && e.target.tagName === 'svg') {
      setSelected([]);
    }
  };

  return (
    <div>
      <style>{styles}</style>

      <svg
        width={800}
        height={600}
        onPointerDown={clickOutside}
        onPointerMove={mousemove}
        onPointerUp={mouseup}
        onPointerLeave={mouseup}
      >
        <polygon points={points.map((r) => r.join(',')).join(' ')} fill={'#000'} />

        <g name="shadow">
          <polygon
            ref={shadow}
            points=""
            fill="rgba(255, 0, 0, .5)"
            style={{ pointerEvents: 'none', display: 'none' }}
          />
        </g>

        <g name="controls">
          {points.map((point, key) => {
            const isActive = selectedPoints.includes(key);
            // if (selectedBounds && selectedPoints.includes(key)) {
            //   return null;
            // }

            return (
              <circle
                className={`controls ${isActive ? 'controls--selected' : ''}${
                  selectedBounds ? ' controls--bounds' : ''
                }`}
                key={key}
                cx={point[0]}
                cy={point[1]}
                r={isActive && selectedBounds ? 3 : 5}
                onPointerDown={handleToggle(point, key)}
              />
            );
          })}
        </g>

        <g name="bounding" ref={bounds}>
          {selectedBounds && selectedBounds.width > 10 && selectedBounds.height > 10 ? (
            <>
              <rect
                {...selectedBounds}
                fill="transparent"
                stroke="#eee"
                strokeWidth="2"
                onPointerDown={beginTranslate}
              />
              {/* Cardinals */}
              {/*<rect*/}
              {/*  aria-label="translate north"*/}
              {/*  onPointerDown={handleTransform('north')}*/}
              {/*  className={`controls`}*/}
              {/*  x={selectedBounds.x + selectedBounds.width / 2 - 8}*/}
              {/*  y={selectedBounds.y - 4}*/}
              {/*  width={16}*/}
              {/*  height={8}*/}
              {/*/>*/}

              <rect
                onPointerDown={handleTransform('north-west')}
                className={`controls`}
                x={selectedBounds.x - 4}
                y={selectedBounds.y - 4}
                width={8}
                height={8}
              />
              <rect
                onPointerDown={handleTransform('north-east')}
                className={`controls`}
                x={selectedBounds.x + selectedBounds.width - 4}
                y={selectedBounds.y - 4}
                width={8}
                height={8}
              />
              <rect
                onPointerDown={handleTransform('south-east')}
                className={`controls`}
                x={selectedBounds.x + selectedBounds.width - 4}
                y={selectedBounds.y + selectedBounds.height - 4}
                width={8}
                height={8}
              />
              <rect
                onPointerDown={handleTransform('south-west')}
                className={`controls`}
                x={selectedBounds.x - 4}
                y={selectedBounds.y + selectedBounds.height - 4}
                width={8}
                height={8}
              />
            </>
          ) : null}
        </g>
      </svg>
      <button
        onClick={() => {
          const fn = changes.pop();
          if (fn) {
            fn();
          }
        }}
      >
        change
      </button>
    </div>
  );
}

const $el = document.getElementById('root');
if ($el) {
  render(<App />, $el);
}
