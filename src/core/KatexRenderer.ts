import * as fs from "fs";
import * as path from "path";
import katex from "katex";
import { parse } from "node-html-parser";

const DEFAULT_KATEX_MACROS = {
	"\\RR": "\\mathbb{R}",
} as const;

const FONT_SOURCE_PATTERN =
	/url\((['"]?)([^'")]+)\1\)\s*format\((['"])([^'"]+)\3\)/g;

interface FontSource {
	format: string;
	path: string;
}

/**
 * Replaces Zenn's embed-katex placeholders with static KaTeX HTML and inlines
 * the KaTeX stylesheet so exported images render deterministically offline.
 */
export class KatexRenderer {
	private static stylesheetPromise: Promise<string> | null = null;

	public render(html: string): string {
		const document = parse(html, {
			comment: true,
		});

		for (const embedElement of document.querySelectorAll("embed-katex")) {
			const expression = embedElement.textContent.trim();
			const displayMode = embedElement.getAttribute("display-mode") === "1";
			const renderedKatex = katex.renderToString(expression, {
				displayMode,
				macros: DEFAULT_KATEX_MACROS,
				strict: false,
				throwOnError: false,
			});

			embedElement.set_content(renderedKatex);
		}

		return document.toString();
	}

	public async getStyles(): Promise<string> {
		if (!KatexRenderer.stylesheetPromise) {
			KatexRenderer.stylesheetPromise = this.buildStylesheet();
		}

		return KatexRenderer.stylesheetPromise;
	}

	private async buildStylesheet(): Promise<string> {
		const katexDistDir = this.resolveKatexDistDirectory();
		const stylesheetPath = path.join(katexDistDir, "katex.min.css");
		const stylesheet = await fs.promises.readFile(stylesheetPath, "utf8");

		return stylesheet.replace(/src:([^;]+);/g, (_match, sourceGroup) => {
			const preferredSource = this.pickPreferredFontSource(sourceGroup);
			if (!preferredSource) {
				return `src:${sourceGroup};`;
			}

			const fontPath = path.join(katexDistDir, preferredSource.path);
			const inlinedFont = this.readFontAsDataUrl(fontPath);
			return `src:url("${inlinedFont}") format("${preferredSource.format}");`;
		});
	}

	private pickPreferredFontSource(sourceGroup: string): FontSource | null {
		const sources = Array.from(sourceGroup.matchAll(FONT_SOURCE_PATTERN)).map(
			(match) => ({
				path: match[2],
				format: match[4],
			}),
		);

		if (sources.length === 0) {
			return null;
		}

		return (
			sources.find((source) => source.format.toLowerCase() === "woff2") ??
			sources[0]
		);
	}

	private readFontAsDataUrl(filePath: string): string {
		const fontBuffer = fs.readFileSync(filePath);
		return `data:${this.getMimeType(filePath)};base64,${fontBuffer.toString("base64")}`;
	}

	private getMimeType(filePath: string): string {
		const extension = path.extname(filePath).toLowerCase();

		switch (extension) {
			case ".woff2":
				return "font/woff2";
			case ".woff":
				return "font/woff";
			case ".ttf":
				return "font/ttf";
			default:
				return "application/octet-stream";
		}
	}

	private resolveKatexDistDirectory(): string {
		const katexEntryPath = require.resolve("katex");
		return path.dirname(katexEntryPath);
	}
}
