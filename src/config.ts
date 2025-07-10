import { commands, type ConfigurationChangeEvent, window, workspace, type WorkspaceConfiguration } from 'coc.nvim';

export type UpdatesChannel = 'stable' | 'nightly';

export interface Env {
  [name: string]: string;
}

export class Config {
  private readonly rootSection = 'wgsl-analyzer';
  private readonly requiresReloadOpts = ['server', 'webby', 'files', 'updates', 'lens', 'inlayHints'].map(
    (option) => `${this.rootSection}.${option}`,
  );
  private configuration: WorkspaceConfiguration;

  constructor() {
    workspace.onDidChangeConfiguration((event) => this.onConfigChange(event));
    this.configuration = workspace.getConfiguration(this.rootSection);
  }

  private async onConfigChange(event: ConfigurationChangeEvent) {
    this.configuration = workspace.getConfiguration(this.rootSection);

    const requiresReloadOption = this.requiresReloadOpts.find((option) => event.affectsConfiguration(option));
    if (!requiresReloadOption) return;

    let reload = !!this.restartServerOnConfigChange;
    if (!reload) {
      const message = `Changing "${requiresReloadOption}" requires a reload`;
      reload = await window.showPrompt(`${message}. Reload now?`);
    }
    if (reload) {
      await commands.executeCommand('wgsl-analyzer.reload');
    }
  }

  get serverPath() {
    return this.configuration.get<null | string>('server.path') ?? this.configuration.get<null | string>('serverPath');
  }

  get serverExtraEnv() {
    return this.configuration.get<Env>('server.extraEnv') ?? {};
  }

  get restartServerOnConfigChange() {
    return this.configuration.get<boolean>('restartServerOnConfigChange');
  }

  get inlayHint() {
    return {
      enable: workspace.getConfiguration('inlayHint').get('enable', true),
    };
  }

  get debug() {
    return {
      runtime: this.configuration.get<string>('debug.runtime'),
      vimspectorConfiguration: {
        name: this.configuration.get<string>('debug.vimspector.configuration.name'),
      },
      nvimdapConfiguration: {
        template: this.configuration.get<string>('debug.nvimdap.configuration.template'),
      },
    };
  }

  get prompt() {
    return this.configuration.get<boolean | 'neverDownload'>('updates.prompt', true);
  }

  get channel() {
    return this.configuration.get<UpdatesChannel>('updates.channel')!;
  }

  get checkOnStartup() {
    return this.configuration.get<boolean>('updates.checkOnStartup');
  }

  get terminal() {
    return {
      startinsert: this.configuration.get<boolean>('terminal.startinsert'),
    };
  }

  get enable() {
    return this.configuration.get<boolean>('enable');
  }

  get disableProgressNotifications() {
    return this.configuration.get<boolean>('disableProgressNotifications');
  }

  get disablePullDiagnostic() {
    return this.configuration.get<boolean>('disablePullDiagnostic');
  }
}
