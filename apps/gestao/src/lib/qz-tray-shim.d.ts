declare module "qz-tray" {
  type ResolveFn = (value?: unknown) => void;

  const qz: {
    websocket: {
      isActive: () => boolean;
      connect: (opts?: { retries?: number; delay?: number }) => Promise<void>;
      disconnect: () => Promise<void>;
    };
    security: {
      setCertificatePromise: (
        handler: (resolve: ResolveFn, reject: (e?: unknown) => void) => void,
      ) => void;
      setSignaturePromise: (
        handler: (
          toSign: string,
        ) => (resolve: ResolveFn, reject: (e?: unknown) => void) => void,
      ) => void;
      setSignatureAlgorithm?: (alg: string) => void;
    };
    printers: {
      find: (query?: string) => Promise<string | string[]>;
    };
    configs: {
      create: (
        printer: string,
        opts?: { encoding?: string; forceRaw?: boolean },
      ) => unknown;
    };
    print: (
      config: unknown,
      data: Array<{
        type: string;
        format: string;
        flavor: string;
        data: string;
      }>,
    ) => Promise<void>;
  };

  export default qz;
}
