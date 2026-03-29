import { AssetResolver } from "./AssetResolver";
import type { RenderPass, RenderPipelineContext } from "./renderPipeline";

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
export class HtmlImageAssetInliner implements RenderPass {
	public readonly name = "local-image-assets";

	constructor(private readonly assetResolver = new AssetResolver()) {}

	public async inline(html: string, sourceFilePath?: string): Promise<string> {
		const replacements = await this.collectReplacements(html, sourceFilePath);
		return this.applyReplacements(html, replacements);
	}

	public async transformHtml(
		html: string,
		context: RenderPipelineContext,
	): Promise<string> {
		return this.inline(html, context.conversion.sourceFilePath);
	}

	private async collectReplacements(
		html: string,
		sourceFilePath?: string,
	): Promise<TextReplacement[]> {
		const replacements: TextReplacement[] = [];

		for (const tag of this.findImageTags(html)) {
			const sourceAttribute = this.findAttribute(tag.text, "src");
			if (!sourceAttribute) {
				continue;
			}

			const resolvedSource = await this.assetResolver.resolveImageSource(
				sourceAttribute.value,
				sourceFilePath,
			);
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
}
