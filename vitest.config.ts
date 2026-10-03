import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
	// Resolves the @/* alias from tsconfig.json, the single source for it.
	resolve: { tsconfigPaths: true },
	test: {
		include: ["tests/**/*.test.ts"],
		// Remove once the first test lands (spec 0001 follow up).
		passWithNoTests: true,
	},
});

export default config;
