import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const EMBEDDED_IMAGE_PROTOCOLS = new Set(["data:", "http:", "https:"]);
const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
	".avif": "image/avif",
	".bmp": "image/bmp",
	".gif": "image/gif",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".png": "image/png",
	".svg": "image/svg+xml",
	".tif": "image/tiff",
	".tiff": "image/tiff",
	".webp": "image/webp",
};

/**
 * Resolves image sources into deterministic, self-contained URLs.
 * The cache is scoped to a conversion session so split exports can reuse
 * already encoded assets without retaining them for the entire extension life.
 */
export class AssetResolver {
	private readonly assetCache = new Map<string, Promise<string>>();

	public async resolveImageSource(
		source: string,
		sourceFilePath?: string,
	): Promise<string> {
		if (WINDOWS_ABSOLUTE_PATH.test(source)) {
			return this.readFileAsDataUrl(source);
		}

		if (source.startsWith("//")) {
			return source;
		}

		try {
			const url = new URL(source);
			if (EMBEDDED_IMAGE_PROTOCOLS.has(url.protocol)) {
				return source;
			}

			if (url.protocol === "file:") {
				return this.readFileAsDataUrl(fileURLToPath(url));
			}

			throw new Error(
				`Unsupported image URL protocol "${url.protocol}" in "${source}"`,
			);
		} catch (error) {
			if (!(error instanceof TypeError)) {
				throw error;
			}
		}

		if (!sourceFilePath) {
			throw new Error(
				`Cannot resolve local image path "${source}" without a source file path`,
			);
		}

		const sourceDirectory = path.dirname(path.resolve(sourceFilePath));
		const pathname = this.decodePathname(this.stripQueryAndHash(source));
		const absolutePath = path.isAbsolute(pathname)
			? pathname
			: path.resolve(sourceDirectory, pathname);
		return this.readFileAsDataUrl(absolutePath);
	}

	private stripQueryAndHash(source: string): string {
		const hashIndex = source.indexOf("#");
		const queryIndex = source.indexOf("?");
		const cutoffCandidates = [hashIndex, queryIndex].filter(
			(index) => index >= 0,
		);

		if (cutoffCandidates.length === 0) {
			return source;
		}

		return source.slice(0, Math.min(...cutoffCandidates));
	}

	private decodePathname(pathname: string): string {
		try {
			return decodeURIComponent(pathname);
		} catch {
			return pathname;
		}
	}

	private async readFileAsDataUrl(filePath: string): Promise<string> {
		const normalizedPath = path.normalize(path.resolve(filePath));
		const cachedAsset = this.assetCache.get(normalizedPath);
		if (cachedAsset) {
			return cachedAsset;
		}

		const pendingAsset = this.readAndEncodeFile(normalizedPath);
		this.assetCache.set(normalizedPath, pendingAsset);

		try {
			return await pendingAsset;
		} catch (error) {
			this.assetCache.delete(normalizedPath);
			throw error;
		}
	}

	private async readAndEncodeFile(filePath: string): Promise<string> {
		let fileContents: Buffer;
		try {
			fileContents = await fs.promises.readFile(filePath);
		} catch (error) {
			throw new Error(
				`Image asset could not be read from "${filePath}": ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}

		const mimeType = this.getMimeType(filePath);
		return `data:${mimeType};base64,${fileContents.toString("base64")}`;
	}

	private getMimeType(filePath: string): string {
		const extension = path.extname(filePath).toLowerCase();
		return MIME_TYPES_BY_EXTENSION[extension] ?? "application/octet-stream";
	}
}
