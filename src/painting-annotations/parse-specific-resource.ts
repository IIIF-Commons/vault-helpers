import { ContentResource } from '@iiif/presentation-3';

export function parseSpecificResource(resource: ContentResource) {
  if (resource.type === 'SpecificResource') {
    return [resource.source, { selector: resource.selector }];
  }

  return [resource, { selector: null }];
}
