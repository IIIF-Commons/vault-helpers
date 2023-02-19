import { createStore } from 'zustand/vanilla';
import { SvgSelector } from './annotation-targets/selector-types';

interface SvgSelectorEditor extends SvgSelector {
  points: Array<[number, number]>;
  options: SvgSelectorEditorOptions;
  /**
   * A hint for rendering - should the shape be rendered as a line or closed shape.
   */
  isClosed: boolean;
  selectedPoints: number[]; // <-- need to keep this updated if we push points at index, or if we remove them.
  pushPoint(x: number, y: number): void;
  addPointAtIndex(x: number, y: number, index: number): void;
  removePointAtIndex(index: number): [number, number] | undefined;
  popPoint(): [number, number] | undefined;
  splitPoint(index: number, px?: number): [number, number];
  splitPointAtPercent(index: number, pct: number): [number, number];
  scaleBy(scale: number): void;
  setStyle(style: SvgSelector['style']): void;
  unsetStyle(prop: string): void;
  translate(x: number, y: number): void;
  translateSelected(x: number, y: number): void;
  removeSelected(): void;
  recalculateSvg(): void;
  recalculateBounds(): void;
  recalculateSvgAsPolygon(): void;
  recalculateSvgAsRect(updatePoints?: boolean): void;
  closeShape(): void;
  applyUpdatesToSvg(svg: SVGElement): void;

  toggleSelected(index: number): void;

  updatePointAtIndex(index: number, xy: [number, number]): void;

  translatePointAtIndex(index: number, xy: [number, number]): void;
}

interface SvgSelectorEditorOptions {
  initiallyOpen?: boolean;
  recalculateBounds?: boolean;
  recalculateSvg?: boolean;
  recalculateSvgAs?: 'polygon' | 'rect';
  trackSvg?: SVGElement;
}

/**
 * SVG Selector editor
 *
 * Structure of an editable SVG:
 *
 *   <svg>
 *     <!-- The first non-group element will be the preview -->
 *     <g><rect .../></g>
 *
 *     <!-- any controls can go below -->
 *   </svg>
 *
 * When you create this element, you can have it sync up with this store
 * automatically - and bind your own events to the controls on subsequent svg
 * elements.
 *
 * For styling we recommend you use CSS and avoid adding inline properties to
 * the SVG element itself.
 *
 * @param selector
 * @param options
 */
export const svgSelectorEditor = (selector: SvgSelector, options: SvgSelectorEditorOptions = {}) =>
  createStore<SvgSelectorEditor>()((setState, getState, store) => {
    // @todo Set isClosed automatically - and remove last point if not closed is passed in.

    let points = [...(selector.points || [])];
    const isClosed = arePointsClosed(points);

    if (options.initiallyOpen && isClosed) {
      points = points.slice(0, -1);
    }

    // Set up internal subscription for automatic recalculation.
    store.subscribe((state, prevState) => {
      if (state.points !== prevState.points || state.isClosed !== prevState.isClosed) {
        if (state.options.recalculateSvg) {
          if (state.options.recalculateSvgAs === 'polygon') {
            state.recalculateSvgAsPolygon();
          } else if (state.options.recalculateSvgAs === 'rect') {
            state.recalculateSvgAsRect();
          } else {
            state.recalculateSvg();
          }
        }
        if (state.options.recalculateBounds) {
          state.recalculateBounds();
        }
        if (state.options.trackSvg) {
          state.applyUpdatesToSvg(state.options.trackSvg);
        }
      }
    });

    return {
      ...selector,
      points,
      isClosed: !options.initiallyOpen,
      options: options,
      selectedPoints: [],
      pushPoint(x, y) {
        setState((p) => ({ points: [...(p.points || []), [x, y]] }));
      },
      addPointAtIndex(x, y, index) {
        const atIndex = getState().points[index];
        if (!atIndex) {
          return;
        }
        setState((p) => {
          // 1. update points
          const before = p.points.slice(0, index);
          const after = p.points.slice(index);
          const points = [...before, [x, y], ...after] as [number, number][];

          // 2. update selected indexes.
          const newSelected = p.selectedPoints.map((selected) => {
            if (selected >= index) {
              return selected + 1;
            }
            return selected;
          });
          for (const selected of p.selectedPoints) {
            if (selected >= index) {
              newSelected.push(selected + 1);
            } else {
              newSelected.push(selected);
            }
          }

          if (newSelected.length) {
            return { points, selectedPoints: newSelected };
          }
          return { points };
        });
      },

      updatePointAtIndex(index: number, xy: [number, number]) {
        setState((prev) => {
          return {
            points: prev.points.map((existing, idx) => (idx === index ? xy : existing)),
          };
        });
      },
      translatePointAtIndex(index: number, deltaXY: [number, number]) {
        setState((prev) => {
          return {
            points: prev.points.map((existing, idx) =>
              idx === index ? [existing[0] + deltaXY[0], existing[1] + deltaXY[1]] : existing
            ),
          };
        });
      },

      removePointAtIndex(index) {
        const pointToRemove = getState().points[index];
        if (pointToRemove) {
          setState((p) => {
            const before = p.points.slice(0, index);
            const after = p.points.slice(index + 1);
            const points = [...before, ...after] as [number, number][];

            const newSelected = p.selectedPoints
              .filter((selected) => {
                return selected === index;
              })
              .map((selected) => {
                if (selected > index) {
                  return selected - 1;
                }
                return selected;
              });

            if (newSelected.length) {
              return { points, selected: newSelected };
            }
            return { points };
          });
          return pointToRemove;
        }
      },
      popPoint() {
        const allPoints = getState().points;
        if (allPoints.length === 0) {
          return;
        }
        if (allPoints.length === 1) {
          setState({ points: [] });
          return allPoints[0];
        }
        setState((p) => {
          return { points: p.points.slice(0, -1) };
        });
        return allPoints[allPoints.length - 1];
      },
      splitPoint(x?: number) {
        // @todo
        throw new Error('not implemented');
      },
      splitPointAtPercent(index: number, pct: number) {
        // @todo
        throw new Error('not implemented');
      },
      scaleBy(scale: number) {
        // @todo
        throw new Error('not implemented');
      },
      setStyle(style: SvgSelector['style']) {
        // @todo
        throw new Error('not implemented');
      },
      unsetStyle(prop: string) {
        // @todo
        throw new Error('not implemented');
      },
      translate(x: number, y: number) {
        // @todo
        throw new Error('not implemented');
      },
      translateSelected(x: number, y: number) {
        // @todo
        throw new Error('not implemented');
      },
      removeSelected() {
        const selected = getState().selectedPoints;
        if (selected.length) {
          setState((p) => ({
            selectedPoints: [],
            points: p.points.filter((_, key) => selected.indexOf(key) === -1),
          }));
        }
      },

      toggleSelected(index: number) {
        setState((s) => {
          if (s.selectedPoints.includes(index)) {
            return { selectedPoints: s.selectedPoints.filter((r) => r !== index) };
          }
          return { selectedPoints: [...s.selectedPoints, index] };
        });
      },

      applyUpdatesToSvg(svg: SVGElement) {
        // @todo
        throw new Error('not implemented');
      },
      recalculateSvg() {
        // @todo
        // Steps:
        // - Parse existing SVG
        // - Find first element that matches (using the rules from parse selector - maybe split out)
        // - Based on the type - try to reverse the points
        //    - IF that fails, set the shapeType to polygon and replace the element.
        // -
        throw new Error('not implemented');
      },
      recalculateSvgAsPolygon() {
        // Much simpler implementation.
        // 1. extract height/width of the original SVG
        // 2. create new svg from template.
        const svgShape = getState().isClosed ? 'polygon' : 'polyline';
        const template = (width: number, height: number, points: [number, number][]) =>
          `<svg height="${height}" width="${width}" xmlns="http://www.w3.org/2000/svg">` +
          `<g><${svgShape} points="${points.map((p) => p.join(',')).join(' ')}" /></g>` +
          `</svg>`;

        const svg = getState().svg;
        const heightMatch = svg.match(/height="([\d.]+)"/);
        const widthMatch = svg.match(/width="([\d.]+)"/);
        if (!heightMatch || !widthMatch) {
          throw new Error('No height/width on SVG');
        }
        setState({
          svg: template(parseFloat(widthMatch[1]), parseFloat(heightMatch[1]), getState().points),
          svgShape: getState().isClosed ? 'polygon' : 'polyline',
        });
      },
      recalculateSvgAsRect(updatePoints) {
        // @todo
        const template = (height: number, width: number, xywh: [number, number, number, number]) =>
          `<svg height="${height}" width="${width}" xmlns="http://www.w3.org/2000/svg">` +
          `<g><rect x="${xywh[0]}" y="${xywh[1]}" width="${xywh[2]}" height="${xywh[3]}"></g>` +
          `</svg>`;

        if (updatePoints) {
          // also set the points to the bounding box instead.
        }
      },
      recalculateBounds() {
        // @todo
        throw new Error('not implemented');
      },
      openShape() {
        // @todo Mark as isClosed: false
        // @todo remove last point if it matches first.
      },
      closeShape() {
        // @todo push first point onto last point?
        // @todo prevent pushing points if closed?
        setState({ isClosed: true });
      },
    };
  });

export function arePointsClosed(points: [number, number][]) {
  const len = points.length;
  if (len < 2) {
    return false;
  }

  const first = points[0];
  const last = points[len - 1];
  // First and last points match.
  return first[0] === last[0] && first[1] === last[1];
}
