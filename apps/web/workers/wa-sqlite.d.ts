// wa-sqlite ships no TypeScript declarations. The worker uses `any`-typed
// handles intentionally — the message protocol (DbWorkerRequest/Response) is
// the typed boundary. Revisit if @types/wa-sqlite ever exists.
declare module 'wa-sqlite/dist/wa-sqlite-async.mjs' {
  const SQLiteAsyncESMFactory: (opts?: {
    locateFile?: (file: string) => string
    /** Pre-fetched WASM bytes — skips the loader's internal fetch entirely. */
    wasmBinary?: Uint8Array | ArrayBuffer
  }) => Promise<unknown>;
  export default SQLiteAsyncESMFactory;
}

declare module 'wa-sqlite/src/sqlite-api.js' {
  export function Factory(module: unknown): any;
  export const SQLITE_OPEN_CREATE: number;
  export const SQLITE_OPEN_READWRITE: number;
}

declare module 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js' {
  export class OriginPrivateFileSystemVFS {
    constructor();
  }
}
