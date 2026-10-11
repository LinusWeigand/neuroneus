const kind = [
  {
    files: ["features/**/*.{ts,tsx}"],
    rules: { "app/feature-boundaries": "error" },
  },
  {
    ignores: ["lib/db.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@neondatabase/serverless", message: "Query through lib/db.ts (sql tagged templates)." }] },
      ],
    },
  },
];

export default kind;
