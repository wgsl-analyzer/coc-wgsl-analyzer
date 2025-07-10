import { exec, spawnSync } from 'node:child_process';
import { type ExtensionContext, window, workspace } from 'coc.nvim';
import { randomBytes } from 'node:crypto';
import { createWriteStream, type PathLike, promises as fs } from 'node:fs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import * as zlib from 'node:zlib';
import path from 'node:path';
import stream from 'node:stream';
import util from 'node:util';
import type { UpdatesChannel } from './config';

const pipeline = util.promisify(stream.pipeline);
const rejectUnauthorized = workspace.getConfiguration('http').get('proxyStrictSSL', true);
const proxy = process.env.https_proxy || process.env.HTTPS_PROXY;
const agent = proxy ? new HttpsProxyAgent(proxy, { rejectUnauthorized }) : undefined;

async function patchelf(destination: PathLike): Promise<void> {
  const expression = `
{src, pkgs ? import <nixpkgs> {}}:
    pkgs.stdenv.mkDerivation {
        name = "wgsl-analyzer";
        inherit src;
        phases = [ "installPhase" "fixupPhase" ];
        installPhase = "cp $src $out";
        fixupPhase = ''
        chmod 755 $out
        patchelf --set-interpreter "$(cat $NIX_CC/nix-support/dynamic-linker)" $out
        '';
    }
`;
  const origFile = `${destination}-orig`;
  await fs.rename(destination, origFile);

  await new Promise((resolve, reject) => {
    const handle = exec(`nix-build -E - --arg src '${origFile}' -o ${destination}`, (error, stdout, stderr) => {
      if (error != null) {
        reject(Error(stderr));
      } else {
        resolve(stdout);
      }
    });
    handle.stdin?.write(expression);
    handle.stdin?.end();
  });

  await fs.unlink(origFile);
}

interface Asset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  published_at: string;
  assets: Array<Asset>;
}

export interface ReleaseTag {
  tag: string;
  url: string;
  name: string;
  asset?: Asset;
}

function isMusl(): boolean {
  // We can detect Alpine by checking `/etc/os-release` but not Void Linux musl.
  // Instead, we run `ldd` since it advertises the libc which it belongs to.
  const result = spawnSync('ldd', ['--version']);
  return result.stderr != null && result.stderr.indexOf('musl libc') >= 0;
}

function getPlatform(): string | undefined {
  const platforms: { [key: string]: string } = {
    'ia32 win32': 'x86_64-pc-windows-msvc',
    'x64 win32': 'x86_64-pc-windows-msvc',
    'x64 linux': 'x86_64-unknown-linux-gnu',
    'x64 darwin': 'x86_64-apple-darwin',
    'arm linux': 'arm-unknown-linux-gnueabihf',
    'arm64 win32': 'aarch64-pc-windows-msvc',
    'arm64 linux': 'aarch64-unknown-linux-gnu',
    'arm64 darwin': 'aarch64-apple-darwin',
  };

  let platform = platforms[`${process.arch} ${process.platform}`];
  if (platform === 'x86_64-unknown-linux-gnu' && isMusl()) {
    platform = 'x86_64-unknown-linux-musl';
  }
  return platform;
}

export async function getLatestRelease(updatesChannel: UpdatesChannel): Promise<ReleaseTag | undefined> {
  console.info(`Fetching ${updatesChannel} release...`);
  let releaseURL = 'https://api.github.com/repos/wgsl-analyzer/wgsl-analyzer/releases/latest';
  if (updatesChannel === 'nightly') {
    releaseURL = 'https://api.github.com/repos/wgsl-analyzer/wgsl-analyzer/releases/tags/nightly';
  }
  const response = await fetch(releaseURL, { agent });
  if (!response.ok) {
    console.error(await response.text());
    return;
  }

  const release: GithubRelease = await response.json() as GithubRelease;
  const platform = getPlatform();
  if (!platform) {
    console.error(`Unfortunately we don't ship binaries for your platform yet.`);
    return;
  }
  const suffix = process.platform === 'win32' ? 'zip' : 'gz';
  const asset = release.assets.find((val) => val.browser_download_url.endsWith(`${platform}.${suffix}`));
  if (!asset) {
    console.error(`getLatestRelease failed: ${JSON.stringify(release)}`);
    return;
  }

  let tag = release.tag_name;
  if (updatesChannel === 'nightly') {
    tag = `${release.tag_name} ${release.published_at.slice(0, 10)}`;
  }
  const name = process.platform === 'win32' ? 'wgsl-analyzer.exe' : 'wgsl-analyzer';

  console.info(`Latest release tag: ${tag}`);
  return { asset, tag, url: asset.browser_download_url, name: name };
}

export async function downloadServer(context: ExtensionContext, release: ReleaseTag): Promise<void> {
  console.info(`Downloading wgsl-analyzer ${release.tag}`);
  const statusItem = window.createStatusBarItem(0, { progress: true });
  statusItem.text = `Downloading wgsl-analyzer ${release.tag}`;
  statusItem.show();

  const response = await fetch(release.url, { agent });
  if (!response.ok) {
    statusItem.hide();
    throw new Error('Download failed');
  }
  if (response.body === null) {
    throw new Error("response.body was null");
  }
  let current = 0;
  const length = Number(response.headers.get('content-length'));
  response.body.on('data', (chunk: Buffer) => {
    current += chunk.length;
    const p = ((current / length) * 100).toFixed(2);
    statusItem.text = `${p}% Downloading wgsl-analyzer ${release.tag}`;
    console.info(`${p}% Downloading wgsl-analyzer ${release.tag}`);
  });

  const _path = path.join(context.storagePath, release.name);
  const randomHex = randomBytes(5).toString('hex');
  const tempFile = path.join(context.storagePath, `${release.name}${randomHex}`);

  if (process.platform === 'win32') {
    await fs.writeFile(tempFile, await response.buffer());

    new AdmZip(tempFile).extractAllTo(context.storagePath, true, true);
    await fs.unlink(tempFile).catch((error) => {
      console.error(error);
    });
    statusItem.hide();
    return;
  }

  const destinationFileStream = createWriteStream(tempFile, { mode: 0o755 });
  await pipeline(response.body.pipe(zlib.createGunzip()), destinationFileStream);
  await new Promise<void>((resolve) => {
    destinationFileStream.on('close', resolve);
    destinationFileStream.destroy();
    setTimeout(resolve, 1000);
  });

  await fs.unlink(_path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await fs.rename(tempFile, _path);

  await context.globalState.update('release', release.tag);

  try {
    if (await fs.stat('/etc/nixos')) {
      statusItem.text = 'Patching wgsl-analyzer executable...';
      await patchelf(_path);
    }
  } catch (_e) { }

  console.info(`wgsl-analyzer has been upgrade to ${release.tag}`);
  statusItem.hide();
}
