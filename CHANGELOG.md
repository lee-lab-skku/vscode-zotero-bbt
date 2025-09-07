# Change Log

## [Unreleased]

## [1.0.2] - 2025-09-06

- Fixed issue where `proceedingsTitle` was not correctly converted to `booktitle` in BibTeX entries for `inproceedings` item types (issue #3; thanks to @crazyn2).
- Improved handling of `.bib` file paths for formats other than `quarto` or `latex`. Now, the default behavior is to search for any `.bib` file in the workspace root (issue #4; thanks to @daniel-ge).

## [1.0.1] - 2025-08-10

- Fixed issues where the extension would not run on Windows and Linux.

## [1.0.0] - 2025-07-16

- Initial release