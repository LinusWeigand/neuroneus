import clientServerBoundary from "./client-server-boundary.mjs";
import disableNeedsReason from "./disable-needs-reason.mjs";
import modelCallsUseCallSettings from "./model-calls-use-call-settings.mjs";
import noComments from "./no-comments.mjs";
import noHeavyBuildReads from "./no-heavy-build-reads.mjs";
import noHexColors from "./no-hex-colors.mjs";
import noJsxText from "./no-jsx-text.mjs";

const plugin = {
  meta: { name: "neuroneus" },
  rules: {
    "client-server-boundary": clientServerBoundary,
    "disable-needs-reason": disableNeedsReason,
    "model-calls-use-call-settings": modelCallsUseCallSettings,
    "no-comments": noComments,
    "no-heavy-build-reads": noHeavyBuildReads,
    "no-hex-colors": noHexColors,
    "no-jsx-text": noJsxText,
  },
};

export default plugin;
