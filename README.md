# VSCode Zotero w/ Better BibTeX

*Customized for lab members*: An extension to insert reference from Zotero library and add them to a bib file.

## Requirements

- **Zotero**
- **Better BibTeX plugin**
- **Running Zotero**

## Installation

1. Go to the [Releases](https://github.com/lee-lab-skku/vscode-zotero-bbt/releases) page
2. Download the latest `.vsix` file from the release assets
3. In VSCode, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
4. Run the command "Extensions: Install from VSIX..."
5. Select the downloaded `.vsix` file
6. Restart VSCode if prompted

## Features

### Insert citation

(macOS: `ctrl` + `cmd` + `r`, Windows/Linux: `ctrl` + `alt` + `r`).

Items in local Zotero database with Better BibTeX citation keys will be shown in Quick Picks.

When you select an item, the extension will:

1. Attempt to fetch the bibliography entry from Better BibTeX's web API
2. If successful, insert the citation into your `.tex` file, add the properly formatted entry to your `.bib` file.
3. If the web fetch fails, do not insert the citation.

The extension searches for `*.bib` files in the following order:

1. `*.bib` file in `latex` file header
2. `bibliography.bib` or `references.bib` file in the workspace root directory
3. Any `*.bib` file in the workspace root directory.
4. If none of above is available, ask user to provide path, or create a new one.

### Open Zotero item of citation entry under cursor

(macOS: `ctrl` + `cmd` + `o`, Windows/Linux: `ctrl` + `alt` + `o`).

For any citation inserted using this extension, you can open the selection link in Zotero.

## Extension Settings

- `zotero.zoteroDbPath`: Path to Zotero database file (default: `~/Zotero/zotero.sqlite`).
- `zotero.betterBibtexDbPath`: Path to Better BibTex database file (default: `~/Zotero/better-bibtex.sqlite`).
- `zotero.betterBibtexTranslator`: Better BibTeX translator to use for exporting entries (default: `Better BibLaTeX`).
- `zotero.serverUrl`: URL of the Better BibTeX server (default: `http://localhost:23119`); could be useful if you run Better BibTeX server on a different port or inside a container.

## Credits

This extension is a fork of [vscode-zotero](https://github.com/jinvim/vscode-zotero) by jinvim, which itself began as a fork of [telescope-zotero.nvim](https://github.com/jmbuhr/telescope-zotero.nvim) by jmbuhr.
