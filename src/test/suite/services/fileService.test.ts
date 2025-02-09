import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import sinon from "sinon";
import * as vscode from "vscode";
import { FileService } from "../../../services/fileService";
import { OutputFormat } from "../../../types";

// Test constants
const TEST_CONSTANTS = {
	dir: path.join(__dirname, "../../../../test-output"),
	sampleBuffer: Buffer.from("test image data"),
	defaultFormat: "png" as const,
};

/**
 * Test suite for FileService class
 *
 * Tests the core functionality of file operations:
 * - Image saving
 * - Directory handling
 * - Configuration handling
 */
suite("FileService", () => {
	let fileService: FileService;

	setup(async () => {
		fileService = new FileService();
		await fs.promises.mkdir(TEST_CONSTANTS.dir, { recursive: true });
	});

	teardown(async () => {
		await fs.promises.rm(TEST_CONSTANTS.dir, { recursive: true, force: true });
	});

	// Basic File Operations
	suite("Basic File Operations", () => {
		test("should create file in correct location", async () => {
			const testPath = path.join(TEST_CONSTANTS.dir, "test.md");

			await fileService.saveImage(
				TEST_CONSTANTS.sampleBuffer,
				testPath,
				0,
				TEST_CONSTANTS.defaultFormat,
				false,
			);

			const expectedPath = path.join(TEST_CONSTANTS.dir, "test.png");
			assert.ok(
				fs.existsSync(expectedPath),
				"Output file should exist at expected location",
			);
		});
	});

	// Split File Handling
	suite("Split File Handling", () => {
		test("should handle multiple sections correctly", async () => {
			const testPath = path.join(TEST_CONSTANTS.dir, "test.md");

			await Promise.all([
				fileService.saveImage(
					TEST_CONSTANTS.sampleBuffer,
					testPath,
					0,
					TEST_CONSTANTS.defaultFormat,
					true,
				),
				fileService.saveImage(
					TEST_CONSTANTS.sampleBuffer,
					testPath,
					1,
					TEST_CONSTANTS.defaultFormat,
					true,
				),
			]);

			const expectedDir = path.join(TEST_CONSTANTS.dir, "test-png");
			assert.ok(
				fs.existsSync(path.join(expectedDir, "test_1.png")),
				"First section file should exist",
			);
			assert.ok(
				fs.existsSync(path.join(expectedDir, "test_2.png")),
				"Second section file should exist",
			);
		});
	});

	// Configuration Handling
	suite("Configuration Handling", () => {
		test("should respect custom output directory pattern", async () => {
			const mockConfig = {
				get: (key: string) => "custom-{format}-output",
			};
			const getConfigurationStub = sinon
				.stub(vscode.workspace, "getConfiguration")
				.returns(mockConfig as any);

			const testPath = path.join(TEST_CONSTANTS.dir, "test.md");

			await fileService.saveImage(
				TEST_CONSTANTS.sampleBuffer,
				testPath,
				0,
				TEST_CONSTANTS.defaultFormat,
				true,
			);

			const expectedDir = path.join(TEST_CONSTANTS.dir, "custom-png-output");
			assert.ok(
				fs.existsSync(path.join(expectedDir, "test_1.png")),
				"File should be created in custom directory",
			);

			getConfigurationStub.restore();
		});
	});
});
