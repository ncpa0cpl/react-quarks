import type { QuarkContext, StateSetter } from "../../Types";
import type { AsyncUpdateController } from "./AsyncUpdates";
export declare function unpackStateSetter<T, A, TE>(self: QuarkContext<T, A, TE>, asyncUpdates: AsyncUpdateController<T>, setter: StateSetter<T, never>): {
    then(handler: (state: T) => void): void;
};
