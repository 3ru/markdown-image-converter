import * as assert from "assert";
import { executablePath as puppeteerExecutablePath } from "puppeteer";
import * as puppeteer from "puppeteer-core";
import { MermaidRenderer } from "../../../core/MermaidRenderer";

suite("MermaidRenderer", () => {
	const renderer = new MermaidRenderer();

	async function createPage() {
		const browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
			executablePath: puppeteerExecutablePath(),
		});
		const page = await browser.newPage();

		return {
			browser,
			page,
		};
	}

	test("should render Mermaid placeholders into inline SVG", async function () {
		this.timeout(10000);
		const { browser, page } = await createPage();

		try {
			await page.setContent(`
				<html>
					<head>
						<style>${renderer.getStyles()}</style>
					</head>
					<body>
						${renderer.createEmbed("graph TD\nA[Start] --> B[End]")}
					</body>
				</html>
			`);

			await renderer.render(page);

			const markup = await page.$eval(".mic-mermaid", (element) => {
				return element.innerHTML;
			});

			assert.match(markup, /<svg[\s>]/);
			assert.doesNotMatch(markup, /Loading\.\.\./);
		} finally {
			await browser.close();
		}
	});

	test("should fail fast for invalid Mermaid diagrams", async function () {
		this.timeout(10000);
		const { browser, page } = await createPage();

		try {
			await page.setContent(`
				<html>
					<head>
						<style>${renderer.getStyles()}</style>
					</head>
					<body>
						${renderer.createEmbed("graph TD\nA -->")}
					</body>
				</html>
			`);

			await assert.rejects(
				renderer.render(page),
				/Failed to render Mermaid diagrams/,
			);
		} finally {
			await browser.close();
		}
	});
});
