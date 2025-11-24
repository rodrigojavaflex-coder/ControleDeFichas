declare module 'node-firebird' {
  /* Minimal typing just to satisfy TS compile for DatabaseService. */
  interface AttachOptions {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    role?: string;
    charset?: string;
    lowercase_keys?: boolean;
  }

  interface FirebirdDb {
    query<T = any>(sql: string, params: Array<string | number>, cb: (err: Error | null, result: T[]) => void): void;
    detach(cb?: () => void): void;
  }

  export function attach(options: AttachOptions, cb: (err: Error | null, db: FirebirdDb) => void): void;
}
