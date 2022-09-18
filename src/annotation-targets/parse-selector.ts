/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ParsedSelector, SupportedSelectors, TemporalSelector, SvgSelector } from './selector-types';
import { Selector } from '@iiif/presentation-3';
import { NormalizedSvgPathCommand, parseAndNormalizeSvgPath } from './normalize-svg';
import { flattenCubicBezier, flattenQuadraticBezier } from './bezier';

const BOX_SELECTOR =
  /&?(xywh=)?(pixel:|percent:|pct:)?([0-9]+(?:\.[0-9]+)?),([0-9]+(?:\.[0-9]+)?),([0-9]+(?:\.[0-9]+)?),([0-9]+(?:\.[0-9]+)?)/;

// Does not support 00:00:00 or 00:00 formats.
const TEMPORAL_SELECTOR = /&?(t=)(npt:)?([0-9]+(.[0-9]+)?)?(,([0-9]+(.[0-9]+)?))?/;

export function parseSelector(source: Selector | Selector[], domParser?: DOMParser): ParsedSelector {
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
    if (domParser) {
      let svgElement: SVGElement | null = domParser.parseFromString(source.value, 'image/svg+xml').querySelector('svg');
      if (!svgElement) {
        console.warn(`Illegal SVG selector: ${source.value}`);
        return {
          selector: null,
          selectors: [],
        };
      }
      if (svgElement.firstElementChild?.tagName.toLowerCase() === 'g') {
        // Check for top-level group
        svgElement = svgElement.firstElementChild as SVGElement;
      }
      // TODO: SVG normalization
      points = elementToPoints(svgElement);
      if (points) {
        rect = [
          Math.min(...points.map((p) => p[0])), // llx
          Math.min(...points.map((p) => p[1])), // lly
          Math.max(...points.map((p) => p[0])), // urx
          Math.max(...points.map((p) => p[1])), // ury
        ];
      }
    }
    // TODO: Style
    const sel: SvgSelector = {
      type: 'SvgSelector',
      svg: source.value,
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

function elementToPoints(svgElem: SVGElement): [number, number][] {
  for (const pathElem of Array.from(svgElem.children)) {
    switch (pathElem?.tagName.toLowerCase()) {
      case 'path': {
        const p = pathElem.getAttribute('d');
        if (!p) {
          continue;
        }
        const normalized = parseAndNormalizeSvgPath(p);
        return pathToPoints(normalized);
      }
      case 'circle': {
        const cx = parseFloat(pathElem.getAttribute('cx') ?? '0');
        const cy = parseFloat(pathElem.getAttribute('cy') ?? '0');
        const r = parseFloat(pathElem.getAttribute('r') ?? '0');
        if (!r) {
          continue;
        }
        const points: [number, number][] = [];
        // TODO: Get rid of the degree -> radian conversion and use radians from the beginning
        for (let angle = 0; angle <= 360; angle += 12) {
          const rad = (angle * Math.PI) / 180;
          points.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
        }
        return points;
      }
      case 'ellipse': {
        const cx = parseFloat(pathElem.getAttribute('cx') ?? '0');
        const cy = parseFloat(pathElem.getAttribute('cy') ?? '0');
        const rx = parseFloat(pathElem.getAttribute('rx') ?? '0');
        const ry = parseFloat(pathElem.getAttribute('ry') ?? '0');
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
        return points;
      }
      case 'line': {
        const x0 = parseFloat(pathElem.getAttribute('x0') ?? '0');
        const y0 = parseFloat(pathElem.getAttribute('y0') ?? '0');
        const x1 = parseFloat(pathElem.getAttribute('x1') ?? '0');
        const y1 = parseFloat(pathElem.getAttribute('y1') ?? '0');
        if (x0 === x1 && y0 === y1) {
          continue;
        }
        return [
          [x0, y0],
          [x1, y1],
        ];
      }
      case 'polygon':
      case 'polyline': {
        const points =
          pathElem
            .getAttribute('points')
            ?.split(' ')
            .map((ps) => ps.split(',').map(parseFloat) as [number, number]) ?? [];
        if (!points.length) {
          continue;
        }
        if (pathElem.tagName === 'polygon') {
          // A polygon is a closed path, so the last point is the same as the first.
          points.push(points[0]);
        }
        return points;
      }
      case 'rect': {
        const x = parseFloat(pathElem.getAttribute('x') ?? '0');
        const y = parseFloat(pathElem.getAttribute('y') ?? '0');
        const width = parseFloat(pathElem.getAttribute('width') ?? '0');
        const height = parseFloat(pathElem.getAttribute('height') ?? '0');
        if (!width || !height) {
          continue;
        }
        return [
          [x, y],
          [x + width, y],
          [x + width, y + height],
          [x, y + height],
          [x, y],
        ];
      }
      default:
        // Try next element
        continue;
    }
  }
  return [];
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
        console.log('C', { startPoint, seg });
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
