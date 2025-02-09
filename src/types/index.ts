/**
 * Supported output file formats.
 */
export type OutputFormat = "png" | "jpeg";

/**
 * Available image resolution options.
 * - standard: 1x scale
 * - hd: 2x scale (default)
 * - 4k: 3x scale (future)
 * - ultrahd: 4x scale (future)
 */
export type Resolution = "standard" | "hd" | "4k" | "ultrahd";

/**
 * Options for controlling the conversion process.
 */
export interface ConversionOptions {
	format: OutputFormat;
	splitter?: string;
	resolution?: Resolution;
}

/**
 * Represents a section of markdown content.
 * Used when splitting content into multiple sections.
 */
export interface MarkdownSection {
	content: string;
	index: number;
}
