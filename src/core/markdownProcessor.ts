import { MarkdownSection } from "../types";

/**
 * Handles markdown content processing and splitting.
 * Provides functionality to split markdown content into sections based on a delimiter.
 */
export class MarkdownProcessor {
	constructor(private readonly content: string) {}

	/**
	 * Splits markdown content into sections based on a delimiter.
	 * If no splitter is provided, returns the entire content as a single section.
	 * @param splitter - The delimiter to split content on
	 * @returns An array of markdown sections
	 */
	public splitContent(splitter?: string): MarkdownSection[] {
		if (!splitter) {
			return [{ content: this.content, index: 0 }];
		}

		return this.content
			.split(`\n${splitter}\n`)
			.map((content, index) => ({
				content: content.trim(),
				index,
			}))
			.filter((section) => section.content.length > 0);
	}

	/**
	 * Validates that markdown content is not empty.
	 * @param content - The markdown content to validate
	 * @returns True if content is valid, false otherwise
	 */
	public static validateContent(content: string): boolean {
		return content.trim().length > 0;
	}
}
