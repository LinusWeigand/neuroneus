const kind = [
  {
    files: ["**/*.tsx"],
    ignores: ["app/layout.tsx", "app/page.tsx", "components/game.tsx"],
    rules: { "app/ui-in-engine": "error" },
  },
  {
    ignores: ["game/assets.ts"],
    rules: { "app/no-raw-asset-paths": "error" },
  },
  {
    files: ["game/palette.ts"],
    rules: { "app/no-hex-colors": "off" },
  },
];

export default kind;
