const kind = [
  {
    files: ["**/*.tsx"],
    ignores: ["app/layout.tsx", "app/page.tsx", "components/game.tsx", "components/hud.tsx", "components/hud/**"],
    rules: {
      "app/ui-in-engine": [
        "error",
        { place: "in components/hud.tsx or components/hud/, as HTML over the canvas styled only with the palette's game-* colors and font-game-display / font-game-body. Other components only mount the game" },
      ],
    },
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
