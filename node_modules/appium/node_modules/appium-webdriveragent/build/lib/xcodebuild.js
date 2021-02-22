"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.XcodeBuild = void 0;

require("source-map-support/register");

var _asyncbox = require("asyncbox");

var _teen_process = require("teen_process");

var _appiumSupport = require("appium-support");

var _logger = _interopRequireDefault(require("./logger"));

var _bluebird = _interopRequireDefault(require("bluebird"));

var _utils = require("./utils");

var _lodash = _interopRequireDefault(require("lodash"));

var _path = _interopRequireDefault(require("path"));

var _os = require("os");

var _constants = require("./constants");

const DEFAULT_SIGNING_ID = 'iPhone Developer';
const PREBUILD_DELAY = 0;
const RUNNER_SCHEME_IOS = 'WebDriverAgentRunner';
const LIB_SCHEME_IOS = 'WebDriverAgentLib';
const ERROR_WRITING_ATTACHMENT = 'Error writing attachment data to file';
const ERROR_COPYING_ATTACHMENT = 'Error copying testing attachment';
const IGNORED_ERRORS = [ERROR_WRITING_ATTACHMENT, ERROR_COPYING_ATTACHMENT, 'Failed to remove screenshot at path'];
const RUNNER_SCHEME_TV = 'WebDriverAgentRunner_tvOS';
const LIB_SCHEME_TV = 'WebDriverAgentLib_tvOS';

const xcodeLog = _appiumSupport.logger.getLogger('Xcode');

class XcodeBuild {
  constructor(xcodeVersion, device, args = {}) {
    this.xcodeVersion = xcodeVersion;
    this.device = device;
    this.realDevice = args.realDevice;
    this.agentPath = args.agentPath;
    this.bootstrapPath = args.bootstrapPath;
    this.platformVersion = args.platformVersion;
    this.platformName = args.platformName;
    this.iosSdkVersion = args.iosSdkVersion;
    this.showXcodeLog = args.showXcodeLog;
    this.xcodeConfigFile = args.xcodeConfigFile;
    this.xcodeOrgId = args.xcodeOrgId;
    this.xcodeSigningId = args.xcodeSigningId || DEFAULT_SIGNING_ID;
    this.keychainPath = args.keychainPath;
    this.keychainPassword = args.keychainPassword;
    this.prebuildWDA = args.prebuildWDA;
    this.usePrebuiltWDA = args.usePrebuiltWDA;
    this.useSimpleBuildTest = args.useSimpleBuildTest;
    this.useXctestrunFile = args.useXctestrunFile;
    this.launchTimeout = args.launchTimeout;
    this.wdaRemotePort = args.wdaRemotePort;
    this.updatedWDABundleId = args.updatedWDABundleId;
    this.derivedDataPath = args.derivedDataPath;
    this.mjpegServerPort = args.mjpegServerPort;
    this.prebuildDelay = _lodash.default.isNumber(args.prebuildDelay) ? args.prebuildDelay : PREBUILD_DELAY;
    this.allowProvisioningDeviceRegistration = args.allowProvisioningDeviceRegistration;
    this.resultBundlePath = args.resultBundlePath;
    this.resultBundleVersion = args.resultBundleVersion;
  }

  async init(noSessionProxy) {
    this.noSessionProxy = noSessionProxy;

    if (this.useXctestrunFile) {
      const deviveInfo = {
        isRealDevice: this.realDevice,
        udid: this.device.udid,
        platformVersion: this.platformVersion,
        platformName: this.platformName
      };
      this.xctestrunFilePath = await (0, _utils.setXctestrunFile)(deviveInfo, this.iosSdkVersion, this.bootstrapPath, this.wdaRemotePort);
      return;
    }

    if (this.realDevice) {
      await (0, _utils.resetProjectFile)(this.agentPath);

      if (this.updatedWDABundleId) {
        await (0, _utils.updateProjectFile)(this.agentPath, this.updatedWDABundleId);
      }
    }
  }

  async retrieveDerivedDataPath() {
    if (this.derivedDataPath) {
      return this.derivedDataPath;
    }

    if (this._derivedDataPathPromise) {
      return await this._derivedDataPathPromise;
    }

    this._derivedDataPathPromise = (async () => {
      let stdout;

      try {
        ({
          stdout
        } = await (0, _teen_process.exec)('xcodebuild', ['-project', this.agentPath, '-showBuildSettings']));
      } catch (err) {
        _logger.default.warn(`Cannot retrieve WDA build settings. Original error: ${err.message}`);

        return;
      }

      const pattern = /^\s*BUILD_DIR\s+=\s+(\/.*)/m;
      const match = pattern.exec(stdout);

      if (!match) {
        _logger.default.warn(`Cannot parse WDA build dir from ${_lodash.default.truncate(stdout, {
          length: 300
        })}`);

        return;
      }

      _logger.default.debug(`Parsed BUILD_DIR configuration value: '${match[1]}'`);

      this.derivedDataPath = _path.default.dirname(_path.default.dirname(_path.default.normalize(match[1])));

      _logger.default.debug(`Got derived data root: '${this.derivedDataPath}'`);

      return this.derivedDataPath;
    })();

    return await this._derivedDataPathPromise;
  }

  async reset() {
    if (this.realDevice && this.updatedWDABundleId) {
      await (0, _utils.resetProjectFile)(this.agentPath);
    }
  }

  async prebuild() {
    _logger.default.debug('Pre-building WDA before launching test');

    this.usePrebuiltWDA = true;
    await this.start(true);
    this.xcodebuild = null;
    await _bluebird.default.delay(this.prebuildDelay);
  }

  async cleanProject() {
    const tmpIsTvOS = (0, _utils.isTvOS)(this.platformName);
    const libScheme = tmpIsTvOS ? LIB_SCHEME_TV : LIB_SCHEME_IOS;
    const runnerScheme = tmpIsTvOS ? RUNNER_SCHEME_TV : RUNNER_SCHEME_IOS;

    for (const scheme of [libScheme, runnerScheme]) {
      _logger.default.debug(`Cleaning the project scheme '${scheme}' to make sure there are no leftovers from previous installs`);

      await (0, _teen_process.exec)('xcodebuild', ['clean', '-project', this.agentPath, '-scheme', scheme]);
    }
  }

  getCommand(buildOnly = false) {
    let cmd = 'xcodebuild';
    let args;
    const [buildCmd, testCmd] = this.useSimpleBuildTest ? ['build', 'test'] : ['build-for-testing', 'test-without-building'];

    if (buildOnly) {
      args = [buildCmd];
    } else if (this.usePrebuiltWDA || this.useXctestrunFile) {
      args = [testCmd];
    } else {
      args = [buildCmd, testCmd];
    }

    if (this.allowProvisioningDeviceRegistration) {
      args.push('-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration');
    }

    if (this.resultBundlePath) {
      args.push('-resultBundlePath', this.resultBundlePath);
    }

    if (this.resultBundleVersion) {
      args.push('-resultBundleVersion', this.resultBundleVersion);
    }

    if (this.useXctestrunFile) {
      args.push('-xctestrun', this.xctestrunFilePath);
    } else {
      const runnerScheme = (0, _utils.isTvOS)(this.platformName) ? RUNNER_SCHEME_TV : RUNNER_SCHEME_IOS;
      args.push('-project', this.agentPath, '-scheme', runnerScheme);

      if (this.derivedDataPath) {
        args.push('-derivedDataPath', this.derivedDataPath);
      }
    }

    args.push('-destination', `id=${this.device.udid}`);
    const versionMatch = new RegExp(/^(\d+)\.(\d+)/).exec(this.platformVersion);

    if (versionMatch) {
      args.push(`IPHONEOS_DEPLOYMENT_TARGET=${versionMatch[1]}.${versionMatch[2]}`);
    } else {
      _logger.default.warn(`Cannot parse major and minor version numbers from platformVersion "${this.platformVersion}". ` + 'Will build for the default platform instead');
    }

    if (this.realDevice && this.xcodeConfigFile) {
      _logger.default.debug(`Using Xcode configuration file: '${this.xcodeConfigFile}'`);

      args.push('-xcconfig', this.xcodeConfigFile);
    }

    if (!process.env.APPIUM_XCUITEST_TREAT_WARNINGS_AS_ERRORS) {
      args.push('GCC_TREAT_WARNINGS_AS_ERRORS=0');
    }

    args.push('COMPILER_INDEX_STORE_ENABLE=NO');
    return {
      cmd,
      args
    };
  }

  async createSubProcess(buildOnly = false) {
    if (!this.useXctestrunFile && this.realDevice) {
      if (this.keychainPath && this.keychainPassword) {
        await (0, _utils.setRealDeviceSecurity)(this.keychainPath, this.keychainPassword);
      }

      if (this.xcodeOrgId && this.xcodeSigningId && !this.xcodeConfigFile) {
        this.xcodeConfigFile = await (0, _utils.generateXcodeConfigFile)(this.xcodeOrgId, this.xcodeSigningId);
      }
    }

    const {
      cmd,
      args
    } = this.getCommand(buildOnly);

    _logger.default.debug(`Beginning ${buildOnly ? 'build' : 'test'} with command '${cmd} ${args.join(' ')}' ` + `in directory '${this.bootstrapPath}'`);

    const env = Object.assign({}, process.env, {
      USE_PORT: this.wdaRemotePort,
      WDA_PRODUCT_BUNDLE_IDENTIFIER: this.updatedWDABundleId || _constants.WDA_RUNNER_BUNDLE_ID
    });

    if (this.mjpegServerPort) {
      env.MJPEG_SERVER_PORT = this.mjpegServerPort;
    }

    const upgradeTimestamp = await (0, _utils.getWDAUpgradeTimestamp)(this.bootstrapPath);

    if (upgradeTimestamp) {
      env.UPGRADE_TIMESTAMP = upgradeTimestamp;
    }

    const xcodebuild = new _teen_process.SubProcess(cmd, args, {
      cwd: this.bootstrapPath,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let logXcodeOutput = !!this.showXcodeLog;
    const logMsg = _lodash.default.isBoolean(this.showXcodeLog) ? `Output from xcodebuild ${this.showXcodeLog ? 'will' : 'will not'} be logged` : 'Output from xcodebuild will only be logged if any errors are present there';

    _logger.default.debug(`${logMsg}. To change this, use 'showXcodeLog' desired capability`);

    xcodebuild.on('output', (stdout, stderr) => {
      let out = stdout || stderr;

      if (out.includes('Writing diagnostic log for test session to')) {
        xcodebuild.logLocation = _lodash.default.first(_lodash.default.remove(out.trim().split('\n'), v => v.startsWith(_path.default.sep)));

        _logger.default.debug(`Log file for xcodebuild test: ${xcodebuild.logLocation}`);
      }

      const ignoreError = IGNORED_ERRORS.some(x => out.includes(x));

      if (this.showXcodeLog !== false && out.includes('Error Domain=') && !ignoreError) {
        logXcodeOutput = true;
        xcodebuild._wda_error_occurred = true;
      }

      if (logXcodeOutput && !ignoreError) {
        for (const line of out.split(_os.EOL)) {
          xcodeLog.error(line);

          if (line) {
            xcodebuild._wda_error_message += `${_os.EOL}${line}`;
          }
        }
      }
    });
    return xcodebuild;
  }

  async start(buildOnly = false) {
    this.xcodebuild = await this.createSubProcess(buildOnly);
    this.xcodebuild._wda_error_message = '';
    return await new _bluebird.default((resolve, reject) => {
      this.xcodebuild.on('exit', async (code, signal) => {
        _logger.default.error(`xcodebuild exited with code '${code}' and signal '${signal}'`);

        if (this.showXcodeLog && this.xcodebuild.logLocation) {
          xcodeLog.error(`Contents of xcodebuild log file '${this.xcodebuild.logLocation}':`);

          try {
            let data = await _appiumSupport.fs.readFile(this.xcodebuild.logLocation, 'utf8');

            for (let line of data.split('\n')) {
              xcodeLog.error(line);
            }
          } catch (err) {
            _logger.default.error(`Unable to access xcodebuild log file: '${err.message}'`);
          }
        }

        this.xcodebuild.processExited = true;

        if (this.xcodebuild._wda_error_occurred || !signal && code !== 0) {
          return reject(new Error(`xcodebuild failed with code ${code}${_os.EOL}` + `xcodebuild error message:${_os.EOL}${this.xcodebuild._wda_error_message}`));
        }

        if (buildOnly) {
          return resolve();
        }
      });
      return (async () => {
        try {
          const timer = new _appiumSupport.timing.Timer().start();
          await this.xcodebuild.start(true);

          if (!buildOnly) {
            let status = await this.waitForStart(timer);
            resolve(status);
          }
        } catch (err) {
          let msg = `Unable to start WebDriverAgent: ${err}`;

          _logger.default.error(msg);

          reject(new Error(msg));
        }
      })();
    });
  }

  async waitForStart(timer) {
    _logger.default.debug(`Waiting up to ${this.launchTimeout}ms for WebDriverAgent to start`);

    let currentStatus = null;

    try {
      let retries = parseInt(this.launchTimeout / 500, 10);
      await (0, _asyncbox.retryInterval)(retries, 1000, async () => {
        if (this.xcodebuild.processExited) {
          return;
        }

        const proxyTimeout = this.noSessionProxy.timeout;
        this.noSessionProxy.timeout = 1000;

        try {
          currentStatus = await this.noSessionProxy.command('/status', 'GET');

          if (currentStatus && currentStatus.ios && currentStatus.ios.ip) {
            this.agentUrl = currentStatus.ios.ip;
          }

          _logger.default.debug(`WebDriverAgent information:`);

          _logger.default.debug(JSON.stringify(currentStatus, null, 2));
        } catch (err) {
          throw new Error(`Unable to connect to running WebDriverAgent: ${err.message}`);
        } finally {
          this.noSessionProxy.timeout = proxyTimeout;
        }
      });

      if (this.xcodebuild.processExited) {
        return currentStatus;
      }

      _logger.default.debug(`WebDriverAgent successfully started after ${timer.getDuration().asMilliSeconds.toFixed(0)}ms`);
    } catch (err) {
      _logger.default.debug(err.message);

      _logger.default.warn(`Getting status of WebDriverAgent on device timed out. Continuing`);
    }

    return currentStatus;
  }

  async quit() {
    await (0, _utils.killProcess)('xcodebuild', this.xcodebuild);
  }

}

exports.XcodeBuild = XcodeBuild;
var _default = XcodeBuild;
exports.default = _default;require('source-map-support').install();


//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxpYi94Y29kZWJ1aWxkLmpzIl0sIm5hbWVzIjpbIkRFRkFVTFRfU0lHTklOR19JRCIsIlBSRUJVSUxEX0RFTEFZIiwiUlVOTkVSX1NDSEVNRV9JT1MiLCJMSUJfU0NIRU1FX0lPUyIsIkVSUk9SX1dSSVRJTkdfQVRUQUNITUVOVCIsIkVSUk9SX0NPUFlJTkdfQVRUQUNITUVOVCIsIklHTk9SRURfRVJST1JTIiwiUlVOTkVSX1NDSEVNRV9UViIsIkxJQl9TQ0hFTUVfVFYiLCJ4Y29kZUxvZyIsImxvZ2dlciIsImdldExvZ2dlciIsIlhjb2RlQnVpbGQiLCJjb25zdHJ1Y3RvciIsInhjb2RlVmVyc2lvbiIsImRldmljZSIsImFyZ3MiLCJyZWFsRGV2aWNlIiwiYWdlbnRQYXRoIiwiYm9vdHN0cmFwUGF0aCIsInBsYXRmb3JtVmVyc2lvbiIsInBsYXRmb3JtTmFtZSIsImlvc1Nka1ZlcnNpb24iLCJzaG93WGNvZGVMb2ciLCJ4Y29kZUNvbmZpZ0ZpbGUiLCJ4Y29kZU9yZ0lkIiwieGNvZGVTaWduaW5nSWQiLCJrZXljaGFpblBhdGgiLCJrZXljaGFpblBhc3N3b3JkIiwicHJlYnVpbGRXREEiLCJ1c2VQcmVidWlsdFdEQSIsInVzZVNpbXBsZUJ1aWxkVGVzdCIsInVzZVhjdGVzdHJ1bkZpbGUiLCJsYXVuY2hUaW1lb3V0Iiwid2RhUmVtb3RlUG9ydCIsInVwZGF0ZWRXREFCdW5kbGVJZCIsImRlcml2ZWREYXRhUGF0aCIsIm1qcGVnU2VydmVyUG9ydCIsInByZWJ1aWxkRGVsYXkiLCJfIiwiaXNOdW1iZXIiLCJhbGxvd1Byb3Zpc2lvbmluZ0RldmljZVJlZ2lzdHJhdGlvbiIsInJlc3VsdEJ1bmRsZVBhdGgiLCJyZXN1bHRCdW5kbGVWZXJzaW9uIiwiaW5pdCIsIm5vU2Vzc2lvblByb3h5IiwiZGV2aXZlSW5mbyIsImlzUmVhbERldmljZSIsInVkaWQiLCJ4Y3Rlc3RydW5GaWxlUGF0aCIsInJldHJpZXZlRGVyaXZlZERhdGFQYXRoIiwiX2Rlcml2ZWREYXRhUGF0aFByb21pc2UiLCJzdGRvdXQiLCJlcnIiLCJsb2ciLCJ3YXJuIiwibWVzc2FnZSIsInBhdHRlcm4iLCJtYXRjaCIsImV4ZWMiLCJ0cnVuY2F0ZSIsImxlbmd0aCIsImRlYnVnIiwicGF0aCIsImRpcm5hbWUiLCJub3JtYWxpemUiLCJyZXNldCIsInByZWJ1aWxkIiwic3RhcnQiLCJ4Y29kZWJ1aWxkIiwiQiIsImRlbGF5IiwiY2xlYW5Qcm9qZWN0IiwidG1wSXNUdk9TIiwibGliU2NoZW1lIiwicnVubmVyU2NoZW1lIiwic2NoZW1lIiwiZ2V0Q29tbWFuZCIsImJ1aWxkT25seSIsImNtZCIsImJ1aWxkQ21kIiwidGVzdENtZCIsInB1c2giLCJ2ZXJzaW9uTWF0Y2giLCJSZWdFeHAiLCJwcm9jZXNzIiwiZW52IiwiQVBQSVVNX1hDVUlURVNUX1RSRUFUX1dBUk5JTkdTX0FTX0VSUk9SUyIsImNyZWF0ZVN1YlByb2Nlc3MiLCJqb2luIiwiT2JqZWN0IiwiYXNzaWduIiwiVVNFX1BPUlQiLCJXREFfUFJPRFVDVF9CVU5ETEVfSURFTlRJRklFUiIsIldEQV9SVU5ORVJfQlVORExFX0lEIiwiTUpQRUdfU0VSVkVSX1BPUlQiLCJ1cGdyYWRlVGltZXN0YW1wIiwiVVBHUkFERV9USU1FU1RBTVAiLCJTdWJQcm9jZXNzIiwiY3dkIiwiZGV0YWNoZWQiLCJzdGRpbyIsImxvZ1hjb2RlT3V0cHV0IiwibG9nTXNnIiwiaXNCb29sZWFuIiwib24iLCJzdGRlcnIiLCJvdXQiLCJpbmNsdWRlcyIsImxvZ0xvY2F0aW9uIiwiZmlyc3QiLCJyZW1vdmUiLCJ0cmltIiwic3BsaXQiLCJ2Iiwic3RhcnRzV2l0aCIsInNlcCIsImlnbm9yZUVycm9yIiwic29tZSIsIngiLCJfd2RhX2Vycm9yX29jY3VycmVkIiwibGluZSIsIkVPTCIsImVycm9yIiwiX3dkYV9lcnJvcl9tZXNzYWdlIiwicmVzb2x2ZSIsInJlamVjdCIsImNvZGUiLCJzaWduYWwiLCJkYXRhIiwiZnMiLCJyZWFkRmlsZSIsInByb2Nlc3NFeGl0ZWQiLCJFcnJvciIsInRpbWVyIiwidGltaW5nIiwiVGltZXIiLCJzdGF0dXMiLCJ3YWl0Rm9yU3RhcnQiLCJtc2ciLCJjdXJyZW50U3RhdHVzIiwicmV0cmllcyIsInBhcnNlSW50IiwicHJveHlUaW1lb3V0IiwidGltZW91dCIsImNvbW1hbmQiLCJpb3MiLCJpcCIsImFnZW50VXJsIiwiSlNPTiIsInN0cmluZ2lmeSIsImdldER1cmF0aW9uIiwiYXNNaWxsaVNlY29uZHMiLCJ0b0ZpeGVkIiwicXVpdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFJQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFHQSxNQUFNQSxrQkFBa0IsR0FBRyxrQkFBM0I7QUFDQSxNQUFNQyxjQUFjLEdBQUcsQ0FBdkI7QUFDQSxNQUFNQyxpQkFBaUIsR0FBRyxzQkFBMUI7QUFDQSxNQUFNQyxjQUFjLEdBQUcsbUJBQXZCO0FBRUEsTUFBTUMsd0JBQXdCLEdBQUcsdUNBQWpDO0FBQ0EsTUFBTUMsd0JBQXdCLEdBQUcsa0NBQWpDO0FBQ0EsTUFBTUMsY0FBYyxHQUFHLENBQ3JCRix3QkFEcUIsRUFFckJDLHdCQUZxQixFQUdyQixxQ0FIcUIsQ0FBdkI7QUFNQSxNQUFNRSxnQkFBZ0IsR0FBRywyQkFBekI7QUFDQSxNQUFNQyxhQUFhLEdBQUcsd0JBQXRCOztBQUVBLE1BQU1DLFFBQVEsR0FBR0Msc0JBQU9DLFNBQVAsQ0FBaUIsT0FBakIsQ0FBakI7O0FBR0EsTUFBTUMsVUFBTixDQUFpQjtBQUNmQyxFQUFBQSxXQUFXLENBQUVDLFlBQUYsRUFBZ0JDLE1BQWhCLEVBQXdCQyxJQUFJLEdBQUcsRUFBL0IsRUFBbUM7QUFDNUMsU0FBS0YsWUFBTCxHQUFvQkEsWUFBcEI7QUFFQSxTQUFLQyxNQUFMLEdBQWNBLE1BQWQ7QUFFQSxTQUFLRSxVQUFMLEdBQWtCRCxJQUFJLENBQUNDLFVBQXZCO0FBRUEsU0FBS0MsU0FBTCxHQUFpQkYsSUFBSSxDQUFDRSxTQUF0QjtBQUNBLFNBQUtD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QUE4QkQsWUFBOUI7QUFDRDtBQUNGLE9BbkJLLENBQU47O0FBcUJBLFVBQUksS0FBSzFFLFVBQUwsQ0FBZ0IrRCxhQUFwQixFQUFtQztBQUVqQyxlQUFPUSxhQUFQO0FBQ0Q7O0FBRUR0RixzQkFBSVEsS0FBSixDQUFXLDZDQUE0Q3dFLEtBQUssQ0FBQ2lCLFdBQU4sR0FBb0JDLGNBQXBCLENBQW1DQyxPQUFuQyxDQUEyQyxDQUEzQyxDQUE4QyxJQUFyRztBQUNELEtBN0JELENBNkJFLE9BQU9wRyxHQUFQLEVBQVk7QUFHWkMsc0JBQUlRLEtBQUosQ0FBVVQsR0FBRyxDQUFDRyxPQUFkOztBQUNBRixzQkFBSUMsSUFBSixDQUFVLGtFQUFWO0FBQ0Q7O0FBQ0QsV0FBT3FGLGFBQVA7QUFDRDs7QUFFRCxRQUFNYyxJQUFOLEdBQWM7QUFDWixVQUFNLHdCQUFZLFlBQVosRUFBMEIsS0FBS3JGLFVBQS9CLENBQU47QUFDRDs7QUFwWGM7OztlQXdYRnpELFUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZXRyeUludGVydmFsIH0gZnJvbSAnYXN5bmNib3gnO1xuaW1wb3J0IHsgU3ViUHJvY2VzcywgZXhlYyB9IGZyb20gJ3RlZW5fcHJvY2Vzcyc7XG5pbXBvcnQgeyBmcywgbG9nZ2VyLCB0aW1pbmcgfSBmcm9tICdhcHBpdW0tc3VwcG9ydCc7XG5pbXBvcnQgbG9nIGZyb20gJy4vbG9nZ2VyJztcbmltcG9ydCBCIGZyb20gJ2JsdWViaXJkJztcbmltcG9ydCB7XG4gIHNldFJlYWxEZXZpY2VTZWN1cml0eSwgZ2VuZXJhdGVYY29kZUNvbmZpZ0ZpbGUsIHNldFhjdGVzdHJ1bkZpbGUsXG4gIHVwZGF0ZVByb2plY3RGaWxlLCByZXNldFByb2plY3RGaWxlLCBraWxsUHJvY2VzcyxcbiAgZ2V0V0RBVXBncmFkZVRpbWVzdGFtcCwgaXNUdk9TIH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBFT0wgfSBmcm9tICdvcyc7XG5pbXBvcnQgeyBXREFfUlVOTkVSX0JVTkRMRV9JRCB9IGZyb20gJy4vY29uc3RhbnRzJztcblxuXG5jb25zdCBERUZBVUxUX1NJR05JTkdfSUQgPSAnaVBob25lIERldmVsb3Blcic7XG5jb25zdCBQUkVCVUlMRF9ERUxBWSA9IDA7XG5jb25zdCBSVU5ORVJfU0NIRU1FX0lPUyA9ICdXZWJEcml2ZXJBZ2VudFJ1bm5lcic7XG5jb25zdCBMSUJfU0NIRU1FX0lPUyA9ICdXZWJEcml2ZXJBZ2VudExpYic7XG5cbmNvbnN0IEVSUk9SX1dSSVRJTkdfQVRUQUNITUVOVCA9ICdFcnJvciB3cml0aW5nIGF0dGFjaG1lbnQgZGF0YSB0byBmaWxlJztcbmNvbnN0IEVSUk9SX0NPUFlJTkdfQVRUQUNITUVOVCA9ICdFcnJvciBjb3B5aW5nIHRlc3RpbmcgYXR0YWNobWVudCc7XG5jb25zdCBJR05PUkVEX0VSUk9SUyA9IFtcbiAgRVJST1JfV1JJVElOR19BVFRBQ0hNRU5ULFxuICBFUlJPUl9DT1BZSU5HX0FUVEFDSE1FTlQsXG4gICdGYWlsZWQgdG8gcmVtb3ZlIHNjcmVlbnNob3QgYXQgcGF0aCcsXG5dO1xuXG5jb25zdCBSVU5ORVJfU0NIRU1FX1RWID0gJ1dlYkRyaXZlckFnZW50UnVubmVyX3R2T1MnO1xuY29uc3QgTElCX1NDSEVNRV9UViA9ICdXZWJEcml2ZXJBZ2VudExpYl90dk9TJztcblxuY29uc3QgeGNvZGVMb2cgPSBsb2dnZXIuZ2V0TG9nZ2VyKCdYY29kZScpO1xuXG5cbmNsYXNzIFhjb2RlQnVpbGQge1xuICBjb25zdHJ1Y3RvciAoeGNvZGVWZXJzaW9uLCBkZXZpY2UsIGFyZ3MgPSB7fSkge1xuICAgIHRoaXMueGNvZGVWZXJzaW9uID0geGNvZGVWZXJzaW9uO1xuXG4gICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XG5cbiAgICB0aGlzLnJlYWxEZXZpY2UgPSBhcmdzLnJlYWxEZXZpY2U7XG5cbiAgICB0aGlzLmFnZW50UGF0aCA9IGFyZ3MuYWdlbnRQYXRoO1xuICAgIHRoaXMuYm9vdHN0cmFwUGF0aCA9IGFyZ3MuYm9vdHN0cmFwUGF0aDtcblxuICAgIHRoaXMucGxhdGZvcm1WZXJzaW9uID0gYXJncy5wbGF0Zm9ybVZlcnNpb247XG4gICAgdGhpcy5wbGF0Zm9ybU5hbWUgPSBhcmdzLnBsYXRmb3JtTmFtZTtcbiAgICB0aGlzLmlvc1Nka1ZlcnNpb24gPSBhcmdzLmlvc1Nka1ZlcnNpb247XG5cbiAgICB0aGlzLnNob3dYY29kZUxvZyA9IGFyZ3Muc2hvd1hjb2RlTG9nO1xuXG4gICAgdGhpcy54Y29kZUNvbmZpZ0ZpbGUgPSBhcmdzLnhjb2RlQ29uZmlnRmlsZTtcbiAgICB0aGlzLnhjb2RlT3JnSWQgPSBhcmdzLnhjb2RlT3JnSWQ7XG4gICAgdGhpcy54Y29kZVNpZ25pbmdJZCA9IGFyZ3MueGNvZGVTaWduaW5nSWQgfHwgREVGQVVMVF9TSUdOSU5HX0lEO1xuICAgIHRoaXMua2V5Y2hhaW5QYXRoID0gYXJncy5rZXljaGFpblBhdGg7XG4gICAgdGhpcy5rZXljaGFpblBhc3N3b3JkID0gYXJncy5rZXljaGFpblBhc3N3b3JkO1xuXG4gICAgdGhpcy5wcmVidWlsZFdEQSA9IGFyZ3MucHJlYnVpbGRXREE7XG4gICAgdGhpcy51c2VQcmVidWlsdFdEQSA9IGFyZ3MudXNlUHJlYnVpbHRXREE7XG4gICAgdGhpcy51c2VTaW1wbGVCdWlsZFRlc3QgPSBhcmdzLnVzZVNpbXBsZUJ1aWxkVGVzdDtcblxuICAgIHRoaXMudXNlWGN0ZXN0cnVuRmlsZSA9IGFyZ3MudXNlWGN0ZXN0cnVuRmlsZTtcblxuICAgIHRoaXMubGF1bmNoVGltZW91dCA9IGFyZ3MubGF1bmNoVGltZW91dDtcblxuICAgIHRoaXMud2RhUmVtb3RlUG9ydCA9IGFyZ3Mud2RhUmVtb3RlUG9ydDtcblxuICAgIHRoaXMudXBkYXRlZFdEQUJ1bmRsZUlkID0gYXJncy51cGRhdGVkV0RBQnVuZGxlSWQ7XG4gICAgdGhpcy5kZXJpdmVkRGF0YVBhdGggPSBhcmdzLmRlcml2ZWREYXRhUGF0aDtcblxuICAgIHRoaXMubWpwZWdTZXJ2ZXJQb3J0ID0gYXJncy5tanBlZ1NlcnZlclBvcnQ7XG5cbiAgICB0aGlzLnByZWJ1aWxkRGVsYXkgPSBfLmlzTnVtYmVyKGFyZ3MucHJlYnVpbGREZWxheSkgPyBhcmdzLnByZWJ1aWxkRGVsYXkgOiBQUkVCVUlMRF9ERUxBWTtcblxuICAgIHRoaXMuYWxsb3dQcm92aXNpb25pbmdEZXZpY2VSZWdpc3RyYXRpb24gPSBhcmdzLmFsbG93UHJvdmlzaW9uaW5nRGV2aWNlUmVnaXN0cmF0aW9uO1xuXG4gICAgdGhpcy5yZXN1bHRCdW5kbGVQYXRoID0gYXJncy5yZXN1bHRCdW5kbGVQYXRoO1xuICAgIHRoaXMucmVzdWx0QnVuZGxlVmVyc2lvbiA9IGFyZ3MucmVzdWx0QnVuZGxlVmVyc2lvbjtcbiAgfVxuXG4gIGFzeW5jIGluaXQgKG5vU2Vzc2lvblByb3h5KSB7XG4gICAgdGhpcy5ub1Nlc3Npb25Qcm94eSA9IG5vU2Vzc2lvblByb3h5O1xuXG4gICAgaWYgKHRoaXMudXNlWGN0ZXN0cnVuRmlsZSkge1xuICAgICAgY29uc3QgZGV2aXZlSW5mbyA9IHtcbiAgICAgICAgaXNSZWFsRGV2aWNlOiB0aGlzLnJlYWxEZXZpY2UsXG4gICAgICAgIHVkaWQ6IHRoaXMuZGV2aWNlLnVkaWQsXG4gICAgICAgIHBsYXRmb3JtVmVyc2lvbjogdGhpcy5wbGF0Zm9ybVZlcnNpb24sXG4gICAgICAgIHBsYXRmb3JtTmFtZTogdGhpcy5wbGF0Zm9ybU5hbWVcbiAgICAgIH07XG4gICAgICB0aGlzLnhjdGVzdHJ1bkZpbGVQYXRoID0gYXdhaXQgc2V0WGN0ZXN0cnVuRmlsZShkZXZpdmVJbmZvLCB0aGlzLmlvc1Nka1ZlcnNpb24sIHRoaXMuYm9vdHN0cmFwUGF0aCwgdGhpcy53ZGFSZW1vdGVQb3J0KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBpZiBuZWNlc3NhcnksIHVwZGF0ZSB0aGUgYnVuZGxlSWQgdG8gdXNlcidzIHNwZWNpZmljYXRpb25cbiAgICBpZiAodGhpcy5yZWFsRGV2aWNlKSB7XG4gICAgICAvLyBJbiBjYXNlIHRoZSBwcm9qZWN0IHN0aWxsIGhhcyB0aGUgdXNlciBzcGVjaWZpYyBidW5kbGUgSUQsIHJlc2V0IHRoZSBwcm9qZWN0IGZpbGUgZmlyc3QuXG4gICAgICAvLyAtIFdlIGRvIHRoaXMgcmVzZXQgZXZlbiBpZiB1cGRhdGVkV0RBQnVuZGxlSWQgaXMgbm90IHNwZWNpZmllZCxcbiAgICAgIC8vICAgc2luY2UgdGhlIHByZXZpb3VzIHVwZGF0ZWRXREFCdW5kbGVJZCB0ZXN0IGhhcyBnZW5lcmF0ZWQgdGhlIHVzZXIgc3BlY2lmaWMgYnVuZGxlIElEIHByb2plY3QgZmlsZS5cbiAgICAgIC8vIC0gV2UgZG9uJ3QgY2FsbCByZXNldFByb2plY3RGaWxlIGZvciBzaW11bGF0b3IsXG4gICAgICAvLyAgIHNpbmNlIHNpbXVsYXRvciB0ZXN0IHJ1biB3aWxsIHdvcmsgd2l0aCBhbnkgdXNlciBzcGVjaWZpYyBidW5kbGUgSUQuXG4gICAgICBhd2FpdCByZXNldFByb2plY3RGaWxlKHRoaXMuYWdlbnRQYXRoKTtcbiAgICAgIGlmICh0aGlzLnVwZGF0ZWRXREFCdW5kbGVJZCkge1xuICAgICAgICBhd2FpdCB1cGRhdGVQcm9qZWN0RmlsZSh0aGlzLmFnZW50UGF0aCwgdGhpcy51cGRhdGVkV0RBQnVuZGxlSWQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHJldHJpZXZlRGVyaXZlZERhdGFQYXRoICgpIHtcbiAgICBpZiAodGhpcy5kZXJpdmVkRGF0YVBhdGgpIHtcbiAgICAgIHJldHVybiB0aGlzLmRlcml2ZWREYXRhUGF0aDtcbiAgICB9XG5cbiAgICAvLyBhdm9pZCByYWNlIGNvbmRpdGlvbnNcbiAgICBpZiAodGhpcy5fZGVyaXZlZERhdGFQYXRoUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuX2Rlcml2ZWREYXRhUGF0aFByb21pc2U7XG4gICAgfVxuXG4gICAgdGhpcy5fZGVyaXZlZERhdGFQYXRoUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG4gICAgICBsZXQgc3Rkb3V0O1xuICAgICAgdHJ5IHtcbiAgICAgICAgKHtzdGRvdXR9ID0gYXdhaXQgZXhlYygneGNvZGVidWlsZCcsIFsnLXByb2plY3QnLCB0aGlzLmFnZW50UGF0aCwgJy1zaG93QnVpbGRTZXR0aW5ncyddKSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLndhcm4oYENhbm5vdCByZXRyaWV2ZSBXREEgYnVpbGQgc2V0dGluZ3MuIE9yaWdpbmFsIGVycm9yOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBhdHRlcm4gPSAvXlxccypCVUlMRF9ESVJcXHMrPVxccysoXFwvLiopL207XG4gICAgICBjb25zdCBtYXRjaCA9IHBhdHRlcm4uZXhlYyhzdGRvdXQpO1xuICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICBsb2cud2FybihgQ2Fubm90IHBhcnNlIFdEQSBidWlsZCBkaXIgZnJvbSAke18udHJ1bmNhdGUoc3Rkb3V0LCB7bGVuZ3RoOiAzMDB9KX1gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgbG9nLmRlYnVnKGBQYXJzZWQgQlVJTERfRElSIGNvbmZpZ3VyYXRpb24gdmFsdWU6ICcke21hdGNoWzFdfSdgKTtcbiAgICAgIC8vIERlcml2ZWQgZGF0YSByb290IGlzIHR3byBsZXZlbHMgaGlnaGVyIG92ZXIgdGhlIGJ1aWxkIGRpclxuICAgICAgdGhpcy5kZXJpdmVkRGF0YVBhdGggPSBwYXRoLmRpcm5hbWUocGF0aC5kaXJuYW1lKHBhdGgubm9ybWFsaXplKG1hdGNoWzFdKSkpO1xuICAgICAgbG9nLmRlYnVnKGBHb3QgZGVyaXZlZCBkYXRhIHJvb3Q6ICcke3RoaXMuZGVyaXZlZERhdGFQYXRofSdgKTtcbiAgICAgIHJldHVybiB0aGlzLmRlcml2ZWREYXRhUGF0aDtcbiAgICB9KSgpO1xuICAgIHJldHVybiBhd2FpdCB0aGlzLl9kZXJpdmVkRGF0YVBhdGhQcm9taXNlO1xuICB9XG5cbiAgYXN5bmMgcmVzZXQgKCkge1xuICAgIC8vIGlmIG5lY2Vzc2FyeSwgcmVzZXQgdGhlIGJ1bmRsZUlkIHRvIG9yaWdpbmFsIHZhbHVlXG4gICAgaWYgKHRoaXMucmVhbERldmljZSAmJiB0aGlzLnVwZGF0ZWRXREFCdW5kbGVJZCkge1xuICAgICAgYXdhaXQgcmVzZXRQcm9qZWN0RmlsZSh0aGlzLmFnZW50UGF0aCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcHJlYnVpbGQgKCkge1xuICAgIC8vIGZpcnN0IGRvIGEgYnVpbGQgcGhhc2VcbiAgICBsb2cuZGVidWcoJ1ByZS1idWlsZGluZyBXREEgYmVmb3JlIGxhdW5jaGluZyB0ZXN0Jyk7XG4gICAgdGhpcy51c2VQcmVidWlsdFdEQSA9IHRydWU7XG4gICAgYXdhaXQgdGhpcy5zdGFydCh0cnVlKTtcblxuICAgIHRoaXMueGNvZGVidWlsZCA9IG51bGw7XG5cbiAgICAvLyBwYXVzZSBhIG1vbWVudFxuICAgIGF3YWl0IEIuZGVsYXkodGhpcy5wcmVidWlsZERlbGF5KTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFuUHJvamVjdCAoKSB7XG4gICAgY29uc3QgdG1wSXNUdk9TID0gaXNUdk9TKHRoaXMucGxhdGZvcm1OYW1lKTtcbiAgICBjb25zdCBsaWJTY2hlbWUgPSB0bXBJc1R2T1MgPyBMSUJfU0NIRU1FX1RWIDogTElCX1NDSEVNRV9JT1M7XG4gICAgY29uc3QgcnVubmVyU2NoZW1lID0gdG1wSXNUdk9TID8gUlVOTkVSX1NDSEVNRV9UViA6IFJVTk5FUl9TQ0hFTUVfSU9TO1xuXG4gICAgZm9yIChjb25zdCBzY2hlbWUgb2YgW2xpYlNjaGVtZSwgcnVubmVyU2NoZW1lXSkge1xuICAgICAgbG9nLmRlYnVnKGBDbGVhbmluZyB0aGUgcHJvamVjdCBzY2hlbWUgJyR7c2NoZW1lfScgdG8gbWFrZSBzdXJlIHRoZXJlIGFyZSBubyBsZWZ0b3ZlcnMgZnJvbSBwcmV2aW91cyBpbnN0YWxsc2ApO1xuICAgICAgYXdhaXQgZXhlYygneGNvZGVidWlsZCcsIFtcbiAgICAgICAgJ2NsZWFuJyxcbiAgICAgICAgJy1wcm9qZWN0JywgdGhpcy5hZ2VudFBhdGgsXG4gICAgICAgICctc2NoZW1lJywgc2NoZW1lLFxuICAgICAgXSk7XG4gICAgfVxuICB9XG5cbiAgZ2V0Q29tbWFuZCAoYnVpbGRPbmx5ID0gZmFsc2UpIHtcbiAgICBsZXQgY21kID0gJ3hjb2RlYnVpbGQnO1xuICAgIGxldCBhcmdzO1xuXG4gICAgLy8gZmlndXJlIG91dCB0aGUgdGFyZ2V0cyBmb3IgeGNvZGVidWlsZFxuICAgIGNvbnN0IFtidWlsZENtZCwgdGVzdENtZF0gPSB0aGlzLnVzZVNpbXBsZUJ1aWxkVGVzdCA/IFsnYnVpbGQnLCAndGVzdCddIDogWydidWlsZC1mb3ItdGVzdGluZycsICd0ZXN0LXdpdGhvdXQtYnVpbGRpbmcnXTtcbiAgICBpZiAoYnVpbGRPbmx5KSB7XG4gICAgICBhcmdzID0gW2J1aWxkQ21kXTtcbiAgICB9IGVsc2UgaWYgKHRoaXMudXNlUHJlYnVpbHRXREEgfHwgdGhpcy51c2VYY3Rlc3RydW5GaWxlKSB7XG4gICAgICBhcmdzID0gW3Rlc3RDbWRdO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzID0gW2J1aWxkQ21kLCB0ZXN0Q21kXTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5hbGxvd1Byb3Zpc2lvbmluZ0RldmljZVJlZ2lzdHJhdGlvbikge1xuICAgICAgLy8gVG8gLWFsbG93UHJvdmlzaW9uaW5nRGV2aWNlUmVnaXN0cmF0aW9uIGZsYWcgdGFrZXMgZWZmZWN0LCAtYWxsb3dQcm92aXNpb25pbmdVcGRhdGVzIG5lZWRzIHRvIGJlIHBhc3NlZCBhcyB3ZWxsLlxuICAgICAgYXJncy5wdXNoKCctYWxsb3dQcm92aXNpb25pbmdVcGRhdGVzJywgJy1hbGxvd1Byb3Zpc2lvbmluZ0RldmljZVJlZ2lzdHJhdGlvbicpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnJlc3VsdEJ1bmRsZVBhdGgpIHtcbiAgICAgIGFyZ3MucHVzaCgnLXJlc3VsdEJ1bmRsZVBhdGgnLCB0aGlzLnJlc3VsdEJ1bmRsZVBhdGgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnJlc3VsdEJ1bmRsZVZlcnNpb24pIHtcbiAgICAgIGFyZ3MucHVzaCgnLXJlc3VsdEJ1bmRsZVZlcnNpb24nLCB0aGlzLnJlc3VsdEJ1bmRsZVZlcnNpb24pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnVzZVhjdGVzdHJ1bkZpbGUpIHtcbiAgICAgIGFyZ3MucHVzaCgnLXhjdGVzdHJ1bicsIHRoaXMueGN0ZXN0cnVuRmlsZVBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBydW5uZXJTY2hlbWUgPSBpc1R2T1ModGhpcy5wbGF0Zm9ybU5hbWUpID8gUlVOTkVSX1NDSEVNRV9UViA6IFJVTk5FUl9TQ0hFTUVfSU9TO1xuICAgICAgYXJncy5wdXNoKCctcHJvamVjdCcsIHRoaXMuYWdlbnRQYXRoLCAnLXNjaGVtZScsIHJ1bm5lclNjaGVtZSk7XG4gICAgICBpZiAodGhpcy5kZXJpdmVkRGF0YVBhdGgpIHtcbiAgICAgICAgYXJncy5wdXNoKCctZGVyaXZlZERhdGFQYXRoJywgdGhpcy5kZXJpdmVkRGF0YVBhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgICBhcmdzLnB1c2goJy1kZXN0aW5hdGlvbicsIGBpZD0ke3RoaXMuZGV2aWNlLnVkaWR9YCk7XG5cbiAgICBjb25zdCB2ZXJzaW9uTWF0Y2ggPSBuZXcgUmVnRXhwKC9eKFxcZCspXFwuKFxcZCspLykuZXhlYyh0aGlzLnBsYXRmb3JtVmVyc2lvbik7XG4gICAgaWYgKHZlcnNpb25NYXRjaCkge1xuICAgICAgYXJncy5wdXNoKGBJUEhPTkVPU19ERVBMT1lNRU5UX1RBUkdFVD0ke3ZlcnNpb25NYXRjaFsxXX0uJHt2ZXJzaW9uTWF0Y2hbMl19YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZy53YXJuKGBDYW5ub3QgcGFyc2UgbWFqb3IgYW5kIG1pbm9yIHZlcnNpb24gbnVtYmVycyBmcm9tIHBsYXRmb3JtVmVyc2lvbiBcIiR7dGhpcy5wbGF0Zm9ybVZlcnNpb259XCIuIGAgK1xuICAgICAgICAnV2lsbCBidWlsZCBmb3IgdGhlIGRlZmF1bHQgcGxhdGZvcm0gaW5zdGVhZCcpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnJlYWxEZXZpY2UgJiYgdGhpcy54Y29kZUNvbmZpZ0ZpbGUpIHtcbiAgICAgIGxvZy5kZWJ1ZyhgVXNpbmcgWGNvZGUgY29uZmlndXJhdGlvbiBmaWxlOiAnJHt0aGlzLnhjb2RlQ29uZmlnRmlsZX0nYCk7XG4gICAgICBhcmdzLnB1c2goJy14Y2NvbmZpZycsIHRoaXMueGNvZGVDb25maWdGaWxlKTtcbiAgICB9XG5cbiAgICBpZiAoIXByb2Nlc3MuZW52LkFQUElVTV9YQ1VJVEVTVF9UUkVBVF9XQVJOSU5HU19BU19FUlJPUlMpIHtcbiAgICAgIC8vIFRoaXMgc29tZXRpbWVzIGhlbHBzIHRvIHN1cnZpdmUgWGNvZGUgdXBkYXRlc1xuICAgICAgYXJncy5wdXNoKCdHQ0NfVFJFQVRfV0FSTklOR1NfQVNfRVJST1JTPTAnKTtcbiAgICB9XG5cbiAgICAvLyBCZWxvdyBvcHRpb24gc2xpZ2h0bHkgcmVkdWNlcyBidWlsZCB0aW1lIGluIGRlYnVnIGJ1aWxkXG4gICAgLy8gd2l0aCBwcmV2ZW50aW5nIHRvIGdlbmVyYXRlIGAvSW5kZXgvRGF0YVN0b3JlYCB3aGljaCBpcyB1c2VkIGJ5IGRldmVsb3BtZW50XG4gICAgYXJncy5wdXNoKCdDT01QSUxFUl9JTkRFWF9TVE9SRV9FTkFCTEU9Tk8nKTtcblxuICAgIHJldHVybiB7Y21kLCBhcmdzfTtcbiAgfVxuXG4gIGFzeW5jIGNyZWF0ZVN1YlByb2Nlc3MgKGJ1aWxkT25seSA9IGZhbHNlKSB7XG4gICAgaWYgKCF0aGlzLnVzZVhjdGVzdHJ1bkZpbGUgJiYgdGhpcy5yZWFsRGV2aWNlKSB7XG4gICAgICBpZiAodGhpcy5rZXljaGFpblBhdGggJiYgdGhpcy5rZXljaGFpblBhc3N3b3JkKSB7XG4gICAgICAgIGF3YWl0IHNldFJlYWxEZXZpY2VTZWN1cml0eSh0aGlzLmtleWNoYWluUGF0aCwgdGhpcy5rZXljaGFpblBhc3N3b3JkKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnhjb2RlT3JnSWQgJiYgdGhpcy54Y29kZVNpZ25pbmdJZCAmJiAhdGhpcy54Y29kZUNvbmZpZ0ZpbGUpIHtcbiAgICAgICAgdGhpcy54Y29kZUNvbmZpZ0ZpbGUgPSBhd2FpdCBnZW5lcmF0ZVhjb2RlQ29uZmlnRmlsZSh0aGlzLnhjb2RlT3JnSWQsIHRoaXMueGNvZGVTaWduaW5nSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHtjbWQsIGFyZ3N9ID0gdGhpcy5nZXRDb21tYW5kKGJ1aWxkT25seSk7XG4gICAgbG9nLmRlYnVnKGBCZWdpbm5pbmcgJHtidWlsZE9ubHkgPyAnYnVpbGQnIDogJ3Rlc3QnfSB3aXRoIGNvbW1hbmQgJyR7Y21kfSAke2FyZ3Muam9pbignICcpfScgYCArXG4gICAgICAgICAgICAgIGBpbiBkaXJlY3RvcnkgJyR7dGhpcy5ib290c3RyYXBQYXRofSdgKTtcbiAgICBjb25zdCBlbnYgPSBPYmplY3QuYXNzaWduKHt9LCBwcm9jZXNzLmVudiwge1xuICAgICAgVVNFX1BPUlQ6IHRoaXMud2RhUmVtb3RlUG9ydCxcbiAgICAgIFdEQV9QUk9EVUNUX0JVTkRMRV9JREVOVElGSUVSOiB0aGlzLnVwZGF0ZWRXREFCdW5kbGVJZCB8fCBXREFfUlVOTkVSX0JVTkRMRV9JRCxcbiAgICB9KTtcbiAgICBpZiAodGhpcy5tanBlZ1NlcnZlclBvcnQpIHtcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hcHBpdW0vV2ViRHJpdmVyQWdlbnQvcHVsbC8xMDVcbiAgICAgIGVudi5NSlBFR19TRVJWRVJfUE9SVCA9IHRoaXMubWpwZWdTZXJ2ZXJQb3J0O1xuICAgIH1cbiAgICBjb25zdCB1cGdyYWRlVGltZXN0YW1wID0gYXdhaXQgZ2V0V0RBVXBncmFkZVRpbWVzdGFtcCh0aGlzLmJvb3RzdHJhcFBhdGgpO1xuICAgIGlmICh1cGdyYWRlVGltZXN0YW1wKSB7XG4gICAgICBlbnYuVVBHUkFERV9USU1FU1RBTVAgPSB1cGdyYWRlVGltZXN0YW1wO1xuICAgIH1cbiAgICBjb25zdCB4Y29kZWJ1aWxkID0gbmV3IFN1YlByb2Nlc3MoY21kLCBhcmdzLCB7XG4gICAgICBjd2Q6IHRoaXMuYm9vdHN0cmFwUGF0aCxcbiAgICAgIGVudixcbiAgICAgIGRldGFjaGVkOiB0cnVlLFxuICAgICAgc3RkaW86IFsnaWdub3JlJywgJ3BpcGUnLCAncGlwZSddLFxuICAgIH0pO1xuXG4gICAgbGV0IGxvZ1hjb2RlT3V0cHV0ID0gISF0aGlzLnNob3dYY29kZUxvZztcbiAgICBjb25zdCBsb2dNc2cgPSBfLmlzQm9vbGVhbih0aGlzLnNob3dYY29kZUxvZylcbiAgICAgID8gYE91dHB1dCBmcm9tIHhjb2RlYnVpbGQgJHt0aGlzLnNob3dYY29kZUxvZyA/ICd3aWxsJyA6ICd3aWxsIG5vdCd9IGJlIGxvZ2dlZGBcbiAgICAgIDogJ091dHB1dCBmcm9tIHhjb2RlYnVpbGQgd2lsbCBvbmx5IGJlIGxvZ2dlZCBpZiBhbnkgZXJyb3JzIGFyZSBwcmVzZW50IHRoZXJlJztcbiAgICBsb2cuZGVidWcoYCR7bG9nTXNnfS4gVG8gY2hhbmdlIHRoaXMsIHVzZSAnc2hvd1hjb2RlTG9nJyBkZXNpcmVkIGNhcGFiaWxpdHlgKTtcbiAgICB4Y29kZWJ1aWxkLm9uKCdvdXRwdXQnLCAoc3Rkb3V0LCBzdGRlcnIpID0+IHtcbiAgICAgIGxldCBvdXQgPSBzdGRvdXQgfHwgc3RkZXJyO1xuICAgICAgLy8gd2Ugd2FudCB0byBwdWxsIG91dCB0aGUgbG9nIGZpbGUgdGhhdCBpcyBjcmVhdGVkLCBhbmQgaGlnaGxpZ2h0IGl0XG4gICAgICAvLyBmb3IgZGlhZ25vc3RpYyBwdXJwb3Nlc1xuICAgICAgaWYgKG91dC5pbmNsdWRlcygnV3JpdGluZyBkaWFnbm9zdGljIGxvZyBmb3IgdGVzdCBzZXNzaW9uIHRvJykpIHtcbiAgICAgICAgLy8gcHVsbCBvdXQgdGhlIGZpcnN0IGxpbmUgdGhhdCBiZWdpbnMgd2l0aCB0aGUgcGF0aCBzZXBhcmF0b3JcbiAgICAgICAgLy8gd2hpY2ggKnNob3VsZCogYmUgdGhlIGxpbmUgaW5kaWNhdGluZyB0aGUgbG9nIGZpbGUgZ2VuZXJhdGVkXG4gICAgICAgIHhjb2RlYnVpbGQubG9nTG9jYXRpb24gPSBfLmZpcnN0KF8ucmVtb3ZlKG91dC50cmltKCkuc3BsaXQoJ1xcbicpLCAodikgPT4gdi5zdGFydHNXaXRoKHBhdGguc2VwKSkpO1xuICAgICAgICBsb2cuZGVidWcoYExvZyBmaWxlIGZvciB4Y29kZWJ1aWxkIHRlc3Q6ICR7eGNvZGVidWlsZC5sb2dMb2NhdGlvbn1gKTtcbiAgICAgIH1cblxuICAgICAgLy8gaWYgd2UgaGF2ZSBhbiBlcnJvciB3ZSB3YW50IHRvIG91dHB1dCB0aGUgbG9nc1xuICAgICAgLy8gb3RoZXJ3aXNlIHRoZSBmYWlsdXJlIGlzIGluc2NydXRpYmxlXG4gICAgICAvLyBidXQgZG8gbm90IGxvZyBwZXJtaXNzaW9uIGVycm9ycyBmcm9tIHRyeWluZyB0byB3cml0ZSB0byBhdHRhY2htZW50cyBmb2xkZXJcbiAgICAgIGNvbnN0IGlnbm9yZUVycm9yID0gSUdOT1JFRF9FUlJPUlMuc29tZSgoeCkgPT4gb3V0LmluY2x1ZGVzKHgpKTtcbiAgICAgIGlmICh0aGlzLnNob3dYY29kZUxvZyAhPT0gZmFsc2UgJiYgb3V0LmluY2x1ZGVzKCdFcnJvciBEb21haW49JykgJiYgIWlnbm9yZUVycm9yKSB7XG4gICAgICAgIGxvZ1hjb2RlT3V0cHV0ID0gdHJ1ZTtcblxuICAgICAgICAvLyB0ZXJyaWJsZSBoYWNrIHRvIGhhbmRsZSBjYXNlIHdoZXJlIHhjb2RlIHJldHVybiAwIGJ1dCBpcyBmYWlsaW5nXG4gICAgICAgIHhjb2RlYnVpbGQuX3dkYV9lcnJvcl9vY2N1cnJlZCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIGRvIG5vdCBsb2cgcGVybWlzc2lvbiBlcnJvcnMgZnJvbSB0cnlpbmcgdG8gd3JpdGUgdG8gYXR0YWNobWVudHMgZm9sZGVyXG4gICAgICBpZiAobG9nWGNvZGVPdXRwdXQgJiYgIWlnbm9yZUVycm9yKSB7XG4gICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBvdXQuc3BsaXQoRU9MKSkge1xuICAgICAgICAgIHhjb2RlTG9nLmVycm9yKGxpbmUpO1xuICAgICAgICAgIGlmIChsaW5lKSB7XG4gICAgICAgICAgICB4Y29kZWJ1aWxkLl93ZGFfZXJyb3JfbWVzc2FnZSArPSBgJHtFT0x9JHtsaW5lfWA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4geGNvZGVidWlsZDtcbiAgfVxuXG4gIGFzeW5jIHN0YXJ0IChidWlsZE9ubHkgPSBmYWxzZSkge1xuICAgIHRoaXMueGNvZGVidWlsZCA9IGF3YWl0IHRoaXMuY3JlYXRlU3ViUHJvY2VzcyhidWlsZE9ubHkpO1xuICAgIC8vIFN0b3JlIHhjb2RlYnVpbGQgbWVzc2FnZVxuICAgIHRoaXMueGNvZGVidWlsZC5fd2RhX2Vycm9yX21lc3NhZ2UgPSAnJztcblxuICAgIC8vIHdyYXAgdGhlIHN0YXJ0IHByb2NlZHVyZSBpbiBhIHByb21pc2Ugc28gdGhhdCB3ZSBjYW4gY2F0Y2gsIGFuZCByZXBvcnQsXG4gICAgLy8gYW55IHN0YXJ0dXAgZXJyb3JzIHRoYXQgYXJlIHRocm93biBhcyBldmVudHNcbiAgICByZXR1cm4gYXdhaXQgbmV3IEIoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy54Y29kZWJ1aWxkLm9uKCdleGl0JywgYXN5bmMgKGNvZGUsIHNpZ25hbCkgPT4ge1xuICAgICAgICBsb2cuZXJyb3IoYHhjb2RlYnVpbGQgZXhpdGVkIHdpdGggY29kZSAnJHtjb2RlfScgYW5kIHNpZ25hbCAnJHtzaWduYWx9J2ApO1xuICAgICAgICAvLyBwcmludCBvdXQgdGhlIHhjb2RlYnVpbGQgZmlsZSBpZiB1c2VycyBoYXZlIGFza2VkIGZvciBpdFxuICAgICAgICBpZiAodGhpcy5zaG93WGNvZGVMb2cgJiYgdGhpcy54Y29kZWJ1aWxkLmxvZ0xvY2F0aW9uKSB7XG4gICAgICAgICAgeGNvZGVMb2cuZXJyb3IoYENvbnRlbnRzIG9mIHhjb2RlYnVpbGQgbG9nIGZpbGUgJyR7dGhpcy54Y29kZWJ1aWxkLmxvZ0xvY2F0aW9ufSc6YCk7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBkYXRhID0gYXdhaXQgZnMucmVhZEZpbGUodGhpcy54Y29kZWJ1aWxkLmxvZ0xvY2F0aW9uLCAndXRmOCcpO1xuICAgICAgICAgICAgZm9yIChsZXQgbGluZSBvZiBkYXRhLnNwbGl0KCdcXG4nKSkge1xuICAgICAgICAgICAgICB4Y29kZUxvZy5lcnJvcihsaW5lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihgVW5hYmxlIHRvIGFjY2VzcyB4Y29kZWJ1aWxkIGxvZyBmaWxlOiAnJHtlcnIubWVzc2FnZX0nYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMueGNvZGVidWlsZC5wcm9jZXNzRXhpdGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMueGNvZGVidWlsZC5fd2RhX2Vycm9yX29jY3VycmVkIHx8ICghc2lnbmFsICYmIGNvZGUgIT09IDApKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgRXJyb3IoYHhjb2RlYnVpbGQgZmFpbGVkIHdpdGggY29kZSAke2NvZGV9JHtFT0x9YCArXG4gICAgICAgICAgICBgeGNvZGVidWlsZCBlcnJvciBtZXNzYWdlOiR7RU9MfSR7dGhpcy54Y29kZWJ1aWxkLl93ZGFfZXJyb3JfbWVzc2FnZX1gKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaW4gdGhlIGNhc2Ugb2YganVzdCBidWlsZGluZywgdGhlIHByb2Nlc3Mgd2lsbCBleGl0IGFuZCB0aGF0IGlzIG91ciBmaW5pc2hcbiAgICAgICAgaWYgKGJ1aWxkT25seSkge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gKGFzeW5jICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB0aW1lciA9IG5ldyB0aW1pbmcuVGltZXIoKS5zdGFydCgpO1xuICAgICAgICAgIGF3YWl0IHRoaXMueGNvZGVidWlsZC5zdGFydCh0cnVlKTtcbiAgICAgICAgICBpZiAoIWJ1aWxkT25seSkge1xuICAgICAgICAgICAgbGV0IHN0YXR1cyA9IGF3YWl0IHRoaXMud2FpdEZvclN0YXJ0KHRpbWVyKTtcbiAgICAgICAgICAgIHJlc29sdmUoc3RhdHVzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGxldCBtc2cgPSBgVW5hYmxlIHRvIHN0YXJ0IFdlYkRyaXZlckFnZW50OiAke2Vycn1gO1xuICAgICAgICAgIGxvZy5lcnJvcihtc2cpO1xuICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IobXNnKSk7XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyB3YWl0Rm9yU3RhcnQgKHRpbWVyKSB7XG4gICAgLy8gdHJ5IHRvIGNvbm5lY3Qgb25jZSBldmVyeSAwLjUgc2Vjb25kcywgdW50aWwgYGxhdW5jaFRpbWVvdXRgIGlzIHVwXG4gICAgbG9nLmRlYnVnKGBXYWl0aW5nIHVwIHRvICR7dGhpcy5sYXVuY2hUaW1lb3V0fW1zIGZvciBXZWJEcml2ZXJBZ2VudCB0byBzdGFydGApO1xuICAgIGxldCBjdXJyZW50U3RhdHVzID0gbnVsbDtcbiAgICB0cnkge1xuICAgICAgbGV0IHJldHJpZXMgPSBwYXJzZUludCh0aGlzLmxhdW5jaFRpbWVvdXQgLyA1MDAsIDEwKTtcbiAgICAgIGF3YWl0IHJldHJ5SW50ZXJ2YWwocmV0cmllcywgMTAwMCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAodGhpcy54Y29kZWJ1aWxkLnByb2Nlc3NFeGl0ZWQpIHtcbiAgICAgICAgICAvLyB0aGVyZSBoYXMgYmVlbiBhbiBlcnJvciBlbHNld2hlcmUgYW5kIHdlIG5lZWQgdG8gc2hvcnQtY2lyY3VpdFxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcm94eVRpbWVvdXQgPSB0aGlzLm5vU2Vzc2lvblByb3h5LnRpbWVvdXQ7XG4gICAgICAgIHRoaXMubm9TZXNzaW9uUHJveHkudGltZW91dCA9IDEwMDA7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY3VycmVudFN0YXR1cyA9IGF3YWl0IHRoaXMubm9TZXNzaW9uUHJveHkuY29tbWFuZCgnL3N0YXR1cycsICdHRVQnKTtcbiAgICAgICAgICBpZiAoY3VycmVudFN0YXR1cyAmJiBjdXJyZW50U3RhdHVzLmlvcyAmJiBjdXJyZW50U3RhdHVzLmlvcy5pcCkge1xuICAgICAgICAgICAgdGhpcy5hZ2VudFVybCA9IGN1cnJlbnRTdGF0dXMuaW9zLmlwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBsb2cuZGVidWcoYFdlYkRyaXZlckFnZW50IGluZm9ybWF0aW9uOmApO1xuICAgICAgICAgIGxvZy5kZWJ1ZyhKU09OLnN0cmluZ2lmeShjdXJyZW50U3RhdHVzLCBudWxsLCAyKSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGNvbm5lY3QgdG8gcnVubmluZyBXZWJEcml2ZXJBZ2VudDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICB0aGlzLm5vU2Vzc2lvblByb3h5LnRpbWVvdXQgPSBwcm94eVRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAodGhpcy54Y29kZWJ1aWxkLnByb2Nlc3NFeGl0ZWQpIHtcbiAgICAgICAgLy8gdGhlcmUgaGFzIGJlZW4gYW4gZXJyb3IgZWxzZXdoZXJlIGFuZCB3ZSBuZWVkIHRvIHNob3J0LWNpcmN1aXRcbiAgICAgICAgcmV0dXJuIGN1cnJlbnRTdGF0dXM7XG4gICAgICB9XG5cbiAgICAgIGxvZy5kZWJ1ZyhgV2ViRHJpdmVyQWdlbnQgc3VjY2Vzc2Z1bGx5IHN0YXJ0ZWQgYWZ0ZXIgJHt0aW1lci5nZXREdXJhdGlvbigpLmFzTWlsbGlTZWNvbmRzLnRvRml4ZWQoMCl9bXNgKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIC8vIGF0IHRoaXMgcG9pbnQsIGlmIHdlIGhhdmUgbm90IGhhZCBhbnkgZXJyb3JzIGZyb20geGNvZGUgaXRzZWxmIChyZXBvcnRlZFxuICAgICAgLy8gZWxzZXdoZXJlKSwgd2UgY2FuIGxldCB0aGlzIGdvIHRocm91Z2ggYW5kIHRyeSB0byBjcmVhdGUgdGhlIHNlc3Npb25cbiAgICAgIGxvZy5kZWJ1ZyhlcnIubWVzc2FnZSk7XG4gICAgICBsb2cud2FybihgR2V0dGluZyBzdGF0dXMgb2YgV2ViRHJpdmVyQWdlbnQgb24gZGV2aWNlIHRpbWVkIG91dC4gQ29udGludWluZ2ApO1xuICAgIH1cbiAgICByZXR1cm4gY3VycmVudFN0YXR1cztcbiAgfVxuXG4gIGFzeW5jIHF1aXQgKCkge1xuICAgIGF3YWl0IGtpbGxQcm9jZXNzKCd4Y29kZWJ1aWxkJywgdGhpcy54Y29kZWJ1aWxkKTtcbiAgfVxufVxuXG5leHBvcnQgeyBYY29kZUJ1aWxkIH07XG5leHBvcnQgZGVmYXVsdCBYY29kZUJ1aWxkO1xuIl0sImZpbGUiOiJsaWIveGNvZGVidWlsZC5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLiJ9
