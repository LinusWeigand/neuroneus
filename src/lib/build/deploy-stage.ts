export function deployStage(state: string, newestFirst: string[]) {
  if (state === "QUEUED") return "queued";
  if (state === "INITIALIZING") return "starting";
  const log = newestFirst.join("\n");
  if (/Deploying outputs|Build Completed|Uploading build outputs|Deployment completed/i.test(log)) return "publishing";
  if (/Collecting page data|Generating static pages|Finalizing page optimization|Collecting build traces/i.test(log)) return "pages";
  if (/Running TypeScript|Checking validity of types|Linting|Compiled successfully|Finished TypeScript/i.test(log)) return "checking";
  if (/Creating an optimized production build|next build|Compiling|Running "build"/i.test(log)) return "compiling";
  if (/Installing dependencies|npm install|added \d+ packages|Running "install"|Downloading/i.test(log)) return "installing";
  return "starting";
}
