import { createRequire } from 'node:module';

const pkgRequire = createRequire(__filename);

interface PackageJson {
  version: string;
}

const { version } = pkgRequire('../package.json') as PackageJson;

export const PACKAGE_VERSION: string = version;
