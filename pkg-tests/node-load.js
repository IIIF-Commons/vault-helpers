const { Vault } = require('@iiif/vault');
const events = require('@iiif/vault-helpers/events');
const i18n = require('@iiif/vault-helpers/i18n');
// const reacti18next = require('@iiif/vault-helpers/react-i18next');
const styles = require('@iiif/vault-helpers/styles');
const thumbnail = require('@iiif/vault-helpers/thumbnail');

const vault = new Vault();

console.log(vault);
console.log(events);
console.log(i18n);
// console.log(reacti18next);
console.log(styles);
console.log(thumbnail);

const helper = thumbnail.createThumbnailHelper(vault);

vault.load('https://wellcomelibrary.org/iiif/b18035723/manifest').then(() => {
  helper
    .getBestThumbnailAtSize(
      { id: 'https://iiif.wellcomecollection.org/presentation/b18035723/canvases/b18035723_0001.JP2', type: 'Canvas' },
      {
        height: 300,
        width: 300,
      }
    )
    .then((resp) => {
      console.log(resp);
    });
});
