import React, { useRef } from 'react';
import { render } from 'react-dom';
import { parseSelector } from '../annotation-targets/parse-selector';
import { useStore } from 'zustand';
import { svgSelectorEditor } from '../svg-selector-editor';

const parsed = parseSelector({
  type: 'SvgSelector',
  value: `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><g><rect x="100" y="100" width="300" height="300"></rect></g></svg>`,
});
const store = svgSelectorEditor(parsed.selector as any, {
  initiallyOpen: true,
  recalculateSvg: true,
  recalculateSvgAs: 'polygon',
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

  const { svg, points, toggleSelected, selectedPoints, translatePointAtIndex, svgShape } = useStore(store);
  const mousedown = useRef<number>(-1);
  const start = useRef<[number, number] | undefined>(undefined);
  const delta = useRef<[number, number]>([0, 0]);
  const current = useRef<SVGElement | undefined>(undefined);
  const handleToggle = (point: [number, number], idx: number) => (e: MouseEvent) => {
    if (e.metaKey) {
      console.log({ point, e, idx });
      toggleSelected(idx);
    } else {
      mousedown.current = idx;
      current.current = e.target as any;
      delta.current = [0, 0];
      start.current = [e.pageX, e.pageY];
    }
  };
  const mouseup = () => {
    if (mousedown.current !== -1) {
      const start = points[mousedown.current];
      translatePointAtIndex(mousedown.current, delta.current);
    }

    if (current.current) {
      current.current.style.transform = '';
      current.current = undefined;
    }
    mousedown.current = -1;
    delta.current = [0, 0];
  };
  const mousemove = (e: any) => {
    if (mousedown.current !== -1 && start.current) {
      e.stopPropagation();
      delta.current[0] = e.pageX - start.current[0];
      delta.current[1] = e.pageY - start.current[1];

      if (current.current) {
        current.current.style.transform = `translate(${delta.current[0]}px, ${delta.current[1]}px)`;
      }
    }
  };

  return (
    <div>
      <style>{styles}</style>

      <svg width={800} height={600} onPointerMove={mousemove} onPointerUp={mouseup} onPointerLeave={mouseup}>
        <polygon points={points.map((r) => r.join(',')).join(' ')} fill={'#000'} />

        <g name="controls">
          {points.map((point, key) => {
            return (
              <circle
                className={`controls ${selectedPoints.includes(key) ? 'controls--selected' : ''}`}
                key={key}
                cx={point[0]}
                cy={point[1]}
                r={5}
                onPointerDown={handleToggle(point, key)}
              />
            );
          })}
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
