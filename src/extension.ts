import * as vscode from "vscode";
import { ImageConverter } from "./core/imageConverter";
import { MarkdownProcessor } from "./core/markdownProcessor";
import { FileService } from "./services/fileService";
import { ConversionOptions, OutputFormat, Resolution } from "./types";

/**
 * VSCode extension entry point.
 * Key features:
 * - Supports splitting markdown into multiple images based on a delimiter
 * - Shows progress in both status bar and notification
 * - Configurable image resolution and output format
 */
export function activate(context: vscode.ExtensionContext) {
	const converter = new ImageConverter();
	const fileService = new FileService();
	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
	);

	/**
	 * Factory function to register export commands for different formats.
	 * @param format - The target file format
	 */
	const registerExportCommand = (format: OutputFormat) => {
		const disposable = vscode.commands.registerCommand(
			`markdown-image-converter.export${format.toUpperCase()}`,
			async () => {
				// Validate that we're in a markdown file
				const editor = vscode.window.activeTextEditor;
				if (!editor || editor.document.languageId !== "markdown") {
					vscode.window.showWarningMessage(
						"📝 Please open a markdown file first",
					);
					return false;
				}

				try {
					// Initialize progress indicators
					statusBarItem.text = "🔄 Converting markdown...";
					statusBarItem.show();

					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: `Converting markdown to ${format.toUpperCase()}`,
							cancellable: false,
						},
						async (progress) => {
							// Load user configuration
							const config = vscode.workspace.getConfiguration(
								"markdown-image-converter",
							);
							const splitter = config.get<string>("splitter");
							const resolution = config.get<Resolution>("resolution");

							// Process markdown content
							const processor = new MarkdownProcessor(
								editor.document.getText(),
							);
							const sections = processor.splitContent(splitter);
							const totalSections = sections.length;
							const isSplit = totalSections > 1;

							// Convert each section to an image
							for (let i = 0; i < sections.length; i++) {
								const section = sections[i];
								progress.report({
									message: `Processing section ${i + 1}/${totalSections}`,
									increment: 100 / totalSections,
								});

								const options: ConversionOptions = {
									format,
									splitter,
									resolution,
								};
								// Convert markdown to image and save
								const buffer = await converter.convertToImage(section, options);
								await fileService.saveImage(
									buffer,
									editor.document.fileName,
									section.index,
									format,
									isSplit,
								);
							}
						},
					);

					// Show success notification
					await vscode.window.showInformationMessage(
						`✨ Successfully converted to ${format.toUpperCase()}!`,
					);
					return true;
				} catch (error) {
					vscode.window.showErrorMessage(
						`❌ Conversion failed: ${
							error instanceof Error ? error.message : "Unknown error"
						}`,
					);
					return false;
				} finally {
					statusBarItem.hide();
				}
			},
		);

		context.subscriptions.push(disposable);
	};

	// Register commands for supported formats
	registerExportCommand("png");
	registerExportCommand("jpeg");
}

/**
 * Cleanup function called when the extension is deactivated.
 * Currently no cleanup is needed, but this function is required by VSCode.
 */
export function deactivate() {}
