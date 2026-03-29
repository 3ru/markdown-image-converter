import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

// Test configuration
const TEST_CONFIG = {
	dir: path.join(__dirname, "../../../test-workspace"),
	fileNameSlug: "test",
	timeout: 10000,
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

	function readPngDimensions(filePath: string): {
		height: number;
		width: number;
	} {
		const fileBuffer = fs.readFileSync(filePath);
		return {
			width: fileBuffer.readUInt32BE(16),
			height: fileBuffer.readUInt32BE(20),
		};
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

Inline math: $E = mc^2$

$$
\\sum_{i=1}^{n} x_i
$$

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]
\`\`\`

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
		const didConvert = await vscode.commands.executeCommand<boolean>(
			"markdown-image-converter.exportPNG",
		);
		const expectedFile = path.join(
			TEST_CONFIG.dir,
			`${TEST_CONFIG.fileNameSlug}.png`,
		);

		assert.strictEqual(didConvert, true, "PNG export command should succeed");
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
		const didConvert = await vscode.commands.executeCommand<boolean>(
			"markdown-image-converter.exportJPEG",
		);

		// Verify output
		const expectedFile = path.join(
			TEST_CONFIG.dir,
			`${TEST_CONFIG.fileNameSlug}.jpeg`,
		);

		assert.strictEqual(didConvert, true, "JPEG export command should succeed");
		await verifyGeneratedImage(expectedFile, "JPEG");
	});

	test("Should apply configurable margin to PNG output", async function () {
		this.timeout(15000);

		const configuration = vscode.workspace.getConfiguration(
			"markdown-image-converter",
		);
		const expectedFile = path.join(
			TEST_CONFIG.dir,
			`${TEST_CONFIG.fileNameSlug}.png`,
		);
		const document = await vscode.workspace.openTextDocument(testFile);
		await vscode.window.showTextDocument(document);

		await configuration.update("margin", 0, vscode.ConfigurationTarget.Global);
		await new Promise((resolve) => setTimeout(resolve, 100));
		const didConvertWithoutMargin =
			await vscode.commands.executeCommand<boolean>(
				"markdown-image-converter.exportPNG",
			);
		await verifyGeneratedImage(expectedFile, "PNG");
		const unpaddedDimensions = readPngDimensions(expectedFile);

		await configuration.update("margin", 24, vscode.ConfigurationTarget.Global);
		await new Promise((resolve) => setTimeout(resolve, 100));
		const didConvertWithMargin = await vscode.commands.executeCommand<boolean>(
			"markdown-image-converter.exportPNG",
		);
		await verifyGeneratedImage(expectedFile, "PNG");
		const paddedDimensions = readPngDimensions(expectedFile);

		assert.strictEqual(
			didConvertWithoutMargin,
			true,
			"PNG export without margin should succeed",
		);
		assert.strictEqual(
			didConvertWithMargin,
			true,
			"PNG export with margin should succeed",
		);

		assert.ok(
			paddedDimensions.width > unpaddedDimensions.width,
			"Padding should increase the output width",
		);
		assert.ok(
			paddedDimensions.height > unpaddedDimensions.height,
			"Padding should increase the output height",
		);

		await configuration.update("margin", 12, vscode.ConfigurationTarget.Global);
	});
});
