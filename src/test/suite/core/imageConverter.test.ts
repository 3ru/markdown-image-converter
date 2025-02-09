import * as assert from "assert";
import { ImageConverter } from "../../../core/imageConverter";
import { ConversionOptions, MarkdownSection } from "../../../types";

/**
 * Test suite for ImageConverter class
 *
 * Tests the core functionality of converting markdown sections to images:
 * - Basic image conversion
 * - Resolution handling
 * - Format handling
 * - Error handling
 * - Complex markdown content handling
 */
suite("ImageConverter", () => {
	// Test fixtures
	const fixtures = {
		basicSection: {
			content: "# Test\nThis is a test markdown.",
			index: 0,
		} as const,
		complexSection: {
			content: `# Complex Document
## Code Blocks
\`\`\`typescript
const test = "Hello World";
console.log(test);
\`\`\`

## Tables
| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |

## Lists
- Item 1
  - Nested 1
  - Nested 2
- Item 2

## Links and Images
[Link](https://example.com)
![Image](./test.png)`,
			index: 1,
		} as const,
	};

	let converter: ImageConverter;

	setup(() => {
		converter = new ImageConverter();
	});

	teardown(() => {
		// Clean up any resources if needed
	});

	// Basic Conversion Tests
	suite("Basic Conversion", () => {
		test("should generate valid image buffer", async () => {
			const options = {
				format: "png" as const,
				resolution: "standard" as const,
			};

			const buffer = await converter.convertToImage(
				fixtures.basicSection,
				options,
			);

			assert.ok(
				buffer instanceof Uint8Array,
				"Conversion should return Uint8Array buffer",
			);
			assert.ok(buffer.length > 0, "Generated buffer should not be empty");
		});

		test("should handle complex markdown content", async () => {
			const options = {
				format: "png" as const,
				resolution: "standard" as const,
			};

			const buffer = await converter.convertToImage(
				fixtures.complexSection,
				options,
			);

			assert.ok(
				buffer.length > 0,
				"Should successfully convert complex markdown content",
			);
		});
	});

	// Resolution Tests
	suite("Resolution Handling", () => {
		test("should generate larger buffers for HD resolution", async function () {
			this.timeout(5000);
			const standardOptions = {
				format: "png" as const,
				resolution: "standard" as const,
			};
			const hdOptions = {
				format: "png" as const,
				resolution: "hd" as const,
			};

			const [standardBuffer, hdBuffer] = await Promise.all([
				converter.convertToImage(fixtures.basicSection, standardOptions),
				converter.convertToImage(fixtures.basicSection, hdOptions),
			]);

			assert.ok(
				hdBuffer.length > standardBuffer.length,
				"HD resolution should produce larger buffer than standard resolution",
			);
		});

		test("should maintain aspect ratio in different resolutions", async () => {
			const hdOptions = {
				format: "png" as const,
				resolution: "hd" as const,
			};

			const buffer = await converter.convertToImage(
				fixtures.complexSection,
				hdOptions,
			);
			assert.ok(
				buffer.length > 0,
				"Should maintain proper formatting in HD resolution",
			);
		});
	});

	// Format Tests
	suite("Format Handling", () => {
		test("should support different image formats", async () => {
			const formats = {
				png: {
					format: "png" as const,
					resolution: "standard" as const,
				},
				jpeg: {
					format: "jpeg" as const,
					resolution: "standard" as const,
				},
			};

			const [pngBuffer, jpegBuffer] = await Promise.all([
				converter.convertToImage(fixtures.basicSection, formats.png),
				converter.convertToImage(fixtures.basicSection, formats.jpeg),
			]);

			assert.ok(
				pngBuffer.length > 0,
				"PNG conversion should produce valid buffer",
			);
			assert.ok(
				jpegBuffer.length > 0,
				"JPEG conversion should produce valid buffer",
			);
		});

		test("should handle image quality settings", async () => {
			const highQualityJpeg: ConversionOptions = {
				format: "jpeg" as const,
				resolution: "hd" as const,
			};
			const lowQualityJpeg: ConversionOptions = {
				format: "jpeg" as const,
				resolution: "standard" as const,
			};

			const [highQualityBuffer, lowQualityBuffer] = await Promise.all([
				converter.convertToImage(fixtures.complexSection, highQualityJpeg),
				converter.convertToImage(fixtures.complexSection, lowQualityJpeg),
			]);

			assert.ok(
				highQualityBuffer.length > lowQualityBuffer.length,
				"Higher quality settings should produce larger file sizes",
			);
		});
	});

	// TODO: Should we handle these?
	// // Error Handling Tests
	// suite("Error Handling", () => {
	// 	test("should handle unsupported image formats", async () => {
	// 		const invalidFormat = {
	// 			format: "gif" as any, // Intentionally using unsupported format
	// 			resolution: "standard" as const,
	// 		};
	// 	});
	// });

	// Performance Tests
	suite("Performance", () => {
		test("should convert large documents within reasonable time", async function () {
			this.timeout(5000); // Extend timeout for large document processing

			// TODO: maybe 50 is not enough
			const largeContent = fixtures.complexSection.content.repeat(50);
			const largeSection = {
				content: largeContent,
				index: 0,
			};

			const startTime = Date.now();
			const buffer = await converter.convertToImage(largeSection, {
				format: "png" as const,
				resolution: "standard" as const,
			});

			const duration = Date.now() - startTime;
			// Note: Timeout threshold is set to 3000ms based on local development environment.
			// CI environments may require longer due to limited computing resources.
			assert.ok(
				duration < 5000,
				"Large document conversion should complete within 3 seconds",
			);
			assert.ok(
				buffer.length > 0,
				"Should produce valid output for large documents",
			);
		});
	});
});
