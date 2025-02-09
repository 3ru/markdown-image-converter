import * as assert from "assert";
import { MarkdownProcessor } from "../../../core/markdownProcessor";

/**
 * Test suite for MarkdownProcessor class
 *
 * Tests the core functionality of markdown content processing including:
 * - Content validation
 * - Content splitting
 * - Table handling
 */
suite("MarkdownProcessor", () => {
	// Test fixtures
	const fixtures = {
		basic: `# Title
This is a test markdown.
## Section 1
Content 1
---
## Section 2
Content 2`,

		withTable: `# Document with Table
## Section 1
Here's a simple table:
| Head | Head |
| ---- | ---- |
| Text | Text |
---
## Section 2
Content after table`,

		withEmptySections: "Section 1\n---\n\n---\nSection 2",
	};

	const splitter = "---";

	// Content Validation Tests
	suite("Content Validation", () => {
		test("should reject empty content", () => {
			assert.strictEqual(
				MarkdownProcessor.validateContent(""),
				false,
				"Empty string should be invalid",
			);
		});

		test("should reject whitespace-only content", () => {
			assert.strictEqual(
				MarkdownProcessor.validateContent("  "),
				false,
				"Whitespace-only content should be invalid",
			);
		});

		test("should accept valid markdown content", () => {
			assert.strictEqual(
				MarkdownProcessor.validateContent("# Valid"),
				true,
				"Valid markdown should be accepted",
			);
		});
	});

	// Content Splitting Tests
	suite("Content Splitting", () => {
		test("should return single section when no splitter is provided", () => {
			const processor = new MarkdownProcessor(fixtures.basic);
			const sections = processor.splitContent();

			assert.strictEqual(sections.length, 1, "Should have exactly one section");
			assert.strictEqual(sections[0].index, 0, "Section index should be 0");
			assert.strictEqual(
				sections[0].content,
				fixtures.basic,
				"Content should match input",
			);
		});

		test("should correctly split content with custom splitter", () => {
			const processor = new MarkdownProcessor(fixtures.basic);
			const sections = processor.splitContent(splitter);

			assert.strictEqual(sections.length, 2, "Should have two sections");
			assert.match(
				sections[0].content,
				/# Title.*Section 1.*Content 1/s,
				"First section should contain expected content",
			);
			assert.match(
				sections[1].content,
				/## Section 2.*Content 2/s,
				"Second section should contain expected content",
			);
		});

		test("should handle empty sections appropriately", () => {
			const processor = new MarkdownProcessor(fixtures.withEmptySections);
			const sections = processor.splitContent(splitter);

			assert.strictEqual(sections.length, 2, "Should have two sections");
			assert.strictEqual(
				sections[0].content,
				"Section 1",
				"First section content should match",
			);
			assert.strictEqual(
				sections[1].content,
				"Section 2",
				"Second section content should match",
			);
		});
	});

	// Table Handling Tests
	suite("Table Handling", () => {
		test("should preserve markdown tables when splitting content", () => {
			const processor = new MarkdownProcessor(fixtures.withTable);
			const sections = processor.splitContent(splitter);

			assert.strictEqual(
				sections.length,
				2,
				"Should only split at actual delimiters",
			);

			// Verify table structure is preserved
			const tablePattern =
				/## Section 1\nHere's a simple table:[\s\S]*\| Head \| Head \|[\s\S]*\| Text \| Text \|/;
			assert.match(
				sections[0].content,
				tablePattern,
				"First section should contain complete, intact table",
			);

			// Verify content after delimiter
			assert.match(
				sections[1].content,
				/## Section 2\nContent after table/,
				"Second section should contain content after delimiter",
			);
		});
	});
});
