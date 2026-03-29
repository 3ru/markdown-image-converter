import * as fs from "fs";
import * as path from "path";
import type { Page } from "puppeteer-core";
import type { RenderPass, RenderPipelineContext } from "./renderPipeline";

const MERMAID_CONTAINER_CLASS = "mic-mermaid";
const MERMAID_STYLES = `
  .znc .${MERMAID_CONTAINER_CLASS} {
    display: block;
    width: 100%;
    margin: 1.5rem auto;
    overflow-x: auto;
  }

  .znc .${MERMAID_CONTAINER_CLASS} svg {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0 auto;
  }
`;

interface MermaidRenderSummary {
	count: number;
	errors: string[];
}

/**
 * Renders Mermaid diagrams locally in the page so exports do not depend on
 * Zenn's remote embed server or arbitrary sleep-based waits.
 */
export class MermaidRenderer implements RenderPass {
	private static runtimeScriptPromise: Promise<string> | null = null;
	public readonly name = "mermaid";

	public createEmbed(source: string): string {
		return `<span class="embed-block zenn-embedded zenn-embedded-mermaid ${MERMAID_CONTAINER_CLASS}">${this.escapeHtml(
			source.trim(),
		)}</span>`;
	}

	public getStyles(_context?: RenderPipelineContext): string {
		return MERMAID_STYLES;
	}

	public async preparePage(
		page: Page,
		_context: RenderPipelineContext,
	): Promise<void> {
		await this.render(page);
	}

	public async render(page: Page): Promise<void> {
		const hasMermaid = await page.$(`.${MERMAID_CONTAINER_CLASS}`);
		if (!hasMermaid) {
			return;
		}

		await this.injectRuntime(page);

		const summary = await page.evaluate(
			async (containerClass): Promise<MermaidRenderSummary> => {
				const mermaidApi = (window as typeof window & { mermaid?: any })
					.mermaid;
				if (!mermaidApi) {
					throw new Error("Mermaid runtime failed to load");
				}

				mermaidApi.initialize({
					startOnLoad: false,
					securityLevel: "strict",
				});

				const containers = Array.from(
					document.querySelectorAll<HTMLElement>(`.${containerClass}`),
				);
				const errors: string[] = [];

				for (const [index, container] of containers.entries()) {
					const source = container.textContent?.trim() ?? "";
					if (!source) {
						errors.push(`Diagram ${index + 1} is empty`);
						continue;
					}

					container.dataset.renderState = "rendering";

					try {
						const { svg, bindFunctions } = await mermaidApi.render(
							`mic-mermaid-${index}`,
							source,
						);

						container.innerHTML = svg;
						if (typeof bindFunctions === "function") {
							bindFunctions(container);
						}
						container.dataset.renderState = "ready";
					} catch (error) {
						container.dataset.renderState = "error";
						errors.push(error instanceof Error ? error.message : String(error));
					}
				}

				return {
					count: containers.length,
					errors,
				};
			},
			MERMAID_CONTAINER_CLASS,
		);

		if (summary.errors.length > 0) {
			throw new Error(
				`Failed to render Mermaid diagrams: ${summary.errors.join("; ")}`,
			);
		}
	}

	private async injectRuntime(page: Page): Promise<void> {
		const hasRuntime = await page.evaluate(
			() =>
				typeof (window as typeof window & { mermaid?: unknown }).mermaid !==
				"undefined",
		);
		if (hasRuntime) {
			return;
		}

		await page.addScriptTag({
			content: await this.getRuntimeScript(),
		});

		const didLoad = await page.evaluate(
			() =>
				typeof (window as typeof window & { mermaid?: unknown }).mermaid ===
				"object",
		);
		if (!didLoad) {
			throw new Error("Failed to inject Mermaid runtime");
		}
	}

	private async getRuntimeScript(): Promise<string> {
		if (!MermaidRenderer.runtimeScriptPromise) {
			MermaidRenderer.runtimeScriptPromise = this.buildRuntimeScript();
		}

		return MermaidRenderer.runtimeScriptPromise;
	}

	private async buildRuntimeScript(): Promise<string> {
		const runtimePath = this.resolveRuntimePath();
		return fs.promises.readFile(runtimePath, "utf8");
	}

	private resolveRuntimePath(): string {
		return path.join(
			path.dirname(require.resolve("mermaid/package.json")),
			"dist",
			"mermaid.min.js",
		);
	}

	private escapeHtml(value: string): string {
		return value
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#39;");
	}
}
