import type { StateCreator, StoreMutatorIdentifier } from "zustand";

type Logger = <
  T,
  Mps extends Array<[StoreMutatorIdentifier, unknown]> = [],
  Mcs extends Array<[StoreMutatorIdentifier, unknown]> = [],
>(
  f: StateCreator<T, Mps, Mcs>,
  name?: string,
) => StateCreator<T, Mps, Mcs>;

type LoggerImpl = <T>(
  f: StateCreator<T, [], []>,
  name?: string,
) => StateCreator<T, [], []>;

const loggerImpl: LoggerImpl = (f, name) => (set, get, store) => {
  const loggedSet: typeof set = (...args) => {
    set(...(args as Parameters<typeof set>));
    if (process.env.NODE_ENV === "development") {
      console.log(`[media-store${name ? `:${name}` : ""}]`, get());
    }
  };
  return f(loggedSet, get, store);
};

export const logger = loggerImpl as unknown as Logger;
