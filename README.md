# coc-wgsl-analyzer

[wgsl-analyzer](https://github.com/wgsl-analyzer/wgsl-analyzer) for Vim/Neovim, works as an extension with coc.nvim.

## Install

`:CocInstall coc-wgsl-analyzer`

> remove `wgsl-analyzer` config from `coc-settings.json` if you've set

## Configurations

This extension is configured using a jsonc file. You can open this configuration file using the command `:CocConfig`, and it is typically located at `$HOME/.config/nvim/coc-settings.json`. You can get the configurations list from the [package.json](https://github.com/wgsl-analyzer/coc-wgsl-analyzer/blob/main/package.json#L72) file of this extension.

## Commands

You can use these commands by `:CocCommand XYZ`.

| Command | Description |
| -- | -- |
| wgsl-analyzer.analyzerStatus | Show wgsl-analyzer status |
| wgsl-analyzer.debug | List available runnables of current file and debug the selected one |
| wgsl-analyzer.explainError | Explain the currently hovered error message |
| wgsl-analyzer.joinLines | Join lines |
| wgsl-analyzer.matchingBrace | Find matching brace |
| wgsl-analyzer.memoryUsage | Memory Usage (Clears Database) |
| wgsl-analyzer.moveItemUp | Move item up |
| wgsl-analyzer.moveItemDown | Move item down |
| wgsl-analyzer.openDocs | Open docs under cursor |
| wgsl-analyzer.parentModule | Locate parent module |
| wgsl-analyzer.reload | Restart wgsl-analyzer server |
| wgsl-analyzer.reloadWorkspace | Reload workspace |
| wgsl-analyzer.run | List available runnables of current file and run the selected one |
| wgsl-analyzer.serverVersion | Show current wgsl-analyzer server version |
| wgsl-analyzer.ssr | Structural Search Replace |
| wgsl-analyzer.viewSyntaxTree | Show syntax tree |
| wgsl-analyzer.testCurrent | Test Current |
| wgsl-analyzer.install | Install latest `wgsl-analyzer` from [GitHub release](https://github.com/wgsl-analyzer/wgsl-analyzer/releases) |
| wgsl-analyzer.upgrade | Download latest `wgsl-analyzer` from [GitHub release](https://github.com/wgsl-analyzer/wgsl-analyzer/releases) |
| wgsl-analyzer.viewFileText | View File Text |
| wgsl-analyzer.viewPackageGraph | View Package Graph |
| wgsl-analyzer.viewFullPackageGraph | View Package Graph (Full) |
| wgsl-analyzer.shufflePackageGraph | Shuffle Package Graph |
| wgsl-analyzer.runFlycheck | Run flycheck |
| wgsl-analyzer.cancelFlycheck | Cancel running flychecks |
| wgsl-analyzer.clearFlycheck | Clear flycheck diagnostics |
| wgsl-analyzer.interpretFunction | Interpret Function |

## License

`coc-wgsl-analyzer` is primarily distributed under the terms of both the MIT
license and the Apache License (Version 2.0).

See [LICENSE-APACHE](/LICENSE-APACHE) and [LICENSE-MIT](/LICENSE-MIT) for details.

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
