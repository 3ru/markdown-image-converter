import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { OutputFormat } from "../types";

/**
 * Handles file system operations for the extension.
 * Responsible for saving generated images to the file system.
 */
export class FileService {
	/**
	 * Saves a file to the file system.
	 * @param buffer - The file data to save
	 * @param originalPath - The path of the source markdown file
	 * @param index - The section index (used when splitting content)
	 * @param format - The output file format
	 * @param isSplit - Whether the content was split into multiple sections
	 */
	public async saveImage(
		buffer: Uint8Array,
		originalPath: string,
		index: number,
		format: OutputFormat,
		isSplit: boolean = false,
	): Promise<void> {
		const outputPath = await this.generateOutputPath(
			originalPath,
			index,
			format,
			isSplit,
		);

		// Create directory if it doesn't exist
		if (isSplit) {
			const dir = path.dirname(outputPath);
			await fs.promises.mkdir(dir, { recursive: true });
		}

		await vscode.workspace.fs.writeFile(vscode.Uri.file(outputPath), buffer);
	}

	/**
	 * Generates the output file path for the image.
	 * If the content is split, appends a section number to the filename.
	 * @param originalPath - The source markdown file path
	 * @param index - The section index
	 * @param format - The output format
	 * @param isSplit - Whether the content was split
	 * @returns The generated output path
	 */
	private generateOutputPath(
		originalPath: string,
		index: number,
		format: OutputFormat,
		isSplit: boolean,
	): string {
		const parsedPath = path.parse(originalPath);

		if (!isSplit) {
			return path.join(parsedPath.dir, `${parsedPath.name}.${format}`);
		}

		// Get user configuration for split output directory
		const config = vscode.workspace.getConfiguration(
			"markdown-image-converter",
		);
		const dirPattern =
			config.get<string>("splitOutputDir") || "{name}-{format}";

		// Replace variables in pattern
		const dirName = dirPattern
			.replace("{name}", parsedPath.name)
			.replace("{format}", format);

		const outputDir = path.join(parsedPath.dir, dirName);
		return path.join(outputDir, `${parsedPath.name}_${index + 1}.${format}`);
	}
}
