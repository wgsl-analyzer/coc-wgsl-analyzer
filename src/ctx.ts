import {
  commands,
  type Disposable,
  type ExtensionContext,
  type LanguageClient,
  services,
  type TextDocument,
  Uri,
  window,
  workspace,
} from 'coc.nvim';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import which from 'which';
import { createClient } from './client';
import { Config } from './config';
import { downloadServer, getLatestRelease } from './downloader';
import * as wa from './lsp_ext';

export type WgslDocument = TextDocument & { languageId: 'wgsl' };
export function isWgslDocument(document: TextDocument): document is WgslDocument {
  return document.languageId === 'wgsl';
}

export function isWebbyTomlDocument(document: TextDocument): document is WgslDocument {
  const u = Uri.parse(document.uri);
  return u.scheme === 'file' && u.fsPath.endsWith('webby.toml');
}

export type Cmd = (...args: any[]) => unknown;

export class Ctx {
  client!: LanguageClient;
  public readonly config = new Config();
  private usingSystemServer = false;

  constructor(private readonly extCtx: ExtensionContext) {
    const statusBar = window.createStatusBarItem(0);
    statusBar.text = 'wgsl-analyzer';
    statusBar.show();
    this.extCtx.subscriptions.push(statusBar);

    window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.languageId === 'wgsl') {
        statusBar.show();
      } else {
        statusBar.hide();
      }
    });
  }

  registerCommand(name: string, factory: (ctx: Ctx) => Cmd, internal = false) {
    const fullName = `wgsl-analyzer.${name}`;
    const cmd = factory(this);
    const d = commands.registerCommand(fullName, cmd, null, internal);
    this.extCtx.subscriptions.push(d);
  }

  async startServer() {
    const bin = this.resolveBin();
    if (!bin) {
      return;
    }

    const client = createClient(bin, this.config);
    this.extCtx.subscriptions.push(services.registLanguageClient(client));
    const watcher = workspace.createFileSystemWatcher('**/webby.toml');
    this.extCtx.subscriptions.push(watcher);
    watcher.onDidChange(async () => await commands.executeCommand('wgsl-analyzer.reloadWorkspace'));
    await client.onReady();

    client.onNotification(wa.serverStatus, async (status) => {
      if (status.health !== 'ok' && status.message?.length) {
        if (status.message.startsWith('webby check failed')) return;
        window.showNotification({ content: status.message });
        window.showWarningMessage(
          `wgsl-analyzer failed to start, run ':CocCommand wgsl-analyzer.reloadWorkspace' to reload`,
        );
      }
    });

    this.client = client;
  }

  async stopServer() {
    if (this.client) {
      await this.client.stop();
    }
  }

  get subscriptions(): Disposable[] {
    return this.extCtx.subscriptions;
  }

  resolveBin(): string | undefined {
    // 1. from config, custom server path
    // 2. bundled, coc-wgsl-analyzer can handle updating
    // 3. fallback to system installed server
    const executableName = process.platform === 'win32' ? 'wgsl-analyzer.exe' : 'wgsl-analyzer';
    let bin = join(this.extCtx.storagePath, executableName);
    if (this.config.serverPath) {
      bin = which.sync(workspace.expand(this.config.serverPath), { nothrow: true }) || bin;
    }

    if (existsSync(bin)) {
      return bin;
    }

    const systemBin = which.sync(executableName, { nothrow: true });
    if (systemBin) {
      const { stderr } = spawnSync(systemBin, ['--version'], { encoding: 'utf8' });
      if (stderr.trim().length > 0) {
        return;
      }

      this.usingSystemServer = true;
      return systemBin;
    }

    return;
  }

  async installServerFromGitHub() {
    const latest = await getLatestRelease(this.config.channel);
    if (!latest) {
      return;
    }
    try {
      if (process.platform === 'win32') {
        await this.client.stop();
      }

      await downloadServer(this.extCtx, latest);
    } catch (e) {
      console.error(e);
      let msg = 'Install wgsl-analyzer failed, please try again';
      // @ts-ignore
      if (e.code === 'EBUSY' || e.code === 'ETXTBSY' || e.code === 'EPERM') {
        msg =
          'Install wgsl-analyzer failed, other Vim instances might be using it, you should close them and try again';
      }
      window.showInformationMessage(msg, 'error');
      return;
    }
    await this.client.stop();
    this.client.start();

    this.extCtx.globalState.update('release', latest.tag);
  }

  async checkUpdate(auto = true) {
    if (this.config.serverPath || this.usingSystemServer) {
      // no update checking if using custom or system server
      return;
    }
    if (auto && !this.config.checkOnStartup) {
      return;
    }

    const latest = await getLatestRelease(this.config.channel);
    if (!latest) {
      return;
    }

    const old = this.extCtx.globalState.get('release') || 'unknown release';
    if (old === latest.tag) {
      if (!auto) {
        window.showInformationMessage('Your wgsl-analyzer release is updated');
      }
      return;
    }

    const msg = `wgsl-analyzer has a new release: ${latest.tag}, you're using ${old}. Would you like to download from GitHub`;
    let ret = 0;
    if (this.config.prompt === true) {
      ret = await window.showQuickpick(
        ['Yes, download the latest wgsl-analyzer', 'Check GitHub releases', 'Cancel'],
        msg,
      );
    }
    if (ret === 0) {
      if (process.platform === 'win32') {
        await this.client.stop();
      }
      try {
        await downloadServer(this.extCtx, latest);
      } catch (e) {
        console.error(e);
        let msg = 'Upgrade wgsl-analyzer failed, please try again';
        // @ts-ignore
        if (e.code === 'EBUSY' || e.code === 'ETXTBSY' || e.code === 'EPERM') {
          msg =
            'Upgrade wgsl-analyzer failed, other Vim instances might be using it, you should close them and try again';
        }
        window.showInformationMessage(msg, 'error');
        return;
      }
      await this.client.stop();
      this.client.start();

      this.extCtx.globalState.update('release', latest.tag);
    } else if (ret === 1) {
      await commands
        .executeCommand('vscode.open', 'https://github.com/wgsl-analyzer/wgsl-analyzer/releases')
        .catch(() => {});
    }
  }
}
