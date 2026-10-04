import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
	entry: { index: "src/index.ts" },
	format: ["esm", "cjs"],
	platform: "node",
	target: "node22",
	dts: true,
	// Pinned explicitly: the exports map in package.json depends on these exact names.
	outExtensions: ({ format }) =>
		format === "es"
			? { js: ".js", dts: ".d.ts" }
			: { js: ".cjs", dts: ".d.cts" },
	sourcemap: false,
	minify: false,
	clean: true,
	outDir: "dist",
	publint: true,
	attw: { profile: "node16", level: "error" },
});

export default config;
