import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as sinon from "sinon";
import { AssetResolver } from "../../../core/AssetResolver";
import {
	cleanupTestWorkspace,
	copyTestFile,
	createTestWorkspace,
} from "../testUtils";

suite("AssetResolver", () => {
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
		sinon.restore();
	});

	test("should cache repeated local image reads within a session", async () => {
		const resolver = new AssetResolver();
		const readFileSpy = sinon.spy(fs.promises, "readFile");

		const [first, second] = await Promise.all([
			resolver.resolveImageSource("./icon.png", markdownFilePath),
			resolver.resolveImageSource("./icon.png", markdownFilePath),
		]);

		const iconReadCount = readFileSpy
			.getCalls()
			.filter((call) =>
				String(call.args[0]).endsWith(`${path.sep}icon.png`),
			).length;

		assert.strictEqual(first, second);
		assert.strictEqual(iconReadCount, 1);
	});
});
