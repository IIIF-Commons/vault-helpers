import { ExternalWebResource } from '@iiif/presentation-3';
import { SupportedSelectors } from './selector-types';

export type SupportedTarget = {
  type: 'SpecificResource';
  source:
    | ExternalWebResource
    | { id: string; type: 'Unknown' | 'Canvas' | 'Range' | 'Manifest'; partOf?: Array<{ id: string; type: string }> };
  purpose?: string;
  selector: SupportedSelectors | null;
  selectors: SupportedSelectors[];
};
