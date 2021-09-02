import { cloneDeep } from "lodash";
import { initiateEffects } from "../../src/Utilities";
import { getTestQuarkContext } from "../helpers";

describe("initiateEffects()", () => {
  describe("correctly adds effects to the Context", () => {
    it("0", () => {
      const context = getTestQuarkContext();

      const effect1 = jest.fn();
      const effect2 = jest.fn();

      initiateEffects(context, {
        effect1,
        effect2,
      });

      expect(context.effects.size).toEqual(2);
      expect(context.effects).toContainEqual(effect1);
      expect(context.effects).toContainEqual(effect2);
    });
    it("1", () => {
      const context = getTestQuarkContext();

      const { effects, ...rest } = context;

      const originalContext = cloneDeep(rest);

      const effect1 = jest.fn();
      const effect2 = jest.fn();
      const effect3 = jest.fn();
      const effect4 = jest.fn();

      initiateEffects(context, {
        effect1,
        effect2,
      });

      expect(context.effects.size).toEqual(2);
      expect(context.effects).toContainEqual(effect1);
      expect(context.effects).toContainEqual(effect2);

      initiateEffects(context, {
        effect3,
        effect4,
      });

      expect(context.effects.size).toEqual(4);
      expect(context.effects).toContainEqual(effect1);
      expect(context.effects).toContainEqual(effect2);
      expect(context.effects).toContainEqual(effect3);
      expect(context.effects).toContainEqual(effect4);

      // Assert nothing except the effects list changed
      expect(context).toMatchObject(originalContext);
    });
  });
});
