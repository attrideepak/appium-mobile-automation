"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WebDriverAgent = exports.default = void 0;

require("source-map-support/register");

var _lodash = _interopRequireDefault(require("lodash"));

var _path = _interopRequireDefault(require("path"));

var _url2 = _interopRequireDefault(require("url"));

var _bluebird = _interopRequireDefault(require("bluebird"));

var _appiumBaseDriver = require("appium-base-driver");

var _appiumSupport = require("appium-support");

var _logger = _interopRequireDefault(require("./logger"));

var _noSessionProxy = require("./no-session-proxy");

var _utils = require("./utils");

var _xcodebuild = _interopRequireDefault(require("./xcodebuild"));

var _asyncLock = _interopRequireDefault(require("async-lock"));

var _teen_process = require("teen_process");

var _checkDependencies = require("./check-dependencies");

var _constants = require("./constants");

const WDA_LAUNCH_TIMEOUT = 60 * 1000;
const WDA_AGENT_PORT = 8100;
const WDA_CF_BUNDLE_NAME = 'WebDriverAgentRunner-Runner';
const SHARED_RESOURCES_GUARD = new _asyncLock.default();

class WebDriverAgent {
  constructor(xcodeVersion, args = {}) {
    this.xcodeVersion = xcodeVersion;
    this.args = _lodash.default.clone(args);
    this.device = args.device;
    this.platformVersion = args.platformVersion;
    this.platformName = args.platformName;
    this.iosSdkVersion = args.iosSdkVersion;
    this.host = args.host;
    this.isRealDevice = !!args.realDevice;
    this.idb = (args.device || {}).idb;
    this.wdaBundlePath = args.wdaBundlePath;
    this.setWDAPaths(args.bootstrapPath, args.agentPath);
    this.wdaLocalPort = args.wdaLocalPort;
    this.wdaRemotePort = args.wdaLocalPort || WDA_AGENT_PORT;
    this.wdaBaseUrl = args.wdaBaseUrl || _constants.WDA_BASE_URL;
    this.prebuildWDA = args.prebuildWDA;
    this.webDriverAgentUrl = args.webDriverAgentUrl;
    this.started = false;
    this.wdaConnectionTimeout = args.wdaConnectionTimeout;
    this.useXctestrunFile = args.useXctestrunFile;
    this.usePrebuiltWDA = args.usePrebuiltWDA;
    this.derivedDataPath = args.derivedDataPath;
    this.mjpegServerPort = args.mjpegServerPort;
    this.updatedWDABundleId = args.updatedWDABundleId;
    this.xcodebuild = new _xcodebuild.default(this.xcodeVersion, this.device, {
      platformVersion: this.platformVersion,
      platformName: this.platformName,
      iosSdkVersion: this.iosSdkVersion,
      agentPath: this.agentPath,
      bootstrapPath: this.bootstrapPath,
      realDevice: this.isRealDevice,
      showXcodeLog: args.showXcodeLog,
      xcodeConfigFile: args.xcodeConfigFile,
      xcodeOrgId: args.xcodeOrgId,
      xcodeSigningId: args.xcodeSigningId,
      keychainPath: args.keychainPath,
      keychainPassword: args.keychainPassword,
      useSimpleBuildTest: args.useSimpleBuildTest,
      usePrebuiltWDA: args.usePrebuiltWDA,
      updatedWDABundleId: this.updatedWDABundleId,
      launchTimeout: args.wdaLaunchTimeout || WDA_LAUNCH_TIMEOUT,
      wdaRemotePort: this.wdaRemotePort,
      useXctestrunFile: this.useXctestrunFile,
      derivedDataPath: args.derivedDataPath,
      mjpegServerPort: this.mjpegServerPort,
      allowProvisioningDeviceRegistration: args.allowProvisioningDeviceRegistration,
      resultBundlePath: args.resultBundlePath,
      resultBundleVersion: args.resultBundleVersion
    });
  }

  setWDAPaths(bootstrapPath, agentPath) {
    this.bootstrapPath = bootstrapPath || _constants.BOOTSTRAP_PATH;

    _logger.default.info(`Using WDA path: '${this.bootstrapPath}'`);

    this.agentPath = agentPath || _path.default.resolve(this.bootstrapPath, 'WebDriverAgent.xcodeproj');

    _logger.default.info(`Using WDA agent: '${this.agentPath}'`);
  }

  async cleanupObsoleteProcesses() {
    const obsoletePids = await (0, _utils.getPIDsListeningOnPort)(this.url.port, cmdLine => cmdLine.includes('/WebDriverAgentRunner') && !cmdLine.toLowerCase().includes(this.device.udid.toLowerCase()));

    if (_lodash.default.isEmpty(obsoletePids)) {
      _logger.default.debug(`No obsolete cached processes from previous WDA sessions ` + `listening on port ${this.url.port} have been found`);

      return;
    }

    _logger.default.info(`Detected ${obsoletePids.length} obsolete cached process${obsoletePids.length === 1 ? '' : 'es'} ` + `from previous WDA sessions. Cleaning them up`);

    try {
      await (0, _teen_process.exec)('kill', obsoletePids);
    } catch (e) {
      _logger.default.warn(`Failed to kill obsolete cached process${obsoletePids.length === 1 ? '' : 'es'} '${obsoletePids}'. ` + `Original error: ${e.message}`);
    }
  }

  async isRunning() {
    return !!(await this.getStatus());
  }

  get basePath() {
    if (this.url.path === '/') {
      return '';
    }

    return this.url.path || '';
  }

  async getStatus() {
    const noSessionProxy = new _noSessionProxy.NoSessionProxy({
      server: this.url.hostname,
      port: this.url.port,
      base: this.basePath,
      timeout: 3000
    });

    try {
      return await noSessionProxy.command('/status', 'GET');
    } catch (err) {
      _logger.default.debug(`WDA is not listening at '${this.url.href}'`);

      return null;
    }
  }

  async uninstall() {
    try {
      const bundleIds = await this.device.getUserInstalledBundleIdsByBundleName(WDA_CF_BUNDLE_NAME);

      if (_lodash.default.isEmpty(bundleIds)) {
        _logger.default.debug('No WDAs on the device.');

        return;
      }

      _logger.default.debug(`Uninstalling WDAs: '${bundleIds}'`);

      for (const bundleId of bundleIds) {
        await this.device.removeApp(bundleId);
      }
    } catch (e) {
      _logger.default.debug(e);

      _logger.default.warn(`WebDriverAgent uninstall failed. Perhaps, it is already uninstalled? ` + `Original error: ${e.message}`);
    }
  }

  async _cleanupProjectIfFresh() {
    const homeFolder = process.env.HOME;

    if (!homeFolder) {
      _logger.default.info('The HOME folder path cannot be determined');

      return;
    }

    const currentUpgradeTimestamp = await (0, _utils.getWDAUpgradeTimestamp)();

    if (!_lodash.default.isInteger(currentUpgradeTimestamp)) {
      _logger.default.info('It is impossible to determine the timestamp of the package');

      return;
    }

    const timestampPath = _path.default.resolve(homeFolder, _constants.WDA_UPGRADE_TIMESTAMP_PATH);

    if (await _appiumSupport.fs.exists(timestampPath)) {
      try {
        await _appiumSupport.fs.access(timestampPath, _appiumSupport.fs.W_OK);
      } catch (ign) {
        _logger.default.info(`WebDriverAgent upgrade timestamp at '${timestampPath}' is not writeable. ` + `Skipping sources cleanup`);

        return;
      }

      const recentUpgradeTimestamp = parseInt(await _appiumSupport.fs.readFile(timestampPath, 'utf8'), 10);

      if (_lodash.default.isInteger(recentUpgradeTimestamp)) {
        if (recentUpgradeTimestamp >= currentUpgradeTimestamp) {
          _logger.default.info(`WebDriverAgent does not need a cleanup. The sources are up to date ` + `(${recentUpgradeTimestamp} >= ${currentUpgradeTimestamp})`);

          return;
        }

        _logger.default.info(`WebDriverAgent sources have been upgraded ` + `(${recentUpgradeTimestamp} < ${currentUpgradeTimestamp})`);
      } else {
        _logger.default.warn(`The recent upgrade timestamp at '${timestampPath}' is corrupted. Trying to fix it`);
      }
    }

    try {
      await (0, _appiumSupport.mkdirp)(_path.default.dirname(timestampPath));
      await _appiumSupport.fs.writeFile(timestampPath, `${currentUpgradeTimestamp}`, 'utf8');

      _logger.default.debug(`Stored the recent WebDriverAgent upgrade timestamp ${currentUpgradeTimestamp} ` + `at '${timestampPath}'`);
    } catch (e) {
      _logger.default.info(`Unable to create the recent WebDriverAgent upgrade timestamp at '${timestampPath}'. ` + `Original error: ${e.message}`);

      return;
    }

    try {
      await this.xcodebuild.cleanProject();
    } catch (e) {
      _logger.default.warn(`Cannot perform WebDriverAgent project cleanup. Original error: ${e.message}`);
    }
  }

  async launch(sessionId) {
    if (this.webDriverAgentUrl) {
      _logger.default.info(`Using provided WebdriverAgent at '${this.webDriverAgentUrl}'`);

      this.url = this.webDriverAgentUrl;
      this.setupProxies(sessionId);
      return await this.getStatus();
    }

    _logger.default.info('Launching WebDriverAgent on the device');

    this.setupProxies(sessionId);

    if (!this.useXctestrunFile && !(await _appiumSupport.fs.exists(this.agentPath))) {
      throw new Error(`Trying to use WebDriverAgent project at '${this.agentPath}' but the ` + 'file does not exist');
    }

    if (this.idb || this.useXctestrunFile || this.derivedDataPath && this.usePrebuiltWDA) {
      _logger.default.info('Skipped WDA project cleanup according to the provided capabilities');
    } else {
      const synchronizationKey = _path.default.normalize(this.bootstrapPath);

      await SHARED_RESOURCES_GUARD.acquire(synchronizationKey, async () => await this._cleanupProjectIfFresh());
    }

    await (0, _utils.resetTestProcesses)(this.device.udid, !this.isRealDevice);

    if (this.idb) {
      return await this.startWithIDB();
    }

    await this.xcodebuild.init(this.noSessionProxy);

    if (this.prebuildWDA) {
      await this.xcodebuild.prebuild();
    }

    return await this.xcodebuild.start();
  }

  async startWithIDB() {
    _logger.default.info('Will launch WDA with idb instead of xcodebuild since the corresponding flag is enabled');

    const {
      wdaBundleId,
      testBundleId
    } = await this.prepareWDA();
    const env = {
      USE_PORT: this.wdaRemotePort,
      WDA_PRODUCT_BUNDLE_IDENTIFIER: this.updatedWDABundleId
    };

    if (this.mjpegServerPort) {
      env.MJPEG_SERVER_PORT = this.mjpegServerPort;
    }

    return await this.idb.runXCUITest(wdaBundleId, wdaBundleId, testBundleId, {
      env
    });
  }

  async parseBundleId(wdaBundlePath) {
    const infoPlistPath = _path.default.join(wdaBundlePath, 'Info.plist');

    const infoPlist = await _appiumSupport.plist.parsePlist(await _appiumSupport.fs.readFile(infoPlistPath));

    if (!infoPlist.CFBundleIdentifier) {
      throw new Error(`Could not find bundle id in '${infoPlistPath}'`);
    }

    return infoPlist.CFBundleIdentifier;
  }

  async prepareWDA() {
    const wdaBundlePath = this.wdaBundlePath || (await this.fetchWDABundle());
    const wdaBundleId = await this.parseBundleId(wdaBundlePath);

    if (!(await this.device.isAppInstalled(wdaBundleId))) {
      await this.device.installApp(wdaBundlePath);
    }

    const testBundleId = await this.idb.installXCTestBundle(_path.default.join(wdaBundlePath, 'PlugIns', 'WebDriverAgentRunner.xctest'));
    return {
      wdaBundleId,
      testBundleId,
      wdaBundlePath
    };
  }

  async fetchWDABundle() {
    if (!this.derivedDataPath) {
      return await (0, _checkDependencies.bundleWDASim)(this.xcodebuild);
    }

    const wdaBundlePaths = await _appiumSupport.fs.glob(`${this.derivedDataPath}/**/*${_constants.WDA_RUNNER_APP}/`, {
      absolute: true
    });

    if (_lodash.default.isEmpty(wdaBundlePaths)) {
      throw new Error(`Could not find the WDA bundle in '${this.derivedDataPath}'`);
    }

    return wdaBundlePaths[0];
  }

  async isSourceFresh() {
    const existsPromises = ['Resources', `Resources${_path.default.sep}WebDriverAgent.bundle`].map(subPath => _appiumSupport.fs.exists(_path.default.resolve(this.bootstrapPath, subPath)));
    return (await _bluebird.default.all(existsPromises)).some(v => v === false);
  }

  setupProxies(sessionId) {
    const proxyOpts = {
      server: this.url.hostname,
      port: this.url.port,
      base: this.basePath,
      timeout: this.wdaConnectionTimeout,
      keepAlive: true
    };
    this.jwproxy = new _appiumBaseDriver.JWProxy(proxyOpts);
    this.jwproxy.sessionId = sessionId;
    this.proxyReqRes = this.jwproxy.proxyReqRes.bind(this.jwproxy);
    this.noSessionProxy = new _noSessionProxy.NoSessionProxy(proxyOpts);
  }

  async quit() {
    _logger.default.info('Shutting down sub-processes');

    await this.xcodebuild.quit();
    await this.xcodebuild.reset();

    if (this.jwproxy) {
      this.jwproxy.sessionId = null;
    }

    this.started = false;

    if (!this.args.webDriverAgentUrl) {
      this.webDriverAgentUrl = null;
    }
  }

  get url() {
    if (!this._url) {
      if (this.webDriverAgentUrl) {
        this._url = _url2.default.parse(this.webDriverAgentUrl);
      } else {
        const port = this.wdaLocalPort || WDA_AGENT_PORT;

        const {
          protocol,
          hostname
        } = _url2.default.parse(this.wdaBaseUrl || _constants.WDA_BASE_URL);

        this._url = _url2.default.parse(`${protocol}//${hostname}:${port}`);
      }
    }

    return this._url;
  }

  set url(_url) {
    this._url = _url2.default.parse(_url);
  }

  get fullyStarted() {
    return this.started;
  }

  set fullyStarted(started = false) {
    this.started = started;
  }

  async retrieveDerivedDataPath() {
    return await this.xcodebuild.retrieveDerivedDataPath();
  }

  async setupCaching() {
    const status = await this.getStatus();

    if (!status || !status.build) {
      _logger.default.debug('WDA is currently not running. There is nothing to cache');

      return;
    }

    const {
      productBundleIdentifier,
      upgradedAt
    } = status.build;

    if (_appiumSupport.util.hasValue(productBundleIdentifier) && _appiumSupport.util.hasValue(this.updatedWDABundleId) && this.updatedWDABundleId !== productBundleIdentifier) {
      _logger.default.info(`Will uninstall running WDA since it has different bundle id. The actual value is '${productBundleIdentifier}'.`);

      return await this.uninstall();
    }

    if (_appiumSupport.util.hasValue(productBundleIdentifier) && !_appiumSupport.util.hasValue(this.updatedWDABundleId) && _constants.WDA_RUNNER_BUNDLE_ID !== productBundleIdentifier) {
      _logger.default.info(`Will uninstall running WDA since its bundle id is not equal to the default value ${_constants.WDA_RUNNER_BUNDLE_ID}`);

      return await this.uninstall();
    }

    const actualUpgradeTimestamp = await (0, _utils.getWDAUpgradeTimestamp)();

    _logger.default.debug(`Upgrade timestamp of the currently bundled WDA: ${actualUpgradeTimestamp}`);

    _logger.default.debug(`Upgrade timestamp of the WDA on the device: ${upgradedAt}`);

    if (actualUpgradeTimestamp && upgradedAt && _lodash.default.toLower(`${actualUpgradeTimestamp}`) !== _lodash.default.toLower(`${upgradedAt}`)) {
      _logger.default.info('Will uninstall running WDA since it has different version in comparison to the one ' + `which is bundled with appium-xcuitest-driver module (${actualUpgradeTimestamp} != ${upgradedAt})`);

      return await this.uninstall();
    }

    const message = _appiumSupport.util.hasValue(productBundleIdentifier) ? `Will reuse previously cached WDA instance at '${this.url.href}' with '${productBundleIdentifier}'` : `Will reuse previously cached WDA instance at '${this.url.href}'`;

    _logger.default.info(`${message}. Set the wdaLocalPort capability to a value different from ${this.url.port} if this is an undesired behavior.`);

    this.webDriverAgentUrl = this.url.href;
  }

  async quitAndUninstall() {
    await this.quit();
    await this.uninstall();
  }

}

exports.WebDriverAgent = WebDriverAgent;
var _default = WebDriverAgent;
exports.default = _default;require('source-map-support').install();


//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxpYi93ZWJkcml2ZXJhZ2VudC5qcyJdLCJuYW1lcyI6WyJXREFfTEFVTkNIX1RJTUVPVVQiLCJXREFfQUdFTlRfUE9SVCIsIldEQV9DRl9CVU5ETEVfTkFNRSIsIlNIQVJFRF9SRVNPVVJDRVNfR1VBUkQiLCJBc3luY0xvY2siLCJXZWJEcml2ZXJBZ2VudCIsImNvbnN0cnVjdG9yIiwieGNvZGVWZXJzaW9uIiwiYXJncyIsIl8iLCJjbG9uZSIsImRldmljZSIsInBsYXRmb3JtVmVyc2lvbiIsInBsYXRmb3JtTmFtZSIsImlvc1Nka1ZlcnNpb24iLCJob3N0IiwiaXNSZWFsRGV2aWNlIiwicmVhbERldmljZSIsImlkYiIsIndkYUJ1bmRsZVBhdGgiLCJzZXRXREFQYXRocyIsImJvb3RzdHJhcFBhdGgiLCJhZ2VudFBhdGgiLCJ3ZGFMb2NhbFBvcnQiLCJ3ZGFSZW1vdGVQb3J0Iiwid2RhQmFzZVVybCIsIldEQV9CQVNFX1VSTCIsInByZWJ1aWxkV0RBIiwid2ViRHJpdmVyQWdlbnRVcmwiLCJzdGFydGVkIiwid2RhQ29ubmVjdGlvblRpbWVvdXQiLCJ1c2VYY3Rlc3RydW5GaWxlIiwidXNlUHJlYnVpbHRXREEiLCJkZXJpdmVkRGF0YVBhdGgiLCJtanBlZ1NlcnZlclBvcnQiLCJ1cGRhdGVkV0RBQnVuZGxlSWQiLCJ4Y29kZWJ1aWxkIiwiWGNvZGVCdWlsZCIsInNob3dYY29kZUxvZyIsInhjb2RlQ29uZmlnRmlsZSIsInhjb2RlT3JnSWQiLCJ4Y29kZVNpZ25pbmdJZCIsImtleWNoYWluUGF0aCIsImtleWNoYWluUGFzc3dvcmQiLCJ1c2VTaW1wbGVCdWlsZFRlc3QiLCJsYXVuY2hUaW1lb3V0Iiwid2RhTGF1bmNoVGltZW91dCIsImFsbG93UHJvdmlzaW9uaW5nRGV2aWNlUmVnaXN0cmF0aW9uIiwicmVzdWx0QnVuZGxlUGF0aCIsInJlc3VsdEJ1bmRsZVZlcnNpb24iLCJCT09UU1RSQVBfUEFUSCIsImxvZyIsImluZm8iLCJwYXRoIiwicmVzb2x2ZSIsImNsZWFudXBPYnNvbGV0ZVByb2Nlc3NlcyIsIm9ic29sZXRlUGlkcyIsInVybCIsInBvcnQiLCJjbWRMaW5lIiwiaW5jbHVkZXMiLCJ0b0xvd2VyQ2FzZSIsInVkaWQiLCJpc0VtcHR5IiwiZGVidWciLCJsZW5ndGgiLCJlIiwid2FybiIsIm1lc3NhZ2UiLCJpc1J1bm5pbmciLCJnZXRTdGF0dXMiLCJiYXNlUGF0aCIsIm5vU2Vzc2lvblByb3h5IiwiTm9TZXNzaW9uUHJveHkiLCJzZXJ2ZXIiLCJob3N0bmFtZSIsImJhc2UiLCJ0aW1lb3V0IiwiY29tbWFuZCIsImVyciIsImhyZWYiLCJ1bmluc3RhbGwiLCJidW5kbGVJZHMiLCJnZXRVc2VySW5zdGFsbGVkQnVuZGxlSWRzQnlCdW5kbGVOYW1lIiwiYnVuZGxlSWQiLCJyZW1vdmVBcHAiLCJfY2xlYW51cFByb2plY3RJZkZyZXNoIiwiaG9tZUZvbGRlciIsInByb2Nlc3MiLCJlbnYiLCJIT01FIiwiY3VycmVudFVwZ3JhZGVUaW1lc3RhbXAiLCJpc0ludGVnZXIiLCJ0aW1lc3RhbXBQYXRoIiwiV0RBX1VQR1JBREVfVElNRVNUQU1QX1BBVEgiLCJmcyIsImV4aXN0cyIsImFjY2VzcyIsIldfT0siLCJpZ24iLCJyZWNlbnRVcGdyYWRlVGltZXN0YW1wIiwicGFyc2VJbnQiLCJyZWFkRmlsZSIsImRpcm5hbWUiLCJ3cml0ZUZpbGUiLCJjbGVhblByb2plY3QiLCJsYXVuY2giLCJzZXNzaW9uSWQiLCJzZXR1cFByb3hpZXMiLCJFcnJvciIsInN5bmNocm9uaXphdGlvbktleSIsIm5vcm1hbGl6ZSIsImFjcXVpcmUiLCJzdGFydFdpdGhJREIiLCJpbml0IiwicHJlYnVpbGQiLCJzdGFydCIsIndkYUJ1bmRsZUlkIiwidGVzdEJ1bmRsZUlkIiwicHJlcGFyZVdEQSIsIlVTRV9QT1JUIiwiV0RBX1BST0RVQ1RfQlVORExFX0lERU5USUZJRVIiLCJNSlBFR19TRVJWRVJfUE9SVCIsInJ1blhDVUlUZXN0IiwicGFyc2VCdW5kbGVJZCIsImluZm9QbGlzdFBhdGgiLCJqb2luIiwiaW5mb1BsaXN0IiwicGxpc3QiLCJwYXJzZVBsaXN0IiwiQ0ZCdW5kbGVJZGVudGlmaWVyIiwiZmV0Y2hXREFCdW5kbGUiLCJpc0FwcEluc3RhbGxlZCIsImluc3RhbGxBcHAiLCJpbnN0YWxsWENUZXN0QnVuZGxlIiwid2RhQnVuZGxlUGF0aHMiLCJnbG9iIiwiV0RBX1JVTk5FUl9BUFAiLCJhYnNvbHV0ZSIsImlzU291cmNlRnJlc2giLCJleGlzdHNQcm9taXNlcyIsInNlcCIsIm1hcCIsInN1YlBhdGgiLCJCIiwiYWxsIiwic29tZSIsInYiLCJwcm94eU9wdHMiLCJrZWVwQWxpdmUiLCJqd3Byb3h5IiwiSldQcm94eSIsInByb3h5UmVxUmVzIiwiYmluZCIsInF1aXQiLCJyZXNldCIsIl91cmwiLCJwYXJzZSIsInByb3RvY29sIiwiZnVsbHlTdGFydGVkIiwicmV0cmlldmVEZXJpdmVkRGF0YVBhdGgiLCJzZXR1cENhY2hpbmciLCJzdGF0dXMiLCJidWlsZCIsInByb2R1Y3RCdW5kbGVJZGVudGlmaWVyIiwidXBncmFkZWRBdCIsInV0aWwiLCJoYXNWYWx1ZSIsIldEQV9SVU5ORVJfQlVORExFX0lEIiwiYWN0dWFsVXBncmFkZVRpbWVzdGFtcCIsInRvTG93ZXIiLCJxdWl0QW5kVW5pbnN0YWxsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUdBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUtBLE1BQU1BLGtCQUFrQixHQUFHLEtBQUssSUFBaEM7QUFDQSxNQUFNQyxjQUFjLEdBQUcsSUFBdkI7QUFDQSxNQUFNQyxrQkFBa0IsR0FBRyw2QkFBM0I7QUFDQSxNQUFNQyxzQkFBc0IsR0FBRyxJQUFJQyxrQkFBSixFQUEvQjs7QUFFQSxNQUFNQyxjQUFOLENBQXFCO0FBQ25CQyxFQUFBQSxXQUFXLENBQUVDLFlBQUYsRUFBZ0JDLElBQUksR0FBRyxFQUF2QixFQUEyQjtBQUNw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O0FBRUQsVUFBTXdGLHNCQUFzQixHQUFHLE1BQU0sb0NBQXJDOztBQUNBdEgsb0JBQUlhLEtBQUosQ0FBVyxtREFBa0R5RyxzQkFBdUIsRUFBcEY7O0FBQ0F0SCxvQkFBSWEsS0FBSixDQUFXLCtDQUE4Q3FHLFVBQVcsRUFBcEU7O0FBQ0EsUUFBSUksc0JBQXNCLElBQUlKLFVBQTFCLElBQXdDNUosZ0JBQUVpSyxPQUFGLENBQVcsR0FBRUQsc0JBQXVCLEVBQXBDLE1BQTJDaEssZ0JBQUVpSyxPQUFGLENBQVcsR0FBRUwsVUFBVyxFQUF4QixDQUF2RixFQUFtSDtBQUNqSGxILHNCQUFJQyxJQUFKLENBQVMsd0ZBQ04sd0RBQXVEcUgsc0JBQXVCLE9BQU1KLFVBQVcsR0FEbEc7O0FBRUEsYUFBTyxNQUFNLEtBQUtwRixTQUFMLEVBQWI7QUFDRDs7QUFFRCxVQUFNYixPQUFPLEdBQUdrRyxvQkFBS0MsUUFBTCxDQUFjSCx1QkFBZCxJQUNYLGlEQUFnRCxLQUFLM0csR0FBTCxDQUFTdUIsSUFBSyxXQUFVb0YsdUJBQXdCLEdBRHJGLEdBRVgsaURBQWdELEtBQUszRyxHQUFMLENBQVN1QixJQUFLLEdBRm5FOztBQUdBN0Isb0JBQUlDLElBQUosQ0FBVSxHQUFFZ0IsT0FBUSwrREFBOEQsS0FBS1gsR0FBTCxDQUFTQyxJQUFLLG9DQUFoRzs7QUFDQSxTQUFLOUIsaUJBQUwsR0FBeUIsS0FBSzZCLEdBQUwsQ0FBU3VCLElBQWxDO0FBQ0Q7O0FBS0QsUUFBTTJGLGdCQUFOLEdBQTBCO0FBQ3hCLFVBQU0sS0FBS2pCLElBQUwsRUFBTjtBQUNBLFVBQU0sS0FBS3pFLFNBQUwsRUFBTjtBQUNEOztBQTdja0I7OztlQWdkTjVFLGMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgQiBmcm9tICdibHVlYmlyZCc7XG5pbXBvcnQgeyBKV1Byb3h5IH0gZnJvbSAnYXBwaXVtLWJhc2UtZHJpdmVyJztcbmltcG9ydCB7IGZzLCB1dGlsLCBwbGlzdCwgbWtkaXJwIH0gZnJvbSAnYXBwaXVtLXN1cHBvcnQnO1xuaW1wb3J0IGxvZyBmcm9tICcuL2xvZ2dlcic7XG5pbXBvcnQgeyBOb1Nlc3Npb25Qcm94eSB9IGZyb20gJy4vbm8tc2Vzc2lvbi1wcm94eSc7XG5pbXBvcnQge1xuICBnZXRXREFVcGdyYWRlVGltZXN0YW1wLCByZXNldFRlc3RQcm9jZXNzZXMsIGdldFBJRHNMaXN0ZW5pbmdPblBvcnRcbn0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgWGNvZGVCdWlsZCBmcm9tICcuL3hjb2RlYnVpbGQnO1xuaW1wb3J0IEFzeW5jTG9jayBmcm9tICdhc3luYy1sb2NrJztcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICd0ZWVuX3Byb2Nlc3MnO1xuaW1wb3J0IHsgYnVuZGxlV0RBU2ltIH0gZnJvbSAnLi9jaGVjay1kZXBlbmRlbmNpZXMnO1xuaW1wb3J0IHtcbiAgQk9PVFNUUkFQX1BBVEgsIFdEQV9SVU5ORVJfQlVORExFX0lELCBXREFfUlVOTkVSX0FQUCxcbiAgV0RBX0JBU0VfVVJMLCBXREFfVVBHUkFERV9USU1FU1RBTVBfUEFUSCxcbn0gZnJvbSAnLi9jb25zdGFudHMnO1xuXG5jb25zdCBXREFfTEFVTkNIX1RJTUVPVVQgPSA2MCAqIDEwMDA7XG5jb25zdCBXREFfQUdFTlRfUE9SVCA9IDgxMDA7XG5jb25zdCBXREFfQ0ZfQlVORExFX05BTUUgPSAnV2ViRHJpdmVyQWdlbnRSdW5uZXItUnVubmVyJztcbmNvbnN0IFNIQVJFRF9SRVNPVVJDRVNfR1VBUkQgPSBuZXcgQXN5bmNMb2NrKCk7XG5cbmNsYXNzIFdlYkRyaXZlckFnZW50IHtcbiAgY29uc3RydWN0b3IgKHhjb2RlVmVyc2lvbiwgYXJncyA9IHt9KSB7XG4gICAgdGhpcy54Y29kZVZlcnNpb24gPSB4Y29kZVZlcnNpb247XG5cbiAgICB0aGlzLmFyZ3MgPSBfLmNsb25lKGFyZ3MpO1xuXG4gICAgdGhpcy5kZXZpY2UgPSBhcmdzLmRldmljZTtcbiAgICB0aGlzLnBsYXRmb3JtVmVyc2lvbiA9IGFyZ3MucGxhdGZvcm1WZXJzaW9uO1xuICAgIHRoaXMucGxhdGZvcm1OYW1lID0gYXJncy5wbGF0Zm9ybU5hbWU7XG4gICAgdGhpcy5pb3NTZGtWZXJzaW9uID0gYXJncy5pb3NTZGtWZXJzaW9uO1xuICAgIHRoaXMuaG9zdCA9IGFyZ3MuaG9zdDtcbiAgICB0aGlzLmlzUmVhbERldmljZSA9ICEhYXJncy5yZWFsRGV2aWNlO1xuICAgIHRoaXMuaWRiID0gKGFyZ3MuZGV2aWNlIHx8IHt9KS5pZGI7XG4gICAgdGhpcy53ZGFCdW5kbGVQYXRoID0gYXJncy53ZGFCdW5kbGVQYXRoO1xuXG4gICAgdGhpcy5zZXRXREFQYXRocyhhcmdzLmJvb3RzdHJhcFBhdGgsIGFyZ3MuYWdlbnRQYXRoKTtcblxuICAgIHRoaXMud2RhTG9jYWxQb3J0ID0gYXJncy53ZGFMb2NhbFBvcnQ7XG4gICAgdGhpcy53ZGFSZW1vdGVQb3J0ID0gYXJncy53ZGFMb2NhbFBvcnQgfHwgV0RBX0FHRU5UX1BPUlQ7XG4gICAgdGhpcy53ZGFCYXNlVXJsID0gYXJncy53ZGFCYXNlVXJsIHx8IFdEQV9CQVNFX1VSTDtcblxuICAgIHRoaXMucHJlYnVpbGRXREEgPSBhcmdzLnByZWJ1aWxkV0RBO1xuXG4gICAgdGhpcy53ZWJEcml2ZXJBZ2VudFVybCA9IGFyZ3Mud2ViRHJpdmVyQWdlbnRVcmw7XG5cbiAgICB0aGlzLnN0YXJ0ZWQgPSBmYWxzZTtcblxuICAgIHRoaXMud2RhQ29ubmVjdGlvblRpbWVvdXQgPSBhcmdzLndkYUNvbm5lY3Rpb25UaW1lb3V0O1xuXG4gICAgdGhpcy51c2VYY3Rlc3RydW5GaWxlID0gYXJncy51c2VYY3Rlc3RydW5GaWxlO1xuICAgIHRoaXMudXNlUHJlYnVpbHRXREEgPSBhcmdzLnVzZVByZWJ1aWx0V0RBO1xuICAgIHRoaXMuZGVyaXZlZERhdGFQYXRoID0gYXJncy5kZXJpdmVkRGF0YVBhdGg7XG4gICAgdGhpcy5tanBlZ1NlcnZlclBvcnQgPSBhcmdzLm1qcGVnU2VydmVyUG9ydDtcblxuICAgIHRoaXMudXBkYXRlZFdEQUJ1bmRsZUlkID0gYXJncy51cGRhdGVkV0RBQnVuZGxlSWQ7XG5cbiAgICB0aGlzLnhjb2RlYnVpbGQgPSBuZXcgWGNvZGVCdWlsZCh0aGlzLnhjb2RlVmVyc2lvbiwgdGhpcy5kZXZpY2UsIHtcbiAgICAgIHBsYXRmb3JtVmVyc2lvbjogdGhpcy5wbGF0Zm9ybVZlcnNpb24sXG4gICAgICBwbGF0Zm9ybU5hbWU6IHRoaXMucGxhdGZvcm1OYW1lLFxuICAgICAgaW9zU2RrVmVyc2lvbjogdGhpcy5pb3NTZGtWZXJzaW9uLFxuICAgICAgYWdlbnRQYXRoOiB0aGlzLmFnZW50UGF0aCxcbiAgICAgIGJvb3RzdHJhcFBhdGg6IHRoaXMuYm9vdHN0cmFwUGF0aCxcbiAgICAgIHJlYWxEZXZpY2U6IHRoaXMuaXNSZWFsRGV2aWNlLFxuICAgICAgc2hvd1hjb2RlTG9nOiBhcmdzLnNob3dYY29kZUxvZyxcbiAgICAgIHhjb2RlQ29uZmlnRmlsZTogYXJncy54Y29kZUNvbmZpZ0ZpbGUsXG4gICAgICB4Y29kZU9yZ0lkOiBhcmdzLnhjb2RlT3JnSWQsXG4gICAgICB4Y29kZVNpZ25pbmdJZDogYXJncy54Y29kZVNpZ25pbmdJZCxcbiAgICAgIGtleWNoYWluUGF0aDogYXJncy5rZXljaGFpblBhdGgsXG4gICAgICBrZXljaGFpblBhc3N3b3JkOiBhcmdzLmtleWNoYWluUGFzc3dvcmQsXG4gICAgICB1c2VTaW1wbGVCdWlsZFRlc3Q6IGFyZ3MudXNlU2ltcGxlQnVpbGRUZXN0LFxuICAgICAgdXNlUHJlYnVpbHRXREE6IGFyZ3MudXNlUHJlYnVpbHRXREEsXG4gICAgICB1cGRhdGVkV0RBQnVuZGxlSWQ6IHRoaXMudXBkYXRlZFdEQUJ1bmRsZUlkLFxuICAgICAgbGF1bmNoVGltZW91dDogYXJncy53ZGFMYXVuY2hUaW1lb3V0IHx8IFdEQV9MQVVOQ0hfVElNRU9VVCxcbiAgICAgIHdkYVJlbW90ZVBvcnQ6IHRoaXMud2RhUmVtb3RlUG9ydCxcbiAgICAgIHVzZVhjdGVzdHJ1bkZpbGU6IHRoaXMudXNlWGN0ZXN0cnVuRmlsZSxcbiAgICAgIGRlcml2ZWREYXRhUGF0aDogYXJncy5kZXJpdmVkRGF0YVBhdGgsXG4gICAgICBtanBlZ1NlcnZlclBvcnQ6IHRoaXMubWpwZWdTZXJ2ZXJQb3J0LFxuICAgICAgYWxsb3dQcm92aXNpb25pbmdEZXZpY2VSZWdpc3RyYXRpb246IGFyZ3MuYWxsb3dQcm92aXNpb25pbmdEZXZpY2VSZWdpc3RyYXRpb24sXG4gICAgICByZXN1bHRCdW5kbGVQYXRoOiBhcmdzLnJlc3VsdEJ1bmRsZVBhdGgsXG4gICAgICByZXN1bHRCdW5kbGVWZXJzaW9uOiBhcmdzLnJlc3VsdEJ1bmRsZVZlcnNpb24sXG4gICAgfSk7XG4gIH1cblxuICBzZXRXREFQYXRocyAoYm9vdHN0cmFwUGF0aCwgYWdlbnRQYXRoKSB7XG4gICAgLy8gYWxsb3cgdGhlIHVzZXIgdG8gc3BlY2lmeSBhIHBsYWNlIGZvciBXREEuIFRoaXMgaXMgdW5kb2N1bWVudGVkIGFuZFxuICAgIC8vIG9ubHkgaGVyZSBmb3IgdGhlIHB1cnBvc2VzIG9mIHRlc3RpbmcgZGV2ZWxvcG1lbnQgb2YgV0RBXG4gICAgdGhpcy5ib290c3RyYXBQYXRoID0gYm9vdHN0cmFwUGF0aCB8fCBCT09UU1RSQVBfUEFUSDtcbiAgICBsb2cuaW5mbyhgVXNpbmcgV0RBIHBhdGg6ICcke3RoaXMuYm9vdHN0cmFwUGF0aH0nYCk7XG5cbiAgICAvLyBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eSB3ZSBuZWVkIHRvIGJlIGFibGUgdG8gc3BlY2lmeSBhZ2VudFBhdGggdG9vXG4gICAgdGhpcy5hZ2VudFBhdGggPSBhZ2VudFBhdGggfHwgcGF0aC5yZXNvbHZlKHRoaXMuYm9vdHN0cmFwUGF0aCwgJ1dlYkRyaXZlckFnZW50Lnhjb2RlcHJvaicpO1xuICAgIGxvZy5pbmZvKGBVc2luZyBXREEgYWdlbnQ6ICcke3RoaXMuYWdlbnRQYXRofSdgKTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFudXBPYnNvbGV0ZVByb2Nlc3NlcyAoKSB7XG4gICAgY29uc3Qgb2Jzb2xldGVQaWRzID0gYXdhaXQgZ2V0UElEc0xpc3RlbmluZ09uUG9ydCh0aGlzLnVybC5wb3J0LFxuICAgICAgKGNtZExpbmUpID0+IGNtZExpbmUuaW5jbHVkZXMoJy9XZWJEcml2ZXJBZ2VudFJ1bm5lcicpICYmXG4gICAgICAgICFjbWRMaW5lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModGhpcy5kZXZpY2UudWRpZC50b0xvd2VyQ2FzZSgpKSk7XG5cbiAgICBpZiAoXy5pc0VtcHR5KG9ic29sZXRlUGlkcykpIHtcbiAgICAgIGxvZy5kZWJ1ZyhgTm8gb2Jzb2xldGUgY2FjaGVkIHByb2Nlc3NlcyBmcm9tIHByZXZpb3VzIFdEQSBzZXNzaW9ucyBgICtcbiAgICAgICAgYGxpc3RlbmluZyBvbiBwb3J0ICR7dGhpcy51cmwucG9ydH0gaGF2ZSBiZWVuIGZvdW5kYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbG9nLmluZm8oYERldGVjdGVkICR7b2Jzb2xldGVQaWRzLmxlbmd0aH0gb2Jzb2xldGUgY2FjaGVkIHByb2Nlc3Mke29ic29sZXRlUGlkcy5sZW5ndGggPT09IDEgPyAnJyA6ICdlcyd9IGAgK1xuICAgICAgYGZyb20gcHJldmlvdXMgV0RBIHNlc3Npb25zLiBDbGVhbmluZyB0aGVtIHVwYCk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGV4ZWMoJ2tpbGwnLCBvYnNvbGV0ZVBpZHMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxvZy53YXJuKGBGYWlsZWQgdG8ga2lsbCBvYnNvbGV0ZSBjYWNoZWQgcHJvY2VzcyR7b2Jzb2xldGVQaWRzLmxlbmd0aCA9PT0gMSA/ICcnIDogJ2VzJ30gJyR7b2Jzb2xldGVQaWRzfScuIGAgK1xuICAgICAgICBgT3JpZ2luYWwgZXJyb3I6ICR7ZS5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYm9vbGVhbiBpZiBXREEgaXMgcnVubmluZyBvciBub3RcbiAgICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiBXREEgaXMgcnVubmluZ1xuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlcmUgd2FzIGludmFsaWQgcmVzcG9uc2UgY29kZSBvciBib2R5XG4gICAqL1xuICBhc3luYyBpc1J1bm5pbmcgKCkge1xuICAgIHJldHVybiAhIShhd2FpdCB0aGlzLmdldFN0YXR1cygpKTtcbiAgfVxuXG4gIGdldCBiYXNlUGF0aCAoKSB7XG4gICAgaWYgKHRoaXMudXJsLnBhdGggPT09ICcvJykge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy51cmwucGF0aCB8fCAnJztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gY3VycmVudCBydW5uaW5nIFdEQSdzIHN0YXR1cyBsaWtlIGJlbG93XG4gICAqIHtcbiAgICogICBcInN0YXRlXCI6IFwic3VjY2Vzc1wiLFxuICAgKiAgIFwib3NcIjoge1xuICAgKiAgICAgXCJuYW1lXCI6IFwiaU9TXCIsXG4gICAqICAgICBcInZlcnNpb25cIjogXCIxMS40XCIsXG4gICAqICAgICBcInNka1ZlcnNpb25cIjogXCIxMS4zXCJcbiAgICogICB9LFxuICAgKiAgIFwiaW9zXCI6IHtcbiAgICogICAgIFwic2ltdWxhdG9yVmVyc2lvblwiOiBcIjExLjRcIixcbiAgICogICAgIFwiaXBcIjogXCIxNzIuMjU0Ljk5LjM0XCJcbiAgICogICB9LFxuICAgKiAgIFwiYnVpbGRcIjoge1xuICAgKiAgICAgXCJ0aW1lXCI6IFwiSnVuIDI0IDIwMTggMTc6MDg6MjFcIixcbiAgICogICAgIFwicHJvZHVjdEJ1bmRsZUlkZW50aWZpZXJcIjogXCJjb20uZmFjZWJvb2suV2ViRHJpdmVyQWdlbnRSdW5uZXJcIlxuICAgKiAgIH1cbiAgICogfVxuICAgKlxuICAgKiBAcmV0dXJuIHs/b2JqZWN0fSBTdGF0ZSBPYmplY3RcbiAgICogQHRocm93cyB7RXJyb3J9IElmIHRoZXJlIHdhcyBpbnZhbGlkIHJlc3BvbnNlIGNvZGUgb3IgYm9keVxuICAgKi9cbiAgYXN5bmMgZ2V0U3RhdHVzICgpIHtcbiAgICBjb25zdCBub1Nlc3Npb25Qcm94eSA9IG5ldyBOb1Nlc3Npb25Qcm94eSh7XG4gICAgICBzZXJ2ZXI6IHRoaXMudXJsLmhvc3RuYW1lLFxuICAgICAgcG9ydDogdGhpcy51cmwucG9ydCxcbiAgICAgIGJhc2U6IHRoaXMuYmFzZVBhdGgsXG4gICAgICB0aW1lb3V0OiAzMDAwLFxuICAgIH0pO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgbm9TZXNzaW9uUHJveHkuY29tbWFuZCgnL3N0YXR1cycsICdHRVQnKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGxvZy5kZWJ1ZyhgV0RBIGlzIG5vdCBsaXN0ZW5pbmcgYXQgJyR7dGhpcy51cmwuaHJlZn0nYCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVW5pbnN0YWxsIFdEQXMgZnJvbSB0aGUgdGVzdCBkZXZpY2UuXG4gICAqIE92ZXIgWGNvZGUgMTEsIG11bHRpcGxlIFdEQSBjYW4gYmUgaW4gdGhlIGRldmljZSBzaW5jZSBYY29kZSAxMSBnZW5lcmF0ZXMgZGlmZmVyZW50IFdEQS5cbiAgICogQXBwaXVtIGRvZXMgbm90IGV4cGVjdCBtdWx0aXBsZSBXREFzIGFyZSBydW5uaW5nIG9uIGEgZGV2aWNlLlxuICAgKi9cbiAgYXN5bmMgdW5pbnN0YWxsICgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYnVuZGxlSWRzID0gYXdhaXQgdGhpcy5kZXZpY2UuZ2V0VXNlckluc3RhbGxlZEJ1bmRsZUlkc0J5QnVuZGxlTmFtZShXREFfQ0ZfQlVORExFX05BTUUpO1xuICAgICAgaWYgKF8uaXNFbXB0eShidW5kbGVJZHMpKSB7XG4gICAgICAgIGxvZy5kZWJ1ZygnTm8gV0RBcyBvbiB0aGUgZGV2aWNlLicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxvZy5kZWJ1ZyhgVW5pbnN0YWxsaW5nIFdEQXM6ICcke2J1bmRsZUlkc30nYCk7XG4gICAgICBmb3IgKGNvbnN0IGJ1bmRsZUlkIG9mIGJ1bmRsZUlkcykge1xuICAgICAgICBhd2FpdCB0aGlzLmRldmljZS5yZW1vdmVBcHAoYnVuZGxlSWQpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxvZy5kZWJ1ZyhlKTtcbiAgICAgIGxvZy53YXJuKGBXZWJEcml2ZXJBZ2VudCB1bmluc3RhbGwgZmFpbGVkLiBQZXJoYXBzLCBpdCBpcyBhbHJlYWR5IHVuaW5zdGFsbGVkPyBgICtcbiAgICAgICAgYE9yaWdpbmFsIGVycm9yOiAke2UubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBfY2xlYW51cFByb2plY3RJZkZyZXNoICgpIHtcbiAgICBjb25zdCBob21lRm9sZGVyID0gcHJvY2Vzcy5lbnYuSE9NRTtcbiAgICBpZiAoIWhvbWVGb2xkZXIpIHtcbiAgICAgIGxvZy5pbmZvKCdUaGUgSE9NRSBmb2xkZXIgcGF0aCBjYW5ub3QgYmUgZGV0ZXJtaW5lZCcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnJlbnRVcGdyYWRlVGltZXN0YW1wID0gYXdhaXQgZ2V0V0RBVXBncmFkZVRpbWVzdGFtcCgpO1xuICAgIGlmICghXy5pc0ludGVnZXIoY3VycmVudFVwZ3JhZGVUaW1lc3RhbXApKSB7XG4gICAgICBsb2cuaW5mbygnSXQgaXMgaW1wb3NzaWJsZSB0byBkZXRlcm1pbmUgdGhlIHRpbWVzdGFtcCBvZiB0aGUgcGFja2FnZScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRpbWVzdGFtcFBhdGggPSBwYXRoLnJlc29sdmUoaG9tZUZvbGRlciwgV0RBX1VQR1JBREVfVElNRVNUQU1QX1BBVEgpO1xuICAgIGlmIChhd2FpdCBmcy5leGlzdHModGltZXN0YW1wUGF0aCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGZzLmFjY2Vzcyh0aW1lc3RhbXBQYXRoLCBmcy5XX09LKTtcbiAgICAgIH0gY2F0Y2ggKGlnbikge1xuICAgICAgICBsb2cuaW5mbyhgV2ViRHJpdmVyQWdlbnQgdXBncmFkZSB0aW1lc3RhbXAgYXQgJyR7dGltZXN0YW1wUGF0aH0nIGlzIG5vdCB3cml0ZWFibGUuIGAgK1xuICAgICAgICAgIGBTa2lwcGluZyBzb3VyY2VzIGNsZWFudXBgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgcmVjZW50VXBncmFkZVRpbWVzdGFtcCA9IHBhcnNlSW50KGF3YWl0IGZzLnJlYWRGaWxlKHRpbWVzdGFtcFBhdGgsICd1dGY4JyksIDEwKTtcbiAgICAgIGlmIChfLmlzSW50ZWdlcihyZWNlbnRVcGdyYWRlVGltZXN0YW1wKSkge1xuICAgICAgICBpZiAocmVjZW50VXBncmFkZVRpbWVzdGFtcCA+PSBjdXJyZW50VXBncmFkZVRpbWVzdGFtcCkge1xuICAgICAgICAgIGxvZy5pbmZvKGBXZWJEcml2ZXJBZ2VudCBkb2VzIG5vdCBuZWVkIGEgY2xlYW51cC4gVGhlIHNvdXJjZXMgYXJlIHVwIHRvIGRhdGUgYCArXG4gICAgICAgICAgICBgKCR7cmVjZW50VXBncmFkZVRpbWVzdGFtcH0gPj0gJHtjdXJyZW50VXBncmFkZVRpbWVzdGFtcH0pYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxvZy5pbmZvKGBXZWJEcml2ZXJBZ2VudCBzb3VyY2VzIGhhdmUgYmVlbiB1cGdyYWRlZCBgICtcbiAgICAgICAgICBgKCR7cmVjZW50VXBncmFkZVRpbWVzdGFtcH0gPCAke2N1cnJlbnRVcGdyYWRlVGltZXN0YW1wfSlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZy53YXJuKGBUaGUgcmVjZW50IHVwZ3JhZGUgdGltZXN0YW1wIGF0ICcke3RpbWVzdGFtcFBhdGh9JyBpcyBjb3JydXB0ZWQuIFRyeWluZyB0byBmaXggaXRgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgbWtkaXJwKHBhdGguZGlybmFtZSh0aW1lc3RhbXBQYXRoKSk7XG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGUodGltZXN0YW1wUGF0aCwgYCR7Y3VycmVudFVwZ3JhZGVUaW1lc3RhbXB9YCwgJ3V0ZjgnKTtcbiAgICAgIGxvZy5kZWJ1ZyhgU3RvcmVkIHRoZSByZWNlbnQgV2ViRHJpdmVyQWdlbnQgdXBncmFkZSB0aW1lc3RhbXAgJHtjdXJyZW50VXBncmFkZVRpbWVzdGFtcH0gYCArXG4gICAgICAgIGBhdCAnJHt0aW1lc3RhbXBQYXRofSdgKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2cuaW5mbyhgVW5hYmxlIHRvIGNyZWF0ZSB0aGUgcmVjZW50IFdlYkRyaXZlckFnZW50IHVwZ3JhZGUgdGltZXN0YW1wIGF0ICcke3RpbWVzdGFtcFBhdGh9Jy4gYCArXG4gICAgICAgIGBPcmlnaW5hbCBlcnJvcjogJHtlLm1lc3NhZ2V9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMueGNvZGVidWlsZC5jbGVhblByb2plY3QoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2cud2FybihgQ2Fubm90IHBlcmZvcm0gV2ViRHJpdmVyQWdlbnQgcHJvamVjdCBjbGVhbnVwLiBPcmlnaW5hbCBlcnJvcjogJHtlLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBjdXJyZW50IHJ1bm5pbmcgV0RBJ3Mgc3RhdHVzIGxpa2UgYmVsb3cgYWZ0ZXIgbGF1bmNoaW5nIFdEQVxuICAgKiB7XG4gICAqICAgXCJzdGF0ZVwiOiBcInN1Y2Nlc3NcIixcbiAgICogICBcIm9zXCI6IHtcbiAgICogICAgIFwibmFtZVwiOiBcImlPU1wiLFxuICAgKiAgICAgXCJ2ZXJzaW9uXCI6IFwiMTEuNFwiLFxuICAgKiAgICAgXCJzZGtWZXJzaW9uXCI6IFwiMTEuM1wiXG4gICAqICAgfSxcbiAgICogICBcImlvc1wiOiB7XG4gICAqICAgICBcInNpbXVsYXRvclZlcnNpb25cIjogXCIxMS40XCIsXG4gICAqICAgICBcImlwXCI6IFwiMTcyLjI1NC45OS4zNFwiXG4gICAqICAgfSxcbiAgICogICBcImJ1aWxkXCI6IHtcbiAgICogICAgIFwidGltZVwiOiBcIkp1biAyNCAyMDE4IDE3OjA4OjIxXCIsXG4gICAqICAgICBcInByb2R1Y3RCdW5kbGVJZGVudGlmaWVyXCI6IFwiY29tLmZhY2Vib29rLldlYkRyaXZlckFnZW50UnVubmVyXCJcbiAgICogICB9XG4gICAqIH1cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IHNlc3Npb25JZCBMYXVuY2ggV0RBIGFuZCBlc3RhYmxpc2ggdGhlIHNlc3Npb24gd2l0aCB0aGlzIHNlc3Npb25JZFxuICAgKiBAcmV0dXJuIHs/b2JqZWN0fSBTdGF0ZSBPYmplY3RcbiAgICogQHRocm93cyB7RXJyb3J9IElmIHRoZXJlIHdhcyBpbnZhbGlkIHJlc3BvbnNlIGNvZGUgb3IgYm9keVxuICAgKi9cbiAgYXN5bmMgbGF1bmNoIChzZXNzaW9uSWQpIHtcbiAgICBpZiAodGhpcy53ZWJEcml2ZXJBZ2VudFVybCkge1xuICAgICAgbG9nLmluZm8oYFVzaW5nIHByb3ZpZGVkIFdlYmRyaXZlckFnZW50IGF0ICcke3RoaXMud2ViRHJpdmVyQWdlbnRVcmx9J2ApO1xuICAgICAgdGhpcy51cmwgPSB0aGlzLndlYkRyaXZlckFnZW50VXJsO1xuICAgICAgdGhpcy5zZXR1cFByb3hpZXMoc2Vzc2lvbklkKTtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmdldFN0YXR1cygpO1xuICAgIH1cblxuICAgIGxvZy5pbmZvKCdMYXVuY2hpbmcgV2ViRHJpdmVyQWdlbnQgb24gdGhlIGRldmljZScpO1xuXG4gICAgdGhpcy5zZXR1cFByb3hpZXMoc2Vzc2lvbklkKTtcblxuICAgIGlmICghdGhpcy51c2VYY3Rlc3RydW5GaWxlICYmICFhd2FpdCBmcy5leGlzdHModGhpcy5hZ2VudFBhdGgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRyeWluZyB0byB1c2UgV2ViRHJpdmVyQWdlbnQgcHJvamVjdCBhdCAnJHt0aGlzLmFnZW50UGF0aH0nIGJ1dCB0aGUgYCArXG4gICAgICAgICAgICAgICAgICAgICAgJ2ZpbGUgZG9lcyBub3QgZXhpc3QnKTtcbiAgICB9XG5cbiAgICAvLyB1c2VYY3Rlc3RydW5GaWxlIGFuZCB1c2VQcmVidWlsdFdEQSB1c2UgZXhpc3RpbmcgZGVwZW5kZW5jaWVzXG4gICAgLy8gSXQgZGVwZW5kcyBvbiB1c2VyIHNpZGVcbiAgICBpZiAodGhpcy5pZGIgfHwgdGhpcy51c2VYY3Rlc3RydW5GaWxlIHx8ICh0aGlzLmRlcml2ZWREYXRhUGF0aCAmJiB0aGlzLnVzZVByZWJ1aWx0V0RBKSkge1xuICAgICAgbG9nLmluZm8oJ1NraXBwZWQgV0RBIHByb2plY3QgY2xlYW51cCBhY2NvcmRpbmcgdG8gdGhlIHByb3ZpZGVkIGNhcGFiaWxpdGllcycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzeW5jaHJvbml6YXRpb25LZXkgPSBwYXRoLm5vcm1hbGl6ZSh0aGlzLmJvb3RzdHJhcFBhdGgpO1xuICAgICAgYXdhaXQgU0hBUkVEX1JFU09VUkNFU19HVUFSRC5hY3F1aXJlKHN5bmNocm9uaXphdGlvbktleSxcbiAgICAgICAgYXN5bmMgKCkgPT4gYXdhaXQgdGhpcy5fY2xlYW51cFByb2plY3RJZkZyZXNoKCkpO1xuICAgIH1cblxuICAgIC8vIFdlIG5lZWQgdG8gcHJvdmlkZSBXREEgbG9jYWwgcG9ydCwgYmVjYXVzZSBpdCBtaWdodCBiZSBvY2N1cGllZFxuICAgIGF3YWl0IHJlc2V0VGVzdFByb2Nlc3Nlcyh0aGlzLmRldmljZS51ZGlkLCAhdGhpcy5pc1JlYWxEZXZpY2UpO1xuXG4gICAgaWYgKHRoaXMuaWRiKSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5zdGFydFdpdGhJREIoKTtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnhjb2RlYnVpbGQuaW5pdCh0aGlzLm5vU2Vzc2lvblByb3h5KTtcblxuICAgIC8vIFN0YXJ0IHRoZSB4Y29kZWJ1aWxkIHByb2Nlc3NcbiAgICBpZiAodGhpcy5wcmVidWlsZFdEQSkge1xuICAgICAgYXdhaXQgdGhpcy54Y29kZWJ1aWxkLnByZWJ1aWxkKCk7XG4gICAgfVxuICAgIHJldHVybiBhd2FpdCB0aGlzLnhjb2RlYnVpbGQuc3RhcnQoKTtcbiAgfVxuXG4gIGFzeW5jIHN0YXJ0V2l0aElEQiAoKSB7XG4gICAgbG9nLmluZm8oJ1dpbGwgbGF1bmNoIFdEQSB3aXRoIGlkYiBpbnN0ZWFkIG9mIHhjb2RlYnVpbGQgc2luY2UgdGhlIGNvcnJlc3BvbmRpbmcgZmxhZyBpcyBlbmFibGVkJyk7XG4gICAgY29uc3Qge3dkYUJ1bmRsZUlkLCB0ZXN0QnVuZGxlSWR9ID0gYXdhaXQgdGhpcy5wcmVwYXJlV0RBKCk7XG4gICAgY29uc3QgZW52ID0ge1xuICAgICAgVVNFX1BPUlQ6IHRoaXMud2RhUmVtb3RlUG9ydCxcbiAgICAgIFdEQV9QUk9EVUNUX0JVTkRMRV9JREVOVElGSUVSOiB0aGlzLnVwZGF0ZWRXREFCdW5kbGVJZCxcbiAgICB9O1xuICAgIGlmICh0aGlzLm1qcGVnU2VydmVyUG9ydCkge1xuICAgICAgZW52Lk1KUEVHX1NFUlZFUl9QT1JUID0gdGhpcy5tanBlZ1NlcnZlclBvcnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGF3YWl0IHRoaXMuaWRiLnJ1blhDVUlUZXN0KHdkYUJ1bmRsZUlkLCB3ZGFCdW5kbGVJZCwgdGVzdEJ1bmRsZUlkLCB7ZW52fSk7XG4gIH1cblxuICBhc3luYyBwYXJzZUJ1bmRsZUlkICh3ZGFCdW5kbGVQYXRoKSB7XG4gICAgY29uc3QgaW5mb1BsaXN0UGF0aCA9IHBhdGguam9pbih3ZGFCdW5kbGVQYXRoLCAnSW5mby5wbGlzdCcpO1xuICAgIGNvbnN0IGluZm9QbGlzdCA9IGF3YWl0IHBsaXN0LnBhcnNlUGxpc3QoYXdhaXQgZnMucmVhZEZpbGUoaW5mb1BsaXN0UGF0aCkpO1xuICAgIGlmICghaW5mb1BsaXN0LkNGQnVuZGxlSWRlbnRpZmllcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCBidW5kbGUgaWQgaW4gJyR7aW5mb1BsaXN0UGF0aH0nYCk7XG4gICAgfVxuICAgIHJldHVybiBpbmZvUGxpc3QuQ0ZCdW5kbGVJZGVudGlmaWVyO1xuICB9XG5cbiAgYXN5bmMgcHJlcGFyZVdEQSAoKSB7XG4gICAgY29uc3Qgd2RhQnVuZGxlUGF0aCA9IHRoaXMud2RhQnVuZGxlUGF0aCB8fCBhd2FpdCB0aGlzLmZldGNoV0RBQnVuZGxlKCk7XG4gICAgY29uc3Qgd2RhQnVuZGxlSWQgPSBhd2FpdCB0aGlzLnBhcnNlQnVuZGxlSWQod2RhQnVuZGxlUGF0aCk7XG4gICAgaWYgKCFhd2FpdCB0aGlzLmRldmljZS5pc0FwcEluc3RhbGxlZCh3ZGFCdW5kbGVJZCkpIHtcbiAgICAgIGF3YWl0IHRoaXMuZGV2aWNlLmluc3RhbGxBcHAod2RhQnVuZGxlUGF0aCk7XG4gICAgfVxuICAgIGNvbnN0IHRlc3RCdW5kbGVJZCA9IGF3YWl0IHRoaXMuaWRiLmluc3RhbGxYQ1Rlc3RCdW5kbGUocGF0aC5qb2luKHdkYUJ1bmRsZVBhdGgsICdQbHVnSW5zJywgJ1dlYkRyaXZlckFnZW50UnVubmVyLnhjdGVzdCcpKTtcbiAgICByZXR1cm4ge3dkYUJ1bmRsZUlkLCB0ZXN0QnVuZGxlSWQsIHdkYUJ1bmRsZVBhdGh9O1xuICB9XG5cbiAgYXN5bmMgZmV0Y2hXREFCdW5kbGUgKCkge1xuICAgIGlmICghdGhpcy5kZXJpdmVkRGF0YVBhdGgpIHtcbiAgICAgIHJldHVybiBhd2FpdCBidW5kbGVXREFTaW0odGhpcy54Y29kZWJ1aWxkKTtcbiAgICB9XG4gICAgY29uc3Qgd2RhQnVuZGxlUGF0aHMgPSBhd2FpdCBmcy5nbG9iKGAke3RoaXMuZGVyaXZlZERhdGFQYXRofS8qKi8qJHtXREFfUlVOTkVSX0FQUH0vYCwge1xuICAgICAgYWJzb2x1dGU6IHRydWUsXG4gICAgfSk7XG4gICAgaWYgKF8uaXNFbXB0eSh3ZGFCdW5kbGVQYXRocykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgdGhlIFdEQSBidW5kbGUgaW4gJyR7dGhpcy5kZXJpdmVkRGF0YVBhdGh9J2ApO1xuICAgIH1cbiAgICByZXR1cm4gd2RhQnVuZGxlUGF0aHNbMF07XG4gIH1cblxuICBhc3luYyBpc1NvdXJjZUZyZXNoICgpIHtcbiAgICBjb25zdCBleGlzdHNQcm9taXNlcyA9IFtcbiAgICAgICdSZXNvdXJjZXMnLFxuICAgICAgYFJlc291cmNlcyR7cGF0aC5zZXB9V2ViRHJpdmVyQWdlbnQuYnVuZGxlYCxcbiAgICBdLm1hcCgoc3ViUGF0aCkgPT4gZnMuZXhpc3RzKHBhdGgucmVzb2x2ZSh0aGlzLmJvb3RzdHJhcFBhdGgsIHN1YlBhdGgpKSk7XG4gICAgcmV0dXJuIChhd2FpdCBCLmFsbChleGlzdHNQcm9taXNlcykpLnNvbWUoKHYpID0+IHYgPT09IGZhbHNlKTtcbiAgfVxuXG4gIHNldHVwUHJveGllcyAoc2Vzc2lvbklkKSB7XG4gICAgY29uc3QgcHJveHlPcHRzID0ge1xuICAgICAgc2VydmVyOiB0aGlzLnVybC5ob3N0bmFtZSxcbiAgICAgIHBvcnQ6IHRoaXMudXJsLnBvcnQsXG4gICAgICBiYXNlOiB0aGlzLmJhc2VQYXRoLFxuICAgICAgdGltZW91dDogdGhpcy53ZGFDb25uZWN0aW9uVGltZW91dCxcbiAgICAgIGtlZXBBbGl2ZTogdHJ1ZSxcbiAgICB9O1xuXG4gICAgdGhpcy5qd3Byb3h5ID0gbmV3IEpXUHJveHkocHJveHlPcHRzKTtcbiAgICB0aGlzLmp3cHJveHkuc2Vzc2lvbklkID0gc2Vzc2lvbklkO1xuICAgIHRoaXMucHJveHlSZXFSZXMgPSB0aGlzLmp3cHJveHkucHJveHlSZXFSZXMuYmluZCh0aGlzLmp3cHJveHkpO1xuXG4gICAgdGhpcy5ub1Nlc3Npb25Qcm94eSA9IG5ldyBOb1Nlc3Npb25Qcm94eShwcm94eU9wdHMpO1xuICB9XG5cbiAgYXN5bmMgcXVpdCAoKSB7XG4gICAgbG9nLmluZm8oJ1NodXR0aW5nIGRvd24gc3ViLXByb2Nlc3NlcycpO1xuXG4gICAgYXdhaXQgdGhpcy54Y29kZWJ1aWxkLnF1aXQoKTtcbiAgICBhd2FpdCB0aGlzLnhjb2RlYnVpbGQucmVzZXQoKTtcblxuICAgIGlmICh0aGlzLmp3cHJveHkpIHtcbiAgICAgIHRoaXMuandwcm94eS5zZXNzaW9uSWQgPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuc3RhcnRlZCA9IGZhbHNlO1xuXG4gICAgaWYgKCF0aGlzLmFyZ3Mud2ViRHJpdmVyQWdlbnRVcmwpIHtcbiAgICAgIC8vIGlmIHdlIHBvcHVsYXRlZCB0aGUgdXJsIG91cnNlbHZlcyAoZHVyaW5nIGBzZXR1cENhY2hpbmdgIGNhbGwsIGZvciBpbnN0YW5jZSlcbiAgICAgIC8vIHRoZW4gY2xlYW4gdGhhdCB1cC4gSWYgdGhlIHVybCB3YXMgc3VwcGxpZWQsIHdlIHdhbnQgdG8ga2VlcCBpdFxuICAgICAgdGhpcy53ZWJEcml2ZXJBZ2VudFVybCA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgZ2V0IHVybCAoKSB7XG4gICAgaWYgKCF0aGlzLl91cmwpIHtcbiAgICAgIGlmICh0aGlzLndlYkRyaXZlckFnZW50VXJsKSB7XG4gICAgICAgIHRoaXMuX3VybCA9IHVybC5wYXJzZSh0aGlzLndlYkRyaXZlckFnZW50VXJsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHBvcnQgPSB0aGlzLndkYUxvY2FsUG9ydCB8fCBXREFfQUdFTlRfUE9SVDtcbiAgICAgICAgY29uc3Qge3Byb3RvY29sLCBob3N0bmFtZX0gPSB1cmwucGFyc2UodGhpcy53ZGFCYXNlVXJsIHx8IFdEQV9CQVNFX1VSTCk7XG4gICAgICAgIHRoaXMuX3VybCA9IHVybC5wYXJzZShgJHtwcm90b2NvbH0vLyR7aG9zdG5hbWV9OiR7cG9ydH1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3VybDtcbiAgfVxuXG4gIHNldCB1cmwgKF91cmwpIHtcbiAgICB0aGlzLl91cmwgPSB1cmwucGFyc2UoX3VybCk7XG4gIH1cblxuICBnZXQgZnVsbHlTdGFydGVkICgpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFydGVkO1xuICB9XG5cbiAgc2V0IGZ1bGx5U3RhcnRlZCAoc3RhcnRlZCA9IGZhbHNlKSB7XG4gICAgdGhpcy5zdGFydGVkID0gc3RhcnRlZDtcbiAgfVxuXG4gIGFzeW5jIHJldHJpZXZlRGVyaXZlZERhdGFQYXRoICgpIHtcbiAgICByZXR1cm4gYXdhaXQgdGhpcy54Y29kZWJ1aWxkLnJldHJpZXZlRGVyaXZlZERhdGFQYXRoKCk7XG4gIH1cblxuICAvKipcbiAgICogUmV1c2UgcnVubmluZyBXREEgaWYgaXQgaGFzIHRoZSBzYW1lIGJ1bmRsZSBpZCB3aXRoIHVwZGF0ZWRXREFCdW5kbGVJZC5cbiAgICogT3IgcmV1c2UgaXQgaWYgaXQgaGFzIHRoZSBkZWZhdWx0IGlkIHdpdGhvdXQgdXBkYXRlZFdEQUJ1bmRsZUlkLlxuICAgKiBVbmluc3RhbGwgaXQgaWYgdGhlIG1ldGhvZCBmYWNlcyBhbiBleGNlcHRpb24gZm9yIHRoZSBhYm92ZSBzaXR1YXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1cGRhdGVkV0RBQnVuZGxlSWQgQnVuZGxlSWQgeW91J2QgbGlrZSB0byB1c2VcbiAgICovXG4gIGFzeW5jIHNldHVwQ2FjaGluZyAoKSB7XG4gICAgY29uc3Qgc3RhdHVzID0gYXdhaXQgdGhpcy5nZXRTdGF0dXMoKTtcbiAgICBpZiAoIXN0YXR1cyB8fCAhc3RhdHVzLmJ1aWxkKSB7XG4gICAgICBsb2cuZGVidWcoJ1dEQSBpcyBjdXJyZW50bHkgbm90IHJ1bm5pbmcuIFRoZXJlIGlzIG5vdGhpbmcgdG8gY2FjaGUnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7XG4gICAgICBwcm9kdWN0QnVuZGxlSWRlbnRpZmllcixcbiAgICAgIHVwZ3JhZGVkQXQsXG4gICAgfSA9IHN0YXR1cy5idWlsZDtcbiAgICAvLyBmb3IgcmVhbCBkZXZpY2VcbiAgICBpZiAodXRpbC5oYXNWYWx1ZShwcm9kdWN0QnVuZGxlSWRlbnRpZmllcikgJiYgdXRpbC5oYXNWYWx1ZSh0aGlzLnVwZGF0ZWRXREFCdW5kbGVJZCkgJiYgdGhpcy51cGRhdGVkV0RBQnVuZGxlSWQgIT09IHByb2R1Y3RCdW5kbGVJZGVudGlmaWVyKSB7XG4gICAgICBsb2cuaW5mbyhgV2lsbCB1bmluc3RhbGwgcnVubmluZyBXREEgc2luY2UgaXQgaGFzIGRpZmZlcmVudCBidW5kbGUgaWQuIFRoZSBhY3R1YWwgdmFsdWUgaXMgJyR7cHJvZHVjdEJ1bmRsZUlkZW50aWZpZXJ9Jy5gKTtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnVuaW5zdGFsbCgpO1xuICAgIH1cbiAgICAvLyBmb3Igc2ltdWxhdG9yXG4gICAgaWYgKHV0aWwuaGFzVmFsdWUocHJvZHVjdEJ1bmRsZUlkZW50aWZpZXIpICYmICF1dGlsLmhhc1ZhbHVlKHRoaXMudXBkYXRlZFdEQUJ1bmRsZUlkKSAmJiBXREFfUlVOTkVSX0JVTkRMRV9JRCAhPT0gcHJvZHVjdEJ1bmRsZUlkZW50aWZpZXIpIHtcbiAgICAgIGxvZy5pbmZvKGBXaWxsIHVuaW5zdGFsbCBydW5uaW5nIFdEQSBzaW5jZSBpdHMgYnVuZGxlIGlkIGlzIG5vdCBlcXVhbCB0byB0aGUgZGVmYXVsdCB2YWx1ZSAke1dEQV9SVU5ORVJfQlVORExFX0lEfWApO1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMudW5pbnN0YWxsKCk7XG4gICAgfVxuXG4gICAgY29uc3QgYWN0dWFsVXBncmFkZVRpbWVzdGFtcCA9IGF3YWl0IGdldFdEQVVwZ3JhZGVUaW1lc3RhbXAoKTtcbiAgICBsb2cuZGVidWcoYFVwZ3JhZGUgdGltZXN0YW1wIG9mIHRoZSBjdXJyZW50bHkgYnVuZGxlZCBXREE6ICR7YWN0dWFsVXBncmFkZVRpbWVzdGFtcH1gKTtcbiAgICBsb2cuZGVidWcoYFVwZ3JhZGUgdGltZXN0YW1wIG9mIHRoZSBXREEgb24gdGhlIGRldmljZTogJHt1cGdyYWRlZEF0fWApO1xuICAgIGlmIChhY3R1YWxVcGdyYWRlVGltZXN0YW1wICYmIHVwZ3JhZGVkQXQgJiYgXy50b0xvd2VyKGAke2FjdHVhbFVwZ3JhZGVUaW1lc3RhbXB9YCkgIT09IF8udG9Mb3dlcihgJHt1cGdyYWRlZEF0fWApKSB7XG4gICAgICBsb2cuaW5mbygnV2lsbCB1bmluc3RhbGwgcnVubmluZyBXREEgc2luY2UgaXQgaGFzIGRpZmZlcmVudCB2ZXJzaW9uIGluIGNvbXBhcmlzb24gdG8gdGhlIG9uZSAnICtcbiAgICAgICAgYHdoaWNoIGlzIGJ1bmRsZWQgd2l0aCBhcHBpdW0teGN1aXRlc3QtZHJpdmVyIG1vZHVsZSAoJHthY3R1YWxVcGdyYWRlVGltZXN0YW1wfSAhPSAke3VwZ3JhZGVkQXR9KWApO1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMudW5pbnN0YWxsKCk7XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZSA9IHV0aWwuaGFzVmFsdWUocHJvZHVjdEJ1bmRsZUlkZW50aWZpZXIpXG4gICAgICA/IGBXaWxsIHJldXNlIHByZXZpb3VzbHkgY2FjaGVkIFdEQSBpbnN0YW5jZSBhdCAnJHt0aGlzLnVybC5ocmVmfScgd2l0aCAnJHtwcm9kdWN0QnVuZGxlSWRlbnRpZmllcn0nYFxuICAgICAgOiBgV2lsbCByZXVzZSBwcmV2aW91c2x5IGNhY2hlZCBXREEgaW5zdGFuY2UgYXQgJyR7dGhpcy51cmwuaHJlZn0nYDtcbiAgICBsb2cuaW5mbyhgJHttZXNzYWdlfS4gU2V0IHRoZSB3ZGFMb2NhbFBvcnQgY2FwYWJpbGl0eSB0byBhIHZhbHVlIGRpZmZlcmVudCBmcm9tICR7dGhpcy51cmwucG9ydH0gaWYgdGhpcyBpcyBhbiB1bmRlc2lyZWQgYmVoYXZpb3IuYCk7XG4gICAgdGhpcy53ZWJEcml2ZXJBZ2VudFVybCA9IHRoaXMudXJsLmhyZWY7XG4gIH1cblxuICAvKipcbiAgICogUXVpdCBhbmQgdW5pbnN0YWxsIHJ1bm5pbmcgV0RBLlxuICAgKi9cbiAgYXN5bmMgcXVpdEFuZFVuaW5zdGFsbCAoKSB7XG4gICAgYXdhaXQgdGhpcy5xdWl0KCk7XG4gICAgYXdhaXQgdGhpcy51bmluc3RhbGwoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBXZWJEcml2ZXJBZ2VudDtcbmV4cG9ydCB7IFdlYkRyaXZlckFnZW50IH07XG4iXSwiZmlsZSI6ImxpYi93ZWJkcml2ZXJhZ2VudC5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLiJ9
