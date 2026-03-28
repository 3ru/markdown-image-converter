# Markdown Image Converter

Convert your markdown files to PNG/JPEG images directly in VS Code. Perfect for creating social media posts, documentation screenshots, or visual content from your markdown files.

![Default conversion demo](images/demo.gif)

## ✨ Features

- 🖼️ **One-Click Conversion**: Convert any markdown file to PNG/JPEG with a single command
- 📱 **Multiple Output Formats**: Support for PNG and JPEG formats with customizable quality settings
- 🎨 **Zenn-style Formatting**: Beautiful output using Zenn's markdown styling
- 📏 **Resolution Options**: Choose between standard and HD quality outputs
- ⚡ **Split Mode**: Split and convert markdown sections using customizable delimiters (e.g., `---`)
- 🎯 **Flexible Output**: Customizable output directory and file naming

## 📦 Installation

1. Open VS Code
2. Press `Ctrl+P` / `Cmd+P`
3. Type `ext install ryuya.markdown-image-converter`
4. Press Enter

## 🚀 Quick Start

1. Open any markdown file
2. Use the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type "Convert to Image"
3. Choose your desired output format (PNG/JPEG)
4. The image will be generated based on your settings

## 📝 Usage
### Split Mode Demo
Split your markdown into multiple images using custom delimiters:

![Split mode demo](images/split.gif)

## ⚙️ Extension Settings

This extension contributes the following settings:

| Setting                                    | Type     | Default               | Description                                                            |
| ------------------------------------------ | -------- | --------------------- | ---------------------------------------------------------------------- |
| `markdown-image-converter.outputFormat`    | `string` | `"png"`               | Default output format (`"png"` or `"jpeg"`)                            |
| `markdown-image-converter.resolution`      | `string` | `"hd"`                | Output resolution (`"standard"` or `"hd"`)                             |
| `markdown-image-converter.splitter`        | `string` | `""`                  | Delimiter to split markdown sections (e.g., `"---"`)                   |
| `markdown-image-converter.splitOutputDir`  | `string` | `"{name}-{format}"`   | Output directory pattern for split images                              |
| `markdown-image-converter.margin`          | `number` | `12`                  | Margin around the edges of the exported image, in pixels               |
| `markdown-image-converter.executablePath`  | `string` | `""`                  | Chrome or Chromium executable path to use for rendering                |

## ⌨️ Commands

| Command                               | Description     |
| ------------------------------------- | --------------- |
| `markdown-image-converter.exportPNG`  | Convert to PNG  |
| `markdown-image-converter.exportJPEG` | Convert to JPEG |

## 🔍 Known Issues @ Roadmap

- Large markdown files may take longer to convert
- Katex, mermaid, other embeded elements rendering is under development


## 📚 Resources

- [Zenn Markdown Guide](https://zenn.dev/zenn/articles/markdown-guide)
- [Zenn Content CSS](https://github.com/zenn-dev/zenn-editor/tree/canary/packages/zenn-content-css)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**🌟 Enjoying the extension? [Rate it on the marketplace](https://marketplace.visualstudio.com/items?itemName=ryuya.markdown-image-converter)!**

Found a bug? Please [open an issue](https://github.com/3ru/markdown-image-converter/issues).

Made with ❤️ by [Ryuya](https://github.com/3ru)
