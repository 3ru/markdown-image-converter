import * as fs from "fs";
import * as puppeteer from "puppeteer";
import markdownToHtml from "zenn-markdown-html";
import { ConversionOptions, MarkdownSection, Resolution } from "../types";

// Import CSS with a try-catch block to handle test environment
let zennCss = "";
try {
	zennCss = require("zenn-content-css/lib/index.css");
} catch (error) {
	// Fallback minimal styles for test environment
	zennCss = `.znc{display:block;min-height:10px}`;
}

/**
 * Handles the conversion of markdown content to images using Puppeteer.
 * Uses Zenn's markdown styling for consistent and beautiful output.
 */
export class ImageConverter {
	/**
	 * Default styles loaded from Zenn's CSS or fallback styles.
	 * TODO: Make styles customizable through user configuration
	 */
	private readonly defaultStyles = zennCss;

	/**
	 * Determines the image scale factor based on the requested resolution.
	 * Higher scale factors result in sharper images but larger file sizes.
	 * @param resolution - The desired output resolution
	 * @returns The scale factor to be used for image generation
	 */
	private getScaleFactor(resolution?: Resolution): number {
		switch (resolution) {
			case "standard":
				return 1;
			case "hd":
				return 2;
			//   case "4k":
			//     return 3;
			//   case "ultrahd":
			//     return 4;
			default:
				return 2; // default is HD
		}
	}

	/**
	 * Converts a markdown section to an image buffer.
	 * @param section - The markdown section to convert
	 * @param options - Conversion options including format and resolution
	 * @returns A Promise resolving to the image buffer
	 */
	public async convertToImage(
		section: MarkdownSection,
		options: ConversionOptions,
	): Promise<Uint8Array> {
		const html = this.generateHtml(section.content);
		return this.captureImage(html, options);
	}

	/**
	 * Generates HTML from markdown content with Zenn styling.
	 * @param markdown - The markdown content to convert
	 * @returns HTML string with applied styles
	 */
	private generateHtml(markdown: string): string {
		const content = markdownToHtml(markdown);
		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>${this.defaultStyles}</style>
        </head>
        <body>
          <div class="znc">${content}</div>
        </body>
      </html>
    `;
	}

	/**
	 * Captures the rendered HTML as an image using Puppeteer.
	 * @param html - The HTML content to capture
	 * @param options - Image capture options
	 * @returns A Promise resolving to the image buffer
	 */
	private async captureImage(
		html: string,
		options: ConversionOptions,
	): Promise<Uint8Array> {
		const browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
		const page = await browser.newPage();

		await page.setViewport({
			width: 1200,
			height: 800,
			deviceScaleFactor: this.getScaleFactor(options.resolution),
		});

		await page.setContent(html);
		await page.waitForSelector(".znc");

		const element = await page.$(".znc");
		if (!element) {
			throw new Error("Failed to find content element");
		}

		const buffer = await element.screenshot({
			type: options.format,
			quality: options.format === "jpeg" ? 90 : undefined,
			omitBackground: false,
		});

		await browser.close();
		return buffer as Uint8Array;
	}
}
