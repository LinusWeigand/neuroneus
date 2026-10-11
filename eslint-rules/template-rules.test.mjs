import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { describe, it } from "vitest";
import featureBoundaries from "../templates/shared/eslint-rules/feature-boundaries.mjs";
import noRawAssetPaths from "../templates/shared/eslint-rules/no-raw-asset-paths.mjs";
import uiInEngine from "../templates/shared/eslint-rules/ui-in-engine.mjs";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run("ui-in-engine", uiInEngine, {
  valid: ["export const score = 1;"],
  invalid: [
    { code: "const a = <div><p /></div>;", errors: [{ message: /in the engine with game\/ui\.ts/ }] },
    { code: "const a = <div />;", options: [{ place: "in components/hud.tsx" }], errors: [{ message: "Build menus, HUD and screens in components/hud.tsx." }] },
  ],
});

tester.run("no-raw-asset-paths", noRawAssetPaths, {
  valid: ['load(IMAGES.player);', 'const url = "/api/scores";'],
  invalid: [
    { code: 'this.load.image("player", "/assets/player.png");', errors: [{ messageId: "path" }] },
    { code: "const url = `assets/${name}.glb`;", errors: [{ messageId: "path" }] },
  ],
});

tester.run("feature-boundaries", featureBoundaries, {
  valid: [
    { code: 'import { Button } from "@/components/ui/button";', filename: "/app/features/cart/view.tsx" },
    { code: 'import { total } from "./total";', filename: "/app/features/cart/view.tsx" },
    { code: 'import { login } from "@/features/auth";', filename: "/app/features/cart/view.tsx" },
  ],
  invalid: [
    { code: 'import { session } from "@/features/auth/session";', filename: "/app/features/cart/view.tsx", errors: [{ messageId: "boundary" }] },
    { code: 'import { session } from "../auth/session";', filename: "/app/features/cart/view.tsx", errors: [{ messageId: "boundary" }] },
  ],
});
