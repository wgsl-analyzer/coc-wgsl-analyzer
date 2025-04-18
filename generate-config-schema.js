/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const fs = require('fs');
const { execSync } = require('child_process');
const packageJson = require('./package.json');
const coc_ra_config = require('./coc-wgsl-analyzer-configurations.json');

const not_supported = [
  'wgsl-analyzer.hover.actions.debug.enable',
  'wgsl-analyzer.hover.actions.enable',
  'wgsl-analyzer.hover.actions.gotoTypeDef.enable',
  'wgsl-analyzer.hover.actions.implementations.enable',
  'wgsl-analyzer.hover.actions.references.enable',
  'wgsl-analyzer.hover.actions.run.enable',
];

let schema = execSync('wgsl-analyzer --print-config-schema', { encoding: 'utf8' });
schema = JSON.parse(schema);
for (const item of schema) {
  const p = item.properties;
  for (const key in p) {
    if (!not_supported.includes(key)) {
      coc_ra_config[key] = p[key];
    }
  }
}
packageJson.contributes.configuration.properties = coc_ra_config;
fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2) + '\n');

for (const x of Object.keys(coc_ra_config).sort()) {
  console.log(`| \`${x}\` | ${coc_ra_config[x].markdownDescription} | \`${coc_ra_config[x].default || null}\` |`);
}
