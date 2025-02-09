import * as fs from "fs";
import * as path from "path";

/**
 * Test utilities for managing test workspaces and files.
 * These utilities help maintain consistent test environments across the test suite.
 */

// Constants for test workspace configuration
const TEST_WORKSPACE = {
	rootDir: "../../../test-workspace",
	defaultPermissions: 0o755, // read, write, execute for owner, read and execute for group, read and execute for others
} as const;

/**
 * Creates a clean test workspace directory.
 * This workspace is isolated from the actual project directory to prevent test pollution.
 *
 * @returns Promise<string> The absolute path to the created test workspace
 * @throws {Error} If directory creation fails
 */
export const createTestWorkspace = async (): Promise<string> => {
	const testDir = path.join(__dirname, TEST_WORKSPACE.rootDir);
	try {
		await fs.promises.mkdir(testDir, {
			recursive: true,
			mode: TEST_WORKSPACE.defaultPermissions,
		});
		return testDir;
	} catch (error) {
		throw new Error(
			`Failed to create test workspace: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		);
	}
};

/**
 * Safely removes a test workspace directory and all its contents.
 * Should be called in test teardown to clean up test artifacts.
 *
 * @param testDir - The absolute path to the test workspace to clean up
 * @returns Promise<void>
 * @throws {Error} If directory cleanup fails
 */
export const cleanupTestWorkspace = async (testDir: string): Promise<void> => {
	try {
		await fs.promises.rm(testDir, {
			recursive: true,
			force: true,
		});
	} catch (error) {
		throw new Error(
			`Failed to cleanup test workspace: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		);
	}
};

/**
 * Creates a test file with specified content in the test workspace.
 * Useful for setting up test scenarios that require existing files.
 *
 * @param testDir - The absolute path to the test workspace
 * @param filename - The name of the file to create
 * @param content - The content to write to the file
 * @returns Promise<string> The absolute path to the created file
 * @throws {Error} If file creation fails
 *
 * @example
 * ```typescript
 * const testDir = await createTestWorkspace();
 * const filePath = await createTestFile(testDir, "test.md", "# Test Content");
 * // Use filePath in tests...
 * await cleanupTestWorkspace(testDir);
 * ```
 */
export const createTestFile = async (
	testDir: string,
	filename: string,
	content: string,
): Promise<string> => {
	const filePath = path.join(testDir, filename);
	try {
		await fs.promises.writeFile(filePath, content, {
			encoding: "utf8",
			mode: TEST_WORKSPACE.defaultPermissions,
		});
		return filePath;
	} catch (error) {
		throw new Error(
			`Failed to create test file: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		);
	}
};

/**
 * Type guard to check if an error is an instance of Error
 * Useful for consistent error handling across test utilities
 *
 * @param error - The error to check
 * @returns boolean indicating if the error is an Error instance
 */
const isError = (error: unknown): error is Error => {
	return error instanceof Error;
};
