import { getConfig, Generator } from "@tanstack/router-generator";

const config = await getConfig({
  config: {
    routesDirectory: "src/routes",
    generatedRouteTree: "src/routeTree.gen.ts",
  },
});

const g = new Generator({ config, root: process.cwd() });
await g.run();
console.log("route tree generated");