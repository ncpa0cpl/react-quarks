import { ActionApi } from "../Types/Actions";
import { InternalT, RefetchOptions, ResourceID } from "./Types";

export class Refetcher<T> {
  private perID = new Map<
    ResourceID,
    Map<symbol, (api: ActionApi<InternalT<T>>) => Promise<void> | void>
  >();
  private global = new Map<
    symbol,
    (api: ActionApi<InternalT<T>>) => Promise<void> | void
  >();

  private globalInterval?: number;
  private perIDlIntervals = new Map<ResourceID, number>();

  constructor(
    protected opts: RefetchOptions,
    protected dispatch: (
      dispatchFn: (api: ActionApi<InternalT<T>>) => Promise<void> | void,
    ) => void,
  ) {}

  private createRefetchInterval(id?: ResourceID) {
    if (id == null) {
      this.globalInterval = setInterval(() => {
        this.dispatch(api => {
          return this.refetchIfUsed(api);
        });
      }, this.opts.autoInterval ?? 60_000);
    } else {
      const interval = setInterval(() => {
        this.dispatch(api => {
          return this.refetchIfUsed(api, id);
        });
      }, this.opts.autoInterval ?? 60_000);

      this.perIDlIntervals.set(id, interval);
    }
  }

  private stopRefetchInterval(id?: ResourceID) {
    if (id == null) {
      clearInterval(this.globalInterval!);
    } else {
      clearInterval(this.perIDlIntervals.get(id)!);
    }
  }

  private updateIntervals(id?: ResourceID) {
    if (this.opts.auto === false) return;

    if (id != null) {
      const observersCount = this.perID.get(id)?.size ?? 0;
      if (observersCount > 0 && this.perIDlIntervals.get(id) == null) {
        this.createRefetchInterval(id);
      }
      if (observersCount === 0 && this.perIDlIntervals.get(id) != null) {
        this.stopRefetchInterval(id);
      }
    } else {
      const observersCount = this.global.size;
      if (observersCount > 0 && this.globalInterval == null) {
        this.createRefetchInterval();
      }
      if (observersCount === 0 && this.globalInterval != null) {
        this.stopRefetchInterval();
      }
    }
  }

  register(
    id: ResourceID,
    refetch: (api: ActionApi<InternalT<T>>) => Promise<void> | void,
  ): () => void;
  register(
    refetch: (api: ActionApi<InternalT<T>>) => Promise<void> | void,
  ): () => void;
  register(
    ...args: [
      id: ResourceID,
      refetch: (api: ActionApi<InternalT<T>>) => Promise<void> | void,
    ] | [
      refetch: (api: ActionApi<InternalT<T>>) => Promise<void> | void,
    ]
  ) {
    const sym = Symbol();

    if (args.length === 1) {
      const [refetch] = args;
      this.global.set(sym, refetch);

      this.updateIntervals();

      return () => {
        this.global.delete(sym);
        this.updateIntervals();
      };
    } else {
      const [id, refetch] = args;
      let m = this.perID.get(id);

      if (!m) {
        m = new Map();
        this.perID.set(id, m);
      }

      m.set(sym, refetch);

      this.updateIntervals(id);

      return () => {
        m.delete(sym);
        this.updateIntervals(id);
      };
    }
  }

  refetchIfUsed(api: ActionApi<InternalT<T>>, id?: ResourceID) {
    let subscribers:
      | Map<symbol, (api: ActionApi<InternalT<T>>) => Promise<void> | void>
      | undefined;
    if (id != null) {
      subscribers = this.perID.get(id);
    } else {
      subscribers = this.global;
    }

    if (subscribers) {
      for (const refetch of subscribers.values()) {
        return refetch(api);
      }
    }
  }
}
