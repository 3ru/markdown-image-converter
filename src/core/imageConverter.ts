import * as puppeteer from "puppeteer-core";
import * as vscode from "vscode";
import markdownToHtml from "zenn-markdown-html";
import {
	ConversionContext,
	ConversionOptions,
	MarkdownSection,
	Resolution,
} from "../types";
import { AssetResolver } from "./AssetResolver";
import { HtmlImageAssetInliner } from "./HtmlImageAssetInliner";
import { KatexRenderer } from "./KatexRenderer";
import { MermaidRenderer } from "./MermaidRenderer";
import { resolveBrowserExecutablePath } from "./browserExecutable";
import type { RenderPass, RenderPipelineContext } from "./renderPipeline";

// Import CSS with a try-catch block to handle test environment
let zennCss = "";
try {
	zennCss = require("zenn-content-css/lib/index.css");
} catch (error) {
	// Fallback minimal styles for test environment
	zennCss = `.znc{display:block;min-height:10px}`;
}

/**
 * Handles browser lifecycle and session creation for markdown-to-image exports.
 * Rendering work is delegated to request-scoped sessions so large split exports
 * can reuse caches and page resources without coupling every syntax to this class.
 */
export class ImageConverter {
	private static browser: puppeteer.Browser | null = null;
	private static browserLaunchPromise: Promise<puppeteer.Browser> | null = null;

	/**
	 * Default styles loaded from Zenn's CSS or fallback styles.
	 * TODO: Make styles customizable through user configuration
	 */
	private readonly defaultStyles = zennCss;

	public createSession(
		context: ConversionContext = {},
	): ImageConversionSession {
		return new ImageConversionSession(this, context);
	}

	/**
	 * Convenience API for one-off conversions.
	 * Multi-section exports should prefer a shared session so assets and pages can
	 * be reused within the same export request.
	 */
	public async convertToImage(
		section: MarkdownSection,
		options: ConversionOptions,
		context: ConversionContext = {},
	): Promise<Uint8Array> {
		const session = this.createSession(context);

		try {
			return await session.convertSection(section, options);
		} finally {
			await session.dispose();
		}
	}

	/**
	 * Determines the image scale factor based on the requested resolution.
	 * Higher scale factors result in sharper images but larger file sizes.
	 */
	public getScaleFactor(resolution?: Resolution): number {
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

	public getMargin(): number {
		const config = vscode.workspace.getConfiguration(
			"markdown-image-converter",
		);
		const configuredMargin = config.get<number>("margin", 12);

		if (!Number.isFinite(configuredMargin)) {
			return 12;
		}

		return Math.max(0, configuredMargin);
	}

	public buildDocument(
		content: string,
		passStyles: string[],
		margin: number,
	): string {
		const embeddedStyles = [
			this.defaultStyles,
			...passStyles.filter((style) => style.trim().length > 0),
		]
			.map((style) => `<style>${style}</style>`)
			.join("\n");

		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          ${embeddedStyles}
          <style>
            body {
              margin: 0;
            }
            .render-frame {
              display: inline-block;
              padding: ${margin}px;
            }
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

	public async createPage(): Promise<puppeteer.Page> {
		const browser = await this.getBrowser();
		return browser.newPage();
	}

	public async ensureImagesLoaded(page: puppeteer.Page): Promise<void> {
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
		const executablePath = resolveBrowserExecutablePath(
			config.get<string>("executablePath"),
		);

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

/**
 * A request-scoped rendering session that shares cached assets and a Puppeteer
 * page across sections within the same export command.
 */
export class ImageConversionSession {
	private readonly assetResolver = new AssetResolver();
	private readonly mermaidRenderer = new MermaidRenderer();
	private readonly renderPasses: RenderPass[] = [
		new HtmlImageAssetInliner(this.assetResolver),
		new KatexRenderer(),
		this.mermaidRenderer,
	];
	private readonly pipelineContext: RenderPipelineContext;
	private pagePromise: Promise<puppeteer.Page> | null = null;

	constructor(
		private readonly converter: ImageConverter,
		conversionContext: ConversionContext = {},
	) {
		this.pipelineContext = {
			assetResolver: this.assetResolver,
			conversion: conversionContext,
		};
	}

	public async convertSection(
		section: MarkdownSection,
		options: ConversionOptions,
	): Promise<Uint8Array> {
		let content = await Promise.resolve(
			markdownToHtml(section.content, {
				embedOrigin: "https://embed.zenn.studio",
				customEmbed: {
					mermaid: (source) => this.mermaidRenderer.createEmbed(source),
				},
			}),
		);

		content = await this.applyHtmlTransforms(content);
		const styles = await this.collectStyles();
		const html = this.converter.buildDocument(
			content,
			styles,
			this.converter.getMargin(),
		);

		return this.captureDocument(html, options);
	}

	public async dispose(): Promise<void> {
		if (!this.pagePromise) {
			return;
		}

		const activePagePromise = this.pagePromise;
		this.pagePromise = null;
		const page = await activePagePromise.catch(() => null);

		if (page && !page.isClosed()) {
			await page.close();
		}
	}

	private async applyHtmlTransforms(html: string): Promise<string> {
		let transformedHtml = html;

		for (const renderPass of this.renderPasses) {
			if (!renderPass.transformHtml) {
				continue;
			}

			transformedHtml = await renderPass.transformHtml(
				transformedHtml,
				this.pipelineContext,
			);
		}

		return transformedHtml;
	}

	private async collectStyles(): Promise<string[]> {
		const styles: string[] = [];

		for (const renderPass of this.renderPasses) {
			if (!renderPass.getStyles) {
				continue;
			}

			const style = await renderPass.getStyles(this.pipelineContext);
			if (style.trim().length > 0) {
				styles.push(style);
			}
		}

		return styles;
	}

	private async captureDocument(
		html: string,
		options: ConversionOptions,
	): Promise<Uint8Array> {
		const page = await this.getPage();

		await page.setViewport({
			width: 1200,
			height: 800,
			deviceScaleFactor: this.converter.getScaleFactor(options.resolution),
		});

		await page.setContent(html, { waitUntil: "domcontentloaded" });
		await page.waitForSelector(".render-frame");

		for (const renderPass of this.renderPasses) {
			if (!renderPass.preparePage) {
				continue;
			}

			await renderPass.preparePage(page, this.pipelineContext);
		}

		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await this.converter.ensureImagesLoaded(page);

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
	}

	private async getPage(): Promise<puppeteer.Page> {
		if (!this.pagePromise) {
			this.pagePromise = this.converter.createPage();
		}

		return this.pagePromise;
	}
}
