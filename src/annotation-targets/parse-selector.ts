/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  ParsedSelector,
  SupportedSelectors,
  TemporalSelector,
  SvgSelector,
  SelectorStyle,
  SvgShapeType,
} from './selector-types';
import { Selector } from '@iiif/presentation-3';
import {
  NormalizedSvgPathCommand,
  NormalizedSvgPathCommandType,
  normalizeSvgViewBox,
  parseAndNormalizeSvgPath,
} from './normalize-svg';
import { flattenCubicBezier, flattenQuadraticBezier } from './bezier';

const BOX_SELECTOR =
  /&?(xywh=)?(pixel:|percent:|pct:)?([0-9]+(?:\.[0-9]+)?),([0-9]+(?:\.[0-9]+)?),([0-9]+(?:\.[0-9]+)?),([0-9]+(?:\.[0-9]+)?)/;

// Does not support 00:00:00 or 00:00 formats.
const TEMPORAL_SELECTOR = /&?(t=)(npt:)?([0-9]+(.[0-9]+)?)?(,([0-9]+(.[0-9]+)?))?/;

export function parseSelector(
  source: Selector | Selector[],
  { domParser, svgPreprocessor }: { domParser?: DOMParser; svgPreprocessor?: (svg: string) => string } = {}
): ParsedSelector {
  if (Array.isArray(source)) {
    return (source as Array<string | Selector>).reduce(
      <ParseSelector>(data: ParsedSelector, nextSource: string | Selector) => {
        const { selector, selectors } = parseSelector(nextSource);
        if (selector) {
          if (!data.selector) {
            data.selector = selector;
          }
          data.selectors.push(...selectors);
        }
        return data;
      },
      {
        selector: null,
        selectors: [],
      } as ParsedSelector
    );
  }

  if (!source) {
    return {
      selector: null,
      selectors: [],
    };
  }

  if (typeof source === 'string') {
    const [id, fragment] = source.split('#');

    if (!fragment) {
      // This is an unknown selector.
      return {
        selector: null,
        selectors: [],
      };
    }

    return parseSelector({ type: 'FragmentSelector', value: fragment });
  }

  if (source.type === 'PointSelector' && (source.t || source.t === 0)) {
    const selector: TemporalSelector = {
      type: 'TemporalSelector',
      temporal: {
        startTime: source.t,
      },
    };

    return {
      selector,
      selectors: [selector],
    };
  }

  if (source.type === 'FragmentSelector') {
    const matchBoxSelector = BOX_SELECTOR.exec(source.value);
    if (matchBoxSelector) {
      const selector: SupportedSelectors = {
        type: 'BoxSelector',
        spatial: {
          unit: matchBoxSelector[2] === 'percent:' || matchBoxSelector[2] === 'pct:' ? 'percent' : 'pixel',
          x: parseFloat(matchBoxSelector[3]),
          y: parseFloat(matchBoxSelector[4]),
          width: parseFloat(matchBoxSelector[5]),
          height: parseFloat(matchBoxSelector[6]),
        },
      };

      return {
        selector,
        selectors: [selector],
      };
    }

    const matchTimeSelector = source.value.match(TEMPORAL_SELECTOR);
    if (matchTimeSelector) {
      const selector: TemporalSelector = {
        type: 'TemporalSelector',
        temporal: {
          startTime: matchTimeSelector[4] ? parseFloat(matchTimeSelector[4]) : 0,
          endTime: matchTimeSelector[7] ? parseFloat(matchTimeSelector[7]) : undefined,
        },
      };

      return {
        selector,
        selectors: [selector],
      };
    }

    return {
      selector: null,
      selectors: [],
    };
  }

  if (source.type === 'SvgSelector' && 'value' in source) {
    if (!domParser) {
      if (typeof window !== 'undefined') {
        domParser = new window.DOMParser();
      } else {
        console.warn(
          'No DOMParser available, cannot parse SVG selector, `points`, `spatial` and `style` will be unavailable and the SVG will not be normalized.'
        );
      }
    }
    let points: [number, number][] = [];
    let rect: [number, number, number, number] | undefined;
    let style: SelectorStyle | undefined;
    let svg = svgPreprocessor?.(source.value) ?? source.value;
    let svgShape: SvgShapeType | undefined;
    if (domParser) {
      const svgElement: SVGElement | null = domParser
        .parseFromString(source.value, 'image/svg+xml')
        .querySelector('svg');
      if (!svgElement) {
        console.warn(`Illegal SVG selector: ${source.value}`);
        return {
          selector: null,
          selectors: [],
        };
      }
      const selectorElem = getSelectorElement(svgElement);
      if (selectorElem) {
        points = selectorElem.points;
        svgShape = selectorElem.shapeType;
        rect = [
          Math.min(...points.map((p) => p[0])), // llx
          Math.min(...points.map((p) => p[1])), // lly
          Math.max(...points.map((p) => p[0])), // urx
          Math.max(...points.map((p) => p[1])), // ury
        ];
        ({ style, svg } = extractStyles(selectorElem.element) ?? { svg });
        svg = normalizeSvgViewBox(svgElement, rect[2], rect[3]);
      }
    }
    const sel: SvgSelector = {
      type: 'SvgSelector',
      svg,
      svgShape,
      style,
      points: points.length ? points : undefined,
      spatial: rect
        ? { unit: 'pixel', x: rect[0], y: rect[1], width: rect[2] - rect[0], height: rect[3] - rect[1] }
        : undefined,
    };
    return {
      selector: sel,
      selectors: [sel],
    };
  }
  return {
    selector: null,
    selectors: [],
  };
}

export type SelectorElement = {
  element: SVGElement;
  points: [number, number][];
  shapeType: SvgShapeType;
};

function getShapeTypeFromPath(svgPath: NormalizedSvgPathCommand[]): SvgShapeType {
  const cmdFrequencies = svgPath
    .map((seg) => seg[0])
    .reduce(
      (acc: Record<NormalizedSvgPathCommandType, number>, cmd) => {
        acc[cmd] += 1;
        return acc;
      },
      { C: 0, Q: 0, L: 0, M: 0 }
    );
  const cmdTypes = new Set(svgPath.map((seg) => seg[0]));
  if (cmdFrequencies.C > 0 || cmdFrequencies.Q > 0) {
    return 'path';
  }
  if (cmdFrequencies.L > 0 && (cmdTypes.size === 1 || (cmdTypes.size === 2 && cmdTypes.has('M')))) {
    // Only lines and moves: rectangle, polygon or polyline?
    if (cmdFrequencies.L === 4) {
      return 'rect';
    }

    // Check if the path is closed to decide if we have a polygon or a polyline
    const lastSeg = svgPath.slice(-1)[0];
    if (
      (svgPath[0][0] === 'M' && lastSeg[0] === 'L' && lastSeg[1] == svgPath[0][1] && lastSeg[2] === svgPath[0][2]) ||
      (lastSeg[1] === 0 && lastSeg[2] === 0)
    ) {
      return 'polygon';
    } else {
      return 'polyline';
    }
  }
  return 'path';
}

function getSelectorElement(svgElem: SVGElement): SelectorElement | null {
  for (const element of Array.from(svgElem.children) as SVGElement[]) {
    switch (element?.tagName.toLowerCase()) {
      case 'g':
        {
          // Check if any of the children in the container can be converted to points
          const res = getSelectorElement(element as SVGElement);
          if (res) {
            return res;
          }
        }
        continue;
      case 'path': {
        const p = element.getAttribute('d');
        if (!p) {
          continue;
        }
        const normalized = parseAndNormalizeSvgPath(p);
        return { element, points: pathToPoints(normalized), shapeType: getShapeTypeFromPath(normalized) };
      }
      case 'circle': {
        const cx = parseFloat(element.getAttribute('cx') ?? '0');
        const cy = parseFloat(element.getAttribute('cy') ?? '0');
        const r = parseFloat(element.getAttribute('r') ?? '0');
        if (!r) {
          continue;
        }
        const points: [number, number][] = [];
        // TODO: Get rid of the degree -> radian conversion and use radians from the beginning
        for (let angle = 0; angle <= 360; angle += 12) {
          const rad = (angle * Math.PI) / 180;
          points.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
        }
        return { element, points, shapeType: 'circle' };
      }
      case 'ellipse': {
        const cx = parseFloat(element.getAttribute('cx') ?? '0');
        const cy = parseFloat(element.getAttribute('cy') ?? '0');
        const rx = parseFloat(element.getAttribute('rx') ?? '0');
        const ry = parseFloat(element.getAttribute('ry') ?? '0');
        if (!rx && !ry) {
          continue;
        }
        const points: [number, number][] = [];
        for (let angle = 0; angle <= 360; angle += 12) {
          const t = Math.tan((angle / 360) * Math.PI);
          const px = (rx * (1 - t ** 2)) / (1 + t ** 2);
          const py = (ry * 2 * t) / (1 + t ** 2);
          points.push([cx + px, cy + py]);
        }
        return { element, points, shapeType: 'ellipse' };
      }
      case 'line': {
        const x0 = parseFloat(element.getAttribute('x0') ?? '0');
        const y0 = parseFloat(element.getAttribute('y0') ?? '0');
        const x1 = parseFloat(element.getAttribute('x1') ?? '0');
        const y1 = parseFloat(element.getAttribute('y1') ?? '0');
        if (x0 === x1 && y0 === y1) {
          continue;
        }
        return {
          element,
          points: [
            [x0, y0],
            [x1, y1],
          ],
          shapeType: 'polyline',
        };
      }
      case 'polygon':
      case 'polyline': {
        const points =
          element
            .getAttribute('points')
            ?.split(' ')
            .map((ps) => ps.split(',').map(parseFloat) as [number, number]) ?? [];
        if (!points.length) {
          continue;
        }
        let shapeType: SvgShapeType = 'polyline';
        if (element.tagName.toLowerCase() === 'polygon') {
          // A polygon is a closed path, so the last point is the same as the first.
          points.push(points[0]);
          shapeType = 'polygon';
        }
        return { element, points, shapeType };
      }
      case 'rect': {
        const x = parseFloat(element.getAttribute('x') ?? '0');
        const y = parseFloat(element.getAttribute('y') ?? '0');
        const width = parseFloat(element.getAttribute('width') ?? '0');
        const height = parseFloat(element.getAttribute('height') ?? '0');
        if (!width || !height) {
          continue;
        }
        return {
          element,
          points: [
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height],
            [x, y],
          ],
          shapeType: 'rect',
        };
      }
      default:
        // Try next element
        continue;
    }
  }
  return null;
}

function pathToPoints(normalizedPath: NormalizedSvgPathCommand[]): [number, number][] {
  const out: [number, number][] = [];
  let startPoint: [number, number] | undefined;
  for (let i = 0; i < normalizedPath.length; i++) {
    const seg = normalizedPath[i];
    switch (seg[0]) {
      case 'M':
        startPoint = [seg[1], seg[2]];
        continue;
      case 'L':
        out.push(startPoint!, [seg[1], seg[2]]);
        break;
      case 'C':
        out.push(
          ...flattenCubicBezier(
            { x: startPoint![0], y: startPoint![1] },
            { x: seg[1], y: seg[2] },
            { x: seg[3], y: seg[4] },
            { x: seg[5], y: seg[6] }
          ).map((p) => [p.x, p.y] as [number, number])
        );
        break;
      case 'Q':
        out.push(
          ...flattenQuadraticBezier(
            { x: startPoint![0], y: startPoint![1] },
            { x: seg[1], y: seg[2] },
            { x: seg[3], y: seg[4] }
          ).map((p) => [p.x, p.y] as [number, number])
        );
        break;
    }
  }
  return out;
}
function extractStyles(selectorElement: SVGElement): { style?: SelectorStyle; svg: string } | undefined {
  let { fill, stroke, strokeWidth, strokeDasharray } = selectorElement.style;
  if (selectorElement.hasAttribute('fill')) {
    fill = selectorElement.getAttribute('fill')!;
    selectorElement.removeAttribute('fill');
  }
  if (selectorElement.hasAttribute('stroke')) {
    stroke = selectorElement.getAttribute('stroke')!;
    selectorElement.removeAttribute('stroke');
  }
  if (selectorElement.hasAttribute('stroke-width')) {
    strokeWidth = selectorElement.getAttribute('stroke-width')!;
    selectorElement.removeAttribute('stroke-width');
  }
  if (selectorElement.hasAttribute('stroke-dasharray')) {
    strokeDasharray = selectorElement.getAttribute('stroke-dasharray')!;
    selectorElement.removeAttribute('stroke-dasharray');
  }
  const style: SelectorStyle = {};
  if (fill.length) {
    style.fill = fill;
  }
  if (stroke.length) {
    style.stroke = stroke;
  }
  if (strokeWidth.length) {
    style.strokeWidth = strokeWidth;
  }
  if (strokeDasharray.length) {
    style.strokeDasharray = strokeDasharray;
  }
  let rootElem: SVGElement | null = selectorElement;
  while (rootElem.tagName.toLowerCase() !== 'svg') {
    rootElem = rootElem.parentElement as SVGElement | null;
    if (rootElem === null) {
      throw new Error('Could not find root SVG element');
    }
  }
  return { svg: rootElem.outerHTML, style: Object.values(style).find((v) => v !== undefined) ? style : undefined };
}
