import type { Page } from "puppeteer-core";
import type { ConversionContext } from "../types";
import type { AssetResolver } from "./AssetResolver";

export interface RenderPipelineContext {
	assetResolver: AssetResolver;
	conversion: ConversionContext;
}

export interface RenderPass {
	readonly name: string;
	getStyles?(context: RenderPipelineContext): Promise<string> | string;
	preparePage?(page: Page, context: RenderPipelineContext): Promise<void>;
	transformHtml?(
		html: string,
		context: RenderPipelineContext,
	): Promise<string> | string;
}
