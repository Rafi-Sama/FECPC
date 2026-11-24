// The API bundle (apps/api/dist/inprocess.js) is plain JavaScript; this is the one function the web app uses.
declare module '@fecpc/api/inprocess' {
  export function inject(opts: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload?: string;
  }): Promise<{
    statusCode: number;
    headers: Record<string, string | string[] | number | undefined>;
    rawPayload: Buffer;
  }>;
}
