# VSCode Zotero

An extension to insert reference from Zotero library and add them to a bib file.

## The problems

Currently available Zotero extensions for VSCode are not useful for inserting citations from Zotero library. They either:

- Rely on Zotero's citation picker, which can be slow and aesthetically inconsistent with VSCode.
- Require you to first export your Zotero library to a Bibtex file, which is not convenient.
- Do not support `quarto` files.
- Has not been updated for a long time.

Also, the official [Quarto extension for VSCode](https://marketplace.visualstudio.com/items?itemName=quarto.quarto) only supports Zotero citations in visual mode.

## Requirements

- **Zotero** - Reference management software
- **Better BibTeX plugin** - For citation key generation and web API access
- **Running Zotero** (recommended) - For web-based bibliography fetching; extension works without it but falls back to local database method

## Features

At the moment, the extension supports `quarto` and `latex` for inserting citation from Zotero library.

### Insert citation (`zotero.searchLibrary`)

(macOS: `ctrl` + `cmd` + `r`, Windows/Linux: `ctrl` + `alt` + `r`).

![Screenshot of inserting citation](https://raw.githubusercontent.com/jinvim/vscode-zotero/refs/heads/main/resources/fig1.gif)

Items in local Zotero database with Better BibTeX citation keys will be shown in Quick Picks.

When you select an item, the extension will:

1. Insert the citation into your document immediately
2. Attempt to fetch the bibliography entry from Better BibTeX's web API
3. If successful, add the properly formatted entry to your `.bib` file
4. If the web fetch fails, fall back to local database extraction

The extension searches for `*.bib` files in the following order:

1. `*.bib` file in `quarto` or `latex` file header (for quarto, this includes `_quarto.yml`)
1. `bibliography.bib` or `references.bib` file in the workspace root directory
1. Any `*.bib` file in the workspace root directory.
1. If none of above is available, ask user to provide path, or create a new one (you still need to add the file to `quarto` or `latex` header).

### Open PDF/Zotero entry/DOI of citation item under cursor (`zotero.openItem`)

(macOS: `ctrl` + `cmd` + `o`, Windows/Linux: `ctrl` + `alt` + `o`).

![Screenshot of opening item](https://raw.githubusercontent.com/jinvim/vscode-zotero/refs/heads/main/resources/fig2.gif)

For any citations that were inserted using this extension, you can:

1. PDF file of the item using Zotero PDF viewer.
1. Open and show the item in Zotero library
1. Open DOI link using the default browser

## How It Works

This extension uses a **hybrid workflow** that combines web-based bibliography fetching with local database fallback for optimal performance and reliability.

### Bibliography Update Workflow

When you select a citation to insert:

1. **Citation Insertion**: The citation (e.g., `@smith2023`) is immediately inserted into your document.

2. **Web-First Approach**: The extension attempts to fetch the bibliography entry from Better BibTeX's web API:
   - **Personal Library**: `http://127.0.0.1:23119/better-bibtex/export?/library;id:1/My%20Library.biblatex`
   - **Group Libraries**: `http://127.0.0.1:23119/better-bibtex/export?/group;id:{groupID}/{groupName}.biblatex`

3. **Entry Extraction**: The extension parses the BibLaTeX file and extracts the specific entry for your citation key.

4. **Bibliography Update**: The extracted entry is added to your project's `.bib` file with proper formatting and empty line separation.

5. **Fallback Protection**: If the web approach fails (e.g., Zotero not running), the extension automatically falls back to the original local SQLite database method.

### Advantages of This Approach

- **Always Up-to-Date**: Bibliography entries are fetched directly from Better BibTeX, ensuring the latest formatting and metadata.
- **Group Support**: Works seamlessly with Zotero group libraries through the web API.
- **Proper Formatting**: Uses Better BibTeX's native formatting instead of manual conversion from Zotero's database.
- **Reliable Fallback**: If the web service is unavailable, the extension gracefully falls back to local database extraction.
- **No Manual Export**: No need to manually export or sync bibliography files.

### User Feedback

The extension provides clear feedback about which method was used:

- **Web Success**: `"Added @citekey from web source to bibliography.bib"`
- **Local Fallback**: `"Web fetch failed: [reason]. Using local database."` followed by `"Added @citekey from local database to bibliography.bib"`

## Extension Settings

- `zotero.zoteroDbPath`: Path to Zotero database file (default: `~/Zotero/zotero.sqlite`).
- `zotero.betterBibtexDbPath`: Path to Better BibTex database file (default: `~/Zotero/better-bibtex.sqlite`).
- `zotero.betterBibtexTranslator`: Better BibTeX translator to use for exporting entries (default: `Better BibLaTeX`).

## Release Notes

See [CHANGELOG.md](CHANGELOG.md)

## Notes

This extension began as a fork of [telescope-zotero.nvim](https://github.com/jmbuhr/telescope-zotero.nvim), which is an excellent Zotero extension using Neovim to edit `quarto` documents. The only reason kept me from migrating to VSCode for editing `quarto` documents was the lack of a good Zotero extension.

The code is heavily inspired by it, but rewritten in TypeScript for VSCode. I do not speak TypeScript, so I drafted the code using Claude and manually fixed the code to make it work. Hence, if you think I did something wrong, you're probably right.

Has not been tested on Windows or linux. If you find any issues, please let me know.

I'm working on this project as a PhD student in my spare time (which is very, very limited, during the semester). So I apologize in advance if I cannot respond to issues or feature requests in a timely manner.
