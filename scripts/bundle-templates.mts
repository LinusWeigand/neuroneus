import fs from "node:fs";
import { BUNDLE_PATH, readTemplateBundle } from "@/lib/build/template-bundle";

const bundle = readTemplateBundle(process.cwd());
fs.writeFileSync(BUNDLE_PATH, JSON.stringify(bundle) + "\n");
const files = Object.values(bundle.layers).reduce((n, layer) => n + Object.keys(layer).length, 0) + Object.keys(bundle.skills).length;
process.stdout.write(`${BUNDLE_PATH}: ${files} template files, ${(fs.statSync(BUNDLE_PATH).size / 1024).toFixed(0)} KB\n`);
