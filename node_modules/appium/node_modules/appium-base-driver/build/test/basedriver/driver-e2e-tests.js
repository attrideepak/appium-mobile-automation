"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

var _lodash = _interopRequireDefault(require("lodash"));

var _2 = require("../..");

var _constants = require("../../lib/constants");

var _axios = _interopRequireDefault(require("axios"));

var _chai = _interopRequireDefault(require("chai"));

var _chaiAsPromised = _interopRequireDefault(require("chai-as-promised"));

var _bluebird = _interopRequireDefault(require("bluebird"));

const should = _chai.default.should();

const DEFAULT_ARGS = {
  address: 'localhost',
  port: 8181
};

_chai.default.use(_chaiAsPromised.default);

function baseDriverE2ETests(DriverClass, defaultCaps = {}) {
  describe('BaseDriver (e2e)', function () {
    let baseServer,
        d = new DriverClass(DEFAULT_ARGS);
    before(async function () {
      baseServer = await (0, _2.server)({
        routeConfiguringFunction: (0, _2.routeConfiguringFunction)(d),
        port: DEFAULT_ARGS.port
      });
    });
    after(async function () {
      await baseServer.close();
    });

    async function startSession(caps) {
      return (await (0, _axios.default)({
        url: 'http://localhost:8181/wd/hub/session',
        method: 'POST',
        data: {
          desiredCapabilities: caps,
          requiredCapabilities: {}
        }
      })).data;
    }

    async function endSession(id) {
      return (await (0, _axios.default)({
        url: `http://localhost:8181/wd/hub/session/${id}`,
        method: 'DELETE',
        validateStatus: null
      })).data;
    }

    async function getSession(id) {
      return (await (0, _axios.default)({
        url: `http://localhost:8181/wd/hub/session/${id}`
      })).data;
    }

    describe('session handling', function () {
      it('should handle idempotency while creating sessions', async function () {
        const sessionIds = [];
        let times = 0;

        do {
          const {
            sessionId
          } = (await (0, _axios.default)({
            url: 'http://localhost:8181/wd/hub/session',
            headers: {
              'X-Idempotency-Key': '123456'
            },
            method: 'POST',
            data: {
              desiredCapabilities: defaultCaps,
              requiredCapabilities: {}
            },
            simple: false,
            resolveWithFullResponse: true
          })).data;
          sessionIds.push(sessionId);
          times++;
        } while (times < 2);

        _lodash.default.uniq(sessionIds).length.should.equal(1);

        const {
          status,
          data
        } = await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionIds[0]}`,
          method: 'DELETE'
        });
        status.should.equal(200);
        data.status.should.equal(0);
      });
      it('should handle idempotency while creating parallel sessions', async function () {
        const reqs = [];
        let times = 0;

        do {
          reqs.push((0, _axios.default)({
            url: 'http://localhost:8181/wd/hub/session',
            headers: {
              'X-Idempotency-Key': '12345'
            },
            method: 'POST',
            data: {
              desiredCapabilities: defaultCaps,
              requiredCapabilities: {}
            }
          }));
          times++;
        } while (times < 2);

        const sessionIds = (await _bluebird.default.all(reqs)).map(x => x.data.sessionId);

        _lodash.default.uniq(sessionIds).length.should.equal(1);

        const {
          status,
          data
        } = await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionIds[0]}`,
          method: 'DELETE'
        });
        status.should.equal(200);
        data.status.should.equal(0);
      });
      it('should create session and retrieve a session id, then delete it', async function () {
        let {
          status,
          data
        } = await (0, _axios.default)({
          url: 'http://localhost:8181/wd/hub/session',
          method: 'POST',
          data: {
            desiredCapabilities: defaultCaps,
            requiredCapabilities: {}
          }
        });
        status.should.equal(200);
        data.status.should.equal(0);
        should.exist(data.sessionId);
        data.value.should.eql(defaultCaps);
        ({
          status,
          data
        } = await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}`,
          method: 'DELETE'
        }));
        status.should.equal(200);
        data.status.should.equal(0);
        should.equal(d.sessionId, null);
      });
    });
    it.skip('should throw NYI for commands not implemented', async function () {});
    describe('command timeouts', function () {
      let originalFindElement, originalFindElements;

      async function startTimeoutSession(timeout) {
        let caps = _lodash.default.clone(defaultCaps);

        caps.newCommandTimeout = timeout;
        return await startSession(caps);
      }

      before(function () {
        originalFindElement = d.findElement;

        d.findElement = function () {
          return 'foo';
        }.bind(d);

        originalFindElements = d.findElements;

        d.findElements = async function () {
          await _bluebird.default.delay(200);
          return ['foo'];
        }.bind(d);
      });
      after(function () {
        d.findElement = originalFindElement;
        d.findElements = originalFindElements;
      });
      it('should set a default commandTimeout', async function () {
        let newSession = await startTimeoutSession();
        d.newCommandTimeoutMs.should.be.above(0);
        await endSession(newSession.sessionId);
      });
      it('should timeout on commands using commandTimeout cap', async function () {
        let newSession = await startTimeoutSession(0.25);
        await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}/element`,
          method: 'POST',
          data: {
            using: 'name',
            value: 'foo'
          }
        });
        await _bluebird.default.delay(400);
        const {
          data
        } = await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}`,
          validateStatus: null
        });
        data.status.should.equal(6);
        should.equal(d.sessionId, null);
        const {
          status
        } = await endSession(newSession.sessionId);
        status.should.equal(6);
      });
      it('should not timeout with commandTimeout of false', async function () {
        let newSession = await startTimeoutSession(0.1);
        let start = Date.now();
        const {
          value
        } = (await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}/elements`,
          method: 'POST',
          data: {
            using: 'name',
            value: 'foo'
          }
        })).data;
        (Date.now() - start).should.be.above(150);
        value.should.eql(['foo']);
        await endSession(newSession.sessionId);
      });
      it('should not timeout with commandTimeout of 0', async function () {
        d.newCommandTimeoutMs = 2;
        let newSession = await startTimeoutSession(0);
        await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}/element`,
          method: 'POST',
          data: {
            using: 'name',
            value: 'foo'
          }
        });
        await _bluebird.default.delay(400);
        let {
          status
        } = (await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}`
        })).data;
        status.should.equal(0);
        ({
          status
        } = await endSession(newSession.sessionId));
        status.should.equal(0);
        d.newCommandTimeoutMs = 60 * 1000;
      });
      it('should not timeout if its just the command taking awhile', async function () {
        let newSession = await startTimeoutSession(0.25);
        await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}/element`,
          method: 'POST',
          data: {
            using: 'name',
            value: 'foo'
          }
        });
        await _bluebird.default.delay(400);
        let {
          status
        } = (await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}`,
          validateStatus: null
        })).data;
        status.should.equal(6);
        should.equal(d.sessionId, null);
        ({
          status
        } = await endSession(newSession.sessionId));
        status.should.equal(6);
      });
      it('should not have a timer running before or after a session', async function () {
        should.not.exist(d.noCommandTimer);
        let newSession = await startTimeoutSession(0.25);
        newSession.sessionId.should.equal(d.sessionId);
        should.exist(d.noCommandTimer);
        await endSession(newSession.sessionId);
        should.not.exist(d.noCommandTimer);
      });
    });
    describe('settings api', function () {
      before(function () {
        d.settings = new _2.DeviceSettings({
          ignoreUnimportantViews: false
        });
      });
      it('should be able to get settings object', function () {
        d.settings.getSettings().ignoreUnimportantViews.should.be.false;
      });
      it('should throw error when updateSettings method is not defined', async function () {
        await d.settings.update({
          ignoreUnimportantViews: true
        }).should.eventually.be.rejectedWith('onSettingsUpdate');
      });
      it('should throw error for invalid update object', async function () {
        await d.settings.update('invalid json').should.eventually.be.rejectedWith('JSON');
      });
    });
    describe('unexpected exits', function () {
      it('should reject a current command when the driver crashes', async function () {
        d._oldGetStatus = d.getStatus;

        try {
          d.getStatus = async function () {
            await _bluebird.default.delay(5000);
          }.bind(d);

          const reqPromise = (0, _axios.default)({
            url: 'http://localhost:8181/wd/hub/status',
            validateStatus: null
          });
          await _bluebird.default.delay(100);
          const shutdownEventPromise = new _bluebird.default((resolve, reject) => {
            setTimeout(() => reject(new Error('onUnexpectedShutdown event is expected to be fired within 5 seconds timeout')), 5000);
            d.onUnexpectedShutdown(resolve);
          });
          d.startUnexpectedShutdown(new Error('Crashytimes'));
          const {
            status,
            value
          } = (await reqPromise).data;
          status.should.equal(13);
          value.message.should.contain('Crashytimes');
          await shutdownEventPromise;
        } finally {
          d.getStatus = d._oldGetStatus;
        }
      });
    });
    describe('event timings', function () {
      it('should not add timings if not using opt-in cap', async function () {
        let session = await startSession(defaultCaps);
        let res = await getSession(session.sessionId);
        should.not.exist(res.events);
        await endSession(session.sessionId);
      });
      it('should add start session timings', async function () {
        let caps = Object.assign({}, defaultCaps, {
          eventTimings: true
        });
        let session = await startSession(caps);
        let res = (await getSession(session.sessionId)).value;
        should.exist(res.events);
        should.exist(res.events.newSessionRequested);
        should.exist(res.events.newSessionStarted);
        res.events.newSessionRequested[0].should.be.a('number');
        res.events.newSessionStarted[0].should.be.a('number');
        await endSession(session.sessionId);
      });
    });
    describe('execute driver script', function () {
      let originalFindElement, sessionId;
      before(function () {
        d.allowInsecure = ['execute_driver_script'];
        originalFindElement = d.findElement;

        d.findElement = function (strategy, selector) {
          if (strategy === 'accessibility id' && selector === 'amazing') {
            return {
              [_constants.W3C_ELEMENT_KEY]: 'element-id-1'
            };
          }

          throw new _2.errors.NoSuchElementError('not found');
        }.bind(d);
      });
      beforeEach(async function () {
        ({
          sessionId
        } = await startSession(defaultCaps));
      });
      after(function () {
        d.findElement = originalFindElement;
      });
      afterEach(async function () {
        await endSession(sessionId);
      });
      it('should not work unless the allowInsecure feature flag is set', async function () {
        d._allowInsecure = d.allowInsecure;

        try {
          d.allowInsecure = [];
          const script = `return 'foo'`;
          await (0, _axios.default)({
            url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
            method: 'POST',
            data: {
              script,
              type: 'wd'
            }
          }).should.eventually.be.rejected;
          await endSession(sessionId);
        } finally {
          d.allowInsecure = d._allowInsecure;
        }
      });
      it('should execute a webdriverio script in the context of session', async function () {
        const script = `
          const timeouts = await driver.getTimeouts();
          const status = await driver.status();
          return [timeouts, status];
        `;
        const {
          value
        } = (await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          data: {
            script,
            type: 'webdriverio'
          }
        })).data;
        const expectedTimeouts = {
          command: 250,
          implicit: 0
        };
        const expectedStatus = {};
        value.result.should.eql([expectedTimeouts, expectedStatus]);
      });
      it('should fail with any script type other than webdriverio currently', async function () {
        const script = `return 'foo'`;
        await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          data: {
            script,
            type: 'wd'
          }
        }).should.eventually.be.rejected;
      });
      it('should execute a webdriverio script that returns elements correctly', async function () {
        const script = `
          return await driver.$("~amazing");
        `;
        const {
          value
        } = (await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          data: {
            script
          }
        })).data;
        value.result.should.eql({
          [_constants.W3C_ELEMENT_KEY]: 'element-id-1',
          [_constants.MJSONWP_ELEMENT_KEY]: 'element-id-1'
        });
      });
      it('should execute a webdriverio script that returns elements in deep structure', async function () {
        const script = `
          const el = await driver.$("~amazing");
          return {element: el, elements: [el, el]};
        `;
        const {
          value
        } = (await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          data: {
            script
          }
        })).data;
        const elObj = {
          [_constants.W3C_ELEMENT_KEY]: 'element-id-1',
          [_constants.MJSONWP_ELEMENT_KEY]: 'element-id-1'
        };
        value.result.should.eql({
          element: elObj,
          elements: [elObj, elObj]
        });
      });
      it('should store and return logs to the user', async function () {
        const script = `
          console.log("foo");
          console.log("foo2");
          console.warn("bar");
          console.error("baz");
          return null;
        `;
        const {
          value
        } = (await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          data: {
            script
          }
        })).data;
        value.logs.should.eql({
          log: ['foo', 'foo2'],
          warn: ['bar'],
          error: ['baz']
        });
      });
      it('should have appium specific commands available', async function () {
        const script = `
          return typeof driver.lock;
        `;
        const {
          value
        } = (await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          data: {
            script
          }
        })).data;
        value.result.should.eql('function');
      });
      it('should correctly handle errors that happen in a webdriverio script', async function () {
        const script = `
          return await driver.$("~notfound");
        `;
        const {
          data
        } = await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          validateStatus: null,
          data: {
            script
          }
        });
        data.should.eql({
          sessionId,
          status: 13,
          value: {
            message: 'An unknown server-side error occurred while processing the command. Original error: Could not execute driver script. Original error was: Error: not found'
          }
        });
      });
      it('should correctly handle errors that happen when a script cannot be compiled', async function () {
        const script = `
          return {;
        `;
        const {
          data
        } = await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          validateStatus: null,
          data: {
            script
          }
        });
        sessionId.should.eql(data.sessionId);
        data.status.should.eql(13);
        data.value.should.have.property('message');
        data.value.message.should.match(/An unknown server-side error occurred while processing the command. Original error: Could not execute driver script. Original error was: Error: Unexpected token '?;'?/);
      });
      it('should be able to set a timeout on a driver script', async function () {
        const script = `
          await Promise.delay(1000);
          return true;
        `;
        const {
          value
        } = (await (0, _axios.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          validateStatus: null,
          data: {
            script,
            timeout: 50
          }
        })).data;
        value.message.should.match(/.+50.+timeout.+/);
      });
    });
  });
}

var _default = baseDriverE2ETests;
exports.default = _default;require('source-map-support').install();


//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvYmFzZWRyaXZlci9kcml2ZXItZTJlLXRlc3RzLmpzIl0sIm5hbWVzIjpbInNob3VsZCIsImNoYWkiLCJERUZBVUxUX0FSR1MiLCJhZGRyZXNzIiwicG9ydCIsInVzZSIsImNoYWlBc1Byb21pc2VkIiwiYmFzZURyaXZlckUyRVRlc3RzIiwiRHJpdmVyQ2xhc3MiLCJkZWZhdWx0Q2FwcyIsImRlc2NyaWJlIiwiYmFzZVNlcnZlciIsImQiLCJiZWZvcmUiLCJyb3V0ZUNvbmZpZ3VyaW5nRnVuY3Rpb24iLCJhZnRlciIsImNsb3NlIiwic3RhcnRTZXNzaW9uIiwiY2FwcyIsInVybCIsIm1ldGhvZCIsImRhdGEiLCJkZXNpcmVkQ2FwYWJpbGl0aWVzIiwicmVxdWlyZWRDYXBhYmlsaXRpZXMiLCJlbmRTZXNzaW9uIiwiaWQiLCJ2YWxpZGF0ZVN0YXR1cyIsImdldFNlc3Npb24iLCJpdCIsInNlc3Npb25JZHMiLCJ0aW1lcyIsInNlc3Npb25JZCIsImhlYWRlcnMiLCJzaW1wbGUiLCJyZXNvbHZlV2l0aEZ1bGxSZXNwb25zZSIsInB1c2giLCJfIiwidW5pcSIsImxlbmd0aCIsImVxdWFsIiwic3RhdHVzIiwicmVxcyIsIkIiLCJhbGwiLCJtYXAiLCJ4IiwiZXhpc3QiLCJ2YWx1ZSIsImVxbCIsInNraXAiLCJvcmlnaW5hbEZpbmRFbGVtZW50Iiwib3JpZ2luYWxGaW5kRWxlbWVudHMiLCJzdGFydFRpbWVvdXRTZXNzaW9uIiwidGltZW91dCIsImNsb25lIiwibmV3Q29tbWFuZFRpbWVvdXQiLCJmaW5kRWxlbWVudCIsImJpbmQiLCJmaW5kRWxlbWVudHMiLCJkZWxheSIsIm5ld1Nlc3Npb24iLCJuZXdDb21tYW5kVGltZW91dE1zIiwiYmUiLCJhYm92ZSIsInVzaW5nIiwic3RhcnQiLCJEYXRlIiwibm93Iiwibm90Iiwibm9Db21tYW5kVGltZXIiLCJzZXR0aW5ncyIsIkRldmljZVNldHRpbmdzIiwiaWdub3JlVW5pbXBvcnRhbnRWaWV3cyIsImdldFNldHRpbmdzIiwiZmFsc2UiLCJ1cGRhdGUiLCJldmVudHVhbGx5IiwicmVqZWN0ZWRXaXRoIiwiX29sZEdldFN0YXR1cyIsImdldFN0YXR1cyIsInJlcVByb21pc2UiLCJzaHV0ZG93bkV2ZW50UHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJzZXRUaW1lb3V0IiwiRXJyb3IiLCJvblVuZXhwZWN0ZWRTaHV0ZG93biIsInN0YXJ0VW5leHBlY3RlZFNodXRkb3duIiwibWVzc2FnZSIsImNvbnRhaW4iLCJzZXNzaW9uIiwicmVzIiwiZXZlbnRzIiwiT2JqZWN0IiwiYXNzaWduIiwiZXZlbnRUaW1pbmdzIiwibmV3U2Vzc2lvblJlcXVlc3RlZCIsIm5ld1Nlc3Npb25TdGFydGVkIiwiYSIsImFsbG93SW5zZWN1cmUiLCJzdHJhdGVneSIsInNlbGVjdG9yIiwiVzNDX0VMRU1FTlRfS0VZIiwiZXJyb3JzIiwiTm9TdWNoRWxlbWVudEVycm9yIiwiYmVmb3JlRWFjaCIsImFmdGVyRWFjaCIsIl9hbGxvd0luc2VjdXJlIiwic2NyaXB0IiwidHlwZSIsInJlamVjdGVkIiwiZXhwZWN0ZWRUaW1lb3V0cyIsImNvbW1hbmQiLCJpbXBsaWNpdCIsImV4cGVjdGVkU3RhdHVzIiwicmVzdWx0IiwiTUpTT05XUF9FTEVNRU5UX0tFWSIsImVsT2JqIiwiZWxlbWVudCIsImVsZW1lbnRzIiwibG9ncyIsImxvZyIsIndhcm4iLCJlcnJvciIsImhhdmUiLCJwcm9wZXJ0eSIsIm1hdGNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBOztBQUNBOztBQUNBOztBQUdBOztBQUNBOztBQUNBOztBQUNBOztBQUVBLE1BQU1BLE1BQU0sR0FBR0MsY0FBS0QsTUFBTCxFQUFmOztBQUNBLE1BQU1FLFlBQVksR0FBRztBQUNuQkMsRUFBQUEsT0FBTyxFQUFFLFdBRFU7QUFFbkJDLEVBQUFBLElBQUksRUFBRTtBQUZhLENBQXJCOztBQUlBSCxjQUFLSSxHQUFMLENBQVNDLHVCQUFUOztBQUVBLFNBQVNDLGtCQUFULENBQTZCQyxX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O0FBQ0QsT0FaQyxDQUFGO0FBYUQsS0EvS08sQ0FBUjtBQWdMRCxHQXJkTyxDQUFSO0FBc2REOztlQUVjdkgsa0IiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHsgc2VydmVyLCByb3V0ZUNvbmZpZ3VyaW5nRnVuY3Rpb24sIERldmljZVNldHRpbmdzLCBlcnJvcnMgfSBmcm9tICcuLi8uLic7XG5pbXBvcnQge1xuICBNSlNPTldQX0VMRU1FTlRfS0VZLCBXM0NfRUxFTUVOVF9LRVlcbn0gZnJvbSAnLi4vLi4vbGliL2NvbnN0YW50cyc7XG5pbXBvcnQgYXhpb3MgZnJvbSAnYXhpb3MnO1xuaW1wb3J0IGNoYWkgZnJvbSAnY2hhaSc7XG5pbXBvcnQgY2hhaUFzUHJvbWlzZWQgZnJvbSAnY2hhaS1hcy1wcm9taXNlZCc7XG5pbXBvcnQgQiBmcm9tICdibHVlYmlyZCc7XG5cbmNvbnN0IHNob3VsZCA9IGNoYWkuc2hvdWxkKCk7XG5jb25zdCBERUZBVUxUX0FSR1MgPSB7XG4gIGFkZHJlc3M6ICdsb2NhbGhvc3QnLFxuICBwb3J0OiA4MTgxXG59O1xuY2hhaS51c2UoY2hhaUFzUHJvbWlzZWQpO1xuXG5mdW5jdGlvbiBiYXNlRHJpdmVyRTJFVGVzdHMgKERyaXZlckNsYXNzLCBkZWZhdWx0Q2FwcyA9IHt9KSB7XG4gIGRlc2NyaWJlKCdCYXNlRHJpdmVyIChlMmUpJywgZnVuY3Rpb24gKCkge1xuICAgIGxldCBiYXNlU2VydmVyLCBkID0gbmV3IERyaXZlckNsYXNzKERFRkFVTFRfQVJHUyk7XG4gICAgYmVmb3JlKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIGJhc2VTZXJ2ZXIgPSBhd2FpdCBzZXJ2ZXIoe1xuICAgICAgICByb3V0ZUNvbmZpZ3VyaW5nRnVuY3Rpb246IHJvdXRlQ29uZmlndXJpbmdGdW5jdGlvbihkKSxcbiAgICAgICAgcG9ydDogREVGQVVMVF9BUkdTLnBvcnQsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBhZnRlcihhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICBhd2FpdCBiYXNlU2VydmVyLmNsb3NlKCk7XG4gICAgfSk7XG5cbiAgICBhc3luYyBmdW5jdGlvbiBzdGFydFNlc3Npb24gKGNhcHMpIHtcbiAgICAgIHJldHVybiAoYXdhaXQgYXhpb3Moe1xuICAgICAgICB1cmw6ICdodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24nLFxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgZGF0YToge2Rlc2lyZWRDYXBhYmlsaXRpZXM6IGNhcHMsIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiB7fX0sXG4gICAgICB9KSkuZGF0YTtcbiAgICB9XG5cbiAgICBhc3luYyBmdW5jdGlvbiBlbmRTZXNzaW9uIChpZCkge1xuICAgICAgcmV0dXJuIChhd2FpdCBheGlvcyh7XG4gICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke2lkfWAsXG4gICAgICAgIG1ldGhvZDogJ0RFTEVURScsXG4gICAgICAgIHZhbGlkYXRlU3RhdHVzOiBudWxsLFxuICAgICAgfSkpLmRhdGE7XG4gICAgfVxuXG4gICAgYXN5bmMgZnVuY3Rpb24gZ2V0U2Vzc2lvbiAoaWQpIHtcbiAgICAgIHJldHVybiAoYXdhaXQgYXhpb3Moe1xuICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtpZH1gLFxuICAgICAgfSkpLmRhdGE7XG4gICAgfVxuXG4gICAgZGVzY3JpYmUoJ3Nlc3Npb24gaGFuZGxpbmcnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBpdCgnc2hvdWxkIGhhbmRsZSBpZGVtcG90ZW5jeSB3aGlsZSBjcmVhdGluZyBzZXNzaW9ucycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbklkcyA9IFtdO1xuICAgICAgICBsZXQgdGltZXMgPSAwO1xuICAgICAgICBkbyB7XG4gICAgICAgICAgY29uc3Qge3Nlc3Npb25JZH0gPSAoYXdhaXQgYXhpb3Moe1xuICAgICAgICAgICAgdXJsOiAnaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgJ1gtSWRlbXBvdGVuY3ktS2V5JzogJzEyMzQ1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICBkYXRhOiB7ZGVzaXJlZENhcGFiaWxpdGllczogZGVmYXVsdENhcHMsIHJlcXVpcmVkQ2FwYWJpbGl0aWVzOiB7fX0sXG4gICAgICAgICAgICBzaW1wbGU6IGZhbHNlLFxuICAgICAgICAgICAgcmVzb2x2ZVdpdGhGdWxsUmVzcG9uc2U6IHRydWVcbiAgICAgICAgICB9KSkuZGF0YTtcblxuICAgICAgICAgIHNlc3Npb25JZHMucHVzaChzZXNzaW9uSWQpO1xuICAgICAgICAgIHRpbWVzKys7XG4gICAgICAgIH0gd2hpbGUgKHRpbWVzIDwgMik7XG4gICAgICAgIF8udW5pcShzZXNzaW9uSWRzKS5sZW5ndGguc2hvdWxkLmVxdWFsKDEpO1xuXG4gICAgICAgIGNvbnN0IHtzdGF0dXMsIGRhdGF9ID0gYXdhaXQgYXhpb3Moe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke3Nlc3Npb25JZHNbMF19YCxcbiAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgICAgICB9KTtcbiAgICAgICAgc3RhdHVzLnNob3VsZC5lcXVhbCgyMDApO1xuICAgICAgICBkYXRhLnN0YXR1cy5zaG91bGQuZXF1YWwoMCk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBoYW5kbGUgaWRlbXBvdGVuY3kgd2hpbGUgY3JlYXRpbmcgcGFyYWxsZWwgc2Vzc2lvbnMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHJlcXMgPSBbXTtcbiAgICAgICAgbGV0IHRpbWVzID0gMDtcbiAgICAgICAgZG8ge1xuICAgICAgICAgIHJlcXMucHVzaChheGlvcyh7XG4gICAgICAgICAgICB1cmw6ICdodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24nLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAnWC1JZGVtcG90ZW5jeS1LZXknOiAnMTIzNDUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgZGF0YToge2Rlc2lyZWRDYXBhYmlsaXRpZXM6IGRlZmF1bHRDYXBzLCByZXF1aXJlZENhcGFiaWxpdGllczoge319LFxuICAgICAgICAgIH0pKTtcbiAgICAgICAgICB0aW1lcysrO1xuICAgICAgICB9IHdoaWxlICh0aW1lcyA8IDIpO1xuICAgICAgICBjb25zdCBzZXNzaW9uSWRzID0gKGF3YWl0IEIuYWxsKHJlcXMpKS5tYXAoKHgpID0+IHguZGF0YS5zZXNzaW9uSWQpO1xuICAgICAgICBfLnVuaXEoc2Vzc2lvbklkcykubGVuZ3RoLnNob3VsZC5lcXVhbCgxKTtcblxuICAgICAgICBjb25zdCB7c3RhdHVzLCBkYXRhfSA9IGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtzZXNzaW9uSWRzWzBdfWAsXG4gICAgICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgICAgfSk7XG4gICAgICAgIHN0YXR1cy5zaG91bGQuZXF1YWwoMjAwKTtcbiAgICAgICAgZGF0YS5zdGF0dXMuc2hvdWxkLmVxdWFsKDApO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgY3JlYXRlIHNlc3Npb24gYW5kIHJldHJpZXZlIGEgc2Vzc2lvbiBpZCwgdGhlbiBkZWxldGUgaXQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxldCB7c3RhdHVzLCBkYXRhfSA9IGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICB1cmw6ICdodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24nLFxuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGRhdGE6IHtkZXNpcmVkQ2FwYWJpbGl0aWVzOiBkZWZhdWx0Q2FwcywgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IHt9fSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc3RhdHVzLnNob3VsZC5lcXVhbCgyMDApO1xuICAgICAgICBkYXRhLnN0YXR1cy5zaG91bGQuZXF1YWwoMCk7XG4gICAgICAgIHNob3VsZC5leGlzdChkYXRhLnNlc3Npb25JZCk7XG4gICAgICAgIGRhdGEudmFsdWUuc2hvdWxkLmVxbChkZWZhdWx0Q2Fwcyk7XG5cbiAgICAgICAgKHtzdGF0dXMsIGRhdGF9ID0gYXdhaXQgYXhpb3Moe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke2Quc2Vzc2lvbklkfWAsXG4gICAgICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgICAgfSkpO1xuXG4gICAgICAgIHN0YXR1cy5zaG91bGQuZXF1YWwoMjAwKTtcbiAgICAgICAgZGF0YS5zdGF0dXMuc2hvdWxkLmVxdWFsKDApO1xuICAgICAgICBzaG91bGQuZXF1YWwoZC5zZXNzaW9uSWQsIG51bGwpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpdC5za2lwKCdzaG91bGQgdGhyb3cgTllJIGZvciBjb21tYW5kcyBub3QgaW1wbGVtZW50ZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZSgnY29tbWFuZCB0aW1lb3V0cycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGxldCBvcmlnaW5hbEZpbmRFbGVtZW50LCBvcmlnaW5hbEZpbmRFbGVtZW50cztcbiAgICAgIGFzeW5jIGZ1bmN0aW9uIHN0YXJ0VGltZW91dFNlc3Npb24gKHRpbWVvdXQpIHtcbiAgICAgICAgbGV0IGNhcHMgPSBfLmNsb25lKGRlZmF1bHRDYXBzKTtcbiAgICAgICAgY2Fwcy5uZXdDb21tYW5kVGltZW91dCA9IHRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBhd2FpdCBzdGFydFNlc3Npb24oY2Fwcyk7XG4gICAgICB9XG5cbiAgICAgIGJlZm9yZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIG9yaWdpbmFsRmluZEVsZW1lbnQgPSBkLmZpbmRFbGVtZW50O1xuICAgICAgICBkLmZpbmRFbGVtZW50ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAnZm9vJztcbiAgICAgICAgfS5iaW5kKGQpO1xuXG4gICAgICAgIG9yaWdpbmFsRmluZEVsZW1lbnRzID0gZC5maW5kRWxlbWVudHM7XG4gICAgICAgIGQuZmluZEVsZW1lbnRzID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGF3YWl0IEIuZGVsYXkoMjAwKTtcbiAgICAgICAgICByZXR1cm4gWydmb28nXTtcbiAgICAgICAgfS5iaW5kKGQpO1xuICAgICAgfSk7XG5cbiAgICAgIGFmdGVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZC5maW5kRWxlbWVudCA9IG9yaWdpbmFsRmluZEVsZW1lbnQ7XG4gICAgICAgIGQuZmluZEVsZW1lbnRzID0gb3JpZ2luYWxGaW5kRWxlbWVudHM7XG4gICAgICB9KTtcblxuXG4gICAgICBpdCgnc2hvdWxkIHNldCBhIGRlZmF1bHQgY29tbWFuZFRpbWVvdXQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxldCBuZXdTZXNzaW9uID0gYXdhaXQgc3RhcnRUaW1lb3V0U2Vzc2lvbigpO1xuICAgICAgICBkLm5ld0NvbW1hbmRUaW1lb3V0TXMuc2hvdWxkLmJlLmFib3ZlKDApO1xuICAgICAgICBhd2FpdCBlbmRTZXNzaW9uKG5ld1Nlc3Npb24uc2Vzc2lvbklkKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIHRpbWVvdXQgb24gY29tbWFuZHMgdXNpbmcgY29tbWFuZFRpbWVvdXQgY2FwJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBsZXQgbmV3U2Vzc2lvbiA9IGF3YWl0IHN0YXJ0VGltZW91dFNlc3Npb24oMC4yNSk7XG5cbiAgICAgICAgYXdhaXQgYXhpb3Moe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke2Quc2Vzc2lvbklkfS9lbGVtZW50YCxcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBkYXRhOiB7dXNpbmc6ICduYW1lJywgdmFsdWU6ICdmb28nfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IEIuZGVsYXkoNDAwKTtcbiAgICAgICAgY29uc3Qge2RhdGF9ID0gYXdhaXQgYXhpb3Moe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke2Quc2Vzc2lvbklkfWAsXG4gICAgICAgICAgdmFsaWRhdGVTdGF0dXM6IG51bGwsXG4gICAgICAgIH0pO1xuICAgICAgICBkYXRhLnN0YXR1cy5zaG91bGQuZXF1YWwoNik7XG4gICAgICAgIHNob3VsZC5lcXVhbChkLnNlc3Npb25JZCwgbnVsbCk7XG4gICAgICAgIGNvbnN0IHtzdGF0dXN9ID0gYXdhaXQgZW5kU2Vzc2lvbihuZXdTZXNzaW9uLnNlc3Npb25JZCk7XG4gICAgICAgIHN0YXR1cy5zaG91bGQuZXF1YWwoNik7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBub3QgdGltZW91dCB3aXRoIGNvbW1hbmRUaW1lb3V0IG9mIGZhbHNlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBsZXQgbmV3U2Vzc2lvbiA9IGF3YWl0IHN0YXJ0VGltZW91dFNlc3Npb24oMC4xKTtcbiAgICAgICAgbGV0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgY29uc3Qge3ZhbHVlfSA9IChhd2FpdCBheGlvcyh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7ZC5zZXNzaW9uSWR9L2VsZW1lbnRzYCxcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBkYXRhOiB7dXNpbmc6ICduYW1lJywgdmFsdWU6ICdmb28nfSxcbiAgICAgICAgfSkpLmRhdGE7XG4gICAgICAgIChEYXRlLm5vdygpIC0gc3RhcnQpLnNob3VsZC5iZS5hYm92ZSgxNTApO1xuICAgICAgICB2YWx1ZS5zaG91bGQuZXFsKFsnZm9vJ10pO1xuICAgICAgICBhd2FpdCBlbmRTZXNzaW9uKG5ld1Nlc3Npb24uc2Vzc2lvbklkKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIG5vdCB0aW1lb3V0IHdpdGggY29tbWFuZFRpbWVvdXQgb2YgMCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZC5uZXdDb21tYW5kVGltZW91dE1zID0gMjtcbiAgICAgICAgbGV0IG5ld1Nlc3Npb24gPSBhd2FpdCBzdGFydFRpbWVvdXRTZXNzaW9uKDApO1xuXG4gICAgICAgIGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtkLnNlc3Npb25JZH0vZWxlbWVudGAsXG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgZGF0YToge3VzaW5nOiAnbmFtZScsIHZhbHVlOiAnZm9vJ30sXG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBCLmRlbGF5KDQwMCk7XG4gICAgICAgIGxldCB7c3RhdHVzfSA9IChhd2FpdCBheGlvcyh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7ZC5zZXNzaW9uSWR9YCxcbiAgICAgICAgfSkpLmRhdGE7XG4gICAgICAgIHN0YXR1cy5zaG91bGQuZXF1YWwoMCk7XG4gICAgICAgICh7c3RhdHVzfSA9IGF3YWl0IGVuZFNlc3Npb24obmV3U2Vzc2lvbi5zZXNzaW9uSWQpKTtcbiAgICAgICAgc3RhdHVzLnNob3VsZC5lcXVhbCgwKTtcblxuICAgICAgICBkLm5ld0NvbW1hbmRUaW1lb3V0TXMgPSA2MCAqIDEwMDA7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBub3QgdGltZW91dCBpZiBpdHMganVzdCB0aGUgY29tbWFuZCB0YWtpbmcgYXdoaWxlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBsZXQgbmV3U2Vzc2lvbiA9IGF3YWl0IHN0YXJ0VGltZW91dFNlc3Npb24oMC4yNSk7XG4gICAgICAgIGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtkLnNlc3Npb25JZH0vZWxlbWVudGAsXG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgZGF0YToge3VzaW5nOiAnbmFtZScsIHZhbHVlOiAnZm9vJ30sXG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBCLmRlbGF5KDQwMCk7XG4gICAgICAgIGxldCB7c3RhdHVzfSA9IChhd2FpdCBheGlvcyh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7ZC5zZXNzaW9uSWR9YCxcbiAgICAgICAgICB2YWxpZGF0ZVN0YXR1czogbnVsbCxcbiAgICAgICAgfSkpLmRhdGE7XG4gICAgICAgIHN0YXR1cy5zaG91bGQuZXF1YWwoNik7XG4gICAgICAgIHNob3VsZC5lcXVhbChkLnNlc3Npb25JZCwgbnVsbCk7XG4gICAgICAgICh7c3RhdHVzfSA9IGF3YWl0IGVuZFNlc3Npb24obmV3U2Vzc2lvbi5zZXNzaW9uSWQpKTtcbiAgICAgICAgc3RhdHVzLnNob3VsZC5lcXVhbCg2KTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIG5vdCBoYXZlIGEgdGltZXIgcnVubmluZyBiZWZvcmUgb3IgYWZ0ZXIgYSBzZXNzaW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBzaG91bGQubm90LmV4aXN0KGQubm9Db21tYW5kVGltZXIpO1xuICAgICAgICBsZXQgbmV3U2Vzc2lvbiA9IGF3YWl0IHN0YXJ0VGltZW91dFNlc3Npb24oMC4yNSk7XG4gICAgICAgIG5ld1Nlc3Npb24uc2Vzc2lvbklkLnNob3VsZC5lcXVhbChkLnNlc3Npb25JZCk7XG4gICAgICAgIHNob3VsZC5leGlzdChkLm5vQ29tbWFuZFRpbWVyKTtcbiAgICAgICAgYXdhaXQgZW5kU2Vzc2lvbihuZXdTZXNzaW9uLnNlc3Npb25JZCk7XG4gICAgICAgIHNob3VsZC5ub3QuZXhpc3QoZC5ub0NvbW1hbmRUaW1lcik7XG4gICAgICB9KTtcblxuICAgIH0pO1xuXG4gICAgZGVzY3JpYmUoJ3NldHRpbmdzIGFwaScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGJlZm9yZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIGQuc2V0dGluZ3MgPSBuZXcgRGV2aWNlU2V0dGluZ3Moe2lnbm9yZVVuaW1wb3J0YW50Vmlld3M6IGZhbHNlfSk7XG4gICAgICB9KTtcbiAgICAgIGl0KCdzaG91bGQgYmUgYWJsZSB0byBnZXQgc2V0dGluZ3Mgb2JqZWN0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBkLnNldHRpbmdzLmdldFNldHRpbmdzKCkuaWdub3JlVW5pbXBvcnRhbnRWaWV3cy5zaG91bGQuYmUuZmFsc2U7XG4gICAgICB9KTtcbiAgICAgIGl0KCdzaG91bGQgdGhyb3cgZXJyb3Igd2hlbiB1cGRhdGVTZXR0aW5ncyBtZXRob2QgaXMgbm90IGRlZmluZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGF3YWl0IGQuc2V0dGluZ3MudXBkYXRlKHtpZ25vcmVVbmltcG9ydGFudFZpZXdzOiB0cnVlfSkuc2hvdWxkLmV2ZW50dWFsbHlcbiAgICAgICAgICAgICAgICAuYmUucmVqZWN0ZWRXaXRoKCdvblNldHRpbmdzVXBkYXRlJyk7XG4gICAgICB9KTtcbiAgICAgIGl0KCdzaG91bGQgdGhyb3cgZXJyb3IgZm9yIGludmFsaWQgdXBkYXRlIG9iamVjdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgYXdhaXQgZC5zZXR0aW5ncy51cGRhdGUoJ2ludmFsaWQganNvbicpLnNob3VsZC5ldmVudHVhbGx5XG4gICAgICAgICAgICAgICAgLmJlLnJlamVjdGVkV2l0aCgnSlNPTicpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZSgndW5leHBlY3RlZCBleGl0cycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGl0KCdzaG91bGQgcmVqZWN0IGEgY3VycmVudCBjb21tYW5kIHdoZW4gdGhlIGRyaXZlciBjcmFzaGVzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBkLl9vbGRHZXRTdGF0dXMgPSBkLmdldFN0YXR1cztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBkLmdldFN0YXR1cyA9IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGF3YWl0IEIuZGVsYXkoNTAwMCk7XG4gICAgICAgICAgfS5iaW5kKGQpO1xuICAgICAgICAgIGNvbnN0IHJlcVByb21pc2UgPSBheGlvcyh7XG4gICAgICAgICAgICB1cmw6ICdodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3N0YXR1cycsXG4gICAgICAgICAgICB2YWxpZGF0ZVN0YXR1czogbnVsbCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICAvLyBtYWtlIHN1cmUgdGhhdCB0aGUgcmVxdWVzdCBnZXRzIHRvIHRoZSBzZXJ2ZXIgYmVmb3JlIG91ciBzaHV0ZG93blxuICAgICAgICAgIGF3YWl0IEIuZGVsYXkoMTAwKTtcbiAgICAgICAgICBjb25zdCBzaHV0ZG93bkV2ZW50UHJvbWlzZSA9IG5ldyBCKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gcmVqZWN0KG5ldyBFcnJvcignb25VbmV4cGVjdGVkU2h1dGRvd24gZXZlbnQgaXMgZXhwZWN0ZWQgdG8gYmUgZmlyZWQgd2l0aGluIDUgc2Vjb25kcyB0aW1lb3V0JykpLCA1MDAwKTtcbiAgICAgICAgICAgIGQub25VbmV4cGVjdGVkU2h1dGRvd24ocmVzb2x2ZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZC5zdGFydFVuZXhwZWN0ZWRTaHV0ZG93bihuZXcgRXJyb3IoJ0NyYXNoeXRpbWVzJykpO1xuICAgICAgICAgIGNvbnN0IHtzdGF0dXMsIHZhbHVlfSA9IChhd2FpdCByZXFQcm9taXNlKS5kYXRhO1xuICAgICAgICAgIHN0YXR1cy5zaG91bGQuZXF1YWwoMTMpO1xuICAgICAgICAgIHZhbHVlLm1lc3NhZ2Uuc2hvdWxkLmNvbnRhaW4oJ0NyYXNoeXRpbWVzJyk7XG4gICAgICAgICAgYXdhaXQgc2h1dGRvd25FdmVudFByb21pc2U7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgZC5nZXRTdGF0dXMgPSBkLl9vbGRHZXRTdGF0dXM7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZGVzY3JpYmUoJ2V2ZW50IHRpbWluZ3MnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBpdCgnc2hvdWxkIG5vdCBhZGQgdGltaW5ncyBpZiBub3QgdXNpbmcgb3B0LWluIGNhcCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbGV0IHNlc3Npb24gPSBhd2FpdCBzdGFydFNlc3Npb24oZGVmYXVsdENhcHMpO1xuICAgICAgICBsZXQgcmVzID0gYXdhaXQgZ2V0U2Vzc2lvbihzZXNzaW9uLnNlc3Npb25JZCk7XG4gICAgICAgIHNob3VsZC5ub3QuZXhpc3QocmVzLmV2ZW50cyk7XG4gICAgICAgIGF3YWl0IGVuZFNlc3Npb24oc2Vzc2lvbi5zZXNzaW9uSWQpO1xuICAgICAgfSk7XG4gICAgICBpdCgnc2hvdWxkIGFkZCBzdGFydCBzZXNzaW9uIHRpbWluZ3MnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxldCBjYXBzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdENhcHMsIHtldmVudFRpbWluZ3M6IHRydWV9KTtcbiAgICAgICAgbGV0IHNlc3Npb24gPSBhd2FpdCBzdGFydFNlc3Npb24oY2Fwcyk7XG4gICAgICAgIGxldCByZXMgPSAoYXdhaXQgZ2V0U2Vzc2lvbihzZXNzaW9uLnNlc3Npb25JZCkpLnZhbHVlO1xuICAgICAgICBzaG91bGQuZXhpc3QocmVzLmV2ZW50cyk7XG4gICAgICAgIHNob3VsZC5leGlzdChyZXMuZXZlbnRzLm5ld1Nlc3Npb25SZXF1ZXN0ZWQpO1xuICAgICAgICBzaG91bGQuZXhpc3QocmVzLmV2ZW50cy5uZXdTZXNzaW9uU3RhcnRlZCk7XG4gICAgICAgIHJlcy5ldmVudHMubmV3U2Vzc2lvblJlcXVlc3RlZFswXS5zaG91bGQuYmUuYSgnbnVtYmVyJyk7XG4gICAgICAgIHJlcy5ldmVudHMubmV3U2Vzc2lvblN0YXJ0ZWRbMF0uc2hvdWxkLmJlLmEoJ251bWJlcicpO1xuICAgICAgICBhd2FpdCBlbmRTZXNzaW9uKHNlc3Npb24uc2Vzc2lvbklkKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgZGVzY3JpYmUoJ2V4ZWN1dGUgZHJpdmVyIHNjcmlwdCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIG1vY2sgc29tZSBtZXRob2RzIG9uIEJhc2VEcml2ZXIgdGhhdCBhcmVuJ3Qgbm9ybWFsbHkgdGhlcmUgZXhjZXB0IGluXG4gICAgICAvLyBhIGZ1bGx5IGJsb3duIGRyaXZlclxuICAgICAgbGV0IG9yaWdpbmFsRmluZEVsZW1lbnQsIHNlc3Npb25JZDtcbiAgICAgIGJlZm9yZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIGQuYWxsb3dJbnNlY3VyZSA9IFsnZXhlY3V0ZV9kcml2ZXJfc2NyaXB0J107XG4gICAgICAgIG9yaWdpbmFsRmluZEVsZW1lbnQgPSBkLmZpbmRFbGVtZW50O1xuICAgICAgICBkLmZpbmRFbGVtZW50ID0gKGZ1bmN0aW9uIChzdHJhdGVneSwgc2VsZWN0b3IpIHtcbiAgICAgICAgICBpZiAoc3RyYXRlZ3kgPT09ICdhY2Nlc3NpYmlsaXR5IGlkJyAmJiBzZWxlY3RvciA9PT0gJ2FtYXppbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4ge1tXM0NfRUxFTUVOVF9LRVldOiAnZWxlbWVudC1pZC0xJ307XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5Ob1N1Y2hFbGVtZW50RXJyb3IoJ25vdCBmb3VuZCcpO1xuICAgICAgICB9KS5iaW5kKGQpO1xuICAgICAgfSk7XG5cbiAgICAgIGJlZm9yZUVhY2goYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICAoe3Nlc3Npb25JZH0gPSBhd2FpdCBzdGFydFNlc3Npb24oZGVmYXVsdENhcHMpKTtcbiAgICAgIH0pO1xuXG4gICAgICBhZnRlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGQuZmluZEVsZW1lbnQgPSBvcmlnaW5hbEZpbmRFbGVtZW50O1xuICAgICAgfSk7XG5cbiAgICAgIGFmdGVyRWFjaChhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGF3YWl0IGVuZFNlc3Npb24oc2Vzc2lvbklkKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIG5vdCB3b3JrIHVubGVzcyB0aGUgYWxsb3dJbnNlY3VyZSBmZWF0dXJlIGZsYWcgaXMgc2V0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBkLl9hbGxvd0luc2VjdXJlID0gZC5hbGxvd0luc2VjdXJlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGQuYWxsb3dJbnNlY3VyZSA9IFtdO1xuICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IGByZXR1cm4gJ2ZvbydgO1xuICAgICAgICAgIGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke3Nlc3Npb25JZH0vYXBwaXVtL2V4ZWN1dGVfZHJpdmVyYCxcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgZGF0YToge3NjcmlwdCwgdHlwZTogJ3dkJ30sXG4gICAgICAgICAgfSkuc2hvdWxkLmV2ZW50dWFsbHkuYmUucmVqZWN0ZWQ7XG4gICAgICAgICAgYXdhaXQgZW5kU2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgIGQuYWxsb3dJbnNlY3VyZSA9IGQuX2FsbG93SW5zZWN1cmU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGV4ZWN1dGUgYSB3ZWJkcml2ZXJpbyBzY3JpcHQgaW4gdGhlIGNvbnRleHQgb2Ygc2Vzc2lvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc3Qgc2NyaXB0ID0gYFxuICAgICAgICAgIGNvbnN0IHRpbWVvdXRzID0gYXdhaXQgZHJpdmVyLmdldFRpbWVvdXRzKCk7XG4gICAgICAgICAgY29uc3Qgc3RhdHVzID0gYXdhaXQgZHJpdmVyLnN0YXR1cygpO1xuICAgICAgICAgIHJldHVybiBbdGltZW91dHMsIHN0YXR1c107XG4gICAgICAgIGA7XG4gICAgICAgIGNvbnN0IHt2YWx1ZX0gPSAoYXdhaXQgYXhpb3Moe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke3Nlc3Npb25JZH0vYXBwaXVtL2V4ZWN1dGVfZHJpdmVyYCxcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBkYXRhOiB7c2NyaXB0LCB0eXBlOiAnd2ViZHJpdmVyaW8nfSxcbiAgICAgICAgfSkpLmRhdGE7XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkVGltZW91dHMgPSB7Y29tbWFuZDogMjUwLCBpbXBsaWNpdDogMH07XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkU3RhdHVzID0ge307XG4gICAgICAgIHZhbHVlLnJlc3VsdC5zaG91bGQuZXFsKFtleHBlY3RlZFRpbWVvdXRzLCBleHBlY3RlZFN0YXR1c10pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgZmFpbCB3aXRoIGFueSBzY3JpcHQgdHlwZSBvdGhlciB0aGFuIHdlYmRyaXZlcmlvIGN1cnJlbnRseScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc3Qgc2NyaXB0ID0gYHJldHVybiAnZm9vJ2A7XG4gICAgICAgIGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtzZXNzaW9uSWR9L2FwcGl1bS9leGVjdXRlX2RyaXZlcmAsXG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgZGF0YToge3NjcmlwdCwgdHlwZTogJ3dkJ30sXG4gICAgICAgIH0pLnNob3VsZC5ldmVudHVhbGx5LmJlLnJlamVjdGVkO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgZXhlY3V0ZSBhIHdlYmRyaXZlcmlvIHNjcmlwdCB0aGF0IHJldHVybnMgZWxlbWVudHMgY29ycmVjdGx5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBzY3JpcHQgPSBgXG4gICAgICAgICAgcmV0dXJuIGF3YWl0IGRyaXZlci4kKFwifmFtYXppbmdcIik7XG4gICAgICAgIGA7XG4gICAgICAgIGNvbnN0IHt2YWx1ZX0gPSAoYXdhaXQgYXhpb3Moe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke3Nlc3Npb25JZH0vYXBwaXVtL2V4ZWN1dGVfZHJpdmVyYCxcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBkYXRhOiB7c2NyaXB0fSxcbiAgICAgICAgfSkpLmRhdGE7XG4gICAgICAgIHZhbHVlLnJlc3VsdC5zaG91bGQuZXFsKHtcbiAgICAgICAgICBbVzNDX0VMRU1FTlRfS0VZXTogJ2VsZW1lbnQtaWQtMScsXG4gICAgICAgICAgW01KU09OV1BfRUxFTUVOVF9LRVldOiAnZWxlbWVudC1pZC0xJ1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGV4ZWN1dGUgYSB3ZWJkcml2ZXJpbyBzY3JpcHQgdGhhdCByZXR1cm5zIGVsZW1lbnRzIGluIGRlZXAgc3RydWN0dXJlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBzY3JpcHQgPSBgXG4gICAgICAgICAgY29uc3QgZWwgPSBhd2FpdCBkcml2ZXIuJChcIn5hbWF6aW5nXCIpO1xuICAgICAgICAgIHJldHVybiB7ZWxlbWVudDogZWwsIGVsZW1lbnRzOiBbZWwsIGVsXX07XG4gICAgICAgIGA7XG4gICAgICAgIGNvbnN0IHt2YWx1ZX0gPSAoYXdhaXQgYXhpb3Moe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke3Nlc3Npb25JZH0vYXBwaXVtL2V4ZWN1dGVfZHJpdmVyYCxcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBkYXRhOiB7c2NyaXB0fSxcbiAgICAgICAgfSkpLmRhdGE7XG4gICAgICAgIGNvbnN0IGVsT2JqID0ge1xuICAgICAgICAgIFtXM0NfRUxFTUVOVF9LRVldOiAnZWxlbWVudC1pZC0xJyxcbiAgICAgICAgICBbTUpTT05XUF9FTEVNRU5UX0tFWV06ICdlbGVtZW50LWlkLTEnXG4gICAgICAgIH07XG4gICAgICAgIHZhbHVlLnJlc3VsdC5zaG91bGQuZXFsKHtlbGVtZW50OiBlbE9iaiwgZWxlbWVudHM6IFtlbE9iaiwgZWxPYmpdfSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBzdG9yZSBhbmQgcmV0dXJuIGxvZ3MgdG8gdGhlIHVzZXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdCA9IGBcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImZvb1wiKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImZvbzJcIik7XG4gICAgICAgICAgY29uc29sZS53YXJuKFwiYmFyXCIpO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJiYXpcIik7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIGA7XG4gICAgICAgIGNvbnN0IHt2YWx1ZX0gPSAoYXdhaXQgYXhpb3Moe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke3Nlc3Npb25JZH0vYXBwaXVtL2V4ZWN1dGVfZHJpdmVyYCxcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBkYXRhOiB7c2NyaXB0fSxcbiAgICAgICAgfSkpLmRhdGE7XG4gICAgICAgIHZhbHVlLmxvZ3Muc2hvdWxkLmVxbCh7bG9nOiBbJ2ZvbycsICdmb28yJ10sIHdhcm46IFsnYmFyJ10sIGVycm9yOiBbJ2JheiddfSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBoYXZlIGFwcGl1bSBzcGVjaWZpYyBjb21tYW5kcyBhdmFpbGFibGUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdCA9IGBcbiAgICAgICAgICByZXR1cm4gdHlwZW9mIGRyaXZlci5sb2NrO1xuICAgICAgICBgO1xuICAgICAgICBjb25zdCB7dmFsdWV9ID0gKGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtzZXNzaW9uSWR9L2FwcGl1bS9leGVjdXRlX2RyaXZlcmAsXG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgZGF0YToge3NjcmlwdH0sXG4gICAgICAgIH0pKS5kYXRhO1xuICAgICAgICB2YWx1ZS5yZXN1bHQuc2hvdWxkLmVxbCgnZnVuY3Rpb24nKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGNvcnJlY3RseSBoYW5kbGUgZXJyb3JzIHRoYXQgaGFwcGVuIGluIGEgd2ViZHJpdmVyaW8gc2NyaXB0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBzY3JpcHQgPSBgXG4gICAgICAgICAgcmV0dXJuIGF3YWl0IGRyaXZlci4kKFwifm5vdGZvdW5kXCIpO1xuICAgICAgICBgO1xuICAgICAgICBjb25zdCB7ZGF0YX0gPSBhd2FpdCBheGlvcyh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7c2Vzc2lvbklkfS9hcHBpdW0vZXhlY3V0ZV9kcml2ZXJgLFxuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIHZhbGlkYXRlU3RhdHVzOiBudWxsLFxuICAgICAgICAgIGRhdGE6IHtzY3JpcHR9LFxuICAgICAgICB9KTtcbiAgICAgICAgZGF0YS5zaG91bGQuZXFsKHtcbiAgICAgICAgICBzZXNzaW9uSWQsXG4gICAgICAgICAgc3RhdHVzOiAxMyxcbiAgICAgICAgICB2YWx1ZToge21lc3NhZ2U6ICdBbiB1bmtub3duIHNlcnZlci1zaWRlIGVycm9yIG9jY3VycmVkIHdoaWxlIHByb2Nlc3NpbmcgdGhlIGNvbW1hbmQuIE9yaWdpbmFsIGVycm9yOiBDb3VsZCBub3QgZXhlY3V0ZSBkcml2ZXIgc2NyaXB0LiBPcmlnaW5hbCBlcnJvciB3YXM6IEVycm9yOiBub3QgZm91bmQnfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGNvcnJlY3RseSBoYW5kbGUgZXJyb3JzIHRoYXQgaGFwcGVuIHdoZW4gYSBzY3JpcHQgY2Fubm90IGJlIGNvbXBpbGVkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBzY3JpcHQgPSBgXG4gICAgICAgICAgcmV0dXJuIHs7XG4gICAgICAgIGA7XG4gICAgICAgIGNvbnN0IHtkYXRhfSA9IGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtzZXNzaW9uSWR9L2FwcGl1bS9leGVjdXRlX2RyaXZlcmAsXG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgdmFsaWRhdGVTdGF0dXM6IG51bGwsXG4gICAgICAgICAgZGF0YToge3NjcmlwdH0sXG4gICAgICAgIH0pO1xuICAgICAgICBzZXNzaW9uSWQuc2hvdWxkLmVxbChkYXRhLnNlc3Npb25JZCk7XG4gICAgICAgIGRhdGEuc3RhdHVzLnNob3VsZC5lcWwoMTMpO1xuICAgICAgICBkYXRhLnZhbHVlLnNob3VsZC5oYXZlLnByb3BlcnR5KCdtZXNzYWdlJyk7XG4gICAgICAgIGRhdGEudmFsdWUubWVzc2FnZS5zaG91bGQubWF0Y2goL0FuIHVua25vd24gc2VydmVyLXNpZGUgZXJyb3Igb2NjdXJyZWQgd2hpbGUgcHJvY2Vzc2luZyB0aGUgY29tbWFuZC4gT3JpZ2luYWwgZXJyb3I6IENvdWxkIG5vdCBleGVjdXRlIGRyaXZlciBzY3JpcHQuIE9yaWdpbmFsIGVycm9yIHdhczogRXJyb3I6IFVuZXhwZWN0ZWQgdG9rZW4gJz87Jz8vKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGJlIGFibGUgdG8gc2V0IGEgdGltZW91dCBvbiBhIGRyaXZlciBzY3JpcHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdCA9IGBcbiAgICAgICAgICBhd2FpdCBQcm9taXNlLmRlbGF5KDEwMDApO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICBgO1xuICAgICAgICBjb25zdCB7dmFsdWV9ID0gKGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtzZXNzaW9uSWR9L2FwcGl1bS9leGVjdXRlX2RyaXZlcmAsXG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgdmFsaWRhdGVTdGF0dXM6IG51bGwsXG4gICAgICAgICAgZGF0YToge3NjcmlwdCwgdGltZW91dDogNTB9LFxuICAgICAgICB9KSkuZGF0YTtcbiAgICAgICAgdmFsdWUubWVzc2FnZS5zaG91bGQubWF0Y2goLy4rNTAuK3RpbWVvdXQuKy8pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBiYXNlRHJpdmVyRTJFVGVzdHM7XG4iXSwiZmlsZSI6InRlc3QvYmFzZWRyaXZlci9kcml2ZXItZTJlLXRlc3RzLmpzIiwic291cmNlUm9vdCI6Ii4uLy4uLy4uIn0=
