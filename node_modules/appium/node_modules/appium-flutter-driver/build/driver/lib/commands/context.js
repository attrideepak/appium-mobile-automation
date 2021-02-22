"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.driverShouldDoProxyCmd = exports.getContexts = exports.setContext = exports.getCurrentContext = exports.FLUTTER_CONTEXT_NAME = void 0;
exports.FLUTTER_CONTEXT_NAME = `FLUTTER`;
exports.getCurrentContext = function () {
    return this.currentContext;
};
exports.setContext = function (context) {
    return (this.currentContext = context);
};
exports.getContexts = async function () {
    const nativeContext = await this.proxydriver.getContexts();
    return [...nativeContext, exports.FLUTTER_CONTEXT_NAME];
};
exports.driverShouldDoProxyCmd = function (command) {
    if (!this.proxydriver) {
        return false;
    }
    if (this.currentContext === exports.FLUTTER_CONTEXT_NAME) {
        return false;
    }
    // @todo what if we want to switch to webview of Native?
    if ([`getCurrentContext`, `setContext`, `getContexts`].includes(command)) {
        return false;
    }
    if (!this.proxydriver[command]) {
        return false;
    }
    return true;
};
//# sourceMappingURL=context.js.map