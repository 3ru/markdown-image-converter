import * as assert from "assert";
import markdownToHtml from "zenn-markdown-html";
import { KatexRenderer } from "../../../core/KatexRenderer";

suite("KatexRenderer", () => {
	let renderer: KatexRenderer;

	setup(() => {
		renderer = new KatexRenderer();
	});

	test("should replace inline embed-katex contents with static KaTeX HTML", async () => {
		const sourceHtml = await Promise.resolve(
			markdownToHtml("Inline: $E=mc^2$"),
		);
		const renderedHtml = renderer.render(sourceHtml);

		assert.match(renderedHtml, /<embed-katex>/);
		assert.match(renderedHtml, /class="katex"/);
		assert.match(renderedHtml, /class="katex-mathml"/);
	});

	test("should replace display math nodes with katex-display markup", async () => {
		const sourceHtml = await Promise.resolve(
			markdownToHtml("$$\n\\\\sum_{i=1}^{n} x_i\n$$"),
		);
		const renderedHtml = renderer.render(sourceHtml);

		assert.match(renderedHtml, /<embed-katex display-mode="1">/);
		assert.match(renderedHtml, /class="katex-display"/);
	});

	test("should inline local KaTeX font assets into the stylesheet", async () => {
		const styles = await renderer.getStyles();

		assert.match(styles, /data:font\/woff2;base64,/);
		assert.doesNotMatch(styles, /url\(fonts\//);
	});
});
