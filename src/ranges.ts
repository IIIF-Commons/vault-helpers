import { Vault } from '@iiif/vault';
import { ManifestNormalized, RangeNormalized, Reference } from '@iiif/presentation-3';

export function createRangeHelper(vault: Vault) {
  return {
    findFirstCanvasFromRange: (range: RangeNormalized) => findFirstCanvasFromRange(vault, range),
    findAllCanvasesInRange: (range: RangeNormalized) => findAllCanvasesInRange(vault, range),
    findManifestSelectedRange: (manifest: ManifestNormalized, canvasId: string) =>
      findManifestSelectedRange(vault, manifest, canvasId),
    findSelectedRange: (range: RangeNormalized, canvasId: string) => findSelectedRange(vault, range, canvasId),
  };
}

export function findFirstCanvasFromRange(vault: Vault, range: RangeNormalized): null | Reference<'Canvas'> {
  for (const inner of range.items) {
    if (inner.type === 'Canvas') {
      return inner as Reference<'Canvas'>;
    }
    if (inner.type === 'Range') {
      const found = findFirstCanvasFromRange(vault, vault.get(inner));
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function findAllCanvasesInRange(vault: Vault, range: RangeNormalized): Array<Reference<'Canvas'>> {
  const found: Reference<'Canvas'>[] = [];
  for (const inner of range.items) {
    if (inner.type === 'Canvas') {
      if (inner.id.indexOf('#') !== -1) {
        found.push({ id: inner.id.split('#')[0], type: 'Canvas' });
      } else {
        found.push(inner as Reference<'Canvas'>);
      }
    }
    if (inner.type === 'Range') {
      found.push(...findAllCanvasesInRange(vault, vault.get(inner)));
    }
    if ((inner as any).type === 'SpecificResource') {
      const sourceId = typeof (inner as any).source === 'string' ? (inner as any).source : (inner as any).source.id;
      found.push({ id: sourceId, type: 'Canvas' });
    }
  }
  return found;
}

export function findManifestSelectedRange(
  vault: Vault,
  manifest: ManifestNormalized,
  canvasId: string
): null | RangeNormalized {
  for (const range of manifest.structures) {
    const found = findSelectedRange(vault, vault.get(range), canvasId);
    if (found) {
      return found;
    }
  }

  return null;
}

export function findSelectedRange(vault: Vault, range: RangeNormalized, canvasId: string): null | RangeNormalized {
  for (const inner of range.items) {
    const parsedId = inner.id?.split('#')[0];
    if ((inner as any).type === 'SpecificResource' && (inner as any).source === canvasId) {
      return range;
    }
    if (inner.type === 'Canvas' && canvasId === parsedId) {
      return range;
    }
    if (inner.type === 'Range') {
      const found = findSelectedRange(vault, vault.get(inner), canvasId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
