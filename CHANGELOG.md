# Change Log

All notable changes to the "markdown-image-converter" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-02-09

### Added
- Initial release of the Markdown Image Converter extension
- Core functionality to convert markdown files to PNG/JPEG images
- Support for splitting markdown into multiple images using custom delimiters
- High-quality image output with Zenn-style markdown rendering
- Progress indicators in both status bar and notifications
- Configurable settings:
  - Image resolution (standard/HD)
  - Output format selection (PNG/JPEG)
  - Custom split delimiter
  - Split output directory pattern (default: {name}-{format})
    - Supports variables: {name}, {format}
    - Custom directory name (e.g., "images", "exports")
- VS Code command palette integration:
  - `Markdown Image Converter: Export (png)`
  - `Markdown Image Converter: Export (jpeg)`

[0.0.1]: https://github.com/3ru/markdown-image-converter/releases/tag/v0.0.1