import * as assert from "assert";
import * as path from "path";
import { HtmlImageAssetInliner } from "../../../core/HtmlImageAssetInliner";
import {
	cleanupTestWorkspace,
	copyTestFile,
	createTestWorkspace,
} from "../testUtils";

suite("HtmlImageAssetInliner", () => {
	const fixtureImagePath = path.resolve(
		__dirname,
		"../../../../images/icon.png",
	);

	let testDir: string;
	let markdownFilePath: string;

	setup(async () => {
		testDir = await createTestWorkspace();
		await copyTestFile(testDir, fixtureImagePath, "icon.png");
		markdownFilePath = path.join(testDir, "post.md");
	});

	teardown(async () => {
		await cleanupTestWorkspace(testDir);
	});

	test("should inline relative local images as data URLs", async () => {
		const inliner = new HtmlImageAssetInliner();
		const html = '<p><img src="./icon.png" alt="icon" width="250" /></p>';

		const result = await inliner.inline(html, markdownFilePath);

		assert.match(result, /src="data:image\/png;base64,[^"]+"/);
		assert.match(result, /width="250"/);
	});

	test("should inline multiple local images without corrupting HTML", async () => {
		const inliner = new HtmlImageAssetInliner();
		const html = [
			'<p><img src="./icon.png" alt="one" /></p>',
			'<p><a href="https://example.com"><img src="./icon.png" alt="two" /></a></p>',
		].join("");

		const result = await inliner.inline(html, markdownFilePath);
		const embeddedImageMatches = result.match(/data:image\/png;base64,/g) ?? [];

		assert.strictEqual(embeddedImageMatches.length, 2);
		assert.match(result, /alt="one"/);
		assert.match(result, /alt="two"/);
		assert.match(result, /<a href="https:\/\/example.com">/);
	});

	test("should leave remote and already embedded images untouched", async () => {
		const inliner = new HtmlImageAssetInliner();
		const html = [
			'<p><img src="https://example.com/icon.png" alt="remote" /></p>',
			'<p><img src="data:image/png;base64,abc123" alt="embedded" /></p>',
		].join("");

		const result = await inliner.inline(html, markdownFilePath);

		assert.match(result, /https:\/\/example.com\/icon\.png/);
		assert.match(result, /data:image\/png;base64,abc123/);
	});

	test("should fail when a relative local image has no source context", async () => {
		const inliner = new HtmlImageAssetInliner();

		await assert.rejects(
			() => inliner.inline('<img src="./icon.png" alt="icon" />'),
			/cannot resolve local image path/i,
		);
	});

	test("should reject unsupported image URL protocols", async () => {
		const inliner = new HtmlImageAssetInliner();

		await assert.rejects(
			() =>
				inliner.inline(
					'<img src="javascript:alert(1)" alt="icon" />',
					markdownFilePath,
				),
			/unsupported image url protocol/i,
		);
	});
});
