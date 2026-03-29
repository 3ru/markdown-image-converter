declare module "katex" {
	export interface KatexRenderOptions {
		displayMode?: boolean;
		macros?: Record<string, string>;
		strict?: boolean | "ignore" | "warn" | "error";
		throwOnError?: boolean;
	}

	interface KatexApi {
		renderToString(expression: string, options?: KatexRenderOptions): string;
	}

	const katex: KatexApi;
	export default katex;
}
