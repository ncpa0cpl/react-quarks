import { build } from "@ncpa0cpl/nodepack";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (...fpath) => path.resolve(__dirname, "..", ...fpath);

async function main() {
  await build({
    formats: ["cjs", "esm", "legacy"],
    outDir: p("dist"),
    srcDir: p("src"),
    target: "esnext",
    declarations: true,
    tsConfig: p("tsconfig.json"),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
