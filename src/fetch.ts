import { Collection, Manifest } from '@iiif/presentation-3';
import { upgrade } from '@iiif/parser/upgrader';

function fetchAndUpgrade(input: RequestInfo | URL, init?: RequestInit): Promise<Manifest | Collection> {
  return fetch(input, init)
    .then((resp) => resp.json())
    .then(upgrade);
}

export { fetchAndUpgrade as fetch };
