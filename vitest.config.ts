import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
	test: {
		include: ["test/**/*.test.ts"],
		// Remove once the first test lands (spec 0001 follow up).
		passWithNoTests: true,
	},
});

export default config;
