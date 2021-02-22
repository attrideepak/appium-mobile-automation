#!/usr/bin/env node
"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.MacDriver = void 0;

require("source-map-support/register");

var _yargs = _interopRequireDefault(require("yargs"));

var _asyncbox = require("asyncbox");

var _server = require("./lib/server");

var driver = _interopRequireWildcard(require("./lib/driver"));

const {
  MacDriver
} = driver;
exports.MacDriver = MacDriver;
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 4723;

async function main() {
  let port = _yargs.default.argv.port || DEFAULT_PORT;
  let address = _yargs.default.argv.address || DEFAULT_HOST;
  return await (0, _server.startServer)(port, address);
}

if (require.main === module) {
  (0, _asyncbox.asyncify)(main);
}

var _default = MacDriver;
exports.default = _default;require('source-map-support').install();


//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LmpzIl0sIm5hbWVzIjpbIk1hY0RyaXZlciIsImRyaXZlciIsIkRFRkFVTFRfSE9TVCIsIkRFRkFVTFRfUE9SVCIsIm1haW4iLCJwb3J0IiwieWFyZ3MiLCJhcmd2IiwiYWRkcmVzcyIsInJlcXVpcmUiLCJtb2R1bGUiXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7OztBQUdBOztBQUNBOztBQUNBOztBQUNBOztBQUdBLE1BQU07QUFBRUEsRUFBQUE7QUFBRixJQUFnQkMsTUFBdEI7O0FBRUEsTUFBTUMsWUFBWSxHQUFHLFdBQXJCO0FBQ0EsTUFBTUMsWUFBWSxHQUFHLElBQXJCOztBQUVBLGVBQWVDLElBQWYsR0FBdUI7QUFDckIsTUFBSUMsSUFBSSxHQUFHQyxlQUFNQyxJQUFOLENBQVdGLElBQVgsSUFBbUJGLFlBQTlCO0FBQ0EsTUFBSUssT0FBTyxHQUFHRixlQUFNQyxJQUFOLENBQVdDLE9BQVgsSUFBc0JOLFlBQXBDO0FBQ0EsU0FBTyxNQUFNLHlCQUFZRyxJQUFaLEVBQWtCRyxPQUFsQixDQUFiO0FBQ0Q7O0FBRUQsSUFBSUMsT0FBTyxDQUFDTCxJQUFSLEtBQWlCTSxNQUFyQixFQUE2QjtBQUMzQiwwQkFBU04sSUFBVDtBQUNEOztlQUljSixTIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLy8gdHJhbnNwaWxlOm1haW5cblxuaW1wb3J0IHlhcmdzIGZyb20gJ3lhcmdzJztcbmltcG9ydCB7IGFzeW5jaWZ5IH0gZnJvbSAnYXN5bmNib3gnO1xuaW1wb3J0IHsgc3RhcnRTZXJ2ZXIgfSBmcm9tICcuL2xpYi9zZXJ2ZXInO1xuaW1wb3J0ICogYXMgZHJpdmVyIGZyb20gJy4vbGliL2RyaXZlcic7XG5cblxuY29uc3QgeyBNYWNEcml2ZXIgfSA9IGRyaXZlcjtcblxuY29uc3QgREVGQVVMVF9IT1NUID0gJ2xvY2FsaG9zdCc7XG5jb25zdCBERUZBVUxUX1BPUlQgPSA0NzIzO1xuXG5hc3luYyBmdW5jdGlvbiBtYWluICgpIHtcbiAgbGV0IHBvcnQgPSB5YXJncy5hcmd2LnBvcnQgfHwgREVGQVVMVF9QT1JUO1xuICBsZXQgYWRkcmVzcyA9IHlhcmdzLmFyZ3YuYWRkcmVzcyB8fCBERUZBVUxUX0hPU1Q7XG4gIHJldHVybiBhd2FpdCBzdGFydFNlcnZlcihwb3J0LCBhZGRyZXNzKTtcbn1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIGFzeW5jaWZ5KG1haW4pO1xufVxuXG5leHBvcnQgeyBNYWNEcml2ZXIgfTtcblxuZXhwb3J0IGRlZmF1bHQgTWFjRHJpdmVyO1xuIl0sImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZVJvb3QiOiIuLiJ9
