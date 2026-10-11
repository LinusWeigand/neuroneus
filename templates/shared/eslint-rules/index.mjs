import disableNeedsReason from "./disable-needs-reason.mjs";
import featureBoundaries from "./feature-boundaries.mjs";
import noComments from "./no-comments.mjs";
import noHexColors from "./no-hex-colors.mjs";
import noRawAssetPaths from "./no-raw-asset-paths.mjs";
import uiInEngine from "./ui-in-engine.mjs";

const plugin = {
  meta: { name: "app" },
  rules: {
    "disable-needs-reason": disableNeedsReason,
    "feature-boundaries": featureBoundaries,
    "no-comments": noComments,
    "no-hex-colors": noHexColors,
    "no-raw-asset-paths": noRawAssetPaths,
    "ui-in-engine": uiInEngine,
  },
};

export default plugin;
