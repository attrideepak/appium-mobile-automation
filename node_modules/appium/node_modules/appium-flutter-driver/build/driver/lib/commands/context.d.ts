import { FlutterDriver } from '../driver';
export declare const FLUTTER_CONTEXT_NAME = "FLUTTER";
export declare const getCurrentContext: (this: FlutterDriver) => string;
export declare const setContext: (this: FlutterDriver, context: string) => string;
export declare const getContexts: (this: FlutterDriver) => Promise<any[]>;
export declare const driverShouldDoProxyCmd: (this: FlutterDriver, command: any) => boolean;
//# sourceMappingURL=context.d.ts.map