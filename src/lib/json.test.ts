import { describe, expect, it } from "vitest";
import { z } from "zod";
import { firstJsonObject } from "./json";

describe("firstJsonObject", () => {
  const schema = z.object({ next: z.string() });

  it("takes the first object when a model emits several back to back", () => {
    expect(firstJsonObject('{"next":"nova"}{"next":"atlas"}', schema)).toEqual({ next: "nova" });
  });

  it("handles braces inside strings and rejects objects that don't match", () => {
    expect(firstJsonObject('{"next":"a } b"}', schema)).toEqual({ next: "a } b" });
    expect(firstJsonObject('{"other":1}', schema)).toBeNull();
    expect(firstJsonObject(undefined, schema)).toBeNull();
  });
});
