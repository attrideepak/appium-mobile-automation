/// <reference types="webdriver" />
/// <reference types="webdriverio/webdriverio-core" />
import type { DefaultOptions } from './types';
declare const REGION_MAPPING: {
    us: string;
    eu: string;
    'eu-central-1': string;
    'us-east-1': string;
};
export declare const validObjectOrArray: (object: any) => object is object | any[];
export declare function getSauceEndpoint(region: keyof typeof REGION_MAPPING, isRDC?: boolean): string;
export declare function removeLineNumbers(filePath: string): string;
export declare function isCucumberFeatureWithLineNumber(spec: string | string[]): boolean;
export declare function isCloudCapability(capabilities: WebDriver.DesiredCapabilities | WebdriverIO.MultiRemoteBrowserOptions): boolean;
interface BackendConfigurations {
    port?: number;
    hostname?: string;
    user?: string;
    key?: string;
    protocol?: string;
    region?: string;
    headless?: boolean;
    path?: string;
}
export declare function detectBackend(options?: BackendConfigurations, isRDC?: boolean): {
    hostname: string | undefined;
    port: number | undefined;
    protocol: string | undefined;
    path: string | undefined;
};
export declare function validateConfig<T>(defaults: DefaultOptions<T>, options: T, keysToKeep?: (keyof T)[]): T;
export {};
//# sourceMappingURL=utils.d.ts.map