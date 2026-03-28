import { executablePath as puppeteerExecutablePath } from "puppeteer";
import * as puppeteer from "puppeteer-core";
import * as vscode from "vscode";
import markdownToHtml from "zenn-markdown-html";
import {
	ConversionContext,
	ConversionOptions,
	MarkdownSection,
	Resolution,
} from "../types";
import { HtmlImageAssetInliner } from "./HtmlImageAssetInliner";

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
	private static browser: puppeteer.Browser | null = null;
	private static browserLaunchPromise: Promise<puppeteer.Browser> | null = null;

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
	 * @param context - Document context used for resolving local assets
	 * @returns A Promise resolving to the image buffer
	 */
	public async convertToImage(
		section: MarkdownSection,
		options: ConversionOptions,
		context: ConversionContext = {},
	): Promise<Uint8Array> {
		const htmlContent = await this.renderContent(section.content, context);
		const html = this.generateDocument(htmlContent, this.getMargin());
		return this.captureImage(html, options);
	}

	/**
	 * Renders Markdown to HTML and inlines local image assets as data URLs.
	 */
	private async renderContent(
		markdown: string,
		context: ConversionContext,
	): Promise<string> {
		const htmlContent = markdownToHtml(markdown);
		const assetInliner = new HtmlImageAssetInliner(context.sourceFilePath);
		return assetInliner.inline(htmlContent);
	}

	private getMargin(): number {
		const config = vscode.workspace.getConfiguration(
			"markdown-image-converter",
		);
		const configuredMargin = config.get<number>("margin", 12);

		if (!Number.isFinite(configuredMargin)) {
			return 12;
		}

		return Math.max(0, configuredMargin);
	}

	/**
	 * Generates the full HTML document used for screenshot rendering.
	 * @param content - The rendered HTML fragment
	 * @param margin - The margin around the rendered content in pixels
	 * @returns HTML string with applied styles
	 */
	private generateDocument(content: string, margin: number): string {
		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>${this.defaultStyles}</style>
          <style>
            body {
              margin: 0;
            }
            .render-frame {
              display: inline-block;
              padding: ${margin}px;
            }
            /* Additional styles for images */
            .znc img {
              max-width: 100%;
              height: auto;
              display: block;
              margin: 1em 0;
            }
          </style>
        </head>
        <body>
          <div class="render-frame">
            <div class="znc">${content}</div>
          </div>
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
		const browser = await this.getBrowser();
		const page = await browser.newPage();

		try {
			await page.setViewport({
				width: 1200,
				height: 800,
				deviceScaleFactor: this.getScaleFactor(options.resolution),
			});

			await page.setContent(html, { waitUntil: "domcontentloaded" });
			await page.waitForSelector(".render-frame");
			await page.evaluate(async () => {
				await document.fonts.ready;
			});
			await this.ensureImagesLoaded(page);

			const element = await page.$(".render-frame");
			if (!element) {
				throw new Error("Failed to find content element");
			}

			const buffer = await element.screenshot({
				type: options.format,
				quality: options.format === "jpeg" ? 90 : undefined,
				omitBackground: false,
			});

			return buffer as Uint8Array;
		} finally {
			await page.close();
		}
	}

	private async getBrowser(): Promise<puppeteer.Browser> {
		if (ImageConverter.browser) {
			return ImageConverter.browser;
		}

		if (!ImageConverter.browserLaunchPromise) {
			ImageConverter.browserLaunchPromise = this.launchBrowser();
		}

		try {
			const browser = await ImageConverter.browserLaunchPromise;
			ImageConverter.browser = browser;
			ImageConverter.browserLaunchPromise = null;
			return browser;
		} catch (error) {
			ImageConverter.browserLaunchPromise = null;
			throw error;
		}
	}

	private async launchBrowser(): Promise<puppeteer.Browser> {
		const config = vscode.workspace.getConfiguration(
			"markdown-image-converter",
		);
		const executablePath =
			config.get<string>("executablePath") || puppeteerExecutablePath();

		const browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
			executablePath,
		});

		browser.once("disconnected", () => {
			if (ImageConverter.browser === browser) {
				ImageConverter.browser = null;
			}
			ImageConverter.browserLaunchPromise = null;
		});

		return browser;
	}

	private async ensureImagesLoaded(page: puppeteer.Page): Promise<void> {
		const selector = ".znc img";

		try {
			await page.waitForFunction(
				(currentSelector) => {
					return Array.from(document.querySelectorAll(currentSelector)).every(
						(image) => {
							const imageElement = image as HTMLImageElement;
							return imageElement.complete;
						},
					);
				},
				{ timeout: 15000 },
				selector,
			);
		} catch {
			const pendingImages = await page.evaluate((currentSelector) => {
				return Array.from(document.querySelectorAll(currentSelector))
					.filter((image) => {
						const imageElement = image as HTMLImageElement;
						return !imageElement.complete;
					})
					.map(
						(image) =>
							(image as HTMLImageElement).currentSrc ||
							image.getAttribute("src") ||
							"<unknown>",
					);
			}, selector);

			throw new Error(
				`Timed out while loading images: ${pendingImages.join(", ")}`,
			);
		}

		const failedImages = await page.evaluate((currentSelector) => {
			return Array.from(document.querySelectorAll(currentSelector))
				.filter((image) => {
					const imageElement = image as HTMLImageElement;
					return imageElement.complete && imageElement.naturalWidth === 0;
				})
				.map(
					(image) =>
						(image as HTMLImageElement).currentSrc ||
						image.getAttribute("src") ||
						"<unknown>",
				);
		}, selector);

		if (failedImages.length > 0) {
			throw new Error(`Failed to load images: ${failedImages.join(", ")}`);
		}
	}

	/**
	 * Cleans up resources when the extension is deactivated
	 */
	public static async cleanup(): Promise<void> {
		const activeBrowser = ImageConverter.browser;
		const launchPromise = ImageConverter.browserLaunchPromise;
		ImageConverter.browser = null;
		ImageConverter.browserLaunchPromise = null;

		const browser =
			activeBrowser ??
			(launchPromise ? await launchPromise.catch(() => null) : null);

		if (!browser) {
			return;
		}

		await browser.close();
	}
}
