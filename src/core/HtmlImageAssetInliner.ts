import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const EMBEDDED_IMAGE_PROTOCOLS = new Set(["data:", "http:", "https:"]);
const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
	".avif": "image/avif",
	".bmp": "image/bmp",
	".gif": "image/gif",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".png": "image/png",
	".svg": "image/svg+xml",
	".tif": "image/tiff",
	".tiff": "image/tiff",
	".webp": "image/webp",
};

interface HtmlTagMatch {
	end: number;
	start: number;
	text: string;
}

interface HtmlAttributeMatch {
	value: string;
	valueEnd: number;
	valueStart: number;
}

interface TextReplacement {
	end: number;
	start: number;
	value: string;
}

/**
 * Inlines local image assets in generated HTML so rendering stays self-contained.
 * This keeps the screenshot pipeline independent from local HTTP servers and
 * makes local assets deterministic across environments.
 */
export class HtmlImageAssetInliner {
	private readonly assetCache = new Map<string, string>();
	private readonly sourceDirectory?: string;

	constructor(sourceFilePath?: string) {
		this.sourceDirectory = sourceFilePath
			? path.dirname(path.resolve(sourceFilePath))
			: undefined;
	}

	public async inline(html: string): Promise<string> {
		const replacements = await this.collectReplacements(html);
		return this.applyReplacements(html, replacements);
	}

	private async collectReplacements(html: string): Promise<TextReplacement[]> {
		const replacements: TextReplacement[] = [];

		for (const tag of this.findImageTags(html)) {
			const sourceAttribute = this.findAttribute(tag.text, "src");
			if (!sourceAttribute) {
				continue;
			}

			const resolvedSource = await this.resolveSource(sourceAttribute.value);
			if (resolvedSource === sourceAttribute.value) {
				continue;
			}

			replacements.push({
				start: tag.start + sourceAttribute.valueStart,
				end: tag.start + sourceAttribute.valueEnd,
				value: resolvedSource,
			});
		}

		return replacements;
	}

	private applyReplacements(
		html: string,
		replacements: TextReplacement[],
	): string {
		if (replacements.length === 0) {
			return html;
		}

		return replacements
			.sort((left, right) => right.start - left.start)
			.reduce(
				(currentHtml, replacement) =>
					`${currentHtml.slice(0, replacement.start)}${replacement.value}${currentHtml.slice(replacement.end)}`,
				html,
			);
	}

	private findImageTags(html: string): HtmlTagMatch[] {
		const tags: HtmlTagMatch[] = [];
		let cursor = 0;

		while (cursor < html.length) {
			const tagStart = html.indexOf("<", cursor);
			if (tagStart === -1) {
				break;
			}

			if (!this.isImageTagStart(html, tagStart)) {
				cursor = tagStart + 1;
				continue;
			}

			const tagEnd = this.findTagEnd(html, tagStart);
			tags.push({
				start: tagStart,
				end: tagEnd,
				text: html.slice(tagStart, tagEnd + 1),
			});
			cursor = tagEnd + 1;
		}

		return tags;
	}

	private isImageTagStart(html: string, index: number): boolean {
		if (html[index] !== "<") {
			return false;
		}

		if (html.slice(index + 1, index + 4).toLowerCase() !== "img") {
			return false;
		}

		const boundary = html[index + 4];
		return (
			boundary === undefined ||
			boundary === ">" ||
			boundary === "/" ||
			this.isWhitespace(boundary)
		);
	}

	private findTagEnd(html: string, tagStart: number): number {
		let quote: '"' | "'" | null = null;

		for (let index = tagStart + 1; index < html.length; index++) {
			const character = html[index];

			if (quote) {
				if (character === quote) {
					quote = null;
				}
				continue;
			}

			if (character === '"' || character === "'") {
				quote = character;
				continue;
			}

			if (character === ">") {
				return index;
			}
		}

		throw new Error(
			"Encountered an unterminated <img> tag while rewriting HTML",
		);
	}

	private findAttribute(tag: string, name: string): HtmlAttributeMatch | null {
		let cursor = 4;

		while (cursor < tag.length) {
			cursor = this.skipWhitespace(tag, cursor);
			if (cursor >= tag.length || tag[cursor] === ">") {
				break;
			}

			if (tag[cursor] === "/" && tag[cursor + 1] === ">") {
				break;
			}

			const nameStart = cursor;
			while (
				cursor < tag.length &&
				!this.isWhitespace(tag[cursor]) &&
				tag[cursor] !== "=" &&
				tag[cursor] !== ">" &&
				tag[cursor] !== "/"
			) {
				cursor++;
			}

			const attributeName = tag.slice(nameStart, cursor);
			cursor = this.skipWhitespace(tag, cursor);

			if (tag[cursor] !== "=") {
				continue;
			}

			cursor++;
			cursor = this.skipWhitespace(tag, cursor);

			if (cursor >= tag.length) {
				break;
			}

			const quote = tag[cursor];
			if (quote === '"' || quote === "'") {
				const valueStart = cursor + 1;
				cursor++;

				while (cursor < tag.length && tag[cursor] !== quote) {
					cursor++;
				}

				const valueEnd = cursor;
				if (attributeName.toLowerCase() === name) {
					return {
						value: tag.slice(valueStart, valueEnd),
						valueStart,
						valueEnd,
					};
				}

				if (cursor < tag.length) {
					cursor++;
				}
				continue;
			}

			const valueStart = cursor;
			while (
				cursor < tag.length &&
				!this.isWhitespace(tag[cursor]) &&
				tag[cursor] !== ">"
			) {
				cursor++;
			}

			const valueEnd = cursor;
			if (attributeName.toLowerCase() === name) {
				return {
					value: tag.slice(valueStart, valueEnd),
					valueStart,
					valueEnd,
				};
			}
		}

		return null;
	}

	private skipWhitespace(value: string, cursor: number): number {
		let nextCursor = cursor;
		while (nextCursor < value.length && this.isWhitespace(value[nextCursor])) {
			nextCursor++;
		}
		return nextCursor;
	}

	private isWhitespace(character: string): boolean {
		return /\s/.test(character);
	}

	private async resolveSource(source: string): Promise<string> {
		if (WINDOWS_ABSOLUTE_PATH.test(source)) {
			return this.readFileAsDataUrl(source);
		}

		if (source.startsWith("//")) {
			return source;
		}

		try {
			const url = new URL(source);
			if (EMBEDDED_IMAGE_PROTOCOLS.has(url.protocol)) {
				return source;
			}

			if (url.protocol === "file:") {
				return this.readFileAsDataUrl(fileURLToPath(url));
			}

			throw new Error(
				`Unsupported image URL protocol "${url.protocol}" in "${source}"`,
			);
		} catch (error) {
			if (!(error instanceof TypeError)) {
				throw error;
			}
		}

		if (!this.sourceDirectory) {
			throw new Error(
				`Cannot resolve local image path "${source}" without a source file path`,
			);
		}

		const pathname = this.decodePathname(this.stripQueryAndHash(source));
		const absolutePath = path.isAbsolute(pathname)
			? pathname
			: path.resolve(this.sourceDirectory, pathname);
		return this.readFileAsDataUrl(absolutePath);
	}

	private stripQueryAndHash(source: string): string {
		const hashIndex = source.indexOf("#");
		const queryIndex = source.indexOf("?");
		const cutoffCandidates = [hashIndex, queryIndex].filter(
			(index) => index >= 0,
		);

		if (cutoffCandidates.length === 0) {
			return source;
		}

		return source.slice(0, Math.min(...cutoffCandidates));
	}

	private decodePathname(pathname: string): string {
		try {
			return decodeURIComponent(pathname);
		} catch {
			return pathname;
		}
	}

	private async readFileAsDataUrl(filePath: string): Promise<string> {
		const normalizedPath = path.normalize(path.resolve(filePath));
		const cachedAsset = this.assetCache.get(normalizedPath);
		if (cachedAsset) {
			return cachedAsset;
		}

		let fileContents: Buffer;
		try {
			fileContents = await fs.promises.readFile(normalizedPath);
		} catch (error) {
			throw new Error(
				`Image asset could not be read from "${normalizedPath}": ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}

		const mimeType = this.getMimeType(normalizedPath);
		const dataUrl = `data:${mimeType};base64,${fileContents.toString("base64")}`;
		this.assetCache.set(normalizedPath, dataUrl);
		return dataUrl;
	}

	private getMimeType(filePath: string): string {
		const extension = path.extname(filePath).toLowerCase();
		return MIME_TYPES_BY_EXTENSION[extension] ?? "application/octet-stream";
	}
}
