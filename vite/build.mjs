import { defaultExternal, defineConfig } from './base-config.mjs';
import { build } from 'vite';
import chalk from 'chalk';

(async () => {
  const singleFileLibraries = [
    'events',
    'i18n',
    'styles',
    'thumbnail',
    'annotation-targets',
    'content-state',
  ];

  // Main UMD build.
  buildMsg('UMD + bundle');
  await build(
    defineConfig({
      entry: `src/index.ts`,
      name: 'index',
      outDir: 'dist',
      globalName: 'VaultHelpers',
      external: [],
    })
  );

  for (const singleFileLib of singleFileLibraries) {
    buildMsg(singleFileLib);
    await build(
      defineConfig({
        entry: `src/${singleFileLib}.ts`,
        name: singleFileLib,
        external: [...defaultExternal],
      })
    );
  }

  // React library special case
  buildMsg('react-i18next');
  await build(
    defineConfig({
      entry: `src/react-i18next.ts`,
      name: 'react-i18next',
      external: [...defaultExternal, 'react'],
    })
  );

  console.log('')


  function buildMsg(name) {
    console.log(chalk.grey(`\n\nBuilding ${chalk.blue(name)}\n`));
  }
})();
