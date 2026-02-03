# Change Log

## [Unreleased]

## [1.2.2] - 2026-02-03

- Fixed bug where opening item without PDF / DOI would cause an error.


## [1.2.1] - 2026-01-31

- Better error handling when searching zotero library by citation key.
- Reverted dependency version of `@types/vscode` to `^1.106.0` to maintain compatibility with Positron.


## [1.2.0] - 2026-01-31

### Breaking changes

- Removed `zotero.serverUrl` configuration option (in favor of using WSL in mirrored networking mode; see #9).

### New features

- Added support for opening items/pdfs in group libraries (issue #14).
- If there are multiple items with the same `citeKey`, user will be prompted to select the desired item from a list.

### Bug fixes
- Fix handling of citation keys with hyphens (issue #14).

## [1.1.5] - 2026-01-26

- Temporary fix for appending citations to existing citation lists for `*.tex` files (issue #13).
  - Only the `citekey` will be inserted at the cursor position.
  - Full support for this feature is planned for a future release.
- Updated dependency versions.

## [1.1.4] - 2026-01-09

- Security update for dependencies.

## [1.1.3] - 2025-11-11

- Fixed handling of `*.bib` file paths in `_quarto.yml` files (issue #10).
  - When there are multiple `*.bib` files specified in `_quarto.yml`, only the first one is used (for now).
- If no workspace is open, resolve `*.bib` path relative to the folder of the active editor.

## [1.1.2] - 2025-09-25

- Added option to set a custom url for the Better BibTeX server in the extension settings (issue #9).

## [1.1.1] - 2025-09-24

- Fixed issue where `libraryID` is not correctly handled when communicating with Better BibTeX (issue #7; PR #8; thanks to @mirinae3145).

## [1.1.0] - 2025-09-24

### Breaking changes
- This plugin now requires Zotero running to add Bib(La)Tex entries. If the connection to Better BibTeX fails, an error message will be displayed.

### New features
- Added feature to choose between BibTeX and BibLaTeX formats when adding citations. Users can set their preference in the extension settings (issue #2; PR #5; thanks to @mirinae3145).
- In addition, exported Bib(La)Tex entries now respect the user's preference for ignoring certain keys as set in Better BibTeX settings (issue #2).
- Improved performance by optimizing Zotero database access (up to 2x faster).

## [1.0.2] - 2025-09-06

- Fixed issue where `proceedingsTitle` was not correctly converted to `booktitle` in BibTeX entries for `inproceedings` item types (issue #3; thanks to @crazyn2).
- Improved handling of `.bib` file paths for formats other than `quarto` or `latex`. Now, the default behavior is to search for any `.bib` file in the workspace root (issue #4; thanks to @daniel-ge).

## [1.0.1] - 2025-08-10

- Fixed issues where the extension would not run on Windows and Linux.

## [1.0.0] - 2025-07-16

- Initial release