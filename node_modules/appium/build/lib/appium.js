"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AppiumDriver = void 0;

require("source-map-support/register");

var _lodash = _interopRequireDefault(require("lodash"));

var _logger = _interopRequireDefault(require("./logger"));

var _config = require("./config");

var _appiumBaseDriver = require("appium-base-driver");

var _bluebird = _interopRequireDefault(require("bluebird"));

var _asyncLock = _interopRequireDefault(require("async-lock"));

var _utils = require("./utils");

var _semver = _interopRequireDefault(require("semver"));

var _wordWrap = _interopRequireDefault(require("word-wrap"));

var _os = require("os");

var _appiumSupport = require("appium-support");

const PLATFORMS = {
  FAKE: 'fake',
  ANDROID: 'android',
  IOS: 'ios',
  APPLE_TVOS: 'tvos',
  WINDOWS: 'windows',
  MAC: 'mac',
  TIZEN: 'tizen'
};
const AUTOMATION_NAMES = {
  APPIUM: 'Appium',
  UIAUTOMATOR2: 'UiAutomator2',
  UIAUTOMATOR1: 'UiAutomator1',
  XCUITEST: 'XCUITest',
  YOUIENGINE: 'YouiEngine',
  ESPRESSO: 'Espresso',
  TIZEN: 'Tizen',
  FAKE: 'Fake',
  INSTRUMENTS: 'Instruments',
  WINDOWS: 'Windows',
  MAC: 'Mac',
  MAC2: 'Mac2',
  FLUTTER: 'Flutter',
  SAFARI: 'Safari',
  GECKO: 'Gecko'
};
const DRIVER_MAP = {
  [AUTOMATION_NAMES.UIAUTOMATOR2.toLowerCase()]: {
    driverClassName: 'AndroidUiautomator2Driver',
    driverPackage: 'appium-uiautomator2-driver'
  },
  [AUTOMATION_NAMES.XCUITEST.toLowerCase()]: {
    driverClassName: 'XCUITestDriver',
    driverPackage: 'appium-xcuitest-driver'
  },
  [AUTOMATION_NAMES.YOUIENGINE.toLowerCase()]: {
    driverClassName: 'YouiEngineDriver',
    driverPackage: 'appium-youiengine-driver'
  },
  [AUTOMATION_NAMES.FAKE.toLowerCase()]: {
    driverClassName: 'FakeDriver',
    driverPackage: 'appium-fake-driver'
  },
  [AUTOMATION_NAMES.UIAUTOMATOR1.toLowerCase()]: {
    driverClassName: 'AndroidDriver',
    driverPackage: 'appium-android-driver'
  },
  [AUTOMATION_NAMES.INSTRUMENTS.toLowerCase()]: {
    driverClassName: 'IosDriver',
    driverPackage: 'appium-ios-driver'
  },
  [AUTOMATION_NAMES.WINDOWS.toLowerCase()]: {
    driverClassName: 'WindowsDriver',
    driverPackage: 'appium-windows-driver'
  },
  [AUTOMATION_NAMES.MAC.toLowerCase()]: {
    driverClassName: 'MacDriver',
    driverPackage: 'appium-mac-driver'
  },
  [AUTOMATION_NAMES.MAC2.toLowerCase()]: {
    driverClassName: 'Mac2Driver',
    driverPackage: 'appium-mac2-driver'
  },
  [AUTOMATION_NAMES.ESPRESSO.toLowerCase()]: {
    driverClassName: 'EspressoDriver',
    driverPackage: 'appium-espresso-driver'
  },
  [AUTOMATION_NAMES.TIZEN.toLowerCase()]: {
    driverClassName: 'TizenDriver',
    driverPackage: 'appium-tizen-driver'
  },
  [AUTOMATION_NAMES.FLUTTER.toLowerCase()]: {
    driverClassName: 'FlutterDriver',
    driverPackage: 'appium-flutter-driver'
  },
  [AUTOMATION_NAMES.SAFARI.toLowerCase()]: {
    driverClassName: 'SafariDriver',
    driverPackage: 'appium-safari-driver'
  },
  [AUTOMATION_NAMES.GECKO.toLowerCase()]: {
    driverClassName: 'GeckoDriver',
    driverPackage: 'appium-geckodriver'
  }
};
const PLATFORMS_MAP = {
  [PLATFORMS.FAKE]: () => AUTOMATION_NAMES.FAKE,
  [PLATFORMS.ANDROID]: () => {
    const logDividerLength = 70;
    const automationWarning = [`The 'automationName' capability was not provided in the desired capabilities for this Android session`, `Setting 'automationName=UiAutomator2' by default and using the UiAutomator2 Driver`, `The next major version of Appium (2.x) will **require** the 'automationName' capability to be set for all sessions on all platforms`, `In previous versions (Appium <= 1.13.x), the default was 'automationName=UiAutomator1'`, `If you wish to use that automation instead of UiAutomator2, please add 'automationName=UiAutomator1' to your desired capabilities`, `For more information about drivers, please visit http://appium.io/docs/en/about-appium/intro/ and explore the 'Drivers' menu`];
    let divider = `${_os.EOL}${_lodash.default.repeat('=', logDividerLength)}${_os.EOL}`;
    let automationWarningString = divider;
    automationWarningString += `  DEPRECATION WARNING:` + _os.EOL;

    for (let log of automationWarning) {
      automationWarningString += _os.EOL + (0, _wordWrap.default)(log, {
        width: logDividerLength - 2
      }) + _os.EOL;
    }

    automationWarningString += divider;

    _logger.default.warn(automationWarningString);

    return AUTOMATION_NAMES.UIAUTOMATOR2;
  },
  [PLATFORMS.IOS]: caps => {
    const platformVersion = _semver.default.valid(_semver.default.coerce(caps.platformVersion));

    _logger.default.warn(`DeprecationWarning: 'automationName' capability was not provided. ` + `Future versions of Appium will require 'automationName' capability to be set for iOS sessions.`);

    if (platformVersion && _semver.default.satisfies(platformVersion, '>=10.0.0')) {
      _logger.default.info('Requested iOS support with version >= 10, ' + `using '${AUTOMATION_NAMES.XCUITEST}' ` + 'driver instead of UIAutomation-based driver, since the ' + 'latter is unsupported on iOS 10 and up.');

      return AUTOMATION_NAMES.XCUITEST;
    }

    return AUTOMATION_NAMES.INSTRUMENTS;
  },
  [PLATFORMS.APPLE_TVOS]: () => AUTOMATION_NAMES.XCUITEST,
  [PLATFORMS.WINDOWS]: () => AUTOMATION_NAMES.WINDOWS,
  [PLATFORMS.MAC]: () => AUTOMATION_NAMES.MAC,
  [PLATFORMS.TIZEN]: () => AUTOMATION_NAMES.TIZEN
};
const desiredCapabilityConstraints = {
  automationName: {
    presence: false,
    isString: true,
    inclusionCaseInsensitive: _lodash.default.values(AUTOMATION_NAMES)
  },
  platformName: {
    presence: true,
    isString: true,
    inclusionCaseInsensitive: _lodash.default.keys(PLATFORMS_MAP)
  }
};
const sessionsListGuard = new _asyncLock.default();
const pendingDriversGuard = new _asyncLock.default();

class AppiumDriver extends _appiumBaseDriver.BaseDriver {
  constructor(args) {
    if (args.tmpDir) {
      process.env.APPIUM_TMP_DIR = args.tmpDir;
    }

    super(args);
    this.desiredCapConstraints = desiredCapabilityConstraints;
    this.newCommandTimeoutMs = 0;
    this.args = Object.assign({}, args);
    this.sessions = {};
    this.pendingDrivers = {};
    (0, _config.updateBuildInfo)();
  }

  get isCommandsQueueEnabled() {
    return false;
  }

  sessionExists(sessionId) {
    const dstSession = this.sessions[sessionId];
    return dstSession && dstSession.sessionId !== null;
  }

  driverForSession(sessionId) {
    return this.sessions[sessionId];
  }

  getDriverAndVersionForCaps(caps) {
    if (!_lodash.default.isString(caps.platformName)) {
      throw new Error('You must include a platformName capability');
    }

    const platformName = caps.platformName.toLowerCase();
    let automationNameCap = caps.automationName;

    if (!_lodash.default.isString(automationNameCap) || automationNameCap.toLowerCase() === 'appium') {
      const driverSelector = PLATFORMS_MAP[platformName];

      if (driverSelector) {
        automationNameCap = driverSelector(caps);
      }
    }

    automationNameCap = _lodash.default.toLower(automationNameCap);
    let failureVerb = 'find';
    let suggestion = 'Please check your desired capabilities';

    if (_lodash.default.isPlainObject(DRIVER_MAP[automationNameCap])) {
      try {
        const {
          driverPackage,
          driverClassName
        } = DRIVER_MAP[automationNameCap];

        const driver = require(driverPackage)[driverClassName];

        return {
          driver,
          version: this.getDriverVersion(driver.name, driverPackage)
        };
      } catch (e) {
        _logger.default.debug(e);

        failureVerb = 'load';
        suggestion = 'Please verify your Appium installation';
      }
    }

    const msg = _lodash.default.isString(caps.automationName) ? `Could not ${failureVerb} a driver for automationName '${caps.automationName}' and platformName ` + `'${caps.platformName}'` : `Could not ${failureVerb} a driver for platformName '${caps.platformName}'`;
    throw new Error(`${msg}. ${suggestion}`);
  }

  getDriverVersion(driverName, driverPackage) {
    const version = (0, _utils.getPackageVersion)(driverPackage);

    if (version) {
      return version;
    }

    _logger.default.warn(`Unable to get version of driver '${driverName}'`);
  }

  async getStatus() {
    return {
      build: _lodash.default.clone((0, _config.getBuildInfo)())
    };
  }

  async getSessions() {
    const sessions = await sessionsListGuard.acquire(AppiumDriver.name, () => this.sessions);
    return _lodash.default.toPairs(sessions).map(([id, driver]) => ({
      id,
      capabilities: driver.caps
    }));
  }

  printNewSessionAnnouncement(driverName, driverVersion) {
    const introString = driverVersion ? `Appium v${_config.APPIUM_VER} creating new ${driverName} (v${driverVersion}) session` : `Appium v${_config.APPIUM_VER} creating new ${driverName} session`;

    _logger.default.info(introString);
  }

  async createSession(jsonwpCaps, reqCaps, w3cCapabilities) {
    const defaultCapabilities = _lodash.default.cloneDeep(this.args.defaultCapabilities);

    const defaultSettings = (0, _utils.pullSettings)(defaultCapabilities);
    jsonwpCaps = _lodash.default.cloneDeep(jsonwpCaps);
    const jwpSettings = Object.assign({}, defaultSettings, (0, _utils.pullSettings)(jsonwpCaps));
    w3cCapabilities = _lodash.default.cloneDeep(w3cCapabilities);
    const w3cSettings = Object.assign({}, jwpSettings);
    Object.assign(w3cSettings, (0, _utils.pullSettings)((w3cCapabilities || {}).alwaysMatch || {}));

    for (const firstMatchEntry of (w3cCapabilities || {}).firstMatch || []) {
      Object.assign(w3cSettings, (0, _utils.pullSettings)(firstMatchEntry));
    }

    let protocol;
    let innerSessionId, dCaps;

    try {
      const parsedCaps = (0, _utils.parseCapsForInnerDriver)(jsonwpCaps, w3cCapabilities, this.desiredCapConstraints, defaultCapabilities);
      const {
        desiredCaps,
        processedJsonwpCapabilities,
        processedW3CCapabilities,
        error
      } = parsedCaps;
      protocol = parsedCaps.protocol;

      if (error) {
        throw error;
      }

      const {
        driver: InnerDriver,
        version: driverVersion
      } = this.getDriverAndVersionForCaps(desiredCaps);
      this.printNewSessionAnnouncement(InnerDriver.name, driverVersion);

      if (this.args.sessionOverride) {
        await this.deleteAllSessions();
      }

      let runningDriversData, otherPendingDriversData;
      const d = new InnerDriver(this.args);

      if (this.args.relaxedSecurityEnabled) {
        _logger.default.info(`Applying relaxed security to '${InnerDriver.name}' as per ` + `server command line argument. All insecure features will be ` + `enabled unless explicitly disabled by --deny-insecure`);

        d.relaxedSecurityEnabled = true;
      }

      if (!_lodash.default.isEmpty(this.args.denyInsecure)) {
        _logger.default.info('Explicitly preventing use of insecure features:');

        this.args.denyInsecure.map(a => _logger.default.info(`    ${a}`));
        d.denyInsecure = this.args.denyInsecure;
      }

      if (!_lodash.default.isEmpty(this.args.allowInsecure)) {
        _logger.default.info('Explicitly enabling use of insecure features:');

        this.args.allowInsecure.map(a => _logger.default.info(`    ${a}`));
        d.allowInsecure = this.args.allowInsecure;
      }

      d.server = this.server;

      try {
        runningDriversData = await this.curSessionDataForDriver(InnerDriver);
      } catch (e) {
        throw new _appiumBaseDriver.errors.SessionNotCreatedError(e.message);
      }

      await pendingDriversGuard.acquire(AppiumDriver.name, () => {
        this.pendingDrivers[InnerDriver.name] = this.pendingDrivers[InnerDriver.name] || [];
        otherPendingDriversData = this.pendingDrivers[InnerDriver.name].map(drv => drv.driverData);
        this.pendingDrivers[InnerDriver.name].push(d);
      });

      try {
        [innerSessionId, dCaps] = await d.createSession(processedJsonwpCapabilities, reqCaps, processedW3CCapabilities, [...runningDriversData, ...otherPendingDriversData]);
        protocol = d.protocol;
        await sessionsListGuard.acquire(AppiumDriver.name, () => {
          this.sessions[innerSessionId] = d;
        });
      } finally {
        await pendingDriversGuard.acquire(AppiumDriver.name, () => {
          _lodash.default.pull(this.pendingDrivers[InnerDriver.name], d);
        });
      }

      this.attachUnexpectedShutdownHandler(d, innerSessionId);

      _logger.default.info(`New ${InnerDriver.name} session created successfully, session ` + `${innerSessionId} added to master session list`);

      d.startNewCommandTimeout();

      if (d.isW3CProtocol() && !_lodash.default.isEmpty(w3cSettings)) {
        _logger.default.info(`Applying the initial values to Appium settings parsed from W3C caps: ` + JSON.stringify(w3cSettings));

        await d.updateSettings(w3cSettings);
      } else if (d.isMjsonwpProtocol() && !_lodash.default.isEmpty(jwpSettings)) {
        _logger.default.info(`Applying the initial values to Appium settings parsed from MJSONWP caps: ` + JSON.stringify(jwpSettings));

        await d.updateSettings(jwpSettings);
      }
    } catch (error) {
      return {
        protocol,
        error
      };
    }

    return {
      protocol,
      value: [innerSessionId, dCaps, protocol]
    };
  }

  attachUnexpectedShutdownHandler(driver, innerSessionId) {
    const removeSessionFromMasterList = (cause = new Error('Unknown error')) => {
      _logger.default.warn(`Closing session, cause was '${cause.message}'`);

      _logger.default.info(`Removing session '${innerSessionId}' from our master session list`);

      delete this.sessions[innerSessionId];
    };

    if (_lodash.default.isFunction((driver.onUnexpectedShutdown || {}).then)) {
      driver.onUnexpectedShutdown.then(() => {
        throw new Error('Unexpected shutdown');
      }).catch(e => {
        if (!(e instanceof _bluebird.default.CancellationError)) {
          removeSessionFromMasterList(e);
        }
      });
    } else if (_lodash.default.isFunction(driver.onUnexpectedShutdown)) {
      driver.onUnexpectedShutdown(removeSessionFromMasterList);
    } else {
      _logger.default.warn(`Failed to attach the unexpected shutdown listener. ` + `Is 'onUnexpectedShutdown' method available for '${driver.constructor.name}'?`);
    }
  }

  async curSessionDataForDriver(InnerDriver) {
    const sessions = await sessionsListGuard.acquire(AppiumDriver.name, () => this.sessions);

    const data = _lodash.default.values(sessions).filter(s => s.constructor.name === InnerDriver.name).map(s => s.driverData);

    for (let datum of data) {
      if (!datum) {
        throw new Error(`Problem getting session data for driver type ` + `${InnerDriver.name}; does it implement 'get ` + `driverData'?`);
      }
    }

    return data;
  }

  async deleteSession(sessionId) {
    let protocol;

    try {
      let otherSessionsData = null;
      let dstSession = null;
      await sessionsListGuard.acquire(AppiumDriver.name, () => {
        if (!this.sessions[sessionId]) {
          return;
        }

        const curConstructorName = this.sessions[sessionId].constructor.name;
        otherSessionsData = _lodash.default.toPairs(this.sessions).filter(([key, value]) => value.constructor.name === curConstructorName && key !== sessionId).map(([, value]) => value.driverData);
        dstSession = this.sessions[sessionId];
        protocol = dstSession.protocol;

        _logger.default.info(`Removing session ${sessionId} from our master session list`);

        delete this.sessions[sessionId];
      });
      return {
        protocol,
        value: await dstSession.deleteSession(sessionId, otherSessionsData)
      };
    } catch (e) {
      _logger.default.error(`Had trouble ending session ${sessionId}: ${e.message}`);

      return {
        protocol,
        error: e
      };
    }
  }

  async deleteAllSessions(opts = {}) {
    const sessionsCount = _lodash.default.size(this.sessions);

    if (0 === sessionsCount) {
      _logger.default.debug('There are no active sessions for cleanup');

      return;
    }

    const {
      force = false,
      reason
    } = opts;

    _logger.default.debug(`Cleaning up ${_appiumSupport.util.pluralize('active session', sessionsCount, true)}`);

    const cleanupPromises = force ? _lodash.default.values(this.sessions).map(drv => drv.startUnexpectedShutdown(reason && new Error(reason))) : _lodash.default.keys(this.sessions).map(id => this.deleteSession(id));

    for (const cleanupPromise of cleanupPromises) {
      try {
        await cleanupPromise;
      } catch (e) {
        _logger.default.debug(e);
      }
    }
  }

  async executeCommand(cmd, ...args) {
    if (cmd === 'getStatus') {
      return await this.getStatus();
    }

    if (isAppiumDriverCommand(cmd)) {
      return await super.executeCommand(cmd, ...args);
    }

    const sessionId = _lodash.default.last(args);

    const dstSession = await sessionsListGuard.acquire(AppiumDriver.name, () => this.sessions[sessionId]);

    if (!dstSession) {
      throw new Error(`The session with id '${sessionId}' does not exist`);
    }

    let res = {
      protocol: dstSession.protocol
    };

    try {
      res.value = await dstSession.executeCommand(cmd, ...args);
    } catch (e) {
      res.error = e;
    }

    return res;
  }

  proxyActive(sessionId) {
    const dstSession = this.sessions[sessionId];
    return dstSession && _lodash.default.isFunction(dstSession.proxyActive) && dstSession.proxyActive(sessionId);
  }

  getProxyAvoidList(sessionId) {
    const dstSession = this.sessions[sessionId];
    return dstSession ? dstSession.getProxyAvoidList() : [];
  }

  canProxy(sessionId) {
    const dstSession = this.sessions[sessionId];
    return dstSession && dstSession.canProxy(sessionId);
  }

}

exports.AppiumDriver = AppiumDriver;

function isAppiumDriverCommand(cmd) {
  return !(0, _appiumBaseDriver.isSessionCommand)(cmd) || cmd === 'deleteSession';
}require('source-map-support').install();


//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxpYi9hcHBpdW0uanMiXSwibmFtZXMiOlsiUExBVEZPUk1TIiwiRkFLRSIsIkFORFJPSUQiLCJJT1MiLCJBUFBMRV9UVk9TIiwiV0lORE9XUyIsIk1BQyIsIlRJWkVOIiwiQVVUT01BVElPTl9OQU1FUyIsIkFQUElVTSIsIlVJQVVUT01BVE9SMiIsIlVJQVVUT01BVE9SMSIsIlhDVUlURVNUIiwiWU9VSUVOR0lORSIsIkVTUFJFU1NPIiwiSU5TVFJVTUVOVFMiLCJNQUMyIiwiRkxVVFRFUiIsIlNBRkFSSSIsIkdFQ0tPIiwiRFJJVkVSX01BUCIsInRvTG93ZXJDYXNlIiwiZHJpdmVyQ2xhc3NOYW1lIiwiZHJpdmVyUGFja2FnZSIsIlBMQVRGT1JNU19NQVAiLCJsb2dEaXZpZGVyTGVuZ3RoIiwiYXV0b21hdGlvbldhcm5pbmciLCJkaXZpZGVyIiwiRU9MIiwiXyIsInJlcGVhdCIsImF1dG9tYXRpb25XYXJuaW5nU3RyaW5nIiwibG9nIiwid2lkdGgiLCJ3YXJuIiwiY2FwcyIsInBsYXRmb3JtVmVyc2lvbiIsInNlbXZlciIsInZhbGlkIiwiY29lcmNlIiwic2F0aXNmaWVzIiwiaW5mbyIsImRlc2lyZWRDYXBhYmlsaXR5Q29uc3RyYWludHMiLCJhdXRvbWF0aW9uTmFtZSIsInByZXNlbmNlIiwiaXNTdHJpbmciLCJpbmNsdXNpb25DYXNlSW5zZW5zaXRpdmUiLCJ2YWx1ZXMiLCJwbGF0Zm9ybU5hbWUiLCJrZXlzIiwic2Vzc2lvbnNMaXN0R3VhcmQiLCJBc3luY0xvY2siLCJwZW5kaW5nRHJpdmVyc0d1YXJkIiwiQXBwaXVtRHJpdmVyIiwiQmFzZURyaXZlciIsImNvbnN0cnVjdG9yIiwiYXJncyIsInRtcERpciIsInByb2Nlc3MiLCJlbnYiLCJBUFBJVU1fVE1QX0RJUiIsImRlc2lyZWRDYXBDb25zdHJhaW50cyIsIm5ld0NvbW1hbmRUaW1lb3V0TXMiLCJPYmplY3QiLCJhc3NpZ24iLCJzZXNzaW9ucyIsInBlbmRpbmdEcml2ZXJzIiwiaXNDb21tYW5kc1F1ZXVlRW5hYmxlZCIsInNlc3Npb25FeGlzdHMiLCJzZXNzaW9uSWQiLCJkc3RTZXNzaW9uIiwiZHJpdmVyRm9yU2Vzc2lvbiIsImdldERyaXZlckFuZFZlcnNpb25Gb3JDYXBzIiwiRXJyb3IiLCJhdXRvbWF0aW9uTmFtZUNhcCIsImRyaXZlclNlbGVjdG9yIiwidG9Mb3dlciIsImZhaWx1cmVWZXJiIiwic3VnZ2VzdGlvbiIsImlzUGxhaW5PYmplY3QiLCJkcml2ZXIiLCJyZXF1aXJlIiwidmVyc2lvbiIsImdldERyaXZlclZlcnNpb24iLCJuYW1lIiwiZSIsImRlYnVnIiwibXNnIiwiZHJpdmVyTmFtZSIsImdldFN0YXR1cyIsImJ1aWxkIiwiY2xvbmUiLCJnZXRTZXNzaW9ucyIsImFjcXVpcmUiLCJ0b1BhaXJzIiwibWFwIiwiaWQiLCJjYXBhYmlsaXRpZXMiLCJwcmludE5ld1Nlc3Npb25Bbm5vdW5jZW1lbnQiLCJkcml2ZXJWZXJzaW9uIiwiaW50cm9TdHJpbmciLCJBUFBJVU1fVkVSIiwiY3JlYXRlU2Vzc2lvbiIsImpzb253cENhcHMiLCJyZXFDYXBzIiwidzNjQ2FwYWJpbGl0aWVzIiwiZGVmYXVsdENhcGFiaWxpdGllcyIsImNsb25lRGVlcCIsImRlZmF1bHRTZXR0aW5ncyIsImp3cFNldHRpbmdzIiwidzNjU2V0dGluZ3MiLCJhbHdheXNNYXRjaCIsImZpcnN0TWF0Y2hFbnRyeSIsImZpcnN0TWF0Y2giLCJwcm90b2NvbCIsImlubmVyU2Vzc2lvbklkIiwiZENhcHMiLCJwYXJzZWRDYXBzIiwiZGVzaXJlZENhcHMiLCJwcm9jZXNzZWRKc29ud3BDYXBhYmlsaXRpZXMiLCJwcm9jZXNzZWRXM0NDYXBhYmlsaXRpZXMiLCJlcnJvciIsIklubmVyRHJpdmVyIiwic2Vzc2lvbk92ZXJyaWRlIiwiZGVsZXRlQWxsU2Vzc2lvbnMiLCJydW5uaW5nRHJpdmVyc0RhdGEiLCJvdGhlclBlbmRpbmdEcml2ZXJzRGF0YSIsImQiLCJyZWxheGVkU2VjdXJpdHlFbmFibGVkIiwiaXNFbXB0eSIsImRlbnlJbnNlY3VyZSIsImEiLCJhbGxvd0luc2VjdXJlIiwic2VydmVyIiwiY3VyU2Vzc2lvbkRhdGFGb3JEcml2ZXIiLCJlcnJvcnMiLCJTZXNzaW9uTm90Q3JlYXRlZEVycm9yIiwibWVzc2FnZSIsImRydiIsImRyaXZlckRhdGEiLCJwdXNoIiwicHVsbCIsImF0dGFjaFVuZXhwZWN0ZWRTaHV0ZG93bkhhbmRsZXIiLCJzdGFydE5ld0NvbW1hbmRUaW1lb3V0IiwiaXNXM0NQcm90b2NvbCIsIkpTT04iLCJzdHJpbmdpZnkiLCJ1cGRhdGVTZXR0aW5ncyIsImlzTWpzb253cFByb3RvY29sIiwidmFsdWUiLCJyZW1vdmVTZXNzaW9uRnJvbU1hc3Rlckxpc3QiLCJjYXVzZSIsImlzRnVuY3Rpb24iLCJvblVuZXhwZWN0ZWRTaHV0ZG93biIsInRoZW4iLCJjYXRjaCIsIkIiLCJDYW5jZWxsYXRpb25FcnJvciIsImRhdGEiLCJmaWx0ZXIiLCJzIiwiZGF0dW0iLCJkZWxldGVTZXNzaW9uIiwib3RoZXJTZXNzaW9uc0RhdGEiLCJjdXJDb25zdHJ1Y3Rvck5hbWUiLCJrZXkiLCJvcHRzIiwic2Vzc2lvbnNDb3VudCIsInNpemUiLCJmb3JjZSIsInJlYXNvbiIsInV0aWwiLCJwbHVyYWxpemUiLCJjbGVhbnVwUHJvbWlzZXMiLCJzdGFydFVuZXhwZWN0ZWRTaHV0ZG93biIsImNsZWFudXBQcm9taXNlIiwiZXhlY3V0ZUNvbW1hbmQiLCJjbWQiLCJpc0FwcGl1bURyaXZlckNvbW1hbmQiLCJsYXN0IiwicmVzIiwicHJveHlBY3RpdmUiLCJnZXRQcm94eUF2b2lkTGlzdCIsImNhblByb3h5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUdBLE1BQU1BLFNBQVMsR0FBRztBQUNoQkMsRUFBQUEsSUFBSSxFQUFFLE1BRFU7QUFFaEJDLEVBQUFBLE9BQU8sRUFBRSxTQUZPO0FBR2hCQyxFQUFBQSxH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c291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCBsb2cgZnJvbSAnLi9sb2dnZXInO1xuaW1wb3J0IHsgZ2V0QnVpbGRJbmZvLCB1cGRhdGVCdWlsZEluZm8sIEFQUElVTV9WRVIgfSBmcm9tICcuL2NvbmZpZyc7XG5pbXBvcnQgeyBCYXNlRHJpdmVyLCBlcnJvcnMsIGlzU2Vzc2lvbkNvbW1hbmQgfSBmcm9tICdhcHBpdW0tYmFzZS1kcml2ZXInO1xuaW1wb3J0IEIgZnJvbSAnYmx1ZWJpcmQnO1xuaW1wb3J0IEFzeW5jTG9jayBmcm9tICdhc3luYy1sb2NrJztcbmltcG9ydCB7IHBhcnNlQ2Fwc0ZvcklubmVyRHJpdmVyLCBnZXRQYWNrYWdlVmVyc2lvbiwgcHVsbFNldHRpbmdzIH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5pbXBvcnQgd3JhcCBmcm9tICd3b3JkLXdyYXAnO1xuaW1wb3J0IHsgRU9MIH0gZnJvbSAnb3MnO1xuaW1wb3J0IHsgdXRpbCB9IGZyb20gJ2FwcGl1bS1zdXBwb3J0JztcblxuXG5jb25zdCBQTEFURk9STVMgPSB7XG4gIEZBS0U6ICdmYWtlJyxcbiAgQU5EUk9JRDogJ2FuZHJvaWQnLFxuICBJT1M6ICdpb3MnLFxuICBBUFBMRV9UVk9TOiAndHZvcycsXG4gIFdJTkRPV1M6ICd3aW5kb3dzJyxcbiAgTUFDOiAnbWFjJyxcbiAgVElaRU46ICd0aXplbicsXG59O1xuXG5jb25zdCBBVVRPTUFUSU9OX05BTUVTID0ge1xuICBBUFBJVU06ICdBcHBpdW0nLFxuICBVSUFVVE9NQVRPUjI6ICdVaUF1dG9tYXRvcjInLFxuICBVSUFVVE9NQVRPUjE6ICdVaUF1dG9tYXRvcjEnLFxuICBYQ1VJVEVTVDogJ1hDVUlUZXN0JyxcbiAgWU9VSUVOR0lORTogJ1lvdWlFbmdpbmUnLFxuICBFU1BSRVNTTzogJ0VzcHJlc3NvJyxcbiAgVElaRU46ICdUaXplbicsXG4gIEZBS0U6ICdGYWtlJyxcbiAgSU5TVFJVTUVOVFM6ICdJbnN0cnVtZW50cycsXG4gIFdJTkRPV1M6ICdXaW5kb3dzJyxcbiAgTUFDOiAnTWFjJyxcbiAgTUFDMjogJ01hYzInLFxuICBGTFVUVEVSOiAnRmx1dHRlcicsXG4gIFNBRkFSSTogJ1NhZmFyaScsXG4gIEdFQ0tPOiAnR2Vja28nLFxufTtcbmNvbnN0IERSSVZFUl9NQVAgPSB7XG4gIFtBVVRPTUFUSU9OX05BTUVTLlVJQVVUT01BVE9SMi50b0xvd2VyQ2FzZSgpXToge1xuICAgIGRyaXZlckNsYXNzTmFtZTogJ0FuZHJvaWRVaWF1dG9tYXRvcjJEcml2ZXInLFxuICAgIGRyaXZlclBhY2thZ2U6ICdhcHBpdW0tdWlhdXRvbWF0b3IyLWRyaXZlcicsXG4gIH0sXG4gIFtBVVRPTUFUSU9OX05BTUVTLlhDVUlURVNULnRvTG93ZXJDYXNlKCldOiB7XG4gICAgZHJpdmVyQ2xhc3NOYW1lOiAnWENVSVRlc3REcml2ZXInLFxuICAgIGRyaXZlclBhY2thZ2U6ICdhcHBpdW0teGN1aXRlc3QtZHJpdmVyJyxcbiAgfSxcbiAgW0FVVE9NQVRJT05fTkFNRVMuWU9VSUVOR0lORS50b0xvd2VyQ2FzZSgpXToge1xuICAgIGRyaXZlckNsYXNzTmFtZTogJ1lvdWlFbmdpbmVEcml2ZXInLFxuICAgIGRyaXZlclBhY2thZ2U6ICdhcHBpdW0teW91aWVuZ2luZS1kcml2ZXInLFxuICB9LFxuICBbQVVUT01BVElPTl9OQU1FUy5GQUtFLnRvTG93ZXJDYXNlKCldOiB7XG4gICAgZHJpdmVyQ2xhc3NOYW1lOiAnRmFrZURyaXZlcicsXG4gICAgZHJpdmVyUGFja2FnZTogJ2FwcGl1bS1mYWtlLWRyaXZlcicsXG4gIH0sXG4gIFtBVVRPTUFUSU9OX05BTUVTLlVJQVVUT01BVE9SMS50b0xvd2VyQ2FzZSgpXToge1xuICAgIGRyaXZlckNsYXNzTmFtZTogJ0FuZHJvaWREcml2ZXInLFxuICAgIGRyaXZlclBhY2thZ2U6ICdhcHBpdW0tYW5kcm9pZC1kcml2ZXInLFxuICB9LFxuICBbQVVUT01BVElPTl9OQU1FUy5JTlNUUlVNRU5UUy50b0xvd2VyQ2FzZSgpXToge1xuICAgIGRyaXZlckNsYXNzTmFtZTogJ0lvc0RyaXZlcicsXG4gICAgZHJpdmVyUGFja2FnZTogJ2FwcGl1bS1pb3MtZHJpdmVyJyxcbiAgfSxcbiAgW0FVVE9NQVRJT05fTkFNRVMuV0lORE9XUy50b0xvd2VyQ2FzZSgpXToge1xuICAgIGRyaXZlckNsYXNzTmFtZTogJ1dpbmRvd3NEcml2ZXInLFxuICAgIGRyaXZlclBhY2thZ2U6ICdhcHBpdW0td2luZG93cy1kcml2ZXInLFxuICB9LFxuICBbQVVUT01BVElPTl9OQU1FUy5NQUMudG9Mb3dlckNhc2UoKV06IHtcbiAgICBkcml2ZXJDbGFzc05hbWU6ICdNYWNEcml2ZXInLFxuICAgIGRyaXZlclBhY2thZ2U6ICdhcHBpdW0tbWFjLWRyaXZlcicsXG4gIH0sXG4gIFtBVVRPTUFUSU9OX05BTUVTLk1BQzIudG9Mb3dlckNhc2UoKV06IHtcbiAgICBkcml2ZXJDbGFzc05hbWU6ICdNYWMyRHJpdmVyJyxcbiAgICBkcml2ZXJQYWNrYWdlOiAnYXBwaXVtLW1hYzItZHJpdmVyJyxcbiAgfSxcbiAgW0FVVE9NQVRJT05fTkFNRVMuRVNQUkVTU08udG9Mb3dlckNhc2UoKV06IHtcbiAgICBkcml2ZXJDbGFzc05hbWU6ICdFc3ByZXNzb0RyaXZlcicsXG4gICAgZHJpdmVyUGFja2FnZTogJ2FwcGl1bS1lc3ByZXNzby1kcml2ZXInLFxuICB9LFxuICBbQVVUT01BVElPTl9OQU1FUy5USVpFTi50b0xvd2VyQ2FzZSgpXToge1xuICAgIGRyaXZlckNsYXNzTmFtZTogJ1RpemVuRHJpdmVyJyxcbiAgICBkcml2ZXJQYWNrYWdlOiAnYXBwaXVtLXRpemVuLWRyaXZlcicsXG4gIH0sXG4gIFtBVVRPTUFUSU9OX05BTUVTLkZMVVRURVIudG9Mb3dlckNhc2UoKV06IHtcbiAgICBkcml2ZXJDbGFzc05hbWU6ICdGbHV0dGVyRHJpdmVyJyxcbiAgICBkcml2ZXJQYWNrYWdlOiAnYXBwaXVtLWZsdXR0ZXItZHJpdmVyJ1xuICB9LFxuICBbQVVUT01BVElPTl9OQU1FUy5TQUZBUkkudG9Mb3dlckNhc2UoKV06IHtcbiAgICBkcml2ZXJDbGFzc05hbWU6ICdTYWZhcmlEcml2ZXInLFxuICAgIGRyaXZlclBhY2thZ2U6ICdhcHBpdW0tc2FmYXJpLWRyaXZlcidcbiAgfSxcbiAgW0FVVE9NQVRJT05fTkFNRVMuR0VDS08udG9Mb3dlckNhc2UoKV06IHtcbiAgICBkcml2ZXJDbGFzc05hbWU6ICdHZWNrb0RyaXZlcicsXG4gICAgZHJpdmVyUGFja2FnZTogJ2FwcGl1bS1nZWNrb2RyaXZlcidcbiAgfSxcbn07XG5cbmNvbnN0IFBMQVRGT1JNU19NQVAgPSB7XG4gIFtQTEFURk9STVMuRkFLRV06ICgpID0+IEFVVE9NQVRJT05fTkFNRVMuRkFLRSxcbiAgW1BMQVRGT1JNUy5BTkRST0lEXTogKCkgPT4ge1xuICAgIC8vIFdhcm4gdXNlcnMgdGhhdCBkZWZhdWx0IGF1dG9tYXRpb24gaXMgZ29pbmcgdG8gY2hhbmdlIHRvIFVpQXV0b21hdG9yMiBmb3IgMS4xNFxuICAgIC8vIGFuZCB3aWxsIGJlY29tZSByZXF1aXJlZCBvbiBBcHBpdW0gMi4wXG4gICAgY29uc3QgbG9nRGl2aWRlckxlbmd0aCA9IDcwOyAvLyBGaXQgaW4gY29tbWFuZCBsaW5lXG5cbiAgICBjb25zdCBhdXRvbWF0aW9uV2FybmluZyA9IFtcbiAgICAgIGBUaGUgJ2F1dG9tYXRpb25OYW1lJyBjYXBhYmlsaXR5IHdhcyBub3QgcHJvdmlkZWQgaW4gdGhlIGRlc2lyZWQgY2FwYWJpbGl0aWVzIGZvciB0aGlzIEFuZHJvaWQgc2Vzc2lvbmAsXG4gICAgICBgU2V0dGluZyAnYXV0b21hdGlvbk5hbWU9VWlBdXRvbWF0b3IyJyBieSBkZWZhdWx0IGFuZCB1c2luZyB0aGUgVWlBdXRvbWF0b3IyIERyaXZlcmAsXG4gICAgICBgVGhlIG5leHQgbWFqb3IgdmVyc2lvbiBvZiBBcHBpdW0gKDIueCkgd2lsbCAqKnJlcXVpcmUqKiB0aGUgJ2F1dG9tYXRpb25OYW1lJyBjYXBhYmlsaXR5IHRvIGJlIHNldCBmb3IgYWxsIHNlc3Npb25zIG9uIGFsbCBwbGF0Zm9ybXNgLFxuICAgICAgYEluIHByZXZpb3VzIHZlcnNpb25zIChBcHBpdW0gPD0gMS4xMy54KSwgdGhlIGRlZmF1bHQgd2FzICdhdXRvbWF0aW9uTmFtZT1VaUF1dG9tYXRvcjEnYCxcbiAgICAgIGBJZiB5b3Ugd2lzaCB0byB1c2UgdGhhdCBhdXRvbWF0aW9uIGluc3RlYWQgb2YgVWlBdXRvbWF0b3IyLCBwbGVhc2UgYWRkICdhdXRvbWF0aW9uTmFtZT1VaUF1dG9tYXRvcjEnIHRvIHlvdXIgZGVzaXJlZCBjYXBhYmlsaXRpZXNgLFxuICAgICAgYEZvciBtb3JlIGluZm9ybWF0aW9uIGFib3V0IGRyaXZlcnMsIHBsZWFzZSB2aXNpdCBodHRwOi8vYXBwaXVtLmlvL2RvY3MvZW4vYWJvdXQtYXBwaXVtL2ludHJvLyBhbmQgZXhwbG9yZSB0aGUgJ0RyaXZlcnMnIG1lbnVgXG4gICAgXTtcblxuICAgIGxldCBkaXZpZGVyID0gYCR7RU9MfSR7Xy5yZXBlYXQoJz0nLCBsb2dEaXZpZGVyTGVuZ3RoKX0ke0VPTH1gO1xuICAgIGxldCBhdXRvbWF0aW9uV2FybmluZ1N0cmluZyA9IGRpdmlkZXI7XG4gICAgYXV0b21hdGlvbldhcm5pbmdTdHJpbmcgKz0gYCAgREVQUkVDQVRJT04gV0FSTklORzpgICsgRU9MO1xuICAgIGZvciAobGV0IGxvZyBvZiBhdXRvbWF0aW9uV2FybmluZykge1xuICAgICAgYXV0b21hdGlvbldhcm5pbmdTdHJpbmcgKz0gRU9MICsgd3JhcChsb2csIHt3aWR0aDogbG9nRGl2aWRlckxlbmd0aCAtIDJ9KSArIEVPTDtcbiAgICB9XG4gICAgYXV0b21hdGlvbldhcm5pbmdTdHJpbmcgKz0gZGl2aWRlcjtcblxuICAgIC8vIFJlY29tbWVuZCB1c2VycyB0byB1cGdyYWRlIHRvIFVpQXV0b21hdG9yMiBpZiB0aGV5J3JlIHVzaW5nIEFuZHJvaWQgPj0gNlxuICAgIGxvZy53YXJuKGF1dG9tYXRpb25XYXJuaW5nU3RyaW5nKTtcblxuICAgIHJldHVybiBBVVRPTUFUSU9OX05BTUVTLlVJQVVUT01BVE9SMjtcbiAgfSxcbiAgW1BMQVRGT1JNUy5JT1NdOiAoY2FwcykgPT4ge1xuICAgIGNvbnN0IHBsYXRmb3JtVmVyc2lvbiA9IHNlbXZlci52YWxpZChzZW12ZXIuY29lcmNlKGNhcHMucGxhdGZvcm1WZXJzaW9uKSk7XG4gICAgbG9nLndhcm4oYERlcHJlY2F0aW9uV2FybmluZzogJ2F1dG9tYXRpb25OYW1lJyBjYXBhYmlsaXR5IHdhcyBub3QgcHJvdmlkZWQuIGAgK1xuICAgICAgYEZ1dHVyZSB2ZXJzaW9ucyBvZiBBcHBpdW0gd2lsbCByZXF1aXJlICdhdXRvbWF0aW9uTmFtZScgY2FwYWJpbGl0eSB0byBiZSBzZXQgZm9yIGlPUyBzZXNzaW9ucy5gKTtcbiAgICBpZiAocGxhdGZvcm1WZXJzaW9uICYmIHNlbXZlci5zYXRpc2ZpZXMocGxhdGZvcm1WZXJzaW9uLCAnPj0xMC4wLjAnKSkge1xuICAgICAgbG9nLmluZm8oJ1JlcXVlc3RlZCBpT1Mgc3VwcG9ydCB3aXRoIHZlcnNpb24gPj0gMTAsICcgK1xuICAgICAgICBgdXNpbmcgJyR7QVVUT01BVElPTl9OQU1FUy5YQ1VJVEVTVH0nIGAgK1xuICAgICAgICAnZHJpdmVyIGluc3RlYWQgb2YgVUlBdXRvbWF0aW9uLWJhc2VkIGRyaXZlciwgc2luY2UgdGhlICcgK1xuICAgICAgICAnbGF0dGVyIGlzIHVuc3VwcG9ydGVkIG9uIGlPUyAxMCBhbmQgdXAuJyk7XG4gICAgICByZXR1cm4gQVVUT01BVElPTl9OQU1FUy5YQ1VJVEVTVDtcbiAgICB9XG5cbiAgICByZXR1cm4gQVVUT01BVElPTl9OQU1FUy5JTlNUUlVNRU5UUztcbiAgfSxcbiAgW1BMQVRGT1JNUy5BUFBMRV9UVk9TXTogKCkgPT4gQVVUT01BVElPTl9OQU1FUy5YQ1VJVEVTVCxcbiAgW1BMQVRGT1JNUy5XSU5ET1dTXTogKCkgPT4gQVVUT01BVElPTl9OQU1FUy5XSU5ET1dTLFxuICBbUExBVEZPUk1TLk1BQ106ICgpID0+IEFVVE9NQVRJT05fTkFNRVMuTUFDLFxuICBbUExBVEZPUk1TLlRJWkVOXTogKCkgPT4gQVVUT01BVElPTl9OQU1FUy5USVpFTixcbn07XG5cbmNvbnN0IGRlc2lyZWRDYXBhYmlsaXR5Q29uc3RyYWludHMgPSB7XG4gIGF1dG9tYXRpb25OYW1lOiB7XG4gICAgcHJlc2VuY2U6IGZhbHNlLFxuICAgIGlzU3RyaW5nOiB0cnVlLFxuICAgIGluY2x1c2lvbkNhc2VJbnNlbnNpdGl2ZTogXy52YWx1ZXMoQVVUT01BVElPTl9OQU1FUyksXG4gIH0sXG4gIHBsYXRmb3JtTmFtZToge1xuICAgIHByZXNlbmNlOiB0cnVlLFxuICAgIGlzU3RyaW5nOiB0cnVlLFxuICAgIGluY2x1c2lvbkNhc2VJbnNlbnNpdGl2ZTogXy5rZXlzKFBMQVRGT1JNU19NQVApLFxuICB9LFxufTtcblxuY29uc3Qgc2Vzc2lvbnNMaXN0R3VhcmQgPSBuZXcgQXN5bmNMb2NrKCk7XG5jb25zdCBwZW5kaW5nRHJpdmVyc0d1YXJkID0gbmV3IEFzeW5jTG9jaygpO1xuXG5jbGFzcyBBcHBpdW1Ecml2ZXIgZXh0ZW5kcyBCYXNlRHJpdmVyIHtcbiAgY29uc3RydWN0b3IgKGFyZ3MpIHtcbiAgICAvLyBJdCBpcyBuZWNlc3NhcnkgdG8gc2V0IGAtLXRtcGAgaGVyZSBzaW5jZSBpdCBzaG91bGQgYmUgc2V0IHRvXG4gICAgLy8gcHJvY2Vzcy5lbnYuQVBQSVVNX1RNUF9ESVIgb25jZSBhdCBhbiBpbml0aWFsIHBvaW50IGluIHRoZSBBcHBpdW0gbGlmZWN5Y2xlLlxuICAgIC8vIFRoZSBwcm9jZXNzIGFyZ3VtZW50IHdpbGwgYmUgcmVmZXJlbmNlZCBieSBCYXNlRHJpdmVyLlxuICAgIC8vIFBsZWFzZSBjYWxsIGFwcGl1bS1zdXBwb3J0LnRlbXBEaXIgbW9kdWxlIHRvIGFwcGx5IHRoaXMgYmVuZWZpdC5cbiAgICBpZiAoYXJncy50bXBEaXIpIHtcbiAgICAgIHByb2Nlc3MuZW52LkFQUElVTV9UTVBfRElSID0gYXJncy50bXBEaXI7XG4gICAgfVxuXG4gICAgc3VwZXIoYXJncyk7XG5cbiAgICB0aGlzLmRlc2lyZWRDYXBDb25zdHJhaW50cyA9IGRlc2lyZWRDYXBhYmlsaXR5Q29uc3RyYWludHM7XG5cbiAgICAvLyB0aGUgbWFpbiBBcHBpdW0gRHJpdmVyIGhhcyBubyBuZXcgY29tbWFuZCB0aW1lb3V0XG4gICAgdGhpcy5uZXdDb21tYW5kVGltZW91dE1zID0gMDtcblxuICAgIHRoaXMuYXJncyA9IE9iamVjdC5hc3NpZ24oe30sIGFyZ3MpO1xuXG4gICAgLy8gQWNjZXNzIHRvIHNlc3Npb25zIGxpc3QgbXVzdCBiZSBndWFyZGVkIHdpdGggYSBTZW1hcGhvcmUsIGJlY2F1c2VcbiAgICAvLyBpdCBtaWdodCBiZSBjaGFuZ2VkIGJ5IG90aGVyIGFzeW5jIGNhbGxzIGF0IGFueSB0aW1lXG4gICAgLy8gSXQgaXMgbm90IHJlY29tbWVuZGVkIHRvIGFjY2VzcyB0aGlzIHByb3BlcnR5IGRpcmVjdGx5IGZyb20gdGhlIG91dHNpZGVcbiAgICB0aGlzLnNlc3Npb25zID0ge307XG5cbiAgICAvLyBBY2Nlc3MgdG8gcGVuZGluZyBkcml2ZXJzIGxpc3QgbXVzdCBiZSBndWFyZGVkIHdpdGggYSBTZW1hcGhvcmUsIGJlY2F1c2VcbiAgICAvLyBpdCBtaWdodCBiZSBjaGFuZ2VkIGJ5IG90aGVyIGFzeW5jIGNhbGxzIGF0IGFueSB0aW1lXG4gICAgLy8gSXQgaXMgbm90IHJlY29tbWVuZGVkIHRvIGFjY2VzcyB0aGlzIHByb3BlcnR5IGRpcmVjdGx5IGZyb20gdGhlIG91dHNpZGVcbiAgICB0aGlzLnBlbmRpbmdEcml2ZXJzID0ge307XG5cbiAgICAvLyBhbGxvdyB0aGlzIHRvIGhhcHBlbiBpbiB0aGUgYmFja2dyb3VuZCwgc28gbm8gYGF3YWl0YFxuICAgIHVwZGF0ZUJ1aWxkSW5mbygpO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbmNlbCBjb21tYW5kcyBxdWV1ZWluZyBmb3IgdGhlIHVtYnJlbGxhIEFwcGl1bSBkcml2ZXJcbiAgICovXG4gIGdldCBpc0NvbW1hbmRzUXVldWVFbmFibGVkICgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBzZXNzaW9uRXhpc3RzIChzZXNzaW9uSWQpIHtcbiAgICBjb25zdCBkc3RTZXNzaW9uID0gdGhpcy5zZXNzaW9uc1tzZXNzaW9uSWRdO1xuICAgIHJldHVybiBkc3RTZXNzaW9uICYmIGRzdFNlc3Npb24uc2Vzc2lvbklkICE9PSBudWxsO1xuICB9XG5cbiAgZHJpdmVyRm9yU2Vzc2lvbiAoc2Vzc2lvbklkKSB7XG4gICAgcmV0dXJuIHRoaXMuc2Vzc2lvbnNbc2Vzc2lvbklkXTtcbiAgfVxuXG4gIGdldERyaXZlckFuZFZlcnNpb25Gb3JDYXBzIChjYXBzKSB7XG4gICAgaWYgKCFfLmlzU3RyaW5nKGNhcHMucGxhdGZvcm1OYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBpbmNsdWRlIGEgcGxhdGZvcm1OYW1lIGNhcGFiaWxpdHknKTtcbiAgICB9XG5cbiAgICBjb25zdCBwbGF0Zm9ybU5hbWUgPSBjYXBzLnBsYXRmb3JtTmFtZS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgLy8gd2UgZG9uJ3QgbmVjZXNzYXJpbHkgaGF2ZSBhbiBgYXV0b21hdGlvbk5hbWVgIGNhcGFiaWxpdHlcbiAgICBsZXQgYXV0b21hdGlvbk5hbWVDYXAgPSBjYXBzLmF1dG9tYXRpb25OYW1lO1xuICAgIGlmICghXy5pc1N0cmluZyhhdXRvbWF0aW9uTmFtZUNhcCkgfHwgYXV0b21hdGlvbk5hbWVDYXAudG9Mb3dlckNhc2UoKSA9PT0gJ2FwcGl1bScpIHtcbiAgICAgIGNvbnN0IGRyaXZlclNlbGVjdG9yID0gUExBVEZPUk1TX01BUFtwbGF0Zm9ybU5hbWVdO1xuICAgICAgaWYgKGRyaXZlclNlbGVjdG9yKSB7XG4gICAgICAgIGF1dG9tYXRpb25OYW1lQ2FwID0gZHJpdmVyU2VsZWN0b3IoY2Fwcyk7XG4gICAgICB9XG4gICAgfVxuICAgIGF1dG9tYXRpb25OYW1lQ2FwID0gXy50b0xvd2VyKGF1dG9tYXRpb25OYW1lQ2FwKTtcblxuICAgIGxldCBmYWlsdXJlVmVyYiA9ICdmaW5kJztcbiAgICBsZXQgc3VnZ2VzdGlvbiA9ICdQbGVhc2UgY2hlY2sgeW91ciBkZXNpcmVkIGNhcGFiaWxpdGllcyc7XG4gICAgaWYgKF8uaXNQbGFpbk9iamVjdChEUklWRVJfTUFQW2F1dG9tYXRpb25OYW1lQ2FwXSkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHtkcml2ZXJQYWNrYWdlLCBkcml2ZXJDbGFzc05hbWV9ID0gRFJJVkVSX01BUFthdXRvbWF0aW9uTmFtZUNhcF07XG4gICAgICAgIGNvbnN0IGRyaXZlciA9IHJlcXVpcmUoZHJpdmVyUGFja2FnZSlbZHJpdmVyQ2xhc3NOYW1lXTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBkcml2ZXIsXG4gICAgICAgICAgdmVyc2lvbjogdGhpcy5nZXREcml2ZXJWZXJzaW9uKGRyaXZlci5uYW1lLCBkcml2ZXJQYWNrYWdlKSxcbiAgICAgICAgfTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbG9nLmRlYnVnKGUpO1xuICAgICAgICBmYWlsdXJlVmVyYiA9ICdsb2FkJztcbiAgICAgICAgc3VnZ2VzdGlvbiA9ICdQbGVhc2UgdmVyaWZ5IHlvdXIgQXBwaXVtIGluc3RhbGxhdGlvbic7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbXNnID0gXy5pc1N0cmluZyhjYXBzLmF1dG9tYXRpb25OYW1lKVxuICAgICAgPyBgQ291bGQgbm90ICR7ZmFpbHVyZVZlcmJ9IGEgZHJpdmVyIGZvciBhdXRvbWF0aW9uTmFtZSAnJHtjYXBzLmF1dG9tYXRpb25OYW1lfScgYW5kIHBsYXRmb3JtTmFtZSBgICtcbiAgICAgICAgICAgIGAnJHtjYXBzLnBsYXRmb3JtTmFtZX0nYFxuICAgICAgOiBgQ291bGQgbm90ICR7ZmFpbHVyZVZlcmJ9IGEgZHJpdmVyIGZvciBwbGF0Zm9ybU5hbWUgJyR7Y2Fwcy5wbGF0Zm9ybU5hbWV9J2A7XG4gICAgdGhyb3cgbmV3IEVycm9yKGAke21zZ30uICR7c3VnZ2VzdGlvbn1gKTtcbiAgfVxuXG4gIGdldERyaXZlclZlcnNpb24gKGRyaXZlck5hbWUsIGRyaXZlclBhY2thZ2UpIHtcbiAgICBjb25zdCB2ZXJzaW9uID0gZ2V0UGFja2FnZVZlcnNpb24oZHJpdmVyUGFja2FnZSk7XG4gICAgaWYgKHZlcnNpb24pIHtcbiAgICAgIHJldHVybiB2ZXJzaW9uO1xuICAgIH1cbiAgICBsb2cud2FybihgVW5hYmxlIHRvIGdldCB2ZXJzaW9uIG9mIGRyaXZlciAnJHtkcml2ZXJOYW1lfSdgKTtcbiAgfVxuXG4gIGFzeW5jIGdldFN0YXR1cyAoKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgcmVxdWlyZS1hd2FpdFxuICAgIHJldHVybiB7XG4gICAgICBidWlsZDogXy5jbG9uZShnZXRCdWlsZEluZm8oKSksXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIGdldFNlc3Npb25zICgpIHtcbiAgICBjb25zdCBzZXNzaW9ucyA9IGF3YWl0IHNlc3Npb25zTGlzdEd1YXJkLmFjcXVpcmUoQXBwaXVtRHJpdmVyLm5hbWUsICgpID0+IHRoaXMuc2Vzc2lvbnMpO1xuICAgIHJldHVybiBfLnRvUGFpcnMoc2Vzc2lvbnMpXG4gICAgICAubWFwKChbaWQsIGRyaXZlcl0pID0+ICh7aWQsIGNhcGFiaWxpdGllczogZHJpdmVyLmNhcHN9KSk7XG4gIH1cblxuICBwcmludE5ld1Nlc3Npb25Bbm5vdW5jZW1lbnQgKGRyaXZlck5hbWUsIGRyaXZlclZlcnNpb24pIHtcbiAgICBjb25zdCBpbnRyb1N0cmluZyA9IGRyaXZlclZlcnNpb25cbiAgICAgID8gYEFwcGl1bSB2JHtBUFBJVU1fVkVSfSBjcmVhdGluZyBuZXcgJHtkcml2ZXJOYW1lfSAodiR7ZHJpdmVyVmVyc2lvbn0pIHNlc3Npb25gXG4gICAgICA6IGBBcHBpdW0gdiR7QVBQSVVNX1ZFUn0gY3JlYXRpbmcgbmV3ICR7ZHJpdmVyTmFtZX0gc2Vzc2lvbmA7XG4gICAgbG9nLmluZm8oaW50cm9TdHJpbmcpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBzZXNzaW9uXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBqc29ud3BDYXBzIEpTT05XUCBmb3JtYXR0ZWQgZGVzaXJlZCBjYXBhYmlsaXRpZXNcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlcUNhcHMgUmVxdWlyZWQgY2FwYWJpbGl0aWVzIChKU09OV1Agc3RhbmRhcmQpXG4gICAqIEBwYXJhbSB7T2JqZWN0fSB3M2NDYXBhYmlsaXRpZXMgVzNDIGNhcGFiaWxpdGllc1xuICAgKiBAcmV0dXJuIHtBcnJheX0gVW5pcXVlIHNlc3Npb24gSUQgYW5kIGNhcGFiaWxpdGllc1xuICAgKi9cbiAgYXN5bmMgY3JlYXRlU2Vzc2lvbiAoanNvbndwQ2FwcywgcmVxQ2FwcywgdzNjQ2FwYWJpbGl0aWVzKSB7XG4gICAgY29uc3QgZGVmYXVsdENhcGFiaWxpdGllcyA9IF8uY2xvbmVEZWVwKHRoaXMuYXJncy5kZWZhdWx0Q2FwYWJpbGl0aWVzKTtcbiAgICBjb25zdCBkZWZhdWx0U2V0dGluZ3MgPSBwdWxsU2V0dGluZ3MoZGVmYXVsdENhcGFiaWxpdGllcyk7XG4gICAganNvbndwQ2FwcyA9IF8uY2xvbmVEZWVwKGpzb253cENhcHMpO1xuICAgIGNvbnN0IGp3cFNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdFNldHRpbmdzLCBwdWxsU2V0dGluZ3MoanNvbndwQ2FwcykpO1xuICAgIHczY0NhcGFiaWxpdGllcyA9IF8uY2xvbmVEZWVwKHczY0NhcGFiaWxpdGllcyk7XG4gICAgLy8gSXQgaXMgcG9zc2libGUgdGhhdCB0aGUgY2xpZW50IG9ubHkgcHJvdmlkZXMgY2FwcyB1c2luZyBKU09OV1Agc3RhbmRhcmQsXG4gICAgLy8gYWx0aG91Z2ggZmlyc3RNYXRjaC9hbHdheXNNYXRjaCBwcm9wZXJ0aWVzIGFyZSBzdGlsbCBwcmVzZW50LlxuICAgIC8vIEluIHN1Y2ggY2FzZSB3ZSBhc3N1bWUgdGhlIGNsaWVudCB1bmRlcnN0YW5kcyBXM0MgcHJvdG9jb2wgYW5kIG1lcmdlIHRoZSBnaXZlblxuICAgIC8vIEpTT05XUCBjYXBzIHRvIFczQyBjYXBzXG4gICAgY29uc3QgdzNjU2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBqd3BTZXR0aW5ncyk7XG4gICAgT2JqZWN0LmFzc2lnbih3M2NTZXR0aW5ncywgcHVsbFNldHRpbmdzKCh3M2NDYXBhYmlsaXRpZXMgfHwge30pLmFsd2F5c01hdGNoIHx8IHt9KSk7XG4gICAgZm9yIChjb25zdCBmaXJzdE1hdGNoRW50cnkgb2YgKCh3M2NDYXBhYmlsaXRpZXMgfHwge30pLmZpcnN0TWF0Y2ggfHwgW10pKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHczY1NldHRpbmdzLCBwdWxsU2V0dGluZ3MoZmlyc3RNYXRjaEVudHJ5KSk7XG4gICAgfVxuXG4gICAgbGV0IHByb3RvY29sO1xuICAgIGxldCBpbm5lclNlc3Npb25JZCwgZENhcHM7XG4gICAgdHJ5IHtcbiAgICAgIC8vIFBhcnNlIHRoZSBjYXBzIGludG8gYSBmb3JtYXQgdGhhdCB0aGUgSW5uZXJEcml2ZXIgd2lsbCBhY2NlcHRcbiAgICAgIGNvbnN0IHBhcnNlZENhcHMgPSBwYXJzZUNhcHNGb3JJbm5lckRyaXZlcihcbiAgICAgICAganNvbndwQ2FwcyxcbiAgICAgICAgdzNjQ2FwYWJpbGl0aWVzLFxuICAgICAgICB0aGlzLmRlc2lyZWRDYXBDb25zdHJhaW50cyxcbiAgICAgICAgZGVmYXVsdENhcGFiaWxpdGllc1xuICAgICAgKTtcblxuICAgICAgY29uc3Qge2Rlc2lyZWRDYXBzLCBwcm9jZXNzZWRKc29ud3BDYXBhYmlsaXRpZXMsIHByb2Nlc3NlZFczQ0NhcGFiaWxpdGllcywgZXJyb3J9ID0gcGFyc2VkQ2FwcztcbiAgICAgIHByb3RvY29sID0gcGFyc2VkQ2Fwcy5wcm90b2NvbDtcblxuICAgICAgLy8gSWYgdGhlIHBhcnNpbmcgb2YgdGhlIGNhcHMgcHJvZHVjZWQgYW4gZXJyb3IsIHRocm93IGl0IGluIGhlcmVcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cblxuICAgICAgY29uc3Qge2RyaXZlcjogSW5uZXJEcml2ZXIsIHZlcnNpb246IGRyaXZlclZlcnNpb259ID0gdGhpcy5nZXREcml2ZXJBbmRWZXJzaW9uRm9yQ2FwcyhkZXNpcmVkQ2Fwcyk7XG4gICAgICB0aGlzLnByaW50TmV3U2Vzc2lvbkFubm91bmNlbWVudChJbm5lckRyaXZlci5uYW1lLCBkcml2ZXJWZXJzaW9uKTtcblxuICAgICAgaWYgKHRoaXMuYXJncy5zZXNzaW9uT3ZlcnJpZGUpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5kZWxldGVBbGxTZXNzaW9ucygpO1xuICAgICAgfVxuXG4gICAgICBsZXQgcnVubmluZ0RyaXZlcnNEYXRhLCBvdGhlclBlbmRpbmdEcml2ZXJzRGF0YTtcbiAgICAgIGNvbnN0IGQgPSBuZXcgSW5uZXJEcml2ZXIodGhpcy5hcmdzKTtcblxuICAgICAgLy8gV2Ugd2FudCB0byBhc3NpZ24gc2VjdXJpdHkgdmFsdWVzIGRpcmVjdGx5IG9uIHRoZSBkcml2ZXIuIFRoZSBkcml2ZXJcbiAgICAgIC8vIHNob3VsZCBub3QgcmVhZCBzZWN1cml0eSB2YWx1ZXMgZnJvbSBgdGhpcy5vcHRzYCBiZWNhdXNlIHRob3NlIHZhbHVlc1xuICAgICAgLy8gY291bGQgaGF2ZSBiZWVuIHNldCBieSBhIG1hbGljaW91cyB1c2VyIHZpYSBjYXBhYmlsaXRpZXMsIHdoZXJlYXMgd2VcbiAgICAgIC8vIHdhbnQgYSBndWFyYW50ZWUgdGhlIHZhbHVlcyB3ZXJlIHNldCBieSB0aGUgYXBwaXVtIHNlcnZlciBhZG1pblxuICAgICAgaWYgKHRoaXMuYXJncy5yZWxheGVkU2VjdXJpdHlFbmFibGVkKSB7XG4gICAgICAgIGxvZy5pbmZvKGBBcHBseWluZyByZWxheGVkIHNlY3VyaXR5IHRvICcke0lubmVyRHJpdmVyLm5hbWV9JyBhcyBwZXIgYCArXG4gICAgICAgICAgICAgICAgIGBzZXJ2ZXIgY29tbWFuZCBsaW5lIGFyZ3VtZW50LiBBbGwgaW5zZWN1cmUgZmVhdHVyZXMgd2lsbCBiZSBgICtcbiAgICAgICAgICAgICAgICAgYGVuYWJsZWQgdW5sZXNzIGV4cGxpY2l0bHkgZGlzYWJsZWQgYnkgLS1kZW55LWluc2VjdXJlYCk7XG4gICAgICAgIGQucmVsYXhlZFNlY3VyaXR5RW5hYmxlZCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghXy5pc0VtcHR5KHRoaXMuYXJncy5kZW55SW5zZWN1cmUpKSB7XG4gICAgICAgIGxvZy5pbmZvKCdFeHBsaWNpdGx5IHByZXZlbnRpbmcgdXNlIG9mIGluc2VjdXJlIGZlYXR1cmVzOicpO1xuICAgICAgICB0aGlzLmFyZ3MuZGVueUluc2VjdXJlLm1hcCgoYSkgPT4gbG9nLmluZm8oYCAgICAke2F9YCkpO1xuICAgICAgICBkLmRlbnlJbnNlY3VyZSA9IHRoaXMuYXJncy5kZW55SW5zZWN1cmU7XG4gICAgICB9XG5cbiAgICAgIGlmICghXy5pc0VtcHR5KHRoaXMuYXJncy5hbGxvd0luc2VjdXJlKSkge1xuICAgICAgICBsb2cuaW5mbygnRXhwbGljaXRseSBlbmFibGluZyB1c2Ugb2YgaW5zZWN1cmUgZmVhdHVyZXM6Jyk7XG4gICAgICAgIHRoaXMuYXJncy5hbGxvd0luc2VjdXJlLm1hcCgoYSkgPT4gbG9nLmluZm8oYCAgICAke2F9YCkpO1xuICAgICAgICBkLmFsbG93SW5zZWN1cmUgPSB0aGlzLmFyZ3MuYWxsb3dJbnNlY3VyZTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhpcyBhc3NpZ25tZW50IGlzIHJlcXVpcmVkIGZvciBjb3JyZWN0IHdlYiBzb2NrZXRzIGZ1bmN0aW9uYWxpdHkgaW5zaWRlIHRoZSBkcml2ZXJcbiAgICAgIGQuc2VydmVyID0gdGhpcy5zZXJ2ZXI7XG4gICAgICB0cnkge1xuICAgICAgICBydW5uaW5nRHJpdmVyc0RhdGEgPSBhd2FpdCB0aGlzLmN1clNlc3Npb25EYXRhRm9yRHJpdmVyKElubmVyRHJpdmVyKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5TZXNzaW9uTm90Q3JlYXRlZEVycm9yKGUubWVzc2FnZSk7XG4gICAgICB9XG4gICAgICBhd2FpdCBwZW5kaW5nRHJpdmVyc0d1YXJkLmFjcXVpcmUoQXBwaXVtRHJpdmVyLm5hbWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5wZW5kaW5nRHJpdmVyc1tJbm5lckRyaXZlci5uYW1lXSA9IHRoaXMucGVuZGluZ0RyaXZlcnNbSW5uZXJEcml2ZXIubmFtZV0gfHwgW107XG4gICAgICAgIG90aGVyUGVuZGluZ0RyaXZlcnNEYXRhID0gdGhpcy5wZW5kaW5nRHJpdmVyc1tJbm5lckRyaXZlci5uYW1lXS5tYXAoKGRydikgPT4gZHJ2LmRyaXZlckRhdGEpO1xuICAgICAgICB0aGlzLnBlbmRpbmdEcml2ZXJzW0lubmVyRHJpdmVyLm5hbWVdLnB1c2goZCk7XG4gICAgICB9KTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgW2lubmVyU2Vzc2lvbklkLCBkQ2Fwc10gPSBhd2FpdCBkLmNyZWF0ZVNlc3Npb24oXG4gICAgICAgICAgcHJvY2Vzc2VkSnNvbndwQ2FwYWJpbGl0aWVzLFxuICAgICAgICAgIHJlcUNhcHMsXG4gICAgICAgICAgcHJvY2Vzc2VkVzNDQ2FwYWJpbGl0aWVzLFxuICAgICAgICAgIFsuLi5ydW5uaW5nRHJpdmVyc0RhdGEsIC4uLm90aGVyUGVuZGluZ0RyaXZlcnNEYXRhXVxuICAgICAgICApO1xuICAgICAgICBwcm90b2NvbCA9IGQucHJvdG9jb2w7XG4gICAgICAgIGF3YWl0IHNlc3Npb25zTGlzdEd1YXJkLmFjcXVpcmUoQXBwaXVtRHJpdmVyLm5hbWUsICgpID0+IHtcbiAgICAgICAgICB0aGlzLnNlc3Npb25zW2lubmVyU2Vzc2lvbklkXSA9IGQ7XG4gICAgICAgIH0pO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgYXdhaXQgcGVuZGluZ0RyaXZlcnNHdWFyZC5hY3F1aXJlKEFwcGl1bURyaXZlci5uYW1lLCAoKSA9PiB7XG4gICAgICAgICAgXy5wdWxsKHRoaXMucGVuZGluZ0RyaXZlcnNbSW5uZXJEcml2ZXIubmFtZV0sIGQpO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5hdHRhY2hVbmV4cGVjdGVkU2h1dGRvd25IYW5kbGVyKGQsIGlubmVyU2Vzc2lvbklkKTtcblxuICAgICAgbG9nLmluZm8oYE5ldyAke0lubmVyRHJpdmVyLm5hbWV9IHNlc3Npb24gY3JlYXRlZCBzdWNjZXNzZnVsbHksIHNlc3Npb24gYCArXG4gICAgICAgICAgICAgIGAke2lubmVyU2Vzc2lvbklkfSBhZGRlZCB0byBtYXN0ZXIgc2Vzc2lvbiBsaXN0YCk7XG5cbiAgICAgIC8vIHNldCB0aGUgTmV3IENvbW1hbmQgVGltZW91dCBmb3IgdGhlIGlubmVyIGRyaXZlclxuICAgICAgZC5zdGFydE5ld0NvbW1hbmRUaW1lb3V0KCk7XG5cbiAgICAgIC8vIGFwcGx5IGluaXRpYWwgdmFsdWVzIHRvIEFwcGl1bSBzZXR0aW5ncyAoaWYgcHJvdmlkZWQpXG4gICAgICBpZiAoZC5pc1czQ1Byb3RvY29sKCkgJiYgIV8uaXNFbXB0eSh3M2NTZXR0aW5ncykpIHtcbiAgICAgICAgbG9nLmluZm8oYEFwcGx5aW5nIHRoZSBpbml0aWFsIHZhbHVlcyB0byBBcHBpdW0gc2V0dGluZ3MgcGFyc2VkIGZyb20gVzNDIGNhcHM6IGAgK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHczY1NldHRpbmdzKSk7XG4gICAgICAgIGF3YWl0IGQudXBkYXRlU2V0dGluZ3ModzNjU2V0dGluZ3MpO1xuICAgICAgfSBlbHNlIGlmIChkLmlzTWpzb253cFByb3RvY29sKCkgJiYgIV8uaXNFbXB0eShqd3BTZXR0aW5ncykpIHtcbiAgICAgICAgbG9nLmluZm8oYEFwcGx5aW5nIHRoZSBpbml0aWFsIHZhbHVlcyB0byBBcHBpdW0gc2V0dGluZ3MgcGFyc2VkIGZyb20gTUpTT05XUCBjYXBzOiBgICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShqd3BTZXR0aW5ncykpO1xuICAgICAgICBhd2FpdCBkLnVwZGF0ZVNldHRpbmdzKGp3cFNldHRpbmdzKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcHJvdG9jb2wsXG4gICAgICAgIGVycm9yLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgcHJvdG9jb2wsXG4gICAgICB2YWx1ZTogW2lubmVyU2Vzc2lvbklkLCBkQ2FwcywgcHJvdG9jb2xdXG4gICAgfTtcbiAgfVxuXG4gIGF0dGFjaFVuZXhwZWN0ZWRTaHV0ZG93bkhhbmRsZXIgKGRyaXZlciwgaW5uZXJTZXNzaW9uSWQpIHtcbiAgICBjb25zdCByZW1vdmVTZXNzaW9uRnJvbU1hc3Rlckxpc3QgPSAoY2F1c2UgPSBuZXcgRXJyb3IoJ1Vua25vd24gZXJyb3InKSkgPT4ge1xuICAgICAgbG9nLndhcm4oYENsb3Npbmcgc2Vzc2lvbiwgY2F1c2Ugd2FzICcke2NhdXNlLm1lc3NhZ2V9J2ApO1xuICAgICAgbG9nLmluZm8oYFJlbW92aW5nIHNlc3Npb24gJyR7aW5uZXJTZXNzaW9uSWR9JyBmcm9tIG91ciBtYXN0ZXIgc2Vzc2lvbiBsaXN0YCk7XG4gICAgICBkZWxldGUgdGhpcy5zZXNzaW9uc1tpbm5lclNlc3Npb25JZF07XG4gICAgfTtcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBwcm9taXNlL3ByZWZlci1hd2FpdC10by10aGVuXG4gICAgaWYgKF8uaXNGdW5jdGlvbigoZHJpdmVyLm9uVW5leHBlY3RlZFNodXRkb3duIHx8IHt9KS50aGVuKSkge1xuICAgICAgLy8gVE9ETzogUmVtb3ZlIHRoaXMgYmxvY2sgYWZ0ZXIgYWxsIHRoZSBkcml2ZXJzIHVzZSBiYXNlIGRyaXZlciBhYm92ZSB2IDUuMC4wXG4gICAgICAvLyBSZW1vdmUgdGhlIHNlc3Npb24gb24gdW5leHBlY3RlZCBzaHV0ZG93biwgc28gdGhhdCB3ZSBhcmUgaW4gYSBwb3NpdGlvblxuICAgICAgLy8gdG8gb3BlbiBhbm90aGVyIHNlc3Npb24gbGF0ZXIgb24uXG4gICAgICBkcml2ZXIub25VbmV4cGVjdGVkU2h1dGRvd25cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHByb21pc2UvcHJlZmVyLWF3YWl0LXRvLXRoZW5cbiAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIC8vIGlmIHdlIGdldCBoZXJlLCB3ZSd2ZSBoYWQgYW4gdW5leHBlY3RlZCBzaHV0ZG93biwgc28gZXJyb3JcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc2h1dGRvd24nKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgLy8gaWYgd2UgY2FuY2VsbGVkIHRoZSB1bmV4cGVjdGVkIHNodXRkb3duIHByb21pc2UsIHRoYXQgbWVhbnMgd2VcbiAgICAgICAgICAvLyBubyBsb25nZXIgY2FyZSBhYm91dCBpdCwgYW5kIGNhbiBzYWZlbHkgaWdub3JlIGl0XG4gICAgICAgICAgaWYgKCEoZSBpbnN0YW5jZW9mIEIuQ2FuY2VsbGF0aW9uRXJyb3IpKSB7XG4gICAgICAgICAgICByZW1vdmVTZXNzaW9uRnJvbU1hc3Rlckxpc3QoZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTsgLy8gdGhpcyBpcyBhIGNhbmNlbGxhYmxlIHByb21pc2VcbiAgICB9IGVsc2UgaWYgKF8uaXNGdW5jdGlvbihkcml2ZXIub25VbmV4cGVjdGVkU2h1dGRvd24pKSB7XG4gICAgICAvLyBzaW5jZSBiYXNlIGRyaXZlciB2IDUuMC4wXG4gICAgICBkcml2ZXIub25VbmV4cGVjdGVkU2h1dGRvd24ocmVtb3ZlU2Vzc2lvbkZyb21NYXN0ZXJMaXN0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nLndhcm4oYEZhaWxlZCB0byBhdHRhY2ggdGhlIHVuZXhwZWN0ZWQgc2h1dGRvd24gbGlzdGVuZXIuIGAgK1xuICAgICAgICBgSXMgJ29uVW5leHBlY3RlZFNodXRkb3duJyBtZXRob2QgYXZhaWxhYmxlIGZvciAnJHtkcml2ZXIuY29uc3RydWN0b3IubmFtZX0nP2ApO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGN1clNlc3Npb25EYXRhRm9yRHJpdmVyIChJbm5lckRyaXZlcikge1xuICAgIGNvbnN0IHNlc3Npb25zID0gYXdhaXQgc2Vzc2lvbnNMaXN0R3VhcmQuYWNxdWlyZShBcHBpdW1Ecml2ZXIubmFtZSwgKCkgPT4gdGhpcy5zZXNzaW9ucyk7XG4gICAgY29uc3QgZGF0YSA9IF8udmFsdWVzKHNlc3Npb25zKVxuICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKHMpID0+IHMuY29uc3RydWN0b3IubmFtZSA9PT0gSW5uZXJEcml2ZXIubmFtZSlcbiAgICAgICAgICAgICAgICAgICAubWFwKChzKSA9PiBzLmRyaXZlckRhdGEpO1xuICAgIGZvciAobGV0IGRhdHVtIG9mIGRhdGEpIHtcbiAgICAgIGlmICghZGF0dW0pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9ibGVtIGdldHRpbmcgc2Vzc2lvbiBkYXRhIGZvciBkcml2ZXIgdHlwZSBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGAke0lubmVyRHJpdmVyLm5hbWV9OyBkb2VzIGl0IGltcGxlbWVudCAnZ2V0IGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYGRyaXZlckRhdGEnP2ApO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGF0YTtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZVNlc3Npb24gKHNlc3Npb25JZCkge1xuICAgIGxldCBwcm90b2NvbDtcbiAgICB0cnkge1xuICAgICAgbGV0IG90aGVyU2Vzc2lvbnNEYXRhID0gbnVsbDtcbiAgICAgIGxldCBkc3RTZXNzaW9uID0gbnVsbDtcbiAgICAgIGF3YWl0IHNlc3Npb25zTGlzdEd1YXJkLmFjcXVpcmUoQXBwaXVtRHJpdmVyLm5hbWUsICgpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLnNlc3Npb25zW3Nlc3Npb25JZF0pIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY3VyQ29uc3RydWN0b3JOYW1lID0gdGhpcy5zZXNzaW9uc1tzZXNzaW9uSWRdLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICAgIG90aGVyU2Vzc2lvbnNEYXRhID0gXy50b1BhaXJzKHRoaXMuc2Vzc2lvbnMpXG4gICAgICAgICAgICAgIC5maWx0ZXIoKFtrZXksIHZhbHVlXSkgPT4gdmFsdWUuY29uc3RydWN0b3IubmFtZSA9PT0gY3VyQ29uc3RydWN0b3JOYW1lICYmIGtleSAhPT0gc2Vzc2lvbklkKVxuICAgICAgICAgICAgICAubWFwKChbLCB2YWx1ZV0pID0+IHZhbHVlLmRyaXZlckRhdGEpO1xuICAgICAgICBkc3RTZXNzaW9uID0gdGhpcy5zZXNzaW9uc1tzZXNzaW9uSWRdO1xuICAgICAgICBwcm90b2NvbCA9IGRzdFNlc3Npb24ucHJvdG9jb2w7XG4gICAgICAgIGxvZy5pbmZvKGBSZW1vdmluZyBzZXNzaW9uICR7c2Vzc2lvbklkfSBmcm9tIG91ciBtYXN0ZXIgc2Vzc2lvbiBsaXN0YCk7XG4gICAgICAgIC8vIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB0aGUgZGVsZXRlU2Vzc2lvbiBjb21wbGV0ZXMgc3VjY2Vzc2Z1bGx5IG9yIG5vdFxuICAgICAgICAvLyBtYWtlIHRoZSBzZXNzaW9uIHVuYXZhaWxhYmxlLCBiZWNhdXNlIHdobyBrbm93cyB3aGF0IHN0YXRlIGl0IG1pZ2h0XG4gICAgICAgIC8vIGJlIGluIG90aGVyd2lzZVxuICAgICAgICBkZWxldGUgdGhpcy5zZXNzaW9uc1tzZXNzaW9uSWRdO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBwcm90b2NvbCxcbiAgICAgICAgdmFsdWU6IGF3YWl0IGRzdFNlc3Npb24uZGVsZXRlU2Vzc2lvbihzZXNzaW9uSWQsIG90aGVyU2Vzc2lvbnNEYXRhKSxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgbG9nLmVycm9yKGBIYWQgdHJvdWJsZSBlbmRpbmcgc2Vzc2lvbiAke3Nlc3Npb25JZH06ICR7ZS5tZXNzYWdlfWApO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcHJvdG9jb2wsXG4gICAgICAgIGVycm9yOiBlLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkZWxldGVBbGxTZXNzaW9ucyAob3B0cyA9IHt9KSB7XG4gICAgY29uc3Qgc2Vzc2lvbnNDb3VudCA9IF8uc2l6ZSh0aGlzLnNlc3Npb25zKTtcbiAgICBpZiAoMCA9PT0gc2Vzc2lvbnNDb3VudCkge1xuICAgICAgbG9nLmRlYnVnKCdUaGVyZSBhcmUgbm8gYWN0aXZlIHNlc3Npb25zIGZvciBjbGVhbnVwJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qge1xuICAgICAgZm9yY2UgPSBmYWxzZSxcbiAgICAgIHJlYXNvbixcbiAgICB9ID0gb3B0cztcbiAgICBsb2cuZGVidWcoYENsZWFuaW5nIHVwICR7dXRpbC5wbHVyYWxpemUoJ2FjdGl2ZSBzZXNzaW9uJywgc2Vzc2lvbnNDb3VudCwgdHJ1ZSl9YCk7XG4gICAgY29uc3QgY2xlYW51cFByb21pc2VzID0gZm9yY2VcbiAgICAgID8gXy52YWx1ZXModGhpcy5zZXNzaW9ucykubWFwKChkcnYpID0+IGRydi5zdGFydFVuZXhwZWN0ZWRTaHV0ZG93bihyZWFzb24gJiYgbmV3IEVycm9yKHJlYXNvbikpKVxuICAgICAgOiBfLmtleXModGhpcy5zZXNzaW9ucykubWFwKChpZCkgPT4gdGhpcy5kZWxldGVTZXNzaW9uKGlkKSk7XG4gICAgZm9yIChjb25zdCBjbGVhbnVwUHJvbWlzZSBvZiBjbGVhbnVwUHJvbWlzZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGNsZWFudXBQcm9taXNlO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBsb2cuZGVidWcoZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZXhlY3V0ZUNvbW1hbmQgKGNtZCwgLi4uYXJncykge1xuICAgIC8vIGdldFN0YXR1cyBjb21tYW5kIHNob3VsZCBub3QgYmUgcHV0IGludG8gcXVldWUuIElmIHdlIGRvIGl0IGFzIHBhcnQgb2Ygc3VwZXIuZXhlY3V0ZUNvbW1hbmQsIGl0IHdpbGwgYmUgYWRkZWQgdG8gcXVldWUuXG4gICAgLy8gVGhlcmUgd2lsbCBiZSBsb3Qgb2Ygc3RhdHVzIGNvbW1hbmRzIGluIHF1ZXVlIGR1cmluZyBjcmVhdGVTZXNzaW9uIGNvbW1hbmQsIGFzIGNyZWF0ZVNlc3Npb24gY2FuIHRha2UgdXAgdG8gb3IgbW9yZSB0aGFuIGEgbWludXRlLlxuICAgIGlmIChjbWQgPT09ICdnZXRTdGF0dXMnKSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5nZXRTdGF0dXMoKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBcHBpdW1Ecml2ZXJDb21tYW5kKGNtZCkpIHtcbiAgICAgIHJldHVybiBhd2FpdCBzdXBlci5leGVjdXRlQ29tbWFuZChjbWQsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIGNvbnN0IHNlc3Npb25JZCA9IF8ubGFzdChhcmdzKTtcbiAgICBjb25zdCBkc3RTZXNzaW9uID0gYXdhaXQgc2Vzc2lvbnNMaXN0R3VhcmQuYWNxdWlyZShBcHBpdW1Ecml2ZXIubmFtZSwgKCkgPT4gdGhpcy5zZXNzaW9uc1tzZXNzaW9uSWRdKTtcbiAgICBpZiAoIWRzdFNlc3Npb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlIHNlc3Npb24gd2l0aCBpZCAnJHtzZXNzaW9uSWR9JyBkb2VzIG5vdCBleGlzdGApO1xuICAgIH1cblxuICAgIGxldCByZXMgPSB7XG4gICAgICBwcm90b2NvbDogZHN0U2Vzc2lvbi5wcm90b2NvbFxuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgcmVzLnZhbHVlID0gYXdhaXQgZHN0U2Vzc2lvbi5leGVjdXRlQ29tbWFuZChjbWQsIC4uLmFyZ3MpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJlcy5lcnJvciA9IGU7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBwcm94eUFjdGl2ZSAoc2Vzc2lvbklkKSB7XG4gICAgY29uc3QgZHN0U2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnNbc2Vzc2lvbklkXTtcbiAgICByZXR1cm4gZHN0U2Vzc2lvbiAmJiBfLmlzRnVuY3Rpb24oZHN0U2Vzc2lvbi5wcm94eUFjdGl2ZSkgJiYgZHN0U2Vzc2lvbi5wcm94eUFjdGl2ZShzZXNzaW9uSWQpO1xuICB9XG5cbiAgZ2V0UHJveHlBdm9pZExpc3QgKHNlc3Npb25JZCkge1xuICAgIGNvbnN0IGRzdFNlc3Npb24gPSB0aGlzLnNlc3Npb25zW3Nlc3Npb25JZF07XG4gICAgcmV0dXJuIGRzdFNlc3Npb24gPyBkc3RTZXNzaW9uLmdldFByb3h5QXZvaWRMaXN0KCkgOiBbXTtcbiAgfVxuXG4gIGNhblByb3h5IChzZXNzaW9uSWQpIHtcbiAgICBjb25zdCBkc3RTZXNzaW9uID0gdGhpcy5zZXNzaW9uc1tzZXNzaW9uSWRdO1xuICAgIHJldHVybiBkc3RTZXNzaW9uICYmIGRzdFNlc3Npb24uY2FuUHJveHkoc2Vzc2lvbklkKTtcbiAgfVxufVxuXG4vLyBoZWxwIGRlY2lkZSB3aGljaCBjb21tYW5kcyBzaG91bGQgYmUgcHJveGllZCB0byBzdWItZHJpdmVycyBhbmQgd2hpY2hcbi8vIHNob3VsZCBiZSBoYW5kbGVkIGJ5IHRoaXMsIG91ciB1bWJyZWxsYSBkcml2ZXJcbmZ1bmN0aW9uIGlzQXBwaXVtRHJpdmVyQ29tbWFuZCAoY21kKSB7XG4gIHJldHVybiAhaXNTZXNzaW9uQ29tbWFuZChjbWQpIHx8IGNtZCA9PT0gJ2RlbGV0ZVNlc3Npb24nO1xufVxuXG5leHBvcnQgeyBBcHBpdW1Ecml2ZXIgfTtcbiJdLCJmaWxlIjoibGliL2FwcGl1bS5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLiJ9
