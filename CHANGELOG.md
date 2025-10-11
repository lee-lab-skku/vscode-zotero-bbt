# Change Log

## [Unreleased]

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