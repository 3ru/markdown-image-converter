import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

// Test configuration
const TEST_CONFIG = {
	dir: path.join(__dirname, "../../../test-workspace"),
	fileNameSlug: "test",
	timeout: 3000, // 3 seconds
	waitTime: 1500, // Time to wait for file generation
};

/**
 * Integration test suite for the Markdown Image Converter extension.
 * Tests the core functionality of converting markdown to different image formats.
 */
suite("Extension Integration Test Suite", () => {
	const testFile = path.join(TEST_CONFIG.dir, `${TEST_CONFIG.fileNameSlug}.md`);

	/**
	 * Utility function to wait for extension activation.
	 * Ensures the extension is properly loaded before running tests.
	 */
	async function waitForExtensionActivation(): Promise<void> {
		const extension = vscode.extensions.getExtension(
			"ryuya.markdown-image-converter",
		);
		if (!extension) {
			throw new Error("Extension not found in VS Code");
		}
		if (!extension.isActive) {
			await extension.activate();
		}
	}

	/**
	 * Utility function to verify generated image file.
	 * @param filePath - Path to the generated image file
	 * @param format - Image format (PNG/JPEG) for error messages
	 */
	async function verifyGeneratedImage(
		filePath: string,
		format: string,
	): Promise<void> {
		assert.ok(
			fs.existsSync(filePath),
			`${format} file should be created at ${filePath}`,
		);
		const stats = fs.statSync(filePath);
		assert.ok(stats.size > 0, `${format} file should not be empty`);
	}

	suiteSetup(async function () {
		this.timeout(TEST_CONFIG.timeout);
		await waitForExtensionActivation();

		// Create test directory and sample markdown file
		await fs.promises.mkdir(TEST_CONFIG.dir, { recursive: true });
		const testMarkdown = `
# Test Document

## Section 1
This is a test markdown file with multiple sections.

### Subsection
- List item 1
- List item 2

## Section 2
Some more content with **bold** and *italic* text.

\`\`\`javascript
console.log('Hello World');
\`\`\`
    `.trim();

		await fs.promises.writeFile(testFile, testMarkdown);
	});

	suiteTeardown(async function () {
		this.timeout(TEST_CONFIG.timeout);
		await fs.promises.rm(TEST_CONFIG.dir, { recursive: true, force: true });
	});

	test("Extension should be present and active", async function () {
		this.timeout(TEST_CONFIG.timeout);
		const extension = vscode.extensions.getExtension(
			"ryuya.markdown-image-converter",
		);
		assert.ok(extension, "Extension should be installed");
		assert.ok(extension.isActive, "Extension should be active");
	});

	test("Should register all export commands", async function () {
		const commands = await vscode.commands.getCommands();
		const expectedCommands = [
			"markdown-image-converter.exportPNG",
			"markdown-image-converter.exportJPEG",
		];

		for (const command of expectedCommands) {
			assert.ok(
				commands.includes(command),
				`Command "${command}" should be registered`,
			);
		}
	});

	test("Should convert markdown to PNG with default settings", async function () {
		this.timeout(TEST_CONFIG.timeout);
		const document = await vscode.workspace.openTextDocument(testFile);
		await vscode.window.showTextDocument(document);

		// Note: executeCommand is called without await as it doesn't return a proper promise
		vscode.commands.executeCommand("markdown-image-converter.exportPNG");

		// Wait for file generation
		const expectedFile = path.join(
			TEST_CONFIG.dir,
			`${TEST_CONFIG.fileNameSlug}.png`,
		);
		await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.waitTime));

		await verifyGeneratedImage(expectedFile, "PNG");
	});

	test("Should convert markdown to JPEG with custom configuration", async function () {
		this.timeout(TEST_CONFIG.timeout);

		// Configure extension for JPEG output
		await vscode.workspace
			.getConfiguration("markdown-image-converter")
			.update("outputFormat", "jpeg", vscode.ConfigurationTarget.Global);

		// Allow time for configuration to be applied
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Prepare and execute conversion
		const document = await vscode.workspace.openTextDocument(testFile);
		await vscode.window.showTextDocument(document);
		vscode.commands.executeCommand("markdown-image-converter.exportJPEG");

		// Verify output
		const expectedFile = path.join(
			TEST_CONFIG.dir,
			`${TEST_CONFIG.fileNameSlug}.jpeg`,
		);
		await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.waitTime));
		await verifyGeneratedImage(expectedFile, "JPEG");
	});
});
