import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { executablePath as puppeteerExecutablePath } from "puppeteer";

const BROWSER_ENV_KEYS = [
	"PUPPETEER_EXECUTABLE_PATH",
	"CHROME_EXECUTABLE_PATH",
	"CHROMIUM_PATH",
] as const;

interface BrowserExecutableResolutionOptions {
	configuredPath?: string;
	env?: NodeJS.ProcessEnv;
	fileExists?: (candidate: string) => boolean;
	findOnPath?: (binaryNames: string[]) => string | undefined;
	platform?: NodeJS.Platform;
	puppeteerPath?: string | null;
}

export function resolveBrowserExecutablePath(configuredPath?: string): string {
	return resolveBrowserExecutablePathWith({
		configuredPath,
		env: process.env,
		fileExists: (candidate) => fs.existsSync(candidate),
		findOnPath: defaultFindOnPath,
		platform: process.platform,
		puppeteerPath: getPuppeteerExecutablePath(),
	});
}

export function resolveBrowserExecutablePathWith(
	options: BrowserExecutableResolutionOptions,
): string {
	const configuredPath = normalizeExecutablePath(options.configuredPath);
	const env = options.env ?? process.env;
	const fileExists =
		options.fileExists ?? ((candidate) => fs.existsSync(candidate));
	const findOnPath = options.findOnPath ?? defaultFindOnPath;
	const platform = options.platform ?? process.platform;
	const puppeteerPath = normalizeExecutablePath(options.puppeteerPath);

	if (configuredPath) {
		if (!fileExists(configuredPath)) {
			throw new Error(
				`Configured browser executable was not found at "${configuredPath}"`,
			);
		}

		return configuredPath;
	}

	for (const envKey of BROWSER_ENV_KEYS) {
		const envPath = normalizeExecutablePath(env[envKey]);
		if (envPath && fileExists(envPath)) {
			return envPath;
		}
	}

	if (puppeteerPath && fileExists(puppeteerPath)) {
		return puppeteerPath;
	}

	for (const candidate of getPlatformExecutableCandidates(platform, env)) {
		if (fileExists(candidate)) {
			return candidate;
		}
	}

	const pathExecutable = findOnPath(getPlatformExecutableNames(platform));
	if (pathExecutable) {
		return pathExecutable;
	}

	throw new Error(
		'Could not find a Chrome or Chromium executable. Set "markdown-image-converter.executablePath" to a valid browser path.',
	);
}

function normalizeExecutablePath(value?: string | null): string | undefined {
	if (!value) {
		return undefined;
	}

	const normalizedValue = value.trim();
	return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function getPuppeteerExecutablePath(): string | undefined {
	try {
		return normalizeExecutablePath(puppeteerExecutablePath());
	} catch {
		return undefined;
	}
}

function getPlatformExecutableNames(platform: NodeJS.Platform): string[] {
	switch (platform) {
		case "win32":
			return ["chrome.exe", "msedge.exe"];
		case "darwin":
			return ["Google Chrome", "Chromium"];
		default:
			return [
				"chromium-browser",
				"chromium",
				"google-chrome-stable",
				"google-chrome",
			];
	}
}

function getPlatformExecutableCandidates(
	platform: NodeJS.Platform,
	env: NodeJS.ProcessEnv,
): string[] {
	switch (platform) {
		case "win32": {
			const programFiles = env.PROGRAMFILES ?? "C:\\Program Files";
			const programFilesX86 =
				env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";

			return [
				path.join(
					programFiles,
					"Google",
					"Chrome",
					"Application",
					"chrome.exe",
				),
				path.join(
					programFilesX86,
					"Google",
					"Chrome",
					"Application",
					"chrome.exe",
				),
				path.join(
					programFiles,
					"Microsoft",
					"Edge",
					"Application",
					"msedge.exe",
				),
				path.join(
					programFilesX86,
					"Microsoft",
					"Edge",
					"Application",
					"msedge.exe",
				),
			];
		}
		case "darwin":
			return [
				"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
				"/Applications/Chromium.app/Contents/MacOS/Chromium",
			];
		default:
			return [
				"/usr/bin/chromium-browser",
				"/usr/bin/chromium",
				"/snap/bin/chromium",
				"/usr/bin/google-chrome-stable",
				"/usr/bin/google-chrome",
			];
	}
}

function defaultFindOnPath(binaryNames: string[]): string | undefined {
	const command = process.platform === "win32" ? "where" : "which";

	for (const binaryName of binaryNames) {
		try {
			const output = execFileSync(command, [binaryName], {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			});
			const [candidate] = output
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line.length > 0);

			if (candidate) {
				return candidate;
			}
		} catch {
			// Continue searching other candidates.
		}
	}

	return undefined;
}
