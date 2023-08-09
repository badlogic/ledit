#!/usr/bin/env node

import esbuild from "esbuild";

let watch = process.argv.length >= 3 && process.argv[2] == "--watch";

const config = {
  entryPoints: {
    index: "site/index.ts",
    "index-new": "site/index-new.ts",
  },
  bundle: true,
  sourcemap: true,
  outdir: "site/build/",
  loader: {
    ".ttf": "dataurl",
    ".html": "text",
    ".svg": "text",
  },
  logLevel: "info",
  minify: !watch,
};

if (!watch) {
  console.log("Building site");
  await esbuild.build(config);
} else {
  const buildContext = await esbuild.context(config);
  buildContext.watch();
}
