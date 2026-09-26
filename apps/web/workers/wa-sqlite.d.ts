// wa-sqlite ships no TypeScript declarations. The worker uses `any`-typed
// handles intentionally — the message protocol (DbWorkerRequest/Response) is
// the typed boundary. Revisit if @types/wa-sqlite ever exists.
declare module 'wa-sqlite/dist/wa-sqlite.mjs' {
  const SQLiteESMFactory: (opts?: { locateFile?: (file: string) => string }) => Promise<unknown>;
  export default SQLiteESMFactory;
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
