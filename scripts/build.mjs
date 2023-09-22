import esbuild from "esbuild";
import pkgJson from "../package.json" assert { type: "json" };

async function main() {
  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "browser",
    outfile: "dist/index.js",
    minify: false,
    format: "esm",
    external: Object.keys(pkgJson.dependencies).concat(
      Object.keys(pkgJson.peerDependencies),
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
