import * as assert from "assert";
import { resolveBrowserExecutablePathWith } from "../../../core/browserExecutable";

suite("browserExecutable", () => {
	test("should prefer a configured executable path when it exists", () => {
		const executablePath = resolveBrowserExecutablePathWith({
			configuredPath: "/custom/chrome",
			fileExists: (candidate) => candidate === "/custom/chrome",
			findOnPath: () => undefined,
			platform: "linux",
			puppeteerPath: "/missing/puppeteer",
		});

		assert.strictEqual(executablePath, "/custom/chrome");
	});

	test("should fall back to a system browser when the Puppeteer cache path is missing", () => {
		const executablePath = resolveBrowserExecutablePathWith({
			fileExists: (candidate) => candidate === "/usr/bin/chromium-browser",
			findOnPath: () => undefined,
			platform: "linux",
			puppeteerPath: "/missing/puppeteer",
		});

		assert.strictEqual(executablePath, "/usr/bin/chromium-browser");
	});

	test("should throw a helpful error when a configured path does not exist", () => {
		assert.throws(
			() =>
				resolveBrowserExecutablePathWith({
					configuredPath: "/missing/chrome",
					fileExists: () => false,
					findOnPath: () => undefined,
					platform: "linux",
					puppeteerPath: undefined,
				}),
			/configured browser executable was not found/i,
		);
	});
});
