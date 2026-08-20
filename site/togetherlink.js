#!/usr/bin/env node
// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = import.meta.require;

// packages/cli/src/lib/harness.ts
var HARNESS, ALL_HARNESSES, HARNESS_BIN, HARNESS_LABEL, HARNESS_INSTALL;
var init_harness = __esm(() => {
  HARNESS = {
    CLAUDE: "claude",
    CODEX: "codex",
    DEEPSEEK: "deepseek",
    GROK: "grok",
    HERMES: "hermes",
    OPENCODE: "opencode",
    PI: "pi",
    PRIME: "prime"
  };
  ALL_HARNESSES = [
    HARNESS.CLAUDE,
    HARNESS.CODEX,
    HARNESS.DEEPSEEK,
    HARNESS.GROK,
    HARNESS.HERMES,
    HARNESS.OPENCODE,
    HARNESS.PI,
    HARNESS.PRIME
  ];
  HARNESS_BIN = {
    [HARNESS.CLAUDE]: "claude",
    [HARNESS.CODEX]: "codex",
    [HARNESS.DEEPSEEK]: "dsh",
    [HARNESS.GROK]: "grok",
    [HARNESS.HERMES]: "hermes",
    [HARNESS.OPENCODE]: "opencode",
    [HARNESS.PI]: "pi",
    [HARNESS.PRIME]: "prime-agent"
  };
  HARNESS_LABEL = {
    [HARNESS.CLAUDE]: "Claude Code",
    [HARNESS.CODEX]: "Codex",
    [HARNESS.DEEPSEEK]: "DeepSeek Harness (alpha)",
    [HARNESS.GROK]: "Grok Build",
    [HARNESS.HERMES]: "Hermes Agent",
    [HARNESS.OPENCODE]: "OpenCode",
    [HARNESS.PI]: "Pi Code",
    [HARNESS.PRIME]: "Prime Agent"
  };
  HARNESS_INSTALL = {
    [HARNESS.CLAUDE]: {
      command: "npm install -g @anthropic-ai/claude-code",
      url: "https://docs.anthropic.com/en/docs/claude-code/setup"
    },
    [HARNESS.CODEX]: {
      command: "npm install -g @openai/codex",
      url: "https://github.com/openai/codex"
    },
    [HARNESS.DEEPSEEK]: {
      command: "npm install -g @deepseek-ai/dsh",
      url: "https://github.com/deepseek-ai/deepseek-harness"
    },
    [HARNESS.GROK]: {
      command: "curl -fsSL https://x.ai/cli/install.sh | bash",
      url: "https://github.com/xai-org/grok-build"
    },
    [HARNESS.HERMES]: {
      command: "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash",
      url: "https://hermes-agent.nousresearch.com/docs/"
    },
    [HARNESS.OPENCODE]: {
      command: "npm install -g opencode-ai@latest",
      url: "https://github.com/anomalyco/opencode"
    },
    [HARNESS.PI]: {
      command: "npm install -g --ignore-scripts @earendil-works/pi-coding-agent",
      url: "https://pi.dev/docs/latest/quickstart"
    },
    [HARNESS.PRIME]: {
      command: "curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh",
      url: "https://github.com/PrimeIntellect-ai/prime-agent"
    }
  };
});

// node_modules/.pnpm/sisteransi@1.0.5/node_modules/sisteransi/src/index.js
var require_src = __commonJS((exports, module) => {
  var ESC = "\x1B";
  var CSI = `${ESC}[`;
  var beep = "\x07";
  var cursor = {
    to(x, y) {
      if (!y)
        return `${CSI}${x + 1}G`;
      return `${CSI}${y + 1};${x + 1}H`;
    },
    move(x, y) {
      let ret = "";
      if (x < 0)
        ret += `${CSI}${-x}D`;
      else if (x > 0)
        ret += `${CSI}${x}C`;
      if (y < 0)
        ret += `${CSI}${-y}A`;
      else if (y > 0)
        ret += `${CSI}${y}B`;
      return ret;
    },
    up: (count = 1) => `${CSI}${count}A`,
    down: (count = 1) => `${CSI}${count}B`,
    forward: (count = 1) => `${CSI}${count}C`,
    backward: (count = 1) => `${CSI}${count}D`,
    nextLine: (count = 1) => `${CSI}E`.repeat(count),
    prevLine: (count = 1) => `${CSI}F`.repeat(count),
    left: `${CSI}G`,
    hide: `${CSI}?25l`,
    show: `${CSI}?25h`,
    save: `${ESC}7`,
    restore: `${ESC}8`
  };
  var scroll = {
    up: (count = 1) => `${CSI}S`.repeat(count),
    down: (count = 1) => `${CSI}T`.repeat(count)
  };
  var erase = {
    screen: `${CSI}2J`,
    up: (count = 1) => `${CSI}1J`.repeat(count),
    down: (count = 1) => `${CSI}J`.repeat(count),
    line: `${CSI}2K`,
    lineEnd: `${CSI}K`,
    lineStart: `${CSI}1K`,
    lines(count) {
      let clear = "";
      for (let i = 0;i < count; i++)
        clear += this.line + (i < count - 1 ? cursor.up() : "");
      if (count)
        clear += cursor.left;
      return clear;
    }
  };
  module.exports = { cursor, scroll, erase, beep };
});

// node_modules/.pnpm/picocolors@1.1.1/node_modules/picocolors/picocolors.js
var require_picocolors = __commonJS((exports, module) => {
  var p = process || {};
  var argv = p.argv || [];
  var env = p.env || {};
  var isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
  var formatter = (open, close, replace = open) => (input) => {
    let string = "" + input, index = string.indexOf(close, open.length);
    return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
  };
  var replaceClose = (string, close, replace, index) => {
    let result = "", cursor = 0;
    do {
      result += string.substring(cursor, index) + replace;
      cursor = index + close.length;
      index = string.indexOf(close, cursor);
    } while (~index);
    return result + string.substring(cursor);
  };
  var createColors = (enabled = isColorSupported) => {
    let f = enabled ? formatter : () => String;
    return {
      isColorSupported: enabled,
      reset: f("\x1B[0m", "\x1B[0m"),
      bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
      dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
      italic: f("\x1B[3m", "\x1B[23m"),
      underline: f("\x1B[4m", "\x1B[24m"),
      inverse: f("\x1B[7m", "\x1B[27m"),
      hidden: f("\x1B[8m", "\x1B[28m"),
      strikethrough: f("\x1B[9m", "\x1B[29m"),
      black: f("\x1B[30m", "\x1B[39m"),
      red: f("\x1B[31m", "\x1B[39m"),
      green: f("\x1B[32m", "\x1B[39m"),
      yellow: f("\x1B[33m", "\x1B[39m"),
      blue: f("\x1B[34m", "\x1B[39m"),
      magenta: f("\x1B[35m", "\x1B[39m"),
      cyan: f("\x1B[36m", "\x1B[39m"),
      white: f("\x1B[37m", "\x1B[39m"),
      gray: f("\x1B[90m", "\x1B[39m"),
      bgBlack: f("\x1B[40m", "\x1B[49m"),
      bgRed: f("\x1B[41m", "\x1B[49m"),
      bgGreen: f("\x1B[42m", "\x1B[49m"),
      bgYellow: f("\x1B[43m", "\x1B[49m"),
      bgBlue: f("\x1B[44m", "\x1B[49m"),
      bgMagenta: f("\x1B[45m", "\x1B[49m"),
      bgCyan: f("\x1B[46m", "\x1B[49m"),
      bgWhite: f("\x1B[47m", "\x1B[49m"),
      blackBright: f("\x1B[90m", "\x1B[39m"),
      redBright: f("\x1B[91m", "\x1B[39m"),
      greenBright: f("\x1B[92m", "\x1B[39m"),
      yellowBright: f("\x1B[93m", "\x1B[39m"),
      blueBright: f("\x1B[94m", "\x1B[39m"),
      magentaBright: f("\x1B[95m", "\x1B[39m"),
      cyanBright: f("\x1B[96m", "\x1B[39m"),
      whiteBright: f("\x1B[97m", "\x1B[39m"),
      bgBlackBright: f("\x1B[100m", "\x1B[49m"),
      bgRedBright: f("\x1B[101m", "\x1B[49m"),
      bgGreenBright: f("\x1B[102m", "\x1B[49m"),
      bgYellowBright: f("\x1B[103m", "\x1B[49m"),
      bgBlueBright: f("\x1B[104m", "\x1B[49m"),
      bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
      bgCyanBright: f("\x1B[106m", "\x1B[49m"),
      bgWhiteBright: f("\x1B[107m", "\x1B[49m")
    };
  };
  module.exports = createColors();
  module.exports.createColors = createColors;
});

// node_modules/.pnpm/@clack+core@0.3.5/node_modules/@clack/core/dist/index.mjs
import { stdin as $, stdout as k } from "process";
import * as f from "readline";
import _ from "readline";
import { WriteStream as U } from "tty";
function q({ onlyFirst: e = false } = {}) {
  const F = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?(?:\\u0007|\\u001B\\u005C|\\u009C))", "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))"].join("|");
  return new RegExp(F, e ? undefined : "g");
}
function S(e) {
  if (typeof e != "string")
    throw new TypeError(`Expected a \`string\`, got \`${typeof e}\``);
  return e.replace(J, "");
}
function T(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
function A(e, u = {}) {
  if (typeof e != "string" || e.length === 0 || (u = { ambiguousIsNarrow: true, ...u }, e = S(e), e.length === 0))
    return 0;
  e = e.replace(uD(), "  ");
  const F = u.ambiguousIsNarrow ? 1 : 2;
  let t = 0;
  for (const s of e) {
    const C = s.codePointAt(0);
    if (C <= 31 || C >= 127 && C <= 159 || C >= 768 && C <= 879)
      continue;
    switch (X.eastAsianWidth(s)) {
      case "F":
      case "W":
        t += 2;
        break;
      case "A":
        t += F;
        break;
      default:
        t += 1;
    }
  }
  return t;
}
function tD() {
  const e = new Map;
  for (const [u, F] of Object.entries(r)) {
    for (const [t, s] of Object.entries(F))
      r[t] = { open: `\x1B[${s[0]}m`, close: `\x1B[${s[1]}m` }, F[t] = r[t], e.set(s[0], s[1]);
    Object.defineProperty(r, u, { value: F, enumerable: false });
  }
  return Object.defineProperty(r, "codes", { value: e, enumerable: false }), r.color.close = "\x1B[39m", r.bgColor.close = "\x1B[49m", r.color.ansi = M(), r.color.ansi256 = P(), r.color.ansi16m = W(), r.bgColor.ansi = M(d), r.bgColor.ansi256 = P(d), r.bgColor.ansi16m = W(d), Object.defineProperties(r, { rgbToAnsi256: { value: (u, F, t) => u === F && F === t ? u < 8 ? 16 : u > 248 ? 231 : Math.round((u - 8) / 247 * 24) + 232 : 16 + 36 * Math.round(u / 255 * 5) + 6 * Math.round(F / 255 * 5) + Math.round(t / 255 * 5), enumerable: false }, hexToRgb: { value: (u) => {
    const F = /[a-f\d]{6}|[a-f\d]{3}/i.exec(u.toString(16));
    if (!F)
      return [0, 0, 0];
    let [t] = F;
    t.length === 3 && (t = [...t].map((C) => C + C).join(""));
    const s = Number.parseInt(t, 16);
    return [s >> 16 & 255, s >> 8 & 255, s & 255];
  }, enumerable: false }, hexToAnsi256: { value: (u) => r.rgbToAnsi256(...r.hexToRgb(u)), enumerable: false }, ansi256ToAnsi: { value: (u) => {
    if (u < 8)
      return 30 + u;
    if (u < 16)
      return 90 + (u - 8);
    let F, t, s;
    if (u >= 232)
      F = ((u - 232) * 10 + 8) / 255, t = F, s = F;
    else {
      u -= 16;
      const i = u % 36;
      F = Math.floor(u / 36) / 5, t = Math.floor(i / 6) / 5, s = i % 6 / 5;
    }
    const C = Math.max(F, t, s) * 2;
    if (C === 0)
      return 30;
    let D = 30 + (Math.round(s) << 2 | Math.round(t) << 1 | Math.round(F));
    return C === 2 && (D += 60), D;
  }, enumerable: false }, rgbToAnsi: { value: (u, F, t) => r.ansi256ToAnsi(r.rgbToAnsi256(u, F, t)), enumerable: false }, hexToAnsi: { value: (u) => r.ansi256ToAnsi(r.hexToAnsi256(u)), enumerable: false } }), r;
}
function R(e, u, F) {
  return String(e).normalize().replace(/\r\n/g, `
`).split(`
`).map((t) => oD(t, u, F)).join(`
`);
}
function hD(e, u) {
  if (e === u)
    return;
  const F = e.split(`
`), t = u.split(`
`), s = [];
  for (let C = 0;C < Math.max(F.length, t.length); C++)
    F[C] !== t[C] && s.push(C);
  return s;
}
function lD(e) {
  return e === V;
}
function v(e, u) {
  e.isTTY && e.setRawMode(u);
}

class x {
  constructor({ render: u, input: F = $, output: t = k, ...s }, C = true) {
    a(this, "input"), a(this, "output"), a(this, "rl"), a(this, "opts"), a(this, "_track", false), a(this, "_render"), a(this, "_cursor", 0), a(this, "state", "initial"), a(this, "value"), a(this, "error", ""), a(this, "subscribers", new Map), a(this, "_prevFrame", ""), this.opts = s, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this._render = u.bind(this), this._track = C, this.input = F, this.output = t;
  }
  prompt() {
    const u = new U(0);
    return u._write = (F, t, s) => {
      this._track && (this.value = this.rl.line.replace(/\t/g, ""), this._cursor = this.rl.cursor, this.emit("value", this.value)), s();
    }, this.input.pipe(u), this.rl = _.createInterface({ input: this.input, output: u, tabSize: 2, prompt: "", escapeCodeTimeout: 50 }), _.emitKeypressEvents(this.input, this.rl), this.rl.prompt(), this.opts.initialValue !== undefined && this._track && this.rl.write(this.opts.initialValue), this.input.on("keypress", this.onKeypress), v(this.input, true), this.output.on("resize", this.render), this.render(), new Promise((F, t) => {
      this.once("submit", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), v(this.input, false), F(this.value);
      }), this.once("cancel", () => {
        this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), v(this.input, false), F(V);
      });
    });
  }
  on(u, F) {
    const t = this.subscribers.get(u) ?? [];
    t.push({ cb: F }), this.subscribers.set(u, t);
  }
  once(u, F) {
    const t = this.subscribers.get(u) ?? [];
    t.push({ cb: F, once: true }), this.subscribers.set(u, t);
  }
  emit(u, ...F) {
    const t = this.subscribers.get(u) ?? [], s = [];
    for (const C of t)
      C.cb(...F), C.once && s.push(() => t.splice(t.indexOf(C), 1));
    for (const C of s)
      C();
  }
  unsubscribe() {
    this.subscribers.clear();
  }
  onKeypress(u, F) {
    if (this.state === "error" && (this.state = "active"), F?.name && !this._track && z.has(F.name) && this.emit("cursor", z.get(F.name)), F?.name && xD.has(F.name) && this.emit("cursor", F.name), u && (u.toLowerCase() === "y" || u.toLowerCase() === "n") && this.emit("confirm", u.toLowerCase() === "y"), u === "\t" && this.opts.placeholder && (this.value || (this.rl.write(this.opts.placeholder), this.emit("value", this.opts.placeholder))), u && this.emit("key", u.toLowerCase()), F?.name === "return") {
      if (this.opts.validate) {
        const t = this.opts.validate(this.value);
        t && (this.error = t, this.state = "error", this.rl.write(this.value));
      }
      this.state !== "error" && (this.state = "submit");
    }
    u === "\x03" && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("finalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
  }
  close() {
    this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), v(this.input, false), this.rl.close(), this.emit(`${this.state}`, this.value), this.unsubscribe();
  }
  restoreCursor() {
    const u = R(this._prevFrame, process.stdout.columns, { hard: true }).split(`
`).length - 1;
    this.output.write(import_sisteransi.cursor.move(-999, u * -1));
  }
  render() {
    const u = R(this._render(this) ?? "", process.stdout.columns, { hard: true });
    if (u !== this._prevFrame) {
      if (this.state === "initial")
        this.output.write(import_sisteransi.cursor.hide);
      else {
        const F = hD(this._prevFrame, u);
        if (this.restoreCursor(), F && F?.length === 1) {
          const t = F[0];
          this.output.write(import_sisteransi.cursor.move(0, t)), this.output.write(import_sisteransi.erase.lines(1));
          const s = u.split(`
`);
          this.output.write(s[t]), this._prevFrame = u, this.output.write(import_sisteransi.cursor.move(0, s.length - t - 1));
          return;
        } else if (F && F?.length > 1) {
          const t = F[0];
          this.output.write(import_sisteransi.cursor.move(0, t)), this.output.write(import_sisteransi.erase.down());
          const s = u.split(`
`).slice(t);
          this.output.write(s.join(`
`)), this._prevFrame = u;
          return;
        }
        this.output.write(import_sisteransi.erase.down());
      }
      this.output.write(u), this.state === "initial" && (this.state = "active"), this._prevFrame = u;
    }
  }
}
function OD({ input: e = $, output: u = k, overwrite: F = true, hideCursor: t = true } = {}) {
  const s = f.createInterface({ input: e, output: u, prompt: "", tabSize: 1 });
  f.emitKeypressEvents(e, s), e.isTTY && e.setRawMode(true);
  const C = (D, { name: i }) => {
    if (String(D) === "\x03") {
      t && u.write(import_sisteransi.cursor.show), process.exit(0);
      return;
    }
    if (!F)
      return;
    let n = i === "return" ? 0 : -1, E = i === "return" ? -1 : 0;
    f.moveCursor(u, n, E, () => {
      f.clearLine(u, 1, () => {
        e.once("keypress", C);
      });
    });
  };
  return t && u.write(import_sisteransi.cursor.hide), e.once("keypress", C), () => {
    e.off("keypress", C), t && u.write(import_sisteransi.cursor.show), e.isTTY && !WD && e.setRawMode(false), s.terminal = false, s.close();
  };
}
var import_sisteransi, import_picocolors, J, j, Q, X, DD = function() {
  return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67)\uDB40\uDC7F|(?:\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFC-\uDFFF])|\uD83D\uDC68(?:\uD83C\uDFFB(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|[\u2695\u2696\u2708]\uFE0F|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))?|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])\uFE0F|\u200D(?:(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D[\uDC66\uDC67])|\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC)?|(?:\uD83D\uDC69(?:\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69]))|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC69(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83E\uDDD1(?:\u200D(?:\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDE36\u200D\uD83C\uDF2B|\uD83C\uDFF3\uFE0F\u200D\u26A7|\uD83D\uDC3B\u200D\u2744|(?:(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\uD83C\uDFF4\u200D\u2620|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])\u200D[\u2640\u2642]|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u2600-\u2604\u260E\u2611\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26B0\u26B1\u26C8\u26CF\u26D1\u26D3\u26E9\u26F0\u26F1\u26F4\u26F7\u26F8\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u3030\u303D\u3297\u3299]|\uD83C[\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]|\uD83D[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3])\uFE0F|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDE35\u200D\uD83D\uDCAB|\uD83D\uDE2E\u200D\uD83D\uDCA8|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83E\uDDD1(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83D\uDC69(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF6\uD83C\uDDE6|\uD83C\uDDF4\uD83C\uDDF2|\uD83D\uDC08\u200D\u2B1B|\u2764\uFE0F\u200D(?:\uD83D\uDD25|\uD83E\uDE79)|\uD83D\uDC41\uFE0F|\uD83C\uDFF3\uFE0F|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|[#\*0-9]\uFE0F\u20E3|\u2764\uFE0F|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|\uD83C\uDFF4|(?:[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270C\u270D]|\uD83D[\uDD74\uDD90])(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC08\uDC15\uDC3B\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE2E\uDE35\uDE36\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5]|\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD]|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF]|[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0D\uDD0E\uDD10-\uDD17\uDD1D\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78\uDD7A-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCB\uDDD0\uDDE0-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6]|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26A7\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5-\uDED7\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDD77\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
}, uD, d = 10, M = (e = 0) => (u) => `\x1B[${u + e}m`, P = (e = 0) => (u) => `\x1B[${38 + e};5;${u}m`, W = (e = 0) => (u, F, t) => `\x1B[${38 + e};2;${u};${F};${t}m`, r, FD, eD, sD, g, CD = 39, b = "\x07", O = "[", iD = "]", I = "m", w, N = (e) => `${g.values().next().value}${O}${e}${I}`, L = (e) => `${g.values().next().value}${w}${e}${b}`, rD = (e) => e.split(" ").map((u) => A(u)), y = (e, u, F) => {
  const t = [...u];
  let s = false, C = false, D = A(S(e[e.length - 1]));
  for (const [i, n] of t.entries()) {
    const E = A(n);
    if (D + E <= F ? e[e.length - 1] += n : (e.push(n), D = 0), g.has(n) && (s = true, C = t.slice(i + 1).join("").startsWith(w)), s) {
      C ? n === b && (s = false, C = false) : n === I && (s = false);
      continue;
    }
    D += E, D === F && i < t.length - 1 && (e.push(""), D = 0);
  }
  !D && e[e.length - 1].length > 0 && e.length > 1 && (e[e.length - 2] += e.pop());
}, ED = (e) => {
  const u = e.split(" ");
  let F = u.length;
  for (;F > 0 && !(A(u[F - 1]) > 0); )
    F--;
  return F === u.length ? e : u.slice(0, F).join(" ") + u.slice(F).join("");
}, oD = (e, u, F = {}) => {
  if (F.trim !== false && e.trim() === "")
    return "";
  let t = "", s, C;
  const D = rD(e);
  let i = [""];
  for (const [E, h] of e.split(" ").entries()) {
    F.trim !== false && (i[i.length - 1] = i[i.length - 1].trimStart());
    let o = A(i[i.length - 1]);
    if (E !== 0 && (o >= u && (F.wordWrap === false || F.trim === false) && (i.push(""), o = 0), (o > 0 || F.trim === false) && (i[i.length - 1] += " ", o++)), F.hard && D[E] > u) {
      const B = u - o, p = 1 + Math.floor((D[E] - B - 1) / u);
      Math.floor((D[E] - 1) / u) < p && i.push(""), y(i, h, u);
      continue;
    }
    if (o + D[E] > u && o > 0 && D[E] > 0) {
      if (F.wordWrap === false && o < u) {
        y(i, h, u);
        continue;
      }
      i.push("");
    }
    if (o + D[E] > u && F.wordWrap === false) {
      y(i, h, u);
      continue;
    }
    i[i.length - 1] += h;
  }
  F.trim !== false && (i = i.map((E) => ED(E)));
  const n = [...i.join(`
`)];
  for (const [E, h] of n.entries()) {
    if (t += h, g.has(h)) {
      const { groups: B } = new RegExp(`(?:\\${O}(?<code>\\d+)m|\\${w}(?<uri>.*)${b})`).exec(n.slice(E).join("")) || { groups: {} };
      if (B.code !== undefined) {
        const p = Number.parseFloat(B.code);
        s = p === CD ? undefined : p;
      } else
        B.uri !== undefined && (C = B.uri.length === 0 ? undefined : B.uri);
    }
    const o = sD.codes.get(Number(s));
    n[E + 1] === `
` ? (C && (t += L("")), s && o && (t += N(o))) : h === `
` && (s && o && (t += N(s)), C && (t += L(C)));
  }
  return t;
}, nD, aD = (e, u, F) => (u in e) ? nD(e, u, { enumerable: true, configurable: true, writable: true, value: F }) : e[u] = F, a = (e, u, F) => (aD(e, typeof u != "symbol" ? u + "" : u, F), F), V, z, xD, BD, cD, AD = (e, u, F) => (u in e) ? cD(e, u, { enumerable: true, configurable: true, writable: true, value: F }) : e[u] = F, G = (e, u, F) => (AD(e, typeof u != "symbol" ? u + "" : u, F), F), pD, fD, gD = (e, u, F) => (u in e) ? fD(e, u, { enumerable: true, configurable: true, writable: true, value: F }) : e[u] = F, K = (e, u, F) => (gD(e, typeof u != "symbol" ? u + "" : u, F), F), vD, mD, dD = (e, u, F) => (u in e) ? mD(e, u, { enumerable: true, configurable: true, writable: true, value: F }) : e[u] = F, Y = (e, u, F) => (dD(e, typeof u != "symbol" ? u + "" : u, F), F), bD, wD, yD = (e, u, F) => (u in e) ? wD(e, u, { enumerable: true, configurable: true, writable: true, value: F }) : e[u] = F, Z = (e, u, F) => (yD(e, typeof u != "symbol" ? u + "" : u, F), F), $D, kD, _D = (e, u, F) => (u in e) ? kD(e, u, { enumerable: true, configurable: true, writable: true, value: F }) : e[u] = F, H = (e, u, F) => (_D(e, typeof u != "symbol" ? u + "" : u, F), F), SD, TD, jD = (e, u, F) => (u in e) ? TD(e, u, { enumerable: true, configurable: true, writable: true, value: F }) : e[u] = F, MD = (e, u, F) => (jD(e, typeof u != "symbol" ? u + "" : u, F), F), PD, WD;
var init_dist = __esm(() => {
  import_sisteransi = __toESM(require_src(), 1);
  import_picocolors = __toESM(require_picocolors(), 1);
  J = q();
  j = { exports: {} };
  (function(e) {
    var u = {};
    e.exports = u, u.eastAsianWidth = function(t) {
      var s = t.charCodeAt(0), C = t.length == 2 ? t.charCodeAt(1) : 0, D = s;
      return 55296 <= s && s <= 56319 && 56320 <= C && C <= 57343 && (s &= 1023, C &= 1023, D = s << 10 | C, D += 65536), D == 12288 || 65281 <= D && D <= 65376 || 65504 <= D && D <= 65510 ? "F" : D == 8361 || 65377 <= D && D <= 65470 || 65474 <= D && D <= 65479 || 65482 <= D && D <= 65487 || 65490 <= D && D <= 65495 || 65498 <= D && D <= 65500 || 65512 <= D && D <= 65518 ? "H" : 4352 <= D && D <= 4447 || 4515 <= D && D <= 4519 || 4602 <= D && D <= 4607 || 9001 <= D && D <= 9002 || 11904 <= D && D <= 11929 || 11931 <= D && D <= 12019 || 12032 <= D && D <= 12245 || 12272 <= D && D <= 12283 || 12289 <= D && D <= 12350 || 12353 <= D && D <= 12438 || 12441 <= D && D <= 12543 || 12549 <= D && D <= 12589 || 12593 <= D && D <= 12686 || 12688 <= D && D <= 12730 || 12736 <= D && D <= 12771 || 12784 <= D && D <= 12830 || 12832 <= D && D <= 12871 || 12880 <= D && D <= 13054 || 13056 <= D && D <= 19903 || 19968 <= D && D <= 42124 || 42128 <= D && D <= 42182 || 43360 <= D && D <= 43388 || 44032 <= D && D <= 55203 || 55216 <= D && D <= 55238 || 55243 <= D && D <= 55291 || 63744 <= D && D <= 64255 || 65040 <= D && D <= 65049 || 65072 <= D && D <= 65106 || 65108 <= D && D <= 65126 || 65128 <= D && D <= 65131 || 110592 <= D && D <= 110593 || 127488 <= D && D <= 127490 || 127504 <= D && D <= 127546 || 127552 <= D && D <= 127560 || 127568 <= D && D <= 127569 || 131072 <= D && D <= 194367 || 177984 <= D && D <= 196605 || 196608 <= D && D <= 262141 ? "W" : 32 <= D && D <= 126 || 162 <= D && D <= 163 || 165 <= D && D <= 166 || D == 172 || D == 175 || 10214 <= D && D <= 10221 || 10629 <= D && D <= 10630 ? "Na" : D == 161 || D == 164 || 167 <= D && D <= 168 || D == 170 || 173 <= D && D <= 174 || 176 <= D && D <= 180 || 182 <= D && D <= 186 || 188 <= D && D <= 191 || D == 198 || D == 208 || 215 <= D && D <= 216 || 222 <= D && D <= 225 || D == 230 || 232 <= D && D <= 234 || 236 <= D && D <= 237 || D == 240 || 242 <= D && D <= 243 || 247 <= D && D <= 250 || D == 252 || D == 254 || D == 257 || D == 273 || D == 275 || D == 283 || 294 <= D && D <= 295 || D == 299 || 305 <= D && D <= 307 || D == 312 || 319 <= D && D <= 322 || D == 324 || 328 <= D && D <= 331 || D == 333 || 338 <= D && D <= 339 || 358 <= D && D <= 359 || D == 363 || D == 462 || D == 464 || D == 466 || D == 468 || D == 470 || D == 472 || D == 474 || D == 476 || D == 593 || D == 609 || D == 708 || D == 711 || 713 <= D && D <= 715 || D == 717 || D == 720 || 728 <= D && D <= 731 || D == 733 || D == 735 || 768 <= D && D <= 879 || 913 <= D && D <= 929 || 931 <= D && D <= 937 || 945 <= D && D <= 961 || 963 <= D && D <= 969 || D == 1025 || 1040 <= D && D <= 1103 || D == 1105 || D == 8208 || 8211 <= D && D <= 8214 || 8216 <= D && D <= 8217 || 8220 <= D && D <= 8221 || 8224 <= D && D <= 8226 || 8228 <= D && D <= 8231 || D == 8240 || 8242 <= D && D <= 8243 || D == 8245 || D == 8251 || D == 8254 || D == 8308 || D == 8319 || 8321 <= D && D <= 8324 || D == 8364 || D == 8451 || D == 8453 || D == 8457 || D == 8467 || D == 8470 || 8481 <= D && D <= 8482 || D == 8486 || D == 8491 || 8531 <= D && D <= 8532 || 8539 <= D && D <= 8542 || 8544 <= D && D <= 8555 || 8560 <= D && D <= 8569 || D == 8585 || 8592 <= D && D <= 8601 || 8632 <= D && D <= 8633 || D == 8658 || D == 8660 || D == 8679 || D == 8704 || 8706 <= D && D <= 8707 || 8711 <= D && D <= 8712 || D == 8715 || D == 8719 || D == 8721 || D == 8725 || D == 8730 || 8733 <= D && D <= 8736 || D == 8739 || D == 8741 || 8743 <= D && D <= 8748 || D == 8750 || 8756 <= D && D <= 8759 || 8764 <= D && D <= 8765 || D == 8776 || D == 8780 || D == 8786 || 8800 <= D && D <= 8801 || 8804 <= D && D <= 8807 || 8810 <= D && D <= 8811 || 8814 <= D && D <= 8815 || 8834 <= D && D <= 8835 || 8838 <= D && D <= 8839 || D == 8853 || D == 8857 || D == 8869 || D == 8895 || D == 8978 || 9312 <= D && D <= 9449 || 9451 <= D && D <= 9547 || 9552 <= D && D <= 9587 || 9600 <= D && D <= 9615 || 9618 <= D && D <= 9621 || 9632 <= D && D <= 9633 || 9635 <= D && D <= 9641 || 9650 <= D && D <= 9651 || 9654 <= D && D <= 9655 || 9660 <= D && D <= 9661 || 9664 <= D && D <= 9665 || 9670 <= D && D <= 9672 || D == 9675 || 9678 <= D && D <= 9681 || 9698 <= D && D <= 9701 || D == 9711 || 9733 <= D && D <= 9734 || D == 9737 || 9742 <= D && D <= 9743 || 9748 <= D && D <= 9749 || D == 9756 || D == 9758 || D == 9792 || D == 9794 || 9824 <= D && D <= 9825 || 9827 <= D && D <= 9829 || 9831 <= D && D <= 9834 || 9836 <= D && D <= 9837 || D == 9839 || 9886 <= D && D <= 9887 || 9918 <= D && D <= 9919 || 9924 <= D && D <= 9933 || 9935 <= D && D <= 9953 || D == 9955 || 9960 <= D && D <= 9983 || D == 10045 || D == 10071 || 10102 <= D && D <= 10111 || 11093 <= D && D <= 11097 || 12872 <= D && D <= 12879 || 57344 <= D && D <= 63743 || 65024 <= D && D <= 65039 || D == 65533 || 127232 <= D && D <= 127242 || 127248 <= D && D <= 127277 || 127280 <= D && D <= 127337 || 127344 <= D && D <= 127386 || 917760 <= D && D <= 917999 || 983040 <= D && D <= 1048573 || 1048576 <= D && D <= 1114109 ? "A" : "N";
    }, u.characterLength = function(t) {
      var s = this.eastAsianWidth(t);
      return s == "F" || s == "W" || s == "A" ? 2 : 1;
    };
    function F(t) {
      return t.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF]/g) || [];
    }
    u.length = function(t) {
      for (var s = F(t), C = 0, D = 0;D < s.length; D++)
        C = C + this.characterLength(s[D]);
      return C;
    }, u.slice = function(t, s, C) {
      textLen = u.length(t), s = s || 0, C = C || 1, s < 0 && (s = textLen + s), C < 0 && (C = textLen + C);
      for (var D = "", i = 0, n = F(t), E = 0;E < n.length; E++) {
        var h = n[E], o = u.length(h);
        if (i >= s - (o == 2 ? 1 : 0))
          if (i + o <= C)
            D += h;
          else
            break;
        i += o;
      }
      return D;
    };
  })(j);
  Q = j.exports;
  X = T(Q);
  uD = T(DD);
  r = { modifier: { reset: [0, 0], bold: [1, 22], dim: [2, 22], italic: [3, 23], underline: [4, 24], overline: [53, 55], inverse: [7, 27], hidden: [8, 28], strikethrough: [9, 29] }, color: { black: [30, 39], red: [31, 39], green: [32, 39], yellow: [33, 39], blue: [34, 39], magenta: [35, 39], cyan: [36, 39], white: [37, 39], blackBright: [90, 39], gray: [90, 39], grey: [90, 39], redBright: [91, 39], greenBright: [92, 39], yellowBright: [93, 39], blueBright: [94, 39], magentaBright: [95, 39], cyanBright: [96, 39], whiteBright: [97, 39] }, bgColor: { bgBlack: [40, 49], bgRed: [41, 49], bgGreen: [42, 49], bgYellow: [43, 49], bgBlue: [44, 49], bgMagenta: [45, 49], bgCyan: [46, 49], bgWhite: [47, 49], bgBlackBright: [100, 49], bgGray: [100, 49], bgGrey: [100, 49], bgRedBright: [101, 49], bgGreenBright: [102, 49], bgYellowBright: [103, 49], bgBlueBright: [104, 49], bgMagentaBright: [105, 49], bgCyanBright: [106, 49], bgWhiteBright: [107, 49] } };
  Object.keys(r.modifier);
  FD = Object.keys(r.color);
  eD = Object.keys(r.bgColor);
  [...FD];
  sD = tD();
  g = new Set(["\x1B", "\x9B"]);
  w = `${iD}8;;`;
  nD = Object.defineProperty;
  V = Symbol("clack:cancel");
  z = new Map([["k", "up"], ["j", "down"], ["h", "left"], ["l", "right"]]);
  xD = new Set(["up", "down", "left", "right", "space", "enter"]);
  BD = class BD extends x {
    get cursor() {
      return this.value ? 0 : 1;
    }
    get _value() {
      return this.cursor === 0;
    }
    constructor(u) {
      super(u, false), this.value = !!u.initialValue, this.on("value", () => {
        this.value = this._value;
      }), this.on("confirm", (F) => {
        this.output.write(import_sisteransi.cursor.move(0, -1)), this.value = F, this.state = "submit", this.close();
      }), this.on("cursor", () => {
        this.value = !this.value;
      });
    }
  };
  cD = Object.defineProperty;
  pD = class pD extends x {
    constructor(u) {
      super(u, false), G(this, "options"), G(this, "cursor", 0);
      const { options: F } = u;
      this.options = Object.entries(F).flatMap(([t, s]) => [{ value: t, group: true, label: t }, ...s.map((C) => ({ ...C, group: t }))]), this.value = [...u.initialValues ?? []], this.cursor = Math.max(this.options.findIndex(({ value: t }) => t === u.cursorAt), 0), this.on("cursor", (t) => {
        switch (t) {
          case "left":
          case "up":
            this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1;
            break;
          case "down":
          case "right":
            this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1;
            break;
          case "space":
            this.toggleValue();
            break;
        }
      });
    }
    getGroupItems(u) {
      return this.options.filter((F) => F.group === u);
    }
    isGroupSelected(u) {
      return this.getGroupItems(u).every((F) => this.value.includes(F.value));
    }
    toggleValue() {
      const u = this.options[this.cursor];
      if (u.group === true) {
        const F = u.value, t = this.getGroupItems(F);
        this.isGroupSelected(F) ? this.value = this.value.filter((s) => t.findIndex((C) => C.value === s) === -1) : this.value = [...this.value, ...t.map((s) => s.value)], this.value = Array.from(new Set(this.value));
      } else {
        const F = this.value.includes(u.value);
        this.value = F ? this.value.filter((t) => t !== u.value) : [...this.value, u.value];
      }
    }
  };
  fD = Object.defineProperty;
  vD = class extends x {
    constructor(u) {
      super(u, false), K(this, "options"), K(this, "cursor", 0), this.options = u.options, this.value = [...u.initialValues ?? []], this.cursor = Math.max(this.options.findIndex(({ value: F }) => F === u.cursorAt), 0), this.on("key", (F) => {
        F === "a" && this.toggleAll();
      }), this.on("cursor", (F) => {
        switch (F) {
          case "left":
          case "up":
            this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1;
            break;
          case "down":
          case "right":
            this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1;
            break;
          case "space":
            this.toggleValue();
            break;
        }
      });
    }
    get _value() {
      return this.options[this.cursor].value;
    }
    toggleAll() {
      const u = this.value.length === this.options.length;
      this.value = u ? [] : this.options.map((F) => F.value);
    }
    toggleValue() {
      const u = this.value.includes(this._value);
      this.value = u ? this.value.filter((F) => F !== this._value) : [...this.value, this._value];
    }
  };
  mD = Object.defineProperty;
  bD = class bD extends x {
    constructor({ mask: u, ...F }) {
      super(F), Y(this, "valueWithCursor", ""), Y(this, "_mask", "\u2022"), this._mask = u ?? "\u2022", this.on("finalize", () => {
        this.valueWithCursor = this.masked;
      }), this.on("value", () => {
        if (this.cursor >= this.value.length)
          this.valueWithCursor = `${this.masked}${import_picocolors.default.inverse(import_picocolors.default.hidden("_"))}`;
        else {
          const t = this.masked.slice(0, this.cursor), s = this.masked.slice(this.cursor);
          this.valueWithCursor = `${t}${import_picocolors.default.inverse(s[0])}${s.slice(1)}`;
        }
      });
    }
    get cursor() {
      return this._cursor;
    }
    get masked() {
      return this.value.replaceAll(/./g, this._mask);
    }
  };
  wD = Object.defineProperty;
  $D = class extends x {
    constructor(u) {
      super(u, false), Z(this, "options"), Z(this, "cursor", 0), this.options = u.options, this.cursor = this.options.findIndex(({ value: F }) => F === u.initialValue), this.cursor === -1 && (this.cursor = 0), this.changeValue(), this.on("cursor", (F) => {
        switch (F) {
          case "left":
          case "up":
            this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1;
            break;
          case "down":
          case "right":
            this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1;
            break;
        }
        this.changeValue();
      });
    }
    get _value() {
      return this.options[this.cursor];
    }
    changeValue() {
      this.value = this._value.value;
    }
  };
  kD = Object.defineProperty;
  SD = class SD extends x {
    constructor(u) {
      super(u, false), H(this, "options"), H(this, "cursor", 0), this.options = u.options;
      const F = this.options.map(({ value: [t] }) => t?.toLowerCase());
      this.cursor = Math.max(F.indexOf(u.initialValue), 0), this.on("key", (t) => {
        if (!F.includes(t))
          return;
        const s = this.options.find(({ value: [C] }) => C?.toLowerCase() === t);
        s && (this.value = s.value, this.state = "submit", this.emit("submit"));
      });
    }
  };
  TD = Object.defineProperty;
  PD = class PD extends x {
    constructor(u) {
      super(u), MD(this, "valueWithCursor", ""), this.on("finalize", () => {
        this.value || (this.value = u.defaultValue), this.valueWithCursor = this.value;
      }), this.on("value", () => {
        if (this.cursor >= this.value.length)
          this.valueWithCursor = `${this.value}${import_picocolors.default.inverse(import_picocolors.default.hidden("_"))}`;
        else {
          const F = this.value.slice(0, this.cursor), t = this.value.slice(this.cursor);
          this.valueWithCursor = `${F}${import_picocolors.default.inverse(t[0])}${t.slice(1)}`;
        }
      });
    }
    get cursor() {
      return this._cursor;
    }
  };
  WD = globalThis.process.platform.startsWith("win");
});

// node_modules/.pnpm/@clack+prompts@0.8.2/node_modules/@clack/prompts/dist/index.mjs
var exports_dist = {};
__export(exports_dist, {
  text: () => ae,
  tasks: () => we,
  spinner: () => _2,
  selectKey: () => ue,
  select: () => le,
  password: () => oe,
  outro: () => ge,
  note: () => me,
  multiselect: () => $e,
  log: () => v2,
  isCancel: () => lD,
  intro: () => pe,
  groupMultiselect: () => de,
  group: () => ve,
  confirm: () => ce,
  cancel: () => he
});
import h from "process";
function K2() {
  return h.platform !== "win32" ? h.env.TERM !== "linux" : !!h.env.CI || !!h.env.WT_SESSION || !!h.env.TERMINUS_SUBLIME || h.env.ConEmuTask === "{cmd::Cmder}" || h.env.TERM_PROGRAM === "Terminus-Sublime" || h.env.TERM_PROGRAM === "vscode" || h.env.TERM === "xterm-256color" || h.env.TERM === "alacritty" || h.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
function ye() {
  const s = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)", "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))"].join("|");
  return new RegExp(s, "g");
}
var import_picocolors2, import_sisteransi2, C, u = (s, n) => C ? s : n, Y2, P2, V2, M2, Q2, a2, $2, I2, T2, j2, b2, B, X2, G2, H2, ee, te, se, re, ie, ne, y2 = (s) => {
  switch (s) {
    case "initial":
    case "active":
      return import_picocolors2.default.cyan(Y2);
    case "cancel":
      return import_picocolors2.default.red(P2);
    case "error":
      return import_picocolors2.default.yellow(V2);
    case "submit":
      return import_picocolors2.default.green(M2);
  }
}, E = (s) => {
  const { cursor: n, options: t, style: i } = s, r2 = s.maxItems ?? 1 / 0, o = Math.max(process.stdout.rows - 4, 0), c2 = Math.min(o, Math.max(r2, 5));
  let l2 = 0;
  n >= l2 + c2 - 3 ? l2 = Math.max(Math.min(n - c2 + 3, t.length - c2), 0) : n < l2 + 2 && (l2 = Math.max(n - 2, 0));
  const d2 = c2 < t.length && l2 > 0, p = c2 < t.length && l2 + c2 < t.length;
  return t.slice(l2, l2 + c2).map((S2, f2, x2) => {
    const g2 = f2 === 0 && d2, m2 = f2 === x2.length - 1 && p;
    return g2 || m2 ? import_picocolors2.default.dim("...") : i(S2, f2 + l2 === n);
  });
}, ae = (s) => new PD({ validate: s.validate, placeholder: s.placeholder, defaultValue: s.defaultValue, initialValue: s.initialValue, render() {
  const n = `${import_picocolors2.default.gray(a2)}
${y2(this.state)}  ${s.message}
`, t = s.placeholder ? import_picocolors2.default.inverse(s.placeholder[0]) + import_picocolors2.default.dim(s.placeholder.slice(1)) : import_picocolors2.default.inverse(import_picocolors2.default.hidden("_")), i = this.value ? this.valueWithCursor : t;
  switch (this.state) {
    case "error":
      return `${n.trim()}
${import_picocolors2.default.yellow(a2)}  ${i}
${import_picocolors2.default.yellow($2)}  ${import_picocolors2.default.yellow(this.error)}
`;
    case "submit":
      return `${n}${import_picocolors2.default.gray(a2)}  ${import_picocolors2.default.dim(this.value || s.placeholder)}`;
    case "cancel":
      return `${n}${import_picocolors2.default.gray(a2)}  ${import_picocolors2.default.strikethrough(import_picocolors2.default.dim(this.value ?? ""))}${this.value?.trim() ? `
` + import_picocolors2.default.gray(a2) : ""}`;
    default:
      return `${n}${import_picocolors2.default.cyan(a2)}  ${i}
${import_picocolors2.default.cyan($2)}
`;
  }
} }).prompt(), oe = (s) => new bD({ validate: s.validate, mask: s.mask ?? X2, render() {
  const n = `${import_picocolors2.default.gray(a2)}
${y2(this.state)}  ${s.message}
`, t = this.valueWithCursor, i = this.masked;
  switch (this.state) {
    case "error":
      return `${n.trim()}
${import_picocolors2.default.yellow(a2)}  ${i}
${import_picocolors2.default.yellow($2)}  ${import_picocolors2.default.yellow(this.error)}
`;
    case "submit":
      return `${n}${import_picocolors2.default.gray(a2)}  ${import_picocolors2.default.dim(i)}`;
    case "cancel":
      return `${n}${import_picocolors2.default.gray(a2)}  ${import_picocolors2.default.strikethrough(import_picocolors2.default.dim(i ?? ""))}${i ? `
` + import_picocolors2.default.gray(a2) : ""}`;
    default:
      return `${n}${import_picocolors2.default.cyan(a2)}  ${t}
${import_picocolors2.default.cyan($2)}
`;
  }
} }).prompt(), ce = (s) => {
  const n = s.active ?? "Yes", t = s.inactive ?? "No";
  return new BD({ active: n, inactive: t, initialValue: s.initialValue ?? true, render() {
    const i = `${import_picocolors2.default.gray(a2)}
${y2(this.state)}  ${s.message}
`, r2 = this.value ? n : t;
    switch (this.state) {
      case "submit":
        return `${i}${import_picocolors2.default.gray(a2)}  ${import_picocolors2.default.dim(r2)}`;
      case "cancel":
        return `${i}${import_picocolors2.default.gray(a2)}  ${import_picocolors2.default.strikethrough(import_picocolors2.default.dim(r2))}
${import_picocolors2.default.gray(a2)}`;
      default:
        return `${i}${import_picocolors2.default.cyan(a2)}  ${this.value ? `${import_picocolors2.default.green(I2)} ${n}` : `${import_picocolors2.default.dim(T2)} ${import_picocolors2.default.dim(n)}`} ${import_picocolors2.default.dim("/")} ${this.value ? `${import_picocolors2.default.dim(T2)} ${import_picocolors2.default.dim(t)}` : `${import_picocolors2.default.green(I2)} ${t}`}
${import_picocolors2.default.cyan($2)}
`;
    }
  } }).prompt();
}, le = (s) => {
  const n = (t, i) => {
    const r2 = t.label ?? String(t.value);
    switch (i) {
      case "selected":
        return `${import_picocolors2.default.dim(r2)}`;
      case "active":
        return `${import_picocolors2.default.green(I2)} ${r2} ${t.hint ? import_picocolors2.default.dim(`(${t.hint})`) : ""}`;
      case "cancelled":
        return `${import_picocolors2.default.strikethrough(import_picocolors2.default.dim(r2))}`;
      default:
        return `${import_picocolors2.default.dim(T2)} ${import_picocolors2.default.dim(r2)}`;
    }
  };
  return new $D({ options: s.options, initialValue: s.initialValue, render() {
    const t = `${import_picocolors2.default.gray(a2)}
${y2(this.state)}  ${s.message}
`;
    switch (this.state) {
      case "submit":
        return `${t}${import_picocolors2.default.gray(a2)}  ${n(this.options[this.cursor], "selected")}`;
      case "cancel":
        return `${t}${import_picocolors2.default.gray(a2)}  ${n(this.options[this.cursor], "cancelled")}
${import_picocolors2.default.gray(a2)}`;
      default:
        return `${t}${import_picocolors2.default.cyan(a2)}  ${E({ cursor: this.cursor, options: this.options, maxItems: s.maxItems, style: (i, r2) => n(i, r2 ? "active" : "inactive") }).join(`
${import_picocolors2.default.cyan(a2)}  `)}
${import_picocolors2.default.cyan($2)}
`;
    }
  } }).prompt();
}, ue = (s) => {
  const n = (t, i = "inactive") => {
    const r2 = t.label ?? String(t.value);
    return i === "selected" ? `${import_picocolors2.default.dim(r2)}` : i === "cancelled" ? `${import_picocolors2.default.strikethrough(import_picocolors2.default.dim(r2))}` : i === "active" ? `${import_picocolors2.default.bgCyan(import_picocolors2.default.gray(` ${t.value} `))} ${r2} ${t.hint ? import_picocolors2.default.dim(`(${t.hint})`) : ""}` : `${import_picocolors2.default.gray(import_picocolors2.default.bgWhite(import_picocolors2.default.inverse(` ${t.value} `)))} ${r2} ${t.hint ? import_picocolors2.default.dim(`(${t.hint})`) : ""}`;
  };
  return new SD({ options: s.options, initialValue: s.initialValue, render() {
    const t = `${import_picocolors2.default.gray(a2)}
${y2(this.state)}  ${s.message}
`;
    switch (this.state) {
      case "submit":
        return `${t}${import_picocolors2.default.gray(a2)}  ${n(this.options.find((i) => i.value === this.value), "selected")}`;
      case "cancel":
        return `${t}${import_picocolors2.default.gray(a2)}  ${n(this.options[0], "cancelled")}
${import_picocolors2.default.gray(a2)}`;
      default:
        return `${t}${import_picocolors2.default.cyan(a2)}  ${this.options.map((i, r2) => n(i, r2 === this.cursor ? "active" : "inactive")).join(`
${import_picocolors2.default.cyan(a2)}  `)}
${import_picocolors2.default.cyan($2)}
`;
    }
  } }).prompt();
}, $e = (s) => {
  const n = (t, i) => {
    const r2 = t.label ?? String(t.value);
    return i === "active" ? `${import_picocolors2.default.cyan(j2)} ${r2} ${t.hint ? import_picocolors2.default.dim(`(${t.hint})`) : ""}` : i === "selected" ? `${import_picocolors2.default.green(b2)} ${import_picocolors2.default.dim(r2)}` : i === "cancelled" ? `${import_picocolors2.default.strikethrough(import_picocolors2.default.dim(r2))}` : i === "active-selected" ? `${import_picocolors2.default.green(b2)} ${r2} ${t.hint ? import_picocolors2.default.dim(`(${t.hint})`) : ""}` : i === "submitted" ? `${import_picocolors2.default.dim(r2)}` : `${import_picocolors2.default.dim(B)} ${import_picocolors2.default.dim(r2)}`;
  };
  return new vD({ options: s.options, initialValues: s.initialValues, required: s.required ?? true, cursorAt: s.cursorAt, validate(t) {
    if (this.required && t.length === 0)
      return `Please select at least one option.
${import_picocolors2.default.reset(import_picocolors2.default.dim(`Press ${import_picocolors2.default.gray(import_picocolors2.default.bgWhite(import_picocolors2.default.inverse(" space ")))} to select, ${import_picocolors2.default.gray(import_picocolors2.default.bgWhite(import_picocolors2.default.inverse(" enter ")))} to submit`))}`;
  }, render() {
    let t = `${import_picocolors2.default.gray(a2)}
${y2(this.state)}  ${s.message}
`;
    const i = (r2, o) => {
      const c2 = this.value.includes(r2.value);
      return o && c2 ? n(r2, "active-selected") : c2 ? n(r2, "selected") : n(r2, o ? "active" : "inactive");
    };
    switch (this.state) {
      case "submit":
        return `${t}${import_picocolors2.default.gray(a2)}  ${this.options.filter(({ value: r2 }) => this.value.includes(r2)).map((r2) => n(r2, "submitted")).join(import_picocolors2.default.dim(", ")) || import_picocolors2.default.dim("none")}`;
      case "cancel": {
        const r2 = this.options.filter(({ value: o }) => this.value.includes(o)).map((o) => n(o, "cancelled")).join(import_picocolors2.default.dim(", "));
        return `${t}${import_picocolors2.default.gray(a2)}  ${r2.trim() ? `${r2}
${import_picocolors2.default.gray(a2)}` : ""}`;
      }
      case "error": {
        const r2 = this.error.split(`
`).map((o, c2) => c2 === 0 ? `${import_picocolors2.default.yellow($2)}  ${import_picocolors2.default.yellow(o)}` : `   ${o}`).join(`
`);
        return t + import_picocolors2.default.yellow(a2) + "  " + E({ options: this.options, cursor: this.cursor, maxItems: s.maxItems, style: i }).join(`
${import_picocolors2.default.yellow(a2)}  `) + `
` + r2 + `
`;
      }
      default:
        return `${t}${import_picocolors2.default.cyan(a2)}  ${E({ options: this.options, cursor: this.cursor, maxItems: s.maxItems, style: i }).join(`
${import_picocolors2.default.cyan(a2)}  `)}
${import_picocolors2.default.cyan($2)}
`;
    }
  } }).prompt();
}, de = (s) => {
  const n = (t, i, r2 = []) => {
    const o = t.label ?? String(t.value), c2 = typeof t.group == "string", l2 = c2 && (r2[r2.indexOf(t) + 1] ?? { group: true }), d2 = c2 && l2.group === true, p = c2 ? `${d2 ? $2 : a2} ` : "";
    return i === "active" ? `${import_picocolors2.default.dim(p)}${import_picocolors2.default.cyan(j2)} ${o} ${t.hint ? import_picocolors2.default.dim(`(${t.hint})`) : ""}` : i === "group-active" ? `${p}${import_picocolors2.default.cyan(j2)} ${import_picocolors2.default.dim(o)}` : i === "group-active-selected" ? `${p}${import_picocolors2.default.green(b2)} ${import_picocolors2.default.dim(o)}` : i === "selected" ? `${import_picocolors2.default.dim(p)}${import_picocolors2.default.green(b2)} ${import_picocolors2.default.dim(o)}` : i === "cancelled" ? `${import_picocolors2.default.strikethrough(import_picocolors2.default.dim(o))}` : i === "active-selected" ? `${import_picocolors2.default.dim(p)}${import_picocolors2.default.green(b2)} ${o} ${t.hint ? import_picocolors2.default.dim(`(${t.hint})`) : ""}` : i === "submitted" ? `${import_picocolors2.default.dim(o)}` : `${import_picocolors2.default.dim(p)}${import_picocolors2.default.dim(B)} ${import_picocolors2.default.dim(o)}`;
  };
  return new pD({ options: s.options, initialValues: s.initialValues, required: s.required ?? true, cursorAt: s.cursorAt, validate(t) {
    if (this.required && t.length === 0)
      return `Please select at least one option.
${import_picocolors2.default.reset(import_picocolors2.default.dim(`Press ${import_picocolors2.default.gray(import_picocolors2.default.bgWhite(import_picocolors2.default.inverse(" space ")))} to select, ${import_picocolors2.default.gray(import_picocolors2.default.bgWhite(import_picocolors2.default.inverse(" enter ")))} to submit`))}`;
  }, render() {
    let t = `${import_picocolors2.default.gray(a2)}
${y2(this.state)}  ${s.message}
`;
    switch (this.state) {
      case "submit":
        return `${t}${import_picocolors2.default.gray(a2)}  ${this.options.filter(({ value: i }) => this.value.includes(i)).map((i) => n(i, "submitted")).join(import_picocolors2.default.dim(", "))}`;
      case "cancel": {
        const i = this.options.filter(({ value: r2 }) => this.value.includes(r2)).map((r2) => n(r2, "cancelled")).join(import_picocolors2.default.dim(", "));
        return `${t}${import_picocolors2.default.gray(a2)}  ${i.trim() ? `${i}
${import_picocolors2.default.gray(a2)}` : ""}`;
      }
      case "error": {
        const i = this.error.split(`
`).map((r2, o) => o === 0 ? `${import_picocolors2.default.yellow($2)}  ${import_picocolors2.default.yellow(r2)}` : `   ${r2}`).join(`
`);
        return `${t}${import_picocolors2.default.yellow(a2)}  ${this.options.map((r2, o, c2) => {
          const l2 = this.value.includes(r2.value) || r2.group === true && this.isGroupSelected(`${r2.value}`), d2 = o === this.cursor;
          return !d2 && typeof r2.group == "string" && this.options[this.cursor].value === r2.group ? n(r2, l2 ? "group-active-selected" : "group-active", c2) : d2 && l2 ? n(r2, "active-selected", c2) : l2 ? n(r2, "selected", c2) : n(r2, d2 ? "active" : "inactive", c2);
        }).join(`
${import_picocolors2.default.yellow(a2)}  `)}
${i}
`;
      }
      default:
        return `${t}${import_picocolors2.default.cyan(a2)}  ${this.options.map((i, r2, o) => {
          const c2 = this.value.includes(i.value) || i.group === true && this.isGroupSelected(`${i.value}`), l2 = r2 === this.cursor;
          return !l2 && typeof i.group == "string" && this.options[this.cursor].value === i.group ? n(i, c2 ? "group-active-selected" : "group-active", o) : l2 && c2 ? n(i, "active-selected", o) : c2 ? n(i, "selected", o) : n(i, l2 ? "active" : "inactive", o);
        }).join(`
${import_picocolors2.default.cyan(a2)}  `)}
${import_picocolors2.default.cyan($2)}
`;
    }
  } }).prompt();
}, R2 = (s) => s.replace(ye(), ""), me = (s = "", n = "") => {
  const t = `
${s}
`.split(`
`), i = R2(n).length, r2 = Math.max(t.reduce((c2, l2) => (l2 = R2(l2), l2.length > c2 ? l2.length : c2), 0), i) + 2, o = t.map((c2) => `${import_picocolors2.default.gray(a2)}  ${import_picocolors2.default.dim(c2)}${" ".repeat(r2 - R2(c2).length)}${import_picocolors2.default.gray(a2)}`).join(`
`);
  process.stdout.write(`${import_picocolors2.default.gray(a2)}
${import_picocolors2.default.green(M2)}  ${import_picocolors2.default.reset(n)} ${import_picocolors2.default.gray(G2.repeat(Math.max(r2 - i - 1, 1)) + H2)}
${o}
${import_picocolors2.default.gray(ee + G2.repeat(r2 + 2) + te)}
`);
}, he = (s = "") => {
  process.stdout.write(`${import_picocolors2.default.gray($2)}  ${import_picocolors2.default.red(s)}

`);
}, pe = (s = "") => {
  process.stdout.write(`${import_picocolors2.default.gray(Q2)}  ${s}
`);
}, ge = (s = "") => {
  process.stdout.write(`${import_picocolors2.default.gray(a2)}
${import_picocolors2.default.gray($2)}  ${s}

`);
}, v2, _2 = () => {
  const s = C ? ["\u25D2", "\u25D0", "\u25D3", "\u25D1"] : ["\u2022", "o", "O", "0"], n = C ? 80 : 120;
  let t, i, r2 = false, o = "";
  const c2 = (g2) => {
    const m2 = g2 > 1 ? "Something went wrong" : "Canceled";
    r2 && x2(m2, g2);
  }, l2 = () => c2(2), d2 = () => c2(1), p = () => {
    process.on("uncaughtExceptionMonitor", l2), process.on("unhandledRejection", l2), process.on("SIGINT", d2), process.on("SIGTERM", d2), process.on("exit", c2);
  }, S2 = () => {
    process.removeListener("uncaughtExceptionMonitor", l2), process.removeListener("unhandledRejection", l2), process.removeListener("SIGINT", d2), process.removeListener("SIGTERM", d2), process.removeListener("exit", c2);
  }, f2 = (g2 = "") => {
    r2 = true, t = OD(), o = g2.replace(/\.+$/, ""), process.stdout.write(`${import_picocolors2.default.gray(a2)}
`);
    let m2 = 0, w2 = 0;
    p(), i = setInterval(() => {
      const L2 = import_picocolors2.default.magenta(s[m2]), O2 = ".".repeat(Math.floor(w2)).slice(0, 3);
      process.stdout.write(import_sisteransi2.cursor.move(-999, 0)), process.stdout.write(import_sisteransi2.erase.down(1)), process.stdout.write(`${L2}  ${o}${O2}`), m2 = m2 + 1 < s.length ? m2 + 1 : 0, w2 = w2 < s.length ? w2 + 0.125 : 0;
    }, n);
  }, x2 = (g2 = "", m2 = 0) => {
    o = g2 ?? o, r2 = false, clearInterval(i);
    const w2 = m2 === 0 ? import_picocolors2.default.green(M2) : m2 === 1 ? import_picocolors2.default.red(P2) : import_picocolors2.default.red(V2);
    process.stdout.write(import_sisteransi2.cursor.move(-999, 0)), process.stdout.write(import_sisteransi2.erase.down(1)), process.stdout.write(`${w2}  ${o}
`), S2(), t();
  };
  return { start: f2, stop: x2, message: (g2 = "") => {
    o = g2 ?? o;
  } };
}, ve = async (s, n) => {
  const t = {}, i = Object.keys(s);
  for (const r2 of i) {
    const o = s[r2], c2 = await o({ results: t })?.catch((l2) => {
      throw l2;
    });
    if (typeof n?.onCancel == "function" && lD(c2)) {
      t[r2] = "canceled", n.onCancel({ results: t });
      continue;
    }
    t[r2] = c2;
  }
  return t;
}, we = async (s) => {
  for (const n of s) {
    if (n.enabled === false)
      continue;
    const t = _2();
    t.start(n.title);
    const i = await n.task(t.message);
    t.stop(i || n.title);
  }
};
var init_dist2 = __esm(() => {
  init_dist();
  init_dist();
  import_picocolors2 = __toESM(require_picocolors(), 1);
  import_sisteransi2 = __toESM(require_src(), 1);
  C = K2();
  Y2 = u("\u25C6", "*");
  P2 = u("\u25A0", "x");
  V2 = u("\u25B2", "x");
  M2 = u("\u25C7", "o");
  Q2 = u("\u250C", "T");
  a2 = u("\u2502", "|");
  $2 = u("\u2514", "\u2014");
  I2 = u("\u25CF", ">");
  T2 = u("\u25CB", " ");
  j2 = u("\u25FB", "[\u2022]");
  b2 = u("\u25FC", "[+]");
  B = u("\u25FB", "[ ]");
  X2 = u("\u25AA", "\u2022");
  G2 = u("\u2500", "-");
  H2 = u("\u256E", "+");
  ee = u("\u251C", "+");
  te = u("\u256F", "+");
  se = u("\u25CF", "\u2022");
  re = u("\u25C6", "*");
  ie = u("\u25B2", "!");
  ne = u("\u25A0", "x");
  v2 = { message: (s = "", { symbol: n = import_picocolors2.default.gray(a2) } = {}) => {
    const t = [`${import_picocolors2.default.gray(a2)}`];
    if (s) {
      const [i, ...r2] = s.split(`
`);
      t.push(`${n}  ${i}`, ...r2.map((o) => `${import_picocolors2.default.gray(a2)}  ${o}`));
    }
    process.stdout.write(`${t.join(`
`)}
`);
  }, info: (s) => {
    v2.message(s, { symbol: import_picocolors2.default.blue(se) });
  }, success: (s) => {
    v2.message(s, { symbol: import_picocolors2.default.green(re) });
  }, step: (s) => {
    v2.message(s, { symbol: import_picocolors2.default.green(M2) });
  }, warn: (s) => {
    v2.message(s, { symbol: import_picocolors2.default.yellow(ie) });
  }, warning: (s) => {
    v2.warn(s);
  }, error: (s) => {
    v2.message(s, { symbol: import_picocolors2.default.red(ne) });
  } };
});

// packages/models/dist/index.js
function costPerToken(costPerMillion) {
  return costPerMillion / TOKENS_PER_MILLION;
}
function isVisionModel(model) {
  return model.attachment && model.modalities.input.includes("image");
}
function findModelById(id) {
  const all = [...SELECTABLE_MODELS, ...VISION_MODELS];
  return all.find((model) => model.id === id);
}
function resolveModelByKeys(list, value, keys, defaultId) {
  const defaultModel = list.find((model) => model.id === defaultId) ?? list[0];
  if (!value) {
    return defaultModel;
  }
  return list.find((model) => keys.some((key) => key(model) === value));
}
var TOGETHER_BASE_URL = "https://api.together.ai/v1", TOKENS_PER_MILLION = 1e6, KIMI_K3, GLM_5_2, DEFAULT_MODEL, MINIMAX_M3, QWEN_3_7_MAX, DEEPSEEK_V4_FLASH, GLM_5_2_ANTHROPIC_CAPABILITIES = "effort,xhigh_effort,max_effort,thinking,adaptive_thinking,interleaved_thinking", KIMI_K3_ANTHROPIC_CAPABILITIES = "effort,max_effort,thinking,interleaved_thinking", QWEN_3_5_9B, VISION_MODELS, VISION_PRIMARY, CURATED_MODELS, SELECTABLE_MODELS, VISION_PROMPT;
var init_dist3 = __esm(() => {
  KIMI_K3 = {
    id: "moonshotai/Kimi-K3",
    name: "Kimi K3",
    anthropicAlias: "together-kimi-k3",
    cost: { input: 3, output: 15, cache_read: 0.3 },
    limit: { context: 1048576, output: 131072 },
    attachment: true,
    reasoning: true,
    reasoningEfforts: ["low", "high", "max"],
    defaultReasoningEffort: "high",
    temperature: true,
    tool_call: true,
    codexAutoCompactTokenLimit: 900000,
    codexAvailabilityNuxMessage: "Kimi K3 is now available through TogetherLink. Moonshot AI's flagship model brings advanced reasoning, vision support, and a 1M-token context window to Codex.",
    modalities: { input: ["text", "image"], output: ["text"] }
  };
  GLM_5_2 = {
    id: "zai-org/GLM-5.2",
    name: "GLM 5.2",
    anthropicAlias: "together-glm-5-2",
    cost: { input: 1.4, output: 4.4, cache_read: 0.26 },
    limit: { context: 512000, output: 164000 },
    attachment: false,
    reasoning: true,
    temperature: true,
    tool_call: true,
    codexAutoCompactTokenLimit: 460000,
    modalities: { input: ["text"], output: ["text"] }
  };
  DEFAULT_MODEL = KIMI_K3;
  MINIMAX_M3 = {
    id: "MiniMaxAI/MiniMax-M3",
    name: "MiniMax M3",
    anthropicAlias: null,
    cost: { input: 0.3, output: 1.2, cache_read: 0.06 },
    limit: { context: 524288, output: 128000 },
    attachment: true,
    reasoning: true,
    temperature: true,
    tool_call: true,
    codexAutoCompactTokenLimit: 470000,
    modalities: { input: ["text", "image"], output: ["text"] }
  };
  QWEN_3_7_MAX = {
    id: "Qwen/Qwen3.7-Max",
    name: "Qwen 3.7 Max",
    anthropicAlias: null,
    cost: { input: 2.5, output: 3.75, cache_read: 0.125 },
    limit: { context: 1e6, output: 65536 },
    attachment: true,
    reasoning: true,
    temperature: true,
    tool_call: true,
    codexAutoCompactTokenLimit: 880000,
    modalities: { input: ["text", "image"], output: ["text"] }
  };
  DEEPSEEK_V4_FLASH = {
    id: "deepseek-ai/DeepSeek-V4-Flash-0731",
    name: "DeepSeek V4 Flash 0731",
    anthropicAlias: null,
    cost: { input: 0.14, output: 0.28, cache_read: 0.03 },
    limit: { context: 1048576, output: 393216 },
    attachment: false,
    reasoning: true,
    reasoningEfforts: ["low", "high", "max"],
    defaultReasoningEffort: "high",
    temperature: true,
    tool_call: true,
    codexAutoCompactTokenLimit: 900000,
    modalities: { input: ["text"], output: ["text"] }
  };
  QWEN_3_5_9B = {
    id: "Qwen/Qwen3.5-9B",
    name: "Qwen3.5 9B",
    anthropicAlias: null,
    cost: { input: 0.17, output: 0.25, cache_read: 0 },
    limit: { context: 262144, output: 32768 },
    attachment: true,
    reasoning: true,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] }
  };
  VISION_MODELS = [KIMI_K3, QWEN_3_5_9B];
  VISION_PRIMARY = VISION_MODELS[0] ?? {
    id: "",
    name: "",
    anthropicAlias: null,
    cost: { input: 0, output: 0, cache_read: 0 },
    limit: { context: 0, output: 0 },
    attachment: true,
    reasoning: true,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] }
  };
  CURATED_MODELS = [
    KIMI_K3,
    GLM_5_2,
    MINIMAX_M3,
    QWEN_3_7_MAX,
    DEEPSEEK_V4_FLASH
  ];
  SELECTABLE_MODELS = [
    DEFAULT_MODEL,
    ...CURATED_MODELS.filter((model) => model.id !== DEFAULT_MODEL.id)
  ];
  VISION_PROMPT = "Describe this image for a coding assistant that cannot see it. " + "Be concise but specific: layout, UI elements, colors, any text (quote it " + "verbatim), diagrams, charts, or notable details. If it is a screenshot, " + "describe the visible UI. Keep it under 150 words.";
});

// packages/cli/src/lib/claude/defaults.ts
function claudeModelCapabilities(model) {
  if (model.id === GLM_5_2.id) {
    return GLM_5_2_ANTHROPIC_CAPABILITIES;
  }
  if (model.id === KIMI_K3.id) {
    return KIMI_K3_ANTHROPIC_CAPABILITIES;
  }
  return;
}
function resolveClaudeModel(value) {
  if (CLAUDE_SUPPORTED_MODELS.length === 0) {
    throw new Error("No Claude models are configured.");
  }
  const found = resolveModelByKeys(CLAUDE_SUPPORTED_MODELS.map((model) => model.definition), value, [(model) => model.anthropicAlias, (model) => model.id], DEFAULT_MODEL.id);
  if (!found) {
    const expected = CLAUDE_SUPPORTED_MODELS.map((model) => `${model.alias} (${model.definition.id})`).join(", ");
    throw new Error(`Unsupported Claude model "${value}". Expected one of: ${expected}.`);
  }
  return { alias: found.anthropicAlias ?? found.id, definition: found };
}
var CLAUDE_LOCAL_PROXY_HOST = "127.0.0.1", CLAUDE_HAIKU_MODEL, CLAUDE_HAIKU_MODEL_SELECTION, selectableClaudeModels, CLAUDE_SUPPORTED_MODELS;
var init_defaults = __esm(() => {
  init_dist3();
  CLAUDE_HAIKU_MODEL = QWEN_3_5_9B;
  CLAUDE_HAIKU_MODEL_SELECTION = {
    alias: CLAUDE_HAIKU_MODEL.anthropicAlias ?? CLAUDE_HAIKU_MODEL.id,
    definition: CLAUDE_HAIKU_MODEL
  };
  selectableClaudeModels = SELECTABLE_MODELS.map((definition) => ({
    alias: definition.anthropicAlias ?? definition.id,
    definition
  }));
  CLAUDE_SUPPORTED_MODELS = [
    ...selectableClaudeModels,
    ...selectableClaudeModels.some((model) => model.definition.id === CLAUDE_HAIKU_MODEL_SELECTION.definition.id) ? [] : [CLAUDE_HAIKU_MODEL_SELECTION]
  ];
});

// packages/cli/src/lib/harness-types.ts
function defineHarness(impl) {
  if (typeof impl.run !== "function") {
    throw new Error(`Harness "${impl.id}" is missing required method "run"`);
  }
  return impl;
}

// packages/cli/src/lib/global-config.ts
var exports_global_config = {};
__export(exports_global_config, {
  togetherlinkHome: () => togetherlinkHome,
  setGlobalExaApiKey: () => setGlobalExaApiKey,
  setGlobalApiKey: () => setGlobalApiKey,
  resolveStoredExaApiKey: () => resolveStoredExaApiKey,
  resolveStoredApiKey: () => resolveStoredApiKey,
  readGlobalConfig: () => readGlobalConfig
});
import os from "os";
import path2 from "path";
function togetherlinkHome(home = os.homedir()) {
  return path2.join(home, ".togetherlink");
}
function globalConfigPath(home = os.homedir()) {
  return path2.join(togetherlinkHome(home), "config.json");
}
async function readGlobalConfig(home = os.homedir()) {
  const config = await readJsonIfExists(globalConfigPath(home));
  return {
    apiKey: config.apiKey ?? "",
    exaApiKey: config.exaApiKey ?? ""
  };
}
async function writeGlobalConfig(home, config) {
  await writeJsonAtomic(globalConfigPath(home), config);
}
async function setGlobalApiKey(home, apiKey) {
  const config = await readGlobalConfig(home);
  config.apiKey = apiKey;
  await writeGlobalConfig(home, config);
}
async function setGlobalExaApiKey(home, exaApiKey) {
  const config = await readGlobalConfig(home);
  config.exaApiKey = exaApiKey;
  await writeGlobalConfig(home, config);
}
function resolveStoredApiKey(stored) {
  if (!stored) {
    return "";
  }
  if (stored === TOGETHER_API_KEY_ENV_REF) {
    return process.env.TOGETHER_API_KEY?.trim() ?? "";
  }
  return stored;
}
function resolveStoredExaApiKey(stored) {
  if (!stored) {
    return "";
  }
  if (stored === EXA_API_KEY_ENV_REF) {
    return process.env.EXA_API_KEY?.trim() ?? "";
  }
  return stored;
}
var init_global_config = __esm(() => {
  init_together_core();
});

// packages/cli/src/lib/together-core.ts
import { mkdir, readFile, writeFile, rename } from "fs/promises";
import path3 from "path";
function resolveTogetherBaseUrl(env = process.env) {
  const override = env.TOGETHER_BASE_URL?.trim();
  if (!override) {
    return TOGETHER_BASE_URL2;
  }
  const normalized = override.replace(/\/+$/, "");
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}
async function readJsonIfExists(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return {};
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read ${filePath}: ${message}`);
  }
}
async function writeJsonAtomic(filePath, value) {
  await mkdir(path3.dirname(filePath), { recursive: true });
  const serialized = `${JSON.stringify(value, null, 2)}
`;
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(tmpPath, serialized, { mode: 384 });
  await rename(tmpPath, filePath);
}
async function resolveTogetherApiKey({
  apiKey,
  home
}) {
  if (apiKey?.trim()) {
    return apiKey.trim();
  }
  if (home) {
    const { readGlobalConfig: readGlobalConfig2, resolveStoredApiKey: resolveStoredApiKey2 } = await Promise.resolve().then(() => (init_global_config(), exports_global_config));
    const globalKey = resolveStoredApiKey2((await readGlobalConfig2(home)).apiKey);
    if (globalKey) {
      return globalKey;
    }
  }
  return process.env.TOGETHER_API_KEY?.trim() ?? "";
}
function isNodeError(err) {
  return err instanceof Error && "code" in err;
}
var TOGETHER_BASE_URL2, TOGETHER_API_KEY_ENV_REF = "{env:TOGETHER_API_KEY}", EXA_API_KEY_ENV_REF = "{env:EXA_API_KEY}";
var init_together_core = __esm(() => {
  init_dist3();
  TOGETHER_BASE_URL2 = TOGETHER_BASE_URL;
});

// packages/cli/src/lib/version.ts
var VERSION = "0.8.3";
var init_version = () => {
};

// packages/cli/src/lib/http-util.ts
import { timingSafeEqual } from "crypto";
function requestPath(req) {
  return new URL(req.url ?? "/", "http://127.0.0.1").pathname;
}
async function readJsonBodyWithSize(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks);
  const text = raw.toString("utf8");
  const body = text ? JSON.parse(text) : {};
  return { body, rawBytes: raw.length };
}
async function readJsonBody(req) {
  return (await readJsonBodyWithSize(req)).body;
}
function writeJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}
function extractToken(req) {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  const apiKey = req.headers["x-api-key"];
  return typeof apiKey === "string" ? apiKey : undefined;
}
function isAuthorized(req, authToken) {
  const token = extractToken(req);
  return token !== undefined && constantTimeEqual(token, authToken);
}
function constantTimeEqual(actual, expected) {
  if (typeof actual !== "string") {
    return false;
  }
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(actualBytes, expectedBytes);
}
var init_http_util = () => {
};

// packages/cli/src/lib/proxy-perf.ts
import { performance } from "perf_hooks";
function createProxyPerfTracer(name, fields = {}, sink) {
  if (process.env.TOGETHERLINK_PERF !== "1") {
    return disabledProxyPerfTracer;
  }
  const startedAt = performance.now();
  const spans = [];
  const marks = [];
  const seenMarks = new Set;
  let ended = false;
  const elapsed = () => performance.now() - startedAt;
  const recordSpan = (spanName, start, spanFields) => {
    spans.push({
      name: spanName,
      durationMs: roundMs(performance.now() - start),
      atMs: roundMs(elapsed()),
      ...spanFields ? { fields: spanFields } : {}
    });
  };
  return {
    enabled: true,
    async span(spanName, fn, spanFields) {
      const start = performance.now();
      try {
        return await fn();
      } finally {
        recordSpan(spanName, start, spanFields);
      }
    },
    spanSync(spanName, fn, spanFields) {
      const start = performance.now();
      try {
        return fn();
      } finally {
        recordSpan(spanName, start, spanFields);
      }
    },
    mark(markName, markFields) {
      marks.push({
        name: markName,
        atMs: roundMs(elapsed()),
        ...markFields ? { fields: markFields } : {}
      });
    },
    markOnce(markName, markFields) {
      if (seenMarks.has(markName)) {
        return;
      }
      seenMarks.add(markName);
      this.mark(markName, markFields);
    },
    end(endFields) {
      if (ended) {
        return;
      }
      ended = true;
      const payload = {
        name,
        totalMs: roundMs(elapsed()),
        fields,
        ...endFields ? { result: endFields } : {},
        spans,
        marks
      };
      try {
        sink?.(payload);
      } catch {
      }
      process.stderr.write(`[togetherlink perf] ${JSON.stringify(payload)}
`);
    }
  };
}
function roundMs(value) {
  return Math.round(value * 1000) / 1000;
}
var disabledProxyPerfTracer;
var init_proxy_perf = __esm(() => {
  disabledProxyPerfTracer = {
    enabled: false,
    async span(_name, fn) {
      return await fn();
    },
    spanSync(_name, fn) {
      return fn();
    },
    mark() {
    },
    markOnce() {
    },
    end() {
    }
  };
});

// packages/cli/src/lib/debug-log.ts
import { appendFile } from "fs/promises";
function writeDebugLogLine(line) {
  process.stderr.write(line);
  const logPath = process.env.TOGETHERLINK_DEBUG_LOG;
  if (!logPath) {
    return;
  }
  appendFile(logPath, line).catch((err) => {
    if (warnedAboutDebugLogWrite) {
      return;
    }
    warnedAboutDebugLogWrite = true;
    process.stderr.write(`[togetherlink debug] failed to append debug log: ${err instanceof Error ? err.message : String(err)}
`);
  });
}
var warnedAboutDebugLogWrite = false;
var init_debug_log = () => {
};

// packages/cli/src/lib/proxy-debug.ts
function writeProxyDebugLog(prefix, options, label, value) {
  if (!options?.debug) {
    return;
  }
  const payload = typeof value === "function" ? value() : value;
  writeDebugLogLine(`[${prefix}] ${label}: ${JSON.stringify(payload)}
`);
}
var init_proxy_debug = __esm(() => {
  init_debug_log();
});

// packages/cli/src/lib/exa-search.ts
function withNativeToolSystemPrompt(messages, nativeTools, options = {}) {
  const toolName = options.toolName ?? ((tool) => String(tool));
  const prompt = [
    "Native server tools are available through function calls.",
    ...nativeTools.map((tool) => `- ${toolName(tool)}: call this for live web search. Always provide a concise non-empty query.`),
    "After tool results are returned, answer from the provided sources and include source URLs when relevant."
  ].join(`
`);
  const nextMessages = [{ role: "system", content: prompt }, ...messages];
  return options.mergeLeadingSystemMessages ? options.mergeLeadingSystemMessages(nextMessages) : nextMessages;
}
function nativeToolMaxUses(tool) {
  const value = tool.max_uses;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 5;
}
async function runExaSearchDetailed(params) {
  const query = webSearchQuery(params.query, params.queryKeys);
  if (!query) {
    return failedSearch("", "Web search error: missing query.", "invalid_tool_input");
  }
  const body = exaSearchBody({
    query,
    allowedDomains: params.allowedDomains,
    blockedDomains: params.blockedDomains
  });
  const exaApiKey = params.exaApiKey?.trim();
  if (!exaApiKey) {
    return failedSearch(query, params.missingApiKeyMessage ?? "Web search error: EXA_API_KEY is not set. Set it and retry.", "unavailable");
  }
  params.debugLog?.("exa search request", { query, hasApiKey: Boolean(exaApiKey), body });
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": exaApiKey
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    params.debugLog?.("exa search error", { status: response.status, body: text.slice(0, 1000) });
    return failedSearch(query, `Web search error from Exa (${response.status}): ${text.slice(0, 1200)}`, response.status === 429 ? "too_many_requests" : "unavailable");
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return failedSearch(query, `Web search error: Exa returned non-JSON content: ${text.slice(0, 1200)}`, "unavailable");
  }
  const results = (json.results ?? []).slice(0, 5);
  if (results.length === 0) {
    return {
      query,
      results,
      text: `Web search completed for "${query}" but returned no results.${json.autopromptString ? ` Autoprompt: ${json.autopromptString}` : ""}`
    };
  }
  const lines = [`Web search results for "${query}" via Exa:`];
  results.forEach((result, index) => {
    lines.push([
      `${index + 1}. ${result.title ?? "Untitled"}`,
      `URL: ${result.url ?? ""}`,
      params.includePublishedDate && result.publishedDate ? `Published: ${result.publishedDate}` : "",
      `Snippet: ${trimSearchText(result.text ?? "", params.snippetLength)}`
    ].filter(Boolean).join(`
`));
  });
  if (json.autopromptString) {
    lines.push(`Autoprompt: ${json.autopromptString}`);
  }
  return { query, results, text: lines.join(`

`) };
}
function failedSearch(query, text, errorCode) {
  return { query, text, results: [], errorCode };
}
function exaSearchBody(params) {
  const body = {
    query: params.query,
    numResults: 5,
    type: "auto",
    contents: { text: true }
  };
  if (params.allowedDomains.length > 0) {
    body.includeDomains = params.allowedDomains;
  }
  if (params.blockedDomains.length > 0) {
    body.excludeDomains = params.blockedDomains;
  }
  return body;
}
function webSearchQuery(input, keys = ["query", "q", "search_query", "input"]) {
  if (typeof input === "string") {
    return input.trim();
  }
  if (typeof input !== "object" || input === null) {
    return "";
  }
  const record = input;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}
function stringArray(value, options = {}) {
  const requireTrimmed = options.requireTrimmed ?? true;
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && (requireTrimmed ? item.trim().length > 0 : item.length > 0)) : [];
}
function trimSearchText(value, maxLength = 700) {
  return value.replaceAll(/\s+/g, " ").trim().slice(0, maxLength);
}

// packages/cli/src/lib/json-format.ts
function objectKeys(value) {
  return value && typeof value === "object" ? Object.keys(value) : undefined;
}
function stringifyUnknown(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function parseJsonOrEmpty(value) {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

// packages/cli/src/lib/output-budget.ts
function resolveOutputBudget({
  model,
  estimatedInputTokens = 0,
  clientMaxTokens,
  harnessCap
}) {
  const ceiling = Math.max(1, Math.floor(Math.min(model.limit.output, finiteTokenCount(harnessCap) ?? Number.POSITIVE_INFINITY, finiteTokenCount(clientMaxTokens) ?? Number.POSITIVE_INFINITY)));
  const estimated = finiteTokenCount(estimatedInputTokens);
  if (estimated === undefined || estimated <= 0) {
    return ceiling;
  }
  const available = Math.floor(model.limit.context - estimated - OUTPUT_SAFETY_TOKENS);
  const floor = Math.min(ceiling, MIN_PREFERRED_OUTPUT_TOKENS);
  return Math.max(floor, Math.min(ceiling, available));
}
function isTruncationReal(finishReason, usage) {
  if (finishReason !== "length") {
    return false;
  }
  const outputTokens = finiteTokenCount(usage?.outputTokens);
  const requestedMaxTokens = finiteTokenCount(usage?.requestedMaxTokens);
  if (outputTokens === undefined || requestedMaxTokens === undefined) {
    return true;
  }
  const output = Math.max(0, Math.floor(outputTokens));
  const requested = Math.max(1, Math.floor(requestedMaxTokens));
  if (output >= requested) {
    return true;
  }
  return output >= Math.floor(requested * 0.9) || requested - output <= 1024;
}
function finiteTokenCount(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
var OUTPUT_SAFETY_TOKENS = 512, MIN_PREFERRED_OUTPUT_TOKENS = 8000;

// packages/cli/src/lib/claude/content-format.ts
function stringifyAnthropicContent(content) {
  if (!content) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  return content.filter((block) => block.type === "text").map((block) => block.text).join(`
`);
}
function formatToolResultContent(content, isError) {
  const prefix = isError ? `[tool_result error]
` : "";
  if (typeof content === "string") {
    return `${prefix}${content}`;
  }
  if (Array.isArray(content)) {
    const parts = content.map(formatContentBlockForToolResult).filter((part) => part.length > 0);
    return `${prefix}${parts.join(`
`)}`;
  }
  return `${prefix}${stringifyUnknown(content)}`;
}
function formatContentBlockForToolResult(block) {
  if (typeof block !== "object" || block === null) {
    return stringifyUnknown(block);
  }
  const record = block;
  if (record.type === "text" && typeof record.text === "string") {
    return record.text;
  }
  if (record.type === "image") {
    const source = typeof record.source === "object" && record.source !== null ? record.source : {};
    const mediaType = typeof source.media_type === "string" ? ` ${source.media_type}` : "";
    return `[image${mediaType} in tool result]`;
  }
  if (record.type === "url" && typeof record.url === "string") {
    return `[url in tool result] ${record.url}`;
  }
  if (record.type === "tool_reference" && typeof record.tool_name === "string") {
    return `Loaded deferred tool: ${record.tool_name}`;
  }
  return stringifyUnknown(block);
}
function formatWebSearchToolResult(block) {
  const errorCode = typeof block.error_code === "string" ? block.error_code : undefined;
  if (block.type === "web_search_tool_result_error") {
    return `Web search error${errorCode ? ` (${errorCode})` : ""}: ${formatToolResultContent(block.content)}`;
  }
  const content = block.content;
  if (Array.isArray(content)) {
    const lines = content.flatMap((item, index) => formatWebSearchResultItem(item, index));
    return lines.length > 0 ? lines.join(`

`) : "Web search returned no results.";
  }
  if (typeof content === "object" && content !== null) {
    const record = content;
    if (record.type === "web_search_tool_result_error") {
      const code = typeof record.error_code === "string" ? record.error_code : errorCode;
      return `Web search error${code ? ` (${code})` : ""}: ${formatToolResultContent(record.content)}`;
    }
  }
  return formatToolResultContent(content);
}
function formatWebSearchResultItem(item, index) {
  if (typeof item !== "object" || item === null) {
    return [`${index + 1}. ${stringifyUnknown(item)}`];
  }
  const record = item;
  if (record.type === "web_search_tool_result_error") {
    const code = typeof record.error_code === "string" ? record.error_code : undefined;
    return [
      `Web search error${code ? ` (${code})` : ""}: ${formatToolResultContent(record.content)}`
    ];
  }
  const title = stringField(record, "title") ?? stringField(record, "page_title") ?? "Untitled result";
  const url = stringField(record, "url") ?? stringField(record, "source");
  const snippet = stringField(record, "text") ?? stringField(record, "snippet") ?? stringField(record, "description");
  return [
    [
      `${index + 1}. ${title}`,
      ...url ? [`URL: ${url}`] : [],
      ...snippet ? [`Snippet: ${trimSearchText(snippet)}`] : []
    ].join(`
`)
  ];
}
function stringField(record, key) {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function mapStopReason(reason, usage) {
  if (reason === "tool_calls") {
    return "tool_use";
  }
  if (reason === "length") {
    return isTruncationReal(reason, usage) ? "max_tokens" : "end_turn";
  }
  return "end_turn";
}
var init_content_format = () => {
};

// packages/cli/src/lib/together-retry.ts
function parseRetryAfter(value) {
  if (!value) {
    return;
  }
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return;
}
function backoffMs(attempt) {
  const base = 1000 * 2 ** attempt;
  const jitter = (attempt % 2 === 0 ? 1 : -1) * base * 0.2;
  return Math.max(100, base + jitter);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// packages/cli/src/lib/paths.ts
import os2 from "os";
import path4 from "path";
function togetherlinkHome2() {
  return process.env.TOGETHERLINK_HOME || path4.join(os2.homedir(), ".togetherlink");
}
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}
var init_paths = () => {
};

// packages/cli/src/lib/request-diagnostics.ts
import { appendFile as appendFile2, chmod, mkdir as mkdir2 } from "fs/promises";
import path5 from "path";
async function persistRequestDiagnostic(diagnostic) {
  if (process.env.TOGETHERLINK_REQUEST_DIAGNOSTICS === "0") {
    return;
  }
  const file = resolveRequestDiagnosticsPath();
  await mkdir2(path5.dirname(file), { recursive: true });
  await appendFile2(file, `${JSON.stringify({ at: new Date().toISOString(), ...diagnostic })}
`, {
    mode: 384
  });
  await chmod(file, 384).catch(() => {
    return;
  });
}
function resolveRequestDiagnosticsPath(home = togetherlinkHome2()) {
  return path5.join(home, REQUEST_DIAGNOSTICS_FILE);
}
var REQUEST_DIAGNOSTICS_FILE = "request-diagnostics.jsonl";
var init_request_diagnostics = __esm(() => {
  init_paths();
});

// packages/cli/src/lib/telemetry.ts
import os3 from "os";
import path6 from "path";
import { randomUUID } from "crypto";
function installIdPath(home = os3.homedir()) {
  return path6.join(togetherlinkHome(home), "install-id");
}
function telemetryDisabledByEnvironment() {
  return Boolean(process.env.TOGETHERLINK_TELEMETRY_DISABLED) || process.env.GITHUB_ACTIONS === "true";
}
async function getInstallId(home = os3.homedir()) {
  const filePath = installIdPath(home);
  const pending = pendingInstallIds.get(filePath);
  if (pending) {
    return pending;
  }
  const operation = readOrCreateInstallId(filePath);
  pendingInstallIds.set(filePath, operation);
  try {
    return await operation;
  } finally {
    if (pendingInstallIds.get(filePath) === operation) {
      pendingInstallIds.delete(filePath);
    }
  }
}
async function readOrCreateInstallId(filePath) {
  const existing = await readJsonIfExists(filePath);
  if (existing.id) {
    return existing.id;
  }
  const id = randomUUID();
  await writeJsonAtomic(filePath, { id });
  return id;
}
function normalizedOs() {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      return "unknown";
  }
}
async function sendTelemetryEvent(event, home = os3.homedir()) {
  if (telemetryDisabledByEnvironment()) {
    return;
  }
  try {
    const installId = await getInstallId(home);
    const controller = new AbortController;
    const timeout = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS);
    try {
      await fetch(TELEMETRY_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          installId,
          version: VERSION,
          os: normalizedOs(),
          arch: process.arch,
          ...event
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
  }
}
function randomSessionId() {
  return randomUUID();
}
var TELEMETRY_ENDPOINT, TELEMETRY_TIMEOUT_MS = 2000, pendingInstallIds;
var init_telemetry = __esm(() => {
  init_together_core();
  init_global_config();
  init_version();
  TELEMETRY_ENDPOINT = process.env.TOGETHERLINK_TELEMETRY_URL ?? "https://togetherlink.vercel.app/api/telemetry";
  pendingInstallIds = new Map;
});

// packages/cli/src/lib/context-fit.ts
function jsonByteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
function parseTogetherContextLengthMaxTokens(message) {
  const statedMatch = message.match(/maximum context length is\s+([\d,_]+)\s+tokens/is);
  if (statedMatch) {
    return parseTokenCount(statedMatch[1]);
  }
  const parentheticalMatch = message.match(/maximum context length\s*\(([\d,_]+)\)/is);
  return parseTokenCount(parentheticalMatch?.[1]);
}
function parseTogetherContextLengthInputTokens(message) {
  const countedMatch = message.match(/input token count\s*\(([\d,_]+)\)/is);
  if (countedMatch) {
    return parseTokenCount(countedMatch[1]);
  }
  const parentheticalMatch = message.match(/maximum context length is\s+[\d,_]+\s+tokens.*?\(([\d,_]+)\s+input\b/is);
  if (parentheticalMatch) {
    return parseTokenCount(parentheticalMatch[1]);
  }
  const resolvedInputMatch = message.match(/request resolved to\s+([\d,_]+)\s+input tokens\b/is);
  return parseTokenCount(resolvedInputMatch?.[1]);
}
function parseTokenCount(value) {
  if (!value) {
    return;
  }
  const parsed = Number.parseInt(value.replaceAll(/[,_]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function contextLengthOverflow(message, model) {
  const inputTokens = parseTogetherContextLengthInputTokens(message);
  if (inputTokens === undefined) {
    return;
  }
  const contextTokens = parseTogetherContextLengthMaxTokens(message) ?? model.limit.context;
  return { inputTokens, contextTokens };
}
function trimPayloadMessages(messages, requestedCharsToTrim) {
  if (!Array.isArray(messages) || requestedCharsToTrim <= 0) {
    return;
  }
  let charsToTrim = requestedCharsToTrim;
  let trimmedChars = 0;
  for (const message of messages) {
    if (charsToTrim <= 0) {
      break;
    }
    const record = asFitMessage(message);
    if (!record || record.role === "system") {
      continue;
    }
    const result = trimMessageContent(record, charsToTrim);
    if (!result) {
      continue;
    }
    charsToTrim -= result.trimmedChars;
    trimmedChars += result.trimmedChars;
  }
  return trimmedChars > 0 ? { trimmedChars } : undefined;
}
function trimMessageContent(record, charsToTrim) {
  if (typeof record.content === "string" && record.content.length > 0) {
    const result = trimOldContextText(record.content, charsToTrim);
    if (!result) {
      return;
    }
    record.content = result.text;
    return { trimmedChars: result.trimmedChars };
  }
  if (Array.isArray(record.content)) {
    let remaining = charsToTrim;
    let trimmed = 0;
    for (const part of record.content) {
      if (remaining <= 0) {
        break;
      }
      if (part && typeof part === "object" && part.type === "text" && typeof part.text === "string") {
        const result = trimOldContextText(part.text, remaining);
        if (!result) {
          continue;
        }
        part.text = result.text;
        remaining -= result.trimmedChars;
        trimmed += result.trimmedChars;
      }
    }
    return trimmed > 0 ? { trimmedChars: trimmed } : undefined;
  }
  return;
}
function trimOldContextText(text, requestedChars) {
  if (requestedChars <= 0 || text.length <= TRIM_MARKER.length + 32) {
    return;
  }
  const preservedPrefixChars = Math.min(TRIM_PRESERVED_PREFIX_CHARS, Math.max(0, text.length - TRIM_MARKER.length - 32));
  const maxRemovableChars = Math.max(1, text.length - preservedPrefixChars - TRIM_MARKER.length - 32);
  const removableChars = Math.min(requestedChars, maxRemovableChars);
  const nextText = `${text.slice(0, preservedPrefixChars)}${TRIM_MARKER}${text.slice(preservedPrefixChars + removableChars)}`;
  return {
    text: nextText,
    trimmedChars: Math.max(0, text.length - nextText.length)
  };
}
function dropOldestTurns(messages, charsToFree) {
  if (!Array.isArray(messages) || charsToFree <= 0) {
    return;
  }
  let start = 0;
  while (start < messages.length && asFitMessage(messages[start])?.role === "system") {
    start += 1;
  }
  const boundaries = [];
  for (let i = start;i < messages.length; i += 1) {
    if (asFitMessage(messages[i])?.role === "user") {
      boundaries.push(i);
    }
  }
  if (boundaries.length <= 1) {
    return;
  }
  let freedChars = 0;
  let dropUpTo = start;
  for (let k3 = 0;k3 < boundaries.length - 1; k3 += 1) {
    if (freedChars >= charsToFree) {
      break;
    }
    const blockEnd = boundaries[k3 + 1];
    for (let i = dropUpTo;i < blockEnd; i += 1) {
      freedChars += jsonByteLength(messages[i]);
    }
    dropUpTo = blockEnd;
  }
  const droppedMessages = dropUpTo - start;
  if (droppedMessages <= 0) {
    return;
  }
  messages.splice(start, droppedMessages);
  return { droppedMessages, freedChars };
}
function newContextFitState(payload) {
  const originalMaxTokens = typeof payload.max_tokens === "number" && Number.isFinite(payload.max_tokens) ? Math.max(CONTEXT_LENGTH_RETRY_FLOOR, Math.floor(payload.max_tokens)) : undefined;
  return {
    originalChars: jsonByteLength(payload.messages ?? []),
    freedChars: 0,
    ...originalMaxTokens !== undefined ? { originalMaxTokens } : {}
  };
}
function applyContextFit(payload, message, model, state) {
  const overflow = contextLengthOverflow(message, model);
  if (!overflow) {
    return {
      mutated: false,
      freedChars: 0,
      inputTokens: 0,
      contextWindow: model.limit.context,
      hard: false
    };
  }
  const { inputTokens, contextTokens } = overflow;
  const base = { inputTokens, contextWindow: contextTokens };
  const availableOutput = contextTokens - inputTokens - OUTPUT_SAFETY_TOKENS;
  const currentMaxTokens = typeof payload.max_tokens === "number" ? payload.max_tokens : undefined;
  const desiredMaxTokens = Math.min(state.originalMaxTokens ?? currentMaxTokens ?? model.limit.output, model.limit.output);
  const minPreferredOutput = Math.min(desiredMaxTokens, MIN_PREFERRED_OUTPUT_TOKENS);
  if (availableOutput >= minPreferredOutput) {
    const nextMaxTokens = Math.max(CONTEXT_LENGTH_RETRY_FLOOR, Math.floor(availableOutput));
    if (currentMaxTokens === undefined || nextMaxTokens < currentMaxTokens) {
      payload.max_tokens = nextMaxTokens;
      return { mutated: true, action: "max_tokens", freedChars: 0, hard: false, ...base };
    }
  }
  if (currentMaxTokens !== desiredMaxTokens) {
    payload.max_tokens = desiredMaxTokens;
  }
  const targetInputTokens = contextTokens - desiredMaxTokens - OUTPUT_SAFETY_TOKENS;
  const tokensToFree = Math.max(1, inputTokens - targetInputTokens) + CONTEXT_RETRY_TRIM_EXTRA_TOKENS;
  const payloadBytes = jsonByteLength({
    messages: payload.messages,
    tools: payload.tools,
    tool_choice: payload.tool_choice
  });
  const realCharsPerToken = Math.max(1, payloadBytes / Math.max(1, inputTokens));
  const charsToFree = Math.max(1, Math.ceil(tokensToFree * realCharsPerToken));
  const trimmed = trimPayloadMessages(payload.messages, charsToFree);
  if (trimmed) {
    return finish(state, base, "trim_text", trimmed.trimmedChars);
  }
  const dropped = dropOldestTurns(payload.messages, charsToFree);
  if (dropped) {
    return finish(state, base, "drop_turns", dropped.freedChars);
  }
  return { mutated: false, freedChars: 0, hard: false, ...base };
}
function finish(state, base, action, freedChars) {
  state.freedChars += freedChars;
  const hard = state.originalChars > 0 && state.freedChars / state.originalChars > HARD_WARN_DROPPED_FRACTION;
  return { mutated: true, action, freedChars, hard, ...base };
}
function emitContextTrimAlarm(info) {
  const severity = info.hard ? "DROPPED A LARGE PORTION of" : "trimmed";
  process.stderr.write(`togetherlink: ${severity} ${info.trimmedChars} chars of conversation context ` + `to fit <${info.model}> window (${info.path} path${info.action ? `, ${info.action}` : ""}) ` + `\u2014 if you see this often, report it
`);
  sendTelemetryEvent({ event: "context_trim", contextTrim: info });
}
function asFitMessage(value) {
  return typeof value === "object" && value !== null ? value : undefined;
}
var APPROX_CHARS_PER_TOKEN = 4, CONTEXT_LENGTH_RETRY_FLOOR = 1, CONTEXT_RETRY_TRIM_EXTRA_TOKENS = 512, TRIM_PRESERVED_PREFIX_CHARS = 4096, HARD_WARN_DROPPED_FRACTION = 0.5, CONTEXT_FIT_MAX_ATTEMPTS = 6, TRIM_MARKER = `
[togetherlink trimmed older context to fit the model window]
`;
var init_context_fit = __esm(() => {
  init_telemetry();
});

// packages/cli/src/lib/together-client.ts
import { randomUUID as randomUUID2 } from "crypto";
import { Agent, EnvHttpProxyAgent, fetch as undiciFetch } from "undici";
function hasEnvironmentProxy(environment = process.env) {
  return ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"].some((key) => Boolean(environment[key]?.trim()));
}
function environmentProxyOptions(environment = process.env) {
  const httpProxy = environment.http_proxy?.trim() || environment.HTTP_PROXY?.trim();
  const httpsProxy = environment.https_proxy?.trim() || environment.HTTPS_PROXY?.trim();
  return {
    ...httpProxy ? { httpProxy } : {},
    ...httpsProxy ? { httpsProxy } : {},
    noProxy: environment.no_proxy ?? environment.NO_PROXY ?? ""
  };
}
function getTogetherResponseDiagnostics(response) {
  return responseDiagnostics.get(response);
}
async function postChatCompletion(payload, options, signal, fit) {
  const doFetch = (body) => payload.stream === true ? streamFetchOnce(body, options, signal) : postChatCompletionOnce(body, options, signal);
  if (!fit) {
    return doFetch(JSON.stringify(payload));
  }
  return fetchWithContextFit(payload, fit, doFetch);
}
async function postChatCompletionOnce(body, options, signal) {
  for (let attempt = 0;attempt <= MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetchTogetherResponse(body, options, signal, attempt);
    } catch (err) {
      if (signal?.aborted) {
        throw err;
      }
      if (err instanceof TogetherResponseHeaderTimeoutError) {
        if (attempt < responseHeaderRetries()) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw err;
      }
      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return syntheticOverloadedResponse(err instanceof Error ? err.message : String(err));
    }
    if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt >= MAX_RETRIES) {
      return response;
    }
    await response.arrayBuffer().catch(() => {
      return;
    });
    await sleep(parseRetryAfter(response.headers.get("retry-after")) ?? backoffMs(attempt));
  }
  return syntheticOverloadedResponse("Together request failed after retries.");
}
async function postChatCompletionStream(payload, options, signal, body, fit) {
  const doFetch = (b3) => streamFetchOnce(b3, options, signal);
  if (body !== undefined || !fit) {
    return doFetch(body ?? JSON.stringify(payload));
  }
  return fetchWithContextFit(payload, fit, doFetch);
}
async function streamFetchOnce(body, options, signal) {
  const maxRetries = Math.max(streamRetries(), responseHeaderRetries());
  for (let attempt = 0;attempt <= maxRetries; attempt += 1) {
    let response;
    try {
      response = await fetchTogetherResponse(body, options, signal, attempt);
    } catch (err) {
      const allowedRetries = err instanceof TogetherResponseHeaderTimeoutError ? responseHeaderRetries() : streamRetries();
      if (signal?.aborted || attempt >= allowedRetries) {
        throw err;
      }
      await sleep(backoffMs(attempt));
      continue;
    }
    if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt >= maxRetries) {
      return response;
    }
    await response.arrayBuffer().catch(() => {
      return;
    });
    await sleep(parseRetryAfter(response.headers.get("retry-after")) ?? backoffMs(attempt));
  }
  throw new Error("Together stream request failed after retries.");
}
async function fetchTogetherResponse(body, options, signal, attempt) {
  const clientRequestId = randomUUID2();
  const timeoutMs = responseHeaderTimeoutMs();
  const upstreamUrl = `${options.baseUrl ?? TOGETHER_BASE_URL2}/chat/completions`;
  const startedAt = Date.now();
  const controller = new AbortController;
  let timeoutError;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) {
    abortFromCaller();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timeout = setTimeout(() => {
    timeoutError = new TogetherResponseHeaderTimeoutError(timeoutMs, clientRequestId);
    controller.abort(timeoutError);
  }, timeoutMs);
  timeout.unref?.();
  try {
    const dispatcher = process.versions.bun ? undefined : hasEnvironmentProxy() ? new EnvHttpProxyAgent({
      ...environmentProxyOptions(),
      connections: 1,
      keepAliveTimeout: 1,
      keepAliveMaxTimeout: 1
    }) : new Agent({ connections: 1, keepAliveTimeout: 1, keepAliveMaxTimeout: 1 });
    const requestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        Connection: "close",
        "Content-Type": "application/json",
        "X-Client-Request-ID": clientRequestId
      },
      body,
      signal: controller.signal,
      ...dispatcher ? { dispatcher } : {}
    };
    const fetchImpl = options.fetch ?? (process.versions.bun ? globalThis.fetch : undiciFetch);
    let response = await fetchImpl(upstreamUrl, requestInit).catch(async (error) => {
      await dispatcher?.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    });
    if (dispatcher) {
      dispatcher.close().catch(() => {
        return;
      }).finally(() => signal?.removeEventListener("abort", abortFromCaller));
    } else if (signal) {
      response = withResponseBodyCleanup(response, () => signal.removeEventListener("abort", abortFromCaller));
    }
    const responseRequestId = upstreamRequestId(response);
    responseDiagnostics.set(response, {
      clientRequestId,
      ...responseRequestId ? { upstreamRequestId: responseRequestId } : {}
    });
    writeProxyDebugLog("togetherlink proxy", options, "together response headers", {
      upstreamUrl,
      status: response.status,
      responseHeadersMs: Date.now() - startedAt,
      attempt,
      clientRequestId,
      ...responseRequestId ? { upstreamRequestId: responseRequestId } : {},
      headers: Object.fromEntries(response.headers.entries())
    });
    return response;
  } catch (err) {
    signal?.removeEventListener("abort", abortFromCaller);
    const reason = timeoutError ? "timeout" : signal?.aborted ? "caller_abort" : "network_error";
    const surfaced = timeoutError ?? err;
    await persistRequestDiagnostic({
      phase: "response_headers",
      reason,
      clientRequestId,
      model: modelFromSerializedBody(body),
      attempt,
      ...timeoutError ? { timeoutMs } : {},
      error: surfaced instanceof Error ? surfaced.message : String(surfaced)
    }).catch(() => {
      return;
    });
    throw surfaced;
  } finally {
    clearTimeout(timeout);
  }
}
function withResponseBodyCleanup(response, cleanup) {
  if (!response.body) {
    cleanup();
    return response;
  }
  const reader = response.body.getReader();
  let finished = false;
  const finish2 = () => {
    if (finished) {
      return;
    }
    finished = true;
    cleanup();
    reader.releaseLock();
  };
  const body = new ReadableStream({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          finish2();
          controller.close();
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        finish2();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        finish2();
      }
    }
  });
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
function responseHeaderTimeoutMs() {
  const raw = process.env.TOGETHERLINK_RESPONSE_HEADER_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(100, parsed) : DEFAULT_RESPONSE_HEADER_TIMEOUT_MS;
}
function streamRetries() {
  const raw = process.env.TOGETHERLINK_STREAM_RETRIES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_STREAM_RETRIES;
}
function responseHeaderRetries() {
  const raw = process.env.TOGETHERLINK_RESPONSE_HEADER_RETRIES ?? process.env.TOGETHERLINK_STREAM_RETRIES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_RESPONSE_HEADER_RETRIES;
}
function upstreamRequestId(response) {
  return response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? response.headers.get("cf-ray") ?? undefined;
}
function modelFromSerializedBody(body) {
  try {
    const parsed = JSON.parse(body);
    return typeof parsed.model === "string" ? parsed.model : undefined;
  } catch {
    return;
  }
}
async function fetchWithContextFit(payload, fit, doFetch) {
  let response = await doFetch(JSON.stringify(payload));
  const state = newContextFitState(payload);
  for (let attempt = 0;attempt < CONTEXT_FIT_MAX_ATTEMPTS; attempt += 1) {
    if (response.ok || response.status !== 400) {
      return response;
    }
    const text = await response.text();
    const outcome = applyContextFit(payload, text, fit.modelDefinition, state);
    if (!outcome.mutated) {
      return rebuildJsonResponse(text, response.status);
    }
    if (fit.debug) {
      process.stderr.write(`[togetherlink proxy] context-fit retry (${outcome.action}): ` + `input ${outcome.inputTokens} tokens vs window ${outcome.contextWindow}
`);
    }
    if (outcome.action !== "max_tokens") {
      (fit.onContextTrim ?? emitContextTrimAlarm)({
        path: "retry",
        model: typeof payload.model === "string" ? payload.model : "",
        trimmedChars: outcome.freedChars,
        inputTokens: outcome.inputTokens,
        contextWindow: outcome.contextWindow,
        action: outcome.action,
        hard: outcome.hard
      });
    }
    response = await doFetch(JSON.stringify(payload));
  }
  if (!response.ok && response.status === 400) {
    return rebuildJsonResponse(await response.text(), response.status);
  }
  return response;
}
function rebuildJsonResponse(body, status) {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" }
  });
}
function syntheticOverloadedResponse(message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status: 503,
    headers: { "content-type": "application/json" }
  });
}
function isRetryableStatus(status) {
  return RETRYABLE_STATUSES.has(status);
}
var RETRYABLE_STATUSES, MAX_RETRIES = 3, DEFAULT_STREAM_RETRIES = 1, DEFAULT_RESPONSE_HEADER_RETRIES = 0, DEFAULT_RESPONSE_HEADER_TIMEOUT_MS = 120000, responseDiagnostics, TogetherResponseHeaderTimeoutError;
var init_together_client = __esm(() => {
  init_together_core();
  init_request_diagnostics();
  init_proxy_debug();
  init_context_fit();
  RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
  responseDiagnostics = new WeakMap;
  TogetherResponseHeaderTimeoutError = class TogetherResponseHeaderTimeoutError extends Error {
    timeoutMs;
    requestId;
    constructor(timeoutMs, requestId) {
      super(`Together returned no response headers within ${timeoutMs}ms ` + `(client request ID: ${requestId}).`);
      this.timeoutMs = timeoutMs;
      this.requestId = requestId;
      this.name = "TogetherResponseHeaderTimeoutError";
    }
  };
});

// packages/cli/src/lib/claude/vision.ts
import { createHash } from "crypto";
function isImageBlock(block) {
  return typeof block === "object" && block !== null && block.type === "image";
}
function isUrlImageBlock(block) {
  return typeof block === "object" && block !== null && block.type === "url";
}
async function callVisionModel(model, imageUrl, options, signal) {
  const body = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }
    ],
    reasoning: { enabled: false },
    temperature: 0.6,
    top_p: 0.95,
    max_tokens: 800,
    stream: false
  };
  try {
    const response = await postChatCompletion(body, options, signal);
    const text = await response.text();
    if (!response.ok) {
      debug(options, "vision error", { model, status: response.status, body: text.slice(0, 500) });
      return { ok: false, model, error: `vision model returned ${response.status}` };
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, model, error: "vision model returned non-JSON" };
    }
    const message = json.choices?.[0]?.message;
    const description = (message?.content || message?.reasoning || "").trim();
    if (!description) {
      return { ok: false, model, error: "vision model returned empty content" };
    }
    const usage = json.usage ?? {};
    return {
      ok: true,
      model,
      description,
      usage: {
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        cachedTokens: usage.cached_tokens ?? 0
      }
    };
  } catch (err) {
    debug(options, "vision error", {
      model,
      error: err instanceof Error ? err.message : String(err)
    });
    return { ok: false, model, error: err instanceof Error ? err.message : String(err) };
  }
}
async function describeImage(block, options) {
  const imageUrl = toImageUrl(block);
  if (!imageUrl) {
    return { description: "[Image unavailable: could not read image data]", model: "none" };
  }
  const raceDelayMs = visionFailoverRaceDelayMs();
  if (raceDelayMs !== undefined && VISION_MODELS.length >= 2) {
    const raced = await describeImageWithDelayedFailoverRace(imageUrl, options, raceDelayMs);
    if (raced !== undefined) {
      return raced;
    }
  }
  for (const model of VISION_MODELS) {
    const outcome = await callVisionModel(model.id, imageUrl, options);
    if (outcome.ok) {
      return { description: outcome.description, model: outcome.model, usage: outcome.usage };
    }
    debug(options, "vision fallback", { from: outcome.model, reason: outcome.error });
  }
  return {
    description: "[Image description unavailable: all vision models failed]",
    model: "none"
  };
}
async function describeImageWithDelayedFailoverRace(imageUrl, options, delayMs) {
  const primary = VISION_MODELS[0];
  const fallback = VISION_MODELS[1];
  if (!primary || !fallback) {
    return;
  }
  const primaryController = new AbortController;
  let fallbackController;
  let fallbackStarted = false;
  let fallbackPromise;
  let fallbackTimer;
  const primaryPromise = callVisionModel(primary.id, imageUrl, options, primaryController.signal).then((outcome) => ({ source: "primary", outcome }));
  const startFallback = () => {
    fallbackStarted = true;
    fallbackController = new AbortController;
    fallbackPromise = callVisionModel(fallback.id, imageUrl, options, fallbackController.signal).then((outcome) => ({ source: "fallback", outcome }));
    return fallbackPromise;
  };
  const delayedFallbackPromise = new Promise((resolve) => {
    fallbackTimer = setTimeout(() => {
      startFallback().then(resolve);
    }, delayMs);
  });
  const first = await Promise.race([primaryPromise, delayedFallbackPromise]);
  if (first.outcome.ok) {
    if (fallbackTimer && !fallbackStarted) {
      clearTimeout(fallbackTimer);
    }
    if (first.source === "primary") {
      fallbackController?.abort();
    } else {
      primaryController.abort();
    }
    return {
      description: first.outcome.description,
      model: first.outcome.model,
      usage: first.outcome.usage
    };
  }
  debug(options, "vision fallback", { from: first.outcome.model, reason: first.outcome.error });
  if (fallbackTimer && !fallbackStarted) {
    clearTimeout(fallbackTimer);
    const second2 = await startFallback();
    if (second2.outcome.ok) {
      return {
        description: second2.outcome.description,
        model: second2.outcome.model,
        usage: second2.outcome.usage
      };
    }
    debug(options, "vision fallback", {
      from: second2.outcome.model,
      reason: second2.outcome.error
    });
    return;
  }
  const second = first.source === "primary" ? await fallbackPromise : await primaryPromise;
  if (second?.outcome.ok) {
    return {
      description: second.outcome.description,
      model: second.outcome.model,
      usage: second.outcome.usage
    };
  }
  if (second && !second.outcome.ok) {
    debug(options, "vision fallback", { from: second.outcome.model, reason: second.outcome.error });
  }
  return;
}
function visionFailoverRaceDelayMs() {
  const raw = process.env.TOGETHERLINK_VISION_FAILOVER_RACE_DELAY_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function toImageUrl(block) {
  if (isImageBlock(block)) {
    const { source } = block;
    if (source.type === "base64" && source.data && source.media_type) {
      return `data:${source.media_type};base64,${source.data}`;
    }
    if (source.type === "url" && source.url) {
      return source.url;
    }
    return null;
  }
  return block.url;
}
function imageBlockKey(block) {
  if (isImageBlock(block)) {
    const { source } = block;
    if (source.type === "base64" && source.data) {
      return `base64:${source.media_type ?? ""}:${createHash("sha256").update(source.data).digest("hex")}`;
    }
    if (source.type === "url" && source.url) {
      return `url:${source.url}`;
    }
    return `unknown:${JSON.stringify(source)}`;
  }
  return `url:${block.url}`;
}
function debug(options, label, value) {
  if (!options.debug) {
    return;
  }
  process.stderr.write(`[togetherlink vision] ${label}: ${JSON.stringify(value)}
`);
}
var init_vision = __esm(() => {
  init_dist3();
  init_together_client();
});

// packages/cli/src/lib/claude/translate-request.ts
function togetherReasoningEffort(body, targetModel) {
  const requestedEffort = body.reasoning_effort ?? body.effort ?? body.thinking?.effort;
  const normalizedEffort = normalizeReasoningEffort(requestedEffort);
  if (normalizedEffort && targetModel.reasoningEfforts?.includes(normalizedEffort)) {
    return normalizedEffort;
  }
  if (targetModel.id === GLM_5_2.id) {
    return normalizedEffort === "max" ? "max" : undefined;
  }
  return;
}
function normalizeReasoningEffort(value) {
  if (typeof value !== "string") {
    return;
  }
  const effort = value.toLowerCase();
  if (effort === "xhigh") {
    return "max";
  }
  if (effort === "low" || effort === "medium" || effort === "high" || effort === "max") {
    return effort;
  }
  return;
}
function toOpenAITools(tools, options) {
  if (!tools || tools.length === 0) {
    return;
  }
  const hasNativeWebSearch = tools.some(isNativeWebSearchTool);
  return tools.flatMap((tool) => {
    if (hasNativeWebSearch && !isNativeWebSearchTool(tool) && tool.name === "web_search") {
      debugLog(options, "dropped colliding custom web_search tool", {
        name: tool.name,
        type: tool.type
      });
      return [];
    }
    return [
      {
        type: "function",
        function: {
          name: openAIToolName(tool),
          description: tool.description ?? "",
          parameters: toOpenAIToolParameters(tool)
        }
      }
    ];
  });
}
function openAIToolName(tool) {
  return isNativeWebSearchTool(tool) ? "web_search" : tool.name ?? "tool";
}
function toOpenAIToolParameters(tool) {
  if (tool.input_schema) {
    return tool.input_schema;
  }
  if (isNativeWebSearchTool(tool)) {
    return {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query."
        }
      },
      required: ["query"],
      additionalProperties: false
    };
  }
  return { type: "object", properties: {} };
}
function toOpenAIToolChoice(toolChoice) {
  if (!toolChoice || typeof toolChoice !== "object") {
    return;
  }
  const choice = toolChoice;
  if (choice.type === "auto") {
    return "auto";
  }
  if (choice.type === "any") {
    return "required";
  }
  if (choice.type === "tool" && typeof choice.name === "string" && choice.name) {
    return { type: "function", function: { name: choice.name } };
  }
  return;
}
function nativeServerTools(tools) {
  return (tools ?? []).flatMap((tool) => {
    if (!isNativeWebSearchTool(tool)) {
      return [];
    }
    return [{ kind: "web_search", name: "web_search", definition: tool }];
  });
}
function isNativeWebSearchTool(tool) {
  return tool.type?.startsWith("web_search") === true;
}
function claudeNativeToolMaxUses(tool) {
  return nativeToolMaxUses(tool);
}
function withClaudeNativeToolSystemPrompt(messages, nativeTools) {
  return withNativeToolSystemPrompt(messages, nativeTools, {
    mergeLeadingSystemMessages,
    toolName: (tool) => tool.name
  });
}
async function runClaudeExaSearch(input, tool, options) {
  return runExaSearchDetailed({
    query: input,
    queryKeys: ["query", "q"],
    allowedDomains: stringArray(tool.allowed_domains, { requireTrimmed: false }),
    blockedDomains: stringArray(tool.blocked_domains, { requireTrimmed: false }),
    exaApiKey: process.env.EXA_API_KEY,
    debugLog: (label, value) => debugLog(options, label, value),
    missingApiKeyMessage: "Web search error: EXA_API_KEY is not set. Set it in the repo .env (EXA_API_KEY=...) and retry.",
    snippetLength: 600
  });
}
function toOpenAIMessages(body, targetModel) {
  const systemParts = [
    targetModel ? `${TOGETHERLINK_IDENTITY_PROMPT} Backend: ${targetModel.name} (${targetModel.id}).` : TOGETHERLINK_IDENTITY_PROMPT
  ];
  const system = stringifyAnthropicContent(body.system);
  if (system) {
    systemParts.push(system);
  }
  const messages = [{ role: "system", content: systemParts.join(`

`) }];
  for (const message of body.messages ?? []) {
    if (typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
      continue;
    }
    const textParts = [];
    const contentParts = [];
    let hasImageContent = false;
    const toolCalls = [];
    for (const block of message.content) {
      if (block.type === "text") {
        textParts.push(block.text);
        contentParts.push({ type: "text", text: block.text });
      } else if (targetModel?.attachment && (isImageBlock(block) || isUrlImageBlock(block))) {
        const imageUrl = toImageUrl(block);
        if (imageUrl) {
          contentParts.push({ type: "image_url", image_url: { url: imageUrl } });
          hasImageContent = true;
        }
      } else if (block.type === "thinking" || block.type === "redacted_thinking") {
        continue;
      } else if (block.type === "tool_result") {
        messages.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content: formatToolResultContent(block.content, block.is_error)
        });
        if (targetModel?.attachment && Array.isArray(block.content)) {
          let addedToolImageLabel = false;
          for (const innerBlock of block.content) {
            if (!isImageBlock(innerBlock) && !isUrlImageBlock(innerBlock)) {
              continue;
            }
            const imageUrl = toImageUrl(innerBlock);
            if (!imageUrl) {
              continue;
            }
            if (!addedToolImageLabel) {
              contentParts.push({
                type: "text",
                text: `Image returned by tool call ${block.tool_use_id}.`
              });
              addedToolImageLabel = true;
            }
            contentParts.push({ type: "image_url", image_url: { url: imageUrl } });
            hasImageContent = true;
          }
        }
      } else if (block.type === "web_search_tool_result" || block.type === "web_search_tool_result_error") {
        messages.push({
          role: "tool",
          tool_call_id: block.tool_use_id ?? "web_search",
          content: formatWebSearchToolResult(block)
        });
      } else if (block.type === "tool_use" || block.type === "server_tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) }
        });
      }
    }
    const content = hasImageContent ? contentParts : textParts.join(`
`);
    if (content.length > 0 || toolCalls.length > 0) {
      messages.push({
        role: message.role,
        content: typeof content === "string" ? content || null : content,
        ...toolCalls.length > 0 ? { tool_calls: toolCalls } : {}
      });
    }
  }
  return messages;
}
function mergeLeadingSystemMessages(messages) {
  const systemParts = [];
  let index = 0;
  while (index < messages.length && messages[index]?.role === "system") {
    const content = messages[index]?.content;
    if (typeof content === "string" && content.trim()) {
      systemParts.push(content);
    }
    index += 1;
  }
  if (systemParts.length === 0) {
    return messages.slice(index);
  }
  return [{ role: "system", content: systemParts.join(`

`) }, ...messages.slice(index)];
}
function debugLog(options, label, value) {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
var TOGETHERLINK_IDENTITY_PROMPT = "You are a Together AI model routed through togetherlink, not Anthropic Claude.";
var init_translate_request = __esm(() => {
  init_dist3();
  init_proxy_debug();
  init_content_format();
  init_vision();
});

// packages/cli/src/lib/stable-hash.ts
import { createHash as createHash2 } from "crypto";
function stableHash(value) {
  return createHash2("sha256").update(stableStringify(value)).digest("hex").slice(0, 16);
}
function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
var init_stable_hash = () => {
};

// packages/cli/src/lib/claude/context-budget.ts
function clampRequestedMaxTokens(maxTokens, model) {
  if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens)) {
    return maxTokens;
  }
  return Math.min(Math.max(CONTEXT_LENGTH_RETRY_FLOOR2, Math.floor(maxTokens)), model.limit.output);
}
function clampClaudeClientMaxTokens(maxTokens, model, options) {
  const clamped = clampRequestedMaxTokens(maxTokens, model);
  if (typeof clamped !== "number" || !Number.isFinite(clamped)) {
    return clamped;
  }
  const claudeCodeMaxOutputTokens = finiteTokenCount2(options.claudeCodeMaxOutputTokens) ?? CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS;
  const clientCap = options.claudeCodeMaxOutputTokensUserSet === true || options.isCompactionRequest === true ? claudeCodeMaxOutputTokens : Math.min(claudeCodeMaxOutputTokens, DEFAULT_CLAUDE_NORMAL_MAX_OUTPUT_TOKENS);
  return Math.min(clamped, clientCap);
}
function applyEstimatedContextBudget(payload, model, options, label, estimatedInputTokens) {
  const currentMaxTokens = payload.max_tokens;
  if (typeof currentMaxTokens !== "number" || !Number.isFinite(currentMaxTokens)) {
    return;
  }
  const estimatedInputTokensWithHeadroom = estimatedInputTokens * 1.15;
  if (currentMaxTokens <= model.limit.output && estimatedInputTokensWithHeadroom + currentMaxTokens + OUTPUT_SAFETY_TOKENS < model.limit.context) {
    return;
  }
  let refinedInputTokens = estimatePayloadInputTokens(payload);
  const reserveOverflowTokens = refinedInputTokens + currentMaxTokens + OUTPUT_SAFETY_TOKENS - model.limit.context;
  if (reserveOverflowTokens > 0) {
    const trimmed = trimPayloadInputByApproxTokens(payload, reserveOverflowTokens);
    if (trimmed) {
      refinedInputTokens = estimatePayloadInputTokens(payload);
      reportContextTrim(options, {
        path: "preemptive",
        model: typeof payload.model === "string" ? payload.model : "",
        trimmedChars: trimmed.trimmedChars,
        inputTokens: estimatedInputTokens,
        contextWindow: model.limit.context
      });
      debugLog2(options, `trimmed ${label} input to reserve requested output`, {
        model: payload.model,
        trimmedChars: trimmed.trimmedChars,
        requestedMaxTokens: currentMaxTokens,
        estimatedInputTokens: refinedInputTokens
      });
    }
  }
  const availableOutputTokens = Math.max(CONTEXT_LENGTH_RETRY_FLOOR2, Math.floor(model.limit.context - refinedInputTokens - OUTPUT_SAFETY_TOKENS));
  const nextMaxTokens = Math.min(currentMaxTokens, model.limit.output, availableOutputTokens);
  if (nextMaxTokens >= currentMaxTokens) {
    return;
  }
  if (options.isCompactionRequest) {
    debugLog2(options, `preserved ${label} compaction output budget for reactive context fit`, {
      model: payload.model,
      maxTokens: currentMaxTokens,
      estimatedAvailableOutputTokens: availableOutputTokens,
      estimatedInputTokens: refinedInputTokens
    });
    return;
  }
  payload.max_tokens = nextMaxTokens;
  debugLog2(options, `clamped ${label} max_tokens to estimated context budget`, {
    model: payload.model,
    maxTokens: nextMaxTokens,
    requestedMaxTokens: currentMaxTokens,
    estimatedInputTokens: refinedInputTokens
  });
}
function finiteTokenCount2(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return;
  }
  return Math.max(CONTEXT_LENGTH_RETRY_FLOOR2, Math.floor(value));
}
function estimatePayloadInputTokens(payload) {
  return Math.max(1, Math.ceil(jsonByteLength({
    messages: payload.messages,
    tools: payload.tools,
    tool_choice: payload.tool_choice
  }) / APPROX_CHARS_PER_TOKEN));
}
function trimPayloadInputByApproxTokens(payload, tokensToTrim) {
  if (tokensToTrim <= 0) {
    return;
  }
  return trimPayloadMessages(payload.messages, Math.max(1, Math.ceil(tokensToTrim * APPROX_CHARS_PER_TOKEN)));
}
function safeClaudeInputLimit(model) {
  return Math.max(1, model.limit.context - CONTEXT_INPUT_SAFETY_TOKENS);
}
function reportContextTrim(options, info) {
  const override = options.emitContextTrimAlarm;
  if (override) {
    override(info);
    return;
  }
  emitContextTrimAlarm(info);
}
function debugLog2(options, label, value) {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
var CONTEXT_LENGTH_RETRY_FLOOR2 = 1, CONTEXT_INPUT_SAFETY_TOKENS = 4096, CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS = 32000, DEFAULT_CLAUDE_NORMAL_MAX_OUTPUT_TOKENS = 28000;
var init_context_budget = __esm(() => {
  init_proxy_debug();
  init_context_fit();
  init_context_fit();
});

// packages/cli/src/lib/claude/native-web-search-response.ts
import { randomUUID as randomUUID3 } from "crypto";
function createClaudeNativeWebSearchRecord({
  input,
  outcome,
  fallbackErrorCode = "unavailable"
}) {
  return {
    id: `srvtoolu_${randomUUID3().replaceAll("-", "")}`,
    name: "web_search",
    input,
    result: searchResultContent(outcome, fallbackErrorCode)
  };
}
function nativeWebSearchBlocks(record) {
  return [
    {
      type: "server_tool_use",
      id: record.id,
      name: record.name,
      input: record.input
    },
    {
      type: "web_search_tool_result",
      tool_use_id: record.id,
      content: record.result
    }
  ];
}
function searchResultContent(outcome, fallbackErrorCode) {
  if (!outcome) {
    return { type: "web_search_tool_result_error", error_code: fallbackErrorCode };
  }
  if (outcome.errorCode) {
    return { type: "web_search_tool_result_error", error_code: outcome.errorCode };
  }
  return outcome.results.flatMap((result) => {
    const url = result.url?.trim();
    if (!url) {
      return [];
    }
    return [
      {
        type: "web_search_result",
        title: result.title?.trim() || "Untitled",
        url
      }
    ];
  });
}
var init_native_web_search_response = () => {
};

// packages/cli/src/lib/claude/translate-response.ts
import { randomUUID as randomUUID4 } from "crypto";
function thinkingSignature(reasoning) {
  return `togetherlink:${stableHash(reasoning)}`;
}
function resolveTargetModel(requestedModel, options) {
  const supported = CLAUDE_SUPPORTED_MODELS.find((model) => model.alias === requestedModel || model.definition.id === requestedModel);
  return supported ?? { alias: options.modelId, definition: options.modelDefinition };
}
function findClaudeModel(modelId, options) {
  const supported = CLAUDE_SUPPORTED_MODELS.find((model) => model.alias === modelId || model.definition.id === modelId);
  if (supported) {
    return supported;
  }
  if (modelId === options.modelId || modelId === options.targetModelId) {
    return { alias: options.modelId, definition: options.modelDefinition };
  }
  return;
}
function claudeModelResponse(model) {
  return {
    id: model.alias,
    type: "model",
    object: "model",
    display_name: `Together ${model.definition.name}`,
    max_input_tokens: safeClaudeInputLimit(model.definition),
    max_tokens: model.definition.limit.output,
    created_at: "2026-06-16T00:00:00Z"
  };
}
function countTokensResponse(body, options, rawBytes, estimator) {
  if (typeof rawBytes === "number" && rawBytes > 0) {
    const estimate = estimator?.estimate(rawBytes) ?? Math.ceil(rawBytes / APPROX_CHARS_PER_TOKEN);
    return { input_tokens: Math.max(1, estimate) };
  }
  const targetModel = options ? resolveTargetModel(body.model, options).definition : undefined;
  const estimatedBytes = jsonByteLength({
    messages: targetModel ? toOpenAIMessages({ ...body, max_tokens: 1 }, targetModel) : [
      {
        system: body.system,
        messages: body.messages
      }
    ],
    tools: body.tools,
    tool_choice: body.tool_choice
  });
  const estimatedTokens = Math.max(1, Math.ceil(estimatedBytes / APPROX_CHARS_PER_TOKEN));
  return {
    input_tokens: estimatedTokens
  };
}
function toAnthropicMessage(response, model) {
  const choice = response.choices?.[0];
  const message = choice?.message ?? {};
  const requestedMaxTokens = response._togetherlinkRequestedMaxTokens;
  const nativeWebSearches = response._togetherlinkNativeWebSearches ?? [];
  const content = [];
  const reasoning = message.reasoning ?? message.reasoning_content;
  if (reasoning) {
    content.push({
      type: "thinking",
      thinking: reasoning,
      signature: thinkingSignature(reasoning)
    });
  }
  for (const search of nativeWebSearches) {
    content.push(...nativeWebSearchBlocks(search));
  }
  if (message.content) {
    content.push({ type: "text", text: message.content });
  }
  for (const toolCall of message.tool_calls ?? []) {
    content.push({
      type: "tool_use",
      id: toolCall.id ?? `toolu_${randomUUID4().replaceAll("-", "")}`,
      name: toolCall.function?.name ?? "tool",
      input: parseJsonOrEmpty(toolCall.function?.arguments)
    });
  }
  return {
    id: response.id ?? `msg_${randomUUID4().replaceAll("-", "")}`,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: message.tool_calls?.length ? "tool_use" : mapStopReason(choice?.finish_reason, {
      outputTokens: response.usage?.completion_tokens,
      requestedMaxTokens
    }),
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0,
      ...nativeWebSearches.length > 0 ? { server_tool_use: { web_search_requests: nativeWebSearches.length } } : {}
    }
  };
}
var init_translate_response = __esm(() => {
  init_stable_hash();
  init_defaults();
  init_context_budget();
  init_content_format();
  init_native_web_search_response();
  init_translate_request();
});

// packages/cli/src/lib/claude/together-call.ts
async function fetchTogether(payload, options, modelDefinition, signal) {
  const response = await postChatCompletion(payload, options, signal, {
    modelDefinition,
    debug: options.debug
  });
  if (response.ok) {
    return { ok: true, json: await response.json() };
  }
  const error = await mapTogetherError(response);
  debugLog3(options, "together error", {
    status: error.status,
    anthropicType: error.anthropicType,
    code: error.code,
    retryable: error.retryable,
    body: error.message.slice(0, 1000)
  });
  return { ok: false, error };
}
async function mapTogetherError(response) {
  const raw = await response.text();
  let code;
  let message = raw.slice(0, 500);
  try {
    const parsed = JSON.parse(raw);
    const err = parsed.error;
    if (err) {
      code = err.code ?? (typeof err.message === "object" ? err.message.code : undefined);
      const msg = typeof err.message === "object" ? err.message.message : typeof err.message === "string" ? err.message : undefined;
      message = msg ?? err.type ?? message;
    }
  } catch {
  }
  const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
  const retryable = isRetryableStatus(response.status) || typeof code === "string" && RETRYABLE_ERROR_CODES.has(code);
  const mapped = mapStatusToAnthropicError(response.status);
  return {
    status: response.status,
    anthropicStatus: mapped.status,
    anthropicType: mapped.type,
    message: `Together API returned ${response.status}: ${message}`,
    code,
    retryAfterMs,
    retryable
  };
}
function mapStatusToAnthropicError(status) {
  switch (status) {
    case 400:
      return { status: 400, type: "invalid_request_error" };
    case 401:
      return { status: 401, type: "authentication_error" };
    case 402:
      return { status: 402, type: "billing_error" };
    case 403:
      return { status: 403, type: "permission_error" };
    case 404:
      return { status: 404, type: "not_found_error" };
    case 408:
      return { status: 408, type: "timeout_error" };
    case 429:
      return { status: 429, type: "rate_limit_error" };
    case 503:
      return { status: 503, type: "overloaded_error" };
    case 500:
    case 502:
    case 504:
      return { status: 500, type: "api_error" };
    default:
      return { status: status || 500, type: "api_error" };
  }
}
function writeAnthropicError(res, status, type, message) {
  writeJson(res, status, {
    type: "error",
    error: { type, message }
  });
}
function isTogetherApiError(value) {
  return typeof value === "object" && value !== null && "anthropicType" in value && "anthropicStatus" in value && "retryable" in value;
}
function debugLog3(options, label, value) {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
var RETRYABLE_ERROR_CODES;
var init_together_call = __esm(() => {
  init_http_util();
  init_proxy_debug();
  init_together_client();
  RETRYABLE_ERROR_CODES = new Set(["overloaded", "service_unavailable"]);
});

// packages/cli/src/lib/native-web-search.ts
async function runNativeWebSearchCall({
  name,
  priorUses,
  maxUses,
  isWebSearch,
  recordUse,
  runSearch
}) {
  if (priorUses >= maxUses) {
    return `Web search error: max_uses_exceeded for ${name}. Do not call this tool again; answer from the results already provided or say search is unavailable.`;
  }
  if (!isWebSearch) {
    return "Unsupported native server tool.";
  }
  recordUse();
  return await runSearch();
}

// packages/cli/src/lib/sse.ts
function consumeSseLines(buffer, onData) {
  let consumed = 0;
  for (;; ) {
    const boundary = findSseBoundary(buffer, consumed);
    if (!boundary) {
      break;
    }
    const data = sseDataPayload(buffer.slice(consumed, boundary.index));
    if (data !== undefined) {
      onData(data);
    }
    consumed = boundary.index + boundary.length;
  }
  return buffer.slice(consumed);
}
function* takeSseEvents(buffer) {
  let current = buffer;
  let boundary = findSseBoundary(current);
  while (boundary) {
    const rawEvent = current.slice(0, boundary.index);
    current = current.slice(boundary.index + boundary.length);
    yield { payload: sseEventPayload(rawEvent), remaining: current };
    boundary = findSseBoundary(current);
  }
}
function findSseBoundary(buffer, fromIndex = 0) {
  let newline = buffer.indexOf(`
`, fromIndex);
  while (newline !== -1) {
    const next = newline + 1;
    const nextCode = buffer.charCodeAt(next);
    if (nextCode === 10) {
      return { index: newline, length: 2 };
    }
    if (nextCode === 13 && buffer.charCodeAt(next + 1) === 10) {
      return { index: newline, length: 3 };
    }
    if (newline > fromIndex && buffer.charCodeAt(newline - 1) === 13) {
      if (nextCode === 10) {
        return { index: newline - 1, length: 3 };
      }
      if (nextCode === 13 && buffer.charCodeAt(next + 1) === 10) {
        return { index: newline - 1, length: 4 };
      }
    }
    newline = buffer.indexOf(`
`, next);
  }
  return;
}
function sseDataPayload(rawEvent) {
  let payload = "";
  let hasData = false;
  let lineStart = 0;
  for (;; ) {
    let lineEnd = rawEvent.indexOf(`
`, lineStart);
    if (lineEnd === -1) {
      lineEnd = rawEvent.length;
    }
    const line = lineEnd > lineStart && rawEvent.charCodeAt(lineEnd - 1) === 13 ? rawEvent.slice(lineStart, lineEnd - 1) : rawEvent.slice(lineStart, lineEnd);
    if (line.startsWith("data:")) {
      const valueStart = line.charCodeAt(5) === 32 ? 6 : 5;
      if (hasData) {
        payload += `
`;
      }
      payload += line.slice(valueStart);
      hasData = true;
    }
    if (lineEnd === rawEvent.length) {
      break;
    }
    lineStart = lineEnd + 1;
  }
  return hasData ? payload : undefined;
}
function sseEventPayload(rawEvent) {
  return sseDataPayload(rawEvent) ?? "";
}
function createSseIdleWatchdog(idleTimeoutMs, createTimeoutError = () => new Error(`SSE stream produced no event for ${idleTimeoutMs}ms.`)) {
  let timer;
  let rejectIdle;
  let disposed = false;
  const arm = () => {
    if (disposed) {
      return;
    }
    if (timer) {
      timer.refresh();
      return;
    }
    timer = setTimeout(() => {
      const reject = rejectIdle;
      rejectIdle = undefined;
      timer = undefined;
      reject?.(createTimeoutError());
    }, idleTimeoutMs);
  };
  return {
    async read(reader) {
      const idle = new Promise((_3, reject) => {
        rejectIdle = reject;
      });
      arm();
      try {
        return await Promise.race([reader.read(), idle]);
      } finally {
        rejectIdle = undefined;
      }
    },
    dispose() {
      disposed = true;
      rejectIdle = undefined;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    }
  };
}
function writeSse(res, event, data) {
  res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
}

// packages/cli/src/lib/together-stream.ts
async function* readTogetherSseWithRetry(initialResponse, retry, options) {
  const idleTimeoutMs = streamIdleTimeoutMs();
  const turnTimeoutMs = streamTurnTimeoutMs();
  const maxRetries = streamRetries2();
  let response = initialResponse;
  let attempt = 0;
  for (;; ) {
    await cancelResponseIfAborted(response, options.signal);
    try {
      for await (const data of readResponseSse(response, idleTimeoutMs, turnTimeoutMs, options.signal)) {
        yield { data, attempt };
      }
      return;
    } catch (err) {
      throwIfAborted(options.signal);
      if (!(err instanceof TogetherSseIdleTimeoutError) && !(err instanceof TogetherSsePrematureCloseError)) {
        throw err;
      }
      await persistStreamDiagnostic(response, err, attempt);
      if (options.isOutputStarted() || attempt >= maxRetries) {
        throw err;
      }
      options.onRetry?.({
        attempt,
        maxRetries,
        timeoutMs: err instanceof TogetherSseTurnTimeoutError ? err.timeoutMs : idleTimeoutMs,
        reason: err instanceof TogetherSseTurnTimeoutError ? "turn_timeout" : err instanceof TogetherSseIdleTimeoutError ? "idle_timeout" : "premature_close"
      });
      await sleepWithSignal(backoffMs(attempt), options.signal);
      const next = await retry();
      await cancelResponseIfAborted(next, options.signal);
      if (!next.ok) {
        throw new TogetherSseRetryResponseError(next);
      }
      if (!next.body) {
        throw new Error("Together returned no stream body after an SSE idle retry.");
      }
      response = next;
      attempt += 1;
    }
  }
}
async function* readResponseSse(response, idleTimeoutMs, turnTimeoutMs, signal) {
  if (!response.body) {
    throw new Error("Together returned no stream body.");
  }
  const diagnostics = getTogetherResponseDiagnostics(response);
  const reader = response.body.getReader();
  const cancelForCallerAbort = () => {
    reader.cancel(abortReason(signal)).catch(() => {
      return;
    });
  };
  signal?.addEventListener("abort", cancelForCallerAbort, { once: true });
  if (signal?.aborted) {
    cancelForCallerAbort();
  }
  const decoder = new TextDecoder;
  const watchdog = createSseIdleWatchdog(idleTimeoutMs, () => new TogetherSseIdleTimeoutError(idleTimeoutMs, diagnostics?.clientRequestId, diagnostics?.upstreamRequestId));
  let turnError;
  const turnTimer = turnTimeoutMs === undefined ? undefined : setTimeout(() => {
    turnError = new TogetherSseTurnTimeoutError(turnTimeoutMs, diagnostics?.clientRequestId, diagnostics?.upstreamRequestId);
    reader.cancel(turnError).catch(() => {
      return;
    });
  }, turnTimeoutMs);
  turnTimer?.unref?.();
  let buffer = "";
  let sawDone = false;
  let reachedEof = false;
  try {
    for (;; ) {
      throwIfAborted(signal);
      if (turnError) {
        throw turnError;
      }
      const read = await watchdog.read(reader);
      throwIfAborted(signal);
      if (turnError) {
        throw turnError;
      }
      if (read.done) {
        reachedEof = true;
        break;
      }
      buffer += decoder.decode(read.value, { stream: true });
      for (const event of takeSseEvents(buffer)) {
        buffer = event.remaining;
        if (event.payload) {
          if (event.payload === "[DONE]") {
            sawDone = true;
          }
          yield event.payload;
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      await reader.cancel(abortReason(signal)).catch(() => {
        return;
      });
      throw abortReason(signal);
    }
    if (err instanceof TogetherSseIdleTimeoutError || err instanceof TogetherSseTurnTimeoutError) {
      await reader.cancel(err).catch(() => {
        return;
      });
      throw err;
    }
    const prematureClose = new TogetherSsePrematureCloseError(diagnostics?.clientRequestId, diagnostics?.upstreamRequestId, err);
    throw prematureClose;
  } finally {
    if (turnTimer !== undefined) {
      clearTimeout(turnTimer);
    }
    watchdog.dispose();
    signal?.removeEventListener("abort", cancelForCallerAbort);
    if (!reachedEof) {
      await reader.cancel().catch(() => {
        return;
      });
    }
    reader.releaseLock();
  }
  throwIfAborted(signal);
  if (turnError) {
    throw turnError;
  }
  buffer += decoder.decode();
  const trailing = buffer.trim();
  if (trailing) {
    const payload = sseEventPayload(trailing);
    if (payload) {
      if (payload === "[DONE]") {
        sawDone = true;
      }
      yield payload;
    }
  }
  if (!sawDone) {
    throw new TogetherSsePrematureCloseError(diagnostics?.clientRequestId, diagnostics?.upstreamRequestId);
  }
}
function abortReason(signal) {
  return signal?.reason ?? new DOMException("The operation was aborted.", "AbortError");
}
function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw abortReason(signal);
  }
}
async function cancelResponseIfAborted(response, signal) {
  if (!signal?.aborted) {
    return;
  }
  await response.body?.cancel(abortReason(signal)).catch(() => {
    return;
  });
  throw abortReason(signal);
}
async function sleepWithSignal(ms, signal) {
  if (!signal) {
    await sleep(ms);
    return;
  }
  throwIfAborted(signal);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    timer.unref?.();
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
async function persistStreamDiagnostic(response, error, attempt) {
  const diagnostics = getTogetherResponseDiagnostics(response);
  if (!diagnostics) {
    return;
  }
  await persistRequestDiagnostic({
    phase: "sse",
    reason: error instanceof TogetherSseTurnTimeoutError ? "turn_timeout" : error instanceof TogetherSseIdleTimeoutError ? "idle_timeout" : "premature_close",
    clientRequestId: diagnostics.clientRequestId,
    upstreamRequestId: diagnostics.upstreamRequestId,
    attempt,
    ...error instanceof TogetherSseIdleTimeoutError ? { timeoutMs: error.timeoutMs } : {},
    error: error.message
  }).catch(() => {
    return;
  });
}
function streamIdleTimeoutMs() {
  const raw = process.env.TOGETHERLINK_STREAM_IDLE_TIMEOUT_MS ?? process.env.TOGETHERLINK_CODEX_STREAM_IDLE_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(100, parsed) : DEFAULT_STREAM_IDLE_TIMEOUT_MS;
}
function streamTurnTimeoutMs() {
  const raw = process.env.TOGETHERLINK_STREAM_TURN_TIMEOUT_MS ?? process.env.TOGETHERLINK_CODEX_STREAM_TURN_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(100, parsed) : undefined;
}
function streamRetries2() {
  const raw = process.env.TOGETHERLINK_STREAM_RETRIES ?? process.env.TOGETHERLINK_CODEX_STREAM_IDLE_RETRIES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_STREAM_RETRIES2;
}
var DEFAULT_STREAM_IDLE_TIMEOUT_MS = 120000, DEFAULT_STREAM_RETRIES2 = 1, TogetherSseIdleTimeoutError, TogetherSseTurnTimeoutError, TogetherSsePrematureCloseError, TogetherSseRetryResponseError;
var init_together_stream = __esm(() => {
  init_together_client();
  init_request_diagnostics();
  TogetherSseIdleTimeoutError = class TogetherSseIdleTimeoutError extends Error {
    timeoutMs;
    clientRequestId;
    upstreamRequestId;
    constructor(timeoutMs, clientRequestId, upstreamRequestId2) {
      const ids = [
        clientRequestId ? `client request ID: ${clientRequestId}` : undefined,
        upstreamRequestId2 ? `upstream request ID: ${upstreamRequestId2}` : undefined
      ].filter(Boolean);
      super(`Together stream produced no SSE event for ${timeoutMs}ms.` + (ids.length > 0 ? ` (${ids.join(", ")})` : ""));
      this.timeoutMs = timeoutMs;
      this.clientRequestId = clientRequestId;
      this.upstreamRequestId = upstreamRequestId2;
      this.name = "TogetherSseIdleTimeoutError";
    }
  };
  TogetherSseTurnTimeoutError = class TogetherSseTurnTimeoutError extends TogetherSseIdleTimeoutError {
    constructor(timeoutMs, clientRequestId, upstreamRequestId2) {
      super(timeoutMs, clientRequestId, upstreamRequestId2);
      const ids = [
        clientRequestId ? `client request ID: ${clientRequestId}` : undefined,
        upstreamRequestId2 ? `upstream request ID: ${upstreamRequestId2}` : undefined
      ].filter(Boolean);
      this.message = `Together stream exceeded maximum turn duration of ${timeoutMs}ms.` + (ids.length > 0 ? ` (${ids.join(", ")})` : "");
      this.name = "TogetherSseTurnTimeoutError";
    }
  };
  TogetherSsePrematureCloseError = class TogetherSsePrematureCloseError extends Error {
    clientRequestId;
    upstreamRequestId;
    constructor(clientRequestId, upstreamRequestId2, cause) {
      const ids = [
        clientRequestId ? `client request ID: ${clientRequestId}` : undefined,
        upstreamRequestId2 ? `upstream request ID: ${upstreamRequestId2}` : undefined
      ].filter(Boolean);
      const causeMessage = cause instanceof Error ? cause.message : undefined;
      super("Together stream closed before the [DONE] event." + (causeMessage ? ` Upstream reader error: ${causeMessage}.` : "") + (ids.length > 0 ? ` (${ids.join(", ")})` : ""), { cause });
      this.clientRequestId = clientRequestId;
      this.upstreamRequestId = upstreamRequestId2;
      this.name = "TogetherSsePrematureCloseError";
    }
  };
  TogetherSseRetryResponseError = class TogetherSseRetryResponseError extends Error {
    response;
    constructor(response) {
      super(`Together SSE retry returned HTTP ${response.status}.`);
      this.response = response;
      this.name = "TogetherSseRetryResponseError";
    }
  };
});

// packages/cli/src/lib/claude/stream.ts
import { randomUUID as randomUUID5 } from "crypto";
async function streamAnthropicFromTogether(res, body, options, signal, perf) {
  const run = () => {
    const targetModel2 = resolveTargetModel(body.model, options);
    const messages = toOpenAIMessages(body, targetModel2.definition);
    const nativeTools2 = nativeServerTools(body.tools);
    const upstreamMessages2 = nativeTools2.length > 0 ? withClaudeNativeToolSystemPrompt(messages, nativeTools2) : messages;
    const tools2 = toOpenAITools(body.tools, options);
    const reasoningEffort2 = options.isCompactionRequest ? undefined : togetherReasoningEffort(body, targetModel2.definition);
    const maxTokens2 = clampClaudeClientMaxTokens(body.max_tokens, targetModel2.definition, options);
    return {
      targetModel: targetModel2,
      messages,
      nativeTools: nativeTools2,
      upstreamMessages: upstreamMessages2,
      tools: tools2,
      reasoningEffort: reasoningEffort2,
      maxTokens: maxTokens2
    };
  };
  const translated = perf ? perf.spanSync("translate_request", run) : run();
  const { targetModel, nativeTools, upstreamMessages, tools, reasoningEffort } = translated;
  const { maxTokens } = translated;
  const payload = {
    model: targetModel.definition.id,
    messages: upstreamMessages,
    max_tokens: maxTokens,
    stop: body.stop_sequences,
    temperature: body.temperature,
    tools,
    tool_choice: toOpenAIToolChoice(body.tool_choice),
    ...options.isCompactionRequest ? { reasoning: { enabled: false } } : reasoningEffort ? { reasoning_effort: reasoningEffort } : {},
    chat_template_kwargs: { clear_thinking: options.isCompactionRequest === true },
    stream: true,
    stream_options: { include_usage: true }
  };
  const estimatedInputTokens = estimateInputTokensFromRawBytes(options);
  applyEstimatedContextBudget(payload, targetModel.definition, options, "stream", estimatedInputTokens);
  debugLog4(options, "together stream request", {
    model: payload.model,
    messageCount: payload.messages.length,
    toolCount: payload.tools?.length ?? 0,
    maxTokens: payload.max_tokens,
    reasoningEffort
  });
  let response;
  try {
    response = await postTogetherStream(payload, options, signal, perf);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = err instanceof TogetherResponseHeaderTimeoutError;
    writeAnthropicError(res, timedOut ? 504 : 503, timedOut ? "timeout_error" : "overloaded_error", message);
    return { ok: false, status: timedOut ? 504 : 503, error: message };
  }
  if (!response.ok) {
    const error = await mapTogetherError(response);
    debugLog4(options, "together stream error", {
      status: error.status,
      anthropicType: error.anthropicType,
      code: error.code,
      body: error.message.slice(0, 1000)
    });
    writeAnthropicError(res, error.anthropicStatus, error.anthropicType, error.message);
    return { ok: false, status: error.anthropicStatus, error: error.message };
  }
  if (!response.body) {
    const message = "Together returned no stream body.";
    writeAnthropicError(res, 500, "api_error", message);
    return { ok: false, status: 500, error: message };
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.flushHeaders?.();
  res.socket?.setNoDelay(true);
  const messageId = `msg_${randomUUID5().replaceAll("-", "")}`;
  const model = body.model ?? options.modelId;
  writeSse(res, "message_start", {
    type: "message_start",
    message: {
      id: messageId,
      type: "message",
      role: "assistant",
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 }
    }
  });
  if (nativeTools.length > 0) {
    try {
      return await streamAnthropicNativeToolLoop({
        res,
        initialResponse: response,
        initialPayload: payload,
        initialMessages: upstreamMessages.slice(),
        nativeTools,
        targetModel: targetModel.definition,
        model,
        options,
        ...signal ? { signal } : {}
      });
    } catch (err) {
      if (signal?.aborted) {
        return clientDisconnectedResult();
      }
      if (err instanceof TogetherSsePrematureCloseError) {
        return failAnthropicStream(res, 502, "api_error", err.message);
      }
      if (err instanceof TogetherSseIdleTimeoutError) {
        return failAnthropicStream(res, 504, "timeout_error", err.message);
      }
      if (err instanceof TogetherSseRetryResponseError) {
        const mapped = await mapTogetherError(err.response);
        return failAnthropicStream(res, mapped.anthropicStatus, mapped.anthropicType, mapped.message);
      }
      throw err;
    }
  }
  const blockManager = new StreamBlockManager(res, new StreamOutputBudget(options));
  let stopReason = "end_turn";
  let upstreamFinishReason = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let streamAttempt = 0;
  const pendingToolCalls = new Map;
  try {
    for await (const eventData of readTogetherSseWithRetry(response, () => postTogetherStream(payload, options, signal, perf, "upstream_fetch_retry"), {
      isOutputStarted: () => blockManager.hasActionableOutput(),
      onRetry: ({ attempt, maxRetries, timeoutMs, reason }) => debugLog4(options, "retrying together stream", {
        attempt,
        maxRetries,
        model: payload.model,
        reason,
        timeoutMs
      }),
      ...signal ? { signal } : {}
    })) {
      if (eventData.attempt !== streamAttempt) {
        streamAttempt = eventData.attempt;
        upstreamFinishReason = null;
        inputTokens = 0;
        outputTokens = 0;
        cachedTokens = 0;
        pendingToolCalls.clear();
      }
      const event = parseStreamData(eventData.data);
      if (!event) {
        continue;
      }
      const delta = event.delta;
      if (delta) {
        const reasoning = delta.reasoning ?? delta.reasoning_content;
        if (typeof reasoning === "string" && reasoning.length > 0) {
          if (options.isCompactionRequest) {
            perf?.markOnce("first_delta", { kind: "text" });
            blockManager.emitText(reasoning);
          } else {
            perf?.markOnce("first_delta", { kind: "thinking" });
            blockManager.emitThinking(reasoning);
          }
        }
        if (typeof delta.content === "string" && delta.content.length > 0) {
          perf?.markOnce("first_delta", { kind: "text" });
          blockManager.emitText(delta.content);
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const chunk of delta.tool_calls) {
            perf?.markOnce("first_delta", { kind: "tool_call" });
            const index = typeof chunk.index === "number" ? chunk.index : 0;
            const existing = pendingToolCalls.get(index) ?? {
              index,
              function: { arguments: "" }
            };
            if (chunk.id) {
              existing.id = chunk.id;
            }
            if (chunk.function?.name) {
              existing.function.name = chunk.function.name;
            }
            if (chunk.function?.arguments) {
              existing.function.arguments += chunk.function.arguments;
            }
            pendingToolCalls.set(index, existing);
          }
        }
      }
      if (event.usage) {
        inputTokens = event.usage.prompt_tokens ?? inputTokens;
        outputTokens = event.usage.completion_tokens ?? outputTokens;
        cachedTokens = event.usage.prompt_tokens_details?.cached_tokens ?? event.usage.cached_tokens ?? cachedTokens;
      }
      if (event.finish_reason) {
        upstreamFinishReason = event.finish_reason;
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      return clientDisconnectedResult();
    }
    debugLog4(options, "together stream read error", {
      error: err instanceof Error ? err.message : String(err)
    });
    if (err instanceof TogetherSsePrematureCloseError) {
      return failAnthropicStream(res, 502, "api_error", err.message);
    }
    if (err instanceof TogetherSseIdleTimeoutError) {
      return failAnthropicStream(res, 504, "timeout_error", err.message);
    }
    if (err instanceof TogetherSseRetryResponseError) {
      const mapped = await mapTogetherError(err.response);
      return failAnthropicStream(res, mapped.anthropicStatus, mapped.anthropicType, mapped.message);
    }
  }
  emitCollectedToolCalls(blockManager, [...pendingToolCalls.values()].sort((a3, b3) => a3.index - b3.index));
  stopReason = mapStopReason(upstreamFinishReason, {
    outputTokens,
    requestedMaxTokens: payload.max_tokens
  });
  if (options.isCompactionRequest && upstreamFinishReason === "length") {
    stopReason = "end_turn";
  }
  if (upstreamFinishReason === "length" && stopReason !== "max_tokens") {
    debugLog4(options, "downgraded short Together length stop", {
      outputTokens,
      requestedMaxTokens: payload.max_tokens
    });
  }
  blockManager.close();
  if (inputTokens > 0 || outputTokens > 0) {
    options.costTracker?.addUsage(inputTokens, cachedTokens, outputTokens, targetModel.definition);
  }
  debugLog4(options, "together stream done", {
    stopReason,
    usage: { inputTokens, outputTokens, cachedTokens },
    blocks: blockManager.summary(),
    outputBudget: blockManager.outputSummary()
  });
  writeSse(res, "message_delta", {
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { input_tokens: inputTokens, output_tokens: outputTokens }
  });
  writeSse(res, "message_stop", { type: "message_stop" });
  res.end();
  return { ok: true, status: res.statusCode };
}
function clientDisconnectedResult() {
  return { ok: false, status: 499, error: "Claude client disconnected." };
}
async function streamAnthropicNativeToolLoop({
  res,
  initialResponse,
  initialPayload,
  initialMessages,
  nativeTools,
  targetModel,
  model,
  options,
  signal
}) {
  const blockManager = new StreamBlockManager(res, new StreamOutputBudget(options));
  const nativeToolNames = new Set(nativeTools.map((tool) => tool.name));
  const nativeToolUses = new Map;
  const messages = initialMessages.slice();
  let response = initialResponse;
  let currentPayload = initialPayload;
  let stopReason = "end_turn";
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let nativeWebSearchCount = 0;
  for (let turn = 0;turn < 5; turn += 1) {
    const collected = await collectTogetherStreamTurn(response, options, initialPayload.max_tokens, () => postTogetherStream(currentPayload, options, signal), () => blockManager.hasOutput(), signal);
    inputTokens += collected.inputTokens;
    outputTokens += collected.outputTokens;
    cachedTokens += collected.cachedTokens;
    stopReason = collected.stopReason;
    const nativeToolCalls = collected.toolCalls.filter((toolCall) => nativeToolNames.has(toolCall.function.name ?? ""));
    if (nativeToolCalls.length === 0) {
      emitCollectedStreamTurn(blockManager, collected);
      break;
    }
    debugLog4(options, "stream native tool calls", {
      turn,
      toolCalls: nativeToolCalls.map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.function.name,
        argumentsPreview: toolCall.function.arguments.slice(0, 300)
      }))
    });
    messages.push({
      role: "assistant",
      content: collected.text || null,
      ...collected.reasoning ? { reasoning_content: collected.reasoning } : {},
      tool_calls: collected.toolCalls.map((toolCall) => ({
        id: toolCall.id ?? `call_${randomUUID5().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toolCall.function.name ?? "tool",
          arguments: toolCall.function.arguments || "{}"
        }
      }))
    });
    const toolResults = await Promise.all(nativeToolCalls.map(async (toolCall) => {
      const id = toolCall.id ?? `call_${randomUUID5().replaceAll("-", "")}`;
      const name = toolCall.function.name ?? "web_search";
      const nativeTool = nativeTools.find((tool) => tool.name === name);
      const input = parseJsonOrEmpty(toolCall.function.arguments);
      const priorUses = nativeToolUses.get(name) ?? 0;
      const maxUses = nativeTool ? claudeNativeToolMaxUses(nativeTool.definition) : 0;
      let searchOutcome;
      const result = await runNativeWebSearchCall({
        name,
        priorUses,
        maxUses,
        isWebSearch: nativeTool?.kind === "web_search",
        recordUse: () => nativeToolUses.set(name, priorUses + 1),
        runSearch: async () => {
          searchOutcome = await runClaudeExaSearch(input, nativeTool.definition, options);
          return searchOutcome.text;
        }
      });
      return {
        id,
        result,
        search: createClaudeNativeWebSearchRecord({
          input,
          outcome: searchOutcome,
          fallbackErrorCode: priorUses >= maxUses ? "max_uses_exceeded" : "unavailable"
        })
      };
    }));
    for (const { id, result, search } of toolResults) {
      messages.push({ role: "tool", tool_call_id: id, content: result });
      blockManager.emitNativeWebSearch(search);
      nativeWebSearchCount += 1;
    }
    const nextPayload = {
      ...initialPayload,
      messages,
      model: targetModel.id,
      stream: true,
      stream_options: { include_usage: true }
    };
    debugLog4(options, "together stream native continuation request", {
      model: nextPayload.model,
      messageCount: messages.length,
      toolCount: Array.isArray(nextPayload.tools) ? nextPayload.tools.length : 0,
      turn: turn + 1
    });
    let nextResponse;
    try {
      nextResponse = await postTogetherStream(nextPayload, options, signal);
    } catch (err) {
      emitCollectedStreamTurn(blockManager, {
        reasoning: "",
        text: `Native server tool continuation failed: ${err instanceof Error ? err.message : String(err)}`,
        toolCalls: [],
        stopReason: "end_turn",
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0
      });
      stopReason = "end_turn";
      break;
    }
    if (!nextResponse.ok || !nextResponse.body) {
      const error = !nextResponse.ok ? await mapTogetherError(nextResponse) : undefined;
      emitCollectedStreamTurn(blockManager, {
        reasoning: "",
        text: error?.message ?? "Together returned no stream body after native server tool execution.",
        toolCalls: [],
        stopReason: "end_turn",
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0
      });
      stopReason = "end_turn";
      break;
    }
    response = nextResponse;
    currentPayload = nextPayload;
  }
  blockManager.close();
  if (inputTokens > 0 || outputTokens > 0) {
    options.costTracker?.addUsage(inputTokens, cachedTokens, outputTokens, targetModel);
  }
  debugLog4(options, "together native stream done", {
    model,
    stopReason,
    usage: { inputTokens, outputTokens, cachedTokens },
    blocks: blockManager.summary(),
    outputBudget: blockManager.outputSummary()
  });
  writeSse(res, "message_delta", {
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      ...nativeWebSearchCount > 0 ? { server_tool_use: { web_search_requests: nativeWebSearchCount } } : {}
    }
  });
  writeSse(res, "message_stop", { type: "message_stop" });
  res.end();
  return { ok: true, status: res.statusCode };
}
async function postTogetherStream(payload, options, signal, perf, spanName = "upstream_fetch", spanFields) {
  const request = () => postChatCompletionStream(payload, options, signal, undefined, {
    modelDefinition: options.modelDefinition,
    debug: options.debug
  });
  return await (perf?.span(spanName, request, spanFields) ?? request());
}
async function collectTogetherStreamTurn(response, options, requestedMaxTokens, retry = async () => response, isOutputStarted = () => false, signal) {
  const toolCalls = new Map;
  let upstreamFinishReason = null;
  const turn = {
    reasoning: "",
    text: "",
    toolCalls: [],
    stopReason: "end_turn",
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0
  };
  if (!response.body) {
    return turn;
  }
  let streamAttempt = 0;
  try {
    for await (const eventData of readTogetherSseWithRetry(response, retry, {
      isOutputStarted,
      onRetry: ({ attempt, maxRetries, timeoutMs, reason }) => debugLog4(options, "retrying together native stream", {
        attempt,
        maxRetries,
        reason,
        timeoutMs
      }),
      ...signal ? { signal } : {}
    })) {
      if (eventData.attempt !== streamAttempt) {
        streamAttempt = eventData.attempt;
        toolCalls.clear();
        upstreamFinishReason = null;
        turn.reasoning = "";
        turn.text = "";
        turn.inputTokens = 0;
        turn.outputTokens = 0;
        turn.cachedTokens = 0;
      }
      const event = parseStreamData(eventData.data);
      if (!event) {
        continue;
      }
      const delta = event.delta;
      if (delta) {
        const reasoning = delta.reasoning ?? delta.reasoning_content;
        if (typeof reasoning === "string") {
          turn.reasoning += reasoning;
        }
        if (typeof delta.content === "string") {
          turn.text += delta.content;
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const chunk of delta.tool_calls) {
            const index = typeof chunk.index === "number" ? chunk.index : 0;
            const existing = toolCalls.get(index) ?? { index, function: { arguments: "" } };
            if (chunk.id) {
              existing.id = chunk.id;
            }
            if (chunk.function?.name) {
              existing.function.name = chunk.function.name;
            }
            if (chunk.function?.arguments) {
              existing.function.arguments += chunk.function.arguments;
            }
            toolCalls.set(index, existing);
          }
        }
      }
      if (event.usage) {
        turn.inputTokens = event.usage.prompt_tokens ?? turn.inputTokens;
        turn.outputTokens = event.usage.completion_tokens ?? turn.outputTokens;
        turn.cachedTokens = event.usage.prompt_tokens_details?.cached_tokens ?? event.usage.cached_tokens ?? turn.cachedTokens;
      }
      if (event.finish_reason) {
        upstreamFinishReason = event.finish_reason;
      }
    }
  } catch (err) {
    debugLog4(options, "together native stream read error", {
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
  turn.stopReason = mapStopReason(upstreamFinishReason, {
    outputTokens: turn.outputTokens,
    requestedMaxTokens
  });
  if (upstreamFinishReason === "length" && turn.stopReason !== "max_tokens") {
    debugLog4(options, "downgraded short Together native length stop", {
      outputTokens: turn.outputTokens,
      requestedMaxTokens
    });
  }
  turn.toolCalls = [...toolCalls.values()].sort((a3, b3) => a3.index - b3.index);
  return turn;
}
function emitCollectedStreamTurn(blockManager, turn) {
  if (turn.reasoning) {
    blockManager.emitThinking(turn.reasoning);
  }
  if (turn.text) {
    blockManager.emitText(turn.text);
  }
  emitCollectedToolCalls(blockManager, turn.toolCalls);
}
function emitCollectedToolCalls(blockManager, toolCalls) {
  for (const toolCall of toolCalls) {
    const fn = {
      arguments: toolCall.function.arguments
    };
    if (toolCall.function.name) {
      fn.name = toolCall.function.name;
    }
    const emittedToolCall = {
      index: toolCall.index,
      function: fn
    };
    if (toolCall.id) {
      emittedToolCall.id = toolCall.id;
    }
    blockManager.emitToolCall(emittedToolCall);
  }
}
function parseStreamData(data) {
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const obj = parsed;
  const choices = obj.choices;
  const choice = Array.isArray(choices) && choices.length > 0 ? choices[0] : null;
  return {
    delta: choice?.delta ?? null,
    usage: obj.usage ?? null,
    finish_reason: typeof choice?.finish_reason === "string" ? choice.finish_reason : null
  };
}

class StreamBlockManager {
  res;
  outputBudget;
  nextIndex = 0;
  openBlock = null;
  blockCount = 0;
  actionableOutputStarted = false;
  constructor(res, outputBudget) {
    this.res = res;
    this.outputBudget = outputBudget;
  }
  emitThinking(reasoning) {
    const emittedReasoning = this.outputBudget.takeThinking(reasoning);
    if (!emittedReasoning) {
      return;
    }
    if (!this.openBlock || this.openBlock.type !== "thinking") {
      this.closeOpenBlock();
      this.openBlock = { type: "thinking", index: this.nextIndex, reasoning: "" };
      writeSse(this.res, "content_block_start", {
        type: "content_block_start",
        index: this.openBlock.index,
        content_block: { type: "thinking", thinking: "", signature: "" }
      });
      this.blockCount += 1;
    }
    this.openBlock.reasoning += emittedReasoning;
    writeSse(this.res, "content_block_delta", {
      type: "content_block_delta",
      index: this.openBlock.index,
      delta: { type: "thinking_delta", thinking: emittedReasoning }
    });
  }
  emitText(text) {
    const emittedText = this.outputBudget.takeText(text);
    if (!emittedText) {
      return;
    }
    this.actionableOutputStarted = true;
    if (!this.openBlock || this.openBlock.type !== "text") {
      this.closeOpenBlock();
      this.openBlock = { type: "text", index: this.nextIndex };
      writeSse(this.res, "content_block_start", {
        type: "content_block_start",
        index: this.openBlock.index,
        content_block: { type: "text", text: "" }
      });
      this.blockCount += 1;
    }
    writeSse(this.res, "content_block_delta", {
      type: "content_block_delta",
      index: this.openBlock.index,
      delta: { type: "text_delta", text: emittedText }
    });
  }
  emitToolCall(toolCall) {
    this.actionableOutputStarted = true;
    const tcIndex = typeof toolCall.index === "number" ? toolCall.index : 0;
    const name = toolCall.function?.name;
    const argsFragment = this.outputBudget.takeToolJson(toolCall.function?.arguments ?? "");
    const open = this.openBlock;
    if (open && open.type === "tool_use" && this.currentToolCallIndex === tcIndex) {
      if (argsFragment) {
        open.arguments += argsFragment;
        writeSse(this.res, "content_block_delta", {
          type: "content_block_delta",
          index: open.index,
          delta: { type: "input_json_delta", partial_json: argsFragment }
        });
      }
      return;
    }
    this.closeOpenBlock();
    const id = toolCall.id ?? `toolu_${randomUUID5().replaceAll("-", "")}`;
    const toolName = name ?? "tool";
    const block = {
      type: "tool_use",
      index: this.nextIndex,
      id,
      name: toolName,
      arguments: ""
    };
    this.openBlock = block;
    this.currentToolCallIndex = tcIndex;
    writeSse(this.res, "content_block_start", {
      type: "content_block_start",
      index: block.index,
      content_block: { type: "tool_use", id, name: toolName, input: {} }
    });
    this.blockCount += 1;
    if (argsFragment) {
      block.arguments += argsFragment;
      writeSse(this.res, "content_block_delta", {
        type: "content_block_delta",
        index: block.index,
        delta: { type: "input_json_delta", partial_json: argsFragment }
      });
    }
  }
  emitNativeWebSearch(search) {
    this.actionableOutputStarted = true;
    this.closeOpenBlock();
    const toolIndex = this.nextIndex;
    writeSse(this.res, "content_block_start", {
      type: "content_block_start",
      index: toolIndex,
      content_block: {
        type: "server_tool_use",
        id: search.id,
        name: search.name,
        input: {}
      }
    });
    writeSse(this.res, "content_block_delta", {
      type: "content_block_delta",
      index: toolIndex,
      delta: { type: "input_json_delta", partial_json: JSON.stringify(search.input ?? {}) }
    });
    writeSse(this.res, "content_block_stop", {
      type: "content_block_stop",
      index: toolIndex
    });
    this.nextIndex += 1;
    this.blockCount += 1;
    const resultIndex = this.nextIndex;
    writeSse(this.res, "content_block_start", {
      type: "content_block_start",
      index: resultIndex,
      content_block: {
        type: "web_search_tool_result",
        tool_use_id: search.id,
        content: search.result
      }
    });
    writeSse(this.res, "content_block_stop", {
      type: "content_block_stop",
      index: resultIndex
    });
    this.nextIndex += 1;
    this.blockCount += 1;
  }
  currentToolCallIndex = -1;
  closeOpenBlock() {
    if (!this.openBlock) {
      return;
    }
    if (this.openBlock.type === "thinking") {
      writeSse(this.res, "content_block_delta", {
        type: "content_block_delta",
        index: this.openBlock.index,
        delta: { type: "signature_delta", signature: thinkingSignature(this.openBlock.reasoning) }
      });
    }
    writeSse(this.res, "content_block_stop", {
      type: "content_block_stop",
      index: this.openBlock.index
    });
    this.nextIndex += 1;
    this.openBlock = null;
  }
  close() {
    this.closeOpenBlock();
  }
  hasOutput() {
    return this.blockCount > 0;
  }
  hasActionableOutput() {
    return this.actionableOutputStarted;
  }
  summary() {
    return `${this.blockCount} block(s)`;
  }
  outputSummary() {
    return this.outputBudget.summary();
  }
}
function failAnthropicStream(res, status, type, message) {
  writeSse(res, "error", { type: "error", error: { type, message } });
  res.end();
  return { ok: false, status, error: message };
}

class StreamOutputBudget {
  maxContentChars;
  maxThinkingChars;
  contentChars = 0;
  thinkingChars = 0;
  droppedThinkingChars = 0;
  droppedContentChars = 0;
  constructor(options) {
    const claudeMaxTokens = finitePositiveInteger(options.claudeCodeMaxOutputTokens) ?? CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS2;
    const safeContentTokens = Math.max(1, claudeMaxTokens - CLAUDE_RESPONSE_OUTPUT_HEADROOM_TOKENS);
    this.maxContentChars = safeContentTokens * APPROX_CHARS_PER_TOKEN;
    this.maxThinkingChars = Math.min(safeContentTokens, CLAUDE_THINKING_OUTPUT_MAX_TOKENS) * APPROX_CHARS_PER_TOKEN;
  }
  takeThinking(value) {
    return this.take(value, true);
  }
  takeText(value) {
    return this.take(value, false);
  }
  takeToolJson(value) {
    return this.take(value, false);
  }
  summary() {
    return {
      contentChars: this.contentChars,
      thinkingChars: this.thinkingChars,
      droppedContentChars: this.droppedContentChars,
      droppedThinkingChars: this.droppedThinkingChars,
      maxContentChars: this.maxContentChars,
      maxThinkingChars: this.maxThinkingChars
    };
  }
  take(value, thinking) {
    if (!value) {
      return "";
    }
    const remainingContentChars = this.maxContentChars - this.contentChars;
    const remainingThinkingChars = thinking ? this.maxThinkingChars - this.thinkingChars : Infinity;
    const remaining = Math.max(0, Math.min(remainingContentChars, remainingThinkingChars));
    if (remaining <= 0) {
      this.drop(value.length, thinking);
      return "";
    }
    if (value.length <= remaining) {
      this.contentChars += value.length;
      if (thinking) {
        this.thinkingChars += value.length;
      }
      return value;
    }
    const emitted = value.slice(0, remaining);
    this.contentChars += emitted.length;
    if (thinking) {
      this.thinkingChars += emitted.length;
    }
    this.drop(value.length - emitted.length, thinking);
    return emitted;
  }
  drop(chars, thinking) {
    if (thinking) {
      this.droppedThinkingChars += chars;
    } else {
      this.droppedContentChars += chars;
    }
  }
}
function finitePositiveInteger(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return;
  }
  return Math.max(1, Math.floor(value));
}
function debugLog4(options, label, value) {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
function estimateInputTokensFromRawBytes(options) {
  const rawBytes = options.rawBytes;
  if (typeof rawBytes !== "number" || rawBytes <= 0) {
    return 1;
  }
  if (options.costTracker) {
    return options.costTracker.tokenEstimator.estimate(rawBytes);
  }
  return Math.max(1, Math.ceil(rawBytes / APPROX_CHARS_PER_TOKEN));
}
var CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS2 = 32000, CLAUDE_RESPONSE_OUTPUT_HEADROOM_TOKENS = 2048, CLAUDE_THINKING_OUTPUT_MAX_TOKENS = 8000;
var init_stream = __esm(() => {
  init_proxy_debug();
  init_together_client();
  init_together_stream();
  init_context_budget();
  init_content_format();
  init_native_web_search_response();
  init_translate_request();
  init_translate_response();
  init_together_call();
});

// packages/cli/src/lib/claude/vision-resolver.ts
class LruCache {
  map = new Map;
  maxEntries;
  maxBytes;
  sizeOf;
  bytes = 0;
  constructor(maxEntries, maxBytes, sizeOf) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.sizeOf = sizeOf ?? ((value) => typeof value === "string" ? value.length : 1);
  }
  get(key) {
    if (!this.map.has(key)) {
      return;
    }
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }
  set(key, value) {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      this.bytes -= this.sizeOf(existing);
      this.map.delete(key);
    }
    this.map.set(key, value);
    this.bytes += this.sizeOf(value);
    this.evict(key);
  }
  get size() {
    return this.map.size;
  }
  evict(justSet) {
    while (this.map.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.map.keys().next();
      if (oldest.done) {
        break;
      }
      const key = oldest.value;
      if (key === justSet) {
        break;
      }
      const value = this.map.get(key);
      this.bytes -= this.sizeOf(value);
      this.map.delete(key);
    }
    if (this.bytes < 0) {
      this.bytes = 0;
    }
  }
}
async function resolveImageBlocks(body, options) {
  const descriptions = new Map;
  const resolve = async (block) => {
    if (!isImageBlock(block) && !isUrlImageBlock(block)) {
      return block;
    }
    const key = imageBlockKey(block);
    let cached = descriptions.get(key) ?? imageDescriptionCache.get(key);
    if (cached === undefined) {
      debugLog5(options, "vision describe start", { key });
      const result = await describeImage(block, {
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        debug: options.debug,
        fetch: options.fetch
      });
      debugLog5(options, "vision describe done", {
        key,
        model: result.model,
        length: result.description.length,
        preview: result.description.slice(0, 200)
      });
      if (result.usage) {
        options.costTracker?.addVisionUsage(result.model, result.usage.promptTokens, result.usage.completionTokens);
      }
      cached = `${result.description}
[described by ${result.model}]`;
      imageDescriptionCache.set(key, cached);
    }
    descriptions.set(key, cached);
    return { type: "text", text: `[Image description]
${cached}` };
  };
  if (Array.isArray(body.system)) {
    body.system = await Promise.all(body.system.map((block) => resolve(block)));
  }
  for (const message of body.messages ?? []) {
    if (Array.isArray(message.content)) {
      message.content = await Promise.all(message.content.map(async (block) => {
        const resolved = await resolve(block);
        if (resolved.type === "tool_result" && Array.isArray(resolved.content)) {
          resolved.content = await Promise.all(resolved.content.map(async (innerBlock) => {
            return typeof innerBlock === "object" && innerBlock !== null ? await resolve(innerBlock) : innerBlock;
          }));
        }
        return resolved;
      }));
    }
  }
}
function extractImageBlocks(body) {
  const found = [];
  const knownTypes = new Set([
    "text",
    "thinking",
    "redacted_thinking",
    "tool_use",
    "server_tool_use",
    "tool_result",
    "tool_reference",
    "web_search_tool_result",
    "web_search_tool_result_error"
  ]);
  const inspectBlock = (block, location) => {
    if (typeof block !== "object" || block === null) {
      return;
    }
    const record = block;
    const type = record.type;
    const isImageLike = type === "image" || type === "url" || type === "document" || typeof type === "string" && !knownTypes.has(type);
    if (!isImageLike) {
      return;
    }
    const summary = { location, type, rawKeys: Object.keys(record) };
    const source = record.source;
    if (source) {
      summary.sourceType = source.type;
      summary.mediaType = source.media_type;
      const data = source.data;
      summary.dataPreview = typeof data === "string" ? `${data.slice(0, 32)}\u2026 (${data.length} chars)` : typeof data;
    }
    const url = record.url;
    if (typeof url === "string") {
      summary.urlPreview = url.length > 64 ? `${url.slice(0, 64)}\u2026` : url;
    }
    found.push(summary);
  };
  const inspectContent = (content, location) => {
    if (!Array.isArray(content)) {
      return;
    }
    for (const block of content) {
      inspectBlock(block, location);
      const inner = block?.content;
      if (Array.isArray(inner)) {
        for (const innerBlock of inner) {
          inspectBlock(innerBlock, `${location}/tool_result`);
        }
      }
    }
  };
  inspectContent(body.system, "system");
  for (const message of body.messages ?? []) {
    inspectContent(message.content, `messages[${message.role}]`);
  }
  return found;
}
function debugLog5(options, label, value) {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
var IMAGE_CACHE_MAX_ENTRIES = 64, IMAGE_CACHE_MAX_BYTES, imageDescriptionCache;
var init_vision_resolver = __esm(() => {
  init_proxy_debug();
  init_vision();
  IMAGE_CACHE_MAX_BYTES = 4 * 1024 * 1024;
  imageDescriptionCache = new LruCache(IMAGE_CACHE_MAX_ENTRIES, IMAGE_CACHE_MAX_BYTES);
});

// packages/cli/src/lib/claude/chat-completions.ts
import { randomUUID as randomUUID6 } from "crypto";
async function callTogetherChatCompletions(body, options, signal, perf) {
  const translated = perf?.spanSync("translate_request", () => {
    const targetModel2 = resolveTargetModel(body.model, options);
    const nativeTools2 = nativeServerTools(body.tools);
    const messages2 = toOpenAIMessages(body, targetModel2.definition);
    const tools2 = toOpenAITools(body.tools, options);
    return { targetModel: targetModel2, nativeTools: nativeTools2, messages: messages2, tools: tools2 };
  }) ?? (() => {
    const targetModel2 = resolveTargetModel(body.model, options);
    const nativeTools2 = nativeServerTools(body.tools);
    const messages2 = toOpenAIMessages(body, targetModel2.definition);
    const tools2 = toOpenAITools(body.tools, options);
    return { targetModel: targetModel2, nativeTools: nativeTools2, messages: messages2, tools: tools2 };
  })();
  const { targetModel, nativeTools, messages, tools } = translated;
  const nativeToolNames = new Set(nativeTools.map((tool) => tool.name));
  const nativeToolUses = new Map;
  const nativeWebSearches = [];
  for (let turn = 0;turn < 5; turn += 1) {
    const reasoningEffort = options.isCompactionRequest ? undefined : togetherReasoningEffort(body, targetModel.definition);
    const maxTokens = clampClaudeClientMaxTokens(body.max_tokens, targetModel.definition, options);
    const payload = {
      model: targetModel.definition.id,
      messages: turn === 0 && nativeTools.length > 0 ? withClaudeNativeToolSystemPrompt(messages, nativeTools) : messages,
      max_tokens: maxTokens,
      stop: body.stop_sequences,
      temperature: body.temperature,
      tools,
      tool_choice: toOpenAIToolChoice(body.tool_choice),
      ...options.isCompactionRequest ? { reasoning: { enabled: false } } : reasoningEffort ? { reasoning_effort: reasoningEffort } : {},
      chat_template_kwargs: { clear_thinking: options.isCompactionRequest === true },
      stream: false
    };
    const estimatedInputTokens = estimateInputTokensFromRawBytes2(options);
    applyEstimatedContextBudget(payload, targetModel.definition, options, "request", estimatedInputTokens);
    debugLog6(options, "together request", {
      model: payload.model,
      messageCount: payload.messages.length,
      toolCount: payload.tools?.length ?? 0,
      maxTokens: payload.max_tokens,
      reasoningEffort,
      nativeToolCount: nativeTools.length,
      turn
    });
    const response = await (perf?.span("upstream_fetch", () => fetchTogether(payload, options, targetModel.definition, signal), { turn }) ?? fetchTogether(payload, options, targetModel.definition, signal));
    if (!response.ok) {
      throw response.error;
    }
    const json = response.json;
    if (typeof payload.max_tokens === "number") {
      json._togetherlinkRequestedMaxTokens = payload.max_tokens;
    }
    const usage = json.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? usage?.cached_tokens ?? 0;
    const incrementalCost = options.costTracker?.addUsage(promptTokens, cachedTokens, completionTokens, targetModel.definition) ?? 0;
    debugLog6(options, "together response", {
      id: json.id,
      choices: json.choices?.length ?? 0,
      finishReason: json.choices?.[0]?.finish_reason,
      usage: { promptTokens, completionTokens, cachedTokens },
      incrementalCostUsd: Number(incrementalCost.toFixed(6)),
      toolCalls: json.choices?.[0]?.message?.tool_calls?.map((toolCall) => ({
        name: toolCall.function?.name,
        argumentsPreview: toolCall.function?.arguments?.slice(0, 300)
      }))
    });
    const toolCalls = json.choices?.[0]?.message?.tool_calls ?? [];
    const nativeToolCalls = toolCalls.filter((toolCall) => nativeToolNames.has(toolCall.function?.name ?? ""));
    if (nativeToolCalls.length === 0) {
      if (nativeWebSearches.length > 0) {
        json._togetherlinkNativeWebSearches = nativeWebSearches;
      }
      return json;
    }
    const reasoning = json.choices?.[0]?.message?.reasoning ?? json.choices?.[0]?.message?.reasoning_content;
    messages.push({
      role: "assistant",
      content: json.choices?.[0]?.message?.content ?? null,
      ...reasoning ? { reasoning_content: reasoning } : {},
      tool_calls: toolCalls.map((toolCall) => ({
        id: toolCall.id ?? `call_${randomUUID6().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toolCall.function?.name ?? "tool",
          arguments: toolCall.function?.arguments ?? "{}"
        }
      }))
    });
    for (const toolCall of nativeToolCalls) {
      const id = toolCall.id ?? `call_${randomUUID6().replaceAll("-", "")}`;
      const name = toolCall.function?.name ?? "web_search";
      const nativeTool = nativeTools.find((tool) => tool.name === name);
      const input = parseJsonOrEmpty(toolCall.function?.arguments);
      const priorUses = nativeToolUses.get(name) ?? 0;
      const maxUses = nativeTool ? claudeNativeToolMaxUses(nativeTool.definition) : 0;
      let searchOutcome;
      const result = await runNativeWebSearchCall({
        name,
        priorUses,
        maxUses,
        isWebSearch: nativeTool?.kind === "web_search",
        recordUse: () => nativeToolUses.set(name, priorUses + 1),
        runSearch: async () => {
          searchOutcome = await (perf?.span("native_tool", () => runClaudeExaSearch(input, nativeTool.definition, options), { name }) ?? runClaudeExaSearch(input, nativeTool.definition, options));
          return searchOutcome.text;
        }
      });
      nativeWebSearches.push(createClaudeNativeWebSearchRecord({
        input,
        outcome: searchOutcome,
        fallbackErrorCode: priorUses >= maxUses ? "max_uses_exceeded" : "unavailable"
      }));
      messages.push({ role: "tool", tool_call_id: id, content: result });
    }
  }
  const exhaustedResponse = {
    id: `msg_${randomUUID6().replaceAll("-", "")}`,
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: "I could not complete the native web search because the model kept requesting additional search tool calls."
        }
      }
    ]
  };
  if (nativeWebSearches.length > 0) {
    exhaustedResponse._togetherlinkNativeWebSearches = nativeWebSearches;
  }
  return exhaustedResponse;
}
function debugLog6(options, label, value) {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
function estimateInputTokensFromRawBytes2(options) {
  const rawBytes = options.rawBytes;
  if (typeof rawBytes !== "number" || rawBytes <= 0) {
    return 1;
  }
  if (options.costTracker) {
    return options.costTracker.tokenEstimator.estimate(rawBytes);
  }
  return Math.max(1, Math.ceil(rawBytes / APPROX_CHARS_PER_TOKEN));
}
var init_chat_completions = __esm(() => {
  init_proxy_debug();
  init_context_budget();
  init_content_format();
  init_native_web_search_response();
  init_translate_request();
  init_translate_response();
  init_together_call();
});

// packages/cli/src/lib/claude/compaction.ts
function tuneClaudeCompactionRequest(body, options = {}) {
  if (!isClaudeCompactionRequest(body)) {
    return { detected: false, userConfiguredClaudeMaxOutputTokens: false };
  }
  const requestedMaxTokens = finiteTokenCount3(body.max_tokens);
  const claudeCodeMaxOutputTokens = finiteTokenCount3(options.claudeCodeMaxOutputTokens) ?? CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS3;
  const userConfiguredClaudeMaxOutputTokens = options.userConfiguredClaudeMaxOutputTokens === true;
  const effectiveRequestedMaxTokens = requestedMaxTokens ?? claudeCodeMaxOutputTokens;
  const maxTokens = Math.min(effectiveRequestedMaxTokens, claudeCodeMaxOutputTokens);
  if (maxTokens !== undefined) {
    body.max_tokens = maxTokens;
    rewriteCompactionInstruction(body, maxTokens, userConfiguredClaudeMaxOutputTokens);
  }
  return {
    detected: true,
    requestedMaxTokens,
    maxTokens,
    userConfiguredClaudeMaxOutputTokens
  };
}
function isClaudeCompactionRequest(body) {
  const lastUserText = lastUserMessageText(body);
  return COMPACTION_SIGNATURES.every((signature) => lastUserText.includes(signature));
}
function rewriteCompactionInstruction(body, maxTokens, userConfiguredClaudeMaxOutputTokens) {
  const lastUser = [...body.messages ?? []].reverse().find((message) => message.role === "user");
  if (!lastUser) {
    return;
  }
  const instruction = boundedCompactionInstruction(maxTokens, userConfiguredClaudeMaxOutputTokens);
  if (typeof lastUser.content === "string") {
    lastUser.content = replaceUnboundedCompactionPrompt(lastUser.content, instruction);
    return;
  }
  if (Array.isArray(lastUser.content)) {
    for (const block of lastUser.content) {
      if (block.type === "text" && typeof block.text === "string") {
        block.text = replaceUnboundedCompactionPrompt(block.text, instruction);
      }
    }
  }
}
function replaceUnboundedCompactionPrompt(text, instruction) {
  const index = text.indexOf(COMPACTION_INSTRUCTION_START);
  if (index === -1) {
    return `${text.trimEnd()}

${instruction}`;
  }
  const prefix = text.slice(0, index).trimEnd();
  return prefix ? `${prefix}

${instruction}` : instruction;
}
function boundedCompactionInstruction(maxTokens, userConfiguredClaudeMaxOutputTokens) {
  return `Togetherlink bounded compaction request:

Respond with plain text only: a short <analysis> block followed by a <summary> block.

Hard budget:
- Finish the entire response under ${maxTokens} output tokens.
- Keep <analysis> under 150 words.
- Close both XML-ish tags. Do not continue until the token limit.

Write a durable handoff summary for continuing the coding task, but keep it bounded:
1. Primary request and current objective.
2. Important technical facts, decisions, and constraints.
3. Files touched/read and why they matter, using paths and concise descriptions.
4. Errors encountered and fixes or current hypotheses.
5. Current work and next concrete step.

Do not list every user message verbatim. Group repeated feedback.
Do not include full tool outputs, full diffs, or full code snippets unless a short snippet is essential.
Prefer precise file paths, commands, test results, and line-level facts over transcript prose.
Preserve security-relevant user constraints verbatim if any exist.
${userConfiguredClaudeMaxOutputTokens ? "The user configured CLAUDE_CODE_MAX_OUTPUT_TOKENS; honor that configured budget while staying concise." : ""}`;
}
function lastUserMessageText(body) {
  const lastUser = [...body.messages ?? []].reverse().find((message) => message.role === "user");
  return lastUser ? contentText(lastUser.content) : "";
}
function contentText(content) {
  if (typeof content === "string") {
    return content;
  }
  return content.map((block) => block.type === "text" && typeof block.text === "string" ? block.text : "").join(`
`);
}
function finiteTokenCount3(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : undefined;
}
var CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS3 = 32000, COMPACTION_SIGNATURES, COMPACTION_INSTRUCTION_START = "CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.";
var init_compaction = __esm(() => {
  COMPACTION_SIGNATURES = [
    "CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.",
    "Your entire response must be plain text: an <analysis> block followed by a <summary> block.",
    "Your task is to create a detailed summary"
  ];
});

// packages/cli/src/lib/claude/proxy.ts
async function handleProxyRequest(req, res, options) {
  const path7 = requestPath(req);
  const perf = createProxyPerfTracer("claude.proxy", {
    method: req.method,
    path: path7
  }, options.perfSink);
  debugLog7(options, "http request", { method: req.method, url: req.url, path: path7 });
  if (req.method === "HEAD" && path7 === "/") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method === "GET" && path7 === "/healthz") {
    writeJson(res, 200, { ok: true });
    return;
  }
  if (!isAuthorized(req, options.authToken)) {
    writeAnthropicError(res, 401, "authentication_error", "Unauthorized local proxy request.");
    return;
  }
  if (req.method === "GET" && path7 === "/v1/models") {
    writeJson(res, 200, {
      data: CLAUDE_SUPPORTED_MODELS.map(claudeModelResponse)
    });
    return;
  }
  if (req.method === "GET" && path7.startsWith("/v1/models/")) {
    const modelId = decodeURIComponent(path7.slice("/v1/models/".length));
    const model = findClaudeModel(modelId, options);
    if (!model) {
      writeAnthropicError(res, 404, "not_found_error", `Unknown model "${modelId}".`);
      return;
    }
    writeJson(res, 200, claudeModelResponse(model));
    return;
  }
  if (req.method === "POST" && path7 === "/v1/messages/count_tokens") {
    const { body: parsedBody2, rawBytes: rawBytes2 } = await readJsonBodyWithSize(req);
    const body2 = parsedBody2;
    if (!body2 || typeof body2 !== "object") {
      writeAnthropicError(res, 400, "invalid_request_error", "Request body must be an object.");
      return;
    }
    if (!body2.model) {
      writeAnthropicError(res, 400, "invalid_request_error", "model is required.");
      return;
    }
    if (!Array.isArray(body2.messages)) {
      writeAnthropicError(res, 400, "invalid_request_error", "messages must be an array.");
      return;
    }
    writeJson(res, 200, countTokensResponse(body2, options, rawBytes2, options.costTracker?.tokenEstimator));
    return;
  }
  if (req.method !== "POST" || path7 !== "/v1/messages") {
    writeAnthropicError(res, 404, "not_found_error", `Unsupported route ${req.method ?? ""} ${req.url ?? ""}`.trim());
    return;
  }
  const { body: parsedBody, rawBytes } = await perf.span("body_read_parse", () => readJsonBodyWithSize(req));
  const body = parsedBody;
  const upstreamAbort = new AbortController;
  const markClientDisconnected = () => {
    if (upstreamAbort.signal.aborted) {
      return;
    }
    debugLog7(options, "claude client disconnected; aborting upstream request", {});
    upstreamAbort.abort(new DOMException("Claude client disconnected.", "AbortError"));
  };
  req.once("aborted", markClientDisconnected);
  res.once("close", () => {
    if (!res.writableEnded) {
      markClientDisconnected();
    }
  });
  options.costTracker?.noteRequestBytes(rawBytes);
  options.costTracker?.beginRequest();
  debugLog7(options, "anthropic request", () => ({
    model: body.model,
    stream: body.stream,
    messageCount: body.messages?.length ?? 0,
    toolCount: body.tools?.length ?? 0,
    tools: summarizeAnthropicTools(body.tools)
  }));
  const compactionTuning = tuneClaudeCompactionRequest(body, {
    claudeCodeMaxOutputTokens: options.claudeCodeMaxOutputTokens,
    userConfiguredClaudeMaxOutputTokens: options.claudeCodeMaxOutputTokensUserSet
  });
  if (compactionTuning.detected) {
    debugLog7(options, "claude compaction request tuned", compactionTuning);
  }
  const imageBlocks = extractImageBlocks(body);
  const targetModel = resolveTargetModel(body.model, options).definition;
  if (imageBlocks.length > 0) {
    debugLog7(options, "image blocks detected", imageBlocks);
  }
  if (imageBlocks.length > 0 && !targetModel.attachment) {
    await perf.span("vision_image_resolution", () => resolveImageBlocks(body, options), {
      imageBlockCount: imageBlocks.length
    });
  } else {
    perf.mark("vision_image_resolution_skipped", {
      imageBlockCount: imageBlocks.length,
      nativeVision: imageBlocks.length > 0
    });
  }
  const budgetRawBytes = imageBlocks.length > 0 ? undefined : rawBytes;
  if (imageBlocks.length > 0) {
    debugLog7(options, "ignored raw byte estimator after image resolution", {
      rawBytes,
      imageBlockCount: imageBlocks.length
    });
  }
  if (body.stream) {
    await perf.span("stream_response", () => streamAnthropicFromTogether(res, body, {
      ...options,
      rawBytes: budgetRawBytes,
      isCompactionRequest: compactionTuning.detected
    }, upstreamAbort.signal, perf), { nativeToolCount: nativeServerTools(body.tools).length });
    const delta2 = options.costTracker?.requestDelta;
    const totals2 = options.costTracker?.totals;
    if (options.debug && delta2 && totals2) {
      debugLog7(options, "request cost", {
        requestCostUsd: Number(delta2.costUsd.toFixed(6)),
        requestInputTokens: delta2.promptTokens,
        requestCachedTokens: delta2.cachedTokens,
        requestOutputTokens: delta2.completionTokens,
        sessionTotalCostUsd: Number(totals2.costUsd.toFixed(6))
      });
    }
    perf.end({ status: res.statusCode, stream: true });
    return;
  }
  const openAiResponse = await callTogetherChatCompletions(body, {
    ...options,
    rawBytes: budgetRawBytes,
    isCompactionRequest: compactionTuning.detected
  }, upstreamAbort.signal, perf);
  if (compactionTuning.detected && openAiResponse.choices?.[0]?.finish_reason === "length") {
    openAiResponse.choices[0].finish_reason = "stop";
  }
  if (compactionTuning.detected) {
    const message = openAiResponse.choices?.[0]?.message;
    if (message && !message.content) {
      const reasoning = message.reasoning_content ?? message.reasoning;
      if (reasoning) {
        message.content = reasoning;
        message.reasoning = null;
        message.reasoning_content = null;
      }
    }
  }
  const anthropicMessage = perf.spanSync("response_map", () => toAnthropicMessage(openAiResponse, body.model ?? options.modelId));
  const delta = options.costTracker?.requestDelta;
  const totals = options.costTracker?.totals;
  if (options.debug && delta && totals) {
    debugLog7(options, "request cost", {
      requestCostUsd: Number(delta.costUsd.toFixed(6)),
      requestInputTokens: delta.promptTokens,
      requestCachedTokens: delta.cachedTokens,
      requestOutputTokens: delta.completionTokens,
      sessionTotalCostUsd: Number(totals.costUsd.toFixed(6))
    });
  }
  writeJson(res, 200, anthropicMessage);
  perf.end({ status: res.statusCode, stream: false });
}
function debugLog7(options, label, value) {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
function summarizeAnthropicTools(tools) {
  if (!tools || tools.length === 0) {
    return;
  }
  return tools.map((tool) => ({
    name: tool.name,
    type: tool.type,
    maxUses: tool.max_uses,
    inputSchemaKeys: objectKeys(tool.input_schema),
    rawKeys: Object.keys(tool)
  }));
}
var init_proxy = __esm(() => {
  init_defaults();
  init_proxy_perf();
  init_proxy_debug();
  init_http_util();
  init_content_format();
  init_translate_request();
  init_translate_response();
  init_together_call();
  init_stream();
  init_vision_resolver();
  init_chat_completions();
  init_compaction();
});

// packages/cli/src/lib/codex/defaults.ts
function resolveCodexModel(value) {
  if (CODEX_SUPPORTED_MODELS.length === 0) {
    throw new Error("No Codex models are configured.");
  }
  const found = resolveModelByKeys(CODEX_SUPPORTED_MODELS.map((model) => model.definition), value, [(model) => model.id], CODEX_DEFAULT_MODEL);
  if (!found) {
    const expected = CODEX_SUPPORTED_MODELS.map((model) => model.id).join(", ");
    throw new Error(`Unsupported Codex model "${value}". Expected one of: ${expected}.`);
  }
  return { id: found.id, definition: found };
}
var CODEX_DEFAULT_MODEL, CODEX_PROVIDER_ID = "togetherlink", CODEX_AUTH_ENV = "TOGETHERLINK_CODEX_AUTH_TOKEN", CODEX_SUPPORTED_MODELS;
var init_defaults2 = __esm(() => {
  init_dist3();
  CODEX_DEFAULT_MODEL = DEFAULT_MODEL.id;
  CODEX_SUPPORTED_MODELS = SELECTABLE_MODELS.map((definition) => ({
    id: definition.id,
    definition
  }));
});

// packages/cli/src/lib/codex/catalog.ts
function codexModelCatalog() {
  return {
    models: CODEX_SUPPORTED_MODELS.map((model, index) => toCodexModelCatalogEntry(model, index))
  };
}
function mergeCodexModelCatalog(nativeCatalog) {
  const nativeModels = nativeCatalog.models.filter((entry) => typeof entry?.slug === "string" && entry.slug.length > 0);
  if (nativeModels.length === 0) {
    throw new Error("Cannot build an additive Codex catalog from an empty native catalog.");
  }
  const priorities = nativeModels.map((entry) => entry.priority).filter((value) => typeof value === "number" && Number.isFinite(value));
  const firstTogetherPriority = (priorities.length > 0 ? Math.max(...priorities) : 50) + 1;
  const merged = new Map(nativeModels.map((entry) => [String(entry.slug), entry]));
  CODEX_SUPPORTED_MODELS.forEach((model, index) => {
    merged.set(model.id, toCodexModelCatalogEntry(model, firstTogetherPriority + index));
  });
  return {
    models: [...merged.values()].sort((left, right) => {
      const priority = Number(left.priority ?? Number.MAX_SAFE_INTEGER) - Number(right.priority ?? Number.MAX_SAFE_INTEGER);
      return priority || String(left.slug).localeCompare(String(right.slug));
    })
  };
}
function codexModelCatalogJson() {
  return JSON.stringify(codexModelCatalog());
}
function toCodexModelCatalogEntry(model, priority = 50) {
  const efforts = model.definition.reasoning ? model.definition.reasoningEfforts ?? ["low", "medium", "high"] : [];
  const reasoningLevels = efforts.map((effort) => ({
    effort,
    description: reasoningEffortDescription(effort)
  }));
  const defaultReasoningLevel = model.definition.reasoning ? model.definition.defaultReasoningEffort ?? "medium" : "none";
  return {
    slug: model.id,
    display_name: model.definition.name,
    description: `Together AI model via togetherlink (${model.definition.id})`,
    default_reasoning_level: defaultReasoningLevel,
    supported_reasoning_levels: reasoningLevels,
    shell_type: "shell_command",
    visibility: "list",
    supported_in_api: true,
    priority,
    additional_speed_tiers: [],
    service_tiers: [],
    default_service_tier: null,
    availability_nux: model.definition.codexAvailabilityNuxMessage ? { message: model.definition.codexAvailabilityNuxMessage } : null,
    upgrade: null,
    base_instructions: CODEX_BASE_INSTRUCTIONS,
    model_messages: CODEX_MODEL_MESSAGES,
    supports_personality: true,
    supports_reasoning_summaries: model.definition.reasoning,
    default_reasoning_summary: model.definition.reasoning ? "auto" : "none",
    support_verbosity: false,
    default_verbosity: "low",
    apply_patch_tool_type: "freeform",
    web_search_tool_type: "text_and_image",
    truncation_policy: {
      mode: "tokens",
      limit: CODEX_TOOL_OUTPUT_TRUNCATION_TOKENS
    },
    supports_parallel_tool_calls: model.definition.tool_call,
    supports_image_detail_original: model.definition.attachment,
    context_window: model.definition.limit.context,
    max_context_window: model.definition.limit.context,
    auto_compact_token_limit: model.definition.codexAutoCompactTokenLimit,
    comp_hash: null,
    effective_context_window_percent: CODEX_EFFECTIVE_CONTEXT_WINDOW_PERCENT,
    experimental_supported_tools: [],
    input_modalities: model.definition.modalities.input,
    supports_search_tool: model.definition.tool_call,
    use_responses_lite: false
  };
}
function reasoningEffortDescription(effort) {
  switch (effort) {
    case "low":
      return "Fast responses with lighter reasoning";
    case "medium":
      return "Balances speed and reasoning depth";
    case "high":
      return "Greater reasoning depth for complex tasks";
    case "max":
      return "Maximum reasoning depth for the hardest tasks";
  }
}
var CODEX_BASE_INSTRUCTIONS = "You are Codex, a coding agent. You and the user share one workspace, and your job is to help them complete their coding task accurately and efficiently.", CODEX_TOOL_OUTPUT_TRUNCATION_TOKENS = 1e4, CODEX_EFFECTIVE_CONTEXT_WINDOW_PERCENT = 95, CODEX_MODEL_MESSAGES;
var init_catalog = __esm(() => {
  init_defaults2();
  CODEX_MODEL_MESSAGES = {
    instructions_template: `${CODEX_BASE_INSTRUCTIONS}

{{ personality }}`,
    instructions_variables: {
      personality_default: "",
      personality_friendly: `# Personality

You are warm, collaborative, and helpful. Keep the user clearly informed while you work, and make the collaboration feel easy.`,
      personality_pragmatic: `# Personality

You are direct, task-focused, and precise. State assumptions clearly, prioritize actionable progress, and avoid unnecessary detail.`
    }
  };
});

// packages/cli/src/lib/codex/content-format.ts
var init_content_format2 = () => {
};

// packages/cli/src/lib/codex/sse.ts
function writeResponsesSse(res, event, data) {
  const sequenceNumber = responseSequenceNumbers.get(res) ?? 0;
  responseSequenceNumbers.set(res, sequenceNumber + 1);
  const payload = data && typeof data === "object" && !Array.isArray(data) && !("sequence_number" in data) ? { ...data, sequence_number: sequenceNumber } : data;
  writeSse(res, event, payload);
}
var responseSequenceNumbers;
var init_sse = __esm(() => {
  responseSequenceNumbers = new WeakMap;
});

// packages/cli/src/lib/codex/compaction.ts
import { randomUUID as randomUUID7 } from "crypto";
function isTogetherCompactionV2(body) {
  return Array.isArray(body.input) && body.input.at(-1)?.type === "compaction_trigger";
}
function compactionInput(body) {
  if (!Array.isArray(body.input)) {
    return body.input;
  }
  return body.input.filter((item) => item.type !== "compaction_trigger");
}
function normalizeTogetherCompactionItem(item) {
  if (item.type === "compaction_trigger") {
    return;
  }
  if (item.type !== "compaction") {
    return item;
  }
  const summary = decodeSummary(item.encrypted_content);
  return summary === undefined ? {
    type: "message",
    role: "user",
    content: "[Earlier conversation history was compacted in an unreadable OpenAI format.]"
  } : continuationMessage(summary);
}
function normalizeNativeCompactionInput(input) {
  if (!Array.isArray(input)) {
    return input;
  }
  return input.map((item) => {
    if (item.type === "reasoning") {
      return sanitizeReasoningForNative(item);
    }
    if (item.type !== "compaction") {
      return item;
    }
    const summary = decodeSummary(item.encrypted_content);
    return summary === undefined ? item : continuationMessage(summary);
  });
}
function sanitizeReasoningForNative(item) {
  if (item.encrypted_content === undefined || item.encrypted_content.length > 0 && !/\s/.test(item.encrypted_content)) {
    return item;
  }
  const { encrypted_content: _foreignPlaintext, ...sanitized } = item;
  return sanitized;
}
function toTogetherCompactionPayload(translatedPayload, modelDefinition) {
  const messages = Array.isArray(translatedPayload.messages) ? [...translatedPayload.messages] : [];
  messages.push({ role: "user", content: COMPACTION_PROMPT });
  return {
    ...translatedPayload,
    messages,
    max_tokens: Math.min(COMPACTION_MAX_OUTPUT_TOKENS, modelDefinition.limit.output),
    tools: undefined,
    tool_choice: "none",
    stream: false
  };
}
function compactionSummary(chatResponse) {
  const summary = chatResponse.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error("Together returned an empty compaction summary.");
  }
  return summary;
}
function togetherCompactionResponse(model, summary) {
  return compactionSnapshot(model, [compactionItem(summary)]);
}
function togetherV1CompactOutput(input, summary) {
  const selected = [];
  let remaining = V1_RECENT_USER_BUDGET;
  const userMessages = extractUserMessages(input);
  for (let index = userMessages.length - 1;index >= 0 && remaining > 0; index -= 1) {
    const text = userMessages[index] ?? "";
    if (text.length <= remaining) {
      selected.push(text);
      remaining -= text.length;
    } else {
      selected.push(text.slice(text.length - remaining));
      remaining = 0;
    }
  }
  selected.reverse();
  return {
    output: [
      ...selected.map(messageItem),
      messageItem(`${SUMMARY_PREFIX}

${summary || "(no summary available)"}`)
    ]
  };
}
function writeTogetherCompactionSse(res, model, summary) {
  const item = compactionItem(summary);
  const responseId = `resp_${randomUUID7().replaceAll("-", "")}`;
  const createdAt = Math.floor(Date.now() / 1000);
  const created = compactionSnapshot(model, [], "in_progress", responseId, createdAt);
  const completed = compactionSnapshot(model, [item], "completed", responseId, createdAt);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.flushHeaders?.();
  res.socket?.setNoDelay(true);
  writeResponsesSse(res, "response.created", { type: "response.created", response: created });
  writeResponsesSse(res, "response.output_item.done", {
    type: "response.output_item.done",
    output_index: 0,
    item
  });
  writeResponsesSse(res, "response.completed", {
    type: "response.completed",
    response: completed
  });
  res.end();
}
function compactionItem(summary) {
  return {
    type: "compaction",
    id: `cmp_${randomUUID7().replaceAll("-", "")}`,
    encrypted_content: encodeSummary(summary)
  };
}
function compactionSnapshot(model, output, status = "completed", id = `resp_${randomUUID7().replaceAll("-", "")}`, createdAt = Math.floor(Date.now() / 1000)) {
  return {
    id,
    object: "response",
    created_at: createdAt,
    status,
    model,
    output,
    usage: null
  };
}
function encodeSummary(summary) {
  return COMPACTION_PREFIX + Buffer.from(summary, "utf8").toString("base64");
}
function decodeSummary(value) {
  if (typeof value !== "string" || !value.startsWith(COMPACTION_PREFIX)) {
    return;
  }
  try {
    const encoded = value.slice(COMPACTION_PREFIX.length);
    if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
      return;
    }
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return;
  }
}
function extractUserMessages(input) {
  if (!Array.isArray(input)) {
    return typeof input === "string" && input.trim() ? [input] : [];
  }
  return input.flatMap((item) => {
    if (item.type !== undefined && item.type !== "message") {
      return [];
    }
    if (item.role !== "user") {
      return [];
    }
    if (typeof item.content === "string") {
      return item.content.trim() ? [item.content] : [];
    }
    const text = (item.content ?? []).filter((part) => part.type === "input_text" || part.type === "text").map((part) => part.text ?? "").join("");
    return text.trim() ? [text] : [];
  });
}
function messageItem(text) {
  return {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text }]
  };
}
function continuationMessage(summary) {
  return {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: `${SUMMARY_PREFIX}

${summary}` }]
  };
}
var COMPACTION_PREFIX = "tlc1:", COMPACTION_MAX_OUTPUT_TOKENS = 8192, V1_RECENT_USER_BUDGET = 80000, SUMMARY_PREFIX = "Another language model started this task and produced a continuation summary. Use it to continue without repeating completed work:", COMPACTION_PROMPT = `You are performing a context checkpoint compaction. Write a durable handoff summary for another language model that will resume the task.

Retain current progress, key decisions, constraints, user preferences, remaining work, and critical data or references. Be concise, structured, and focused on seamless continuation. Do not call tools.`;
var init_compaction2 = __esm(() => {
  init_sse();
});

// packages/cli/src/lib/codex/native-headers.ts
var NATIVE_CODEX_FORWARD_HEADERS;
var init_native_headers = __esm(() => {
  NATIVE_CODEX_FORWARD_HEADERS = new Set([
    "authorization",
    "chatgpt-account-id",
    "conversation_id",
    "openai-beta",
    "originator",
    "session_id",
    "session-id",
    "thread-id",
    "user-agent",
    "version",
    "x-client-request-id",
    "x-codex-beta-features",
    "x-codex-image-turn-id",
    "x-codex-installation-id",
    "x-codex-parent-thread-id",
    "x-codex-turn-metadata",
    "x-codex-turn-state",
    "x-codex-window-id",
    "x-oai-attestation",
    "x-openai-internal-codex-responses-lite",
    "x-openai-memgen-request",
    "x-openai-subagent",
    "x-responsesapi-include-timing-metrics"
  ]);
});

// packages/cli/src/lib/codex/native-router.ts
import * as zlib from "zlib";
function envByteLimit(name, fallback) {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function defaultCodexRequestLimits() {
  return {
    maxEncodedBytes: envByteLimit("TOGETHERLINK_CODEX_MAX_ENCODED_REQUEST_BYTES", DEFAULT_CODEX_MAX_ENCODED_REQUEST_BYTES),
    maxDecodedBytes: envByteLimit("TOGETHERLINK_CODEX_MAX_DECODED_REQUEST_BYTES", DEFAULT_CODEX_MAX_DECODED_REQUEST_BYTES)
  };
}
async function readDecodedCodexRequest(req, limits = defaultCodexRequestLimits()) {
  const chunks = [];
  let encodedBytes = 0;
  for await (const chunk of req) {
    const bytes2 = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    encodedBytes += bytes2.length;
    if (encodedBytes > limits.maxEncodedBytes) {
      throw new CodexRequestError(413, `Codex request body is too large (${encodedBytes} bytes > ${limits.maxEncodedBytes} byte limit).`);
    }
    chunks.push(bytes2);
  }
  const encoded = Buffer.concat(chunks);
  const bytes = decodeBody(encoded, req.headers["content-encoding"], limits.maxDecodedBytes);
  const text = bytes.toString("utf8");
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new CodexRequestError(400, "Codex request body must contain valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CodexRequestError(400, "Codex request body must be a JSON object.");
  }
  return {
    body,
    bytes,
    rawBytes: bytes.length
  };
}
async function forwardNativeCodexRequest(req, res, options) {
  const controller = new AbortController;
  const abort = () => controller.abort(new DOMException("Codex client disconnected.", "AbortError"));
  req.once("aborted", abort);
  res.once("close", () => {
    if (!res.writableEnded)
      abort();
  });
  const fetchImpl = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const search = new URL(req.url ?? options.path, "http://togetherlink.local").search;
  const target = `${options.baseUrl.replace(/\/+$/, "")}${nativePath(options.path)}${search}`;
  const upstream = await fetchImpl(target, {
    method: req.method ?? "POST",
    headers: nativeRequestHeaders(req.headers, options.body.length),
    body: options.body,
    signal: controller.signal
  });
  const responseHeaders = {};
  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP_RESPONSE_HEADERS.has(name.toLowerCase())) {
      responseHeaders[name] = value;
    }
  });
  res.writeHead(upstream.status, responseHeaders);
  if (!upstream.body) {
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done)
        break;
      if (!res.write(Buffer.from(next.value))) {
        await new Promise((resolve) => res.once("drain", resolve));
      }
    }
  } catch {
  } finally {
    reader.releaseLock();
    if (!res.writableEnded) {
      res.end();
    }
  }
}
function nativeRequestHeaders(incoming, contentLength) {
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": String(contentLength),
    "Accept-Encoding": "identity"
  };
  for (const name of NATIVE_CODEX_FORWARD_HEADERS) {
    const value = incoming[name];
    if (value !== undefined) {
      headers[name] = Array.isArray(value) ? value.join(", ") : value;
    }
  }
  return headers;
}
function nativeCodexBaseUrl(rawConfig) {
  const preamble = rawConfig.split(/^\s*\[/m, 1)[0] ?? rawConfig;
  const match = preamble.match(/^\s*chatgpt_base_url\s*=\s*(["'])(.*?)\1\s*$/m);
  const configured = match?.[2]?.replace(/\/+$/, "");
  if (!configured)
    return DEFAULT_CODEX_NATIVE_BASE_URL;
  return configured.endsWith("/codex") ? configured : `${configured}/codex`;
}
function nativePath(path7) {
  const withoutV1 = path7.replace(/^\/v1(?=\/|$)/, "");
  return withoutV1 || "/";
}
function decodeBody(raw, contentEncoding, maxDecodedBytes) {
  const encodings = (Array.isArray(contentEncoding) ? contentEncoding.join(",") : contentEncoding ?? "").split(",").map((value) => value.trim().toLowerCase()).filter((value) => value && value !== "identity").reverse();
  let decoded = raw;
  try {
    for (const encoding of encodings) {
      const options = { maxOutputLength: maxDecodedBytes };
      if (encoding === "gzip" || encoding === "x-gzip") {
        decoded = zlib.gunzipSync(decoded, options);
      } else if (encoding === "deflate") {
        decoded = zlib.inflateSync(decoded, options);
      } else if (encoding === "br") {
        decoded = zlib.brotliDecompressSync(decoded, options);
      } else if (encoding === "zstd") {
        decoded = zstdDecompress(decoded, maxDecodedBytes);
      } else {
        throw new CodexRequestError(415, `Unsupported Codex request Content-Encoding: ${encoding}.`);
      }
      assertDecodedBodySize(decoded, maxDecodedBytes);
    }
  } catch (error) {
    if (error instanceof CodexRequestError) {
      throw error;
    }
    if (isZlibOutputLimitError(error)) {
      throw new CodexRequestError(413, `Decoded Codex request body is too large (exceeds ${maxDecodedBytes} byte limit).`);
    }
    throw new CodexRequestError(400, "Codex request body compression is invalid.");
  }
  assertDecodedBodySize(decoded, maxDecodedBytes);
  return decoded;
}
function zstdDecompress(value, maxOutputLength) {
  const nodeZstd = zlib.zstdDecompressSync;
  if (nodeZstd)
    return Buffer.from(nodeZstd(value, { maxOutputLength }));
  throw new CodexRequestError(415, "This runtime cannot safely decode the Codex zstd request within the configured size limit. Use the current TogetherLink installer or Node 22.15+.");
}
function assertDecodedBodySize(value, maxDecodedBytes) {
  if (value.length > maxDecodedBytes) {
    throw new CodexRequestError(413, `Decoded Codex request body is too large (${value.length} bytes > ${maxDecodedBytes} byte limit).`);
  }
}
function isZlibOutputLimitError(error) {
  return error instanceof Error && "code" in error && error.code === "ERR_BUFFER_TOO_LARGE";
}
var DEFAULT_CODEX_NATIVE_BASE_URL = "https://chatgpt.com/backend-api/codex", DEFAULT_CODEX_MAX_ENCODED_REQUEST_BYTES, DEFAULT_CODEX_MAX_DECODED_REQUEST_BYTES, CodexRequestError, HOP_BY_HOP_RESPONSE_HEADERS;
var init_native_router = __esm(() => {
  init_native_headers();
  DEFAULT_CODEX_MAX_ENCODED_REQUEST_BYTES = 256 * 1024 * 1024;
  DEFAULT_CODEX_MAX_DECODED_REQUEST_BYTES = 256 * 1024 * 1024;
  CodexRequestError = class CodexRequestError extends Error {
    status;
    constructor(status, message) {
      super(message);
      this.name = "CodexRequestError";
      this.status = status;
    }
  };
  HOP_BY_HOP_RESPONSE_HEADERS = new Set([
    "connection",
    "content-encoding",
    "content-length",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "set-cookie",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade"
  ]);
});

// packages/cli/src/lib/codex/native-replay.ts
function sanitizeNativeResponsesReplay(body) {
  if (body.store === true || !Array.isArray(body.input)) {
    return body;
  }
  let changed = false;
  const input = body.input.map((value) => {
    if (!isJsonObject(value) || value.type !== "reasoning") {
      return value;
    }
    if (!isTogetherLinkReasoningId(value.id)) {
      return value;
    }
    const encryptedContent = value.encrypted_content;
    if (typeof encryptedContent === "string" && isValidNativeReasoningEncryptedContent(encryptedContent)) {
      return value;
    }
    if (!("id" in value) && !("encrypted_content" in value)) {
      return value;
    }
    const { id: _orphanId, encrypted_content: _invalidEncryptedContent, ...safe } = value;
    changed = true;
    return safe;
  });
  return changed ? { ...body, input } : body;
}
function isTogetherLinkReasoningId(value) {
  return typeof value === "string" && /^rs_[0-9a-f]{32}$/.test(value);
}
function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isValidNativeReasoningEncryptedContent(value) {
  if (value === "" || value !== value.trim() || value.length > MAX_NATIVE_REASONING_SIGNATURE_BYTES || !value.startsWith("gAAAA") || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) {
    return false;
  }
  let decoded;
  try {
    decoded = Buffer.from(value, "base64url");
  } catch {
    return false;
  }
  if (decoded.length < 73 || decoded[0] !== 128) {
    return false;
  }
  const ciphertextLength = decoded.length - 1 - 8 - 16 - 32;
  return ciphertextLength > 0 && ciphertextLength % 16 === 0;
}
var MAX_NATIVE_REASONING_SIGNATURE_BYTES;
var init_native_replay = __esm(() => {
  MAX_NATIVE_REASONING_SIGNATURE_BYTES = 32 * 1024 * 1024;
});

// packages/cli/src/lib/codex/translate-request.ts
import { createHash as createHash3, randomUUID as randomUUID8 } from "crypto";
function toChatPayload(body, options, stream, toolTranslation, requestModel, estimatedInputTokens = 0) {
  const messages = toChatMessages(body, options, toolTranslation, requestModel);
  const translatedReasoningEffort = codexReasoningEffort(body.reasoning, requestModel.definition);
  const messagesWithNativePrompt = toolTranslation.nativeTools.length > 0 ? withNativeToolSystemPrompt2(messages, toolTranslation.nativeTools) : messages;
  return {
    model: requestModel.targetModelId,
    messages: messagesWithNativePrompt,
    max_tokens: resolveOutputBudget({
      model: requestModel.definition,
      estimatedInputTokens,
      clientMaxTokens: body.max_output_tokens
    }),
    temperature: body.temperature,
    ...toolTranslation.tools.length > 0 ? { tools: toolTranslation.tools } : {},
    ...toolTranslation.tools.length > 0 ? { tool_choice: toChatToolChoice(body.tool_choice, toolTranslation) } : {},
    response_format: toChatResponseFormat(body.text),
    ...translatedReasoningEffort ? { reasoning_effort: translatedReasoningEffort } : {},
    chat_template_kwargs: { clear_thinking: false },
    stream,
    ...stream ? { stream_options: { include_usage: true } } : {}
  };
}
function resolveCodexRequestModel(body, options) {
  const requestedModelId = body.model ?? options.modelId;
  if (isCodexMemoryRequest(body, requestedModelId)) {
    const configured = process.env[CODEX_MEMORY_MODEL_ENV]?.trim();
    const configuredModel = configured ? findModelById(configured) : undefined;
    const definition2 = configuredModel ?? MINIMAX_M3;
    return {
      requestedModelId,
      targetModelId: definition2.id,
      definition: definition2,
      memory: true
    };
  }
  const requestedModel = findModelById(requestedModelId);
  const definition = requestedModel ?? options.modelDefinition;
  return {
    requestedModelId,
    targetModelId: definition.id,
    definition,
    memory: false
  };
}
function isCodexMemoryRequest(body, requestedModelId) {
  if (CODEX_MEMORY_REQUESTED_MODELS.has(requestedModelId)) {
    return true;
  }
  return body.instructions?.includes("## Memory Writing Agent:") === true;
}
function toChatMessages(body, options, toolTranslation, requestModel) {
  const selectedName = requestModel?.definition.name ?? options.modelName;
  const selectedId = requestModel?.targetModelId ?? options.targetModelId;
  const messages = [
    {
      role: "system",
      content: `${CODEX_IDENTITY_PROMPT}
Selected Together backend: ${selectedName} (${selectedId}).`
    }
  ];
  if (body.instructions) {
    messages.push({ role: "system", content: body.instructions });
  }
  if (typeof body.input === "string") {
    messages.push({ role: "user", content: body.input });
    return messages;
  }
  const retiredViewImages = retiredViewImageMarkers(body.input ?? []);
  const pendingToolCalls = [];
  const pendingReasoningParts = [];
  const takePendingReasoning = () => {
    const reasoning = pendingReasoningParts.join(`
`);
    pendingReasoningParts.length = 0;
    return reasoning;
  };
  const flushPendingToolCalls = () => {
    if (pendingToolCalls.length === 0) {
      return;
    }
    const reasoning = takePendingReasoning();
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: pendingToolCalls.splice(0),
      ...reasoning ? { reasoning_content: reasoning } : {}
    });
  };
  for (const rawItem of body.input ?? []) {
    const item = normalizeTogetherCompactionItem(rawItem);
    if (!item) {
      continue;
    }
    if (item.type === "additional_tools") {
      continue;
    }
    if (item.type === "reasoning") {
      const reasoning = stringifyResponsesContent(item.content);
      if (reasoning) {
        pendingReasoningParts.push(reasoning);
      }
      continue;
    }
    if (item.type === "function_call") {
      pendingToolCalls.push({
        id: item.call_id ?? `call_${randomUUID8().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toChatHistoryToolName(item, toolTranslation, "function"),
          arguments: sanitizeToolCallArguments(typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments))
        }
      });
      continue;
    }
    if (item.type === "tool_search_call") {
      pendingToolCalls.push({
        id: item.call_id ?? `call_${randomUUID8().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toChatHistoryToolName(item, toolTranslation, "tool_search"),
          arguments: typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments ?? {})
        }
      });
      continue;
    }
    if (item.type === "custom_tool_call") {
      pendingToolCalls.push({
        id: item.call_id ?? `call_${randomUUID8().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toChatHistoryToolName(item, toolTranslation, "custom"),
          arguments: JSON.stringify({ input: item.input ?? "" })
        }
      });
      continue;
    }
    if (item.type === "local_shell_call") {
      pendingToolCalls.push({
        id: item.call_id ?? item.id ?? `call_${randomUUID8().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: "local_shell",
          arguments: localShellArguments(item.action)
        }
      });
      continue;
    }
    flushPendingToolCalls();
    if (item.type === "agent_message") {
      messages.push({ role: "assistant", content: agentMessageHistory(item) });
      continue;
    }
    if (item.type === "web_search_call") {
      messages.push({
        role: "assistant",
        content: webSearchHistory(item, options.nativeSearchResults?.get(item.id ?? ""))
      });
      continue;
    }
    if (item.type === "image_generation_call") {
      messages.push(imageGenerationHistory(item, requestModel?.definition));
      continue;
    }
    if (item.type === "context_compaction") {
      messages.push({
        role: "assistant",
        content: "[Conversation context was compacted in an opaque format unavailable to this Together model.]"
      });
      continue;
    }
    if (item.type === "tool_search_output") {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id ?? "",
        content: `Loaded tools: ${responseTools(item.tools).map((tool) => tool.name).filter(Boolean).join(", ") || "none"}`
      });
      continue;
    }
    if (item.type === "function_call_output" || item.type === "custom_tool_call_output") {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id ?? "",
        content: toChatToolOutput(item.output, requestModel?.definition ?? options.modelDefinition, retiredViewImages.get(item.call_id ?? ""))
      });
      continue;
    }
    if (item.type === "message" || item.role) {
      const role = toChatRole(item.role);
      const reasoning = role === "assistant" ? takePendingReasoning() : "";
      messages.push({
        role,
        content: toChatMessageContent(item.content),
        ...reasoning ? { reasoning_content: reasoning } : {}
      });
    }
  }
  flushPendingToolCalls();
  return messages;
}
function retiredViewImageMarkers(input) {
  const artifacts = viewImageArtifacts(input);
  const newest = artifacts.at(-1);
  const retired = new Map;
  for (const artifact of artifacts) {
    if (artifact === newest || !artifact.observation && !artifact.duplicateOfLater) {
      continue;
    }
    retired.set(artifact.callId, artifact);
  }
  return retired;
}
function viewImageArtifacts(input) {
  const viewImagePaths = new Map;
  for (const rawItem of input) {
    const item = normalizeTogetherCompactionItem(rawItem);
    if (item?.type !== "function_call" || item.name !== "view_image" || !item.call_id) {
      continue;
    }
    const path7 = viewImagePath(item.arguments);
    viewImagePaths.set(item.call_id, path7);
  }
  const imageOutputs = [];
  for (const [index, rawItem] of input.entries()) {
    const item = normalizeTogetherCompactionItem(rawItem);
    const callId = item?.call_id ?? "";
    if (item?.type !== "function_call_output" || !viewImagePaths.has(callId)) {
      continue;
    }
    const imageUrl = firstToolImageUrl(item.output);
    if (imageUrl) {
      imageOutputs.push({ index, callId, imageUrl, path: viewImagePaths.get(callId) ?? "" });
    }
  }
  const identified = imageOutputs.map((image) => ({
    ...image,
    artifactId: imageArtifactId(image.imageUrl),
    observation: followingAssistantObservation(input, image.index)
  }));
  return identified.map((image, index) => ({
    ...image,
    duplicateOfLater: identified.slice(index + 1).some((candidate) => candidate.artifactId === image.artifactId)
  }));
}
function codexHistoricalImageReferences(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  const references = existingHistoricalImageReferences(input);
  for (const artifact of viewImageArtifacts(input)) {
    if (!artifact.observation) {
      continue;
    }
    const path7 = artifact.path ? ` Original path: ${JSON.stringify(artifact.path)}.` : "";
    references.set(artifact.artifactId, `[Historical image img_${artifact.artifactId}] Observation: ${artifact.observation}.${path7} ` + "Re-run view_image for pixel-level inspection.");
  }
  return [...references.values()];
}
function existingHistoricalImageReferences(input) {
  const references = new Map;
  const pattern = /\[Historical image img_([0-9a-f]{12})\][^\r\n]*/g;
  for (const rawItem of input) {
    const item = normalizeTogetherCompactionItem(rawItem);
    if (!item || item.type !== "message" && !item.role) {
      continue;
    }
    const text = stringifyResponsesContent(item.content);
    for (const match of text.matchAll(pattern)) {
      const artifactId = match[1];
      const reference = match[0];
      if (artifactId && reference) {
        references.set(artifactId, reference);
      }
    }
  }
  return references;
}
function imageArtifactId(imageUrl) {
  let content = imageUrl;
  if (imageUrl.startsWith("data:")) {
    const comma = imageUrl.indexOf(",");
    if (comma >= 0) {
      const metadata = imageUrl.slice(5, comma);
      const payload = imageUrl.slice(comma + 1);
      try {
        content = metadata.split(";").includes("base64") ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
      } catch {
        content = payload;
      }
    }
  }
  return createHash3("sha256").update(content).digest("hex").slice(0, 12);
}
function retiredViewImageText(image) {
  const evidence = image.observation ? `Observation: ${image.observation}.` : "An identical image remains later in the conversation.";
  const reopen = image.path ? ` Re-run view_image with path ${JSON.stringify(image.path)} if pixel-level inspection is needed.` : " Re-run view_image if pixel-level inspection is needed.";
  return `[Historical view_image screenshot retired from replay: img_${image.artifactId}. ${evidence}${reopen}]`;
}
function viewImagePath(argumentsValue) {
  try {
    const parsed = typeof argumentsValue === "string" ? JSON.parse(argumentsValue) : argumentsValue ?? {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const path7 = parsed.path;
      return typeof path7 === "string" ? path7 : "";
    }
  } catch {
  }
  return "";
}
function firstToolImageUrl(output) {
  if (!Array.isArray(output)) {
    return "";
  }
  for (const rawPart of output) {
    if (!rawPart || typeof rawPart !== "object" || Array.isArray(rawPart)) {
      continue;
    }
    const part = rawPart;
    if (part.type === "input_image" && typeof part.image_url === "string") {
      return part.image_url;
    }
  }
  return "";
}
function followingAssistantObservation(input, outputIndex) {
  for (let index = outputIndex + 1;index < input.length; index += 1) {
    const rawItem = input[index];
    if (!rawItem) {
      continue;
    }
    const item = normalizeTogetherCompactionItem(rawItem);
    if (!item) {
      continue;
    }
    if (item.type === "function_call" && item.name === "view_image" || item.type === "function_call_output" && firstToolImageUrl(item.output)) {
      return "";
    }
    if ((item.type === "message" || item.role) && toChatRole(item.role) === "user") {
      return "";
    }
    if ((item.type === "message" || item.role) && toChatRole(item.role) === "assistant") {
      const observation = stringifyResponsesContent(item.content).trim();
      if (observation) {
        return observation.replace(/\s+/g, " ").slice(0, 1000);
      }
    }
  }
  return "";
}
function toChatHistoryToolName(item, toolTranslation, preferredKind) {
  const sourceName = item.name ?? (preferredKind === "tool_search" ? "tool_search" : "tool");
  for (const mapping of toolTranslation.mappings.values()) {
    if (item.namespace && mapping.kind === "namespace" && mapping.namespace === item.namespace && mapping.sourceName === sourceName) {
      return mapping.modelName;
    }
    if (!item.namespace && mapping.kind === preferredKind && mapping.sourceName === sourceName) {
      return mapping.modelName;
    }
  }
  return item.namespace ? `${sanitizeToolName(item.namespace)}__${sanitizeToolName(sourceName)}` : sourceName;
}
function translateCodexTools(tools) {
  const translated = [];
  const mappings = new Map;
  const nativeTools = [];
  const usedNames = new Set;
  const uniqueName = (raw) => {
    const base = sanitizeToolName(raw);
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    usedNames.add(candidate);
    return candidate;
  };
  for (const tool of tools ?? []) {
    if (tool.type === "tool_search") {
      const sourceName = tool.name ?? "tool_search";
      const modelName = uniqueName(sourceName);
      const mapping = {
        kind: "tool_search",
        sourceName,
        modelName,
        execution: tool.execution ?? "client"
      };
      mappings.set(modelName, mapping);
      translated.push(toChatFunctionTool(modelName, tool.description ?? "Search for tools relevant to the current task.", tool.parameters));
      continue;
    }
    if (isWebSearchTool(tool)) {
      const sourceName = tool.name ?? "web_search";
      const modelName = uniqueName(sourceName);
      const mapping = {
        kind: "web_search",
        sourceName,
        modelName,
        definition: tool
      };
      mappings.set(modelName, mapping);
      nativeTools.push(mapping);
      translated.push(toChatFunctionTool(modelName, tool.description ?? "Search the web for recent or source-backed information.", {
        type: "object",
        properties: { query: { type: "string", description: "The web search query." } },
        required: ["query"],
        additionalProperties: false
      }));
      continue;
    }
    if (tool.type === "function" && tool.name) {
      const modelName = uniqueName(tool.name);
      const mapping = { kind: "function", sourceName: tool.name, modelName };
      mappings.set(modelName, mapping);
      translated.push(toChatFunctionTool(modelName, tool.description ?? "", tool.parameters));
      continue;
    }
    if (tool.type === "custom" && tool.name) {
      const modelName = uniqueName(tool.name);
      const mapping = { kind: "custom", sourceName: tool.name, modelName };
      mappings.set(modelName, mapping);
      translated.push(toChatFunctionTool(modelName, customToolDescription(tool), {
        type: "object",
        properties: {
          input: { type: "string", description: "The complete freeform input for this tool." }
        },
        required: ["input"],
        additionalProperties: false
      }));
      continue;
    }
    if (tool.type === "namespace" && tool.name && Array.isArray(tool.tools)) {
      for (const child of tool.tools) {
        if (child.type !== "function" || !child.name) {
          continue;
        }
        const modelName = uniqueName(`${tool.name}__${child.name}`);
        const mapping = {
          kind: "namespace",
          sourceName: child.name,
          modelName,
          namespace: tool.name
        };
        mappings.set(modelName, mapping);
        const description = [tool.description, child.description].filter(Boolean).join(`

`);
        translated.push(toChatFunctionTool(modelName, description, child.parameters));
      }
      continue;
    }
  }
  return { tools: translated, mappings, nativeTools };
}
function translateCodexRequestTools(body) {
  const visibleTools = (body.tools ?? []).filter((tool) => tool.defer_loading !== true);
  const discoveredTools = typeof body.input === "string" ? [] : (body.input ?? []).flatMap((item) => item.type === "tool_search_output" || item.type === "additional_tools" ? responseTools(item.tools) : []);
  const combined = [...visibleTools];
  const seen = new Set(combined.map(toolIdentity));
  for (const tool of discoveredTools) {
    const identity = toolIdentity(tool);
    if (!seen.has(identity)) {
      combined.push(tool);
      seen.add(identity);
    }
  }
  return combined.length > 0 ? translateCodexTools(combined) : EMPTY_CODEX_TOOL_TRANSLATION;
}
function toolIdentity(tool) {
  return `${tool.type ?? ""}:${tool.name ?? ""}`;
}
function responseTools(tools) {
  return (tools ?? []).filter((tool) => Boolean(tool) && typeof tool === "object" && !Array.isArray(tool));
}
function toChatFunctionTool(name, description, parameters) {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: parameters ?? { type: "object", properties: {} }
    }
  };
}
function sanitizeToolName(name) {
  const sanitized = name.replaceAll(/[^A-Za-z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || "tool";
}
function customToolDescription(tool) {
  const pieces = [tool.description ?? ""];
  if (tool.format?.syntax || tool.format?.definition) {
    pieces.push(`Input format: ${[tool.format.syntax, tool.format.definition].filter(Boolean).join(`
`)}`);
  }
  return pieces.filter(Boolean).join(`

`) || "Call this custom freeform tool.";
}
function isWebSearchTool(tool) {
  return tool.type === "web_search" || tool.type?.startsWith("web_search") === true || tool.name === "web_search";
}
function withNativeToolSystemPrompt2(messages, nativeTools) {
  return withNativeToolSystemPrompt(messages, nativeTools, {
    toolName: (tool) => tool.modelName
  });
}
function codexNativeToolMaxUses(tool) {
  return nativeToolMaxUses(tool);
}
async function runCodexExaSearchDetailed(input, tool, options) {
  return runExaSearchDetailed({
    query: input,
    allowedDomains: stringArray(tool.allowed_domains),
    blockedDomains: stringArray(tool.blocked_domains),
    exaApiKey: process.env.EXA_API_KEY,
    debugLog: (label, value) => debugLog8(options, label, value),
    missingApiKeyMessage: "Web search error: EXA_API_KEY is not set. Run `togetherlink configure` or export EXA_API_KEY and retry.",
    includePublishedDate: true,
    snippetLength: 700
  });
}
function toChatRole(role) {
  if (role === "assistant") {
    return "assistant";
  }
  if (role === "developer" || role === "system") {
    return "system";
  }
  return "user";
}
function stringifyResponsesContent(content) {
  if (typeof content === "string") {
    return content;
  }
  return (content ?? []).map((part) => {
    if (part.type === "input_text" || part.type === "output_text" || part.type === "text" || part.type === "reasoning_text") {
      return part.text ?? "";
    }
    if (part.type === "input_audio") {
      return "[Audio input is unavailable to the selected Together model.]";
    }
    return "";
  }).filter(Boolean).join(`
`);
}
function sanitizeToolCallArguments(argumentsJson) {
  if (!argumentsJson) {
    return "{}";
  }
  try {
    const parsed = JSON.parse(argumentsJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.prototype.hasOwnProperty.call(parsed, "items")) {
      parsed._items = parsed.items;
      delete parsed.items;
      return JSON.stringify(parsed);
    }
  } catch {
  }
  return argumentsJson;
}
function toChatMessageContent(content) {
  if (typeof content === "string") {
    return content;
  }
  const parts = content ?? [];
  if (!parts.some((part) => part.type === "input_image" || part.type === "image_url")) {
    return stringifyResponsesContent(parts);
  }
  return parts.map((part) => {
    if (part.type === "input_text" || part.type === "output_text" || part.type === "text") {
      return part.text ? { type: "text", text: part.text } : undefined;
    }
    if (part.type === "input_audio") {
      return {
        type: "text",
        text: "[Audio input is unavailable to the selected Together model.]"
      };
    }
    if ((part.type === "input_image" || part.type === "image_url") && typeof part.image_url === "string") {
      return {
        type: "image_url",
        image_url: {
          url: part.image_url,
          ...part.detail ? { detail: part.detail } : {}
        }
      };
    }
    return;
  }).filter((part) => part !== undefined);
}
function agentMessageHistory(item) {
  const author = item.author?.trim() || "unknown agent";
  const recipient = item.recipient?.trim() || "unknown recipient";
  const content = Array.isArray(item.content) ? item.content : [];
  const parts = content.flatMap((part) => {
    if (part.type === "input_text" && part.text) {
      return [part.text];
    }
    if (part.type === "encrypted_content") {
      return ["[encrypted content unavailable to this Together model]"];
    }
    return [];
  });
  const readable = parts.join(`
`) || "[agent message content unavailable]";
  return `Agent message from ${author} to ${recipient}: ${readable}`;
}
function toChatToolOutput(output, model, retiredImage) {
  if (typeof output === "string") {
    return output;
  }
  if (!Array.isArray(output)) {
    return "[Unsupported structured tool output omitted.]";
  }
  const parts = [];
  for (const rawPart of output) {
    if (!rawPart || typeof rawPart !== "object" || Array.isArray(rawPart)) {
      parts.push({ type: "text", text: "[Unsupported structured tool output omitted.]" });
      continue;
    }
    const part = rawPart;
    if (part.type === "input_text" && typeof part.text === "string") {
      parts.push({ type: "text", text: part.text });
    } else if (part.type === "input_image" && typeof part.image_url === "string") {
      parts.push(retiredImage ? { type: "text", text: retiredViewImageText(retiredImage) } : isVisionModel(model) ? {
        type: "image_url",
        image_url: {
          url: part.image_url,
          ...part.detail ? { detail: part.detail } : {}
        }
      } : {
        type: "text",
        text: "[Image output is unavailable to the selected Together model.]"
      });
    } else if (part.type === "input_audio") {
      parts.push({
        type: "text",
        text: "[Audio output is unavailable to the selected Together model.]"
      });
    } else if (part.type === "encrypted_content") {
      parts.push({ type: "text", text: "[Encrypted tool output is unavailable.]" });
    } else {
      parts.push({ type: "text", text: "[Unsupported structured tool output omitted.]" });
    }
  }
  return parts.length > 0 ? parts : "[Tool returned no model-readable output.]";
}
function localShellArguments(action) {
  if (!action || action.type !== "exec") {
    return "{}";
  }
  const command = Array.isArray(action.command) ? action.command.filter((part) => typeof part === "string") : [];
  return JSON.stringify({
    type: "exec",
    command,
    ...typeof action.timeout_ms === "number" ? { timeout_ms: action.timeout_ms } : {},
    ...typeof action.working_directory === "string" ? { working_directory: action.working_directory } : {},
    ...isStringRecord(action.env) ? { env: action.env } : {},
    ...typeof action.user === "string" ? { user: action.user } : {}
  });
}
function webSearchHistory(item, result) {
  const action = item.action;
  const kind = typeof action?.type === "string" ? action.type : "unknown action";
  const detail = typeof action?.query === "string" ? action.query : Array.isArray(action?.queries) ? action.queries.filter((query) => typeof query === "string").join(", ") : typeof action?.url === "string" ? action.url : "details unavailable";
  const marker = `[Web search ${item.status ?? "recorded"}: ${kind} - ${detail}]`;
  return result ? `${marker}
${result}` : marker;
}
function rememberCodexNativeSearchResult(results, itemId, result) {
  if (!results) {
    return;
  }
  if (!results.has(itemId) && results.size >= MAX_CODEX_NATIVE_SEARCH_RESULTS) {
    const oldest = results.keys().next().value;
    if (typeof oldest === "string") {
      results.delete(oldest);
    }
  }
  results.set(itemId, result);
}
function imageGenerationHistory(item, model) {
  const prompt = item.revised_prompt?.trim();
  const description = `Image generation ${item.status ?? "recorded"}${prompt ? `: ${prompt}` : ""}`;
  const marker = `[${description}.]`;
  const result = item.result?.trim();
  if (result && model && isVisionModel(model)) {
    return {
      role: "user",
      content: [
        { type: "text", text: marker },
        {
          type: "image_url",
          image_url: {
            url: result.startsWith("data:") ? result : `data:image/png;base64,${result}`
          }
        }
      ]
    };
  }
  return {
    role: "assistant",
    content: `[${description}. Result omitted.]`
  };
}
function isStringRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((item) => typeof item === "string");
}
function toChatToolChoice(toolChoice, toolTranslation) {
  if (!toolChoice || typeof toolChoice !== "object") {
    return;
  }
  const choice = toolChoice;
  if (choice.type === "auto") {
    return "auto";
  }
  if (choice.type === "required") {
    return "required";
  }
  if (choice.type === "function" && typeof choice.name === "string") {
    return {
      type: "function",
      function: { name: toChatToolChoiceName(choice.name, toolTranslation) }
    };
  }
  return;
}
function toChatToolChoiceName(name, toolTranslation) {
  if (toolTranslation.mappings.has(name)) {
    return name;
  }
  for (const mapping of toolTranslation.mappings.values()) {
    if (mapping.sourceName === name) {
      return mapping.modelName;
    }
  }
  return name;
}
function toChatResponseFormat(text) {
  const format = text?.format;
  if (!format?.type) {
    return;
  }
  if (format.type === "json_schema") {
    return {
      type: "json_schema",
      json_schema: {
        name: format.name ?? "codex_output_schema",
        ...format.schema !== undefined ? { schema: format.schema } : {},
        ...format.strict !== undefined ? { strict: format.strict } : {}
      }
    };
  }
  if (format.type === "json_object") {
    return { type: "json_object" };
  }
  return;
}
function codexReasoningEffort(reasoning, model) {
  const effort = reasoning?.effort;
  if (!model.reasoning) {
    return;
  }
  if (model.id === "zai-org/GLM-5.2") {
    if (effort === "high" || effort === "xhigh" || effort === "max") {
      return "max";
    }
    return;
  }
  if (effort === "low" || effort === "medium" || effort === "high" || effort === "max") {
    return effort;
  }
  if (effort === "xhigh") {
    return "high";
  }
  return;
}
function debugLog8(options, label, payload) {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
var CODEX_IDENTITY_PROMPT, CODEX_MEMORY_MODEL_ENV = "TOGETHERLINK_CODEX_MEMORY_MODEL", CODEX_MEMORY_REQUESTED_MODELS, EMPTY_CODEX_TOOL_TRANSLATION, MAX_CODEX_NATIVE_SEARCH_RESULTS = 64;
var init_translate_request2 = __esm(() => {
  init_dist3();
  init_proxy_debug();
  init_compaction2();
  CODEX_IDENTITY_PROMPT = "You are running inside Codex through togetherlink's local Responses-to-Together proxy. " + "The upstream model is a Together AI model, not an OpenAI model. " + "If asked what model you are, identify yourself as the selected Together AI backend routed by togetherlink.";
  CODEX_MEMORY_REQUESTED_MODELS = new Set(["gpt-5.4-mini"]);
  EMPTY_CODEX_TOOL_TRANSLATION = {
    tools: [],
    mappings: new Map,
    nativeTools: []
  };
});

// packages/cli/src/lib/codex/translate-response.ts
import { randomUUID as randomUUID9 } from "crypto";
function toResponsesResponse(chatResponse, body, options, toolTranslation, nativeSearchItems = []) {
  const responseId = chatResponse.id ?? `resp_${randomUUID9().replaceAll("-", "")}`;
  const isLengthTruncated = isTruncationReal(chatResponse.choices?.[0]?.finish_reason, {
    outputTokens: chatResponse.usage?.completion_tokens,
    requestedMaxTokens: options.requestedMaxTokens
  });
  return {
    id: responseId,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: isLengthTruncated ? "incomplete" : "completed",
    ...isLengthTruncated ? { incomplete_details: { reason: "max_output_tokens" } } : {},
    model: body.model ?? options.modelId,
    output: toResponsesOutput(chatResponse, toolTranslation, nativeSearchItems),
    usage: toResponsesUsage(chatResponse.usage)
  };
}
function toResponsesOutput(chatResponse, toolTranslation, nativeSearchItems) {
  const message = chatResponse.choices?.[0]?.message ?? {};
  const output = [];
  const reasoning = message.reasoning ?? message.reasoning_content;
  if (reasoning) {
    output.push(reasoningOutputItem(undefined, reasoning));
  }
  output.push(...nativeSearchItems);
  if (message.content) {
    output.push(messageOutputItem(message.content));
  }
  for (const toolCall of message.tool_calls ?? []) {
    output.push(responseToolCallOutputItem({
      id: toolCall.id ?? `call_${randomUUID9().replaceAll("-", "")}`,
      name: toolCall.function?.name ?? "tool",
      arguments: toolCall.function?.arguments ?? "{}"
    }, toolTranslation));
  }
  return output;
}
function openReasoningOutputItem(res, state) {
  if (state.reasoningItemId !== undefined) {
    return;
  }
  state.reasoningItemId = `rs_${randomUUID9().replaceAll("-", "")}`;
  state.reasoningOutputIndex = state.nextOutputIndex;
  state.nextOutputIndex += 1;
  writeResponsesSse(res, "response.output_item.added", {
    type: "response.output_item.added",
    output_index: state.reasoningOutputIndex,
    item: {
      id: state.reasoningItemId,
      type: "reasoning",
      status: "in_progress",
      summary: [],
      content: []
    }
  });
}
function openTextOutputItem(res, state) {
  if (state.textItemId !== undefined) {
    return;
  }
  state.textItemId = `msg_${randomUUID9().replaceAll("-", "")}`;
  state.textOutputIndex = state.nextOutputIndex;
  state.nextOutputIndex += 1;
  const item = {
    id: state.textItemId,
    type: "message",
    role: "assistant",
    status: "in_progress",
    content: []
  };
  writeResponsesSse(res, "response.output_item.added", {
    type: "response.output_item.added",
    output_index: state.textOutputIndex,
    item
  });
  writeResponsesSse(res, "response.content_part.added", {
    type: "response.content_part.added",
    item_id: state.textItemId,
    output_index: state.textOutputIndex,
    content_index: 0,
    part: { type: "output_text", text: "", annotations: [] }
  });
}
function webSearchCallItem(id, status, query, outcome) {
  const action = { type: "search", query };
  const sources = (outcome?.results ?? []).map((result) => result.url).filter((url) => typeof url === "string" && url !== "").map((url) => ({ url }));
  if (sources.length > 0) {
    action.sources = sources;
  }
  return {
    id,
    type: "web_search_call",
    status,
    action
  };
}
function openWebSearchCallItem(res, state, query) {
  const itemId = `wsc_${randomUUID9().replaceAll("-", "")}`;
  const outputIndex = state.nextOutputIndex;
  state.nextOutputIndex += 1;
  writeResponsesSse(res, "response.output_item.added", {
    type: "response.output_item.added",
    output_index: outputIndex,
    item: webSearchCallItem(itemId, "in_progress", query)
  });
  writeResponsesSse(res, "response.web_search_call.in_progress", {
    type: "response.web_search_call.in_progress",
    item_id: itemId,
    output_index: outputIndex
  });
  writeResponsesSse(res, "response.web_search_call.searching", {
    type: "response.web_search_call.searching",
    item_id: itemId,
    output_index: outputIndex
  });
  return { itemId, outputIndex };
}
function completeWebSearchCallItem(res, itemId, outputIndex, query, outcome) {
  const status = outcome.errorCode === undefined ? "completed" : "failed";
  writeResponsesSse(res, "response.web_search_call.completed", {
    type: "response.web_search_call.completed",
    item_id: itemId,
    output_index: outputIndex
  });
  writeResponsesSse(res, "response.output_item.done", {
    type: "response.output_item.done",
    output_index: outputIndex,
    item: webSearchCallItem(itemId, status, query, outcome)
  });
}
function reasoningOutputItem(id = `rs_${randomUUID9().replaceAll("-", "")}`, summaryText) {
  return {
    id,
    type: "reasoning",
    status: "completed",
    summary: summaryText ? [{ type: "summary_text", text: summaryText }] : [],
    content: []
  };
}
function messageOutputItem(text, id = `msg_${randomUUID9().replaceAll("-", "")}`) {
  return {
    id,
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [] }]
  };
}
function responseToolCallOutputItem(toolCall, toolTranslation) {
  const mapping = toolTranslation.mappings.get(toolCall.name);
  if (mapping?.kind === "tool_search") {
    return {
      id: `tsc_${randomUUID9().replaceAll("-", "")}`,
      type: "tool_search_call",
      status: "completed",
      call_id: toolCall.id,
      execution: mapping.execution,
      arguments: parseJsonOrEmpty(toolCall.arguments)
    };
  }
  if (mapping?.kind === "custom") {
    const parsed = parseJsonOrEmpty(toolCall.arguments);
    return {
      id: `ctc_${randomUUID9().replaceAll("-", "")}`,
      type: "custom_tool_call",
      status: "completed",
      call_id: toolCall.id,
      name: mapping.sourceName,
      input: customToolInput(parsed, toolCall.arguments)
    };
  }
  if (mapping?.kind === "namespace") {
    return {
      id: `fc_${randomUUID9().replaceAll("-", "")}`,
      type: "function_call",
      status: "completed",
      call_id: toolCall.id,
      namespace: mapping.namespace,
      name: mapping.sourceName,
      arguments: toolCall.arguments || "{}"
    };
  }
  return functionCallOutputItem({
    ...toolCall,
    name: mapping?.sourceName ?? toolCall.name
  });
}
function functionCallOutputItem(toolCall) {
  return {
    id: `fc_${randomUUID9().replaceAll("-", "")}`,
    type: "function_call",
    status: "completed",
    call_id: toolCall.id,
    name: toolCall.name || "tool",
    arguments: toolCall.arguments || "{}"
  };
}
function customToolInput(parsed, rawArguments) {
  if (typeof parsed === "object" && parsed !== null && "input" in parsed) {
    const input = parsed.input;
    if (typeof input === "string") {
      return input;
    }
    return stringifyUnknown(input);
  }
  return rawArguments;
}
function toResponsesUsage(usage) {
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? usage?.reasoning_tokens ?? 0;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: usage?.total_tokens ?? inputTokens + outputTokens,
    output_tokens_details: {
      reasoning_tokens: reasoningTokens
    }
  };
}
var init_translate_response2 = __esm(() => {
  init_sse();
  init_content_format2();
});

// packages/cli/src/lib/codex/together-call.ts
import { randomUUID as randomUUID10 } from "crypto";
function codexTogetherErrorType(status) {
  switch (status) {
    case 400:
      return "invalid_request_error";
    case 401:
      return "authentication_error";
    case 403:
      return "permission_error";
    case 404:
      return "not_found_error";
    case 408:
    case 504:
      return "timeout_error";
    case 429:
      return "rate_limit_error";
    case 503:
      return "overloaded_error";
    default:
      return "api_error";
  }
}
async function callTogether(payload, options, signal) {
  const result = await fetchTogetherChat(payload, options, signal);
  if (!result.ok) {
    throw new CodexTogetherError(result.status, result.errorMessage ?? result.text.slice(0, 1000), result.errorCode);
  }
  return await result.response.json();
}
async function callTogetherWithNativeTools(payload, toolTranslation, options, signal) {
  if (toolTranslation.nativeTools.length === 0) {
    return { response: await callTogether(payload, options, signal), nativeSearchItems: [] };
  }
  const messages = Array.isArray(payload.messages) ? [...payload.messages] : [];
  const nativeToolNames = new Set(toolTranslation.nativeTools.map((tool) => tool.modelName));
  const nativeToolUses = new Map;
  const nativeSearchItems = [];
  for (let iteration = 0;iteration < 6; iteration += 1) {
    const json = await callTogether({ ...payload, messages }, options, signal);
    const toolCalls = json.choices?.[0]?.message?.tool_calls ?? [];
    const nativeToolCalls = toolCalls.filter((toolCall) => nativeToolNames.has(toolCall.function?.name ?? ""));
    if (nativeToolCalls.length === 0) {
      return { response: json, nativeSearchItems };
    }
    if (nativeToolCalls.length !== toolCalls.length) {
      const message = json.choices?.[0]?.message;
      if (message) {
        for (const toolCall of nativeToolCalls) {
          const nativeResult = await runBufferedNativeTool(toolCall, nativeToolUses, toolTranslation, options);
          if (nativeResult.searchItem) {
            nativeSearchItems.push(nativeResult.searchItem);
          }
        }
        message.tool_calls = toolCalls.filter((toolCall) => !nativeToolNames.has(toolCall.function?.name ?? ""));
      }
      return { response: json, nativeSearchItems };
    }
    const reasoning = json.choices?.[0]?.message?.reasoning ?? json.choices?.[0]?.message?.reasoning_content;
    messages.push({
      role: "assistant",
      content: json.choices?.[0]?.message?.content ?? null,
      tool_calls: toolCalls.map((toolCall) => ({
        id: toolCall.id ?? `call_${randomUUID10().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toolCall.function?.name ?? "tool",
          arguments: toolCall.function?.arguments ?? "{}"
        }
      })),
      ...reasoning ? { reasoning_content: reasoning } : {}
    });
    for (const toolCall of nativeToolCalls) {
      const nativeResult = await runBufferedNativeTool(toolCall, nativeToolUses, toolTranslation, options);
      if (nativeResult.searchItem) {
        nativeSearchItems.push(nativeResult.searchItem);
      }
      messages.push({
        role: "tool",
        tool_call_id: nativeResult.toolCallId,
        content: nativeResult.content
      });
    }
  }
  return {
    response: {
      id: `chatcmpl_${randomUUID10().replaceAll("-", "")}`,
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: "I could not complete native web search because the model kept requesting additional search tool calls."
          }
        }
      ]
    },
    nativeSearchItems
  };
}
async function runBufferedNativeTool(toolCall, nativeToolUses, toolTranslation, options) {
  const toolCallId = toolCall.id ?? `call_${randomUUID10().replaceAll("-", "")}`;
  const name = toolCall.function?.name ?? "web_search";
  const nativeTool = toolTranslation.mappings.get(name);
  const input = parseJsonOrEmpty(toolCall.function?.arguments);
  const priorUses = nativeToolUses.get(name) ?? 0;
  const webSearchDefinition = nativeTool?.kind === "web_search" ? nativeTool.definition : undefined;
  const maxUses = webSearchDefinition !== undefined ? codexNativeToolMaxUses(webSearchDefinition) : 0;
  let outcome;
  if (webSearchDefinition !== undefined && priorUses < maxUses) {
    nativeToolUses.set(name, priorUses + 1);
    outcome = await runCodexExaSearchDetailed(input, webSearchDefinition, options);
  } else {
    const content = await runNativeWebSearchCall({
      name,
      priorUses,
      maxUses,
      isWebSearch: webSearchDefinition !== undefined,
      recordUse: () => nativeToolUses.set(name, priorUses + 1),
      runSearch: async () => "Unsupported native server tool."
    });
    outcome = {
      query: webSearchQuery(input),
      text: content,
      results: [],
      errorCode: "unavailable"
    };
  }
  const itemId = `wsc_${randomUUID10().replaceAll("-", "")}`;
  rememberCodexNativeSearchResult(options.nativeSearchResults, itemId, outcome.text);
  return {
    toolCallId,
    content: outcome.text,
    searchItem: webSearchCallItem(itemId, outcome.errorCode === undefined ? "completed" : "failed", outcome.query, outcome)
  };
}
function isTogetherTemplateError(text) {
  return /process_messages_failed|not callable|apply chat template|invalid operation/i.test(text);
}
function cloneMessagesForRetry(messages) {
  const arr = Array.isArray(messages) ? messages : [];
  return arr.map((msg) => ({
    ...msg,
    ...msg.tool_calls ? {
      tool_calls: msg.tool_calls.map((tc) => ({
        ...tc,
        function: { ...tc.function }
      }))
    } : {}
  }));
}
function sanitizePayloadForTemplateRetry(payload) {
  const messages = cloneMessagesForRetry(payload.messages);
  let changed = false;
  for (const message of messages) {
    if (!message.tool_calls)
      continue;
    for (const toolCall of message.tool_calls) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          continue;
        let modified = false;
        for (const key of Object.keys(parsed)) {
          if (TEMPLATE_ERROR_DICT_METHODS.has(key)) {
            parsed[`_${key}`] = parsed[key];
            delete parsed[key];
            modified = true;
          }
        }
        if (modified) {
          toolCall.function.arguments = JSON.stringify(parsed);
          changed = true;
        }
      } catch {
      }
    }
  }
  if (changed) {
    payload.messages = messages;
  }
  return changed;
}
async function fetchTogetherChat(payload, options, signal) {
  const first = await postTogetherChat(payload, options, signal);
  if (first.ok) {
    return { ok: true, response: first };
  }
  const text = await first.text();
  if (isTogetherTemplateError(text)) {
    const sanitized = { ...payload };
    if (sanitizePayloadForTemplateRetry(sanitized)) {
      debugLog9(options, "retrying together request after template-error sanitization", {
        model: sanitized.model,
        originalError: text.slice(0, 1000)
      });
      const retry = await postTogetherChat(sanitized, options, signal);
      if (retry.ok) {
        return { ok: true, response: retry };
      }
      return togetherChatFailure(retry.status, await retry.text());
    }
  }
  return togetherChatFailure(first.status, text);
}
function togetherChatFailure(status, text) {
  let errorCode;
  let errorMessage = text.slice(0, 1000);
  try {
    const parsed = JSON.parse(text);
    const error = parsed.error;
    if (error) {
      errorCode = (typeof error.code === "string" ? error.code : undefined) ?? (typeof error.message === "object" ? error.message.code : undefined);
      errorMessage = (typeof error.message === "string" ? error.message : error.message?.message) ?? error.type ?? errorMessage;
    }
  } catch {
  }
  if (!errorCode && status === 400 && /context[_ -]length|maximum context|input token count|too many tokens/i.test(errorMessage)) {
    errorCode = "context_length_exceeded";
  }
  return {
    ok: false,
    status,
    text,
    ...errorCode ? { errorCode } : {},
    ...errorMessage ? { errorMessage } : {}
  };
}
async function postTogetherChat(payload, options, signal) {
  return postChatCompletion(payload, options, signal);
}
function debugLog9(options, label, payload) {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
var CodexTogetherError, TEMPLATE_ERROR_DICT_METHODS;
var init_together_call2 = __esm(() => {
  init_proxy_debug();
  init_together_client();
  init_content_format2();
  init_translate_request2();
  init_translate_response2();
  CodexTogetherError = class CodexTogetherError extends Error {
    status;
    code;
    name = "CodexTogetherError";
    type;
    constructor(status, message, code) {
      super(message);
      this.status = status;
      this.code = code;
      this.type = codexTogetherErrorType(status);
    }
  };
  TEMPLATE_ERROR_DICT_METHODS = new Set([
    "items",
    "keys",
    "values",
    "get",
    "pop",
    "popitem",
    "setdefault",
    "update",
    "clear",
    "copy",
    "fromkeys"
  ]);
});

// packages/cli/src/lib/codex/memories.ts
function invalidMemoryTraces(value) {
  if (!Array.isArray(value)) {
    return "traces must be an array";
  }
  for (const [index, trace] of value.entries()) {
    if (!trace || typeof trace !== "object" || typeof trace.id !== "string" || !trace.metadata || typeof trace.metadata !== "object" || typeof trace.metadata.source_path !== "string" || !Array.isArray(trace.items)) {
      return `traces[${index}] must contain a string id, metadata.source_path, and an items array`;
    }
  }
  return;
}
async function summarizeTogetherMemories(body, targetModelId, modelDefinition, options, signal, onUsage) {
  const output = [];
  for (const trace of body.traces) {
    const { response } = await callTogetherWithNativeTools(memoryPayload(trace, body.reasoning, targetModelId, modelDefinition), EMPTY_CODEX_TOOL_TRANSLATION, options, signal);
    output.push(memoryOutput(response));
    onUsage?.(response.usage);
  }
  return { output };
}
function memoryPayload(trace, reasoning, targetModelId, modelDefinition) {
  const reasoningEffort = codexReasoningEffort(reasoning, modelDefinition);
  return {
    model: targetModelId,
    messages: [
      { role: "system", content: MEMORY_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(trace) }
    ],
    max_tokens: Math.min(MEMORY_MAX_OUTPUT_TOKENS, modelDefinition.limit.output),
    tools: [],
    tool_choice: "none",
    response_format: { type: "json_object" },
    ...reasoningEffort ? { reasoning_effort: reasoningEffort } : {},
    chat_template_kwargs: { clear_thinking: false },
    stream: false
  };
}
function memoryOutput(response) {
  const content = response.choices?.[0]?.message?.content?.trim() ?? "";
  const parsed = parseMemoryJson(content);
  if (parsed) {
    return parsed;
  }
  const fallback = content || "(no memory summary available)";
  return { trace_summary: fallback, memory_summary: fallback };
}
function parseMemoryJson(content) {
  const unfenced = content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    const value = JSON.parse(unfenced);
    if (typeof value.trace_summary !== "string" || typeof value.memory_summary !== "string") {
      return;
    }
    return {
      trace_summary: value.trace_summary,
      memory_summary: value.memory_summary
    };
  } catch {
    return;
  }
}
var MEMORY_MAX_OUTPUT_TOKENS = 4096, MEMORY_SYSTEM_PROMPT = `You summarize one Codex task trace for durable memory.

Return one JSON object with exactly two string fields:
- "trace_summary": a faithful, concrete summary of what happened in the trace.
- "memory_summary": the durable decisions, preferences, constraints, and reusable lessons worth retaining.

Do not call tools. Do not wrap the JSON in markdown.`;
var init_memories = __esm(() => {
  init_together_call2();
  init_translate_request2();
});

// packages/cli/src/lib/codex/usage.ts
function recordUsage(usage, options, modelDefinition) {
  if (!usage) {
    return;
  }
  options.costTracker?.addUsage(usage.prompt_tokens ?? 0, usage.prompt_tokens_details?.cached_tokens ?? usage.cached_tokens ?? 0, usage.completion_tokens ?? 0, modelDefinition);
}

// packages/cli/src/lib/codex/stream.ts
import { randomUUID as randomUUID11 } from "crypto";
async function streamResponseFromTogether(res, body, options, payload, toolTranslation, modelDefinition, signal, perf) {
  const responseId = `resp_${randomUUID11().replaceAll("-", "")}`;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.flushHeaders?.();
  res.socket?.setNoDelay(true);
  writeResponsesSse(res, "response.created", {
    type: "response.created",
    response: {
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "in_progress",
      model: body.model ?? options.modelId,
      output: []
    }
  });
  writeResponsesSse(res, "response.in_progress", {
    type: "response.in_progress",
    response: {
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "in_progress",
      model: body.model ?? options.modelId,
      output: []
    }
  });
  const outputState = {
    nextOutputIndex: 0,
    reasoningText: "",
    text: ""
  };
  if (toolTranslation.nativeTools.length > 0) {
    return streamResponseWithNativeTools(res, body, options, payload, toolTranslation, modelDefinition, outputState, responseId, signal, perf);
  }
  let turn;
  try {
    turn = await streamTogetherTurnWithIdleRetries(res, body, options, payload, toolTranslation, modelDefinition, outputState, signal, perf);
  } catch (err) {
    if (signal?.aborted) {
      return clientDisconnectedResult2();
    }
    if (err instanceof TogetherSsePrematureCloseError) {
      return failStream(res, responseId, 502, err.message);
    }
    if (err instanceof SseIdleTimeoutError || err instanceof TogetherSseIdleTimeoutError || err instanceof TogetherResponseHeaderTimeoutError) {
      return failStream(res, responseId, 504, err.message);
    }
    if (err instanceof TogetherSseRetryResponseError) {
      return failStream(res, responseId, err.response.status, `Together SSE retry returned ${err.response.status}: ${(await err.response.text()).slice(0, 1000)}`);
    }
    throw err;
  }
  if (!turn.ok) {
    return failStream(res, responseId, turn.status, turn.error, turn.errorCode);
  }
  return completeStreamResponse(res, body, options, responseId, outputState, turn.toolCalls, turn.usage, modelDefinition, toolTranslation, turn.finishReason, [], payloadMaxTokens(payload));
}
async function streamTogetherTurn(res, body, options, payload, toolTranslation, modelDefinition, outputState, signal, perf, deferText = false) {
  const upstreamResult = await (perf?.span("upstream_fetch", () => fetchTogetherChat(payload, options, signal), { stream: true }) ?? fetchTogetherChat(payload, options, signal));
  if (!upstreamResult.ok) {
    const message = `Together API returned ${upstreamResult.status}: ${upstreamResult.errorMessage ?? upstreamResult.text.slice(0, 1000)}`;
    return {
      ok: false,
      status: upstreamResult.status,
      error: message,
      ...upstreamResult.errorCode ? { errorCode: upstreamResult.errorCode } : {}
    };
  }
  const upstream = upstreamResult.response;
  if (!upstream.body) {
    const message = "Together returned no stream body.";
    return { ok: false, status: 500, error: message };
  }
  const toolCalls = new Map;
  let usage;
  let reasoningText = "";
  let text = "";
  let finishReason;
  let lastProgressAt = Date.now();
  const progressTimeoutMs = codexStreamIdleTimeoutMs();
  let streamAttempt = 0;
  for await (const eventData of readTogetherSseWithRetry(upstream, async () => {
    const retried = await fetchTogetherChat(payload, options, signal);
    return retried.ok ? retried.response : new Response(retried.text, {
      status: retried.status,
      headers: { "content-type": "application/json" }
    });
  }, {
    isOutputStarted: () => streamOutputStarted(outputState),
    onRetry: ({ attempt, maxRetries, timeoutMs, reason }) => debugLog10(options, "retrying together stream", {
      attempt,
      maxRetries,
      model: payload.model,
      reason,
      timeoutMs
    }),
    ...signal ? { signal } : {}
  })) {
    if (eventData.attempt !== streamAttempt) {
      streamAttempt = eventData.attempt;
      toolCalls.clear();
      usage = undefined;
      reasoningText = "";
      text = "";
      finishReason = undefined;
      lastProgressAt = Date.now();
    }
    const chunk = eventData.data;
    if (chunk === "[DONE]") {
      break;
    }
    let parsed;
    try {
      parsed = JSON.parse(chunk);
    } catch {
      continue;
    }
    let madeProgress = false;
    if (parsed.usage) {
      usage = parsed.usage;
      madeProgress = true;
    }
    const choice = parsed.choices?.[0];
    if (choice?.finish_reason) {
      finishReason = choice.finish_reason;
    }
    const delta = choice?.delta;
    if (!delta) {
      assertStreamProgress(lastProgressAt, progressTimeoutMs);
      continue;
    }
    const reasoningDelta = delta.reasoning ?? delta.reasoning_content;
    if (reasoningDelta) {
      madeProgress = true;
      perf?.markOnce("first_delta", { kind: "reasoning" });
      openReasoningOutputItem(res, outputState);
      outputState.reasoningText += reasoningDelta;
      reasoningText += reasoningDelta;
      writeResponsesSse(res, "response.reasoning_text.delta", {
        type: "response.reasoning_text.delta",
        item_id: outputState.reasoningItemId,
        output_index: outputState.reasoningOutputIndex,
        content_index: 0,
        delta: reasoningDelta
      });
    }
    if (delta.content) {
      madeProgress = true;
      perf?.markOnce("first_delta", { kind: "text" });
      text += delta.content;
      if (!deferText) {
        emitOutputTextDelta(res, outputState, delta.content);
      }
    }
    for (const toolCall of delta.tool_calls ?? []) {
      if (toolCall.id || toolCall.function?.name || toolCall.function?.arguments) {
        madeProgress = true;
        perf?.markOnce("first_delta", { kind: "tool_call" });
      }
      const index = toolCall.index ?? 0;
      const current = toolCalls.get(index) ?? {
        id: toolCall.id ?? `call_${randomUUID11().replaceAll("-", "")}`,
        name: "",
        arguments: ""
      };
      if (toolCall.id) {
        current.id = toolCall.id;
      }
      if (toolCall.function?.name) {
        current.name += toolCall.function.name;
      }
      if (toolCall.function?.arguments) {
        current.arguments += toolCall.function.arguments;
      }
      toolCalls.set(index, current);
    }
    if (madeProgress) {
      lastProgressAt = Date.now();
    } else {
      assertStreamProgress(lastProgressAt, progressTimeoutMs);
    }
  }
  if (!finishReason) {
    return { ok: false, status: 502, error: "Together stream ended without a finish reason." };
  }
  return { ok: true, toolCalls: [...toolCalls.values()], usage, reasoningText, text, finishReason };
}
function assertStreamProgress(lastProgressAt, timeoutMs) {
  if (Date.now() - lastProgressAt > timeoutMs) {
    throw new SseIdleTimeoutError(timeoutMs);
  }
}
async function streamResponseWithNativeTools(res, body, options, payload, toolTranslation, modelDefinition, outputState, responseId, signal, perf) {
  const messages = Array.isArray(payload.messages) ? [...payload.messages] : [];
  const nativeToolNames = new Set(toolTranslation.nativeTools.map((tool) => tool.modelName));
  const nativeToolUses = new Map;
  let usage;
  let lastFinishReason;
  const nativeSearchItems = [];
  for (let iteration = 0;iteration < 6; iteration += 1) {
    let turn;
    try {
      turn = await streamTogetherTurnWithIdleRetries(res, body, options, { ...payload, messages, stream: true, stream_options: { include_usage: true } }, toolTranslation, modelDefinition, outputState, signal, perf, true);
    } catch (err) {
      if (signal?.aborted) {
        return clientDisconnectedResult2();
      }
      if (err instanceof TogetherSsePrematureCloseError) {
        return failStream(res, responseId, 502, err.message);
      }
      if (err instanceof SseIdleTimeoutError || err instanceof TogetherSseIdleTimeoutError || err instanceof TogetherResponseHeaderTimeoutError) {
        return failStream(res, responseId, 504, err.message);
      }
      if (err instanceof TogetherSseRetryResponseError) {
        return failStream(res, responseId, err.response.status, `Together SSE retry returned ${err.response.status}: ${(await err.response.text()).slice(0, 1000)}`);
      }
      throw err;
    }
    if (!turn.ok) {
      return failStream(res, responseId, turn.status, turn.error, turn.errorCode);
    }
    usage = mergeUsage(usage, turn.usage);
    lastFinishReason = turn.finishReason;
    const nativeToolCalls = turn.toolCalls.filter((toolCall) => nativeToolNames.has(toolCall.name));
    if (nativeToolCalls.length === 0) {
      emitOutputTextDelta(res, outputState, turn.text);
      return completeStreamResponse(res, body, options, responseId, outputState, turn.toolCalls, usage, modelDefinition, toolTranslation, turn.finishReason, nativeSearchItems, payloadMaxTokens(payload));
    }
    const assistantToolCalls = turn.toolCalls.map((toolCall) => ({
      id: toolCall.id,
      type: "function",
      function: {
        name: toolCall.name || "tool",
        arguments: toolCall.arguments || "{}"
      }
    }));
    const nativeRun = await runNativeToolCalls(res, nativeToolCalls, nativeToolUses, toolTranslation, options, outputState);
    const nativeResultMessages = nativeRun.results;
    nativeSearchItems.push(...nativeRun.items);
    if (nativeToolCalls.length !== turn.toolCalls.length) {
      const clientToolCalls = turn.toolCalls.filter((toolCall) => !nativeToolNames.has(toolCall.name));
      return completeStreamResponse(res, body, options, responseId, outputState, clientToolCalls, usage, modelDefinition, toolTranslation, turn.finishReason, nativeSearchItems, payloadMaxTokens(payload));
    }
    messages.push({
      role: "assistant",
      content: turn.text || null,
      tool_calls: assistantToolCalls,
      ...turn.reasoningText ? { reasoning_content: turn.reasoningText } : {}
    });
    for (const result of nativeResultMessages) {
      messages.push({ role: "tool", tool_call_id: result.id, content: result.content });
    }
  }
  openTextOutputItem(res, outputState);
  const fallback = "I could not complete native web search because the model kept requesting additional search tool calls.";
  outputState.text += fallback;
  writeResponsesSse(res, "response.output_text.delta", {
    type: "response.output_text.delta",
    item_id: outputState.textItemId,
    output_index: outputState.textOutputIndex,
    content_index: 0,
    delta: fallback
  });
  return completeStreamResponse(res, body, options, responseId, outputState, [], usage, modelDefinition, toolTranslation, lastFinishReason, nativeSearchItems, payloadMaxTokens(payload));
}
function payloadMaxTokens(payload) {
  return typeof payload.max_tokens === "number" && Number.isFinite(payload.max_tokens) ? payload.max_tokens : undefined;
}
function clientDisconnectedResult2() {
  return { ok: false, status: 499, error: "Codex client disconnected." };
}
async function streamTogetherTurnWithIdleRetries(res, body, options, payload, toolTranslation, modelDefinition, outputState, signal, perf, deferText = false) {
  const maxRetries = codexStreamIdleRetries();
  for (let attempt = 0;attempt <= maxRetries; attempt += 1) {
    try {
      return await streamTogetherTurn(res, body, options, payload, toolTranslation, modelDefinition, outputState, signal, perf, deferText);
    } catch (err) {
      if (!(err instanceof SseIdleTimeoutError) || streamOutputStarted(outputState) || attempt >= maxRetries) {
        throw err;
      }
      debugLog10(options, "retrying together stream after idle timeout", {
        attempt,
        maxRetries,
        model: payload.model,
        timeoutMs: err.timeoutMs
      });
      await sleep(backoffMs(attempt));
    }
  }
  throw new SseIdleTimeoutError(codexStreamIdleTimeoutMs());
}
function emitOutputTextDelta(res, outputState, delta) {
  if (!delta) {
    return;
  }
  openTextOutputItem(res, outputState);
  outputState.text += delta;
  writeResponsesSse(res, "response.output_text.delta", {
    type: "response.output_text.delta",
    item_id: outputState.textItemId,
    output_index: outputState.textOutputIndex,
    content_index: 0,
    delta
  });
}
function streamOutputStarted(outputState) {
  return outputState.reasoningItemId !== undefined || outputState.textItemId !== undefined;
}
async function runNativeToolCalls(res, nativeToolCalls, nativeToolUses, toolTranslation, options, outputState) {
  const results = [];
  const items = [];
  for (const toolCall of nativeToolCalls) {
    const name = toolCall.name || "web_search";
    const nativeTool = toolTranslation.mappings.get(name);
    const input = parseJsonOrEmpty(toolCall.arguments);
    const priorUses = nativeToolUses.get(name) ?? 0;
    const webSearchDefinition = nativeTool?.kind === "web_search" ? nativeTool.definition : undefined;
    const maxUses = webSearchDefinition !== undefined ? codexNativeToolMaxUses(webSearchDefinition) : 0;
    if (webSearchDefinition !== undefined) {
      const query = typeof input === "object" && input !== null ? String(input.query ?? "") : "";
      const { itemId, outputIndex } = openWebSearchCallItem(res, outputState, query);
      const outcome = await runCodexExaSearchDetailed(input, webSearchDefinition, options);
      nativeToolUses.set(name, priorUses + 1);
      completeWebSearchCallItem(res, itemId, outputIndex, query, outcome);
      rememberCodexNativeSearchResult(options.nativeSearchResults, itemId, outcome.text);
      items.push({
        item: webSearchCallItem(itemId, outcome.errorCode === undefined ? "completed" : "failed", query, outcome),
        outputIndex
      });
      results.push({ id: toolCall.id, name, content: outcome.text });
      continue;
    }
    const content = await runNativeWebSearchCall({
      name,
      priorUses,
      maxUses,
      isWebSearch: false,
      recordUse: () => nativeToolUses.set(name, priorUses + 1),
      runSearch: async () => "Unsupported native server tool."
    });
    results.push({ id: toolCall.id, name, content });
  }
  return { results, items };
}
function completeOpenOutputItems(res, outputState) {
  if (outputState.reasoningItemId !== undefined) {
    writeResponsesSse(res, "response.reasoning_text.done", {
      type: "response.reasoning_text.done",
      item_id: outputState.reasoningItemId,
      output_index: outputState.reasoningOutputIndex,
      content_index: 0,
      text: outputState.reasoningText
    });
    writeResponsesSse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: outputState.reasoningOutputIndex,
      item: reasoningOutputItem(outputState.reasoningItemId, outputState.reasoningText)
    });
  }
  if (outputState.textItemId !== undefined) {
    writeResponsesSse(res, "response.output_text.done", {
      type: "response.output_text.done",
      item_id: outputState.textItemId,
      output_index: outputState.textOutputIndex,
      content_index: 0,
      text: outputState.text
    });
    writeResponsesSse(res, "response.content_part.done", {
      type: "response.content_part.done",
      item_id: outputState.textItemId,
      output_index: outputState.textOutputIndex,
      content_index: 0,
      part: { type: "output_text", text: outputState.text, annotations: [] }
    });
    writeResponsesSse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: outputState.textOutputIndex,
      item: messageOutputItem(outputState.text, outputState.textItemId)
    });
  }
}
function completeStreamResponse(res, body, options, responseId, outputState, toolCalls, usage, modelDefinition, toolTranslation, finishReason, nativeSearchItems = [], requestedMaxTokens) {
  completeOpenOutputItems(res, outputState);
  let outputIndex = outputState.nextOutputIndex;
  for (const toolCall of toolCalls) {
    const item = responseToolCallOutputItem(toolCall, toolTranslation);
    writeResponsesSse(res, "response.output_item.added", {
      type: "response.output_item.added",
      output_index: outputIndex,
      item
    });
    writeResponsesSse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: outputIndex,
      item
    });
    outputIndex += 1;
  }
  if (usage) {
    recordUsage(usage, options, modelDefinition);
  }
  const isLengthTruncated = isTruncationReal(finishReason, {
    outputTokens: usage?.completion_tokens,
    requestedMaxTokens
  });
  const terminalEvent = isLengthTruncated ? "response.incomplete" : "response.completed";
  const outputItems = [];
  if (outputState.reasoningItemId !== undefined) {
    outputItems.push({
      item: reasoningOutputItem(outputState.reasoningItemId, outputState.reasoningText),
      outputIndex: outputState.reasoningOutputIndex ?? 0
    });
  }
  if (outputState.textItemId !== undefined) {
    outputItems.push({
      item: messageOutputItem(outputState.text, outputState.textItemId),
      outputIndex: outputState.textOutputIndex ?? 0
    });
  }
  outputItems.push(...nativeSearchItems);
  for (const toolCall of toolCalls) {
    outputItems.push({
      item: responseToolCallOutputItem(toolCall, toolTranslation),
      outputIndex: Number.MAX_SAFE_INTEGER
    });
  }
  outputItems.sort((a3, b3) => a3.outputIndex - b3.outputIndex);
  writeResponsesSse(res, terminalEvent, {
    type: terminalEvent,
    response: {
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: isLengthTruncated ? "incomplete" : "completed",
      model: body.model ?? options.modelId,
      output: outputItems.map((entry) => entry.item),
      usage: toResponsesUsage(usage),
      ...isLengthTruncated ? { incomplete_details: { reason: "max_output_tokens" } } : {}
    }
  });
  res.end();
  return { ok: true, status: res.statusCode };
}
function failStream(res, responseId, status, message, code) {
  writeResponsesSse(res, "response.failed", {
    type: "response.failed",
    response: {
      id: responseId,
      status: "failed",
      error: { ...code ? { code } : {}, message }
    }
  });
  res.end();
  return { ok: false, status, error: message };
}
function mergeUsage(current, next) {
  if (!current) {
    return next;
  }
  if (!next) {
    return current;
  }
  const cachedTokens = (current.prompt_tokens_details?.cached_tokens ?? current.cached_tokens ?? 0) + (next.prompt_tokens_details?.cached_tokens ?? next.cached_tokens ?? 0);
  const reasoningTokens = (current.completion_tokens_details?.reasoning_tokens ?? current.reasoning_tokens ?? 0) + (next.completion_tokens_details?.reasoning_tokens ?? next.reasoning_tokens ?? 0);
  return {
    prompt_tokens: (current.prompt_tokens ?? 0) + (next.prompt_tokens ?? 0),
    completion_tokens: (current.completion_tokens ?? 0) + (next.completion_tokens ?? 0),
    total_tokens: (current.total_tokens ?? 0) + (next.total_tokens ?? 0),
    cached_tokens: cachedTokens,
    reasoning_tokens: reasoningTokens,
    prompt_tokens_details: { cached_tokens: cachedTokens },
    completion_tokens_details: { reasoning_tokens: reasoningTokens }
  };
}
function codexStreamIdleTimeoutMs() {
  const raw = process.env.TOGETHERLINK_STREAM_IDLE_TIMEOUT_MS ?? process.env.TOGETHERLINK_CODEX_STREAM_IDLE_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(100, parsed) : DEFAULT_CODEX_STREAM_IDLE_TIMEOUT_MS;
}
function codexStreamIdleRetries() {
  const raw = process.env.TOGETHERLINK_CODEX_STREAM_IDLE_RETRIES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : MAX_TOGETHER_STREAM_IDLE_RETRIES;
}
function debugLog10(options, label, payload) {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
var MAX_TOGETHER_STREAM_IDLE_RETRIES = 3, DEFAULT_CODEX_STREAM_IDLE_TIMEOUT_MS = 120000, SseIdleTimeoutError;
var init_stream2 = __esm(() => {
  init_proxy_debug();
  init_together_client();
  init_together_stream();
  init_sse();
  init_content_format2();
  init_translate_request2();
  init_translate_response2();
  init_together_call2();
  SseIdleTimeoutError = class SseIdleTimeoutError extends Error {
    timeoutMs;
    constructor(timeoutMs) {
      super(`Together stream produced no SSE event for ${timeoutMs}ms.`);
      this.timeoutMs = timeoutMs;
      this.name = "SseIdleTimeoutError";
    }
  };
});

// packages/cli/src/lib/codex/routes.ts
function normalizeCodexPath(path7) {
  return CODEX_V1_ALIAS_PATHS.has(path7) ? `/v1${path7}` : path7;
}
function isCodexResponsesPath(path7) {
  const normalized = normalizeCodexPath(path7);
  return normalized === CODEX_RESPONSES_PATH || normalized === CODEX_COMPACTION_PATH;
}
function isCodexResponsesWebsocketPath(path7) {
  return normalizeCodexPath(path7) === CODEX_RESPONSES_PATH;
}
function isCodexNativeOnlyPath(path7) {
  return CODEX_NATIVE_ONLY_PATHS.has(normalizeCodexPath(path7));
}
var CODEX_V1_ALIAS_PATHS, CODEX_RESPONSES_PATH = "/v1/responses", CODEX_COMPACTION_PATH = "/v1/responses/compact", CODEX_MEMORIES_PATH = "/v1/memories/trace_summarize", CODEX_NATIVE_ONLY_PATHS;
var init_routes = __esm(() => {
  CODEX_V1_ALIAS_PATHS = new Set([
    "/models",
    "/responses",
    "/responses/compact",
    "/alpha/search",
    "/images/generations",
    "/images/edits",
    "/memories/trace_summarize"
  ]);
  CODEX_NATIVE_ONLY_PATHS = new Set([
    "/v1/alpha/search",
    "/v1/images/generations",
    "/v1/images/edits"
  ]);
});

// packages/cli/src/lib/codex/proxy.ts
async function handleCodexProxyRequest(req, res, options) {
  options.nativeSearchResults ??= new Map;
  const requestedPath = requestPath(req);
  const path7 = normalizeCodexPath(requestedPath);
  const perf = createProxyPerfTracer("codex.proxy", {
    method: req.method,
    path: path7
  }, options.perfSink);
  debugLog11(options, "http request", { method: req.method, url: req.url, path: path7 });
  if (req.method === "HEAD" && path7 === "/") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method === "GET" && path7 === "/v1/models") {
    writeJson(res, 200, codexModelCatalog());
    return;
  }
  const nativeOnlyPath = isCodexNativeOnlyPath(path7);
  const memoriesPath = path7 === CODEX_MEMORIES_PATH;
  const responsesPath = isCodexResponsesPath(path7);
  if (req.method === "POST" && (nativeOnlyPath || memoriesPath || responsesPath) && !requireCodexTransport(req, res)) {
    return;
  }
  if (req.method === "POST" && nativeOnlyPath && options.nativeBaseUrl) {
    const request2 = await readDecodedCodexRequest(req);
    await forwardNativeCodexRequest(req, res, {
      baseUrl: options.nativeBaseUrl,
      path: path7,
      body: request2.bytes,
      ...options.fetch ? { fetch: options.fetch } : {}
    });
    perf.end({ status: res.statusCode, native: true });
    return;
  }
  if (req.method === "POST" && memoriesPath) {
    const request2 = await perf.span("body_read_parse", () => readDecodedCodexRequest(req));
    const body2 = request2.body;
    const requestedTogetherModel2 = body2.model ? findModelById(body2.model) : options.modelDefinition;
    if (options.nativeBaseUrl && body2.model && !requestedTogetherModel2) {
      await forwardNativeCodexRequest(req, res, {
        baseUrl: options.nativeBaseUrl,
        path: path7,
        body: request2.bytes,
        ...options.fetch ? { fetch: options.fetch } : {}
      });
      perf.end({ status: res.statusCode, native: true, model: body2.model });
      return;
    }
    const invalidTraces = invalidMemoryTraces(body2.traces);
    if (invalidTraces) {
      writeOpenAIError(res, 400, "invalid_request_error", invalidTraces);
      perf.end({ status: res.statusCode });
      return;
    }
    options.costTracker?.beginRequest();
    const definition = requestedTogetherModel2 ?? options.modelDefinition;
    const targetModelId = requestedTogetherModel2?.id ?? options.targetModelId;
    const upstreamAbort2 = new AbortController;
    const abort = () => upstreamAbort2.abort(new DOMException("Codex client disconnected.", "AbortError"));
    req.once("aborted", abort);
    res.once("close", () => {
      if (!res.writableEnded)
        abort();
    });
    const summarized = await summarizeTogetherMemories(body2, targetModelId, definition, options, upstreamAbort2.signal, (usage) => recordUsage(usage, options, definition));
    writeJson(res, 200, { output: summarized.output });
    perf.end({ status: res.statusCode, traces: body2.traces.length, model: targetModelId });
    return;
  }
  if (req.method !== "POST" || !responsesPath) {
    writeOpenAIError(res, 404, "not_found_error", `Unsupported route ${req.method ?? ""} ${req.url ?? ""}`.trim());
    return;
  }
  const request = await perf.span("body_read_parse", () => readDecodedCodexRequest(req));
  const { body } = request;
  const requestedTogetherModel = body.model ? findModelById(body.model) : undefined;
  if (options.nativeBaseUrl && body.model && !requestedTogetherModel) {
    const nativeBody = sanitizeNativeResponsesReplay({ ...body });
    if (nativeBody.input !== undefined) {
      nativeBody.input = normalizeNativeCompactionInput(nativeBody.input);
    }
    if (path7 !== CODEX_COMPACTION_PATH) {
      delete nativeBody.previous_response_id;
    }
    await forwardNativeCodexRequest(req, res, {
      baseUrl: options.nativeBaseUrl,
      path: path7,
      body: Buffer.from(JSON.stringify(nativeBody), "utf8"),
      ...options.fetch ? { fetch: options.fetch } : {}
    });
    perf.end({ status: res.statusCode, native: true, model: body.model });
    return;
  }
  const inputEstimate = codexInputEstimate(body, request.rawBytes);
  options.costTracker?.noteRequestBytes(inputEstimate.hasImages ? 0 : request.rawBytes);
  options.costTracker?.beginRequest();
  const estimatedBytes = inputEstimate.hasImages ? inputEstimate.textBytes : request.rawBytes;
  const estimatedInputTokens = options.costTracker?.tokenEstimator.estimate(estimatedBytes) ?? Math.max(1, Math.ceil(estimatedBytes / 4));
  const upstreamAbort = new AbortController;
  const markClientDisconnected = () => {
    if (upstreamAbort.signal.aborted) {
      return;
    }
    debugLog11(options, "codex client disconnected; aborting upstream request", {});
    upstreamAbort.abort(new DOMException("Codex client disconnected.", "AbortError"));
  };
  req.once("aborted", markClientDisconnected);
  res.once("close", () => {
    if (!res.writableEnded) {
      markClientDisconnected();
    }
  });
  const translated = perf.spanSync("translate_request", () => {
    const toolTranslation2 = translateCodexRequestTools(body);
    const nativeToolCount2 = toolTranslation2.nativeTools.length;
    const requestModel2 = resolveCodexRequestModel(body, options);
    const translatedPayload2 = toChatPayload(body, options, Boolean(body.stream), toolTranslation2, requestModel2, estimatedInputTokens);
    return { nativeToolCount: nativeToolCount2, toolTranslation: toolTranslation2, requestModel: requestModel2, translatedPayload: translatedPayload2 };
  });
  const { nativeToolCount, toolTranslation, requestModel, translatedPayload } = translated;
  const compactV1 = path7 === CODEX_COMPACTION_PATH;
  const compactV2 = isTogetherCompactionV2(body);
  if (compactV1 || compactV2) {
    const compactBody = structuredClone(body);
    delete compactBody.tools;
    const normalizedInput = compactionInput(body);
    if (normalizedInput !== undefined) {
      compactBody.input = normalizedInput;
    }
    const compactPayload = toTogetherCompactionPayload(toChatPayload(compactBody, options, false, { tools: [], mappings: new Map, nativeTools: [] }, requestModel, estimatedInputTokens), requestModel.definition);
    const historicalImageReferences = codexHistoricalImageReferences(compactBody.input);
    const { response: chatResponse2 } = await perf.span("compaction_upstream_fetch", () => callTogetherWithNativeTools(compactPayload, { tools: [], mappings: new Map, nativeTools: [] }, options, upstreamAbort.signal));
    recordUsage(chatResponse2.usage, options, requestModel.definition);
    const baseSummary = compactionSummary(chatResponse2);
    const summary = historicalImageReferences.length > 0 ? `${baseSummary}

Historical image references preserved by TogetherLink:
${historicalImageReferences.map((reference) => `- ${reference}`).join(`
`)}` : baseSummary;
    if (compactV1) {
      writeJson(res, 200, togetherV1CompactOutput(body.input, summary));
    } else if (body.stream) {
      writeTogetherCompactionSse(res, body.model ?? options.modelId, summary);
    } else {
      writeJson(res, 200, togetherCompactionResponse(body.model ?? options.modelId, summary));
    }
    perf.end({
      status: res.statusCode,
      compaction: compactV1 ? "v1" : "v2",
      stream: compactV2 && Boolean(body.stream)
    });
    return;
  }
  debugLog11(options, "responses request", () => ({
    model: body.model,
    targetModel: requestModel.targetModelId,
    memory: requestModel.memory,
    stream: body.stream,
    inputItems: Array.isArray(body.input) ? body.input.length : typeof body.input,
    toolCount: body.tools?.length ?? 0,
    nativeToolCount,
    tools: summarizeResponsesTools(body.tools)
  }));
  if (body.stream) {
    await perf.span("stream_response", () => streamResponseFromTogether(res, body, options, translatedPayload, toolTranslation, requestModel.definition, upstreamAbort.signal, perf), { nativeToolCount });
    perf.end({ status: res.statusCode, stream: true });
    return;
  }
  const nativeToolResponse = await perf.span("upstream_fetch_and_tool_loop", () => callTogetherWithNativeTools(translatedPayload, toolTranslation, options, upstreamAbort.signal), { nativeToolCount });
  const { response: chatResponse, nativeSearchItems } = nativeToolResponse;
  recordUsage(chatResponse.usage, options, requestModel.definition);
  const responseBody = perf.spanSync("response_map", () => toResponsesResponse(chatResponse, body, {
    ...options,
    ...typeof translatedPayload.max_tokens === "number" ? { requestedMaxTokens: translatedPayload.max_tokens } : {}
  }, toolTranslation, nativeSearchItems));
  writeJson(res, 200, responseBody);
  perf.end({ status: res.statusCode, stream: false });
}
function codexInputEstimate(body, rawBytes) {
  let hasImages = false;
  const textOnlyJson = JSON.stringify(body, (_key, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }
    const record = value;
    if (record.type === "input_image" || record.type === "image_url") {
      hasImages = true;
      return {
        ...record,
        ...typeof record.image_url === "string" ? { image_url: "[image omitted]" } : {},
        ...typeof record.file_id === "string" ? { file_id: "[image file]" } : {}
      };
    }
    if (record.type === "image_generation_call" && typeof record.result === "string") {
      hasImages = true;
      return { ...record, result: "[generated image omitted]" };
    }
    return value;
  });
  return {
    hasImages,
    textBytes: hasImages ? Buffer.byteLength(textOnlyJson, "utf8") : rawBytes
  };
}
function requireCodexTransport(req, res) {
  const contentType = String(req.headers["content-type"] ?? "").split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    writeOpenAIError(res, 415, "unsupported_media_type", "Codex router requests require Content-Type: application/json.");
    return false;
  }
  return true;
}
function summarizeResponsesTools(tools) {
  if (!tools || tools.length === 0) {
    return;
  }
  return tools.map((tool) => ({
    name: tool.name,
    type: tool.type,
    parameterKeys: objectKeys(tool.parameters),
    rawKeys: Object.keys(tool)
  }));
}
function writeOpenAIError(res, status, type, message, code) {
  writeJson(res, status, { error: { type, ...code ? { code } : {}, message } });
}
function debugLog11(options, label, payload) {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
var init_proxy2 = __esm(() => {
  init_dist3();
  init_catalog();
  init_proxy_perf();
  init_http_util();
  init_proxy_debug();
  init_content_format2();
  init_compaction2();
  init_native_router();
  init_native_replay();
  init_memories();
  init_translate_request2();
  init_translate_response2();
  init_together_call2();
  init_stream2();
  init_routes();
});

// packages/cli/src/lib/codex/native-websocket-relay.ts
import { WebSocket } from "ws";
function relayNativeCodexWebsocket(downstream, options, upgradeHeaders) {
  const pending = [];
  let upstream;
  let closed = false;
  let idleTimer;
  const url = nativeWebsocketUrl(options.nativeBaseUrl);
  const headers = buildUpstreamHeaders(upgradeHeaders);
  try {
    const clientOptions = {
      headers,
      perMessageDeflate: true
    };
    upstream = new WebSocket(url, clientOptions);
  } catch (err) {
    sendRelayError(downstream, err);
    return { send: () => {
    }, close: () => {
    } };
  }
  upstream.binaryType = "nodebuffer";
  upstream.on("open", () => {
    for (const frame of pending.splice(0)) {
      upstream?.send(frame);
    }
  });
  upstream.on("message", (data, isBinary) => {
    bumpIdleTimer();
    if (downstream.readyState === downstream.OPEN) {
      downstream.send(data, { binary: isBinary });
    }
  });
  upstream.on("close", (code, reason) => {
    closed = true;
    clearIdleTimer();
    if (downstream.readyState === downstream.OPEN) {
      if (code === 1005 || code === 1006 || code === 1015) {
        downstream.terminate();
      } else {
        downstream.close(code, reason);
      }
    }
  });
  upstream.on("error", (err) => {
    sendRelayError(downstream, err);
  });
  function bumpIdleTimer() {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      upstream?.close(1000, "idle timeout");
    }, UPSTREAM_IDLE_TIMEOUT_MS);
    idleTimer.unref?.();
  }
  function clearIdleTimer() {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  }
  bumpIdleTimer();
  return {
    send(body) {
      if (closed) {
        return;
      }
      const frame = JSON.stringify(body);
      if (upstream !== undefined && upstream.readyState === upstream.OPEN) {
        upstream.send(frame);
      } else {
        pending.push(frame);
      }
      bumpIdleTimer();
    },
    close() {
      closed = true;
      clearIdleTimer();
      if (upstream !== undefined && upstream.readyState === upstream.OPEN) {
        upstream.close(1000);
      }
    }
  };
}
function nativeWebsocketUrl(nativeBaseUrl) {
  const httpUrl = `${nativeBaseUrl.replace(/\/+$/, "")}/responses`;
  if (httpUrl.startsWith("https://")) {
    return `wss://${httpUrl.slice("https://".length)}`;
  }
  if (httpUrl.startsWith("http://")) {
    return `ws://${httpUrl.slice("http://".length)}`;
  }
  return httpUrl;
}
function buildUpstreamHeaders(upgradeHeaders) {
  const headers = {};
  for (const [name, value] of Object.entries(upgradeHeaders)) {
    if (value === undefined || !NATIVE_CODEX_FORWARD_HEADERS.has(name.toLowerCase())) {
      continue;
    }
    headers[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  const beta = headers["openai-beta"] ?? headers["OpenAI-Beta"];
  if (beta === undefined || !beta.includes("responses_websockets=")) {
    headers["OpenAI-Beta"] = RESPONSES_WEBSOCKET_BETA;
  }
  return headers;
}
function sendRelayError(downstream, err) {
  if (downstream.readyState !== downstream.OPEN) {
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  downstream.send(JSON.stringify({ type: "error", error: { type: "server_error", message } }));
}
var RESPONSES_WEBSOCKET_BETA = "responses_websockets=2026-02-06", UPSTREAM_IDLE_TIMEOUT_MS;
var init_native_websocket_relay = __esm(() => {
  init_native_headers();
  UPSTREAM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
});

// packages/cli/src/lib/codex/responses-websocket.ts
import { EventEmitter } from "events";
import { randomUUID as randomUUID12 } from "crypto";
import { Readable } from "stream";
function handleCodexResponsesWebsocket(ws, options, upgradeHeaders = {}) {
  let activeSink;
  let queue = Promise.resolve();
  let lastRequest;
  let lastResponseId;
  let lastResponseOutput = [];
  let nativeRelay;
  ws.on("message", (raw) => {
    queue = queue.then(() => processTurn(raw)).catch((err) => sendFatalError(ws, err));
  });
  ws.on("close", () => {
    activeSink?.emit("close");
    nativeRelay?.close();
  });
  async function processTurn(raw) {
    const payload = parseMessage(raw);
    if (payload === undefined) {
      throw new Error("Codex websocket message must be a valid JSON object.");
    }
    const { type, ...rawBody } = payload;
    if (type !== undefined && type !== "response.create") {
      ws.close(RESPONSES_WEBSOCKET_REPLAY_REQUIRED_CODE, RESPONSES_WEBSOCKET_REPLAY_REQUIRED_REASON);
      return;
    }
    const continuesTogetherResponse = lastRequest !== undefined && typeof rawBody.previous_response_id === "string" && rawBody.previous_response_id === lastResponseId;
    if (isNativeRelayTurn(rawBody, options) && !continuesTogetherResponse) {
      const relay = ensureNativeRelay();
      const nativeBody = sanitizeNativeResponsesReplay(rawBody);
      lastRequest = undefined;
      lastResponseId = undefined;
      lastResponseOutput = [];
      relay.send({ ...nativeBody, type: "response.create" });
      return;
    }
    const body = expandIncrementalRequest(rawBody, lastRequest, lastResponseId, lastResponseOutput);
    if (body === undefined) {
      sendPreviousResponseNotFound(ws);
      return;
    }
    if (body.generate === false) {
      delete body.generate;
      delete body.previous_response_id;
      lastRequest = cloneJsonObject(body);
      lastResponseId = sendPrewarmCompleted(ws, body, options.modelId);
      lastResponseOutput = [];
      return;
    }
    delete body.generate;
    delete body.previous_response_id;
    if (isNativeRelayTurn(body, options)) {
      const relay = ensureNativeRelay();
      const nativeBody = sanitizeNativeResponsesReplay(body);
      lastRequest = undefined;
      lastResponseId = undefined;
      lastResponseOutput = [];
      relay.send({ ...nativeBody, type: "response.create" });
      return;
    }
    body.stream = true;
    const req = fakeCodexRequest(body);
    let completedResponse;
    const sink = new WebSocketSseSink(ws, (event) => {
      if (event.type === "response.completed" || event.type === "response.incomplete") {
        completedResponse = asRecord(event.response);
      }
    });
    activeSink = sink;
    try {
      await handleCodexProxyRequest(req, sink, options);
    } finally {
      activeSink = undefined;
    }
    if (completedResponse !== undefined) {
      const responseId = completedResponse.id;
      lastRequest = cloneJsonObject(body);
      lastResponseId = typeof responseId === "string" ? responseId : undefined;
      lastResponseOutput = Array.isArray(completedResponse.output) ? cloneJsonArray(completedResponse.output) : [];
    }
  }
  function isNativeRelayTurn(body, opts) {
    if (opts.nativeBaseUrl === undefined) {
      return false;
    }
    const model = body.model;
    return typeof model === "string" && model !== "" && findModelById(model) === undefined;
  }
  function ensureNativeRelay() {
    if (nativeRelay === undefined) {
      nativeRelay = relayNativeCodexWebsocket(ws, options, upgradeHeaders);
    }
    return nativeRelay;
  }
}
function expandIncrementalRequest(body, lastRequest, lastResponseId, lastResponseOutput) {
  const previousResponseId = body.previous_response_id;
  if (typeof previousResponseId !== "string" || previousResponseId === "") {
    return cloneJsonObject(body);
  }
  if (lastRequest === undefined || previousResponseId !== lastResponseId) {
    return;
  }
  const previousInput = Array.isArray(lastRequest.input) ? lastRequest.input : [];
  const incrementalInput = Array.isArray(body.input) ? body.input : [];
  return {
    ...cloneJsonObject(body),
    input: cloneJsonArray([...previousInput, ...lastResponseOutput, ...incrementalInput])
  };
}
function sendPrewarmCompleted(ws, body, defaultModel) {
  const responseId = `resp_${randomUUID12().replaceAll("-", "")}`;
  const createdAt = Math.floor(Date.now() / 1000);
  const model = typeof body.model === "string" ? body.model : defaultModel;
  const created = {
    id: responseId,
    object: "response",
    created_at: createdAt,
    status: "in_progress",
    model,
    output: []
  };
  ws.send(JSON.stringify({ type: "response.created", response: created }));
  ws.send(JSON.stringify({
    type: "response.completed",
    response: {
      ...created,
      status: "completed",
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        output_tokens_details: { reasoning_tokens: 0 }
      }
    }
  }));
  return responseId;
}
function sendPreviousResponseNotFound(ws) {
  ws.send(JSON.stringify({
    type: "error",
    status: 409,
    error: {
      type: "invalid_request_error",
      code: "previous_response_not_found",
      param: "previous_response_id",
      message: "Previous response is not available on this websocket; resend the full conversation input."
    }
  }));
}
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function cloneJsonObject(value) {
  return JSON.parse(JSON.stringify(value));
}
function cloneJsonArray(value) {
  return JSON.parse(JSON.stringify(value));
}
function parseMessage(raw) {
  const bytes = Buffer.isBuffer(raw) ? raw : Array.isArray(raw) ? Buffer.concat(raw) : Buffer.from(raw);
  const asText = bytes.toString("utf8");
  try {
    const parsed = JSON.parse(asText);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return;
  }
}
function fakeCodexRequest(body) {
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  const req = Readable.from([bytes]);
  req.method = "POST";
  req.url = "/v1/responses";
  req.headers = { "content-type": "application/json" };
  return req;
}
function sendFatalError(ws, err) {
  if (ws.readyState !== ws.OPEN) {
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  ws.send(JSON.stringify({ type: "error", error: { type: "server_error", message } }));
}
var RESPONSES_WEBSOCKET_REPLAY_REQUIRED_CODE = 1012, RESPONSES_WEBSOCKET_REPLAY_REQUIRED_REASON = "upstream requires HTTP replay", WebSocketSseSink;
var init_responses_websocket = __esm(() => {
  init_dist3();
  init_proxy2();
  init_native_websocket_relay();
  init_native_replay();
  WebSocketSseSink = class WebSocketSseSink extends EventEmitter {
    statusCode = 200;
    writableEnded = false;
    socket = undefined;
    buffer = "";
    ws;
    onEvent;
    constructor(ws, onEvent) {
      super();
      this.ws = ws;
      this.onEvent = onEvent;
    }
    writeHead(status) {
      this.statusCode = status;
      return this;
    }
    flushHeaders() {
    }
    write(chunk) {
      this.buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      this.buffer = consumeSseLines(this.buffer, (data) => {
        try {
          const event = asRecord(JSON.parse(data));
          if (event !== undefined) {
            this.onEvent?.(event);
          }
        } catch {
        }
        if (this.ws.readyState === this.ws.OPEN) {
          this.ws.send(data);
        }
      });
      return true;
    }
    end(chunk) {
      if (chunk !== undefined) {
        this.write(chunk);
      }
      this.writableEnded = true;
    }
  };
});

// packages/cli/src/lib/daemon/app-registration.ts
import { mkdir as mkdir3, readFile as readFile2, rename as rename2, rm, writeFile as writeFile2 } from "fs/promises";
import path7 from "path";
function appRegistrationPath(home = togetherlinkHome2()) {
  return path7.join(home, "codex-app", REGISTRATION_FILE);
}
async function writeAppRegistration(registration, home = togetherlinkHome2()) {
  const file = appRegistrationPath(home);
  await mkdir3(path7.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile2(tmp, `${JSON.stringify(registration, null, 2)}
`, {
    encoding: "utf8",
    mode: 384
  });
  await rename2(tmp, file);
}
async function clearAppRegistration(home = togetherlinkHome2()) {
  await rm(appRegistrationPath(home), { force: true });
}
async function readAppRegistration(home = togetherlinkHome2()) {
  let raw;
  try {
    raw = await readFile2(appRegistrationPath(home), "utf8");
  } catch {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const valid = typeof parsed.token === "string" && parsed.token !== "" && typeof parsed.apiKey === "string" && parsed.apiKey !== "" && typeof parsed.modelLabel === "string" && parsed.modelLabel !== "" && typeof parsed.modelDefinition === "object" && parsed.modelDefinition !== null && typeof parsed.modelId === "string" && parsed.modelId !== "" && typeof parsed.targetModelId === "string" && parsed.targetModelId !== "";
    if (valid) {
      return parsed;
    }
  } catch {
  }
  return;
}
var REGISTRATION_FILE = "registration.json";
var init_app_registration = __esm(() => {
  init_paths();
});

// packages/cli/src/lib/cost.ts
function pricingFor(model) {
  return {
    inputPerToken: costPerToken(model.cost.input),
    cachedInputPerToken: costPerToken(model.cost.cache_read),
    outputPerToken: costPerToken(model.cost.output)
  };
}

class CostTracker {
  defaultMainModel;
  promptTokens = 0;
  cachedTokens = 0;
  completionTokens = 0;
  costUsd = 0;
  byModel = new Map;
  visionCalls = 0;
  visionPromptTokens = 0;
  visionCompletionTokens = 0;
  visionCostUsd = 0;
  externalSummary;
  requestStartCost = 0;
  requestStartPrompt = 0;
  requestStartCached = 0;
  requestStartCompletion = 0;
  lastRequestRawBytes;
  bytesPerToken;
  pendingCalibration = false;
  estimator = {
    estimate: (bytes) => {
      const ratio = this.bytesPerToken ?? APPROX_CHARS_PER_TOKEN;
      return Math.max(1, Math.ceil(bytes / ratio));
    }
  };
  constructor(mainModel = DEFAULT_MODEL) {
    this.defaultMainModel = mainModel;
  }
  beginRequest() {
    this.requestStartCost = this.costUsd;
    this.requestStartPrompt = this.promptTokens;
    this.requestStartCached = this.cachedTokens;
    this.requestStartCompletion = this.completionTokens;
    this.pendingCalibration = true;
  }
  noteRequestBytes(rawBytes) {
    this.lastRequestRawBytes = rawBytes > 0 ? rawBytes : undefined;
  }
  get tokenEstimator() {
    return this.estimator;
  }
  addUsage(promptTokens, cachedTokens, completionTokens, model = this.defaultMainModel) {
    if (this.pendingCalibration) {
      this.pendingCalibration = false;
      if (this.lastRequestRawBytes !== undefined && promptTokens >= MIN_CALIBRATION_PROMPT_TOKENS) {
        const ratio = this.lastRequestRawBytes / promptTokens;
        if (Number.isFinite(ratio) && ratio > 0) {
          this.bytesPerToken = Math.min(MAX_BYTES_PER_TOKEN, Math.max(MIN_BYTES_PER_TOKEN, ratio));
        }
      }
    }
    const pricing = pricingFor(model);
    const cached = Math.max(0, Math.min(cachedTokens, promptTokens));
    const nonCachedInput = Math.max(0, promptTokens - cached);
    const cost = nonCachedInput * pricing.inputPerToken + cached * pricing.cachedInputPerToken + completionTokens * pricing.outputPerToken;
    this.promptTokens += promptTokens;
    this.cachedTokens += cached;
    this.completionTokens += completionTokens;
    this.costUsd += cost;
    const bucket = this.byModel.get(model.id) ?? {
      promptTokens: 0,
      cachedTokens: 0,
      completionTokens: 0,
      costUsd: 0
    };
    bucket.promptTokens += promptTokens;
    bucket.cachedTokens += cached;
    bucket.completionTokens += completionTokens;
    bucket.costUsd += cost;
    this.byModel.set(model.id, bucket);
    return cost;
  }
  addVisionUsage(model, promptTokens, completionTokens) {
    const pricing = VISION_PRICING[model];
    if (!pricing) {
      return 0;
    }
    const cost = promptTokens * pricing.inputPerToken + completionTokens * pricing.outputPerToken;
    this.visionCalls += 1;
    this.visionPromptTokens += promptTokens;
    this.visionCompletionTokens += completionTokens;
    this.visionCostUsd += cost;
    this.costUsd += cost;
    const bucket = this.byModel.get(model) ?? {
      promptTokens: 0,
      cachedTokens: 0,
      completionTokens: 0,
      costUsd: 0
    };
    bucket.promptTokens += promptTokens;
    bucket.completionTokens += completionTokens;
    bucket.costUsd += cost;
    this.byModel.set(model, bucket);
    return cost;
  }
  setExternalSummary(summary) {
    this.externalSummary = summary;
  }
  hydrateUsage(totals, externalSummary, usageByModel) {
    this.promptTokens = totals.promptTokens ?? 0;
    this.cachedTokens = Math.max(0, Math.min(totals.cachedTokens ?? 0, this.promptTokens));
    this.completionTokens = totals.completionTokens ?? 0;
    this.costUsd = totals.costUsd ?? 0;
    this.externalSummary = externalSummary;
    this.byModel.clear();
    if (usageByModel && usageByModel.length > 0) {
      for (const usage of usageByModel) {
        this.byModel.set(usage.model, {
          promptTokens: usage.promptTokens,
          cachedTokens: usage.cachedTokens,
          completionTokens: usage.completionTokens,
          costUsd: usage.costUsd
        });
      }
    } else {
      this.byModel.set(this.defaultMainModel.id, { ...this.totals });
    }
    this.beginRequest();
  }
  get totals() {
    return {
      promptTokens: this.promptTokens,
      cachedTokens: this.cachedTokens,
      completionTokens: this.completionTokens,
      costUsd: this.costUsd
    };
  }
  get totalsByModel() {
    return Array.from(this.byModel.entries()).map(([model, usage]) => ({ model, ...usage }));
  }
  get requestDelta() {
    return {
      promptTokens: this.promptTokens - this.requestStartPrompt,
      cachedTokens: this.cachedTokens - this.requestStartCached,
      completionTokens: this.completionTokens - this.requestStartCompletion,
      costUsd: this.costUsd - this.requestStartCost
    };
  }
  summarize() {
    if (this.externalSummary) {
      return this.externalSummary;
    }
    const main = `[togetherlink cost] session total: $${this.costUsd.toFixed(4)} ` + `(${this.formatTokens(this.promptTokens)} in` + (this.cachedTokens > 0 ? ` incl ${this.formatTokens(this.cachedTokens)} cached` : "") + `, ${this.formatTokens(this.completionTokens)} out)`;
    if (this.visionCalls > 0) {
      return `${main}
[togetherlink cost] vision: ${this.visionCalls} image(s), ` + `$${this.visionCostUsd.toFixed(4)} ` + `(${this.formatTokens(this.visionPromptTokens)} in, ${this.formatTokens(this.visionCompletionTokens)} out)`;
    }
    return main;
  }
  formatTokens(n) {
    return n.toLocaleString("en-US");
  }
}
var VISION_PRICING, MIN_CALIBRATION_PROMPT_TOKENS = 64, MIN_BYTES_PER_TOKEN = 1, MAX_BYTES_PER_TOKEN = 16;
var init_cost = __esm(() => {
  init_dist3();
  init_context_budget();
  VISION_PRICING = Object.fromEntries(VISION_MODELS.map((model) => [
    model.id,
    {
      inputPerToken: costPerToken(model.cost.input),
      cachedPerToken: costPerToken(model.cost.cache_read),
      outputPerToken: costPerToken(model.cost.output)
    }
  ]));
});

// packages/cli/src/lib/daemon/storage.ts
import { chmod as chmod2, mkdir as mkdir4 } from "fs/promises";
import path8 from "path";
async function createSessionStore(home = togetherlinkHome2()) {
  await mkdir4(home, { recursive: true });
  const sqlite = await openSqlite(path8.join(home, DATABASE_FILE));
  if (sqlite) {
    await chmod2(path8.join(home, DATABASE_FILE), 384).catch(() => {
    });
    try {
      return new ResilientSessionStore(new SqliteSessionStore(sqlite));
    } catch (err) {
      sqlite.close?.();
      warnStoreError("initialize sqlite session store", err);
    }
  }
  return new ResilientSessionStore(new MemorySessionStore);
}
async function openSqlite(file) {
  const dynamicImport = new Function("specifier", "return import(specifier)");
  const preferBun = typeof globalThis.Bun !== "undefined";
  const attempts = preferBun ? ["bun:sqlite", "node:sqlite"] : ["node:sqlite", "bun:sqlite"];
  for (const specifier of attempts) {
    try {
      const mod = await dynamicImport(specifier);
      if (specifier === "bun:sqlite" && typeof mod.Database === "function") {
        return new BunSqliteDatabase(new mod.Database(file));
      }
      if (specifier === "node:sqlite" && typeof mod.DatabaseSync === "function") {
        return new NodeSqliteDatabase(new mod.DatabaseSync(file));
      }
    } catch {
    }
  }
  return;
}

class BunSqliteDatabase {
  db;
  constructor(db) {
    this.db = db;
  }
  exec(sql) {
    this.db.exec(sql);
  }
  prepare(sql) {
    const statement = this.db.query(sql);
    return {
      run: (...params) => statement.run(...params),
      get: (...params) => statement.get(...params),
      all: (...params) => statement.all(...params)
    };
  }
  close() {
    this.db.close?.();
  }
}

class NodeSqliteDatabase {
  db;
  constructor(db) {
    this.db = db;
  }
  exec(sql) {
    this.db.exec(sql);
  }
  prepare(sql) {
    const statement = this.db.prepare(sql);
    return {
      run: (...params) => statement.run(...params),
      get: (...params) => statement.get(...params),
      all: (...params) => statement.all(...params)
    };
  }
  close() {
    this.db.close?.();
  }
}

class ResilientSessionStore {
  inner;
  kind;
  constructor(inner) {
    this.inner = inner;
    this.kind = inner.kind;
  }
  restoreActiveSessions() {
    try {
      return this.inner.restoreActiveSessions();
    } catch (err) {
      warnStoreError("restore sessions", err);
      return [];
    }
  }
  queryUsageSince(since) {
    try {
      return this.inner.queryUsageSince(since);
    } catch (err) {
      warnStoreError("query usage", err);
      return [];
    }
  }
  upsertSession(session) {
    this.write("persist session", () => this.inner.upsertSession(session));
  }
  markSessionEnded(token, endedAt, costSummary, costTotals, usageByModel) {
    this.write("mark session ended", () => this.inner.markSessionEnded(token, endedAt, costSummary, costTotals, usageByModel));
  }
  updateSessionPid(token, pid) {
    this.write("update session pid", () => this.inner.updateSessionPid(token, pid));
  }
  updateSessionUsage(token, costSummary, costTotals, usageByModel, externalSummary) {
    this.write("update session usage", () => this.inner.updateSessionUsage(token, costSummary, costTotals, usageByModel, externalSummary));
  }
  updateSessionLastSeen(token, lastSeenAt) {
    this.write("update session last seen", () => this.inner.updateSessionLastSeen(token, lastSeenAt));
  }
  close() {
    try {
      this.inner.close();
    } catch (err) {
      warnStoreError("close session store", err);
    }
  }
  write(action, fn) {
    try {
      fn();
    } catch (err) {
      warnStoreError(action, err);
    }
  }
}
function warnStoreError(action, err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[togetherlink daemon] Could not ${action}: ${message}
`);
}

class SqliteSessionStore {
  db;
  kind = "sqlite";
  constructor(db) {
    this.db = db;
    this.migrate();
  }
  restoreActiveSessions() {
    const rows = this.db.prepare("SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at ASC").all();
    return rows.map((row) => this.toStoredSession(row));
  }
  queryUsageSince(since) {
    const rows = this.db.prepare(`SELECT * FROM sessions
         WHERE ended_at >= ? AND agent IN ('claude', 'codex', 'codex-app')
         ORDER BY ended_at DESC`).all(since);
    return rows.map((row) => ({
      agent: row.agent,
      costUsd: row.cost_usd,
      usageByModel: usageByModelForRow(row)
    }));
  }
  upsertSession(session) {
    this.db.prepare(`
        INSERT INTO sessions (
          token, agent, pid, started_at, last_seen_at, ended_at, model_label, api_key, base_url,
          auth_token, native_base_url,
          model_id, target_model_id, model_name, model_definition_json,
          claude_code_max_output_tokens, claude_code_max_output_tokens_user_set, debug,
          prompt_tokens, cached_tokens, completion_tokens, cost_usd, cost_summary,
          external_summary, usage_by_model_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(token) DO UPDATE SET
          agent = excluded.agent,
          pid = excluded.pid,
          started_at = excluded.started_at,
          last_seen_at = excluded.last_seen_at,
          ended_at = excluded.ended_at,
          model_label = excluded.model_label,
          api_key = excluded.api_key,
          base_url = excluded.base_url,
          auth_token = excluded.auth_token,
          native_base_url = excluded.native_base_url,
          model_id = excluded.model_id,
          target_model_id = excluded.target_model_id,
          model_name = excluded.model_name,
          model_definition_json = excluded.model_definition_json,
          claude_code_max_output_tokens = excluded.claude_code_max_output_tokens,
          claude_code_max_output_tokens_user_set = excluded.claude_code_max_output_tokens_user_set,
          debug = excluded.debug,
          prompt_tokens = excluded.prompt_tokens,
          cached_tokens = excluded.cached_tokens,
          completion_tokens = excluded.completion_tokens,
          cost_usd = excluded.cost_usd,
          cost_summary = excluded.cost_summary,
          external_summary = excluded.external_summary,
          usage_by_model_json = excluded.usage_by_model_json,
          updated_at = excluded.updated_at
      `).run(...sessionParams(session, Date.now()));
  }
  markSessionEnded(token, endedAt, costSummary, costTotals, usageByModel) {
    this.db.prepare(`
        UPDATE sessions
        SET ended_at = ?, prompt_tokens = ?, cached_tokens = ?, completion_tokens = ?,
            cost_usd = ?, cost_summary = ?, usage_by_model_json = ?, updated_at = ?
        WHERE token = ?
      `).run(endedAt, costTotals.promptTokens, costTotals.cachedTokens, costTotals.completionTokens, costTotals.costUsd, costSummary, JSON.stringify(usageByModel), Date.now(), token);
  }
  updateSessionPid(token, pid) {
    this.db.prepare("UPDATE sessions SET pid = ?, updated_at = ? WHERE token = ?").run(pid, Date.now(), token);
  }
  updateSessionUsage(token, costSummary, costTotals, usageByModel, externalSummary) {
    this.db.prepare(`
        UPDATE sessions
        SET prompt_tokens = ?, cached_tokens = ?, completion_tokens = ?, cost_usd = ?,
            cost_summary = ?, usage_by_model_json = ?,
            external_summary = COALESCE(?, external_summary), updated_at = ?
        WHERE token = ?
      `).run(costTotals.promptTokens, costTotals.cachedTokens, costTotals.completionTokens, costTotals.costUsd, costSummary, JSON.stringify(usageByModel), externalSummary ?? null, Date.now(), token);
  }
  updateSessionLastSeen(token, lastSeenAt) {
    this.db.prepare("UPDATE sessions SET last_seen_at = ?, updated_at = ? WHERE token = ?").run(lastSeenAt, Date.now(), token);
  }
  close() {
    this.db.close?.();
  }
  migrate() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        pid INTEGER,
        started_at INTEGER NOT NULL,
        last_seen_at INTEGER,
        ended_at INTEGER,
        model_label TEXT NOT NULL,
        api_key TEXT NOT NULL,
        base_url TEXT,
        auth_token TEXT,
        native_base_url TEXT,
        model_id TEXT,
        target_model_id TEXT,
        model_name TEXT,
        model_definition_json TEXT NOT NULL,
        claude_code_max_output_tokens INTEGER,
        claude_code_max_output_tokens_user_set INTEGER,
        debug INTEGER,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        cached_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        cost_summary TEXT NOT NULL DEFAULT '',
        external_summary TEXT,
        usage_by_model_json TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON sessions(ended_at DESC);
    `);
    this.addColumnIfMissing("sessions", "last_seen_at", "INTEGER");
    this.addColumnIfMissing("sessions", "base_url", "TEXT");
    this.addColumnIfMissing("sessions", "native_base_url", "TEXT");
    this.addColumnIfMissing("sessions", "claude_code_max_output_tokens", "INTEGER");
    this.addColumnIfMissing("sessions", "claude_code_max_output_tokens_user_set", "INTEGER");
    this.addColumnIfMissing("sessions", "usage_by_model_json", "TEXT");
  }
  addColumnIfMissing(table, column, type) {
    try {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch {
    }
  }
  toStoredSession(row) {
    const session = rowToSessionBase(row);
    return {
      ...session,
      promptTokens: row.prompt_tokens,
      cachedTokens: row.cached_tokens,
      completionTokens: row.completion_tokens,
      costUsd: row.cost_usd,
      usageByModel: usageByModelForRow(row),
      ...row.external_summary ? { externalSummary: row.external_summary } : {}
    };
  }
}

class MemorySessionStore {
  kind = "memory";
  restoreActiveSessions() {
    return [];
  }
  queryUsageSince() {
    return [];
  }
  upsertSession() {
  }
  markSessionEnded() {
  }
  updateSessionPid() {
  }
  updateSessionUsage() {
  }
  updateSessionLastSeen() {
  }
  close() {
  }
}
function sessionParams(session, updatedAt) {
  return [
    session.token,
    session.agent ?? "claude",
    session.pid ?? null,
    session.startedAt,
    session.lastSeenAt,
    session.endedAt ?? null,
    session.modelLabel,
    session.apiKey,
    session.baseUrl ?? null,
    session.authToken ?? null,
    session.nativeBaseUrl ?? null,
    session.modelId ?? null,
    session.targetModelId ?? null,
    session.modelName ?? null,
    JSON.stringify(session.modelDefinition),
    session.claudeCodeMaxOutputTokens ?? null,
    session.claudeCodeMaxOutputTokensUserSet === undefined ? null : session.claudeCodeMaxOutputTokensUserSet ? 1 : 0,
    session.debug === undefined ? null : session.debug ? 1 : 0,
    session.costTotals.promptTokens,
    session.costTotals.cachedTokens,
    session.costTotals.completionTokens,
    session.costTotals.costUsd,
    session.costSummary,
    session.externalSummary ?? null,
    session.usageByModel ? JSON.stringify(session.usageByModel) : null,
    updatedAt
  ];
}
function usageByModelForRow(row) {
  const parsed = parseJson(row.usage_by_model_json ?? "", []);
  if (Array.isArray(parsed)) {
    const valid = parsed.filter(isModelTokenUsage);
    if (valid.length > 0) {
      return valid;
    }
  }
  const definition = parseJson(row.model_definition_json, {});
  const model = row.target_model_id ?? (typeof definition.id === "string" && definition.id ? definition.id : row.model_label);
  return [
    {
      model,
      promptTokens: row.prompt_tokens,
      cachedTokens: row.cached_tokens,
      completionTokens: row.completion_tokens,
      costUsd: row.cost_usd
    }
  ];
}
function isModelTokenUsage(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const usage = value;
  return typeof usage.model === "string" && typeof usage.promptTokens === "number" && typeof usage.cachedTokens === "number" && typeof usage.completionTokens === "number" && typeof usage.costUsd === "number";
}
function rowToSessionBase(row) {
  return {
    token: row.token,
    agent: row.agent,
    ...typeof row.pid === "number" ? { pid: row.pid } : {},
    apiKey: row.api_key,
    ...row.base_url ? { baseUrl: row.base_url } : {},
    ...row.auth_token ? { authToken: row.auth_token } : {},
    ...row.native_base_url ? { nativeBaseUrl: row.native_base_url } : {},
    modelLabel: row.model_label,
    modelDefinition: parseJson(row.model_definition_json, {}),
    ...row.model_id ? { modelId: row.model_id } : {},
    ...row.target_model_id ? { targetModelId: row.target_model_id } : {},
    ...row.model_name ? { modelName: row.model_name } : {},
    ...typeof row.claude_code_max_output_tokens === "number" ? { claudeCodeMaxOutputTokens: row.claude_code_max_output_tokens } : {},
    ...row.claude_code_max_output_tokens_user_set !== null ? { claudeCodeMaxOutputTokensUserSet: row.claude_code_max_output_tokens_user_set === 1 } : {},
    ...row.debug !== null ? { debug: row.debug === 1 } : {},
    startedAt: row.started_at,
    ...typeof row.last_seen_at === "number" ? { lastSeenAt: row.last_seen_at } : {},
    ...typeof row.ended_at === "number" ? { endedAt: row.ended_at } : {}
  };
}
function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
var DATABASE_FILE = "daemon.sqlite";
var init_storage = __esm(() => {
  init_paths();
});

// packages/cli/src/lib/daemon/state.ts
class SessionRegistry {
  map = new Map;
  store;
  register(state) {
    this.map.set(state.token, state);
    this.persistSession(state);
    this.enforceNoPidSessionLimit(Date.now());
  }
  get(token) {
    const state = this.map.get(token);
    if (state) {
      this.markSeen(state);
    }
    return state;
  }
  delete(token) {
    const state = this.map.get(token);
    if (!state) {
      return false;
    }
    this.map.delete(token);
    state.endedAt = Date.now();
    this.store?.markSessionEnded(state.token, state.endedAt, state.costTracker.summarize(), state.costTracker.totals, state.costTracker.totalsByModel);
    emitDaemonSessionEndedTelemetry(state);
    return true;
  }
  get size() {
    return this.map.size;
  }
  list() {
    return [...this.map.values()];
  }
  updatePid(token, pid) {
    const state = this.map.get(token);
    if (!state) {
      return false;
    }
    state.pid = pid;
    this.store?.updateSessionPid(token, pid);
    return true;
  }
  async restorePersisted() {
    this.store = await createSessionStore();
    const persisted = this.store.restoreActiveSessions();
    let restored = 0;
    const now = Date.now();
    for (const session of persisted) {
      if (session.pid !== undefined && !isProcessAlive(session.pid)) {
        this.store.markSessionEnded(session.token, now, "[togetherlink cost] session total: $0.0000 (0 in, 0 out)", { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 }, []);
        continue;
      }
      const lastSeenAt = session.lastSeenAt ?? session.startedAt;
      if (session.pid === undefined && isNoPidSessionIdle(lastSeenAt, now)) {
        this.store.markSessionEnded(session.token, now, session.externalSummary ?? "[togetherlink cost] session total: $0.0000 (0 in, 0 out)", {
          promptTokens: session.promptTokens ?? 0,
          cachedTokens: session.cachedTokens ?? 0,
          completionTokens: session.completionTokens ?? 0,
          costUsd: session.costUsd ?? 0
        }, session.usageByModel ?? []);
        continue;
      }
      const state = buildSession(session);
      state.startedAt = session.startedAt;
      state.lastSeenAt = lastSeenAt;
      state.lastSeenPersistedAt = lastSeenAt;
      if (session.externalSummary !== undefined) {
        state.externalSummary = session.externalSummary;
      }
      state.costTracker.hydrateUsage({
        promptTokens: session.promptTokens ?? 0,
        cachedTokens: session.cachedTokens ?? 0,
        completionTokens: session.completionTokens ?? 0,
        costUsd: session.costUsd ?? 0
      }, session.externalSummary, session.usageByModel);
      this.map.set(state.token, state);
      restored += 1;
    }
    restored -= this.enforceNoPidSessionLimit(now);
    return restored;
  }
  reapDead() {
    let removed = 0;
    const now = Date.now();
    for (const state of this.map.values()) {
      if (state.pid === undefined) {
        if (isNoPidSessionIdle(state.lastSeenAt, now)) {
          this.delete(state.token);
          removed += 1;
        }
        continue;
      }
      if (!isProcessAlive(state.pid)) {
        this.delete(state.token);
        removed += 1;
      }
    }
    removed += this.enforceNoPidSessionLimit(now);
    return removed;
  }
  updateUsage(token, externalSummary) {
    const state = this.map.get(token);
    if (!state) {
      return;
    }
    if (externalSummary) {
      state.externalSummary = externalSummary;
    }
    this.store?.updateSessionUsage(token, state.costTracker.summarize(), state.costTracker.totals, state.costTracker.totalsByModel, state.externalSummary);
  }
  closeStore() {
    this.store?.close();
    this.store = undefined;
  }
  persistSession(state) {
    this.store?.upsertSession(toPersistedSession(state));
  }
  markSeen(state) {
    const now = Date.now();
    state.lastSeenAt = now;
    if (now - (state.lastSeenPersistedAt ?? 0) < LAST_SEEN_PERSIST_INTERVAL_MS) {
      return;
    }
    state.lastSeenPersistedAt = now;
    this.store?.updateSessionLastSeen(state.token, now);
  }
  enforceNoPidSessionLimit(now) {
    const noPidSessions = [...this.map.values()].filter((state) => state.pid === undefined).sort((a3, b3) => a3.lastSeenAt - b3.lastSeenAt);
    const overflow = noPidSessions.length - MAX_NO_PID_SESSIONS;
    if (overflow <= 0) {
      return 0;
    }
    let removed = 0;
    for (const state of noPidSessions.slice(0, overflow)) {
      if (state.lastSeenAt > now) {
        continue;
      }
      if (this.delete(state.token)) {
        removed += 1;
      }
    }
    return removed;
  }
}
function isProxiedAgent(agent) {
  return PROXIED_AGENTS.has(agent);
}
function buildSession(req) {
  const agent = req.agent ?? "claude";
  const costTracker = new CostTracker(req.modelDefinition);
  const now = Date.now();
  const baseUrl = req.baseUrl ?? TOGETHER_BASE_URL2;
  const state = {
    token: req.token,
    agent,
    startedAt: now,
    lastSeenAt: now,
    lastSeenPersistedAt: now,
    modelLabel: req.modelLabel,
    apiKey: req.apiKey,
    baseUrl,
    modelDefinition: req.modelDefinition,
    costTracker,
    ...typeof req.pid === "number" ? { pid: req.pid } : {},
    ...req.debug !== undefined ? { debug: req.debug } : {}
  };
  if (isProxiedAgent(agent)) {
    state.options = {
      apiKey: req.apiKey,
      baseUrl,
      modelId: req.modelId ?? req.modelLabel,
      targetModelId: req.targetModelId ?? req.modelDefinition.id,
      modelName: req.modelName ?? req.modelLabel,
      modelDefinition: req.modelDefinition,
      authToken: req.authToken ?? req.token,
      ...req.nativeBaseUrl !== undefined ? { nativeBaseUrl: req.nativeBaseUrl } : {},
      ...req.claudeCodeMaxOutputTokens !== undefined ? { claudeCodeMaxOutputTokens: req.claudeCodeMaxOutputTokens } : {},
      ...req.claudeCodeMaxOutputTokensUserSet !== undefined ? { claudeCodeMaxOutputTokensUserSet: req.claudeCodeMaxOutputTokensUserSet } : {},
      ...req.debug !== undefined ? { debug: req.debug } : {},
      costTracker,
      ...process.env.TOGETHERLINK_PERF === "1" ? { perfSink: (payload) => recordSessionProxyPerf(state, payload) } : {}
    };
  }
  return state;
}
function toPublicSessionView(state) {
  return {
    agent: state.agent,
    modelLabel: state.modelLabel,
    ...state.pid !== undefined ? { pid: state.pid } : {},
    startedAt: state.startedAt,
    ...state.endedAt !== undefined ? { endedAt: state.endedAt } : {},
    status: state.endedAt === undefined ? "running" : "ended",
    lastSeenAt: state.lastSeenAt,
    costSummary: state.costTracker.summarize(),
    ...state.proxyPerf !== undefined ? { proxyPerf: state.proxyPerf } : {}
  };
}
function recordSessionProxyPerf(state, payload) {
  state.proxyPerf ??= { requestCount: 0, totalMs: 0, maxMs: 0, spans: {} };
  state.proxyPerf.requestCount += 1;
  state.proxyPerf.totalMs = roundPerfMs(state.proxyPerf.totalMs + payload.totalMs);
  state.proxyPerf.maxMs = Math.max(state.proxyPerf.maxMs, payload.totalMs);
  for (const span of payload.spans) {
    addPerfMetric(state.proxyPerf.spans, span.name, span.durationMs);
  }
  for (const mark of payload.marks) {
    if (mark.name === "first_delta") {
      state.proxyPerf.firstDelta ??= { count: 0, totalMs: 0, maxMs: 0 };
      addPerfMetricValue(state.proxyPerf.firstDelta, mark.atMs);
    }
  }
}
function addPerfMetric(metrics, name, durationMs) {
  metrics[name] ??= { count: 0, totalMs: 0, maxMs: 0 };
  addPerfMetricValue(metrics[name], durationMs);
}
function addPerfMetricValue(metric, durationMs) {
  metric.count += 1;
  metric.totalMs = roundPerfMs(metric.totalMs + durationMs);
  metric.maxMs = Math.max(metric.maxMs, durationMs);
}
function roundPerfMs(value) {
  return Math.round(value * 1000) / 1000;
}
function toPersistedSession(state) {
  const base = {
    token: state.token,
    agent: state.agent,
    apiKey: state.apiKey,
    baseUrl: state.baseUrl,
    ...state.options?.authToken !== undefined && state.options.authToken !== state.token ? { authToken: state.options.authToken } : {},
    modelLabel: state.modelLabel,
    modelDefinition: state.modelDefinition,
    startedAt: state.startedAt,
    lastSeenAt: state.lastSeenAt,
    costSummary: state.costTracker.summarize(),
    costTotals: state.costTracker.totals,
    usageByModel: state.costTracker.totalsByModel,
    ...state.pid !== undefined ? { pid: state.pid } : {},
    ...state.endedAt !== undefined ? { endedAt: state.endedAt } : {},
    ...state.externalSummary !== undefined ? { externalSummary: state.externalSummary } : {},
    ...state.debug !== undefined ? { debug: state.debug } : {}
  };
  if (state.options !== undefined) {
    base.modelId = state.options.modelId;
    base.targetModelId = state.options.targetModelId;
    const codexOptions = state.options;
    if (state.agent === "codex-app" && codexOptions.nativeBaseUrl !== undefined) {
      base.nativeBaseUrl = codexOptions.nativeBaseUrl;
    }
    base.modelName = state.options.modelName;
    if (state.agent === "claude") {
      const claudeOptions = state.options;
      if (claudeOptions.claudeCodeMaxOutputTokens !== undefined) {
        base.claudeCodeMaxOutputTokens = claudeOptions.claudeCodeMaxOutputTokens;
      }
      if (claudeOptions.claudeCodeMaxOutputTokensUserSet !== undefined) {
        base.claudeCodeMaxOutputTokensUserSet = claudeOptions.claudeCodeMaxOutputTokensUserSet;
      }
    }
  }
  return base;
}
function isNoPidSessionIdle(lastSeenAt, now) {
  return now - lastSeenAt > NO_PID_SESSION_IDLE_TTL_MS;
}
function envInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
function emitDaemonSessionEndedTelemetry(state) {
  if (state.agent !== "codex-app" || state.endedAt === undefined) {
    return;
  }
  const usageByModel = state.costTracker.totalsByModel;
  const fallbackModel = state.options?.targetModelId ?? state.modelDefinition.id;
  sendTelemetryEvent({
    event: "session_ended",
    sessionId: state.token,
    agent: state.agent,
    initialModel: fallbackModel,
    finalModel: fallbackModel,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    durationMs: state.endedAt - state.startedAt,
    usage: state.costTracker.totals,
    ...usageByModel.length > 0 ? { usageByModel } : {},
    metadata: {
      integration: "codex-app",
      emittedBy: "daemon"
    }
  });
}
var DEFAULT_NO_PID_SESSION_IDLE_TTL_MS, DEFAULT_MAX_NO_PID_SESSIONS = 50, DEFAULT_LAST_SEEN_PERSIST_INTERVAL_MS, NO_PID_SESSION_IDLE_TTL_MS, MAX_NO_PID_SESSIONS, LAST_SEEN_PERSIST_INTERVAL_MS, sessions, PROXIED_AGENTS;
var init_state = __esm(() => {
  init_cost();
  init_together_core();
  init_telemetry();
  init_paths();
  init_storage();
  DEFAULT_NO_PID_SESSION_IDLE_TTL_MS = 24 * 60 * 60 * 1000;
  DEFAULT_LAST_SEEN_PERSIST_INTERVAL_MS = 5 * 60 * 1000;
  NO_PID_SESSION_IDLE_TTL_MS = envInt("TOGETHERLINK_DAEMON_NO_PID_SESSION_IDLE_TTL_MS", DEFAULT_NO_PID_SESSION_IDLE_TTL_MS);
  MAX_NO_PID_SESSIONS = envInt("TOGETHERLINK_DAEMON_MAX_NO_PID_SESSIONS", DEFAULT_MAX_NO_PID_SESSIONS);
  LAST_SEEN_PERSIST_INTERVAL_MS = envInt("TOGETHERLINK_DAEMON_LAST_SEEN_PERSIST_INTERVAL_MS", DEFAULT_LAST_SEEN_PERSIST_INTERVAL_MS);
  sessions = new SessionRegistry;
  PROXIED_AGENTS = new Set(["claude", "codex", "codex-app"]);
});

// packages/cli/src/lib/daemon/server.ts
var exports_server = {};
__export(exports_server, {
  runDaemon: () => runDaemon,
  resolveDaemonPort: () => resolveDaemonPort,
  renderDaemonError: () => renderDaemonError,
  probeHealthz: () => probeHealthz,
  probeDaemonHealth: () => probeDaemonHealth,
  healthyPortRaceExitCode: () => healthyPortRaceExitCode,
  daemonUrl: () => daemonUrl,
  daemonPidPath: () => daemonPidPath
});
import http from "http";
import { once } from "events";
import { statSync } from "fs";
import { writeFile as writeFile3, unlink, mkdir as mkdir5 } from "fs/promises";
import path9 from "path";
import { WebSocketServer } from "ws";
function daemonPidPath(home = togetherlinkHome2()) {
  return path9.join(home, "daemon.pid");
}
function resolveDaemonPort() {
  const raw = process.env.TOGETHERLINK_PORT;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAEMON_PORT;
}
function daemonUrl(port = resolveDaemonPort()) {
  return `http://${CLAUDE_LOCAL_PROXY_HOST}:${port}`;
}
async function listenOrExitOnRace(server, port) {
  await new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err.code === "EADDRINUSE") {
        server.removeListener("error", onError);
        probeHealthz(port).then((healthy) => {
          if (healthy) {
            process.exit(healthyPortRaceExitCode());
          }
          process.stderr.write(`[togetherlink daemon] port ${port} in use by a non-daemon process.
`);
          process.exit(1);
        });
        return;
      }
      server.removeListener("error", onError);
      reject(err);
    };
    server.once("error", onError);
    server.listen(port, CLAUDE_LOCAL_PROXY_HOST, () => {
      server.removeListener("error", onError);
      resolve();
    });
  });
}
function healthyPortRaceExitCode() {
  return process.env.TOGETHERLINK_SUPERVISED === "1" ? 1 : 0;
}
function renderDaemonError(res, err, agent) {
  if (res.headersSent) {
    if (!res.writableEnded) {
      res.end();
    }
    return;
  }
  if (agent === "codex" || agent === "codex-app") {
    if (err instanceof CodexTogetherError) {
      writeOpenAIError(res, err.status, err.type, err.message, err.code);
      return;
    }
    if (err instanceof CodexRequestError) {
      writeOpenAIError(res, err.status, err.status === 413 ? "request_too_large" : "invalid_request_error", err.message);
      return;
    }
    if (err instanceof TogetherResponseHeaderTimeoutError) {
      writeOpenAIError(res, 504, "timeout_error", err.message);
      return;
    }
    if (isTogetherApiError(err)) {
      writeOpenAIError(res, err.anthropicStatus, err.anthropicType, err.message);
      return;
    }
    writeOpenAIError(res, 500, "api_error", err instanceof Error ? err.message : String(err));
    return;
  }
  if (err instanceof TogetherResponseHeaderTimeoutError) {
    writeAnthropicError(res, 504, "timeout_error", err.message);
    return;
  }
  if (isTogetherApiError(err)) {
    writeAnthropicError(res, err.anthropicStatus, err.anthropicType, err.message);
    return;
  }
  writeAnthropicError(res, 500, "api_error", err instanceof Error ? err.message : String(err));
}
async function runDaemon(options = {}) {
  const port = resolveDaemonPort();
  const debug2 = options.debug ?? process.env.TOGETHERLINK_DEBUG === "1";
  activeSessions = options.sessions ?? sessions;
  const restored = await activeSessions.restorePersisted();
  const server = http.createServer((req, res) => {
    let requestAgent;
    handleDaemonRequest(req, res, {
      debug: debug2,
      setAgent: (a3) => {
        requestAgent = a3;
      }
    }).catch((err) => {
      if (debug2) {
        process.stderr.write(`[togetherlink daemon] request error (${requestAgent ?? "unknown"}): ${err instanceof Error ? err.stack ?? err.message : String(err)}
`);
      }
      try {
        renderDaemonError(res, err, requestAgent);
      } catch {
        if (!res.writableEnded) {
          res.destroy();
        }
      }
    });
  });
  server.on("upgrade", (req, socket, head) => {
    handleDaemonUpgrade(req, socket, head).catch(() => {
      socket.destroy();
    });
  });
  server.requestTimeout = 0;
  server.headersTimeout = 65000;
  await listenOrExitOnRace(server, port);
  await mkdir5(path9.dirname(daemonPidPath()), { recursive: true });
  await writeFile3(daemonPidPath(), `${process.pid}
`, { encoding: "utf8" });
  if (process.env.TOGETHERLINK_SUPERVISED === "1") {
    process.stderr.write(`[togetherlink daemon] supervised daemon started on ${daemonUrl(port)} (pid ${process.pid}).
`);
  }
  if (debug2) {
    process.stderr.write(`[togetherlink daemon] listening: ${daemonUrl(port)} (pid ${process.pid})
`);
    if (restored > 0) {
      process.stderr.write(`[togetherlink daemon] restored ${restored} active session(s).
`);
    }
  }
  let closing = false;
  const reaper = setInterval(() => {
    const removed = activeSessions.reapDead();
    if (debug2 && removed > 0) {
      process.stderr.write(`[togetherlink daemon] reaped ${removed} dead session(s).
`);
    }
  }, SESSION_REAP_INTERVAL_MS);
  reaper.unref();
  const shutdown = async (signal) => {
    if (closing) {
      return;
    }
    closing = true;
    if (process.env.TOGETHERLINK_SUPERVISED === "1") {
      process.stderr.write(`[togetherlink daemon] received ${signal}; shutting down cleanly for supervisor restart.
`);
    }
    clearInterval(reaper);
    if (debug2) {
      process.stderr.write(`[togetherlink daemon] ${signal} \u2014 shutting down.
`);
    }
    server.keepAliveTimeout = 1;
    await new Promise((resolve) => {
      let settled = false;
      const finish2 = () => {
        if (settled)
          return;
        settled = true;
        clearTimeout(forceClose);
        resolve();
      };
      const forceClose = setTimeout(() => {
        if (debug2) {
          process.stderr.write(`[togetherlink daemon] shutdown grace period expired; closing active connections.
`);
        }
        server.closeAllConnections();
        finish2();
      }, daemonShutdownGraceMs());
      forceClose.unref();
      server.close(finish2);
      server.closeIdleConnections();
    });
    activeSessions.closeStore();
    try {
      await unlink(daemonPidPath());
    } catch {
    }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  await once(server, "close");
}
function daemonShutdownGraceMs() {
  const configured = Number.parseInt(process.env.TOGETHERLINK_SHUTDOWN_GRACE_MS ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 1e4;
}
async function handleDaemonRequest(req, res, opts) {
  const path_ = requestPath(req);
  if (opts.debug) {
    const loggedPath = path_.replace(/^\/session\/[^/]+(?=\/|$)/, "/session/[REDACTED]");
    process.stderr.write(`[togetherlink daemon] ${req.method} ${loggedPath}
`);
  }
  if (req.method === "HEAD" && path_ === "/") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method === "GET" && path_ === "/healthz") {
    writeJson(res, 200, {
      ok: true,
      pid: process.pid,
      version: VERSION,
      home: togetherlinkHome2(),
      scriptPath: RUNNING_DAEMON_IDENTITY.scriptPath,
      scriptSize: RUNNING_DAEMON_IDENTITY.scriptSize,
      scriptMtimeMs: RUNNING_DAEMON_IDENTITY.scriptMtimeMs,
      activeSessionCount: activeSessions.size
    });
    return;
  }
  if (req.method === "GET" && path_ === "/") {
    writeJson(res, 200, {
      ok: true,
      service: "togetherlink daemon",
      version: VERSION,
      activeSessionCount: activeSessions.size
    });
    return;
  }
  if (path_ === "/internal/sessions") {
    if (req.method === "POST") {
      await registerSession(req, res);
      return;
    }
    if (req.method === "GET") {
      writeJson(res, 200, {
        count: activeSessions.size,
        sessions: activeSessions.list().map(toPublicSessionView)
      });
      return;
    }
    writeAnthropicError(res, 405, "method_not_allowed", `Unsupported method ${req.method ?? ""}`);
    return;
  }
  const costMatch = path_.match(COST_ROUTE);
  if (costMatch && req.method === "GET") {
    const state = activeSessions.get(decodeURIComponent(costMatch[1]));
    if (!state) {
      writeAnthropicError(res, 404, "not_found_error", "Unknown session token.");
      return;
    }
    writeJson(res, 200, {
      summary: state.costTracker.summarize(),
      totals: state.costTracker.totals,
      totalsByModel: state.costTracker.totalsByModel,
      ...state.proxyPerf !== undefined ? { proxyPerf: state.proxyPerf } : {}
    });
    return;
  }
  const usageMatch = path_.match(USAGE_ROUTE);
  if (usageMatch && req.method === "POST") {
    const state = activeSessions.get(decodeURIComponent(usageMatch[1]));
    if (!state) {
      writeAnthropicError(res, 404, "not_found_error", "Unknown session token.");
      return;
    }
    const body = await readJsonBody(req);
    const promptTokens = typeof body?.promptTokens === "number" ? body.promptTokens : 0;
    const completionTokens = typeof body?.completionTokens === "number" ? body.completionTokens : 0;
    const cachedTokens = typeof body?.cachedTokens === "number" ? body.cachedTokens : 0;
    if (promptTokens > 0 || completionTokens > 0) {
      state.costTracker.addUsage(promptTokens, cachedTokens, completionTokens, state.modelDefinition);
    }
    if (typeof body?.summary === "string" && body.summary) {
      state.costTracker.setExternalSummary(body.summary);
    }
    activeSessions.updateUsage(state.token, typeof body?.summary === "string" && body.summary ? body.summary : undefined);
    writeJson(res, 200, { ok: true });
    return;
  }
  const pidMatch = path_.match(PID_ROUTE);
  if (pidMatch && req.method === "POST") {
    const token2 = decodeURIComponent(pidMatch[1]);
    const state = activeSessions.get(token2);
    if (!state) {
      writeAnthropicError(res, 404, "not_found_error", "Unknown session token.");
      return;
    }
    const body = await readJsonBody(req);
    if (typeof body?.pid === "number") {
      activeSessions.updatePid(token2, body.pid);
    }
    writeJson(res, 200, { ok: true });
    return;
  }
  const deleteMatch = path_.match(SESSION_ROUTE);
  if (deleteMatch && req.method === "DELETE") {
    const removed = activeSessions.delete(decodeURIComponent(deleteMatch[1]));
    writeJson(res, removed ? 200 : 404, removed ? { ok: true } : { ok: false });
    return;
  }
  const sessionRoute = localSessionRoute(req, path_);
  const token = sessionRoute?.token ?? extractToken(req);
  let session = token !== undefined ? activeSessions.get(token) : undefined;
  if (session === undefined && token !== undefined) {
    session = await restoreAppSession(token);
  }
  if (!session) {
    writeAnthropicError(res, 401, "authentication_error", "Unauthorized local proxy request.");
    return;
  }
  opts.setAgent?.(session.agent);
  if (!isProxiedAgent(session.agent) || session.options === undefined) {
    writeAnthropicError(res, 404, "not_found_error", `This session's agent (${session.agent}) is not proxied by the daemon.`);
    return;
  }
  const preserveNativeCodexAuth = session.agent === "codex-app" && session.options.nativeBaseUrl !== undefined;
  if (sessionRoute !== undefined && !preserveNativeCodexAuth) {
    req.headers.authorization = `Bearer ${session.options.authToken}`;
    delete req.headers["x-api-key"];
  }
  if (session.agent === "codex" || session.agent === "codex-app") {
    try {
      await handleCodexProxyRequest(req, res, session.options);
    } finally {
      sessionRoute?.restore();
    }
    return;
  }
  try {
    await handleProxyRequest(req, res, session.options);
  } finally {
    sessionRoute?.restore();
  }
}
async function restoreAppSession(token) {
  const registration = await readAppRegistration();
  if (registration === undefined || registration.token !== token) {
    return;
  }
  const state = buildSession(registration);
  activeSessions.register(state);
  return state;
}
function localSessionRoute(req, path_) {
  const match = path_.match(/^\/session\/([^/]+)(\/.*)$/);
  if (!match) {
    return;
  }
  const originalUrl = req.url;
  const url = new URL(req.url ?? path_, "http://127.0.0.1");
  url.pathname = match[2];
  req.url = `${url.pathname}${url.search}`;
  return {
    token: decodeURIComponent(match[1]),
    restore: () => {
      req.url = originalUrl;
    }
  };
}
async function handleDaemonUpgrade(req, socket, head) {
  const path_ = requestPath(req);
  const sessionRoute = localSessionRoute(req, path_);
  const innerPath = sessionRoute ? requestPath(req) : undefined;
  if (!innerPath || !isCodexResponsesWebsocketPath(innerPath)) {
    socket.on("error", () => {
    });
    socket.end(REJECT_UPGRADE);
    return;
  }
  const token = sessionRoute.token;
  const session = activeSessions.get(token) ?? await restoreAppSession(token);
  if (!session || session.agent !== "codex" && session.agent !== "codex-app" || session.options === undefined) {
    socket.on("error", () => {
    });
    socket.end(REJECT_UPGRADE);
    return;
  }
  const options = session.options;
  responsesWebsocketServer.handleUpgrade(req, socket, head, (ws) => {
    handleCodexResponsesWebsocket(ws, options, req.headers);
  });
}
async function registerSession(req, res) {
  const body = await readJsonBody(req);
  const coreMissing = !body || typeof body.token !== "string" || !body.token || typeof body.apiKey !== "string" || !body.apiKey || typeof body.modelLabel !== "string" || !body.modelLabel || typeof body.modelDefinition !== "object" || body.modelDefinition === null;
  if (coreMissing) {
    writeAnthropicError(res, 400, "invalid_request_error", "Malformed register body: requires token, apiKey, modelLabel, modelDefinition.");
    return;
  }
  const agent = body.agent ?? "claude";
  if (isProxiedAgent(agent)) {
    const proxyMissing = typeof body.modelId !== "string" || !body.modelId || typeof body.targetModelId !== "string" || !body.targetModelId;
    if (proxyMissing) {
      writeAnthropicError(res, 400, "invalid_request_error", `Agent "${agent}" is proxied and requires modelId + targetModelId.`);
      return;
    }
  }
  const state = buildSession(body);
  activeSessions.register(state);
  writeJson(res, 200, {
    ok: true,
    session: {
      agent: state.agent,
      modelLabel: state.modelLabel,
      ...state.pid !== undefined ? { pid: state.pid } : {},
      startedAt: state.startedAt
    }
  });
}
async function probeHealthz(port) {
  return await probeDaemonHealth(port) !== undefined;
}
async function probeDaemonHealth(port) {
  try {
    const controller = new AbortController;
    const timer = setTimeout(() => controller.abort(), 300);
    const response = await fetch(`${daemonUrl(port)}/healthz`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) {
      return;
    }
    const body = await response.json().catch(() => {
      return;
    });
    if (body?.ok !== true) {
      return;
    }
    return {
      ok: true,
      pid: typeof body.pid === "number" ? body.pid : 0,
      version: typeof body.version === "string" ? body.version : "",
      home: typeof body.home === "string" ? body.home : null,
      scriptPath: typeof body.scriptPath === "string" ? body.scriptPath : null,
      scriptSize: typeof body.scriptSize === "number" ? body.scriptSize : null,
      scriptMtimeMs: typeof body.scriptMtimeMs === "number" ? body.scriptMtimeMs : null,
      activeSessionCount: typeof body.activeSessionCount === "number" ? body.activeSessionCount : -1
    };
  } catch {
    return;
  }
}
function daemonIdentityAtStartup() {
  const scriptPath = process.argv[1] ? path9.resolve(process.argv[1]) : null;
  if (!scriptPath) {
    return { scriptPath: null, scriptSize: null, scriptMtimeMs: null };
  }
  try {
    const stat = statSync(scriptPath);
    return { scriptPath, scriptSize: stat.size, scriptMtimeMs: stat.mtimeMs };
  } catch {
    return { scriptPath, scriptSize: null, scriptMtimeMs: null };
  }
}
var activeSessions, responsesWebsocketServer, DEFAULT_DAEMON_PORT = 7878, SESSION_REAP_INTERVAL_MS = 30000, COST_ROUTE, PID_ROUTE, USAGE_ROUTE, SESSION_ROUTE, RUNNING_DAEMON_IDENTITY, REJECT_UPGRADE = `HTTP/1.1 426 Upgrade Required\r
Connection: close\r
Content-Length: 0\r
\r
`;
var init_server = __esm(() => {
  init_version();
  init_defaults();
  init_http_util();
  init_proxy();
  init_together_call();
  init_proxy2();
  init_responses_websocket();
  init_native_router();
  init_routes();
  init_together_call2();
  init_together_client();
  init_app_registration();
  init_paths();
  init_state();
  activeSessions = sessions;
  responsesWebsocketServer = new WebSocketServer({ noServer: true });
  COST_ROUTE = /^\/internal\/sessions\/([^/]+)\/cost$/;
  PID_ROUTE = /^\/internal\/sessions\/([^/]+)\/pid$/;
  USAGE_ROUTE = /^\/internal\/sessions\/([^/]+)\/usage$/;
  SESSION_ROUTE = /^\/internal\/sessions\/([^/]+)$/;
  RUNNING_DAEMON_IDENTITY = daemonIdentityAtStartup();
});

// packages/cli/src/lib/daemon/detect-bundle.ts
import path10 from "path";
import { realpath } from "fs/promises";
async function runningFromBundle() {
  const home = togetherlinkHome2();
  const bundleExecutablePaths = new Set([
    path10.join(home, "bin", "togetherlink.js"),
    path10.join(home, "bin", "togetherlink")
  ]);
  const argv1 = process.argv[1];
  if (argv1) {
    try {
      const resolved = await realpath(argv1);
      if (bundleExecutablePaths.has(resolved))
        return true;
    } catch {
    }
  }
  return false;
}
var init_detect_bundle = __esm(() => {
  init_paths();
});

// packages/cli/src/lib/daemon/takeover.ts
import { readFile as readFile3 } from "fs/promises";
import path11 from "path";
async function stopLegacyDaemonForTakeover() {
  const port = resolveDaemonPort();
  const health = await probeDaemonHealth(port);
  if (health === undefined) {
    return { stopped: false };
  }
  const expectedHome = path11.resolve(togetherlinkHome2());
  if (health.home !== null && path11.resolve(health.home) !== expectedHome) {
    throw new Error(`Refusing to stop daemon from a different TogetherLink home (${health.home}).`);
  }
  const pid = health.pid > 0 ? health.pid : await readDaemonPid();
  if (pid === undefined || pid === process.pid) {
    throw new Error("Could not safely identify the legacy TogetherLink daemon process.");
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch (err) {
    if (err.code === "ESRCH") {
      return { stopped: false };
    }
    throw err;
  }
  const deadline = Date.now() + TAKEOVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await probeDaemonHealth(port) === undefined) {
      return { stopped: true, pid };
    }
    await sleep2(TAKEOVER_POLL_INTERVAL_MS);
  }
  throw new Error(`Legacy TogetherLink daemon ${pid} did not release port ${port}.`);
}
async function waitForManagedDaemonReady() {
  const port = resolveDaemonPort();
  const deadline = Date.now() + TAKEOVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await probeDaemonHealth(port) !== undefined) {
      return;
    }
    await sleep2(TAKEOVER_POLL_INTERVAL_MS);
  }
  throw new Error(`Managed TogetherLink daemon did not become healthy on port ${port}.`);
}
async function readDaemonPid() {
  try {
    const raw = (await readFile3(daemonPidPath(), "utf8")).trim();
    const pid = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(pid) && pid > 0 ? pid : undefined;
  } catch {
    return;
  }
}
function sleep2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var TAKEOVER_TIMEOUT_MS = 5000, TAKEOVER_POLL_INTERVAL_MS = 50;
var init_takeover = __esm(() => {
  init_paths();
  init_server();
});

// packages/cli/src/lib/daemon/launchd.ts
var exports_launchd = {};
__export(exports_launchd, {
  uninstallLaunchdDaemon: () => uninstallLaunchdDaemon,
  stopLaunchdDaemon: () => stopLaunchdDaemon,
  startLaunchdDaemon: () => startLaunchdDaemon,
  maybeAutoInstallLaunchdDaemon: () => maybeAutoInstallLaunchdDaemon,
  launchdStatus: () => launchdStatus,
  launchdPlistPath: () => launchdPlistPath,
  launchdPath: () => launchdPath,
  isMacOS: () => isMacOS,
  installLaunchdDaemon: () => installLaunchdDaemon,
  generateLaunchdPlist: () => generateLaunchdPlist
});
import os4 from "os";
import path12 from "path";
import { execFile } from "child_process";
import { mkdir as mkdir6, readFile as readFile4, unlink as unlink2, writeFile as writeFile4 } from "fs/promises";
function autoInstallSentinelPath() {
  return path12.join(togetherlinkHome2(), AUTO_INSTALL_SENTINEL);
}
function isMacOS() {
  return process.platform === "darwin";
}
function assertMacOS() {
  if (!isMacOS()) {
    throw new Error("LaunchAgents are only supported on macOS.");
  }
}
function launchAgentsDir() {
  return path12.join(os4.homedir(), "Library", "LaunchAgents");
}
function plistPath() {
  return path12.join(launchAgentsDir(), `${LAUNCHD_LABEL}.plist`);
}
function bundleExecutable() {
  return path12.join(togetherlinkHome2(), "bin", "togetherlink");
}
function bundleScript(home = togetherlinkHome2()) {
  return path12.join(home, "bin", "togetherlink.js");
}
function launchctlDomain() {
  return `gui/${process.getuid?.() ?? os4.userInfo().uid}`;
}
function isInsideLaunchdJob() {
  return process.env.LAUNCHD_SESSION_TYPE !== undefined || process.env.PPID === "1";
}
function launchdPath() {
  const home = os4.homedir();
  return [
    path12.join(home, ".bun", "bin"),
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin"
  ].join(":");
}
function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function buildPlist(plist) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    `  <key>Label</key>`,
    `  <string>${escapeXml(plist.Label)}</string>`,
    `  <key>ProgramArguments</key>`,
    "  <array>"
  ];
  for (const arg of plist.ProgramArguments) {
    lines.push(`    <string>${escapeXml(arg)}</string>`);
  }
  lines.push("  </array>", `  <key>RunAtLoad</key>`, plist.RunAtLoad ? "  <true/>" : "  <false/>", `  <key>KeepAlive</key>`, plist.KeepAlive ? "  <true/>" : "  <false/>", `  <key>ThrottleInterval</key>`, `  <integer>${plist.ThrottleInterval}</integer>`, `  <key>StandardOutPath</key>`, `  <string>${escapeXml(plist.StandardOutPath)}</string>`, `  <key>StandardErrorPath</key>`, `  <string>${escapeXml(plist.StandardErrorPath)}</string>`, `  <key>EnvironmentVariables</key>`, "  <dict>", `    <key>TOGETHERLINK_HOME</key>`, `    <string>${escapeXml(plist.EnvironmentVariables.TOGETHERLINK_HOME)}</string>`, `    <key>TOGETHERLINK_SUPERVISED</key>`, `    <string>${escapeXml(plist.EnvironmentVariables.TOGETHERLINK_SUPERVISED)}</string>`, `    <key>PATH</key>`, `    <string>${escapeXml(plist.EnvironmentVariables.PATH)}</string>`, "  </dict>", "</dict>", "</plist>", "");
  return lines.join(`
`);
}
function generateLaunchdPlist(overrides) {
  const home = overrides?.home ?? togetherlinkHome2();
  const runtime = overrides?.runtime ?? process.execPath;
  const bundle = overrides?.bundle ?? bundleScript(home);
  const logDir = path12.join(home, "logs");
  const plist = {
    Label: LAUNCHD_LABEL,
    ProgramArguments: [runtime, bundle, "daemon", "serve"],
    RunAtLoad: true,
    KeepAlive: true,
    ThrottleInterval: 10,
    StandardOutPath: path12.join(logDir, "daemon.log"),
    StandardErrorPath: path12.join(logDir, "daemon.log"),
    EnvironmentVariables: {
      TOGETHERLINK_HOME: home,
      TOGETHERLINK_SUPERVISED: "1",
      PATH: launchdPath()
    }
  };
  return buildPlist(plist);
}
function promisifiedExecFile(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { encoding: "utf8", ...options }, (err, stdout, stderr) => {
      if (err) {
        Object.assign(err, { stdout, stderr });
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
async function launchdUserSessionAvailable() {
  try {
    await promisifiedExecFile("launchctl", ["print-disabled", launchctlDomain()], {
      timeout: 3000,
      maxBuffer: 256 * 1024
    });
    return true;
  } catch {
    return false;
  }
}
async function rollbackLaunchdDaemon(plistDest, domain) {
  try {
    await promisifiedExecFile("launchctl", ["bootout", domain, plistDest]);
  } catch {
  }
  try {
    await unlink2(plistDest);
  } catch {
  }
}
async function maybeAutoInstallLaunchdDaemon() {
  if (!isMacOS())
    return false;
  if (isInsideLaunchdJob())
    return false;
  if (process.argv.includes("--daemon") || process.argv[2] === "daemon")
    return false;
  const sentinel = autoInstallSentinelPath();
  const already = await readFile4(sentinel, "utf8").then(() => true).catch(() => false);
  if (already)
    return false;
  if (!await runningFromBundle())
    return false;
  try {
    const result = await installLaunchdDaemon();
    return result.installed;
  } catch (err) {
    return false;
  }
}
async function installLaunchdDaemon() {
  assertMacOS();
  if (!await runningFromBundle()) {
    const argv1 = process.argv[1] ?? "unknown";
    return {
      installed: false,
      message: `Auto-start is only configured for the installed bundle (${bundleExecutable()}). ` + `This process was started from ${argv1}. Run install.sh first, then use the installed togetherlink command.`
    };
  }
  if (!await launchdUserSessionAvailable()) {
    return {
      installed: false,
      message: "A launchd user session is unavailable in this macOS environment. " + "TogetherLink will start its daemon automatically in portable process mode when needed."
    };
  }
  const plistDest = plistPath();
  const agentsDir = launchAgentsDir();
  const domain = launchctlDomain();
  await mkdir6(agentsDir, { recursive: true });
  await mkdir6(path12.join(togetherlinkHome2(), "logs"), { recursive: true });
  const plistContent = generateLaunchdPlist();
  await writeFile4(plistDest, plistContent, { mode: 420 });
  try {
    try {
      await promisifiedExecFile("launchctl", ["bootout", domain, plistDest]);
    } catch {
    }
    await stopLegacyDaemonForTakeover();
    await promisifiedExecFile("launchctl", ["bootstrap", domain, plistDest]);
    await promisifiedExecFile("launchctl", ["enable", `${domain}/${LAUNCHD_LABEL}`]);
    await waitForManagedDaemonReady();
    await writeFile4(autoInstallSentinelPath(), new Date().toISOString(), { mode: 384 });
    for (const staleSentinel of [
      ...PREVIOUS_AUTO_INSTALL_SENTINELS.map((name) => path12.join(togetherlinkHome2(), name)),
      path12.join(togetherlinkHome2(), LEGACY_AUTO_INSTALL_SENTINEL)
    ]) {
      try {
        await unlink2(staleSentinel);
      } catch {
      }
    }
  } catch (error) {
    await rollbackLaunchdDaemon(plistDest, domain);
    throw error;
  }
  return {
    installed: true,
    message: `Installed launchd agent: ${plistDest}
The TogetherLink daemon will now start at login and restart if it exits.`
  };
}
async function uninstallLaunchdDaemon() {
  assertMacOS();
  const plistDest = plistPath();
  const domain = launchctlDomain();
  const exists = await readFile4(plistDest, "utf8").then(() => true).catch(() => false);
  if (!exists) {
    return {
      removed: false,
      message: `No launchd agent found at ${plistDest}.`
    };
  }
  let stopped = false;
  try {
    await promisifiedExecFile("launchctl", ["bootout", domain, plistDest]);
    stopped = true;
  } catch (err) {
    const message = err.message ?? "";
    stopped = message.includes("No such file") || message.includes("not loaded") || err.code === "ENOENT";
  }
  if (!stopped) {
    return {
      removed: false,
      message: `Could not unload launchd agent at ${plistDest}. ` + `Run \`launchctl bootout ${domain} '${plistDest}'\` and remove the file manually.`
    };
  }
  await unlink2(plistDest);
  for (const sentinel of [
    autoInstallSentinelPath(),
    ...PREVIOUS_AUTO_INSTALL_SENTINELS.map((name) => path12.join(togetherlinkHome2(), name)),
    path12.join(togetherlinkHome2(), LEGACY_AUTO_INSTALL_SENTINEL)
  ]) {
    try {
      await unlink2(sentinel);
    } catch {
    }
  }
  return {
    removed: true,
    message: `Removed launchd agent: ${plistDest}
The TogetherLink daemon will no longer start automatically at login.`
  };
}
async function launchdStatus() {
  assertMacOS();
  if (!await launchdUserSessionAvailable()) {
    return {
      installed: false,
      message: "A launchd user session is unavailable in this macOS environment. " + "TogetherLink will use portable process mode."
    };
  }
  const plistDest = plistPath();
  const domain = launchctlDomain();
  const installed = await readFile4(plistDest, "utf8").then(() => true).catch(() => false);
  if (!installed) {
    return {
      installed: false,
      message: `No launchd agent at ${plistDest}. The daemon will not start automatically at login.`
    };
  }
  let loaded = false;
  try {
    const { stdout } = await promisifiedExecFile("launchctl", [
      "print",
      `${domain}/${LAUNCHD_LABEL}`
    ]);
    loaded = stdout.includes("PID") || stdout.includes("state = running");
  } catch {
    loaded = false;
  }
  return {
    installed: true,
    loaded,
    message: `Launchd agent installed at ${plistDest}. Status: ${loaded ? "loaded/running" : "installed but not loaded"}.`
  };
}
function launchdPlistPath() {
  return plistPath();
}
async function startLaunchdDaemon() {
  assertMacOS();
  const plistDest = plistPath();
  const installed = await readFile4(plistDest, "utf8").then(() => true).catch(() => false);
  if (!installed) {
    return false;
  }
  const domain = launchctlDomain();
  try {
    await promisifiedExecFile("launchctl", ["kickstart", "-k", `${domain}/${LAUNCHD_LABEL}`]);
  } catch {
    await promisifiedExecFile("launchctl", ["bootstrap", domain, plistDest]);
    await promisifiedExecFile("launchctl", ["enable", `${domain}/${LAUNCHD_LABEL}`]);
  }
  return true;
}
async function stopLaunchdDaemon() {
  assertMacOS();
  const plistDest = plistPath();
  const installed = await readFile4(plistDest, "utf8").then(() => true).catch(() => false);
  if (!installed) {
    return false;
  }
  try {
    await promisifiedExecFile("launchctl", ["bootout", launchctlDomain(), plistDest]);
    return true;
  } catch {
    return false;
  }
}
var AUTO_INSTALL_SENTINEL = "launchd-supervision-v4-installed", PREVIOUS_AUTO_INSTALL_SENTINELS, LEGACY_AUTO_INSTALL_SENTINEL = "launchd-auto-installed", LAUNCHD_LABEL = "com.togetherlink.daemon";
var init_launchd = __esm(() => {
  init_paths();
  init_detect_bundle();
  init_takeover();
  PREVIOUS_AUTO_INSTALL_SENTINELS = [
    "launchd-supervision-v3-installed",
    "launchd-supervision-v2-installed"
  ];
});

// packages/cli/src/lib/daemon/systemd.ts
import os5 from "os";
import path13 from "path";
import { execFile as execFile2 } from "child_process";
import { mkdir as mkdir7, readFile as readFile5, unlink as unlink3, writeFile as writeFile5 } from "fs/promises";
function isLinux() {
  return process.platform === "linux";
}
function assertLinux() {
  if (!isLinux()) {
    throw new Error("systemd user services are only supported on Linux.");
  }
}
function autoInstallSentinelPath2() {
  return path13.join(togetherlinkHome2(), AUTO_INSTALL_SENTINEL2);
}
function systemdUserDir() {
  return path13.join(os5.homedir(), ".config", "systemd", "user");
}
function servicePath() {
  return path13.join(systemdUserDir(), SYSTEMD_SERVICE_NAME);
}
function bundleExecutable2() {
  return path13.join(togetherlinkHome2(), "bin", "togetherlink");
}
function bundleScript2(home = togetherlinkHome2()) {
  return path13.join(home, "bin", "togetherlink.js");
}
function isInsideSystemdJob() {
  return process.env.SYSTEMD_EXEC_PID !== undefined || process.env.LD_PRELOAD?.includes("libsystemd") === true;
}
function systemdPath() {
  const home = os5.homedir();
  return [
    path13.join(home, ".bun", "bin"),
    "/usr/local/bin",
    "/usr/local/sbin",
    "/usr/bin",
    "/usr/sbin",
    "/bin",
    "/sbin"
  ].join(":");
}
function generateSystemdUnit(overrides) {
  const home = overrides?.home ?? togetherlinkHome2();
  const runtime = overrides?.runtime ?? process.execPath;
  const bundle = overrides?.bundle ?? bundleScript2(home);
  const logDir = path13.join(home, "logs");
  return [
    "[Unit]",
    "Description=TogetherLink shared proxy daemon",
    "After=network.target",
    "",
    "[Service]",
    `Environment=TOGETHERLINK_HOME=${home}`,
    "Environment=TOGETHERLINK_SUPERVISED=1",
    `Environment=PATH=${systemdPath()}`,
    `ExecStart="${runtime}" "${bundle}" daemon serve`,
    "Restart=always",
    "RestartSec=10",
    `StandardOutput=append:${path13.join(logDir, "daemon.log")}`,
    `StandardError=append:${path13.join(logDir, "daemon.log")}`,
    "",
    "[Install]",
    "WantedBy=default.target",
    ""
  ].join(`
`);
}
function promisifiedExecFile2(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile2(file, args, { encoding: "utf8", ...options }, (err, stdout, stderr) => {
      if (err) {
        Object.assign(err, { stdout, stderr });
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
async function systemdUserSessionAvailable() {
  try {
    await promisifiedExecFile2("systemctl", ["--user", "show-environment"], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
async function rollbackSystemdService(svcPath) {
  for (const args of [
    ["--user", "stop", SYSTEMD_SERVICE_NAME],
    ["--user", "disable", SYSTEMD_SERVICE_NAME]
  ]) {
    try {
      await promisifiedExecFile2("systemctl", args);
    } catch {
    }
  }
  try {
    await unlink3(svcPath);
  } catch {
  }
  try {
    await promisifiedExecFile2("systemctl", ["--user", "daemon-reload"]);
  } catch {
  }
}
async function maybeAutoInstallSystemdService() {
  if (!isLinux())
    return false;
  if (isInsideSystemdJob())
    return false;
  if (process.argv.includes("--daemon") || process.argv[2] === "daemon")
    return false;
  const sentinel = autoInstallSentinelPath2();
  const already = await readFile5(sentinel, "utf8").then(() => true).catch(() => false);
  if (already)
    return false;
  if (!await runningFromBundle())
    return false;
  try {
    const result = await installSystemdService();
    return result.installed;
  } catch {
    return false;
  }
}
async function installSystemdService() {
  assertLinux();
  if (!await runningFromBundle()) {
    const argv1 = process.argv[1] ?? "unknown";
    return {
      installed: false,
      message: `Auto-start is only configured for the installed bundle (${bundleExecutable2()}). ` + `This process was started from ${argv1}. Run install.sh first, then use the installed togetherlink command.`
    };
  }
  if (!await systemdUserSessionAvailable()) {
    return {
      installed: false,
      message: "A systemd user session is unavailable in this Linux environment. " + "TogetherLink will start its daemon automatically in portable process mode when needed."
    };
  }
  const svcPath = servicePath();
  const svcDir = systemdUserDir();
  await mkdir7(svcDir, { recursive: true });
  await mkdir7(path13.join(togetherlinkHome2(), "logs"), { recursive: true });
  const unit = generateSystemdUnit();
  await writeFile5(svcPath, unit, { mode: 420 });
  try {
    try {
      await promisifiedExecFile2("systemctl", ["--user", "stop", SYSTEMD_SERVICE_NAME]);
    } catch {
    }
    await stopLegacyDaemonForTakeover();
    await promisifiedExecFile2("systemctl", ["--user", "daemon-reload"]);
    await promisifiedExecFile2("systemctl", ["--user", "enable", SYSTEMD_SERVICE_NAME]);
    await promisifiedExecFile2("systemctl", ["--user", "start", SYSTEMD_SERVICE_NAME]);
    await waitForManagedDaemonReady();
    await writeFile5(autoInstallSentinelPath2(), new Date().toISOString(), { mode: 384 });
    for (const staleSentinel of [
      ...PREVIOUS_AUTO_INSTALL_SENTINELS2.map((name) => path13.join(togetherlinkHome2(), name)),
      path13.join(togetherlinkHome2(), LEGACY_AUTO_INSTALL_SENTINEL2)
    ]) {
      try {
        await unlink3(staleSentinel);
      } catch {
      }
    }
  } catch (error) {
    await rollbackSystemdService(svcPath);
    throw error;
  }
  return {
    installed: true,
    message: `Installed systemd user service: ${svcPath}
The TogetherLink daemon will now start at login and restart if it exits.`
  };
}
async function uninstallSystemdService() {
  assertLinux();
  const svcPath = servicePath();
  const exists = await readFile5(svcPath, "utf8").then(() => true).catch(() => false);
  if (!exists) {
    return {
      removed: false,
      message: `No systemd user service found at ${svcPath}.`
    };
  }
  if (!await systemdUserSessionAvailable()) {
    await unlink3(svcPath);
    await removeAutoInstallSentinels();
    return {
      removed: true,
      message: `Removed stale systemd user service: ${svcPath}
` + "The systemd user session is unavailable, so no running service could be stopped."
    };
  }
  let stopped = false;
  try {
    await promisifiedExecFile2("systemctl", ["--user", "stop", SYSTEMD_SERVICE_NAME]);
    stopped = true;
  } catch (err) {
    const message = err.message ?? "";
    stopped = message.includes("not loaded") || message.includes("does not exist");
  }
  try {
    await promisifiedExecFile2("systemctl", ["--user", "disable", SYSTEMD_SERVICE_NAME]);
  } catch {
  }
  if (!stopped) {
    return {
      removed: false,
      message: `Could not stop systemd service ${SYSTEMD_SERVICE_NAME}. ` + `Run \`systemctl --user stop '${SYSTEMD_SERVICE_NAME}'\` and remove ${svcPath} manually.`
    };
  }
  await unlink3(svcPath);
  await removeAutoInstallSentinels();
  await promisifiedExecFile2("systemctl", ["--user", "daemon-reload"]);
  return {
    removed: true,
    message: `Removed systemd user service: ${svcPath}
The TogetherLink daemon will no longer start automatically at login.`
  };
}
async function removeAutoInstallSentinels() {
  for (const sentinel of [
    autoInstallSentinelPath2(),
    ...PREVIOUS_AUTO_INSTALL_SENTINELS2.map((name) => path13.join(togetherlinkHome2(), name)),
    path13.join(togetherlinkHome2(), LEGACY_AUTO_INSTALL_SENTINEL2)
  ]) {
    try {
      await unlink3(sentinel);
    } catch {
    }
  }
}
async function systemdStatus() {
  assertLinux();
  if (!await systemdUserSessionAvailable()) {
    return {
      installed: false,
      message: "A systemd user session is unavailable in this Linux environment. " + "TogetherLink will use portable process mode."
    };
  }
  const svcPath = servicePath();
  const installed = await readFile5(svcPath, "utf8").then(() => true).catch(() => false);
  if (!installed) {
    return {
      installed: false,
      message: `No systemd user service at ${svcPath}. The daemon will not start automatically at login.`
    };
  }
  let loaded = false;
  try {
    const { stdout } = await promisifiedExecFile2("systemctl", [
      "--user",
      "is-active",
      SYSTEMD_SERVICE_NAME
    ]);
    loaded = stdout.trim() === "active";
  } catch {
    loaded = false;
  }
  return {
    installed: true,
    loaded,
    message: `systemd user service installed at ${svcPath}. Status: ${loaded ? "active" : "installed but not active"}.`
  };
}
async function startSystemdService() {
  assertLinux();
  const installed = await readFile5(servicePath(), "utf8").then(() => true).catch(() => false);
  if (!installed) {
    return false;
  }
  await promisifiedExecFile2("systemctl", ["--user", "start", SYSTEMD_SERVICE_NAME]);
  return true;
}
async function stopSystemdService() {
  assertLinux();
  const installed = await readFile5(servicePath(), "utf8").then(() => true).catch(() => false);
  if (!installed) {
    return false;
  }
  await promisifiedExecFile2("systemctl", ["--user", "stop", SYSTEMD_SERVICE_NAME]);
  return true;
}
var AUTO_INSTALL_SENTINEL2 = "systemd-supervision-v4-installed", PREVIOUS_AUTO_INSTALL_SENTINELS2, LEGACY_AUTO_INSTALL_SENTINEL2 = "systemd-auto-installed", SYSTEMD_SERVICE_NAME = "togetherlink-daemon.service";
var init_systemd = __esm(() => {
  init_paths();
  init_detect_bundle();
  init_takeover();
  PREVIOUS_AUTO_INSTALL_SENTINELS2 = [
    "systemd-supervision-v3-installed",
    "systemd-supervision-v2-installed"
  ];
});

// packages/cli/src/lib/daemon/platform-auto-start.ts
var exports_platform_auto_start = {};
__export(exports_platform_auto_start, {
  uninstallAutoStart: () => uninstallAutoStart,
  stopAutoStart: () => stopAutoStart,
  startAutoStart: () => startAutoStart,
  maybeAutoInstallService: () => maybeAutoInstallService,
  installAutoStart: () => installAutoStart,
  autoStartSupportedPlatform: () => autoStartSupportedPlatform,
  autoStartStatus: () => autoStartStatus
});
async function maybeAutoInstallService() {
  if (isMacOS()) {
    const { maybeAutoInstallLaunchdDaemon: maybeAutoInstallLaunchdDaemon2 } = await Promise.resolve().then(() => (init_launchd(), exports_launchd));
    return maybeAutoInstallLaunchdDaemon2();
  }
  if (isLinux()) {
    return maybeAutoInstallSystemdService();
  }
  return false;
}
async function installAutoStart() {
  if (isMacOS()) {
    return installLaunchdDaemon();
  }
  if (isLinux()) {
    return installSystemdService();
  }
  throw new Error("Auto-start is only supported on macOS and Linux; portable process mode is used elsewhere.");
}
async function uninstallAutoStart() {
  if (isMacOS()) {
    return uninstallLaunchdDaemon();
  }
  if (isLinux()) {
    return uninstallSystemdService();
  }
  throw new Error("Auto-start is only supported on macOS and Linux; portable process mode is used elsewhere.");
}
async function startAutoStart() {
  if (isMacOS()) {
    return startLaunchdDaemon();
  }
  if (isLinux()) {
    return startSystemdService();
  }
  return false;
}
async function stopAutoStart() {
  if (isMacOS()) {
    return stopLaunchdDaemon();
  }
  if (isLinux()) {
    return stopSystemdService();
  }
  return false;
}
async function autoStartStatus() {
  if (isMacOS()) {
    return launchdStatus();
  }
  if (isLinux()) {
    return systemdStatus();
  }
  return {
    installed: false,
    message: "Auto-start is not available on this platform. TogetherLink will use portable process mode."
  };
}
function autoStartSupportedPlatform() {
  if (isMacOS())
    return "macos";
  if (isLinux())
    return "linux";
  return "unsupported";
}
var init_platform_auto_start = __esm(() => {
  init_launchd();
  init_systemd();
});

// packages/cli/src/lib/daemon/launch.ts
import { spawn } from "child_process";
import { randomBytes } from "crypto";
import { mkdir as mkdir8, readFile as readFile6, stat, unlink as unlink4, writeFile as writeFile6 } from "fs/promises";
import path14 from "path";
import { fileURLToPath } from "url";
async function ensureDaemon(options) {
  const port = resolveDaemonPort();
  const url = daemonUrl(port);
  const scriptIdentity = await currentScriptIdentity();
  const healthPollTimeoutMs = options?.healthPollTimeoutMs ?? HEALTH_POLL_TIMEOUT_MS;
  const health = await probeDaemonHealth(port);
  if (health && daemonMatchesCurrentScript(health, scriptIdentity)) {
    return { url };
  }
  if (health) {
    const activeSessionCount = health.activeSessionCount >= 0 ? health.activeSessionCount : await activeSessionCountFor(url);
    const daemonPid = health.pid > 0 ? health.pid : await readDaemonPid2();
    if (activeSessionCount === 0 && daemonPid !== undefined) {
      await stopDaemonPid(daemonPid);
      await waitForDaemonToExit(port);
    } else {
      return { url };
    }
  }
  await clearStalePidFile();
  const supervisor = await startInstalledSupervisor();
  if (!supervisor.installed) {
    const scriptPath = currentScriptPath();
    const child = spawn(process.execPath, [scriptPath, "--daemon"], {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        TOGETHERLINK_PORT: String(port)
      }
    });
    child.unref();
  }
  const deadline = Date.now() + healthPollTimeoutMs;
  while (Date.now() < deadline) {
    await sleep3(HEALTH_POLL_INTERVAL_MS);
    if (await probeHealthz(port)) {
      return { url };
    }
  }
  let repairError = supervisor.installed ? supervisor.error : undefined;
  if (supervisor.installed) {
    try {
      const { installAutoStart: installAutoStart2 } = await Promise.resolve().then(() => (init_platform_auto_start(), exports_platform_auto_start));
      const repaired = await installAutoStart2();
      if (!repaired.installed) {
        repairError = new Error(repaired.message);
      } else {
        repairError = undefined;
      }
    } catch (err) {
      repairError = err;
    }
    if (await probeHealthz(port)) {
      return { url };
    }
  }
  const logPath = path14.join(togetherlinkHome2(), "logs", "daemon.log");
  const repairDetail = repairError ? ` Automatic repair failed: ${repairError instanceof Error ? repairError.message : String(repairError)}.` : "";
  throw new Error(`togetherlink daemon did not become healthy on ${url} within ${healthPollTimeoutMs / 1000}s after an automatic restart and repair.${repairDetail} Run \`togetherlink daemon install\` to repair and restart it, then \`togetherlink daemon status\`. Daemon log: ${logPath}`);
}
async function startInstalledSupervisor() {
  if (!await runningFromBundle()) {
    return { installed: false };
  }
  const { autoStartStatus: autoStartStatus2, maybeAutoInstallService: maybeAutoInstallService2, startAutoStart: startAutoStart2 } = await Promise.resolve().then(() => (init_platform_auto_start(), exports_platform_auto_start));
  await maybeAutoInstallService2();
  const status = await autoStartStatus2();
  if (!status.installed) {
    return { installed: false };
  }
  try {
    if (!await startAutoStart2()) {
      return {
        installed: true,
        error: new Error("TogetherLink auto-start is installed but could not be started.")
      };
    }
    return { installed: true };
  } catch (error) {
    return { installed: true, error };
  }
}
async function currentScriptIdentity() {
  const scriptPath = currentScriptPath();
  try {
    const info = await stat(scriptPath);
    return { scriptPath, scriptSize: info.size, scriptMtimeMs: info.mtimeMs };
  } catch {
    return { scriptPath, scriptSize: null, scriptMtimeMs: null };
  }
}
function daemonMatchesCurrentScript(health, current) {
  if (health.home !== null && health.home !== togetherlinkHome2()) {
    return false;
  }
  if (health.scriptPath !== current.scriptPath) {
    return false;
  }
  if (health.scriptSize === null || current.scriptSize === null || health.scriptMtimeMs === null || current.scriptMtimeMs === null) {
    return health.version !== "";
  }
  return health.scriptSize === current.scriptSize && health.scriptMtimeMs === current.scriptMtimeMs;
}
async function activeSessionCountFor(url) {
  try {
    const response = await daemonFetch(`${url}/internal/sessions`);
    if (!response.ok) {
      return;
    }
    const body = await response.json();
    if (typeof body.count === "number") {
      return body.count;
    }
    return Array.isArray(body.sessions) ? body.sessions.length : undefined;
  } catch {
    return;
  }
}
async function readDaemonPid2() {
  try {
    const raw = (await readFile6(daemonPidPath(), "utf8")).trim();
    const pid = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(pid) ? pid : undefined;
  } catch {
    return;
  }
}
async function stopDaemonPid(pid) {
  try {
    process.kill(pid, "SIGTERM");
  } catch (err) {
    if (err.code !== "ESRCH") {
      throw err;
    }
  }
}
async function waitForDaemonToExit(port) {
  const deadline = Date.now() + HEALTH_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!await probeHealthz(port)) {
      return;
    }
    await sleep3(HEALTH_POLL_INTERVAL_MS);
  }
}
function currentScriptPath() {
  const argv1 = process.argv[1];
  if (argv1) {
    return path14.isAbsolute(argv1) ? argv1 : path14.resolve(argv1);
  }
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return import.meta.url;
  }
}
async function clearStalePidFile() {
  let pid;
  try {
    const raw = (await readFile6(daemonPidPath(), "utf8")).trim();
    pid = raw ? Number.parseInt(raw, 10) : undefined;
  } catch {
    return;
  }
  if (!pid || !Number.isFinite(pid)) {
    try {
      await unlink4(daemonPidPath());
    } catch {
    }
    return;
  }
  if (isProcessAlive(pid)) {
    return;
  }
  try {
    await unlink4(daemonPidPath());
  } catch {
  }
}
function sleep3(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function daemonFetch(url, init) {
  const controller = new AbortController;
  const timer = setTimeout(() => controller.abort(), DAEMON_CALL_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init ?? {}, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function registerDaemonSession(proxyUrl, registration) {
  const response = await daemonFetch(`${proxyUrl}/internal/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(registration)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`daemon registration failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
}
async function updateDaemonSessionPid(proxyUrl, token, pid) {
  await daemonFetch(`${proxyUrl}/internal/sessions/${encodeURIComponent(token)}/pid`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pid })
  });
}
async function localProxyAuthToken() {
  const file = path14.join(togetherlinkHome2(), LOCAL_PROXY_TOKEN_FILE);
  try {
    const token2 = (await readFile6(file, "utf8")).trim();
    if (token2) {
      return token2;
    }
  } catch {
  }
  const token = `togetherlink-local-${randomBytes(32).toString("base64url")}`;
  await mkdir8(path14.dirname(file), { recursive: true });
  await writeFile6(file, `${token}
`, { encoding: "utf8", mode: 384 });
  return token;
}
function daemonSessionUrl(proxyUrl, sessionId) {
  return `${proxyUrl}/session/${encodeURIComponent(sessionId)}`;
}
function startDaemonSessionKeepalive(registration, options = {}) {
  let stopped = false;
  let inFlight = false;
  let lastRecoveredAt = 0;
  const recover = async (reason) => {
    const now = Date.now();
    if (now - lastRecoveredAt < SESSION_KEEPALIVE_INTERVAL_MS) {
      return;
    }
    lastRecoveredAt = now;
    const { url } = await ensureDaemon();
    await registerDaemonSession(url, {
      ...registration,
      ...options.pid !== undefined ? { pid: options.pid } : {}
    });
    if (options.debug) {
      process.stderr.write(`[togetherlink daemon] restored ${options.label ?? registration.agent ?? "session"} after ${reason}.
`);
    }
  };
  const safeRecover = async (reason) => {
    try {
      await recover(reason);
    } catch (err) {
      if (options.debug) {
        process.stderr.write(`[togetherlink daemon] could not restore ${options.label ?? registration.agent ?? "session"}: ${err instanceof Error ? err.message : String(err)}
`);
      }
    }
  };
  const tick = () => {
    if (stopped || inFlight) {
      return;
    }
    inFlight = true;
    (async () => {
      const port = resolveDaemonPort();
      const url = daemonUrl(port);
      try {
        const response = await daemonFetch(`${url}/internal/sessions/${encodeURIComponent(registration.token)}/cost`);
        if (response.status === 404 || response.status === 401) {
          await safeRecover(`missing session (${response.status})`);
        }
      } catch (err) {
        await safeRecover(err instanceof Error ? err.message : "daemon unreachable");
      } finally {
        inFlight = false;
      }
    })();
  };
  const timer = setInterval(tick, SESSION_KEEPALIVE_INTERVAL_MS);
  timer.unref();
  tick();
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    }
  };
}
var HEALTH_POLL_INTERVAL_MS = 50, HEALTH_POLL_TIMEOUT_MS = 5000, DAEMON_CALL_TIMEOUT_MS = 3000, SESSION_KEEPALIVE_INTERVAL_MS = 500, LOCAL_PROXY_TOKEN_FILE = "local-proxy-token";
var init_launch = __esm(() => {
  init_server();
  init_paths();
  init_detect_bundle();
});

// packages/cli/src/lib/proxied-session.ts
import { spawn as spawn2 } from "child_process";
import { randomBytes as randomBytes2 } from "crypto";
async function runProxiedSession(spec) {
  const debug2 = process.env.TOGETHERLINK_DEBUG === "1";
  const sessionId = randomLocalProxyToken();
  const authToken = await localProxyAuthToken();
  const telemetrySessionId = randomSessionId();
  const { url: proxyUrl } = await ensureDaemon();
  const agentProxyUrl = daemonSessionUrl(proxyUrl, sessionId);
  const registration = {
    token: sessionId,
    authToken,
    agent: spec.agent,
    apiKey: spec.apiKey,
    baseUrl: spec.baseUrl,
    modelLabel: spec.modelName,
    modelId: spec.registrationModelId ?? spec.modelId,
    targetModelId: spec.targetModelId,
    modelName: spec.modelName,
    modelDefinition: spec.modelDefinition,
    ...debug2 ? { debug: true } : {},
    ...spec.extraRegistration
  };
  try {
    await registerDaemonSession(proxyUrl, registration);
  } catch (err) {
    throw new Error(`Could not register this ${spec.agent === "claude" ? "Claude" : "Codex"} session with the togetherlink daemon: ${err instanceof Error ? err.message : String(err)}`);
  }
  const startedAt = Date.now();
  sendTelemetryEvent({
    event: "session_started",
    sessionId: telemetrySessionId,
    agent: spec.agent,
    initialModel: spec.targetModelId,
    startedAt
  });
  process.stderr.write(spec.banner(spec.modelName));
  if (debug2) {
    process.stderr.write(`[togetherlink proxy] daemon: ${proxyUrl}
`);
    process.stderr.write(`[togetherlink proxy] session: ${agentProxyUrl}
`);
    process.stderr.write(`[togetherlink ${spec.agent}] model: ${spec.modelId}
`);
  }
  const beforeSpawnResult = spec.beforeSpawn ? await spec.beforeSpawn() : undefined;
  const child = spawn2(spec.binary, spec.buildArgs({
    proxyUrl: agentProxyUrl,
    authToken,
    modelId: spec.modelId,
    args: spec.args ?? [],
    beforeSpawnResult
  }), {
    env: spec.buildEnv({
      proxyUrl: agentProxyUrl,
      authToken,
      modelId: spec.modelId,
      modelName: spec.modelName,
      beforeSpawnResult
    }),
    stdio: "inherit"
  });
  if (!spec.preserveSessionAfterExit && typeof child.pid === "number") {
    try {
      await updateDaemonSessionPid(proxyUrl, sessionId, child.pid);
    } catch {
    }
  }
  const keepalive = startDaemonSessionKeepalive(registration, {
    ...!spec.preserveSessionAfterExit && typeof child.pid === "number" ? { pid: child.pid } : {},
    debug: debug2,
    label: spec.keepaliveLabel
  });
  const result = await new Promise((resolve) => {
    child.on("error", (err) => {
      process.stderr.write(`togetherlink \u25B8 Failed to launch ${spec.binary}: ${err.message}.
`);
      resolve({ status: 1, signal: null });
    });
    child.on("exit", (status, signal) => resolve({ status, signal }));
  });
  const detachedSessionActive = spec.preserveSessionAfterExit && result.status === 0 && result.signal === null;
  keepalive.stop();
  if (detachedSessionActive) {
    process.stderr.write(`togetherlink \u25B8 Background Claude session remains routed through Together AI.
`);
    return result;
  }
  const { usage, usageByModel } = await printSessionCost(proxyUrl, sessionId);
  try {
    await daemonFetch(`${proxyUrl}/internal/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE"
    });
  } catch {
  }
  if (spec.afterDeregister) {
    await spec.afterDeregister();
  }
  const endedAt = Date.now();
  sendTelemetryEvent({
    event: "session_ended",
    sessionId: telemetrySessionId,
    agent: spec.agent,
    initialModel: spec.targetModelId,
    finalModel: spec.targetModelId,
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    ...usage ? { usage } : {},
    ...usageByModel && usageByModel.length > 0 ? { usageByModel } : {},
    ...typeof result.status === "number" ? { exitCode: result.status } : {},
    ...result.signal ? { signal: result.signal } : {}
  });
  return result;
}
async function printSessionCost(proxyUrl, authToken) {
  try {
    const response = await daemonFetch(`${proxyUrl}/internal/sessions/${encodeURIComponent(authToken)}/cost`);
    if (response.ok) {
      const { summary, totals, totalsByModel } = await response.json();
      if (summary) {
        process.stderr.write(`${summary}
`);
      }
      return {
        ...totals ? { usage: totals } : {},
        ...totalsByModel ? { usageByModel: totalsByModel } : {}
      };
    }
  } catch {
  }
  return {};
}
function randomLocalProxyToken() {
  return `togetherlink-${randomBytes2(24).toString("base64url")}`;
}
var init_proxied_session = __esm(() => {
  init_launch();
  init_telemetry();
});

// packages/cli/src/lib/claude/core.ts
function buildClaudeEnv({
  apiKey,
  modelId,
  proxyUrl,
  authToken
}) {
  const env = { ...process.env };
  for (const key of CONFLICTING_ENV_KEYS) {
    delete env[key];
  }
  env.ANTHROPIC_BASE_URL = proxyUrl;
  env.ANTHROPIC_AUTH_TOKEN = authToken;
  env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = "1";
  env.ANTHROPIC_MODEL = claudeCodeModelId(resolveClaudeModel(modelId));
  if (!env.ENABLE_TOOL_SEARCH?.trim()) {
    env.ENABLE_TOOL_SEARCH = "true";
  }
  if (!env.CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT?.trim()) {
    env.CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT = "1";
  }
  if (env.CLAUDE_CODE_HARBOR_KITE === undefined) {
    env.CLAUDE_CODE_HARBOR_KITE = "1";
  }
  if (env.CLAUDE_CODE_MAX_OUTPUT_TOKENS === undefined) {
    env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = String(DEFAULT_CLAUDE_CODE_MAX_OUTPUT_TOKENS);
  }
  applyClaudeModelMenuEnv(env, modelId);
  if (env.CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY === undefined) {
    env.CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY = "1";
  }
  if (env.DISABLE_FEEDBACK_COMMAND === undefined) {
    env.DISABLE_FEEDBACK_COMMAND = "1";
  }
  return env;
}
function applyClaudeModelMenuEnv(env, selectedAlias) {
  const selected = resolveClaudeModel(selectedAlias);
  const defaultModel = CLAUDE_SUPPORTED_MODELS[0] ?? selected;
  const fableModel = CLAUDE_SUPPORTED_MODELS.find((model) => model.alias !== defaultModel.alias) ?? selected;
  const sonnetModel = CLAUDE_SUPPORTED_MODELS.find((model) => model.alias !== defaultModel.alias && model.alias !== fableModel.alias && model.alias !== CLAUDE_HAIKU_MODEL_SELECTION.alias) ?? fableModel;
  setTierModelEnv(env, "OPUS", defaultModel);
  setTierModelEnv(env, "FABLE", fableModel);
  setTierModelEnv(env, "SONNET", sonnetModel);
  setTierModelEnv(env, "HAIKU", CLAUDE_HAIKU_MODEL_SELECTION);
  const tierAliases = new Set([
    defaultModel.alias,
    fableModel.alias,
    sonnetModel.alias,
    CLAUDE_HAIKU_MODEL_SELECTION.alias
  ]);
  if (tierAliases.has(selected.alias)) {
    clearCustomModelEnv(env);
    return;
  }
  env.ANTHROPIC_CUSTOM_MODEL_OPTION = claudeCodeModelId(selected);
  env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME = selected.definition.name;
  env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION = "Local Anthropic-to-Together proxy";
  const capabilities = claudeModelCapabilities(selected.definition);
  if (capabilities) {
    env.ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES = capabilities;
  } else {
    delete env.ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES;
  }
}
function clearCustomModelEnv(env) {
  delete env.ANTHROPIC_CUSTOM_MODEL_OPTION;
  delete env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME;
  delete env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION;
  delete env.ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES;
}
function setTierModelEnv(env, tier, model) {
  const prefix = `ANTHROPIC_DEFAULT_${tier}_MODEL`;
  env[prefix] = claudeCodeModelId(model);
  env[`${prefix}_NAME`] = model.definition.name;
  env[`${prefix}_DESCRIPTION`] = `Together AI (${model.definition.name}) via togetherlink \u2014 not Anthropic`;
}
function claudeCodeModelId(model) {
  return model.definition.limit.context >= CLAUDE_EXTENDED_CONTEXT_TOKENS ? `${model.alias}[1m]` : model.alias;
}
async function runClaudeTogether(options) {
  const args = options.args ?? [];
  const selectedModel = resolveClaudeModel(options.modelId);
  const result = await runProxiedSession({
    agent: "claude",
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    modelId: selectedModel.alias,
    registrationModelId: selectedModel.alias,
    targetModelId: selectedModel.definition.id,
    modelName: selectedModel.definition.name,
    modelDefinition: selectedModel.definition,
    extraRegistration: {
      claudeCodeMaxOutputTokens: claudeCodeMaxOutputTokensFromEnv(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS),
      claudeCodeMaxOutputTokensUserSet: process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS !== undefined
    },
    args,
    binary: "claude",
    keepaliveLabel: "Claude session",
    preserveSessionAfterExit: claudeRunsInBackground(args),
    banner: (modelName) => `togetherlink \u25B8 Routing Claude Code \u2192 Together AI (${modelName}). Not Anthropic.
`,
    buildEnv: ({ proxyUrl, authToken, modelId, modelName }) => buildClaudeEnv({ ...options, modelId, modelName, proxyUrl, authToken }),
    buildArgs: ({ args: args2 }) => buildClaudeLaunchArgs(args2)
  });
  return result;
}
function claudeRunsInBackground(args) {
  return args.some((arg) => arg === "--bg" || arg === "--background");
}
function buildClaudeLaunchArgs(args) {
  return [
    ...claudeArgsWithoutModelOverrides(args),
    ...claudeCacheFriendlyArgs(args),
    ...claudeExtraSettingsArgs(args)
  ];
}
function claudeCodeMaxOutputTokensFromEnv(value) {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_CLAUDE_CODE_MAX_OUTPUT_TOKENS;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CLAUDE_CODE_MAX_OUTPUT_TOKENS;
}
function claudeArgsWithoutModelOverrides(args) {
  const sanitized = [];
  for (let i = 0;i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--model" || arg === "-m") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--model=")) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}
function claudeCacheFriendlyArgs(args) {
  for (const arg of args) {
    if (arg === "--exclude-dynamic-system-prompt-sections" || arg === "--system-prompt" || arg.startsWith("--system-prompt=") || arg === "--system-prompt-file" || arg.startsWith("--system-prompt-file=")) {
      return [];
    }
  }
  return ["--exclude-dynamic-system-prompt-sections"];
}
function claudeExtraSettingsArgs(args) {
  for (const arg of args) {
    if (arg === "--settings" || arg.startsWith("--settings=")) {
      return [];
    }
  }
  return [
    "--settings",
    JSON.stringify({
      skipWebFetchPreflight: true,
      showThinkingSummaries: true,
      attribution: {
        commit: "",
        pr: ""
      }
    })
  ];
}
var CONFLICTING_ENV_KEYS, DEFAULT_CLAUDE_CODE_MAX_OUTPUT_TOKENS = 32000, CLAUDE_EXTENDED_CONTEXT_TOKENS = 1e6;
var init_core = __esm(() => {
  init_defaults();
  init_launch();
  init_proxied_session();
  CONFLICTING_ENV_KEYS = [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME",
    "ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION",
    "ANTHROPIC_DEFAULT_FABLE_MODEL",
    "ANTHROPIC_DEFAULT_FABLE_MODEL_NAME",
    "ANTHROPIC_DEFAULT_FABLE_MODEL_DESCRIPTION",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION",
    "ANTHROPIC_CUSTOM_MODEL_OPTION",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_NAME",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES"
  ];
});

// packages/cli/src/lib/harnesses/claude.ts
var exports_claude = {};
__export(exports_claude, {
  default: () => claude_default
});
var claude_default;
var init_claude = __esm(() => {
  init_defaults();
  init_harness();
  init_together_core();
  init_core();
  claude_default = defineHarness({
    id: HARNESS.CLAUDE,
    label: "Claude Code",
    async run(ctx) {
      const apiKey = await resolveTogetherApiKey({
        apiKey: ctx.apiKey,
        home: ctx.home
      });
      if (!apiKey) {
        throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
      }
      const selectedModel = resolveClaudeModel(ctx.main);
      const launchOptions = {
        apiKey,
        baseUrl: resolveTogetherBaseUrl(),
        modelId: selectedModel.alias,
        ...ctx.passthrough ? { args: ctx.passthrough } : {}
      };
      const result = await runClaudeTogether(launchOptions);
      if (typeof result.status === "number") {
        process.exitCode = result.status;
      }
      return {};
    }
  });
});

// packages/cli/src/lib/codex/user-config.ts
import { mkdir as mkdir9, readFile as readFile7, rename as rename3, writeFile as writeFile7 } from "fs/promises";
import path15 from "path";
async function ensureCodexGenericUserDefaults(home) {
  const configPath = codexConfigPath(home);
  const existing = await readTextIfExists(configPath);
  const next = applyCodexGenericUserDefaults(existing ?? "");
  if (next === (existing ?? "")) {
    return;
  }
  await writeTextAtomic(configPath, next);
}
function applyCodexGenericUserDefaults(rawConfig) {
  if (rawConfig.trim() !== "") {
    return rawConfig;
  }
  return `${Object.entries(FIRST_RUN_CODEX_DEFAULTS).map(([key, value]) => `${key} = ${tomlString(value)}`).join(`
`)}
`;
}
function codexArgsIgnoreUserConfig(args) {
  return args.includes("--ignore-user-config");
}
function codexConfigPath(home) {
  return path15.join(home, ".codex", "config.toml");
}
async function readTextIfExists(file) {
  try {
    return await readFile7(file, "utf8");
  } catch (err) {
    if (isNodeError2(err) && err.code === "ENOENT") {
      return;
    }
    throw err;
  }
}
async function writeTextAtomic(file, value) {
  await mkdir9(path15.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile7(tmp, value, { encoding: "utf8", mode: 384 });
  await rename3(tmp, file);
}
function tomlString(value) {
  return JSON.stringify(value);
}
function isNodeError2(err) {
  return err instanceof Error && "code" in err;
}
var FIRST_RUN_CODEX_DEFAULTS;
var init_user_config = __esm(() => {
  FIRST_RUN_CODEX_DEFAULTS = {
    approval_policy: "on-request",
    sandbox_mode: "workspace-write",
    approvals_reviewer: "auto_review"
  };
});

// packages/cli/src/lib/codex/core.ts
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
async function runCodexTogether(options) {
  const args = options.args ?? [];
  if (!codexArgsIgnoreUserConfig(args)) {
    await ensureCodexGenericUserDefaults(options.home);
  }
  const selectedModel = resolveCodexModel(options.modelId);
  let catalog;
  const result = await runProxiedSession({
    agent: "codex",
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    modelId: selectedModel.definition.id,
    targetModelId: selectedModel.definition.id,
    modelName: selectedModel.definition.name,
    modelDefinition: selectedModel.definition,
    args,
    binary: "codex",
    keepaliveLabel: "Codex session",
    banner: (modelName) => `togetherlink \u25B8 Routing Codex \u2192 Together AI (${modelName}). Not OpenAI.
`,
    beforeSpawn: () => {
      catalog = writeCodexModelCatalog();
      return catalog;
    },
    buildEnv: ({ authToken }) => buildCodexEnv(authToken),
    buildArgs: ({ proxyUrl, authToken, modelId, beforeSpawnResult }) => buildCodexLaunchArgs({
      args,
      proxyUrl,
      authToken,
      modelId,
      catalogPath: beforeSpawnResult?.path ?? ""
    }),
    afterDeregister: () => catalog?.cleanup()
  });
  return result;
}
function buildCodexLaunchArgs({
  args,
  proxyUrl,
  authToken,
  modelId,
  catalogPath
}) {
  const nativeArgs = codexArgsWithoutModelOverrides(args);
  const configArgs = codexConfigArgs(proxyUrl, authToken, modelId, catalogPath);
  const separatorIndex = nativeArgs.indexOf("--");
  if (separatorIndex === -1) {
    return [...nativeArgs, ...configArgs];
  }
  return [
    ...nativeArgs.slice(0, separatorIndex),
    ...configArgs,
    ...nativeArgs.slice(separatorIndex)
  ];
}
function buildCodexEnv(authToken) {
  return {
    ...process.env,
    [CODEX_AUTH_ENV]: authToken
  };
}
function codexConfigArgs(proxyUrl, authToken, modelId, catalogPath) {
  return [
    "-c",
    `model_provider="${CODEX_PROVIDER_ID}"`,
    "-c",
    `model="${modelId}"`,
    "-c",
    `model_catalog_json="${catalogPath}"`,
    "-c",
    `model_providers.${CODEX_PROVIDER_ID}.name="Togetherlink"`,
    "-c",
    `model_providers.${CODEX_PROVIDER_ID}.base_url="${proxyUrl}/v1"`,
    "-c",
    `model_providers.${CODEX_PROVIDER_ID}.wire_api="responses"`,
    "-c",
    `model_providers.${CODEX_PROVIDER_ID}.env_key="${CODEX_AUTH_ENV}"`
  ];
}
function writeCodexModelCatalog() {
  const dir = mkdtempSync(join(tmpdir(), "togetherlink-codex-catalog-"));
  const path16 = join(dir, "models.json");
  writeFileSync(path16, codexModelCatalogJson(), "utf8");
  return {
    path: path16,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
      }
    }
  };
}
function codexArgsWithoutModelOverrides(args) {
  const sanitized = [];
  for (let i = 0;i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--") {
      sanitized.push(...args.slice(i));
      break;
    }
    if (MODEL_OVERRIDE_FLAGS.has(arg)) {
      i += 1;
      continue;
    }
    if (arg.startsWith("--model=")) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}
var MODEL_OVERRIDE_FLAGS;
var init_core2 = __esm(() => {
  init_catalog();
  init_defaults2();
  init_user_config();
  init_launch();
  init_proxied_session();
  MODEL_OVERRIDE_FLAGS = new Set(["--model", "-m"]);
});

// packages/cli/src/lib/harnesses/codex.ts
var exports_codex = {};
__export(exports_codex, {
  default: () => codex_default
});
var codex_default;
var init_codex = __esm(() => {
  init_defaults2();
  init_core2();
  init_harness();
  init_together_core();
  codex_default = defineHarness({
    id: HARNESS.CODEX,
    label: "Codex",
    async run(ctx) {
      const apiKey = await resolveTogetherApiKey({
        apiKey: ctx.apiKey,
        home: ctx.home
      });
      if (!apiKey) {
        throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
      }
      const selectedModel = resolveCodexModel(ctx.main);
      const result = await runCodexTogether({
        apiKey,
        baseUrl: resolveTogetherBaseUrl(),
        home: ctx.home,
        modelId: selectedModel.id,
        ...ctx.passthrough ? { args: ctx.passthrough } : {}
      });
      if (typeof result.status === "number") {
        process.exitCode = result.status;
      }
      return {};
    }
  });
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS((exports) => {
  var ALIAS = Symbol.for("yaml.alias");
  var DOC = Symbol.for("yaml.document");
  var MAP = Symbol.for("yaml.map");
  var PAIR = Symbol.for("yaml.pair");
  var SCALAR = Symbol.for("yaml.scalar");
  var SEQ = Symbol.for("yaml.seq");
  var NODE_TYPE = Symbol.for("yaml.node.type");
  var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
  var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
  var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
  var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
  var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
  var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
  function isCollection(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case MAP:
        case SEQ:
          return true;
      }
    return false;
  }
  function isNode(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case ALIAS:
        case MAP:
        case SCALAR:
        case SEQ:
          return true;
      }
    return false;
  }
  var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
  exports.ALIAS = ALIAS;
  exports.DOC = DOC;
  exports.MAP = MAP;
  exports.NODE_TYPE = NODE_TYPE;
  exports.PAIR = PAIR;
  exports.SCALAR = SCALAR;
  exports.SEQ = SEQ;
  exports.hasAnchor = hasAnchor;
  exports.isAlias = isAlias;
  exports.isCollection = isCollection;
  exports.isDocument = isDocument;
  exports.isMap = isMap;
  exports.isNode = isNode;
  exports.isPair = isPair;
  exports.isScalar = isScalar;
  exports.isSeq = isSeq;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/visit.js
var require_visit = __commonJS((exports) => {
  var identity = require_identity();
  var BREAK = Symbol("break visit");
  var SKIP = Symbol("skip children");
  var REMOVE = Symbol("remove node");
  function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
      const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      visit_(null, node, visitor_, Object.freeze([]));
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  function visit_(key, node, visitor, path16) {
    const ctrl = callVisitor(key, node, visitor, path16);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
      replaceNode(key, path16, ctrl);
      return visit_(key, ctrl, visitor, path16);
    }
    if (typeof ctrl !== "symbol") {
      if (identity.isCollection(node)) {
        path16 = Object.freeze(path16.concat(node));
        for (let i = 0;i < node.items.length; ++i) {
          const ci = visit_(i, node.items[i], visitor, path16);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (identity.isPair(node)) {
        path16 = Object.freeze(path16.concat(node));
        const ck = visit_("key", node.key, visitor, path16);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = visit_("value", node.value, visitor, path16);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
      const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      await visitAsync_(null, node, visitor_, Object.freeze([]));
  }
  visitAsync.BREAK = BREAK;
  visitAsync.SKIP = SKIP;
  visitAsync.REMOVE = REMOVE;
  async function visitAsync_(key, node, visitor, path16) {
    const ctrl = await callVisitor(key, node, visitor, path16);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
      replaceNode(key, path16, ctrl);
      return visitAsync_(key, ctrl, visitor, path16);
    }
    if (typeof ctrl !== "symbol") {
      if (identity.isCollection(node)) {
        path16 = Object.freeze(path16.concat(node));
        for (let i = 0;i < node.items.length; ++i) {
          const ci = await visitAsync_(i, node.items[i], visitor, path16);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (identity.isPair(node)) {
        path16 = Object.freeze(path16.concat(node));
        const ck = await visitAsync_("key", node.key, visitor, path16);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = await visitAsync_("value", node.value, visitor, path16);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  function initVisitor(visitor) {
    if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
      return Object.assign({
        Alias: visitor.Node,
        Map: visitor.Node,
        Scalar: visitor.Node,
        Seq: visitor.Node
      }, visitor.Value && {
        Map: visitor.Value,
        Scalar: visitor.Value,
        Seq: visitor.Value
      }, visitor.Collection && {
        Map: visitor.Collection,
        Seq: visitor.Collection
      }, visitor);
    }
    return visitor;
  }
  function callVisitor(key, node, visitor, path16) {
    if (typeof visitor === "function")
      return visitor(key, node, path16);
    if (identity.isMap(node))
      return visitor.Map?.(key, node, path16);
    if (identity.isSeq(node))
      return visitor.Seq?.(key, node, path16);
    if (identity.isPair(node))
      return visitor.Pair?.(key, node, path16);
    if (identity.isScalar(node))
      return visitor.Scalar?.(key, node, path16);
    if (identity.isAlias(node))
      return visitor.Alias?.(key, node, path16);
    return;
  }
  function replaceNode(key, path16, node) {
    const parent = path16[path16.length - 1];
    if (identity.isCollection(parent)) {
      parent.items[key] = node;
    } else if (identity.isPair(parent)) {
      if (key === "key")
        parent.key = node;
      else
        parent.value = node;
    } else if (identity.isDocument(parent)) {
      parent.contents = node;
    } else {
      const pt = identity.isAlias(parent) ? "alias" : "scalar";
      throw new Error(`Cannot replace node with ${pt} parent`);
    }
  }
  exports.visit = visit;
  exports.visitAsync = visitAsync;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS((exports) => {
  var identity = require_identity();
  var visit = require_visit();
  var escapeChars = {
    "!": "%21",
    ",": "%2C",
    "[": "%5B",
    "]": "%5D",
    "{": "%7B",
    "}": "%7D"
  };
  var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);

  class Directives {
    constructor(yaml, tags) {
      this.docStart = null;
      this.docEnd = false;
      this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
      this.tags = Object.assign({}, Directives.defaultTags, tags);
    }
    clone() {
      const copy = new Directives(this.yaml, this.tags);
      copy.docStart = this.docStart;
      return copy;
    }
    atDocument() {
      const res = new Directives(this.yaml, this.tags);
      switch (this.yaml.version) {
        case "1.1":
          this.atNextDocument = true;
          break;
        case "1.2":
          this.atNextDocument = false;
          this.yaml = {
            explicit: Directives.defaultYaml.explicit,
            version: "1.2"
          };
          this.tags = Object.assign({}, Directives.defaultTags);
          break;
      }
      return res;
    }
    add(line, onError) {
      if (this.atNextDocument) {
        this.yaml = { explicit: Directives.defaultYaml.explicit, version: "1.1" };
        this.tags = Object.assign({}, Directives.defaultTags);
        this.atNextDocument = false;
      }
      const parts = line.trim().split(/[ \t]+/);
      const name = parts.shift();
      switch (name) {
        case "%TAG": {
          if (parts.length !== 2) {
            onError(0, "%TAG directive should contain exactly two parts");
            if (parts.length < 2)
              return false;
          }
          const [handle, prefix] = parts;
          this.tags[handle] = prefix;
          return true;
        }
        case "%YAML": {
          this.yaml.explicit = true;
          if (parts.length !== 1) {
            onError(0, "%YAML directive should contain exactly one part");
            return false;
          }
          const [version] = parts;
          if (version === "1.1" || version === "1.2") {
            this.yaml.version = version;
            return true;
          } else {
            const isValid = /^\d+\.\d+$/.test(version);
            onError(6, `Unsupported YAML version ${version}`, isValid);
            return false;
          }
        }
        default:
          onError(0, `Unknown directive ${name}`, true);
          return false;
      }
    }
    tagName(source, onError) {
      if (source === "!")
        return "!";
      if (source[0] !== "!") {
        onError(`Not a valid tag: ${source}`);
        return null;
      }
      if (source[1] === "<") {
        const verbatim = source.slice(2, -1);
        if (verbatim === "!" || verbatim === "!!") {
          onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
          return null;
        }
        if (source[source.length - 1] !== ">")
          onError("Verbatim tags must end with a >");
        return verbatim;
      }
      const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
      if (!suffix)
        onError(`The ${source} tag has no suffix`);
      const prefix = this.tags[handle];
      if (prefix) {
        try {
          return prefix + decodeURIComponent(suffix);
        } catch (error) {
          onError(String(error));
          return null;
        }
      }
      if (handle === "!")
        return source;
      onError(`Could not resolve tag: ${source}`);
      return null;
    }
    tagString(tag) {
      for (const [handle, prefix] of Object.entries(this.tags)) {
        if (tag.startsWith(prefix))
          return handle + escapeTagName(tag.substring(prefix.length));
      }
      return tag[0] === "!" ? tag : `!<${tag}>`;
    }
    toString(doc) {
      const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
      const tagEntries = Object.entries(this.tags);
      let tagNames;
      if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
        const tags = {};
        visit.visit(doc.contents, (_key, node) => {
          if (identity.isNode(node) && node.tag)
            tags[node.tag] = true;
        });
        tagNames = Object.keys(tags);
      } else
        tagNames = [];
      for (const [handle, prefix] of tagEntries) {
        if (handle === "!!" && prefix === "tag:yaml.org,2002:")
          continue;
        if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
          lines.push(`%TAG ${handle} ${prefix}`);
      }
      return lines.join(`
`);
    }
  }
  Directives.defaultYaml = { explicit: false, version: "1.2" };
  Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
  exports.Directives = Directives;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS((exports) => {
  var identity = require_identity();
  var visit = require_visit();
  function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
      const sa = JSON.stringify(anchor);
      const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
      throw new Error(msg);
    }
    return true;
  }
  function anchorNames(root) {
    const anchors = new Set;
    visit.visit(root, {
      Value(_key, node) {
        if (node.anchor)
          anchors.add(node.anchor);
      }
    });
    return anchors;
  }
  function findNewAnchor(prefix, exclude) {
    for (let i = 1;; ++i) {
      const name = `${prefix}${i}`;
      if (!exclude.has(name))
        return name;
    }
  }
  function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = new Map;
    let prevAnchors = null;
    return {
      onAnchor: (source) => {
        aliasObjects.push(source);
        prevAnchors ?? (prevAnchors = anchorNames(doc));
        const anchor = findNewAnchor(prefix, prevAnchors);
        prevAnchors.add(anchor);
        return anchor;
      },
      setAnchors: () => {
        for (const source of aliasObjects) {
          const ref = sourceObjects.get(source);
          if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
            ref.node.anchor = ref.anchor;
          } else {
            const error = new Error("Failed to resolve repeated object (this should not happen)");
            error.source = source;
            throw error;
          }
        }
      },
      sourceObjects
    };
  }
  exports.anchorIsValid = anchorIsValid;
  exports.anchorNames = anchorNames;
  exports.createNodeAnchors = createNodeAnchors;
  exports.findNewAnchor = findNewAnchor;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS((exports) => {
  function applyReviver(reviver, obj, key, val) {
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (let i = 0, len = val.length;i < len; ++i) {
          const v0 = val[i];
          const v1 = applyReviver(reviver, val, String(i), v0);
          if (v1 === undefined)
            delete val[i];
          else if (v1 !== v0)
            val[i] = v1;
        }
      } else if (val instanceof Map) {
        for (const k3 of Array.from(val.keys())) {
          const v0 = val.get(k3);
          const v1 = applyReviver(reviver, val, k3, v0);
          if (v1 === undefined)
            val.delete(k3);
          else if (v1 !== v0)
            val.set(k3, v1);
        }
      } else if (val instanceof Set) {
        for (const v0 of Array.from(val)) {
          const v1 = applyReviver(reviver, val, v0, v0);
          if (v1 === undefined)
            val.delete(v0);
          else if (v1 !== v0) {
            val.delete(v0);
            val.add(v1);
          }
        }
      } else {
        for (const [k3, v0] of Object.entries(val)) {
          const v1 = applyReviver(reviver, val, k3, v0);
          if (v1 === undefined)
            delete val[k3];
          else if (v1 !== v0)
            val[k3] = v1;
        }
      }
    }
    return reviver.call(obj, key, val);
  }
  exports.applyReviver = applyReviver;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS((exports) => {
  var identity = require_identity();
  function toJS(value, arg, ctx) {
    if (Array.isArray(value))
      return value.map((v3, i) => toJS(v3, String(i), ctx));
    if (value && typeof value.toJSON === "function") {
      if (!ctx || !identity.hasAnchor(value))
        return value.toJSON(arg, ctx);
      const data = { aliasCount: 0, count: 1, res: undefined };
      ctx.anchors.set(value, data);
      ctx.onCreate = (res2) => {
        data.res = res2;
        delete ctx.onCreate;
      };
      const res = value.toJSON(arg, ctx);
      if (ctx.onCreate)
        ctx.onCreate(res);
      return res;
    }
    if (typeof value === "bigint" && !ctx?.keep)
      return Number(value);
    return value;
  }
  exports.toJS = toJS;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS((exports) => {
  var applyReviver = require_applyReviver();
  var identity = require_identity();
  var toJS = require_toJS();

  class NodeBase {
    constructor(type) {
      Object.defineProperty(this, identity.NODE_TYPE, { value: type });
    }
    clone() {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      if (!identity.isDocument(doc))
        throw new TypeError("A document argument is required");
      const ctx = {
        anchors: new Map,
        doc,
        keep: true,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS.toJS(this, "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
    }
  }
  exports.NodeBase = NodeBase;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS((exports) => {
  var anchors = require_anchors();
  var visit = require_visit();
  var identity = require_identity();
  var Node = require_Node();
  var toJS = require_toJS();

  class Alias extends Node.NodeBase {
    constructor(source) {
      super(identity.ALIAS);
      this.source = source;
      Object.defineProperty(this, "tag", {
        set() {
          throw new Error("Alias nodes cannot have tags");
        }
      });
    }
    resolve(doc, ctx) {
      if (ctx?.maxAliasCount === 0)
        throw new ReferenceError("Alias resolution is disabled");
      let nodes;
      if (ctx?.aliasResolveCache) {
        nodes = ctx.aliasResolveCache;
      } else {
        nodes = [];
        visit.visit(doc, {
          Node: (_key, node) => {
            if (identity.isAlias(node) || identity.hasAnchor(node))
              nodes.push(node);
          }
        });
        if (ctx)
          ctx.aliasResolveCache = nodes;
      }
      let found = undefined;
      for (const node of nodes) {
        if (node === this)
          break;
        if (node.anchor === this.source)
          found = node;
      }
      return found;
    }
    toJSON(_arg, ctx) {
      if (!ctx)
        return { source: this.source };
      const { anchors: anchors2, doc, maxAliasCount } = ctx;
      const source = this.resolve(doc, ctx);
      if (!source) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new ReferenceError(msg);
      }
      let data = anchors2.get(source);
      if (!data) {
        toJS.toJS(source, null, ctx);
        data = anchors2.get(source);
      }
      if (data?.res === undefined) {
        const msg = "This should not happen: Alias anchor was not resolved?";
        throw new ReferenceError(msg);
      }
      if (maxAliasCount >= 0) {
        data.count += 1;
        if (data.aliasCount === 0)
          data.aliasCount = getAliasCount(doc, source, anchors2);
        if (data.count * data.aliasCount > maxAliasCount) {
          const msg = "Excessive alias count indicates a resource exhaustion attack";
          throw new ReferenceError(msg);
        }
      }
      return data.res;
    }
    toString(ctx, _onComment, _onChompKeep) {
      const src = `*${this.source}`;
      if (ctx) {
        anchors.anchorIsValid(this.source);
        if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new Error(msg);
        }
        if (ctx.implicitKey)
          return `${src} `;
      }
      return src;
    }
  }
  function getAliasCount(doc, node, anchors2) {
    if (identity.isAlias(node)) {
      const source = node.resolve(doc);
      const anchor = anchors2 && source && anchors2.get(source);
      return anchor ? anchor.count * anchor.aliasCount : 0;
    } else if (identity.isCollection(node)) {
      let count = 0;
      for (const item of node.items) {
        const c2 = getAliasCount(doc, item, anchors2);
        if (c2 > count)
          count = c2;
      }
      return count;
    } else if (identity.isPair(node)) {
      const kc = getAliasCount(doc, node.key, anchors2);
      const vc = getAliasCount(doc, node.value, anchors2);
      return Math.max(kc, vc);
    }
    return 1;
  }
  exports.Alias = Alias;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS((exports) => {
  var identity = require_identity();
  var Node = require_Node();
  var toJS = require_toJS();
  var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";

  class Scalar extends Node.NodeBase {
    constructor(value) {
      super(identity.SCALAR);
      this.value = value;
    }
    toJSON(arg, ctx) {
      return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
    }
    toString() {
      return String(this.value);
    }
  }
  Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
  Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
  Scalar.PLAIN = "PLAIN";
  Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
  Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
  exports.Scalar = Scalar;
  exports.isScalarValue = isScalarValue;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS((exports) => {
  var Alias = require_Alias();
  var identity = require_identity();
  var Scalar = require_Scalar();
  var defaultTagPrefix = "tag:yaml.org,2002:";
  function findTagObject(value, tagName, tags) {
    if (tagName) {
      const match = tags.filter((t) => t.tag === tagName);
      const tagObj = match.find((t) => !t.format) ?? match[0];
      if (!tagObj)
        throw new Error(`Tag ${tagName} not found`);
      return tagObj;
    }
    return tags.find((t) => t.identify?.(value) && !t.format);
  }
  function createNode(value, tagName, ctx) {
    if (identity.isDocument(value))
      value = value.contents;
    if (identity.isNode(value))
      return value;
    if (identity.isPair(value)) {
      const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
      map.items.push(value);
      return map;
    }
    if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
      value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
    let ref = undefined;
    if (aliasDuplicateObjects && value && typeof value === "object") {
      ref = sourceObjects.get(value);
      if (ref) {
        ref.anchor ?? (ref.anchor = onAnchor(value));
        return new Alias.Alias(ref.anchor);
      } else {
        ref = { anchor: null, node: null };
        sourceObjects.set(value, ref);
      }
    }
    if (tagName?.startsWith("!!"))
      tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema.tags);
    if (!tagObj) {
      if (value && typeof value.toJSON === "function") {
        value = value.toJSON();
      }
      if (!value || typeof value !== "object") {
        const node2 = new Scalar.Scalar(value);
        if (ref)
          ref.node = node2;
        return node2;
      }
      tagObj = value instanceof Map ? schema[identity.MAP] : (Symbol.iterator in Object(value)) ? schema[identity.SEQ] : schema[identity.MAP];
    }
    if (onTagObj) {
      onTagObj(tagObj);
      delete ctx.onTagObj;
    }
    const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
    if (tagName)
      node.tag = tagName;
    else if (!tagObj.default)
      node.tag = tagObj.tag;
    if (ref)
      ref.node = node;
    return node;
  }
  exports.createNode = createNode;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS((exports) => {
  var createNode = require_createNode();
  var identity = require_identity();
  var Node = require_Node();
  function collectionFromPath(schema, path16, value) {
    let v3 = value;
    for (let i = path16.length - 1;i >= 0; --i) {
      const k3 = path16[i];
      if (typeof k3 === "number" && Number.isInteger(k3) && k3 >= 0) {
        const a3 = [];
        a3[k3] = v3;
        v3 = a3;
      } else {
        v3 = new Map([[k3, v3]]);
      }
    }
    return createNode.createNode(v3, undefined, {
      aliasDuplicateObjects: false,
      keepUndefined: false,
      onAnchor: () => {
        throw new Error("This should not happen, please report a bug.");
      },
      schema,
      sourceObjects: new Map
    });
  }
  var isEmptyPath = (path16) => path16 == null || typeof path16 === "object" && !!path16[Symbol.iterator]().next().done;

  class Collection extends Node.NodeBase {
    constructor(type, schema) {
      super(type);
      Object.defineProperty(this, "schema", {
        value: schema,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
    clone(schema) {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (schema)
        copy.schema = schema;
      copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    addIn(path16, value) {
      if (isEmptyPath(path16))
        this.add(value);
      else {
        const [key, ...rest] = path16;
        const node = this.get(key, true);
        if (identity.isCollection(node))
          node.addIn(rest, value);
        else if (node === undefined && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
    deleteIn(path16) {
      const [key, ...rest] = path16;
      if (rest.length === 0)
        return this.delete(key);
      const node = this.get(key, true);
      if (identity.isCollection(node))
        return node.deleteIn(rest);
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    getIn(path16, keepScalar) {
      const [key, ...rest] = path16;
      const node = this.get(key, true);
      if (rest.length === 0)
        return !keepScalar && identity.isScalar(node) ? node.value : node;
      else
        return identity.isCollection(node) ? node.getIn(rest, keepScalar) : undefined;
    }
    hasAllNullValues(allowScalar) {
      return this.items.every((node) => {
        if (!identity.isPair(node))
          return false;
        const n = node.value;
        return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
      });
    }
    hasIn(path16) {
      const [key, ...rest] = path16;
      if (rest.length === 0)
        return this.has(key);
      const node = this.get(key, true);
      return identity.isCollection(node) ? node.hasIn(rest) : false;
    }
    setIn(path16, value) {
      const [key, ...rest] = path16;
      if (rest.length === 0) {
        this.set(key, value);
      } else {
        const node = this.get(key, true);
        if (identity.isCollection(node))
          node.setIn(rest, value);
        else if (node === undefined && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
  }
  exports.Collection = Collection;
  exports.collectionFromPath = collectionFromPath;
  exports.isEmptyPath = isEmptyPath;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS((exports) => {
  var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
  function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
      return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
  }
  var lineComment = (str, indent, comment) => str.endsWith(`
`) ? indentComment(comment, indent) : comment.includes(`
`) ? `
` + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
  exports.indentComment = indentComment;
  exports.lineComment = lineComment;
  exports.stringifyComment = stringifyComment;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS((exports) => {
  var FOLD_FLOW = "flow";
  var FOLD_BLOCK = "block";
  var FOLD_QUOTED = "quoted";
  function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
      return text;
    if (lineWidth < minContentWidth)
      minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text.length <= endStep)
      return text;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === "number") {
      if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
        folds.push(0);
      else
        end = lineWidth - indentAtStart;
    }
    let split = undefined;
    let prev = undefined;
    let overflow = false;
    let i = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
      i = consumeMoreIndentedLines(text, i, indent.length);
      if (i !== -1)
        end = i + endStep;
    }
    for (let ch;ch = text[i += 1]; ) {
      if (mode === FOLD_QUOTED && ch === "\\") {
        escStart = i;
        switch (text[i + 1]) {
          case "x":
            i += 3;
            break;
          case "u":
            i += 5;
            break;
          case "U":
            i += 9;
            break;
          default:
            i += 1;
        }
        escEnd = i;
      }
      if (ch === `
`) {
        if (mode === FOLD_BLOCK)
          i = consumeMoreIndentedLines(text, i, indent.length);
        end = i + indent.length + endStep;
        split = undefined;
      } else {
        if (ch === " " && prev && prev !== " " && prev !== `
` && prev !== "\t") {
          const next = text[i + 1];
          if (next && next !== " " && next !== `
` && next !== "\t")
            split = i;
        }
        if (i >= end) {
          if (split) {
            folds.push(split);
            end = split + endStep;
            split = undefined;
          } else if (mode === FOLD_QUOTED) {
            while (prev === " " || prev === "\t") {
              prev = ch;
              ch = text[i += 1];
              overflow = true;
            }
            const j3 = i > escEnd + 1 ? i - 2 : escStart - 1;
            if (escapedFolds[j3])
              return text;
            folds.push(j3);
            escapedFolds[j3] = true;
            end = j3 + endStep;
            split = undefined;
          } else {
            overflow = true;
          }
        }
      }
      prev = ch;
    }
    if (overflow && onOverflow)
      onOverflow();
    if (folds.length === 0)
      return text;
    if (onFold)
      onFold();
    let res = text.slice(0, folds[0]);
    for (let i2 = 0;i2 < folds.length; ++i2) {
      const fold = folds[i2];
      const end2 = folds[i2 + 1] || text.length;
      if (fold === 0)
        res = `
${indent}${text.slice(0, end2)}`;
      else {
        if (mode === FOLD_QUOTED && escapedFolds[fold])
          res += `${text[fold]}\\`;
        res += `
${indent}${text.slice(fold + 1, end2)}`;
      }
    }
    return res;
  }
  function consumeMoreIndentedLines(text, i, indent) {
    let end = i;
    let start = i + 1;
    let ch = text[start];
    while (ch === " " || ch === "\t") {
      if (i < start + indent) {
        ch = text[++i];
      } else {
        do {
          ch = text[++i];
        } while (ch && ch !== `
`);
        end = i;
        start = i + 1;
        ch = text[start];
      }
    }
    return end;
  }
  exports.FOLD_BLOCK = FOLD_BLOCK;
  exports.FOLD_FLOW = FOLD_FLOW;
  exports.FOLD_QUOTED = FOLD_QUOTED;
  exports.foldFlowLines = foldFlowLines;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var foldFlowLines = require_foldFlowLines();
  var getFoldOptions = (ctx, isBlock) => ({
    indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
  });
  var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
  function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
      return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
      return false;
    for (let i = 0, start = 0;i < strLen; ++i) {
      if (str[i] === `
`) {
        if (i - start > limit)
          return true;
        start = i + 1;
        if (strLen - start <= limit)
          return false;
      }
    }
    return true;
  }
  function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
      return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    let str = "";
    let start = 0;
    for (let i = 0, ch = json[i];ch; ch = json[++i]) {
      if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
        str += json.slice(start, i) + "\\ ";
        i += 1;
        start = i;
        ch = "\\";
      }
      if (ch === "\\")
        switch (json[i + 1]) {
          case "u":
            {
              str += json.slice(start, i);
              const code = json.substr(i + 2, 4);
              switch (code) {
                case "0000":
                  str += "\\0";
                  break;
                case "0007":
                  str += "\\a";
                  break;
                case "000b":
                  str += "\\v";
                  break;
                case "001b":
                  str += "\\e";
                  break;
                case "0085":
                  str += "\\N";
                  break;
                case "00a0":
                  str += "\\_";
                  break;
                case "2028":
                  str += "\\L";
                  break;
                case "2029":
                  str += "\\P";
                  break;
                default:
                  if (code.substr(0, 2) === "00")
                    str += "\\x" + code.substr(2);
                  else
                    str += json.substr(i, 6);
              }
              i += 5;
              start = i + 1;
            }
            break;
          case "n":
            if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
              i += 1;
            } else {
              str += json.slice(start, i) + `

`;
              while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                str += `
`;
                i += 2;
              }
              str += indent;
              if (json[i + 2] === " ")
                str += "\\";
              i += 1;
              start = i + 1;
            }
            break;
          default:
            i += 1;
        }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
  }
  function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes(`
`) || /[ \t]\n|\n[ \t]/.test(value))
      return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
    return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
      qs = doubleQuotedString;
    else {
      const hasDouble = value.includes('"');
      const hasSingle = value.includes("'");
      if (hasDouble && !hasSingle)
        qs = singleQuotedString;
      else if (hasSingle && !hasDouble)
        qs = doubleQuotedString;
      else
        qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
  }
  var blockEndNewlines;
  try {
    blockEndNewlines = new RegExp(`(^|(?<!
))
+(?!
|$)`, "g");
  } catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
  }
  function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    if (!blockQuote || /\n[\t ]+$/.test(value)) {
      return quotedString(value, ctx);
    }
    const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
    const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
      return literal ? `|
` : `>
`;
    let chomp;
    let endStart;
    for (endStart = value.length;endStart > 0; --endStart) {
      const ch = value[endStart - 1];
      if (ch !== `
` && ch !== "\t" && ch !== " ")
        break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf(`
`);
    if (endNlPos === -1) {
      chomp = "-";
    } else if (value === end || endNlPos !== end.length - 1) {
      chomp = "+";
      if (onChompKeep)
        onChompKeep();
    } else {
      chomp = "";
    }
    if (end) {
      value = value.slice(0, -end.length);
      if (end[end.length - 1] === `
`)
        end = end.slice(0, -1);
      end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0;startEnd < value.length; ++startEnd) {
      const ch = value[startEnd];
      if (ch === " ")
        startWithSpace = true;
      else if (ch === `
`)
        startNlPos = startEnd;
      else
        break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
      value = value.substring(start.length);
      start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? "2" : "1";
    let header = (startWithSpace ? indentSize : "") + chomp;
    if (comment) {
      header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
      if (onComment)
        onComment();
    }
    if (!literal) {
      const foldedValue = value.replace(/\n+/g, `
$&`).replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
      let literalFallback = false;
      const foldOptions = getFoldOptions(ctx, true);
      if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
        foldOptions.onOverflow = () => {
          literalFallback = true;
        };
      }
      const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
      if (!literalFallback)
        return `>${header}
${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}
${indent}${start}${value}${end}`;
  }
  function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if (implicitKey && value.includes(`
`) || inFlow && /[[\]{},]/.test(value)) {
      return quotedString(value, ctx);
    }
    if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
      return implicitKey || inFlow || !value.includes(`
`) ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes(`
`)) {
      return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
      if (indent === "") {
        ctx.forceBlockIndent = true;
        return blockString(item, ctx, onComment, onChompKeep);
      } else if (implicitKey && indent === indentStep) {
        return quotedString(value, ctx);
      }
    }
    const str = value.replace(/\n+/g, `$&
${indent}`);
    if (actualString) {
      const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
      const { compat, tags } = ctx.doc.schema;
      if (tags.some(test) || compat?.some(test))
        return quotedString(value, ctx);
    }
    return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function stringifyString(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
      if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
        type = Scalar.Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
      switch (_type) {
        case Scalar.Scalar.BLOCK_FOLDED:
        case Scalar.Scalar.BLOCK_LITERAL:
          return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
        case Scalar.Scalar.QUOTE_DOUBLE:
          return doubleQuotedString(ss.value, ctx);
        case Scalar.Scalar.QUOTE_SINGLE:
          return singleQuotedString(ss.value, ctx);
        case Scalar.Scalar.PLAIN:
          return plainString(ss, ctx, onComment, onChompKeep);
        default:
          return null;
      }
    };
    let res = _stringify(type);
    if (res === null) {
      const { defaultKeyType, defaultStringType } = ctx.options;
      const t = implicitKey && defaultKeyType || defaultStringType;
      res = _stringify(t);
      if (res === null)
        throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
  }
  exports.stringifyString = stringifyString;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS((exports) => {
  var anchors = require_anchors();
  var identity = require_identity();
  var stringifyComment = require_stringifyComment();
  var stringifyString = require_stringifyString();
  function createStringifyContext(doc, options) {
    const opt = Object.assign({
      blockQuote: true,
      commentString: stringifyComment.stringifyComment,
      defaultKeyType: null,
      defaultStringType: "PLAIN",
      directives: null,
      doubleQuotedAsJSON: false,
      doubleQuotedMinMultiLineLength: 40,
      falseStr: "false",
      flowCollectionPadding: true,
      indentSeq: true,
      lineWidth: 80,
      minContentWidth: 20,
      nullStr: "null",
      simpleKeys: false,
      singleQuote: null,
      trailingComma: false,
      trueStr: "true",
      verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
      case "block":
        inFlow = false;
        break;
      case "flow":
        inFlow = true;
        break;
      default:
        inFlow = null;
    }
    return {
      anchors: new Set,
      doc,
      flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
      indent: "",
      indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
      inFlow,
      options: opt
    };
  }
  function getTagObject(tags, item) {
    if (item.tag) {
      const match = tags.filter((t) => t.tag === item.tag);
      if (match.length > 0)
        return match.find((t) => t.format === item.format) ?? match[0];
    }
    let tagObj = undefined;
    let obj;
    if (identity.isScalar(item)) {
      obj = item.value;
      let match = tags.filter((t) => t.identify?.(obj));
      if (match.length > 1) {
        const testMatch = match.filter((t) => t.test);
        if (testMatch.length > 0)
          match = testMatch;
      }
      tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
    } else {
      obj = item;
      tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
      const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
      throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
  }
  function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
    if (!doc.directives)
      return "";
    const props = [];
    const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
    if (anchor && anchors.anchorIsValid(anchor)) {
      anchors$1.add(anchor);
      props.push(`&${anchor}`);
    }
    const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
    if (tag)
      props.push(doc.directives.tagString(tag));
    return props.join(" ");
  }
  function stringify(item, ctx, onComment, onChompKeep) {
    if (identity.isPair(item))
      return item.toString(ctx, onComment, onChompKeep);
    if (identity.isAlias(item)) {
      if (ctx.doc.directives)
        return item.toString(ctx);
      if (ctx.resolvedAliases?.has(item)) {
        throw new TypeError(`Cannot stringify circular structure without alias nodes`);
      } else {
        if (ctx.resolvedAliases)
          ctx.resolvedAliases.add(item);
        else
          ctx.resolvedAliases = new Set([item]);
        item = item.resolve(ctx.doc);
      }
    }
    let tagObj = undefined;
    const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
    tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
      ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
    if (!props)
      return str;
    return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
  }
  exports.createStringifyContext = createStringifyContext;
  exports.stringify = stringify;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = identity.isNode(key) && key.comment || null;
    if (simpleKeys) {
      if (keyComment) {
        throw new Error("With simple keys, key nodes cannot have comments");
      }
      if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
        const msg = "With simple keys, collection cannot be used as a key value";
        throw new Error(msg);
      }
    }
    let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
    ctx = Object.assign({}, ctx, {
      allNullValues: false,
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
      if (simpleKeys)
        throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
      explicitKey = true;
    }
    if (ctx.inFlow) {
      if (allNullValues || value == null) {
        if (keyCommentDone && onComment)
          onComment();
        return str === "" ? "?" : explicitKey ? `? ${str}` : str;
      }
    } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
      str = `? ${str}`;
      if (keyComment && !keyCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    if (keyCommentDone)
      keyComment = null;
    if (explicitKey) {
      if (keyComment)
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      str = `? ${str}
${indent}:`;
    } else {
      str = `${str}:`;
      if (keyComment)
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (identity.isNode(value)) {
      vsb = !!value.spaceBefore;
      vcb = value.commentBefore;
      valueComment = value.comment;
    } else {
      vsb = false;
      vcb = null;
      valueComment = null;
      if (value && typeof value === "object")
        value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && identity.isScalar(value))
      ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
      ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
    let ws = " ";
    if (keyComment || vsb || vcb) {
      ws = vsb ? `
` : "";
      if (vcb) {
        const cs = commentString(vcb);
        ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
      }
      if (valueStr === "" && !ctx.inFlow) {
        if (ws === `
` && valueComment)
          ws = `

`;
      } else {
        ws += `
${ctx.indent}`;
      }
    } else if (!explicitKey && identity.isCollection(value)) {
      const vs0 = valueStr[0];
      const nl0 = valueStr.indexOf(`
`);
      const hasNewline = nl0 !== -1;
      const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
      if (hasNewline || !flow) {
        let hasPropsLine = false;
        if (hasNewline && (vs0 === "&" || vs0 === "!")) {
          let sp0 = valueStr.indexOf(" ");
          if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
            sp0 = valueStr.indexOf(" ", sp0 + 1);
          }
          if (sp0 === -1 || nl0 < sp0)
            hasPropsLine = true;
        }
        if (!hasPropsLine)
          ws = `
${ctx.indent}`;
      }
    } else if (valueStr === "" || valueStr[0] === `
`) {
      ws = "";
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
      if (valueCommentDone && onComment)
        onComment();
    } else if (valueComment && !valueCommentDone) {
      str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
    } else if (chompKeep && onChompKeep) {
      onChompKeep();
    }
    return str;
  }
  exports.stringifyPair = stringifyPair;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/log.js
var require_log = __commonJS((exports) => {
  var node_process = __require("process");
  function debug2(logLevel, ...messages) {
    if (logLevel === "debug")
      console.log(...messages);
  }
  function warn(logLevel, warning) {
    if (logLevel === "debug" || logLevel === "warn") {
      if (typeof node_process.emitWarning === "function")
        node_process.emitWarning(warning);
      else
        console.warn(warning);
    }
  }
  exports.debug = debug2;
  exports.warn = warn;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var MERGE_KEY = "<<";
  var merge = {
    identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
    default: "key",
    tag: "tag:yaml.org,2002:merge",
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
      addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
  };
  var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
  function addMergeToJSMap(ctx, map, value) {
    const source = resolveAliasValue(ctx, value);
    if (identity.isSeq(source))
      for (const it of source.items)
        mergeValue(ctx, map, it);
    else if (Array.isArray(source))
      for (const it of source)
        mergeValue(ctx, map, it);
    else
      mergeValue(ctx, map, source);
  }
  function mergeValue(ctx, map, value) {
    const source = resolveAliasValue(ctx, value);
    if (!identity.isMap(source))
      throw new Error("Merge sources must be maps or map aliases");
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value2] of srcMap) {
      if (map instanceof Map) {
        if (!map.has(key))
          map.set(key, value2);
      } else if (map instanceof Set) {
        map.add(key);
      } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
        Object.defineProperty(map, key, {
          value: value2,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return map;
  }
  function resolveAliasValue(ctx, value) {
    return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
  }
  exports.addMergeToJSMap = addMergeToJSMap;
  exports.isMergeKey = isMergeKey;
  exports.merge = merge;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS((exports) => {
  var log = require_log();
  var merge = require_merge();
  var stringify = require_stringify();
  var identity = require_identity();
  var toJS = require_toJS();
  function addPairToJSMap(ctx, map, { key, value }) {
    if (identity.isNode(key) && key.addToJSMap)
      key.addToJSMap(ctx, map, value);
    else if (merge.isMergeKey(ctx, key))
      merge.addMergeToJSMap(ctx, map, value);
    else {
      const jsKey = toJS.toJS(key, "", ctx);
      if (map instanceof Map) {
        map.set(jsKey, toJS.toJS(value, jsKey, ctx));
      } else if (map instanceof Set) {
        map.add(jsKey);
      } else {
        const stringKey = stringifyKey(key, jsKey, ctx);
        const jsValue = toJS.toJS(value, stringKey, ctx);
        if (stringKey in map)
          Object.defineProperty(map, stringKey, {
            value: jsValue,
            writable: true,
            enumerable: true,
            configurable: true
          });
        else
          map[stringKey] = jsValue;
      }
    }
    return map;
  }
  function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
      return "";
    if (typeof jsKey !== "object")
      return String(jsKey);
    if (identity.isNode(key) && ctx?.doc) {
      const strCtx = stringify.createStringifyContext(ctx.doc, {});
      strCtx.anchors = new Set;
      for (const node of ctx.anchors.keys())
        strCtx.anchors.add(node.anchor);
      strCtx.inFlow = true;
      strCtx.inStringifyKey = true;
      const strKey = key.toString(strCtx);
      if (!ctx.mapKeyWarned) {
        let jsonStr = JSON.stringify(strKey);
        if (jsonStr.length > 40)
          jsonStr = jsonStr.substring(0, 36) + '..."';
        log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
        ctx.mapKeyWarned = true;
      }
      return strKey;
    }
    return JSON.stringify(jsKey);
  }
  exports.addPairToJSMap = addPairToJSMap;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS((exports) => {
  var createNode = require_createNode();
  var stringifyPair = require_stringifyPair();
  var addPairToJSMap = require_addPairToJSMap();
  var identity = require_identity();
  function createPair(key, value, ctx) {
    const k3 = createNode.createNode(key, undefined, ctx);
    const v3 = createNode.createNode(value, undefined, ctx);
    return new Pair(k3, v3);
  }

  class Pair {
    constructor(key, value = null) {
      Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
      this.key = key;
      this.value = value;
    }
    clone(schema) {
      let { key, value } = this;
      if (identity.isNode(key))
        key = key.clone(schema);
      if (identity.isNode(value))
        value = value.clone(schema);
      return new Pair(key, value);
    }
    toJSON(_3, ctx) {
      const pair = ctx?.mapAsMap ? new Map : {};
      return addPairToJSMap.addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
      return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
    }
  }
  exports.Pair = Pair;
  exports.createPair = createPair;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS((exports) => {
  var identity = require_identity();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyCollection(collection, ctx, options) {
    const flow = ctx.inFlow ?? collection.flow;
    const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify2(collection, ctx, options);
  }
  function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false;
    const lines = [];
    for (let i = 0;i < items.length; ++i) {
      const item = items[i];
      let comment2 = null;
      if (identity.isNode(item)) {
        if (!chompKeep && item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
        if (item.comment)
          comment2 = item.comment;
      } else if (identity.isPair(item)) {
        const ik = identity.isNode(item.key) ? item.key : null;
        if (ik) {
          if (!chompKeep && ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
        }
      }
      chompKeep = false;
      let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
      if (comment2)
        str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
      if (chompKeep && comment2)
        chompKeep = false;
      lines.push(blockItemPrefix + str2);
    }
    let str;
    if (lines.length === 0) {
      str = flowChars.start + flowChars.end;
    } else {
      str = lines[0];
      for (let i = 1;i < lines.length; ++i) {
        const line = lines[i];
        str += line ? `
${indent}${line}` : `
`;
      }
    }
    if (comment) {
      str += `
` + stringifyComment.indentComment(commentString(comment), indent);
      if (onComment)
        onComment();
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
      indent: itemIndent,
      inFlow: true,
      type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i = 0;i < items.length; ++i) {
      const item = items[i];
      let comment = null;
      if (identity.isNode(item)) {
        if (item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, false);
        if (item.comment)
          comment = item.comment;
      } else if (identity.isPair(item)) {
        const ik = identity.isNode(item.key) ? item.key : null;
        if (ik) {
          if (ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, false);
          if (ik.comment)
            reqNewline = true;
        }
        const iv = identity.isNode(item.value) ? item.value : null;
        if (iv) {
          if (iv.comment)
            comment = iv.comment;
          if (iv.commentBefore)
            reqNewline = true;
        } else if (item.value == null && ik?.comment) {
          comment = ik.comment;
        }
      }
      if (comment)
        reqNewline = true;
      let str = stringify.stringify(item, itemCtx, () => comment = null);
      reqNewline || (reqNewline = lines.length > linesAtValue || str.includes(`
`));
      if (i < items.length - 1) {
        str += ",";
      } else if (ctx.options.trailingComma) {
        if (ctx.options.lineWidth > 0) {
          reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
        }
        if (reqNewline) {
          str += ",";
        }
      }
      if (comment)
        str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
      lines.push(str);
      linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
      return start + end;
    } else {
      if (!reqNewline) {
        const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
        reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
      }
      if (reqNewline) {
        let str = start;
        for (const line of lines)
          str += line ? `
${indentStep}${indent}${line}` : `
`;
        return `${str}
${indent}${end}`;
      } else {
        return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
      }
    }
  }
  function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
      comment = comment.replace(/^\n+/, "");
    if (comment) {
      const ic = stringifyComment.indentComment(commentString(comment), indent);
      lines.push(ic.trimStart());
    }
  }
  exports.stringifyCollection = stringifyCollection;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS((exports) => {
  var stringifyCollection = require_stringifyCollection();
  var addPairToJSMap = require_addPairToJSMap();
  var Collection = require_Collection();
  var identity = require_identity();
  var Pair = require_Pair();
  var Scalar = require_Scalar();
  function findPair(items, key) {
    const k3 = identity.isScalar(key) ? key.value : key;
    for (const it of items) {
      if (identity.isPair(it)) {
        if (it.key === key || it.key === k3)
          return it;
        if (identity.isScalar(it.key) && it.key.value === k3)
          return it;
      }
    }
    return;
  }

  class YAMLMap extends Collection.Collection {
    static get tagName() {
      return "tag:yaml.org,2002:map";
    }
    constructor(schema) {
      super(identity.MAP, schema);
      this.items = [];
    }
    static from(schema, obj, ctx) {
      const { keepUndefined, replacer } = ctx;
      const map = new this(schema);
      const add = (key, value) => {
        if (typeof replacer === "function")
          value = replacer.call(obj, key, value);
        else if (Array.isArray(replacer) && !replacer.includes(key))
          return;
        if (value !== undefined || keepUndefined)
          map.items.push(Pair.createPair(key, value, ctx));
      };
      if (obj instanceof Map) {
        for (const [key, value] of obj)
          add(key, value);
      } else if (obj && typeof obj === "object") {
        for (const key of Object.keys(obj))
          add(key, obj[key]);
      }
      if (typeof schema.sortMapEntries === "function") {
        map.items.sort(schema.sortMapEntries);
      }
      return map;
    }
    add(pair, overwrite) {
      let _pair;
      if (identity.isPair(pair))
        _pair = pair;
      else if (!pair || typeof pair !== "object" || !("key" in pair)) {
        _pair = new Pair.Pair(pair, pair?.value);
      } else
        _pair = new Pair.Pair(pair.key, pair.value);
      const prev = findPair(this.items, _pair.key);
      const sortEntries = this.schema?.sortMapEntries;
      if (prev) {
        if (!overwrite)
          throw new Error(`Key ${_pair.key} already set`);
        if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
          prev.value.value = _pair.value;
        else
          prev.value = _pair.value;
      } else if (sortEntries) {
        const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
        if (i === -1)
          this.items.push(_pair);
        else
          this.items.splice(i, 0, _pair);
      } else {
        this.items.push(_pair);
      }
    }
    delete(key) {
      const it = findPair(this.items, key);
      if (!it)
        return false;
      const del = this.items.splice(this.items.indexOf(it), 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const it = findPair(this.items, key);
      const node = it?.value;
      return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? undefined;
    }
    has(key) {
      return !!findPair(this.items, key);
    }
    set(key, value) {
      this.add(new Pair.Pair(key, value), true);
    }
    toJSON(_3, ctx, Type) {
      const map = Type ? new Type : ctx?.mapAsMap ? new Map : {};
      if (ctx?.onCreate)
        ctx.onCreate(map);
      for (const item of this.items)
        addPairToJSMap.addPairToJSMap(ctx, map, item);
      return map;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      for (const item of this.items) {
        if (!identity.isPair(item))
          throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
      }
      if (!ctx.allNullValues && this.hasAllNullValues(false))
        ctx = Object.assign({}, ctx, { allNullValues: true });
      return stringifyCollection.stringifyCollection(this, ctx, {
        blockItemPrefix: "",
        flowChars: { start: "{", end: "}" },
        itemIndent: ctx.indent || "",
        onChompKeep,
        onComment
      });
    }
  }
  exports.YAMLMap = YAMLMap;
  exports.findPair = findPair;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS((exports) => {
  var identity = require_identity();
  var YAMLMap = require_YAMLMap();
  var map = {
    collection: "map",
    default: true,
    nodeClass: YAMLMap.YAMLMap,
    tag: "tag:yaml.org,2002:map",
    resolve(map2, onError) {
      if (!identity.isMap(map2))
        onError("Expected a mapping for this tag");
      return map2;
    },
    createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
  };
  exports.map = map;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS((exports) => {
  var createNode = require_createNode();
  var stringifyCollection = require_stringifyCollection();
  var Collection = require_Collection();
  var identity = require_identity();
  var Scalar = require_Scalar();
  var toJS = require_toJS();

  class YAMLSeq extends Collection.Collection {
    static get tagName() {
      return "tag:yaml.org,2002:seq";
    }
    constructor(schema) {
      super(identity.SEQ, schema);
      this.items = [];
    }
    add(value) {
      this.items.push(value);
    }
    delete(key) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return false;
      const del = this.items.splice(idx, 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return;
      const it = this.items[idx];
      return !keepScalar && identity.isScalar(it) ? it.value : it;
    }
    has(key) {
      const idx = asItemIndex(key);
      return typeof idx === "number" && idx < this.items.length;
    }
    set(key, value) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        throw new Error(`Expected a valid index, not ${key}.`);
      const prev = this.items[idx];
      if (identity.isScalar(prev) && Scalar.isScalarValue(value))
        prev.value = value;
      else
        this.items[idx] = value;
    }
    toJSON(_3, ctx) {
      const seq = [];
      if (ctx?.onCreate)
        ctx.onCreate(seq);
      let i = 0;
      for (const item of this.items)
        seq.push(toJS.toJS(item, String(i++), ctx));
      return seq;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      return stringifyCollection.stringifyCollection(this, ctx, {
        blockItemPrefix: "- ",
        flowChars: { start: "[", end: "]" },
        itemIndent: (ctx.indent || "") + "  ",
        onChompKeep,
        onComment
      });
    }
    static from(schema, obj, ctx) {
      const { replacer } = ctx;
      const seq = new this(schema);
      if (obj && Symbol.iterator in Object(obj)) {
        let i = 0;
        for (let it of obj) {
          if (typeof replacer === "function") {
            const key = obj instanceof Set ? it : String(i++);
            it = replacer.call(obj, key, it);
          }
          seq.items.push(createNode.createNode(it, undefined, ctx));
        }
      }
      return seq;
    }
  }
  function asItemIndex(key) {
    let idx = identity.isScalar(key) ? key.value : key;
    if (idx && typeof idx === "string")
      idx = Number(idx);
    return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
  }
  exports.YAMLSeq = YAMLSeq;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS((exports) => {
  var identity = require_identity();
  var YAMLSeq = require_YAMLSeq();
  var seq = {
    collection: "seq",
    default: true,
    nodeClass: YAMLSeq.YAMLSeq,
    tag: "tag:yaml.org,2002:seq",
    resolve(seq2, onError) {
      if (!identity.isSeq(seq2))
        onError("Expected a sequence for this tag");
      return seq2;
    },
    createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
  };
  exports.seq = seq;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS((exports) => {
  var stringifyString = require_stringifyString();
  var string = {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify(item, ctx, onComment, onChompKeep) {
      ctx = Object.assign({ actualString: true }, ctx);
      return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
    }
  };
  exports.string = string;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var nullTag = {
    identify: (value) => value == null,
    createNode: () => new Scalar.Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar.Scalar(null),
    stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
  };
  exports.nullTag = nullTag;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var boolTag = {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
    stringify({ source, value }, ctx) {
      if (source && boolTag.test.test(source)) {
        const sv = source[0] === "t" || source[0] === "T";
        if (value === sv)
          return source;
      }
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
  };
  exports.boolTag = boolTag;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS((exports) => {
  function stringifyNumber({ format, minFractionDigits, tag, value }) {
    if (typeof value === "bigint")
      return String(value);
    const num = typeof value === "number" ? value : Number(value);
    if (!isFinite(num))
      return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
    let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
    if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
      let i = n.indexOf(".");
      if (i < 0) {
        i = n.length;
        n += ".";
      }
      let d2 = minFractionDigits - (n.length - i - 1);
      while (d2-- > 0)
        n += "0";
    }
    return n;
  }
  exports.stringifyNumber = stringifyNumber;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var stringifyNumber = require_stringifyNumber();
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
      const node = new Scalar.Scalar(parseFloat(str));
      const dot = str.indexOf(".");
      if (dot !== -1 && str[str.length - 1] === "0")
        node.minFractionDigits = str.length - dot - 1;
      return node;
    },
    stringify: stringifyNumber.stringifyNumber
  };
  exports.float = float;
  exports.floatExp = floatExp;
  exports.floatNaN = floatNaN;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
      return prefix + value.toString(radix);
    return stringifyNumber.stringifyNumber(node);
  }
  var intOct = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: (node) => intStringify(node, 8, "0o")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
  };
  var intHex = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  exports.int = int;
  exports.intHex = intHex;
  exports.intOct = intOct;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var bool = require_bool();
  var float = require_float();
  var int = require_int();
  var schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.boolTag,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float
  ];
  exports.schema = schema;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var map = require_map();
  var seq = require_seq();
  function intIdentify(value) {
    return typeof value === "bigint" || Number.isInteger(value);
  }
  var stringifyJSON = ({ value }) => JSON.stringify(value);
  var jsonScalars = [
    {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify: stringifyJSON
    },
    {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^null$/,
      resolve: () => null,
      stringify: stringifyJSON
    },
    {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^true$|^false$/,
      resolve: (str) => str === "true",
      stringify: stringifyJSON
    },
    {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^-?(?:0|[1-9][0-9]*)$/,
      resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
      stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
    },
    {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
      resolve: (str) => parseFloat(str),
      stringify: stringifyJSON
    }
  ];
  var jsonError = {
    default: true,
    tag: "",
    test: /^/,
    resolve(str, onError) {
      onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
      return str;
    }
  };
  var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
  exports.schema = schema;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS((exports) => {
  var node_buffer = __require("buffer");
  var Scalar = require_Scalar();
  var stringifyString = require_stringifyString();
  var binary = {
    identify: (value) => value instanceof Uint8Array,
    default: false,
    tag: "tag:yaml.org,2002:binary",
    resolve(src, onError) {
      if (typeof node_buffer.Buffer === "function") {
        return node_buffer.Buffer.from(src, "base64");
      } else if (typeof atob === "function") {
        const str = atob(src.replace(/[\n\r]/g, ""));
        const buffer = new Uint8Array(str.length);
        for (let i = 0;i < str.length; ++i)
          buffer[i] = str.charCodeAt(i);
        return buffer;
      } else {
        onError("This environment does not support reading binary tags; either Buffer or atob is required");
        return src;
      }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
      if (!value)
        return "";
      const buf = value;
      let str;
      if (typeof node_buffer.Buffer === "function") {
        str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
      } else if (typeof btoa === "function") {
        let s = "";
        for (let i = 0;i < buf.length; ++i)
          s += String.fromCharCode(buf[i]);
        str = btoa(s);
      } else {
        throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
      }
      type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
        const n = Math.ceil(str.length / lineWidth);
        const lines = new Array(n);
        for (let i = 0, o = 0;i < n; ++i, o += lineWidth) {
          lines[i] = str.substr(o, lineWidth);
        }
        str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? `
` : " ");
      }
      return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
  };
  exports.binary = binary;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var Scalar = require_Scalar();
  var YAMLSeq = require_YAMLSeq();
  function resolvePairs(seq, onError) {
    if (identity.isSeq(seq)) {
      for (let i = 0;i < seq.items.length; ++i) {
        let item = seq.items[i];
        if (identity.isPair(item))
          continue;
        else if (identity.isMap(item)) {
          if (item.items.length > 1)
            onError("Each pair must have its own sequence indicator");
          const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
          if (item.commentBefore)
            pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
          if (item.comment) {
            const cn = pair.value ?? pair.key;
            cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
          }
          item = pair;
        }
        seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
      }
    } else
      onError("Expected a sequence for this tag");
    return seq;
  }
  function createPairs(schema, iterable, ctx) {
    const { replacer } = ctx;
    const pairs2 = new YAMLSeq.YAMLSeq(schema);
    pairs2.tag = "tag:yaml.org,2002:pairs";
    let i = 0;
    if (iterable && Symbol.iterator in Object(iterable))
      for (let it of iterable) {
        if (typeof replacer === "function")
          it = replacer.call(iterable, String(i++), it);
        let key, value;
        if (Array.isArray(it)) {
          if (it.length === 2) {
            key = it[0];
            value = it[1];
          } else
            throw new TypeError(`Expected [key, value] tuple: ${it}`);
        } else if (it && it instanceof Object) {
          const keys = Object.keys(it);
          if (keys.length === 1) {
            key = keys[0];
            value = it[key];
          } else {
            throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
          }
        } else {
          key = it;
        }
        pairs2.items.push(Pair.createPair(key, value, ctx));
      }
    return pairs2;
  }
  var pairs = {
    collection: "seq",
    default: false,
    tag: "tag:yaml.org,2002:pairs",
    resolve: resolvePairs,
    createNode: createPairs
  };
  exports.createPairs = createPairs;
  exports.pairs = pairs;
  exports.resolvePairs = resolvePairs;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS((exports) => {
  var identity = require_identity();
  var toJS = require_toJS();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var pairs = require_pairs();

  class YAMLOMap extends YAMLSeq.YAMLSeq {
    constructor() {
      super();
      this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
      this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
      this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
      this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
      this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
      this.tag = YAMLOMap.tag;
    }
    toJSON(_3, ctx) {
      if (!ctx)
        return super.toJSON(_3);
      const map = new Map;
      if (ctx?.onCreate)
        ctx.onCreate(map);
      for (const pair of this.items) {
        let key, value;
        if (identity.isPair(pair)) {
          key = toJS.toJS(pair.key, "", ctx);
          value = toJS.toJS(pair.value, key, ctx);
        } else {
          key = toJS.toJS(pair, "", ctx);
        }
        if (map.has(key))
          throw new Error("Ordered maps must not include duplicate keys");
        map.set(key, value);
      }
      return map;
    }
    static from(schema, iterable, ctx) {
      const pairs$1 = pairs.createPairs(schema, iterable, ctx);
      const omap2 = new this;
      omap2.items = pairs$1.items;
      return omap2;
    }
  }
  YAMLOMap.tag = "tag:yaml.org,2002:omap";
  var omap = {
    collection: "seq",
    identify: (value) => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: "tag:yaml.org,2002:omap",
    resolve(seq, onError) {
      const pairs$1 = pairs.resolvePairs(seq, onError);
      const seenKeys = [];
      for (const { key } of pairs$1.items) {
        if (identity.isScalar(key)) {
          if (seenKeys.includes(key.value)) {
            onError(`Ordered maps must not include duplicate keys: ${key.value}`);
          } else {
            seenKeys.push(key.value);
          }
        }
      }
      return Object.assign(new YAMLOMap, pairs$1);
    },
    createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
  };
  exports.YAMLOMap = YAMLOMap;
  exports.omap = omap;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
      return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
  var trueTag = {
    identify: (value) => value === true,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar.Scalar(true),
    stringify: boolStringify
  };
  var falseTag = {
    identify: (value) => value === false,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar.Scalar(false),
    stringify: boolStringify
  };
  exports.falseTag = falseTag;
  exports.trueTag = trueTag;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var stringifyNumber = require_stringifyNumber();
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, "")),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
      const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
      const dot = str.indexOf(".");
      if (dot !== -1) {
        const f2 = str.substring(dot + 1).replace(/_/g, "");
        if (f2[f2.length - 1] === "0")
          node.minFractionDigits = f2.length;
      }
      return node;
    },
    stringify: stringifyNumber.stringifyNumber
  };
  exports.float = float;
  exports.floatExp = floatExp;
  exports.floatNaN = floatNaN;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  function intResolve(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === "-" || sign === "+")
      offset += 1;
    str = str.substring(offset).replace(/_/g, "");
    if (intAsBigInt) {
      switch (radix) {
        case 2:
          str = `0b${str}`;
          break;
        case 8:
          str = `0o${str}`;
          break;
        case 16:
          str = `0x${str}`;
          break;
      }
      const n2 = BigInt(str);
      return sign === "-" ? BigInt(-1) * n2 : n2;
    }
    const n = parseInt(str, radix);
    return sign === "-" ? -1 * n : n;
  }
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value)) {
      const str = value.toString(radix);
      return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber.stringifyNumber(node);
  }
  var intBin = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "BIN",
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
    stringify: (node) => intStringify(node, 2, "0b")
  };
  var intOct = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
    stringify: (node) => intStringify(node, 8, "0")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
  };
  var intHex = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  exports.int = int;
  exports.intBin = intBin;
  exports.intHex = intHex;
  exports.intOct = intOct;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();

  class YAMLSet extends YAMLMap.YAMLMap {
    constructor(schema) {
      super(schema);
      this.tag = YAMLSet.tag;
    }
    add(key) {
      let pair;
      if (identity.isPair(key))
        pair = key;
      else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
        pair = new Pair.Pair(key.key, null);
      else
        pair = new Pair.Pair(key, null);
      const prev = YAMLMap.findPair(this.items, pair.key);
      if (!prev)
        this.items.push(pair);
    }
    get(key, keepPair) {
      const pair = YAMLMap.findPair(this.items, key);
      return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
    }
    set(key, value) {
      if (typeof value !== "boolean")
        throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
      const prev = YAMLMap.findPair(this.items, key);
      if (prev && !value) {
        this.items.splice(this.items.indexOf(prev), 1);
      } else if (!prev && value) {
        this.items.push(new Pair.Pair(key));
      }
    }
    toJSON(_3, ctx) {
      return super.toJSON(_3, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      if (this.hasAllNullValues(true))
        return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
      else
        throw new Error("Set items must all have null values");
    }
    static from(schema, iterable, ctx) {
      const { replacer } = ctx;
      const set2 = new this(schema);
      if (iterable && Symbol.iterator in Object(iterable))
        for (let value of iterable) {
          if (typeof replacer === "function")
            value = replacer.call(iterable, value, value);
          set2.items.push(Pair.createPair(value, null, ctx));
        }
      return set2;
    }
  }
  YAMLSet.tag = "tag:yaml.org,2002:set";
  var set = {
    collection: "map",
    identify: (value) => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: "tag:yaml.org,2002:set",
    createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
    resolve(map, onError) {
      if (identity.isMap(map)) {
        if (map.hasAllNullValues(true))
          return Object.assign(new YAMLSet, map);
        else
          onError("Set items must all have null values");
      } else
        onError("Expected a mapping for this tag");
      return map;
    }
  };
  exports.YAMLSet = YAMLSet;
  exports.set = set;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
    const num = (n) => asBigInt ? BigInt(n) : Number(n);
    const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
    return sign === "-" ? num(-1) * res : res;
  }
  function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n) => n;
    if (typeof value === "bigint")
      num = (n) => BigInt(n);
    else if (isNaN(value) || !isFinite(value))
      return stringifyNumber.stringifyNumber(node);
    let sign = "";
    if (value < 0) {
      sign = "-";
      value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60];
    if (value < 60) {
      parts.unshift(0);
    } else {
      value = (value - parts[0]) / _60;
      parts.unshift(value % _60);
      if (value >= 60) {
        value = (value - parts[0]) / _60;
        parts.unshift(value);
      }
    }
    return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
  }
  var intTime = {
    identify: (value) => typeof value === "bigint" || Number.isInteger(value),
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
  };
  var floatTime = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: (str) => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
  };
  var timestamp = {
    identify: (value) => value instanceof Date,
    default: true,
    tag: "tag:yaml.org,2002:timestamp",
    test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})" + "(?:" + "(?:t|T|[ \\t]+)" + "([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)" + "(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?" + ")?$"),
    resolve(str) {
      const match = str.match(timestamp.test);
      if (!match)
        throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
      const [, year, month, day, hour, minute, second] = match.map(Number);
      const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
      let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
      const tz = match[8];
      if (tz && tz !== "Z") {
        let d2 = parseSexagesimal(tz, false);
        if (Math.abs(d2) < 30)
          d2 *= 60;
        date -= 60000 * d2;
      }
      return new Date(date);
    },
    stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
  };
  exports.floatTime = floatTime;
  exports.intTime = intTime;
  exports.timestamp = timestamp;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var binary = require_binary();
  var bool = require_bool2();
  var float = require_float2();
  var int = require_int2();
  var merge = require_merge();
  var omap = require_omap();
  var pairs = require_pairs();
  var set = require_set();
  var timestamp = require_timestamp();
  var schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.trueTag,
    bool.falseTag,
    int.intBin,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float,
    binary.binary,
    merge.merge,
    omap.omap,
    pairs.pairs,
    set.set,
    timestamp.intTime,
    timestamp.floatTime,
    timestamp.timestamp
  ];
  exports.schema = schema;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var bool = require_bool();
  var float = require_float();
  var int = require_int();
  var schema = require_schema();
  var schema$1 = require_schema2();
  var binary = require_binary();
  var merge = require_merge();
  var omap = require_omap();
  var pairs = require_pairs();
  var schema$2 = require_schema3();
  var set = require_set();
  var timestamp = require_timestamp();
  var schemas = new Map([
    ["core", schema.schema],
    ["failsafe", [map.map, seq.seq, string.string]],
    ["json", schema$1.schema],
    ["yaml11", schema$2.schema],
    ["yaml-1.1", schema$2.schema]
  ]);
  var tagsByName = {
    binary: binary.binary,
    bool: bool.boolTag,
    float: float.float,
    floatExp: float.floatExp,
    floatNaN: float.floatNaN,
    floatTime: timestamp.floatTime,
    int: int.int,
    intHex: int.intHex,
    intOct: int.intOct,
    intTime: timestamp.intTime,
    map: map.map,
    merge: merge.merge,
    null: _null.nullTag,
    omap: omap.omap,
    pairs: pairs.pairs,
    seq: seq.seq,
    set: set.set,
    timestamp: timestamp.timestamp
  };
  var coreKnownTags = {
    "tag:yaml.org,2002:binary": binary.binary,
    "tag:yaml.org,2002:merge": merge.merge,
    "tag:yaml.org,2002:omap": omap.omap,
    "tag:yaml.org,2002:pairs": pairs.pairs,
    "tag:yaml.org,2002:set": set.set,
    "tag:yaml.org,2002:timestamp": timestamp.timestamp
  };
  function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
      return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
      if (Array.isArray(customTags))
        tags = [];
      else {
        const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
      }
    }
    if (Array.isArray(customTags)) {
      for (const tag of customTags)
        tags = tags.concat(tag);
    } else if (typeof customTags === "function") {
      tags = customTags(tags.slice());
    }
    if (addMergeTag)
      tags = tags.concat(merge.merge);
    return tags.reduce((tags2, tag) => {
      const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
      if (!tagObj) {
        const tagName = JSON.stringify(tag);
        const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
      }
      if (!tags2.includes(tagObj))
        tags2.push(tagObj);
      return tags2;
    }, []);
  }
  exports.coreKnownTags = coreKnownTags;
  exports.getTags = getTags;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS((exports) => {
  var identity = require_identity();
  var map = require_map();
  var seq = require_seq();
  var string = require_string();
  var tags = require_tags();
  var sortMapEntriesByKey = (a3, b3) => a3.key < b3.key ? -1 : a3.key > b3.key ? 1 : 0;

  class Schema {
    constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
      this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
      this.name = typeof schema === "string" && schema || "core";
      this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
      this.tags = tags.getTags(customTags, this.name, merge);
      this.toStringOptions = toStringDefaults ?? null;
      Object.defineProperty(this, identity.MAP, { value: map.map });
      Object.defineProperty(this, identity.SCALAR, { value: string.string });
      Object.defineProperty(this, identity.SEQ, { value: seq.seq });
      this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
    }
    clone() {
      const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
      copy.tags = this.tags.slice();
      return copy;
    }
  }
  exports.Schema = Schema;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS((exports) => {
  var identity = require_identity();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyDocument(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
      const dir = doc.directives.toString(doc);
      if (dir) {
        lines.push(dir);
        hasDirectives = true;
      } else if (doc.directives.docStart)
        hasDirectives = true;
    }
    if (hasDirectives)
      lines.push("---");
    const ctx = stringify.createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
      if (lines.length !== 1)
        lines.unshift("");
      const cs = commentString(doc.commentBefore);
      lines.unshift(stringifyComment.indentComment(cs, ""));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
      if (identity.isNode(doc.contents)) {
        if (doc.contents.spaceBefore && hasDirectives)
          lines.push("");
        if (doc.contents.commentBefore) {
          const cs = commentString(doc.contents.commentBefore);
          lines.push(stringifyComment.indentComment(cs, ""));
        }
        ctx.forceBlockIndent = !!doc.comment;
        contentComment = doc.contents.comment;
      }
      const onChompKeep = contentComment ? undefined : () => chompKeep = true;
      let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
      if (contentComment)
        body += stringifyComment.lineComment(body, "", commentString(contentComment));
      if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
        lines[lines.length - 1] = `--- ${body}`;
      } else
        lines.push(body);
    } else {
      lines.push(stringify.stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
      if (doc.comment) {
        const cs = commentString(doc.comment);
        if (cs.includes(`
`)) {
          lines.push("...");
          lines.push(stringifyComment.indentComment(cs, ""));
        } else {
          lines.push(`... ${cs}`);
        }
      } else {
        lines.push("...");
      }
    } else {
      let dc = doc.comment;
      if (dc && chompKeep)
        dc = dc.replace(/^\n+/, "");
      if (dc) {
        if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
          lines.push("");
        lines.push(stringifyComment.indentComment(commentString(dc), ""));
      }
    }
    return lines.join(`
`) + `
`;
  }
  exports.stringifyDocument = stringifyDocument;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS((exports) => {
  var Alias = require_Alias();
  var Collection = require_Collection();
  var identity = require_identity();
  var Pair = require_Pair();
  var toJS = require_toJS();
  var Schema = require_Schema();
  var stringifyDocument = require_stringifyDocument();
  var anchors = require_anchors();
  var applyReviver = require_applyReviver();
  var createNode = require_createNode();
  var directives = require_directives();

  class Document {
    constructor(value, replacer, options) {
      this.commentBefore = null;
      this.comment = null;
      this.errors = [];
      this.warnings = [];
      Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === undefined && replacer) {
        options = replacer;
        replacer = undefined;
      }
      const opt = Object.assign({
        intAsBigInt: false,
        keepSourceTokens: false,
        logLevel: "warn",
        prettyErrors: true,
        strict: true,
        stringKeys: false,
        uniqueKeys: true,
        version: "1.2"
      }, options);
      this.options = opt;
      let { version } = opt;
      if (options?._directives) {
        this.directives = options._directives.atDocument();
        if (this.directives.yaml.explicit)
          version = this.directives.yaml.version;
      } else
        this.directives = new directives.Directives({ version });
      this.setSchema(version, options);
      this.contents = value === undefined ? null : this.createNode(value, _replacer, options);
    }
    clone() {
      const copy = Object.create(Document.prototype, {
        [identity.NODE_TYPE]: { value: identity.DOC }
      });
      copy.commentBefore = this.commentBefore;
      copy.comment = this.comment;
      copy.errors = this.errors.slice();
      copy.warnings = this.warnings.slice();
      copy.options = Object.assign({}, this.options);
      if (this.directives)
        copy.directives = this.directives.clone();
      copy.schema = this.schema.clone();
      copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    add(value) {
      if (assertCollection(this.contents))
        this.contents.add(value);
    }
    addIn(path16, value) {
      if (assertCollection(this.contents))
        this.contents.addIn(path16, value);
    }
    createAlias(node, name) {
      if (!node.anchor) {
        const prev = anchors.anchorNames(this);
        node.anchor = !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
      }
      return new Alias.Alias(node.anchor);
    }
    createNode(value, replacer, options) {
      let _replacer = undefined;
      if (typeof replacer === "function") {
        value = replacer.call({ "": value }, "", value);
        _replacer = replacer;
      } else if (Array.isArray(replacer)) {
        const keyToStr = (v3) => typeof v3 === "number" || v3 instanceof String || v3 instanceof Number;
        const asStr = replacer.filter(keyToStr).map(String);
        if (asStr.length > 0)
          replacer = replacer.concat(asStr);
        _replacer = replacer;
      } else if (options === undefined && replacer) {
        options = replacer;
        replacer = undefined;
      }
      const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
      const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, anchorPrefix || "a");
      const ctx = {
        aliasDuplicateObjects: aliasDuplicateObjects ?? true,
        keepUndefined: keepUndefined ?? false,
        onAnchor,
        onTagObj,
        replacer: _replacer,
        schema: this.schema,
        sourceObjects
      };
      const node = createNode.createNode(value, tag, ctx);
      if (flow && identity.isCollection(node))
        node.flow = true;
      setAnchors();
      return node;
    }
    createPair(key, value, options = {}) {
      const k3 = this.createNode(key, null, options);
      const v3 = this.createNode(value, null, options);
      return new Pair.Pair(k3, v3);
    }
    delete(key) {
      return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    deleteIn(path16) {
      if (Collection.isEmptyPath(path16)) {
        if (this.contents == null)
          return false;
        this.contents = null;
        return true;
      }
      return assertCollection(this.contents) ? this.contents.deleteIn(path16) : false;
    }
    get(key, keepScalar) {
      return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : undefined;
    }
    getIn(path16, keepScalar) {
      if (Collection.isEmptyPath(path16))
        return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
      return identity.isCollection(this.contents) ? this.contents.getIn(path16, keepScalar) : undefined;
    }
    has(key) {
      return identity.isCollection(this.contents) ? this.contents.has(key) : false;
    }
    hasIn(path16) {
      if (Collection.isEmptyPath(path16))
        return this.contents !== undefined;
      return identity.isCollection(this.contents) ? this.contents.hasIn(path16) : false;
    }
    set(key, value) {
      if (this.contents == null) {
        this.contents = Collection.collectionFromPath(this.schema, [key], value);
      } else if (assertCollection(this.contents)) {
        this.contents.set(key, value);
      }
    }
    setIn(path16, value) {
      if (Collection.isEmptyPath(path16)) {
        this.contents = value;
      } else if (this.contents == null) {
        this.contents = Collection.collectionFromPath(this.schema, Array.from(path16), value);
      } else if (assertCollection(this.contents)) {
        this.contents.setIn(path16, value);
      }
    }
    setSchema(version, options = {}) {
      if (typeof version === "number")
        version = String(version);
      let opt;
      switch (version) {
        case "1.1":
          if (this.directives)
            this.directives.yaml.version = "1.1";
          else
            this.directives = new directives.Directives({ version: "1.1" });
          opt = { resolveKnownTags: false, schema: "yaml-1.1" };
          break;
        case "1.2":
        case "next":
          if (this.directives)
            this.directives.yaml.version = version;
          else
            this.directives = new directives.Directives({ version });
          opt = { resolveKnownTags: true, schema: "core" };
          break;
        case null:
          if (this.directives)
            delete this.directives;
          opt = null;
          break;
        default: {
          const sv = JSON.stringify(version);
          throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
        }
      }
      if (options.schema instanceof Object)
        this.schema = options.schema;
      else if (opt)
        this.schema = new Schema.Schema(Object.assign(opt, options));
      else
        throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      const ctx = {
        anchors: new Map,
        doc: this,
        keep: !json,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
    }
    toJSON(jsonArg, onAnchor) {
      return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    toString(options = {}) {
      if (this.errors.length > 0)
        throw new Error("Document with errors cannot be stringified");
      if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
        const s = JSON.stringify(options.indent);
        throw new Error(`"indent" option must be a positive integer, not ${s}`);
      }
      return stringifyDocument.stringifyDocument(this, options);
    }
  }
  function assertCollection(contents) {
    if (identity.isCollection(contents))
      return true;
    throw new Error("Expected a YAML collection as document contents");
  }
  exports.Document = Document;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/errors.js
var require_errors = __commonJS((exports) => {
  class YAMLError extends Error {
    constructor(name, pos, code, message) {
      super();
      this.name = name;
      this.code = code;
      this.message = message;
      this.pos = pos;
    }
  }

  class YAMLParseError extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLParseError", pos, code, message);
    }
  }

  class YAMLWarning extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLWarning", pos, code, message);
    }
  }
  var prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
      return;
    error.linePos = error.pos.map((pos) => lc.linePos(pos));
    const { line, col } = error.linePos[0];
    error.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
    if (ci >= 60 && lineStr.length > 80) {
      const trimStart = Math.min(ci - 39, lineStr.length - 79);
      lineStr = "\u2026" + lineStr.substring(trimStart);
      ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
      lineStr = lineStr.substring(0, 79) + "\u2026";
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
      let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
      if (prev.length > 80)
        prev = prev.substring(0, 79) + `\u2026
`;
      lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
      let count = 1;
      const end = error.linePos[1];
      if (end?.line === line && end.col > col) {
        count = Math.max(1, Math.min(end.col - col, 80 - ci));
      }
      const pointer = " ".repeat(ci) + "^".repeat(count);
      error.message += `:

${lineStr}
${pointer}
`;
    }
  };
  exports.YAMLError = YAMLError;
  exports.YAMLParseError = YAMLParseError;
  exports.YAMLWarning = YAMLWarning;
  exports.prettifyError = prettifyError;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS((exports) => {
  function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = "";
    let commentSep = "";
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
      if (reqSpace) {
        if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
          onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
        reqSpace = false;
      }
      if (tab) {
        if (atNewline && token.type !== "comment" && token.type !== "newline") {
          onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
        }
        tab = null;
      }
      switch (token.type) {
        case "space":
          if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("\t")) {
            tab = token;
          }
          hasSpace = true;
          break;
        case "comment": {
          if (!hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = token.source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += commentSep + cb;
          commentSep = "";
          atNewline = false;
          break;
        }
        case "newline":
          if (atNewline) {
            if (comment)
              comment += token.source;
            else if (!found || indicator !== "seq-item-ind")
              spaceBefore = true;
          } else
            commentSep += token.source;
          atNewline = true;
          hasNewline = true;
          if (anchor || tag)
            newlineAfterProp = token;
          hasSpace = true;
          break;
        case "anchor":
          if (anchor)
            onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
          if (token.source.endsWith(":"))
            onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
          anchor = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        case "tag": {
          if (tag)
            onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
          tag = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        }
        case indicator:
          if (anchor || tag)
            onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
          if (found)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
          found = token;
          atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
          hasSpace = false;
          break;
        case "comma":
          if (flow) {
            if (comma)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
            comma = token;
            atNewline = false;
            hasSpace = false;
            break;
          }
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
          atNewline = false;
          hasSpace = false;
      }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
      onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
    }
    if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
      onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
    return {
      comma,
      found,
      spaceBefore,
      comment,
      hasNewline,
      anchor,
      tag,
      newlineAfterProp,
      end,
      start: start ?? end
    };
  }
  exports.resolveProps = resolveProps;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS((exports) => {
  function containsNewline(key) {
    if (!key)
      return null;
    switch (key.type) {
      case "alias":
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        if (key.source.includes(`
`))
          return true;
        if (key.end) {
          for (const st of key.end)
            if (st.type === "newline")
              return true;
        }
        return false;
      case "flow-collection":
        for (const it of key.items) {
          for (const st of it.start)
            if (st.type === "newline")
              return true;
          if (it.sep) {
            for (const st of it.sep)
              if (st.type === "newline")
                return true;
          }
          if (containsNewline(it.key) || containsNewline(it.value))
            return true;
        }
        return false;
      default:
        return true;
    }
  }
  exports.containsNewline = containsNewline;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS((exports) => {
  var utilContainsNewline = require_util_contains_newline();
  function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === "flow-collection") {
      const end = fc.end[0];
      if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
        const msg = "Flow end indicator should be more indented than parent";
        onError(end, "BAD_INDENT", msg, true);
      }
    }
  }
  exports.flowIndentCheck = flowIndentCheck;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS((exports) => {
  var identity = require_identity();
  function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
      return false;
    const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a3, b3) => a3 === b3 || identity.isScalar(a3) && identity.isScalar(b3) && a3.value === b3.value;
    return items.some((pair) => isEqual(pair.key, search));
  }
  exports.mapIncludes = mapIncludes;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS((exports) => {
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();
  var resolveProps = require_resolve_props();
  var utilContainsNewline = require_util_contains_newline();
  var utilFlowIndentCheck = require_util_flow_indent_check();
  var utilMapIncludes = require_util_map_includes();
  var startColMsg = "All mapping items must start at the same column";
  function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
    const map = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
      const { start, key, sep, value } = collItem;
      const keyProps = resolveProps.resolveProps(start, {
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: bm.indent,
        startOnNewline: true
      });
      const implicitKey = !keyProps.found;
      if (implicitKey) {
        if (key) {
          if (key.type === "block-seq")
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
          else if ("indent" in key && key.indent !== bm.indent)
            onError(offset, "BAD_INDENT", startColMsg);
        }
        if (!keyProps.anchor && !keyProps.tag && !sep) {
          commentEnd = keyProps.end;
          if (keyProps.comment) {
            if (map.comment)
              map.comment += `
` + keyProps.comment;
            else
              map.comment = keyProps.comment;
          }
          continue;
        }
        if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
          onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
        }
      } else if (keyProps.found?.indent !== bm.indent) {
        onError(offset, "BAD_INDENT", startColMsg);
      }
      ctx.atKey = true;
      const keyStart = keyProps.end;
      const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
      if (ctx.schema.compat)
        utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
      ctx.atKey = false;
      if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
        onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
      const valueProps = resolveProps.resolveProps(sep ?? [], {
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: bm.indent,
        startOnNewline: !key || key.type === "block-scalar"
      });
      offset = valueProps.end;
      if (valueProps.found) {
        if (implicitKey) {
          if (value?.type === "block-map" && !valueProps.hasNewline)
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
          if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
            onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
        }
        const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
        offset = valueNode.range[2];
        const pair = new Pair.Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map.items.push(pair);
      } else {
        if (implicitKey)
          onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
        if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += `
` + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair.Pair(keyNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map.items.push(pair);
      }
    }
    if (commentEnd && commentEnd < offset)
      onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
    map.range = [bm.offset, offset, commentEnd ?? offset];
    return map;
  }
  exports.resolveBlockMap = resolveBlockMap;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS((exports) => {
  var YAMLSeq = require_YAMLSeq();
  var resolveProps = require_resolve_props();
  var utilFlowIndentCheck = require_util_flow_indent_check();
  function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
    const seq = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
      const props = resolveProps.resolveProps(start, {
        indicator: "seq-item-ind",
        next: value,
        offset,
        onError,
        parentIndent: bs.indent,
        startOnNewline: true
      });
      if (!props.found) {
        if (props.anchor || props.tag || value) {
          if (value?.type === "block-seq")
            onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
          else
            onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
        } else {
          commentEnd = props.end;
          if (props.comment)
            seq.comment = props.comment;
          continue;
        }
      }
      const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
      if (ctx.schema.compat)
        utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
      offset = node.range[2];
      seq.items.push(node);
    }
    seq.range = [bs.offset, offset, commentEnd ?? offset];
    return seq;
  }
  exports.resolveBlockSeq = resolveBlockSeq;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS((exports) => {
  function resolveEnd(end, offset, reqSpace, onError) {
    let comment = "";
    if (end) {
      let hasSpace = false;
      let sep = "";
      for (const token of end) {
        const { source, type } = token;
        switch (type) {
          case "space":
            hasSpace = true;
            break;
          case "comment": {
            if (reqSpace && !hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += sep + cb;
            sep = "";
            break;
          }
          case "newline":
            if (comment)
              sep += source;
            hasSpace = true;
            break;
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
        }
        offset += source.length;
      }
    }
    return { comment, offset };
  }
  exports.resolveEnd = resolveEnd;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var resolveEnd = require_resolve_end();
  var resolveProps = require_resolve_props();
  var utilContainsNewline = require_util_contains_newline();
  var utilMapIncludes = require_util_map_includes();
  var blockMsg = "Block collections are not allowed within flow collections";
  var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
  function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
    const isMap = fc.start.source === "{";
    const fcName = isMap ? "flow map" : "flow sequence";
    const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i = 0;i < fc.items.length; ++i) {
      const collItem = fc.items[i];
      const { start, key, sep, value } = collItem;
      const props = resolveProps.resolveProps(start, {
        flow: fcName,
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (!props.found) {
        if (!props.anchor && !props.tag && !sep && !value) {
          if (i === 0 && props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
          else if (i < fc.items.length - 1)
            onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
          if (props.comment) {
            if (coll.comment)
              coll.comment += `
` + props.comment;
            else
              coll.comment = props.comment;
          }
          offset = props.end;
          continue;
        }
        if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
          onError(key, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
      }
      if (i === 0) {
        if (props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
      } else {
        if (!props.comma)
          onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
        if (props.comment) {
          let prevItemComment = "";
          loop:
            for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
          if (prevItemComment) {
            let prev = coll.items[coll.items.length - 1];
            if (identity.isPair(prev))
              prev = prev.value ?? prev.key;
            if (prev.comment)
              prev.comment += `
` + prevItemComment;
            else
              prev.comment = prevItemComment;
            props.comment = props.comment.substring(prevItemComment.length + 1);
          }
        }
      }
      if (!isMap && !sep && !props.found) {
        const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
        coll.items.push(valueNode);
        offset = valueNode.range[2];
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else {
        ctx.atKey = true;
        const keyStart = props.end;
        const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
        if (isBlock(key))
          onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
        ctx.atKey = false;
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          flow: fcName,
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (valueProps.found) {
          if (!isMap && !props.found && ctx.options.strict) {
            if (sep)
              for (const st of sep) {
                if (st === valueProps.found)
                  break;
                if (st.type === "newline") {
                  onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                  break;
                }
              }
            if (props.start < valueProps.found.offset - 1024)
              onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
          }
        } else if (value) {
          if ("source" in value && value.source?.[0] === ":")
            onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
          else
            onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
        }
        const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
        if (valueNode) {
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += `
` + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair.Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        if (isMap) {
          const map = coll;
          if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
            onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
          map.items.push(pair);
        } else {
          const map = new YAMLMap.YAMLMap(ctx.schema);
          map.flow = true;
          map.items.push(pair);
          const endRange = (valueNode ?? keyNode).range;
          map.range = [keyNode.range[0], endRange[1], endRange[2]];
          coll.items.push(map);
        }
        offset = valueNode ? valueNode.range[2] : valueProps.end;
      }
    }
    const expectedEnd = isMap ? "}" : "]";
    const [ce2, ...ee2] = fc.end;
    let cePos = offset;
    if (ce2?.source === expectedEnd)
      cePos = ce2.offset + ce2.source.length;
    else {
      const name = fcName[0].toUpperCase() + fcName.substring(1);
      const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
      onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
      if (ce2 && ce2.source.length !== 1)
        ee2.unshift(ce2);
    }
    if (ee2.length > 0) {
      const end = resolveEnd.resolveEnd(ee2, cePos, ctx.options.strict, onError);
      if (end.comment) {
        if (coll.comment)
          coll.comment += `
` + end.comment;
        else
          coll.comment = end.comment;
      }
      coll.range = [fc.offset, cePos, end.offset];
    } else {
      coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
  }
  exports.resolveFlowCollection = resolveFlowCollection;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var resolveBlockMap = require_resolve_block_map();
  var resolveBlockSeq = require_resolve_block_seq();
  var resolveFlowCollection = require_resolve_flow_collection();
  function resolveCollection(CN, ctx, token, onError, tagName, tag) {
    const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
    const Coll = coll.constructor;
    if (tagName === "!" || tagName === Coll.tagName) {
      coll.tag = Coll.tagName;
      return coll;
    }
    if (tagName)
      coll.tag = tagName;
    return coll;
  }
  function composeCollection(CN, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
    if (token.type === "block-seq") {
      const { anchor, newlineAfterProp: nl } = props;
      const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
      if (lastProp && (!nl || nl.offset < lastProp.offset)) {
        const message = "Missing newline after block sequence props";
        onError(lastProp, "MISSING_CHAR", message);
      }
    }
    const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
    if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
      return resolveCollection(CN, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
    if (!tag) {
      const kt = ctx.schema.knownTags[tagName];
      if (kt?.collection === expType) {
        ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
        tag = kt;
      } else {
        if (kt) {
          onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
        } else {
          onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
        }
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
    }
    const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
    const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
      node.format = tag.format;
    return node;
  }
  exports.composeCollection = composeCollection;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS((exports) => {
  var Scalar = require_Scalar();
  function resolveBlockScalar(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
      return { value: "", type: null, comment: "", range: [start, start, start] };
    const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    let chompStart = lines.length;
    for (let i = lines.length - 1;i >= 0; --i) {
      const content = lines[i][1];
      if (content === "" || content === "\r")
        chompStart = i;
      else
        break;
    }
    if (chompStart === 0) {
      const value2 = header.chomp === "+" && lines.length > 0 ? `
`.repeat(Math.max(1, lines.length - 1)) : "";
      let end2 = start + header.length;
      if (scalar.source)
        end2 += scalar.source.length;
      return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
    }
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i = 0;i < chompStart; ++i) {
      const [indent, content] = lines[i];
      if (content === "" || content === "\r") {
        if (header.indent === 0 && indent.length > trimIndent)
          trimIndent = indent.length;
      } else {
        if (indent.length < trimIndent) {
          const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
          onError(offset + indent.length, "MISSING_CHAR", message);
        }
        if (header.indent === 0)
          trimIndent = indent.length;
        contentStart = i;
        if (trimIndent === 0 && !ctx.atRoot) {
          const message = "Block scalar values in collections must be indented";
          onError(offset, "BAD_INDENT", message);
        }
        break;
      }
      offset += indent.length + content.length + 1;
    }
    for (let i = lines.length - 1;i >= chompStart; --i) {
      if (lines[i][0].length > trimIndent)
        chompStart = i + 1;
    }
    let value = "";
    let sep = "";
    let prevMoreIndented = false;
    for (let i = 0;i < contentStart; ++i)
      value += lines[i][0].slice(trimIndent) + `
`;
    for (let i = contentStart;i < chompStart; ++i) {
      let [indent, content] = lines[i];
      offset += indent.length + content.length + 1;
      const crlf = content[content.length - 1] === "\r";
      if (crlf)
        content = content.slice(0, -1);
      if (content && indent.length < trimIndent) {
        const src = header.indent ? "explicit indentation indicator" : "first line";
        const message = `Block scalar lines must not be less indented than their ${src}`;
        onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
        indent = "";
      }
      if (type === Scalar.Scalar.BLOCK_LITERAL) {
        value += sep + indent.slice(trimIndent) + content;
        sep = `
`;
      } else if (indent.length > trimIndent || content[0] === "\t") {
        if (sep === " ")
          sep = `
`;
        else if (!prevMoreIndented && sep === `
`)
          sep = `

`;
        value += sep + indent.slice(trimIndent) + content;
        sep = `
`;
        prevMoreIndented = true;
      } else if (content === "") {
        if (sep === `
`)
          value += `
`;
        else
          sep = `
`;
      } else {
        value += sep + content;
        sep = " ";
        prevMoreIndented = false;
      }
    }
    switch (header.chomp) {
      case "-":
        break;
      case "+":
        for (let i = chompStart;i < lines.length; ++i)
          value += `
` + lines[i][0].slice(trimIndent);
        if (value[value.length - 1] !== `
`)
          value += `
`;
        break;
      default:
        value += `
`;
    }
    const end = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
  }
  function parseBlockScalarHeader({ offset, props }, strict, onError) {
    if (props[0].type !== "block-scalar-header") {
      onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
      return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = "";
    let error = -1;
    for (let i = 1;i < source.length; ++i) {
      const ch = source[i];
      if (!chomp && (ch === "-" || ch === "+"))
        chomp = ch;
      else {
        const n = Number(ch);
        if (!indent && n)
          indent = n;
        else if (error === -1)
          error = offset + i;
      }
    }
    if (error !== -1)
      onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = "";
    let length = source.length;
    for (let i = 1;i < props.length; ++i) {
      const token = props[i];
      switch (token.type) {
        case "space":
          hasSpace = true;
        case "newline":
          length += token.source.length;
          break;
        case "comment":
          if (strict && !hasSpace) {
            const message = "Comments must be separated from other tokens by white space characters";
            onError(token, "MISSING_CHAR", message);
          }
          length += token.source.length;
          comment = token.source.substring(1);
          break;
        case "error":
          onError(token, "UNEXPECTED_TOKEN", token.message);
          length += token.source.length;
          break;
        default: {
          const message = `Unexpected token in block scalar header: ${token.type}`;
          onError(token, "UNEXPECTED_TOKEN", message);
          const ts = token.source;
          if (ts && typeof ts === "string")
            length += ts.length;
        }
      }
    }
    return { mode, indent, chomp, comment, length };
  }
  function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m2 = first.match(/^( *)/);
    const line0 = m2?.[1] ? [m2[1], first.slice(m2[1].length)] : ["", first];
    const lines = [line0];
    for (let i = 1;i < split.length; i += 2)
      lines.push([split[i], split[i + 1]]);
    return lines;
  }
  exports.resolveBlockScalar = resolveBlockScalar;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var resolveEnd = require_resolve_end();
  function resolveFlowScalar(scalar, strict, onError) {
    const { offset, type, source, end } = scalar;
    let _type;
    let value;
    const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
    switch (type) {
      case "scalar":
        _type = Scalar.Scalar.PLAIN;
        value = plainValue(source, _onError);
        break;
      case "single-quoted-scalar":
        _type = Scalar.Scalar.QUOTE_SINGLE;
        value = singleQuotedValue(source, _onError);
        break;
      case "double-quoted-scalar":
        _type = Scalar.Scalar.QUOTE_DOUBLE;
        value = doubleQuotedValue(source, _onError);
        break;
      default:
        onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
        return {
          value: "",
          type: null,
          comment: "",
          range: [offset, offset + source.length, offset + source.length]
        };
    }
    const valueEnd = offset + source.length;
    const re2 = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
    return {
      value,
      type: _type,
      comment: re2.comment,
      range: [offset, valueEnd, re2.offset]
    };
  }
  function plainValue(source, onError) {
    let badChar = "";
    switch (source[0]) {
      case "\t":
        badChar = "a tab character";
        break;
      case ",":
        badChar = "flow indicator character ,";
        break;
      case "%":
        badChar = "directive indicator character %";
        break;
      case "|":
      case ">": {
        badChar = `block scalar indicator ${source[0]}`;
        break;
      }
      case "@":
      case "`": {
        badChar = `reserved character ${source[0]}`;
        break;
      }
    }
    if (badChar)
      onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
    return foldLines(source);
  }
  function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
      onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
    return foldLines(source.slice(1, -1)).replace(/''/g, "'");
  }
  function foldLines(source) {
    let first, line;
    try {
      first = new RegExp(`(.*?)(?<![ 	])[ 	]*\r?
`, "sy");
      line = new RegExp(`[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?
`, "sy");
    } catch {
      first = /(.*?)[ \t]*\r?\n/sy;
      line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
    }
    let match = first.exec(source);
    if (!match)
      return source;
    let res = match[1];
    let sep = " ";
    let pos = first.lastIndex;
    line.lastIndex = pos;
    while (match = line.exec(source)) {
      if (match[1] === "") {
        if (sep === `
`)
          res += sep;
        else
          sep = `
`;
      } else {
        res += sep + match[1];
        sep = " ";
      }
      pos = line.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? "");
  }
  function doubleQuotedValue(source, onError) {
    let res = "";
    for (let i = 1;i < source.length - 1; ++i) {
      const ch = source[i];
      if (ch === "\r" && source[i + 1] === `
`)
        continue;
      if (ch === `
`) {
        const { fold, offset } = foldNewline(source, i);
        res += fold;
        i = offset;
      } else if (ch === "\\") {
        let next = source[++i];
        const cc = escapeCodes[next];
        if (cc)
          res += cc;
        else if (next === `
`) {
          next = source[i + 1];
          while (next === " " || next === "\t")
            next = source[++i + 1];
        } else if (next === "\r" && source[i + 1] === `
`) {
          next = source[++i + 1];
          while (next === " " || next === "\t")
            next = source[++i + 1];
        } else if (next === "x" || next === "u" || next === "U") {
          const length = next === "x" ? 2 : next === "u" ? 4 : 8;
          res += parseCharCode(source, i + 1, length, onError);
          i += length;
        } else {
          const raw = source.substr(i - 1, 2);
          onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
          res += raw;
        }
      } else if (ch === " " || ch === "\t") {
        const wsStart = i;
        let next = source[i + 1];
        while (next === " " || next === "\t")
          next = source[++i + 1];
        if (next !== `
` && !(next === "\r" && source[i + 2] === `
`))
          res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
      } else {
        res += ch;
      }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
      onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
    return res;
  }
  function foldNewline(source, offset) {
    let fold = "";
    let ch = source[offset + 1];
    while (ch === " " || ch === "\t" || ch === `
` || ch === "\r") {
      if (ch === "\r" && source[offset + 2] !== `
`)
        break;
      if (ch === `
`)
        fold += `
`;
      offset += 1;
      ch = source[offset + 1];
    }
    if (!fold)
      fold = " ";
    return { fold, offset };
  }
  var escapeCodes = {
    "0": "\x00",
    a: "\x07",
    b: "\b",
    e: "\x1B",
    f: "\f",
    n: `
`,
    r: "\r",
    t: "\t",
    v: "\v",
    N: "\x85",
    _: "\xA0",
    L: "\u2028",
    P: "\u2029",
    " ": " ",
    '"': '"',
    "/": "/",
    "\\": "\\",
    "\t": "\t"
  };
  function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    try {
      return String.fromCodePoint(code);
    } catch {
      const raw = source.substr(offset - 2, length + 2);
      onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
      return raw;
    }
  }
  exports.resolveFlowScalar = resolveFlowScalar;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var resolveBlockScalar = require_resolve_block_scalar();
  var resolveFlowScalar = require_resolve_flow_scalar();
  function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
      tag = ctx.schema[identity.SCALAR];
    } else if (tagName)
      tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === "scalar")
      tag = findScalarTagByTest(ctx, value, token, onError);
    else
      tag = ctx.schema[identity.SCALAR];
    let scalar;
    try {
      const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
      scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
      scalar = new Scalar.Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
      scalar.type = type;
    if (tagName)
      scalar.tag = tagName;
    if (tag.format)
      scalar.format = tag.format;
    if (comment)
      scalar.comment = comment;
    return scalar;
  }
  function findScalarTagByName(schema, value, tagName, tagToken, onError) {
    if (tagName === "!")
      return schema[identity.SCALAR];
    const matchWithTest = [];
    for (const tag of schema.tags) {
      if (!tag.collection && tag.tag === tagName) {
        if (tag.default && tag.test)
          matchWithTest.push(tag);
        else
          return tag;
      }
    }
    for (const tag of matchWithTest)
      if (tag.test?.test(value))
        return tag;
    const kt = schema.knownTags[tagName];
    if (kt && !kt.collection) {
      schema.tags.push(Object.assign({}, kt, { default: false, test: undefined }));
      return kt;
    }
    onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
    return schema[identity.SCALAR];
  }
  function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
    const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
    if (schema.compat) {
      const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
      if (tag.tag !== compat.tag) {
        const ts = directives.tagString(tag.tag);
        const cs = directives.tagString(compat.tag);
        const msg = `Value may be parsed as either ${ts} or ${cs}`;
        onError(token, "TAG_RESOLVE_FAILED", msg, true);
      }
    }
    return tag;
  }
  exports.composeScalar = composeScalar;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS((exports) => {
  function emptyScalarPosition(offset, before, pos) {
    if (before) {
      pos ?? (pos = before.length);
      for (let i = pos - 1;i >= 0; --i) {
        let st = before[i];
        switch (st.type) {
          case "space":
          case "comment":
          case "newline":
            offset -= st.source.length;
            continue;
        }
        st = before[++i];
        while (st?.type === "space") {
          offset += st.source.length;
          st = before[++i];
        }
        break;
      }
    }
    return offset;
  }
  exports.emptyScalarPosition = emptyScalarPosition;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS((exports) => {
  var Alias = require_Alias();
  var identity = require_identity();
  var composeCollection = require_compose_collection();
  var composeScalar = require_compose_scalar();
  var resolveEnd = require_resolve_end();
  var utilEmptyScalarPosition = require_util_empty_scalar_position();
  var CN = { composeNode, composeEmptyNode };
  function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
      case "alias":
        node = composeAlias(ctx, token, onError);
        if (anchor || tag)
          onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
        break;
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "block-scalar":
        node = composeScalar.composeScalar(ctx, token, tag, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      case "block-map":
      case "block-seq":
      case "flow-collection":
        try {
          node = composeCollection.composeCollection(CN, ctx, token, props, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          onError(token, "RESOURCE_EXHAUSTION", message);
        }
        break;
      default: {
        const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
        onError(token, "UNEXPECTED_TOKEN", message);
        isSrcToken = false;
      }
    }
    node ?? (node = composeEmptyNode(ctx, token.offset, undefined, null, props, onError));
    if (anchor && node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
      const msg = "With stringKeys, all keys must be strings";
      onError(tag ?? token, "NON_STRING_KEY", msg);
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      if (token.type === "scalar" && token.source === "")
        node.comment = comment;
      else
        node.commentBefore = comment;
    }
    if (ctx.options.keepSourceTokens && isSrcToken)
      node.srcToken = token;
    return node;
  }
  function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
      type: "scalar",
      offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
      indent: -1,
      source: ""
    };
    const node = composeScalar.composeScalar(ctx, token, tag, onError);
    if (anchor) {
      node.anchor = anchor.source.substring(1);
      if (node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      node.comment = comment;
      node.range[2] = end;
    }
    return node;
  }
  function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias.Alias(source.substring(1));
    if (alias.source === "")
      onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
    if (alias.source.endsWith(":"))
      onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
    const valueEnd = offset + source.length;
    const re2 = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re2.offset];
    if (re2.comment)
      alias.comment = re2.comment;
    return alias;
  }
  exports.composeEmptyNode = composeEmptyNode;
  exports.composeNode = composeNode;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS((exports) => {
  var Document = require_Document();
  var composeNode = require_compose_node();
  var resolveEnd = require_resolve_end();
  var resolveProps = require_resolve_props();
  function composeDoc(options, directives, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document.Document(undefined, opts);
    const ctx = {
      atKey: false,
      atRoot: true,
      directives: doc.directives,
      options: doc.options,
      schema: doc.schema
    };
    const props = resolveProps.resolveProps(start, {
      indicator: "doc-start",
      next: value ?? end?.[0],
      offset,
      onError,
      parentIndent: 0,
      startOnNewline: true
    });
    if (props.found) {
      doc.directives.docStart = true;
      if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
        onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
    }
    doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re2 = resolveEnd.resolveEnd(end, contentEnd, false, onError);
    if (re2.comment)
      doc.comment = re2.comment;
    doc.range = [offset, contentEnd, re2.offset];
    return doc;
  }
  exports.composeDoc = composeDoc;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS((exports) => {
  var node_process = __require("process");
  var directives = require_directives();
  var Document = require_Document();
  var errors = require_errors();
  var identity = require_identity();
  var composeDoc = require_compose_doc();
  var resolveEnd = require_resolve_end();
  function getErrorPos(src) {
    if (typeof src === "number")
      return [src, src + 1];
    if (Array.isArray(src))
      return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === "string" ? source.length : 1)];
  }
  function parsePrelude(prelude) {
    let comment = "";
    let atComment = false;
    let afterEmptyLine = false;
    for (let i = 0;i < prelude.length; ++i) {
      const source = prelude[i];
      switch (source[0]) {
        case "#":
          comment += (comment === "" ? "" : afterEmptyLine ? `

` : `
`) + (source.substring(1) || " ");
          atComment = true;
          afterEmptyLine = false;
          break;
        case "%":
          if (prelude[i + 1]?.[0] !== "#")
            i += 1;
          atComment = false;
          break;
        default:
          if (!atComment)
            afterEmptyLine = true;
          atComment = false;
      }
    }
    return { comment, afterEmptyLine };
  }

  class Composer {
    constructor(options = {}) {
      this.doc = null;
      this.atDirectives = false;
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
      this.onError = (source, code, message, warning) => {
        const pos = getErrorPos(source);
        if (warning)
          this.warnings.push(new errors.YAMLWarning(pos, code, message));
        else
          this.errors.push(new errors.YAMLParseError(pos, code, message));
      };
      this.directives = new directives.Directives({ version: options.version || "1.2" });
      this.options = options;
    }
    decorate(doc, afterDoc) {
      const { comment, afterEmptyLine } = parsePrelude(this.prelude);
      if (comment) {
        const dc = doc.contents;
        if (afterDoc) {
          doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
        } else if (afterEmptyLine || doc.directives.docStart || !dc) {
          doc.commentBefore = comment;
        } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
          let it = dc.items[0];
          if (identity.isPair(it))
            it = it.key;
          const cb = it.commentBefore;
          it.commentBefore = cb ? `${comment}
${cb}` : comment;
        } else {
          const cb = dc.commentBefore;
          dc.commentBefore = cb ? `${comment}
${cb}` : comment;
        }
      }
      if (afterDoc) {
        for (let i = 0;i < this.errors.length; ++i)
          doc.errors.push(this.errors[i]);
        for (let i = 0;i < this.warnings.length; ++i)
          doc.warnings.push(this.warnings[i]);
      } else {
        doc.errors = this.errors;
        doc.warnings = this.warnings;
      }
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
    }
    streamInfo() {
      return {
        comment: parsePrelude(this.prelude).comment,
        directives: this.directives,
        errors: this.errors,
        warnings: this.warnings
      };
    }
    *compose(tokens, forceDoc = false, endOffset = -1) {
      for (const token of tokens)
        yield* this.next(token);
      yield* this.end(forceDoc, endOffset);
    }
    *next(token) {
      if (node_process.env.LOG_STREAM)
        console.dir(token, { depth: null });
      switch (token.type) {
        case "directive":
          this.directives.add(token.source, (offset, message, warning) => {
            const pos = getErrorPos(token);
            pos[0] += offset;
            this.onError(pos, "BAD_DIRECTIVE", message, warning);
          });
          this.prelude.push(token.source);
          this.atDirectives = true;
          break;
        case "document": {
          const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
          if (this.atDirectives && !doc.directives.docStart)
            this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
          this.decorate(doc, false);
          if (this.doc)
            yield this.doc;
          this.doc = doc;
          this.atDirectives = false;
          break;
        }
        case "byte-order-mark":
        case "space":
          break;
        case "comment":
        case "newline":
          this.prelude.push(token.source);
          break;
        case "error": {
          const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
          const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
          if (this.atDirectives || !this.doc)
            this.errors.push(error);
          else
            this.doc.errors.push(error);
          break;
        }
        case "doc-end": {
          if (!this.doc) {
            const msg = "Unexpected doc-end without preceding document";
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
            break;
          }
          this.doc.directives.docEnd = true;
          const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
          this.decorate(this.doc, true);
          if (end.comment) {
            const dc = this.doc.comment;
            this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
          }
          this.doc.range[2] = end.offset;
          break;
        }
        default:
          this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
      }
    }
    *end(forceDoc = false, endOffset = -1) {
      if (this.doc) {
        this.decorate(this.doc, true);
        yield this.doc;
        this.doc = null;
      } else if (forceDoc) {
        const opts = Object.assign({ _directives: this.directives }, this.options);
        const doc = new Document.Document(undefined, opts);
        if (this.atDirectives)
          this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
        doc.range = [0, endOffset, endOffset];
        this.decorate(doc, false);
        yield doc;
      }
    }
  }
  exports.Composer = Composer;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS((exports) => {
  var resolveBlockScalar = require_resolve_block_scalar();
  var resolveFlowScalar = require_resolve_flow_scalar();
  var errors = require_errors();
  var stringifyString = require_stringifyString();
  function resolveAsScalar(token, strict = true, onError) {
    if (token) {
      const _onError = (pos, code, message) => {
        const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
        if (onError)
          onError(offset, code, message);
        else
          throw new errors.YAMLParseError([offset, offset + 1], code, message);
      };
      switch (token.type) {
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
        case "block-scalar":
          return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
      }
    }
    return null;
  }
  function createScalarToken(value, context) {
    const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
    const source = stringifyString.stringifyString({ type, value }, {
      implicitKey,
      indent: indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    const end = context.end ?? [
      { type: "newline", offset: -1, indent, source: `
` }
    ];
    switch (source[0]) {
      case "|":
      case ">": {
        const he2 = source.indexOf(`
`);
        const head = source.substring(0, he2);
        const body = source.substring(he2 + 1) + `
`;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, end))
          props.push({ type: "newline", offset: -1, indent, source: `
` });
        return { type: "block-scalar", offset, indent, props, source: body };
      }
      case '"':
        return { type: "double-quoted-scalar", offset, indent, source, end };
      case "'":
        return { type: "single-quoted-scalar", offset, indent, source, end };
      default:
        return { type: "scalar", offset, indent, source, end };
    }
  }
  function setScalarValue(token, value, context = {}) {
    let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
    let indent = "indent" in token ? token.indent : null;
    if (afterKey && typeof indent === "number")
      indent += 2;
    if (!type)
      switch (token.type) {
        case "single-quoted-scalar":
          type = "QUOTE_SINGLE";
          break;
        case "double-quoted-scalar":
          type = "QUOTE_DOUBLE";
          break;
        case "block-scalar": {
          const header = token.props[0];
          if (header.type !== "block-scalar-header")
            throw new Error("Invalid block scalar header");
          type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
          break;
        }
        default:
          type = "PLAIN";
      }
    const source = stringifyString.stringifyString({ type, value }, {
      implicitKey: implicitKey || indent === null,
      indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    switch (source[0]) {
      case "|":
      case ">":
        setBlockScalarValue(token, source);
        break;
      case '"':
        setFlowScalarValue(token, source, "double-quoted-scalar");
        break;
      case "'":
        setFlowScalarValue(token, source, "single-quoted-scalar");
        break;
      default:
        setFlowScalarValue(token, source, "scalar");
    }
  }
  function setBlockScalarValue(token, source) {
    const he2 = source.indexOf(`
`);
    const head = source.substring(0, he2);
    const body = source.substring(he2 + 1) + `
`;
    if (token.type === "block-scalar") {
      const header = token.props[0];
      if (header.type !== "block-scalar-header")
        throw new Error("Invalid block scalar header");
      header.source = head;
      token.source = body;
    } else {
      const { offset } = token;
      const indent = "indent" in token ? token.indent : -1;
      const props = [
        { type: "block-scalar-header", offset, indent, source: head }
      ];
      if (!addEndtoBlockProps(props, "end" in token ? token.end : undefined))
        props.push({ type: "newline", offset: -1, indent, source: `
` });
      for (const key of Object.keys(token))
        if (key !== "type" && key !== "offset")
          delete token[key];
      Object.assign(token, { type: "block-scalar", indent, props, source: body });
    }
  }
  function addEndtoBlockProps(props, end) {
    if (end)
      for (const st of end)
        switch (st.type) {
          case "space":
          case "comment":
            props.push(st);
            break;
          case "newline":
            props.push(st);
            return true;
        }
    return false;
  }
  function setFlowScalarValue(token, source, type) {
    switch (token.type) {
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        token.type = type;
        token.source = source;
        break;
      case "block-scalar": {
        const end = token.props.slice(1);
        let oa = source.length;
        if (token.props[0].type === "block-scalar-header")
          oa -= token.props[0].source.length;
        for (const tok of end)
          tok.offset += oa;
        delete token.props;
        Object.assign(token, { type, source, end });
        break;
      }
      case "block-map":
      case "block-seq": {
        const offset = token.offset + source.length;
        const nl = { type: "newline", offset, indent: token.indent, source: `
` };
        delete token.items;
        Object.assign(token, { type, source, end: [nl] });
        break;
      }
      default: {
        const indent = "indent" in token ? token.indent : -1;
        const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type, indent, source, end });
      }
    }
  }
  exports.createScalarToken = createScalarToken;
  exports.resolveAsScalar = resolveAsScalar;
  exports.setScalarValue = setScalarValue;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS((exports) => {
  var stringify = (cst) => ("type" in cst) ? stringifyToken(cst) : stringifyItem(cst);
  function stringifyToken(token) {
    switch (token.type) {
      case "block-scalar": {
        let res = "";
        for (const tok of token.props)
          res += stringifyToken(tok);
        return res + token.source;
      }
      case "block-map":
      case "block-seq": {
        let res = "";
        for (const item of token.items)
          res += stringifyItem(item);
        return res;
      }
      case "flow-collection": {
        let res = token.start.source;
        for (const item of token.items)
          res += stringifyItem(item);
        for (const st of token.end)
          res += st.source;
        return res;
      }
      case "document": {
        let res = stringifyItem(token);
        if (token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
      default: {
        let res = token.source;
        if ("end" in token && token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
    }
  }
  function stringifyItem({ start, key, sep, value }) {
    let res = "";
    for (const st of start)
      res += st.source;
    if (key)
      res += stringifyToken(key);
    if (sep)
      for (const st of sep)
        res += st.source;
    if (value)
      res += stringifyToken(value);
    return res;
  }
  exports.stringify = stringify;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS((exports) => {
  var BREAK = Symbol("break visit");
  var SKIP = Symbol("skip children");
  var REMOVE = Symbol("remove item");
  function visit(cst, visitor) {
    if ("type" in cst && cst.type === "document")
      cst = { start: cst.start, value: cst.value };
    _visit(Object.freeze([]), cst, visitor);
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  visit.itemAtPath = (cst, path16) => {
    let item = cst;
    for (const [field, index] of path16) {
      const tok = item?.[field];
      if (tok && "items" in tok) {
        item = tok.items[index];
      } else
        return;
    }
    return item;
  };
  visit.parentCollection = (cst, path16) => {
    const parent = visit.itemAtPath(cst, path16.slice(0, -1));
    const field = path16[path16.length - 1][0];
    const coll = parent?.[field];
    if (coll && "items" in coll)
      return coll;
    throw new Error("Parent collection not found");
  };
  function _visit(path16, item, visitor) {
    let ctrl = visitor(item, path16);
    if (typeof ctrl === "symbol")
      return ctrl;
    for (const field of ["key", "value"]) {
      const token = item[field];
      if (token && "items" in token) {
        for (let i = 0;i < token.items.length; ++i) {
          const ci = _visit(Object.freeze(path16.concat([[field, i]])), token.items[i], visitor);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            token.items.splice(i, 1);
            i -= 1;
          }
        }
        if (typeof ctrl === "function" && field === "key")
          ctrl = ctrl(item, path16);
      }
    }
    return typeof ctrl === "function" ? ctrl(item, path16) : ctrl;
  }
  exports.visit = visit;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS((exports) => {
  var cstScalar = require_cst_scalar();
  var cstStringify = require_cst_stringify();
  var cstVisit = require_cst_visit();
  var BOM = "\uFEFF";
  var DOCUMENT = "\x02";
  var FLOW_END = "\x18";
  var SCALAR = "\x1F";
  var isCollection = (token) => !!token && ("items" in token);
  var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
  function prettyToken(token) {
    switch (token) {
      case BOM:
        return "<BOM>";
      case DOCUMENT:
        return "<DOC>";
      case FLOW_END:
        return "<FLOW_END>";
      case SCALAR:
        return "<SCALAR>";
      default:
        return JSON.stringify(token);
    }
  }
  function tokenType(source) {
    switch (source) {
      case BOM:
        return "byte-order-mark";
      case DOCUMENT:
        return "doc-mode";
      case FLOW_END:
        return "flow-error-end";
      case SCALAR:
        return "scalar";
      case "---":
        return "doc-start";
      case "...":
        return "doc-end";
      case "":
      case `
`:
      case `\r
`:
        return "newline";
      case "-":
        return "seq-item-ind";
      case "?":
        return "explicit-key-ind";
      case ":":
        return "map-value-ind";
      case "{":
        return "flow-map-start";
      case "}":
        return "flow-map-end";
      case "[":
        return "flow-seq-start";
      case "]":
        return "flow-seq-end";
      case ",":
        return "comma";
    }
    switch (source[0]) {
      case " ":
      case "\t":
        return "space";
      case "#":
        return "comment";
      case "%":
        return "directive-line";
      case "*":
        return "alias";
      case "&":
        return "anchor";
      case "!":
        return "tag";
      case "'":
        return "single-quoted-scalar";
      case '"':
        return "double-quoted-scalar";
      case "|":
      case ">":
        return "block-scalar-header";
    }
    return null;
  }
  exports.createScalarToken = cstScalar.createScalarToken;
  exports.resolveAsScalar = cstScalar.resolveAsScalar;
  exports.setScalarValue = cstScalar.setScalarValue;
  exports.stringify = cstStringify.stringify;
  exports.visit = cstVisit.visit;
  exports.BOM = BOM;
  exports.DOCUMENT = DOCUMENT;
  exports.FLOW_END = FLOW_END;
  exports.SCALAR = SCALAR;
  exports.isCollection = isCollection;
  exports.isScalar = isScalar;
  exports.prettyToken = prettyToken;
  exports.tokenType = tokenType;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS((exports) => {
  var cst = require_cst();
  function isEmpty(ch) {
    switch (ch) {
      case undefined:
      case " ":
      case `
`:
      case "\r":
      case "\t":
        return true;
      default:
        return false;
    }
  }
  var hexDigits = new Set("0123456789ABCDEFabcdef");
  var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
  var flowIndicatorChars = new Set(",[]{}");
  var invalidAnchorChars = new Set(` ,[]{}
\r	`);
  var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);

  class Lexer {
    constructor() {
      this.atEnd = false;
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      this.buffer = "";
      this.flowKey = false;
      this.flowLevel = 0;
      this.indentNext = 0;
      this.indentValue = 0;
      this.lineEndPos = null;
      this.next = null;
      this.pos = 0;
    }
    *lex(source, incomplete = false) {
      if (source) {
        if (typeof source !== "string")
          throw TypeError("source is not a string");
        this.buffer = this.buffer ? this.buffer + source : source;
        this.lineEndPos = null;
      }
      this.atEnd = !incomplete;
      let next = this.next ?? "stream";
      while (next && (incomplete || this.hasChars(1)))
        next = yield* this.parseNext(next);
    }
    atLineEnd() {
      let i = this.pos;
      let ch = this.buffer[i];
      while (ch === " " || ch === "\t")
        ch = this.buffer[++i];
      if (!ch || ch === "#" || ch === `
`)
        return true;
      if (ch === "\r")
        return this.buffer[i + 1] === `
`;
      return false;
    }
    charAt(n) {
      return this.buffer[this.pos + n];
    }
    continueScalar(offset) {
      let ch = this.buffer[offset];
      if (this.indentNext > 0) {
        let indent = 0;
        while (ch === " ")
          ch = this.buffer[++indent + offset];
        if (ch === "\r") {
          const next = this.buffer[indent + offset + 1];
          if (next === `
` || !next && !this.atEnd)
            return offset + indent + 1;
        }
        return ch === `
` || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
      }
      if (ch === "-" || ch === ".") {
        const dt = this.buffer.substr(offset, 3);
        if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
          return -1;
      }
      return offset;
    }
    getLine() {
      let end = this.lineEndPos;
      if (typeof end !== "number" || end !== -1 && end < this.pos) {
        end = this.buffer.indexOf(`
`, this.pos);
        this.lineEndPos = end;
      }
      if (end === -1)
        return this.atEnd ? this.buffer.substring(this.pos) : null;
      if (this.buffer[end - 1] === "\r")
        end -= 1;
      return this.buffer.substring(this.pos, end);
    }
    hasChars(n) {
      return this.pos + n <= this.buffer.length;
    }
    setNext(state) {
      this.buffer = this.buffer.substring(this.pos);
      this.pos = 0;
      this.lineEndPos = null;
      this.next = state;
      return null;
    }
    peek(n) {
      return this.buffer.substr(this.pos, n);
    }
    *parseNext(next) {
      switch (next) {
        case "stream":
          return yield* this.parseStream();
        case "line-start":
          return yield* this.parseLineStart();
        case "block-start":
          return yield* this.parseBlockStart();
        case "doc":
          return yield* this.parseDocument();
        case "flow":
          return yield* this.parseFlowCollection();
        case "quoted-scalar":
          return yield* this.parseQuotedScalar();
        case "block-scalar":
          return yield* this.parseBlockScalar();
        case "plain-scalar":
          return yield* this.parsePlainScalar();
      }
    }
    *parseStream() {
      let line = this.getLine();
      if (line === null)
        return this.setNext("stream");
      if (line[0] === cst.BOM) {
        yield* this.pushCount(1);
        line = line.substring(1);
      }
      if (line[0] === "%") {
        let dirEnd = line.length;
        let cs = line.indexOf("#");
        while (cs !== -1) {
          const ch = line[cs - 1];
          if (ch === " " || ch === "\t") {
            dirEnd = cs - 1;
            break;
          } else {
            cs = line.indexOf("#", cs + 1);
          }
        }
        while (true) {
          const ch = line[dirEnd - 1];
          if (ch === " " || ch === "\t")
            dirEnd -= 1;
          else
            break;
        }
        const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
        yield* this.pushCount(line.length - n);
        this.pushNewline();
        return "stream";
      }
      if (this.atLineEnd()) {
        const sp = yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - sp);
        yield* this.pushNewline();
        return "stream";
      }
      yield cst.DOCUMENT;
      return yield* this.parseLineStart();
    }
    *parseLineStart() {
      const ch = this.charAt(0);
      if (!ch && !this.atEnd)
        return this.setNext("line-start");
      if (ch === "-" || ch === ".") {
        if (!this.atEnd && !this.hasChars(4))
          return this.setNext("line-start");
        const s = this.peek(3);
        if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
          yield* this.pushCount(3);
          this.indentValue = 0;
          this.indentNext = 0;
          return s === "---" ? "doc" : "stream";
        }
      }
      this.indentValue = yield* this.pushSpaces(false);
      if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
        this.indentNext = this.indentValue;
      return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
      const [ch0, ch1] = this.peek(2);
      if (!ch1 && !this.atEnd)
        return this.setNext("block-start");
      if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
        const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
        this.indentNext = this.indentValue + 1;
        this.indentValue += n;
        return "block-start";
      }
      return "doc";
    }
    *parseDocument() {
      yield* this.pushSpaces(true);
      const line = this.getLine();
      if (line === null)
        return this.setNext("doc");
      let n = yield* this.pushIndicators();
      switch (line[n]) {
        case "#":
          yield* this.pushCount(line.length - n);
        case undefined:
          yield* this.pushNewline();
          return yield* this.parseLineStart();
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel = 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          return "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "doc";
        case '"':
        case "'":
          return yield* this.parseQuotedScalar();
        case "|":
        case ">":
          n += yield* this.parseBlockScalarHeader();
          n += yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - n);
          yield* this.pushNewline();
          return yield* this.parseBlockScalar();
        default:
          return yield* this.parsePlainScalar();
      }
    }
    *parseFlowCollection() {
      let nl, sp;
      let indent = -1;
      do {
        nl = yield* this.pushNewline();
        if (nl > 0) {
          sp = yield* this.pushSpaces(false);
          this.indentValue = indent = sp;
        } else {
          sp = 0;
        }
        sp += yield* this.pushSpaces(true);
      } while (nl + sp > 0);
      const line = this.getLine();
      if (line === null)
        return this.setNext("flow");
      if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
        const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
        if (!atFlowEndMarker) {
          this.flowLevel = 0;
          yield cst.FLOW_END;
          return yield* this.parseLineStart();
        }
      }
      let n = 0;
      while (line[n] === ",") {
        n += yield* this.pushCount(1);
        n += yield* this.pushSpaces(true);
        this.flowKey = false;
      }
      n += yield* this.pushIndicators();
      switch (line[n]) {
        case undefined:
          return "flow";
        case "#":
          yield* this.pushCount(line.length - n);
          return "flow";
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel += 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          this.flowKey = true;
          this.flowLevel -= 1;
          return this.flowLevel ? "flow" : "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "flow";
        case '"':
        case "'":
          this.flowKey = true;
          return yield* this.parseQuotedScalar();
        case ":": {
          const next = this.charAt(1);
          if (this.flowKey || isEmpty(next) || next === ",") {
            this.flowKey = false;
            yield* this.pushCount(1);
            yield* this.pushSpaces(true);
            return "flow";
          }
        }
        default:
          this.flowKey = false;
          return yield* this.parsePlainScalar();
      }
    }
    *parseQuotedScalar() {
      const quote = this.charAt(0);
      let end = this.buffer.indexOf(quote, this.pos + 1);
      if (quote === "'") {
        while (end !== -1 && this.buffer[end + 1] === "'")
          end = this.buffer.indexOf("'", end + 2);
      } else {
        while (end !== -1) {
          let n = 0;
          while (this.buffer[end - 1 - n] === "\\")
            n += 1;
          if (n % 2 === 0)
            break;
          end = this.buffer.indexOf('"', end + 1);
        }
      }
      const qb = this.buffer.substring(0, end);
      let nl = qb.indexOf(`
`, this.pos);
      if (nl !== -1) {
        while (nl !== -1) {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = qb.indexOf(`
`, cs);
        }
        if (nl !== -1) {
          end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
        }
      }
      if (end === -1) {
        if (!this.atEnd)
          return this.setNext("quoted-scalar");
        end = this.buffer.length;
      }
      yield* this.pushToIndex(end + 1, false);
      return this.flowLevel ? "flow" : "doc";
    }
    *parseBlockScalarHeader() {
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      let i = this.pos;
      while (true) {
        const ch = this.buffer[++i];
        if (ch === "+")
          this.blockScalarKeep = true;
        else if (ch > "0" && ch <= "9")
          this.blockScalarIndent = Number(ch) - 1;
        else if (ch !== "-")
          break;
      }
      return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
    }
    *parseBlockScalar() {
      let nl = this.pos - 1;
      let indent = 0;
      let ch;
      loop:
        for (let i2 = this.pos;ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case `
`:
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === `
`)
                break;
            }
            default:
              break loop;
          }
        }
      if (!ch && !this.atEnd)
        return this.setNext("block-scalar");
      if (indent >= this.indentNext) {
        if (this.blockScalarIndent === -1)
          this.indentNext = indent;
        else {
          this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
        }
        do {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = this.buffer.indexOf(`
`, cs);
        } while (nl !== -1);
        if (nl === -1) {
          if (!this.atEnd)
            return this.setNext("block-scalar");
          nl = this.buffer.length;
        }
      }
      let i = nl + 1;
      ch = this.buffer[i];
      while (ch === " ")
        ch = this.buffer[++i];
      if (ch === "\t") {
        while (ch === "\t" || ch === " " || ch === "\r" || ch === `
`)
          ch = this.buffer[++i];
        nl = i - 1;
      } else if (!this.blockScalarKeep) {
        do {
          let i2 = nl - 1;
          let ch2 = this.buffer[i2];
          if (ch2 === "\r")
            ch2 = this.buffer[--i2];
          const lastChar = i2;
          while (ch2 === " ")
            ch2 = this.buffer[--i2];
          if (ch2 === `
` && i2 >= this.pos && i2 + 1 + indent > lastChar)
            nl = i2;
          else
            break;
        } while (true);
      }
      yield cst.SCALAR;
      yield* this.pushToIndex(nl + 1, true);
      return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
      const inFlow = this.flowLevel > 0;
      let end = this.pos - 1;
      let i = this.pos - 1;
      let ch;
      while (ch = this.buffer[++i]) {
        if (ch === ":") {
          const next = this.buffer[i + 1];
          if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
            break;
          end = i;
        } else if (isEmpty(ch)) {
          let next = this.buffer[i + 1];
          if (ch === "\r") {
            if (next === `
`) {
              i += 1;
              ch = `
`;
              next = this.buffer[i + 1];
            } else
              end = i;
          }
          if (next === "#" || inFlow && flowIndicatorChars.has(next))
            break;
          if (ch === `
`) {
            const cs = this.continueScalar(i + 1);
            if (cs === -1)
              break;
            i = Math.max(i, cs - 2);
          }
        } else {
          if (inFlow && flowIndicatorChars.has(ch))
            break;
          end = i;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("plain-scalar");
      yield cst.SCALAR;
      yield* this.pushToIndex(end + 1, true);
      return inFlow ? "flow" : "doc";
    }
    *pushCount(n) {
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos += n;
        return n;
      }
      return 0;
    }
    *pushToIndex(i, allowEmpty) {
      const s = this.buffer.slice(this.pos, i);
      if (s) {
        yield s;
        this.pos += s.length;
        return s.length;
      } else if (allowEmpty)
        yield "";
      return 0;
    }
    *pushIndicators() {
      let n = 0;
      loop:
        while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            case "?":
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
      return n;
    }
    *pushTag() {
      if (this.charAt(1) === "<") {
        let i = this.pos + 2;
        let ch = this.buffer[i];
        while (!isEmpty(ch) && ch !== ">")
          ch = this.buffer[++i];
        return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
      } else {
        let i = this.pos + 1;
        let ch = this.buffer[i];
        while (ch) {
          if (tagChars.has(ch))
            ch = this.buffer[++i];
          else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
            ch = this.buffer[i += 3];
          } else
            break;
        }
        return yield* this.pushToIndex(i, false);
      }
    }
    *pushNewline() {
      const ch = this.buffer[this.pos];
      if (ch === `
`)
        return yield* this.pushCount(1);
      else if (ch === "\r" && this.charAt(1) === `
`)
        return yield* this.pushCount(2);
      else
        return 0;
    }
    *pushSpaces(allowTabs) {
      let i = this.pos - 1;
      let ch;
      do {
        ch = this.buffer[++i];
      } while (ch === " " || allowTabs && ch === "\t");
      const n = i - this.pos;
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos = i;
      }
      return n;
    }
    *pushUntil(test) {
      let i = this.pos;
      let ch = this.buffer[i];
      while (!test(ch))
        ch = this.buffer[++i];
      return yield* this.pushToIndex(i, false);
    }
  }
  exports.Lexer = Lexer;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS((exports) => {
  class LineCounter {
    constructor() {
      this.lineStarts = [];
      this.addNewLine = (offset) => this.lineStarts.push(offset);
      this.linePos = (offset) => {
        let low = 0;
        let high = this.lineStarts.length;
        while (low < high) {
          const mid = low + high >> 1;
          if (this.lineStarts[mid] < offset)
            low = mid + 1;
          else
            high = mid;
        }
        if (this.lineStarts[low] === offset)
          return { line: low + 1, col: 1 };
        if (low === 0)
          return { line: 0, col: offset };
        const start = this.lineStarts[low - 1];
        return { line: low, col: offset - start + 1 };
      };
    }
  }
  exports.LineCounter = LineCounter;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS((exports) => {
  var node_process = __require("process");
  var cst = require_cst();
  var lexer = require_lexer();
  function includesToken(list, type) {
    for (let i = 0;i < list.length; ++i)
      if (list[i].type === type)
        return true;
    return false;
  }
  function findNonEmptyIndex(list) {
    for (let i = 0;i < list.length; ++i) {
      switch (list[i].type) {
        case "space":
        case "comment":
        case "newline":
          break;
        default:
          return i;
      }
    }
    return -1;
  }
  function isFlowToken(token) {
    switch (token?.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "flow-collection":
        return true;
      default:
        return false;
    }
  }
  function getPrevProps(parent) {
    switch (parent.type) {
      case "document":
        return parent.start;
      case "block-map": {
        const it = parent.items[parent.items.length - 1];
        return it.sep ?? it.start;
      }
      case "block-seq":
        return parent.items[parent.items.length - 1].start;
      default:
        return [];
    }
  }
  function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
      return [];
    let i = prev.length;
    loop:
      while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
    while (prev[++i]?.type === "space") {
    }
    return prev.splice(i, prev.length);
  }
  function arrayPushArray(target, source) {
    if (source.length < 1e5)
      Array.prototype.push.apply(target, source);
    else
      for (let i = 0;i < source.length; ++i)
        target.push(source[i]);
  }
  function fixFlowSeqItems(fc) {
    if (fc.start.type === "flow-seq-start") {
      for (const it of fc.items) {
        if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
          if (it.key)
            it.value = it.key;
          delete it.key;
          if (isFlowToken(it.value)) {
            if (it.value.end)
              arrayPushArray(it.value.end, it.sep);
            else
              it.value.end = it.sep;
          } else
            arrayPushArray(it.start, it.sep);
          delete it.sep;
        }
      }
    }
  }

  class Parser {
    constructor(onNewLine) {
      this.atNewLine = true;
      this.atScalar = false;
      this.indent = 0;
      this.offset = 0;
      this.onKeyLine = false;
      this.stack = [];
      this.source = "";
      this.type = "";
      this.lexer = new lexer.Lexer;
      this.onNewLine = onNewLine;
    }
    *parse(source, incomplete = false) {
      if (this.onNewLine && this.offset === 0)
        this.onNewLine(0);
      for (const lexeme of this.lexer.lex(source, incomplete))
        yield* this.next(lexeme);
      if (!incomplete)
        yield* this.end();
    }
    *next(source) {
      this.source = source;
      if (node_process.env.LOG_TOKENS)
        console.log("|", cst.prettyToken(source));
      if (this.atScalar) {
        this.atScalar = false;
        yield* this.step();
        this.offset += source.length;
        return;
      }
      const type = cst.tokenType(source);
      if (!type) {
        const message = `Not a YAML token: ${source}`;
        yield* this.pop({ type: "error", offset: this.offset, message, source });
        this.offset += source.length;
      } else if (type === "scalar") {
        this.atNewLine = false;
        this.atScalar = true;
        this.type = "scalar";
      } else {
        this.type = type;
        yield* this.step();
        switch (type) {
          case "newline":
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine)
              this.onNewLine(this.offset + source.length);
            break;
          case "space":
            if (this.atNewLine && source[0] === " ")
              this.indent += source.length;
            break;
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
            if (this.atNewLine)
              this.indent += source.length;
            break;
          case "doc-mode":
          case "flow-error-end":
            return;
          default:
            this.atNewLine = false;
        }
        this.offset += source.length;
      }
    }
    *end() {
      while (this.stack.length > 0)
        yield* this.pop();
    }
    get sourceToken() {
      const st = {
        type: this.type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
      return st;
    }
    *step() {
      const top = this.peek(1);
      if (this.type === "doc-end" && top?.type !== "doc-end") {
        while (this.stack.length > 0)
          yield* this.pop();
        this.stack.push({
          type: "doc-end",
          offset: this.offset,
          source: this.source
        });
        return;
      }
      if (!top)
        return yield* this.stream();
      switch (top.type) {
        case "document":
          return yield* this.document(top);
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return yield* this.scalar(top);
        case "block-scalar":
          return yield* this.blockScalar(top);
        case "block-map":
          return yield* this.blockMap(top);
        case "block-seq":
          return yield* this.blockSequence(top);
        case "flow-collection":
          return yield* this.flowCollection(top);
        case "doc-end":
          return yield* this.documentEnd(top);
      }
      yield* this.pop();
    }
    peek(n) {
      return this.stack[this.stack.length - n];
    }
    *pop(error) {
      const token = error ?? this.stack.pop();
      if (!token) {
        const message = "Tried to pop an empty stack";
        yield { type: "error", offset: this.offset, source: "", message };
      } else if (this.stack.length === 0) {
        yield token;
      } else {
        const top = this.peek(1);
        if (token.type === "block-scalar") {
          token.indent = "indent" in top ? top.indent : 0;
        } else if (token.type === "flow-collection" && top.type === "document") {
          token.indent = 0;
        }
        if (token.type === "flow-collection")
          fixFlowSeqItems(token);
        switch (top.type) {
          case "document":
            top.value = token;
            break;
          case "block-scalar":
            top.props.push(token);
            break;
          case "block-map": {
            const it = top.items[top.items.length - 1];
            if (it.value) {
              top.items.push({ start: [], key: token, sep: [] });
              this.onKeyLine = true;
              return;
            } else if (it.sep) {
              it.value = token;
            } else {
              Object.assign(it, { key: token, sep: [] });
              this.onKeyLine = !it.explicitKey;
              return;
            }
            break;
          }
          case "block-seq": {
            const it = top.items[top.items.length - 1];
            if (it.value)
              top.items.push({ start: [], value: token });
            else
              it.value = token;
            break;
          }
          case "flow-collection": {
            const it = top.items[top.items.length - 1];
            if (!it || it.value)
              top.items.push({ start: [], key: token, sep: [] });
            else if (it.sep)
              it.value = token;
            else
              Object.assign(it, { key: token, sep: [] });
            return;
          }
          default:
            yield* this.pop();
            yield* this.pop(token);
        }
        if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
          const last = token.items[token.items.length - 1];
          if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
            if (top.type === "document")
              top.end = last.start;
            else
              top.items.push({ start: last.start });
            token.items.splice(-1, 1);
          }
        }
      }
    }
    *stream() {
      switch (this.type) {
        case "directive-line":
          yield { type: "directive", offset: this.offset, source: this.source };
          return;
        case "byte-order-mark":
        case "space":
        case "comment":
        case "newline":
          yield this.sourceToken;
          return;
        case "doc-mode":
        case "doc-start": {
          const doc = {
            type: "document",
            offset: this.offset,
            start: []
          };
          if (this.type === "doc-start")
            doc.start.push(this.sourceToken);
          this.stack.push(doc);
          return;
        }
      }
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML stream`,
        source: this.source
      };
    }
    *document(doc) {
      if (doc.value)
        return yield* this.lineEnd(doc);
      switch (this.type) {
        case "doc-start": {
          if (findNonEmptyIndex(doc.start) !== -1) {
            yield* this.pop();
            yield* this.step();
          } else
            doc.start.push(this.sourceToken);
          return;
        }
        case "anchor":
        case "tag":
        case "space":
        case "comment":
        case "newline":
          doc.start.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(doc);
      if (bv)
        this.stack.push(bv);
      else {
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML document`,
          source: this.source
        };
      }
    }
    *scalar(scalar) {
      if (this.type === "map-value-ind") {
        const prev = getPrevProps(this.peek(2));
        const start = getFirstKeyStartProps(prev);
        let sep;
        if (scalar.end) {
          sep = scalar.end;
          sep.push(this.sourceToken);
          delete scalar.end;
        } else
          sep = [this.sourceToken];
        const map = {
          type: "block-map",
          offset: scalar.offset,
          indent: scalar.indent,
          items: [{ start, key: scalar, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map;
      } else
        yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
      switch (this.type) {
        case "space":
        case "comment":
        case "newline":
          scalar.props.push(this.sourceToken);
          return;
        case "scalar":
          scalar.source = this.source;
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine) {
            let nl = this.source.indexOf(`
`) + 1;
            while (nl !== 0) {
              this.onNewLine(this.offset + nl);
              nl = this.source.indexOf(`
`, nl) + 1;
            }
          }
          yield* this.pop();
          break;
        default:
          yield* this.pop();
          yield* this.step();
      }
    }
    *blockMap(map) {
      const it = map.items[map.items.length - 1];
      switch (this.type) {
        case "newline":
          this.onKeyLine = false;
          if (it.value) {
            const end = "end" in it.value ? it.value.end : undefined;
            const last = Array.isArray(end) ? end[end.length - 1] : undefined;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              map.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "space":
        case "comment":
          if (it.value) {
            map.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            if (this.atIndentedComment(it.start, map.indent)) {
              const prev = map.items[map.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                map.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
      }
      if (this.indent >= map.indent) {
        const atMapIndent = !this.onKeyLine && this.indent === map.indent;
        const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
        let start = [];
        if (atNextItem && it.sep && !it.value) {
          const nl = [];
          for (let i = 0;i < it.sep.length; ++i) {
            const st = it.sep[i];
            switch (st.type) {
              case "newline":
                nl.push(i);
                break;
              case "space":
                break;
              case "comment":
                if (st.indent > map.indent)
                  nl.length = 0;
                break;
              default:
                nl.length = 0;
            }
          }
          if (nl.length >= 2)
            start = it.sep.splice(nl[1]);
        }
        switch (this.type) {
          case "anchor":
          case "tag":
            if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map.items.push({ start });
              this.onKeyLine = true;
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "explicit-key-ind":
            if (!it.sep && !it.explicitKey) {
              it.start.push(this.sourceToken);
              it.explicitKey = true;
            } else if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map.items.push({ start, explicitKey: true });
            } else {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [this.sourceToken], explicitKey: true }]
              });
            }
            this.onKeyLine = true;
            return;
          case "map-value-ind":
            if (it.explicitKey) {
              if (!it.sep) {
                if (includesToken(it.start, "newline")) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else {
                  const start2 = getFirstKeyStartProps(it.start);
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                  });
                }
              } else if (it.value) {
                map.items.push({ start: [], key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start, key: null, sep: [this.sourceToken] }]
                });
              } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                const start2 = getFirstKeyStartProps(it.start);
                const key = it.key;
                const sep = it.sep;
                sep.push(this.sourceToken);
                delete it.key;
                delete it.sep;
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key, sep }]
                });
              } else if (start.length > 0) {
                it.sep = it.sep.concat(start, this.sourceToken);
              } else {
                it.sep.push(this.sourceToken);
              }
            } else {
              if (!it.sep) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else if (it.value || atNextItem) {
                map.items.push({ start, key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [], key: null, sep: [this.sourceToken] }]
                });
              } else {
                it.sep.push(this.sourceToken);
              }
            }
            this.onKeyLine = true;
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (atNextItem || it.value) {
              map.items.push({ start, key: fs, sep: [] });
              this.onKeyLine = true;
            } else if (it.sep) {
              this.stack.push(fs);
            } else {
              Object.assign(it, { key: fs, sep: [] });
              this.onKeyLine = true;
            }
            return;
          }
          default: {
            const bv = this.startBlockValue(map);
            if (bv) {
              if (bv.type === "block-seq") {
                if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                  yield* this.pop({
                    type: "error",
                    offset: this.offset,
                    message: "Unexpected block-seq-ind on same line with key",
                    source: this.source
                  });
                  return;
                }
              } else if (atMapIndent) {
                map.items.push({ start });
              }
              this.stack.push(bv);
              return;
            }
          }
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *blockSequence(seq) {
      const it = seq.items[seq.items.length - 1];
      switch (this.type) {
        case "newline":
          if (it.value) {
            const end = "end" in it.value ? it.value.end : undefined;
            const last = Array.isArray(end) ? end[end.length - 1] : undefined;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              seq.items.push({ start: [this.sourceToken] });
          } else
            it.start.push(this.sourceToken);
          return;
        case "space":
        case "comment":
          if (it.value)
            seq.items.push({ start: [this.sourceToken] });
          else {
            if (this.atIndentedComment(it.start, seq.indent)) {
              const prev = seq.items[seq.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                seq.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
        case "anchor":
        case "tag":
          if (it.value || this.indent <= seq.indent)
            break;
          it.start.push(this.sourceToken);
          return;
        case "seq-item-ind":
          if (this.indent !== seq.indent)
            break;
          if (it.value || includesToken(it.start, "seq-item-ind"))
            seq.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
      }
      if (this.indent > seq.indent) {
        const bv = this.startBlockValue(seq);
        if (bv) {
          this.stack.push(bv);
          return;
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *flowCollection(fc) {
      const it = fc.items[fc.items.length - 1];
      if (this.type === "flow-error-end") {
        let top;
        do {
          yield* this.pop();
          top = this.peek(1);
        } while (top?.type === "flow-collection");
      } else if (fc.end.length === 0) {
        switch (this.type) {
          case "comma":
          case "explicit-key-ind":
            if (!it || it.sep)
              fc.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
          case "map-value-ind":
            if (!it || it.value)
              fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            return;
          case "space":
          case "comment":
          case "newline":
          case "anchor":
          case "tag":
            if (!it || it.value)
              fc.items.push({ start: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              it.start.push(this.sourceToken);
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (!it || it.value)
              fc.items.push({ start: [], key: fs, sep: [] });
            else if (it.sep)
              this.stack.push(fs);
            else
              Object.assign(it, { key: fs, sep: [] });
            return;
          }
          case "flow-map-end":
          case "flow-seq-end":
            fc.end.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(fc);
        if (bv)
          this.stack.push(bv);
        else {
          yield* this.pop();
          yield* this.step();
        }
      } else {
        const parent = this.peek(2);
        if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
          yield* this.pop();
          yield* this.step();
        } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          fixFlowSeqItems(fc);
          const sep = fc.end.splice(1, fc.end.length);
          sep.push(this.sourceToken);
          const map = {
            type: "block-map",
            offset: fc.offset,
            indent: fc.indent,
            items: [{ start, key: fc, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else {
          yield* this.lineEnd(fc);
        }
      }
    }
    flowScalar(type) {
      if (this.onNewLine) {
        let nl = this.source.indexOf(`
`) + 1;
        while (nl !== 0) {
          this.onNewLine(this.offset + nl);
          nl = this.source.indexOf(`
`, nl) + 1;
        }
      }
      return {
        type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
    }
    startBlockValue(parent) {
      switch (this.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return this.flowScalar(this.type);
        case "block-scalar-header":
          return {
            type: "block-scalar",
            offset: this.offset,
            indent: this.indent,
            props: [this.sourceToken],
            source: ""
          };
        case "flow-map-start":
        case "flow-seq-start":
          return {
            type: "flow-collection",
            offset: this.offset,
            indent: this.indent,
            start: this.sourceToken,
            items: [],
            end: []
          };
        case "seq-item-ind":
          return {
            type: "block-seq",
            offset: this.offset,
            indent: this.indent,
            items: [{ start: [this.sourceToken] }]
          };
        case "explicit-key-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          start.push(this.sourceToken);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, explicitKey: true }]
          };
        }
        case "map-value-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, key: null, sep: [this.sourceToken] }]
          };
        }
      }
      return null;
    }
    atIndentedComment(start, indent) {
      if (this.type !== "comment")
        return false;
      if (this.indent <= indent)
        return false;
      return start.every((st) => st.type === "newline" || st.type === "space");
    }
    *documentEnd(docEnd) {
      if (this.type !== "doc-mode") {
        if (docEnd.end)
          docEnd.end.push(this.sourceToken);
        else
          docEnd.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
      }
    }
    *lineEnd(token) {
      switch (this.type) {
        case "comma":
        case "doc-start":
        case "doc-end":
        case "flow-seq-end":
        case "flow-map-end":
        case "map-value-ind":
          yield* this.pop();
          yield* this.step();
          break;
        case "newline":
          this.onKeyLine = false;
        case "space":
        case "comment":
        default:
          if (token.end)
            token.end.push(this.sourceToken);
          else
            token.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
      }
    }
  }
  exports.Parser = Parser;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS((exports) => {
  var composer = require_composer();
  var Document = require_Document();
  var errors = require_errors();
  var log = require_log();
  var identity = require_identity();
  var lineCounter = require_line_counter();
  var parser = require_parser();
  function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter || null;
    return { lineCounter: lineCounter$1, prettyErrors };
  }
  function parseAllDocuments(source, options = {}) {
    const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
    const composer$1 = new composer.Composer(options);
    const docs = Array.from(composer$1.compose(parser$1.parse(source)));
    if (prettyErrors && lineCounter2)
      for (const doc of docs) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
    if (docs.length > 0)
      return docs;
    return Object.assign([], { empty: true }, composer$1.streamInfo());
  }
  function parseDocument(source, options = {}) {
    const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
    const composer$1 = new composer.Composer(options);
    let doc = null;
    for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
      if (!doc)
        doc = _doc;
      else if (doc.options.logLevel !== "silent") {
        doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
        break;
      }
    }
    if (prettyErrors && lineCounter2) {
      doc.errors.forEach(errors.prettifyError(source, lineCounter2));
      doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
    }
    return doc;
  }
  function parse(src, reviver, options) {
    let _reviver = undefined;
    if (typeof reviver === "function") {
      _reviver = reviver;
    } else if (options === undefined && reviver && typeof reviver === "object") {
      options = reviver;
    }
    const doc = parseDocument(src, options);
    if (!doc)
      return null;
    doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
    if (doc.errors.length > 0) {
      if (doc.options.logLevel !== "silent")
        throw doc.errors[0];
      else
        doc.errors = [];
    }
    return doc.toJS(Object.assign({ reviver: _reviver }, options));
  }
  function stringify(value, replacer, options) {
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === undefined && replacer) {
      options = replacer;
    }
    if (typeof options === "string")
      options = options.length;
    if (typeof options === "number") {
      const indent = Math.round(options);
      options = indent < 1 ? undefined : indent > 8 ? { indent: 8 } : { indent };
    }
    if (value === undefined) {
      const { keepUndefined } = options ?? replacer ?? {};
      if (!keepUndefined)
        return;
    }
    if (identity.isDocument(value) && !_replacer)
      return value.toString(options);
    return new Document.Document(value, _replacer, options).toString(options);
  }
  exports.parse = parse;
  exports.parseAllDocuments = parseAllDocuments;
  exports.parseDocument = parseDocument;
  exports.stringify = stringify;
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js
var composer, Document, Schema, errors, Alias, identity, Pair, Scalar, YAMLMap, YAMLSeq, cst, lexer, lineCounter, parser, publicApi, visit, $Composer, $Document, $Schema, $YAMLError, $YAMLParseError, $YAMLWarning, $Alias, $isAlias, $isCollection, $isDocument, $isMap, $isNode, $isPair, $isScalar, $isSeq, $Pair, $Scalar, $YAMLMap, $YAMLSeq, $Lexer, $LineCounter, $Parser, $parse, $parseAllDocuments, $parseDocument, $stringify, $visit, $visitAsync;
var init_dist4 = __esm(() => {
  composer = require_composer();
  Document = require_Document();
  Schema = require_Schema();
  errors = require_errors();
  Alias = require_Alias();
  identity = require_identity();
  Pair = require_Pair();
  Scalar = require_Scalar();
  YAMLMap = require_YAMLMap();
  YAMLSeq = require_YAMLSeq();
  cst = require_cst();
  lexer = require_lexer();
  lineCounter = require_line_counter();
  parser = require_parser();
  publicApi = require_public_api();
  visit = require_visit();
  $Composer = composer.Composer;
  $Document = Document.Document;
  $Schema = Schema.Schema;
  $YAMLError = errors.YAMLError;
  $YAMLParseError = errors.YAMLParseError;
  $YAMLWarning = errors.YAMLWarning;
  $Alias = Alias.Alias;
  $isAlias = identity.isAlias;
  $isCollection = identity.isCollection;
  $isDocument = identity.isDocument;
  $isMap = identity.isMap;
  $isNode = identity.isNode;
  $isPair = identity.isPair;
  $isScalar = identity.isScalar;
  $isSeq = identity.isSeq;
  $Pair = Pair.Pair;
  $Scalar = Scalar.Scalar;
  $YAMLMap = YAMLMap.YAMLMap;
  $YAMLSeq = YAMLSeq.YAMLSeq;
  $Lexer = lexer.Lexer;
  $LineCounter = lineCounter.LineCounter;
  $Parser = parser.Parser;
  $parse = publicApi.parse;
  $parseAllDocuments = publicApi.parseAllDocuments;
  $parseDocument = publicApi.parseDocument;
  $stringify = publicApi.stringify;
  $visit = visit.visit;
  $visitAsync = visit.visitAsync;
});

// packages/cli/src/lib/deepseek/core.ts
import { createHash as createHash4, randomUUID as randomUUID13 } from "crypto";
import { mkdir as mkdir10, rename as rename4, writeFile as writeFile8 } from "fs/promises";
import { dirname, join as join2 } from "path";
function modelInput(model) {
  return model.attachment && model.modalities.input.includes("image") ? ["text", "image"] : ["text"];
}
function reasoningEfforts(model) {
  if (!model.reasoningEfforts || model.reasoningEfforts.length === 0) {
    return;
  }
  return Object.fromEntries(model.reasoningEfforts.map((effort) => [effort, effort]));
}
function buildDeepseekPatch(selectedModel, baseUrl = TOGETHER_BASE_URL2, nativeDeepseekApiKey = process.env[NATIVE_DEEPSEEK_API_KEY_ENV]) {
  const patch = [
    {
      id: "llm-pi-ai",
      config: {
        providers: {
          togetherlink: {
            displayName: "Together AI via TogetherLink",
            apiKeyEnv: DEEPSEEK_API_KEY_ENV,
            api: "openai-completions",
            baseURL: baseUrl,
            compat: { thinkingFormat: "together", supportsReasoningEffort: true },
            models: CODEX_SUPPORTED_MODELS.map(({ definition }) => {
              const efforts = reasoningEfforts(definition);
              return {
                id: definition.id,
                name: definition.name,
                contextWindow: definition.limit.context,
                maxTokens: definition.limit.output,
                input: modelInput(definition),
                ...efforts ? { reasoningEfforts: efforts } : {}
              };
            })
          }
        }
      }
    },
    {
      id: "agent-default-model",
      config: { provider: DEEPSEEK_PROVIDER_ID, model: selectedModel.id }
    }
  ];
  if (!nativeDeepseekApiKey?.trim()) {
    patch.push({ id: "llm-deepseek", disabled: true });
  }
  return patch;
}
function buildDeepseekPatchSource(selectedModel, baseUrl = TOGETHER_BASE_URL2, nativeDeepseekApiKey = process.env[NATIVE_DEEPSEEK_API_KEY_ENV]) {
  return `# Generated by TogetherLink. Contains model metadata only; no credentials.
${$stringify(buildDeepseekPatch(selectedModel, baseUrl, nativeDeepseekApiKey))}`;
}
function resolveDeepseekPatchPath(home, selectedModel, baseUrl = TOGETHER_BASE_URL2, env = process.env) {
  const togetherlinkRoot = env.TOGETHERLINK_HOME?.trim() || join2(home, ".togetherlink");
  const contentHash = createHash4("sha256").update(buildDeepseekPatchSource(selectedModel, baseUrl, env[NATIVE_DEEPSEEK_API_KEY_ENV])).digest("hex").slice(0, 12);
  return join2(togetherlinkRoot, "deepseek-harness", `together-provider-${contentHash}.cordis.yml`);
}
async function writeDeepseekPatch(filePath, selectedModel, baseUrl = TOGETHER_BASE_URL2, nativeDeepseekApiKey = process.env[NATIVE_DEEPSEEK_API_KEY_ENV]) {
  await mkdir10(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID13()}`;
  await writeFile8(temporaryPath, buildDeepseekPatchSource(selectedModel, baseUrl, nativeDeepseekApiKey), { mode: 384 });
  await rename4(temporaryPath, filePath);
}
function argsWithoutPatchOverrides(args) {
  const sanitized = [];
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--patch") {
      index += 1;
      continue;
    }
    if (arg?.startsWith("--patch=")) {
      continue;
    }
    if (arg !== undefined) {
      sanitized.push(arg);
    }
  }
  return sanitized;
}
function buildDeepseekLaunchSpec({
  apiKey,
  baseUrl,
  patchPath,
  passthrough,
  env = process.env
}) {
  return {
    binary: "dsh",
    args: ["web", "--patch", patchPath, ...argsWithoutPatchOverrides(passthrough)],
    env: {
      ...env,
      TOGETHER_API_KEY: apiKey,
      TOGETHER_BASE_URL: baseUrl
    }
  };
}
var DEEPSEEK_PROVIDER_ID = "togetherlink", DEEPSEEK_API_KEY_ENV = "TOGETHER_API_KEY", NATIVE_DEEPSEEK_API_KEY_ENV = "DEEPSEEK_API_KEY";
var init_core3 = __esm(() => {
  init_dist4();
  init_defaults2();
  init_together_core();
});

// packages/cli/src/lib/spawned-session.ts
import { spawn as spawn3 } from "child_process";
async function runTrackedSpawnedSession(spec) {
  const sessionId = randomSessionId();
  const startedAt = Date.now();
  if (!telemetryDisabledByEnvironment()) {
    await getInstallId(spec.home);
  }
  const startedTelemetry = sendTelemetryEvent({
    event: "session_started",
    sessionId,
    agent: spec.agent,
    initialModel: spec.modelId,
    startedAt,
    metadata: { usageTracking: "lifecycle_only" }
  }, spec.home);
  const child = spawn3(spec.binary, spec.args, spec.options);
  const result = await new Promise((resolve) => {
    child.on("error", (error) => {
      process.stderr.write(`togetherlink \u25B8 Failed to launch ${spec.binary}: ${error.message}.
`);
      resolve({ status: 1, signal: null });
    });
    child.on("exit", (status, signal) => resolve({ status, signal }));
  });
  const endedAt = Date.now();
  await Promise.all([
    startedTelemetry,
    sendTelemetryEvent({
      event: "session_ended",
      sessionId,
      agent: spec.agent,
      initialModel: spec.modelId,
      finalModel: spec.modelId,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      ...typeof result.status === "number" ? { exitCode: result.status } : {},
      ...result.signal ? { signal: result.signal } : {},
      metadata: { usageTracking: "lifecycle_only" }
    }, spec.home)
  ]);
  return result;
}
var init_spawned_session = __esm(() => {
  init_telemetry();
});

// packages/cli/src/lib/harnesses/deepseek.ts
var exports_deepseek = {};
__export(exports_deepseek, {
  default: () => deepseek_default
});
var deepseek_default;
var init_deepseek = __esm(() => {
  init_defaults2();
  init_core3();
  init_harness();
  init_spawned_session();
  init_together_core();
  deepseek_default = defineHarness({
    id: HARNESS.DEEPSEEK,
    label: "DeepSeek Harness (alpha)",
    async run(ctx) {
      const apiKey = await resolveTogetherApiKey({ apiKey: ctx.apiKey, home: ctx.home });
      if (!apiKey) {
        throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
      }
      const selectedModel = resolveCodexModel(ctx.main);
      const baseUrl = resolveTogetherBaseUrl();
      const nativeDeepseekApiKey = process.env.DEEPSEEK_API_KEY;
      const patchPath = resolveDeepseekPatchPath(ctx.home, selectedModel, baseUrl, process.env);
      await writeDeepseekPatch(patchPath, selectedModel, baseUrl, nativeDeepseekApiKey);
      const launch = buildDeepseekLaunchSpec({
        apiKey,
        baseUrl,
        patchPath,
        passthrough: ctx.passthrough ?? []
      });
      if (process.env.TOGETHERLINK_DEBUG === "1") {
        process.stderr.write(`[togetherlink deepseek] model: ${selectedModel.id}
`);
        process.stderr.write(`[togetherlink deepseek] patch: ${patchPath}
`);
      }
      process.stderr.write(`togetherlink \u25B8 Launching DeepSeek Harness web UI with Together AI (alpha).
`);
      const result = await runTrackedSpawnedSession({
        agent: HARNESS.DEEPSEEK,
        modelId: selectedModel.id,
        binary: launch.binary,
        args: launch.args,
        options: { env: launch.env, stdio: "inherit" },
        home: ctx.home
      });
      if (typeof result.status === "number") {
        process.exitCode = result.status;
      }
      return {};
    }
  });
});

// packages/cli/src/lib/grok/core.ts
import { createServer } from "http";
function buildGrokIdentityRule(model) {
  return `Grok Build is only the terminal harness. You are ${model.name} (${model.id}), served by Together AI via togetherlink. You are not Grok or an xAI model. For identity questions, name this backend and Together AI; never claim xAI built or serves you.`;
}
function buildGrokModelCatalog(baseUrl = TOGETHER_BASE_URL) {
  return {
    object: "list",
    data: SELECTABLE_MODELS.map((model) => ({
      id: model.id,
      model: model.id,
      name: `Together AI \xB7 ${model.name}`,
      description: `Direct Together API model: ${model.id}`,
      base_url: baseUrl,
      api_backend: "chat_completions",
      context_window: model.limit.context,
      max_completion_tokens: Math.min(model.limit.output, GROK_MAX_COMPLETION_TOKENS),
      user_selectable: true
    }))
  };
}
async function startGrokModelCatalogServer(baseUrl = TOGETHER_BASE_URL) {
  const body = JSON.stringify(buildGrokModelCatalog(baseUrl));
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (request.method === "GET" && pathname === "/v1/models") {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-length": Buffer.byteLength(body),
        "content-type": "application/json; charset=utf-8"
      });
      response.end(body);
      return;
    }
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end('{"error":"not_found"}');
  });
  await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address();
  return {
    modelsListUrl: `http://127.0.0.1:${address.port}/v1/models`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}
function buildGrokLaunchEnvironment({
  inheritedEnv,
  apiKey,
  authPath,
  baseUrl,
  modelsListUrl,
  selectedModel
}) {
  const env = {
    ...inheritedEnv,
    [GROK_API_KEY_ENV]: apiKey,
    [GROK_XAI_API_KEY_ENV]: apiKey,
    GROK_XAI_API_BASE_URL: new URL(".", modelsListUrl).toString().replace(/\/$/, ""),
    GROK_AUTH_PATH: authPath,
    GROK_MODELS_BASE_URL: baseUrl,
    GROK_MODELS_LIST_URL: modelsListUrl,
    GROK_DEFAULT_MODEL: selectedModel.id,
    GROK_SESSION_SUMMARY_MODEL: selectedModel.id,
    GROK_IMAGE_DESCRIPTION_MODEL: VISION_PRIMARY.id,
    GROK_PROMPT_SUGGESTIONS_MODEL: selectedModel.id,
    GROK_SUGGESTIONS_AI_MODEL: selectedModel.id,
    GROK_WORKFLOWS: "1",
    GROK_IMAGE_GEN: "0",
    GROK_IMAGE_EDIT: "0",
    GROK_VOICE_MODE: "0",
    GROK_TELEMETRY_ENABLED: "0",
    GROK_FEEDBACK_ENABLED: "0"
  };
  delete env.GROK_AUTH;
  delete env.GROK_DISABLE_API_KEY_AUTH;
  if (!env.GROK_HOME?.trim())
    delete env.GROK_HOME;
  return env;
}
function grokArgsWithoutTogetherlinkOverrides(args) {
  const sanitized = [];
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined)
      continue;
    if (arg === "--model" || arg === "-m") {
      index += 1;
      continue;
    }
    if (arg.startsWith("--model=") || arg.startsWith("-m") && arg.length > 2)
      continue;
    sanitized.push(arg);
  }
  return sanitized;
}
function grokArgsWithTogetherlinkIdentity(args, identityRule = GROK_IDENTITY_RULE) {
  const sanitized = grokArgsWithoutTogetherlinkOverrides(args);
  const passthrough = [];
  const userRules = [];
  let systemPromptOverride;
  for (let index = 0;index < sanitized.length; index += 1) {
    const arg = sanitized[index];
    if (arg === undefined)
      continue;
    if (arg === "--disable-web-search") {
      continue;
    }
    if (arg === "--rules" || arg === "--append-system-prompt") {
      const value = sanitized[index + 1];
      if (value !== undefined) {
        userRules.push(value);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--rules=") || arg.startsWith("--append-system-prompt=")) {
      userRules.push(arg.slice(arg.indexOf("=") + 1));
      continue;
    }
    if (arg === "--system-prompt-override" || arg === "--system-prompt") {
      const value = sanitized[index + 1];
      if (value !== undefined) {
        systemPromptOverride = value;
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--system-prompt-override=") || arg.startsWith("--system-prompt=")) {
      systemPromptOverride = arg.slice(arg.indexOf("=") + 1);
      continue;
    }
    passthrough.push(arg);
  }
  if (systemPromptOverride !== undefined) {
    return [
      "--disable-web-search",
      `--system-prompt-override=${joinPromptRules(systemPromptOverride, identityRule)}`,
      ...passthrough
    ];
  }
  return [
    "--disable-web-search",
    "--rules",
    joinPromptRules(identityRule, ...userRules),
    ...passthrough
  ];
}
function joinPromptRules(...rules) {
  return rules.filter((rule) => rule.trim().length > 0).join(`

`);
}
var GROK_API_KEY_ENV = "TOGETHER_API_KEY", GROK_XAI_API_KEY_ENV = "XAI_API_KEY", GROK_MAX_COMPLETION_TOKENS = 8192, GROK_IDENTITY_RULE = "Grok Build is only the terminal harness. You are the selected Together AI model via togetherlink, not Grok or an xAI model. For identity questions, name the selected backend and Together AI; never claim xAI built or serves you.";
var init_core4 = __esm(() => {
  init_dist3();
});

// packages/cli/src/lib/harnesses/grok.ts
var exports_grok = {};
__export(exports_grok, {
  default: () => grok_default
});
import { mkdtempSync as mkdtempSync2, rmSync as rmSync2 } from "fs";
import { tmpdir as tmpdir2 } from "os";
import { join as join3 } from "path";
var grok_default;
var init_grok = __esm(() => {
  init_defaults2();
  init_core4();
  init_harness();
  init_spawned_session();
  init_together_core();
  grok_default = defineHarness({
    id: HARNESS.GROK,
    label: "Grok Build",
    async run(ctx) {
      const apiKey = await resolveTogetherApiKey({ apiKey: ctx.apiKey, home: ctx.home });
      if (!apiKey) {
        throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
      }
      const selectedModel = resolveCodexModel(ctx.main);
      const baseUrl = resolveTogetherBaseUrl();
      const temporaryAuthDirectory = mkdtempSync2(join3(tmpdir2(), "togetherlink-grok-auth-"));
      const authPath = join3(temporaryAuthDirectory, "no-auth.json");
      let catalogServer;
      try {
        catalogServer = await startGrokModelCatalogServer(baseUrl);
        const args = [
          "--model",
          selectedModel.id,
          ...grokArgsWithTogetherlinkIdentity(ctx.passthrough ?? [], buildGrokIdentityRule(selectedModel.definition))
        ];
        const env = buildGrokLaunchEnvironment({
          inheritedEnv: process.env,
          apiKey,
          authPath,
          baseUrl,
          modelsListUrl: catalogServer.modelsListUrl,
          selectedModel: selectedModel.definition
        });
        if (process.env.TOGETHERLINK_DEBUG === "1") {
          process.stderr.write(`[togetherlink grok] model: ${selectedModel.id}
`);
          process.stderr.write(`[togetherlink grok] inference: ${baseUrl}
`);
          process.stderr.write(`[togetherlink grok] model catalog: ${catalogServer.modelsListUrl}
`);
          process.stderr.write(`[togetherlink grok] auth isolation: ${authPath}
`);
          process.stderr.write(`[togetherlink grok] Grok home: ${env.GROK_HOME || "~/.grok (native default)"}
`);
        }
        process.stderr.write(`togetherlink \u25B8 Launching Grok Build with Together AI.
`);
        const result = await runTrackedSpawnedSession({
          agent: HARNESS.GROK,
          modelId: selectedModel.id,
          binary: "grok",
          args,
          options: { env, stdio: "inherit" },
          home: ctx.home
        });
        process.exitCode = typeof result.status === "number" ? result.status : result.signal ? 1 : 0;
      } finally {
        try {
          await catalogServer?.close();
        } finally {
          rmSync2(temporaryAuthDirectory, { recursive: true, force: true });
        }
      }
      return {};
    }
  });
});

// packages/cli/src/lib/hermes/core.ts
import {
  existsSync as existsSync2,
  copyFileSync,
  mkdirSync,
  mkdtempSync as mkdtempSync3,
  readFileSync as readFileSync2,
  readdirSync,
  rmSync as rmSync3,
  symlinkSync,
  writeFileSync as writeFileSync2
} from "fs";
import { tmpdir as tmpdir3 } from "os";
import { join as join4 } from "path";
function resolveHermesCommand(args) {
  return args[0] === "desktop" ? { mode: "desktop", passthrough: args.slice(1) } : { mode: "terminal", passthrough: args };
}
function containsCredentialState(name) {
  return ISOLATED_HOME_ENTRIES.has(name) || /auth|credential|token/i.test(name);
}
function linkDirectoryEntries(source, destination, excludedNames = new Set) {
  if (!existsSync2(source)) {
    return;
  }
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (excludedNames.has(entry.name)) {
      continue;
    }
    symlinkSync(join4(source, entry.name), join4(destination, entry.name), entry.isDirectory() ? "dir" : "file");
  }
}
function writeTogetherProviderPlugin(overlay, { baseUrl, modelIds }) {
  const pluginDir = join4(overlay, "plugins", "model-providers", HERMES_PROVIDER_ID);
  mkdirSync(pluginDir, { recursive: true });
  const modelValues = modelIds.map((modelId) => JSON.stringify(modelId)).join(", ");
  const pythonTuple = modelIds.length === 1 ? `${modelValues},` : modelValues;
  writeFileSync2(join4(pluginDir, "__init__.py"), `"""Ephemeral Together AI provider generated by togetherlink."""

from providers import register_provider
from providers.base import ProviderProfile


class TogetherLinkProfile(ProviderProfile):
    def prepare_messages(self, messages):
        prepared = []
        for message in messages:
            item = dict(message)
            if item.get("role") == "tool":
                item.pop("name", None)
            prepared.append(item)
        return prepared


togetherlink = TogetherLinkProfile(
    name="togetherlink",
    display_name="Together AI",
    description="Together AI through togetherlink",
    api_mode="chat_completions",
    env_vars=("${HERMES_PROVIDER_API_KEY_ENV}", "${HERMES_PROVIDER_BASE_URL_ENV}"),
    base_url=${JSON.stringify(baseUrl)},
    fallback_models=(${pythonTuple}),
    supports_vision=True,
)

register_provider(togetherlink)
`, "utf8");
  writeFileSync2(join4(pluginDir, "plugin.yaml"), `name: togetherlink
kind: model-provider
version: 1.0.0
description: Ephemeral Together AI provider generated by togetherlink
`, "utf8");
}
function writeTogetherProviderConfig(overlay, { baseUrl, modelIds }) {
  const configPath = join4(overlay, "config.yaml");
  const source = existsSync2(configPath) ? readFileSync2(configPath, "utf8") : "";
  const document = $parseDocument(source);
  if (document.errors.length > 0) {
    throw new Error(`Cannot prepare temporary Hermes config: ${document.errors[0]?.message}`);
  }
  if (!$isMap(document.get("providers", true))) {
    document.set("providers", document.createNode({}));
  }
  document.setIn(["providers", HERMES_PROVIDER_ID], {
    name: "Together AI",
    base_url: baseUrl,
    key_env: HERMES_PROVIDER_API_KEY_ENV,
    transport: "chat_completions",
    default_model: modelIds[0] ?? "",
    models: [...modelIds],
    discover_models: false
  });
  writeFileSync2(configPath, document.toString(), "utf8");
}
function writeHermesEnvironment(overlay, nativeHome, { apiKey, baseUrl }) {
  const nativeEnvPath = join4(nativeHome, ".env");
  const existing = existsSync2(nativeEnvPath) ? readFileSync2(nativeEnvPath, "utf8").split(/\r?\n/).filter((line) => !/^\s*(?:export\s+)?TOGETHERLINK_HERMES_(?:API_KEY|BASE_URL)\s*=/.test(line)).join(`
`).trimEnd() : "";
  const prefix = existing ? `${existing}
` : "";
  writeFileSync2(join4(overlay, ".env"), `${prefix}${HERMES_PROVIDER_API_KEY_ENV}=${JSON.stringify(apiKey)}
${HERMES_PROVIDER_BASE_URL_ENV}=${JSON.stringify(baseUrl)}
`, { encoding: "utf8", mode: 384 });
}
function createHermesHomeOverlay(nativeHome, options) {
  const overlay = mkdtempSync3(join4(tmpdir3(), "togetherlink-hermes-"));
  try {
    if (existsSync2(nativeHome)) {
      for (const entry of readdirSync(nativeHome, { withFileTypes: true })) {
        if (containsCredentialState(entry.name) || entry.name === "plugins") {
          continue;
        }
        if (entry.name === "config.yaml" && entry.isFile()) {
          copyFileSync(join4(nativeHome, entry.name), join4(overlay, entry.name));
          continue;
        }
        symlinkSync(join4(nativeHome, entry.name), join4(overlay, entry.name), entry.isDirectory() ? "dir" : "file");
      }
      const nativePlugins = join4(nativeHome, "plugins");
      const overlayPlugins = join4(overlay, "plugins");
      if (existsSync2(nativePlugins)) {
        mkdirSync(overlayPlugins, { recursive: true });
        for (const entry of readdirSync(nativePlugins, { withFileTypes: true })) {
          if (entry.name === "model-providers") {
            continue;
          }
          symlinkSync(join4(nativePlugins, entry.name), join4(overlayPlugins, entry.name), entry.isDirectory() ? "dir" : "file");
        }
        linkDirectoryEntries(join4(nativePlugins, "model-providers"), join4(overlayPlugins, "model-providers"), new Set([HERMES_PROVIDER_ID]));
      }
    }
    writeTogetherProviderConfig(overlay, options);
    writeHermesEnvironment(overlay, nativeHome, options);
    writeTogetherProviderPlugin(overlay, options);
    return overlay;
  } catch (error) {
    rmSync3(overlay, { recursive: true, force: true });
    throw error;
  }
}
function argsWithoutRuntimeOverrides(args) {
  const sanitized = [];
  for (let i = 0;i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (VALUE_OVERRIDES.has(arg)) {
      i += 1;
      continue;
    }
    if (arg.startsWith("--provider=") || arg.startsWith("--model=")) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}
function buildHermesLaunchSpec({
  mode,
  modelId,
  apiKey,
  baseUrl,
  hermesHome,
  passthrough = [],
  env = process.env
}) {
  const forwardedArgs = argsWithoutRuntimeOverrides(passthrough);
  return {
    binary: "hermes",
    args: mode === "desktop" ? ["desktop", ...forwardedArgs] : ["--provider", HERMES_PROVIDER_ID, "--model", modelId, ...forwardedArgs],
    env: {
      ...env,
      TOGETHER_API_KEY: apiKey,
      TOGETHER_BASE_URL: baseUrl,
      [HERMES_PROVIDER_API_KEY_ENV]: apiKey,
      [HERMES_PROVIDER_BASE_URL_ENV]: baseUrl,
      HERMES_HOME: hermesHome,
      HERMES_MODEL: modelId,
      HERMES_INFERENCE_MODEL: modelId,
      HERMES_INFERENCE_PROVIDER: HERMES_PROVIDER_ID,
      HERMES_TUI_PROVIDER: HERMES_PROVIDER_ID
    }
  };
}
var VALUE_OVERRIDES, ISOLATED_HOME_ENTRIES, HERMES_PROVIDER_ID = "togetherlink", HERMES_PROVIDER_API_KEY_ENV = "TOGETHERLINK_HERMES_API_KEY", HERMES_PROVIDER_BASE_URL_ENV = "TOGETHERLINK_HERMES_BASE_URL";
var init_core5 = __esm(() => {
  init_dist4();
  VALUE_OVERRIDES = new Set(["--provider", "--model", "-m"]);
  ISOLATED_HOME_ENTRIES = new Set([".env", "active_profile"]);
});

// packages/cli/src/lib/harnesses/hermes.ts
var exports_hermes = {};
__export(exports_hermes, {
  default: () => hermes_default
});
import { rmSync as rmSync4 } from "fs";
import { join as join5 } from "path";
var hermes_default;
var init_hermes = __esm(() => {
  init_defaults2();
  init_harness();
  init_core5();
  init_spawned_session();
  init_together_core();
  hermes_default = defineHarness({
    id: HARNESS.HERMES,
    label: "Hermes Agent",
    run: async (ctx) => {
      const command = resolveHermesCommand(ctx.passthrough ?? []);
      const apiKey = await resolveTogetherApiKey({ apiKey: ctx.apiKey, home: ctx.home });
      if (!apiKey) {
        throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
      }
      const selectedModel = resolveCodexModel(ctx.main);
      const nativeHermesHome = process.env.HERMES_HOME?.trim() || join5(ctx.home, ".hermes");
      const baseUrl = resolveTogetherBaseUrl();
      const hermesHome = createHermesHomeOverlay(nativeHermesHome, {
        apiKey,
        baseUrl,
        modelIds: CODEX_SUPPORTED_MODELS.map((model) => model.id)
      });
      const launch = buildHermesLaunchSpec({
        mode: command.mode,
        modelId: selectedModel.id,
        apiKey,
        baseUrl,
        hermesHome,
        passthrough: command.passthrough
      });
      if (process.env.TOGETHERLINK_DEBUG === "1") {
        process.stderr.write(`[togetherlink hermes] mode: ${command.mode}
`);
        process.stderr.write(`[togetherlink hermes] model: ${selectedModel.id}
`);
        process.stderr.write(`[togetherlink hermes] base URL: ${launch.env.TOGETHER_BASE_URL}
`);
      }
      const desktopNote = command.mode === "desktop" ? " Quit an existing Hermes Desktop process first." : "";
      process.stderr.write(`togetherlink \u25B8 Launching ${command.mode === "desktop" ? "Hermes Desktop" : "Hermes"} with Together AI.${desktopNote}
`);
      const result = await runTrackedSpawnedSession({
        agent: "hermes",
        modelId: selectedModel.id,
        binary: launch.binary,
        args: launch.args,
        options: { env: launch.env, stdio: "inherit" },
        home: ctx.home
      }).finally(() => {
        rmSync4(hermesHome, { recursive: true, force: true });
      });
      if (typeof result.status === "number") {
        process.exitCode = result.status;
      }
      return {};
    }
  });
});

// packages/cli/src/lib/opencode/defaults.ts
function toOpencodeModelEntry(model) {
  return {
    name: model.name,
    attachment: model.attachment,
    reasoning: model.reasoning,
    temperature: model.temperature,
    tool_call: model.tool_call,
    limit: { context: model.limit.context, output: model.limit.output },
    modalities: {
      input: [...model.modalities.input],
      output: [...model.modalities.output]
    },
    cost: { input: model.cost.input, output: model.cost.output, cache_read: model.cost.cache_read }
  };
}
var OPENCODE_PROVIDER_ID = "togetherai", OPENCODE_DEFAULT_MODEL, OPENCODE_MODEL_ENTRIES, OPENCODE_MODEL_WHITELIST, OPENCODE_VISION_MODEL_SELECTOR, OPENCODE_BUILD_PROMPT = `You are a senior software engineering agent collaborating with the user in their workspace.

You have access to tools to read, edit, search, and run code. Use them deliberately: explore before changing, make focused edits that match the surrounding style, and verify your work by running the relevant tests or commands when possible.

- Prefer the smallest correct change. Don't refactor code you weren't asked to touch.
- When you're unsure about intent, ask a concise clarifying question rather than guessing.
- Explain trade-offs when a decision matters, and say plainly what you did and what you verified.
- If something fails, report the real output and adjust \u2014 don't claim success without evidence.

## Images (self-select by your own capabilities)

Whether you can see images depends on which model you are running as \u2014 you know
this about yourself at runtime:

- **If you can see image content** (the attached image arrives to you as a real
  image part): use it directly. Describe, reason over, or act on it as needed.
  Do NOT delegate to any subagent for an image you can already see.
- **If you cannot see image content** (you are a text-only model; OpenCode
  strips image bytes before they reach you, though you may still be told an image
  was attached): do NOT pretend to see it, do NOT guess at its contents, and do
  NOT invoke the \`@vision\` subagent \u2014 it won't receive the image and will only
  error. Instead, tell the user plainly that you (the current model) can't see
  images, and that to work with an image they should switch to a vision-capable
  model via the \`/models\` command (e.g. Kimi K3, MiniMax M3, or Qwen 3.7 Max)
  and re-send the image. Do not retry the subagent.

Under no circumstances guess at or fabricate the contents of an image you did not
actually receive.`, OPENCODE_VISION_AGENT_PROMPT;
var init_defaults3 = __esm(() => {
  init_dist3();
  OPENCODE_DEFAULT_MODEL = DEFAULT_MODEL.id;
  OPENCODE_MODEL_ENTRIES = Object.fromEntries(SELECTABLE_MODELS.map((model) => [model.id, toOpencodeModelEntry(model)]));
  OPENCODE_MODEL_WHITELIST = SELECTABLE_MODELS.map((model) => model.id);
  OPENCODE_VISION_MODEL_SELECTOR = `${OPENCODE_PROVIDER_ID}/${VISION_PRIMARY.id}`;
  OPENCODE_VISION_AGENT_PROMPT = `${VISION_PROMPT}

` + "You are a vision subagent. You are invoked (as @vision) when the user attaches " + "an image that the primary model cannot see. Describe only what is in the image; " + "do not attempt file edits or other tool work. Keep your description tight so the " + "primary agent can reason over it.";
});

// packages/cli/src/lib/opencode/core.ts
function buildOpencodeConfigJson({
  modelId = OPENCODE_DEFAULT_MODEL,
  apiKeyEnvRef = TOGETHER_API_KEY_ENV_REF,
  baseUrl = TOGETHER_BASE_URL2,
  timeoutMs,
  buildPrompt = OPENCODE_BUILD_PROMPT,
  visionPrompt = OPENCODE_VISION_AGENT_PROMPT
} = {}) {
  const models = { ...OPENCODE_MODEL_ENTRIES };
  const provider = {
    npm: "@ai-sdk/togetherai",
    name: "Together AI",
    options: {
      apiKey: apiKeyEnvRef,
      baseURL: baseUrl,
      ...timeoutMs !== undefined ? { timeout: timeoutMs } : {}
    },
    models,
    whitelist: OPENCODE_MODEL_WHITELIST
  };
  return {
    $schema: "https://opencode.ai/config.json",
    provider: {
      [OPENCODE_PROVIDER_ID]: provider
    },
    model: `${OPENCODE_PROVIDER_ID}/${modelId}`,
    enabled_providers: [OPENCODE_PROVIDER_ID],
    disabled_providers: ["opencode"],
    agent: {
      build: {
        prompt: buildPrompt
      },
      vision: {
        mode: "subagent",
        description: "Describes images the user attaches, for use by a text-only primary model. Because of an OpenCode bug (#25553) the image is not always forwarded to this subagent, so the primary agent does not auto-invoke it. You can still invoke it explicitly with @vision; if it reports it can't see the image, switch to a vision-capable model via /models instead.",
        model: OPENCODE_VISION_MODEL_SELECTOR,
        prompt: visionPrompt
      }
    }
  };
}
function buildOpencodeEnv({
  apiKey,
  configJson
}) {
  return {
    ...process.env,
    OPENCODE_CONFIG_CONTENT: JSON.stringify(configJson),
    TOGETHER_API_KEY: apiKey
  };
}
var init_core6 = __esm(() => {
  init_together_core();
  init_defaults3();
});

// packages/cli/src/lib/harnesses/opencode.ts
var exports_opencode = {};
__export(exports_opencode, {
  default: () => opencode_default
});
function opencodeArgsWithoutModelOverrides(args) {
  const sanitized = [];
  for (let i = 0;i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--model" || arg === "-m") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--model=")) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}
var opencode_default;
var init_opencode = __esm(() => {
  init_defaults3();
  init_core6();
  init_spawned_session();
  init_together_stream();
  init_together_core();
  init_harness();
  opencode_default = defineHarness({
    id: HARNESS.OPENCODE,
    label: "OpenCode",
    async run(ctx) {
      const apiKey = await resolveTogetherApiKey({
        apiKey: ctx.apiKey,
        home: ctx.home
      });
      if (!apiKey) {
        throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
      }
      const modelId = ctx.main ?? OPENCODE_DEFAULT_MODEL;
      const baseUrl = resolveTogetherBaseUrl();
      const timeoutMs = streamTurnTimeoutMs();
      const configJson = buildOpencodeConfigJson({
        modelId,
        baseUrl,
        ...timeoutMs !== undefined ? { timeoutMs } : {}
      });
      const env = buildOpencodeEnv({ apiKey, configJson });
      if (process.env.TOGETHERLINK_DEBUG === "1") {
        process.stderr.write(`[togetherlink opencode] custom model: ${modelId}
`);
        process.stderr.write(`[togetherlink opencode] config: ${JSON.stringify(configJson)}
`);
      }
      const result = await runTrackedSpawnedSession({
        agent: HARNESS.OPENCODE,
        modelId,
        binary: "opencode",
        args: opencodeArgsWithoutModelOverrides(ctx.passthrough ?? []),
        options: {
          env,
          stdio: "inherit"
        },
        home: ctx.home
      });
      if (typeof result.status === "number") {
        process.exitCode = result.status;
      }
      return {};
    }
  });
});

// packages/cli/src/lib/harnesses/pi.ts
var exports_pi = {};
__export(exports_pi, {
  seedPiManagedTools: () => seedPiManagedTools,
  persistPiManagedTools: () => persistPiManagedTools,
  default: () => pi_default,
  buildPiModelsJson: () => buildPiModelsJson
});
import {
  copyFileSync as copyFileSync2,
  existsSync as existsSync3,
  mkdirSync as mkdirSync2,
  mkdtempSync as mkdtempSync4,
  readdirSync as readdirSync2,
  rmSync as rmSync5,
  writeFileSync as writeFileSync3
} from "fs";
import { homedir, tmpdir as tmpdir4 } from "os";
import { join as join6 } from "path";
function piArgsWithoutTogetherlinkOverrides(args) {
  const sanitized = [];
  for (let i = 0;i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (VALUE_FLAGS.has(arg)) {
      i += 1;
      continue;
    }
    if (arg.startsWith("--api-key=") || arg.startsWith("--provider=") || arg.startsWith("--model=") || arg.startsWith("--models=")) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}
function buildPiModelsJson(apiKey, baseUrl = TOGETHER_BASE_URL2) {
  const models = CODEX_SUPPORTED_MODELS.map(({ definition }) => ({
    id: definition.id,
    name: definition.name,
    reasoning: definition.reasoning,
    input: definition.modalities.input,
    contextWindow: definition.limit.context,
    maxTokens: definition.limit.output,
    cost: {
      input: definition.cost.input,
      output: definition.cost.output,
      cacheRead: definition.cost.cache_read ?? 0,
      cacheWrite: 0
    }
  }));
  return `${JSON.stringify({
    providers: {
      [PI_PROVIDER_ID]: {
        apiKey,
        baseUrl,
        models
      }
    }
  }, null, 2)}
`;
}
function writePiModelsJson(agentDir, apiKey, baseUrl) {
  writeFileSync3(join6(agentDir, "models.json"), buildPiModelsJson(apiKey, baseUrl), "utf8");
}
function seedPiManagedTools(agentDir, userBinDir) {
  if (!existsSync3(userBinDir)) {
    return;
  }
  const targetDir = join6(agentDir, "bin");
  for (const tool of PI_MANAGED_TOOLS) {
    const source = join6(userBinDir, tool);
    if (!existsSync3(source)) {
      continue;
    }
    mkdirSync2(targetDir, { recursive: true });
    try {
      copyFileSync2(source, join6(targetDir, tool));
    } catch {
    }
  }
}
function persistPiManagedTools(agentDir, userBinDir) {
  const tempBinDir = join6(agentDir, "bin");
  if (!existsSync3(tempBinDir)) {
    return;
  }
  let entries;
  try {
    entries = readdirSync2(tempBinDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!PI_MANAGED_TOOLS.includes(entry)) {
      continue;
    }
    const target = join6(userBinDir, entry);
    if (existsSync3(target)) {
      continue;
    }
    try {
      mkdirSync2(userBinDir, { recursive: true });
      copyFileSync2(join6(tempBinDir, entry), target);
    } catch {
    }
  }
}
var PI_PROVIDER_ID = "together", PI_SUPPORTED_MODELS, VALUE_FLAGS, PI_MANAGED_TOOLS, pi_default;
var init_pi = __esm(() => {
  init_defaults2();
  init_harness();
  init_spawned_session();
  init_together_core();
  PI_SUPPORTED_MODELS = CODEX_SUPPORTED_MODELS.map((model) => model.id).join(",");
  VALUE_FLAGS = new Set(["--api-key", "--provider", "--model", "--models"]);
  PI_MANAGED_TOOLS = ["fd", "fd.exe", "rg", "rg.exe"];
  pi_default = defineHarness({
    id: HARNESS.PI,
    label: "Pi Code",
    async run(ctx) {
      const apiKey = await resolveTogetherApiKey({
        apiKey: ctx.apiKey,
        home: ctx.home
      });
      if (!apiKey) {
        throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
      }
      const agentDir = mkdtempSync4(join6(tmpdir4(), "togetherlink-pi-"));
      const userHome = ctx.home || homedir();
      const sessionDir = process.env.PI_CODING_AGENT_SESSION_DIR ?? join6(userHome, ".pi", "agent", "sessions");
      const baseUrl = resolveTogetherBaseUrl();
      writePiModelsJson(agentDir, apiKey, baseUrl);
      const userBinDir = join6(userHome, ".pi", "agent", "bin");
      seedPiManagedTools(agentDir, userBinDir);
      const selectedModel = resolveCodexModel(ctx.main);
      const args = [
        "--provider",
        PI_PROVIDER_ID,
        "--model",
        selectedModel.id,
        "--models",
        PI_SUPPORTED_MODELS,
        "--api-key",
        apiKey,
        "--no-approve",
        "--no-extensions",
        "--no-skills",
        "--no-prompt-templates",
        "--no-themes",
        ...piArgsWithoutTogetherlinkOverrides(ctx.passthrough ?? [])
      ];
      if (process.env.TOGETHERLINK_DEBUG === "1") {
        process.stderr.write(`[togetherlink pi] provider: ${PI_PROVIDER_ID}
`);
        process.stderr.write(`[togetherlink pi] model: ${selectedModel.id}
`);
        process.stderr.write(`[togetherlink pi] models: ${PI_SUPPORTED_MODELS}
`);
        process.stderr.write(`[togetherlink pi] temp config dir: ${agentDir}
`);
        process.stderr.write(`[togetherlink pi] session dir: ${sessionDir}
`);
      }
      process.stderr.write(`togetherlink \u25B8 Launching Pi Code with Together AI.
`);
      const result = await runTrackedSpawnedSession({
        agent: HARNESS.PI,
        modelId: selectedModel.id,
        binary: "pi",
        args,
        options: {
          env: {
            ...process.env,
            PI_CODING_AGENT_DIR: agentDir,
            PI_CODING_AGENT_SESSION_DIR: sessionDir,
            TOGETHER_API_KEY: apiKey
          },
          stdio: "inherit"
        },
        home: ctx.home
      });
      try {
        persistPiManagedTools(agentDir, userBinDir);
        rmSync5(agentDir, { recursive: true, force: true });
      } catch {
      }
      if (typeof result.status === "number") {
        process.exitCode = result.status;
      }
      return {};
    }
  });
});

// packages/cli/src/lib/prime/core.ts
import { createHash as createHash5 } from "crypto";
import { mkdir as mkdir11, rename as rename5, writeFile as writeFile9 } from "fs/promises";
import { dirname as dirname2, join as join7 } from "path";
function primeModelInput(model) {
  const input = ["text"];
  if (model.attachment && model.modalities.input.includes("image")) {
    input.push("image");
  }
  return input;
}
function primeThinkingLevelMap(model) {
  if (!model.reasoningEfforts) {
    return;
  }
  const supported = new Set(model.reasoningEfforts);
  return {
    minimal: null,
    low: supported.has("low") ? "low" : null,
    medium: supported.has("medium") ? "medium" : null,
    high: supported.has("high") ? "high" : null,
    xhigh: supported.has("max") ? "max" : null
  };
}
function buildPrimeProviderConfig(baseUrl = TOGETHER_BASE_URL2) {
  return {
    name: "Together AI via TogetherLink",
    baseUrl,
    apiKey: PRIME_API_KEY_ENV,
    api: "openai-completions",
    models: CODEX_SUPPORTED_MODELS.map(({ definition }) => {
      const thinkingLevelMap = primeThinkingLevelMap(definition);
      return {
        id: definition.id,
        name: `Together AI \xB7 ${definition.name}`,
        reasoning: definition.reasoning,
        input: primeModelInput(definition),
        contextWindow: definition.limit.context,
        maxTokens: definition.limit.output,
        cost: {
          input: definition.cost.input,
          output: definition.cost.output,
          cacheRead: definition.cost.cache_read,
          cacheWrite: 0
        },
        ...thinkingLevelMap ? { thinkingLevelMap } : {}
      };
    })
  };
}
function buildPrimeProviderExtensionSource(baseUrl = TOGETHER_BASE_URL2) {
  const config = JSON.stringify(buildPrimeProviderConfig(baseUrl), null, 2);
  return `// Generated by TogetherLink. Contains model metadata only; no credentials.
export default function registerTogetherLinkProvider(pi) {
  pi.registerProvider(${JSON.stringify(PRIME_PROVIDER_ID)}, ${config});
}
`;
}
function resolvePrimeProviderExtensionPath(home, baseUrl = TOGETHER_BASE_URL2, env = process.env) {
  const togetherlinkRoot = env.TOGETHERLINK_HOME?.trim() || join7(home, ".togetherlink");
  const endpointHash = createHash5("sha256").update(baseUrl).digest("hex").slice(0, 12);
  return join7(togetherlinkRoot, "prime-agent", `together-provider-${endpointHash}.js`);
}
async function writePrimeProviderExtension(filePath, baseUrl = TOGETHER_BASE_URL2) {
  await mkdir11(dirname2(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile9(temporaryPath, buildPrimeProviderExtensionSource(baseUrl), { mode: 384 });
  await rename5(temporaryPath, filePath);
}
function primeArgsWithoutTogetherlinkOverrides(args) {
  const sanitized = [];
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--") {
      sanitized.push(...args.slice(index));
      break;
    }
    if (VALUE_FLAGS2.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith("--api-key=") || arg.startsWith("--model=") || arg.startsWith("--models=") || arg.startsWith("--provider=")) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}
function buildPrimeLaunchSpec({
  selectedModel,
  apiKey,
  baseUrl,
  extensionPath,
  passthrough,
  env = process.env
}) {
  const models = CODEX_SUPPORTED_MODELS.map(({ id }) => `${PRIME_PROVIDER_ID}/${id}`).join(",");
  return {
    binary: "prime-agent",
    args: [
      "--extension",
      extensionPath,
      "--provider",
      PRIME_PROVIDER_ID,
      "--model",
      selectedModel.id,
      "--models",
      models,
      "--api-key",
      apiKey,
      ...primeArgsWithoutTogetherlinkOverrides(passthrough)
    ],
    env: {
      ...env,
      TOGETHER_API_KEY: apiKey,
      TOGETHER_BASE_URL: baseUrl
    }
  };
}
var PRIME_PROVIDER_ID = "togetherlink", PRIME_API_KEY_ENV = "TOGETHER_API_KEY", VALUE_FLAGS2;
var init_core7 = __esm(() => {
  init_defaults2();
  init_together_core();
  VALUE_FLAGS2 = new Set(["--api-key", "--model", "--models", "--provider"]);
});

// packages/cli/src/lib/harnesses/prime.ts
var exports_prime = {};
__export(exports_prime, {
  default: () => prime_default
});
var prime_default;
var init_prime = __esm(() => {
  init_defaults2();
  init_harness();
  init_core7();
  init_spawned_session();
  init_together_core();
  prime_default = defineHarness({
    id: HARNESS.PRIME,
    label: "Prime Agent",
    async run(ctx) {
      const apiKey = await resolveTogetherApiKey({ apiKey: ctx.apiKey, home: ctx.home });
      if (!apiKey) {
        throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
      }
      const selectedModel = resolveCodexModel(ctx.main);
      const baseUrl = resolveTogetherBaseUrl();
      const extensionPath = resolvePrimeProviderExtensionPath(ctx.home, baseUrl);
      await writePrimeProviderExtension(extensionPath, baseUrl);
      const launch = buildPrimeLaunchSpec({
        selectedModel,
        apiKey,
        baseUrl,
        extensionPath,
        passthrough: ctx.passthrough ?? []
      });
      if (process.env.TOGETHERLINK_DEBUG === "1") {
        process.stderr.write(`[togetherlink prime] provider: ${PRIME_PROVIDER_ID}
`);
        process.stderr.write(`[togetherlink prime] model: ${selectedModel.id}
`);
        process.stderr.write(`[togetherlink prime] provider extension: ${extensionPath}
`);
      }
      process.stderr.write(`togetherlink \u25B8 Launching Prime Agent with Together AI.
`);
      const result = await runTrackedSpawnedSession({
        agent: HARNESS.PRIME,
        modelId: selectedModel.id,
        binary: launch.binary,
        args: launch.args,
        options: { env: launch.env, stdio: "inherit" },
        home: ctx.home
      });
      if (typeof result.status === "number") {
        process.exitCode = result.status;
      }
      return {};
    }
  });
});

// packages/cli/src/lib/codex-app/toml.ts
function removeManagedBlock(raw, markerStart, markerEnd) {
  const start = raw.indexOf(markerStart);
  if (start < 0) {
    return raw;
  }
  const end = raw.indexOf(markerEnd, start);
  if (end < 0) {
    return raw;
  }
  const afterEnd = end + markerEnd.length;
  return `${raw.slice(0, start).trimEnd()}
${raw.slice(afterEnd).replace(/^\s*\n/, "")}`;
}
function removeTomlSections(raw, sectionNames) {
  if (sectionNames.length === 0 || raw.trim() === "") {
    return raw;
  }
  const remove = new Set(sectionNames.map((section) => `[${section}]`));
  const lines = raw.split(`
`);
  const kept = [];
  let skipping = false;
  for (const line of lines) {
    if (/^\s*\[/.test(line)) {
      skipping = remove.has(line.trim());
    }
    if (!skipping) {
      kept.push(line);
    }
  }
  return kept.join(`
`).replace(/\n{3,}/g, `

`);
}
function splitTomlPreamble(raw) {
  const match = raw.match(/(?:^|\n)\s*\[/);
  if (!match || match.index === undefined) {
    return [raw, ""];
  }
  const tableStart = match[0].startsWith(`
`) ? match.index + 1 : match.index;
  return [raw.slice(0, tableStart), raw.slice(tableStart)];
}
function upsertTopLevelTomlKeys(preamble, values) {
  const seen = new Set;
  const lines = preamble.split(/\n/);
  const next = lines.map((line) => {
    const match = /^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/.exec(line);
    if (!match) {
      return line;
    }
    const key = match[2];
    if (!key) {
      return line;
    }
    const value = values[key];
    if (value === undefined) {
      return line;
    }
    seen.add(key);
    return `${match[1] ?? ""}${key}${match[3] ?? " = "}${value}`;
  });
  const insertion = Object.entries(values).filter(([key]) => !seen.has(key)).map(([key, value]) => `${key} = ${value}`);
  const compact = next.join(`
`).trimEnd();
  const prefix = compact ? `${compact}
` : "";
  return `${prefix}${insertion.join(`
`)}${insertion.length > 0 ? `
` : ""}`;
}
function insertTopLevelTomlKeys(preamble, values) {
  const existing = new Set;
  for (const line of preamble.split(/\n/)) {
    const match = /^\s*([A-Za-z0-9_-]+)\s*=/.exec(line);
    if (match?.[1])
      existing.add(match[1]);
  }
  return upsertTopLevelTomlKeys(preamble, Object.fromEntries(Object.entries(values).filter(([key]) => !existing.has(key))));
}
function removeTopLevelTomlKeys(preamble, keys) {
  const remove = new Set(keys);
  return preamble.split(/\n/).filter((line) => {
    const match = /^(\s*)([A-Za-z0-9_-]+)(\s*=\s*)(.*)$/.exec(line);
    return !match || !remove.has(match[2] ?? "");
  }).join(`
`);
}
function tomlString2(value) {
  return JSON.stringify(value);
}

// packages/cli/src/lib/codex-app/session-lock.ts
import { mkdir as mkdir13, readFile as readFile8, rename as rename7, writeFile as writeFile11 } from "fs/promises";
import path17 from "path";
function appSessionLockPath(home) {
  return path17.join(togetherlinkHomeDir(home), "codex-app", "session.json");
}
function togetherlinkHomeDir(home) {
  return process.env.TOGETHERLINK_HOME || path17.join(home, ".togetherlink");
}
async function writeAppSessionLock(home, lock) {
  await writeTextAtomic2(appSessionLockPath(home), `${JSON.stringify(lock, null, 2)}
`);
}
async function isManagedCodexAppConfig(home, configPath, markerStart, modelCatalogPath) {
  const raw = await readTextIfExists2(configPath);
  if (!raw) {
    return false;
  }
  if (raw.includes(markerStart)) {
    return true;
  }
  return raw.includes('model_provider = "openai"') && raw.includes('openai_base_url = "http://127.0.0.1:') && raw.includes(modelCatalogPath);
}
async function readTextIfExists2(file) {
  try {
    return await readFile8(file, "utf8");
  } catch (err) {
    if (isNodeError3(err) && err.code === "ENOENT") {
      return;
    }
    throw err;
  }
}
async function writeTextAtomic2(file, value) {
  await mkdir13(path17.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile11(tmp, value, { encoding: "utf8", mode: 384 });
  await rename7(tmp, file);
}
function isNodeError3(err) {
  return err instanceof Error && "code" in err;
}
var init_session_lock = () => {
};

// packages/cli/src/lib/codex-app/process.ts
import { execFile as execFile3, spawn as spawn5 } from "child_process";
import { promisify } from "util";
async function launchCodexApp(options) {
  const wasRunning = await isCodexAppRunning();
  let restarted = false;
  let restartDeclined = false;
  let restartUnsupported = false;
  if (wasRunning) {
    if (await shouldRestartCodexApp(options.reason)) {
      restarted = await quitCodexApp();
      restartUnsupported = !restarted;
    } else {
      restartDeclined = true;
    }
  }
  const launchAttempted = !(restartDeclined || restartUnsupported || !options.openIfClosed);
  const launched = launchAttempted ? await openCodexApp() : false;
  return { launched, launchAttempted, wasRunning, restarted, restartDeclined, restartUnsupported };
}
function codexAppLaunchMessage(result) {
  if (result.wasRunning && result.restarted && result.launched) {
    return "ChatGPT App was already open; restart approved and relaunch requested.";
  }
  if (result.wasRunning && result.restartDeclined) {
    return "ChatGPT App is already open. Restart it when you are ready so it reloads this profile.";
  }
  if (result.wasRunning && result.restartUnsupported) {
    return "ChatGPT App is already open, but togetherlink could not restart it. Quit and reopen ChatGPT App when you are ready.";
  }
  if (!result.wasRunning && !result.launchAttempted) {
    return "ChatGPT App was not running.";
  }
  return result.launched ? "ChatGPT App launch requested." : "Config written, but ChatGPT App could not be launched automatically. Open ChatGPT App manually.";
}
async function shouldRestartCodexApp(reason) {
  if (!isInteractive()) {
    return false;
  }
  const clack = await Promise.resolve().then(() => (init_dist2(), exports_dist));
  const action = reason === "restored" ? "reload your restored ChatGPT profile" : "reload the Togetherlink profile";
  const restart = await clack.confirm({
    message: `ChatGPT App is already open. Restart it now to ${action}?`,
    initialValue: false
  });
  return restart === true;
}
async function openCodexApp() {
  const launchedViaCodex = await spawnDetached("codex", ["app", process.cwd()]);
  if (launchedViaCodex) {
    return true;
  }
  if (process.platform === "darwin") {
    for (const name of MACOS_APP_NAMES) {
      if (await spawnDetached("open", ["-a", name, process.cwd()])) {
        return true;
      }
    }
    return false;
  }
  if (process.platform === "win32") {
    for (const name of WIN32_PROCESS_NAMES) {
      if (await spawnDetached("cmd", ["/c", "start", "", name])) {
        return true;
      }
    }
    return false;
  }
  return false;
}
async function isCodexAppRunning() {
  if (process.platform === "darwin") {
    return Boolean(await runningMacosAppName());
  }
  if (process.platform === "win32") {
    return Boolean(await runningWin32ProcessName());
  }
  return false;
}
async function quitCodexApp() {
  if (process.platform === "darwin") {
    const name = await runningMacosAppName();
    if (!name) {
      return false;
    }
    try {
      await execFileAsync("/usr/bin/osascript", ["-e", `tell application "${name}" to quit`]);
      return waitForCodexAppExit();
    } catch {
      return false;
    }
  }
  if (process.platform === "win32") {
    const name = await runningWin32ProcessName();
    if (!name) {
      return false;
    }
    try {
      await execFileAsync("taskkill", ["/IM", name]);
      return waitForCodexAppExit();
    } catch {
      return false;
    }
  }
  return false;
}
async function runningMacosAppName() {
  for (const name of MACOS_APP_NAMES) {
    try {
      const { stdout } = await execFileAsync("/usr/bin/osascript", [
        "-e",
        `application "${name}" is running`
      ]);
      if (stdout.trim() === "true") {
        return name;
      }
    } catch {
    }
  }
  return;
}
async function runningWin32ProcessName() {
  for (const name of WIN32_PROCESS_NAMES) {
    try {
      const { stdout } = await execFileAsync("tasklist", ["/FI", `IMAGENAME eq ${name}`]);
      if (stdout.toLowerCase().includes(name.toLowerCase())) {
        return name;
      }
    } catch {
    }
  }
  return;
}
async function waitForCodexAppExit() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!await isCodexAppRunning()) {
      return true;
    }
    await sleep4(200);
  }
  return false;
}
async function spawnDetached(command, args) {
  return new Promise((resolve) => {
    const child = spawn5(command, args, {
      detached: true,
      stdio: "ignore"
    });
    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}
function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
function sleep4(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var execFileAsync, MACOS_APP_NAMES, WIN32_PROCESS_NAMES;
var init_process = __esm(() => {
  execFileAsync = promisify(execFile3);
  MACOS_APP_NAMES = ["ChatGPT", "Codex"];
  WIN32_PROCESS_NAMES = ["ChatGPT.exe", "Codex.exe"];
});

// packages/cli/src/lib/codex-app/session-repair.ts
import path18 from "path";
import { copyFile, mkdir as mkdir14, readFile as readFile9, readdir, rename as rename8, writeFile as writeFile12 } from "fs/promises";
async function repairCodexSessionHistory(home) {
  const codexHome = path18.join(home, ".codex");
  const roots = [path18.join(codexHome, "sessions"), path18.join(codexHome, "archived_sessions")];
  const files = (await Promise.all(roots.map(jsonlFiles))).flat();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path18.join(process.env.TOGETHERLINK_HOME || path18.join(home, ".togetherlink"), "backup", "codex-app", "session-repair", stamp);
  const result = {
    filesRepaired: 0,
    itemsRepaired: 0,
    backups: []
  };
  for (const sourcePath of files) {
    const original = await readFile9(sourcePath, "utf8");
    let fileItemsRepaired = 0;
    const repaired = original.split(`
`).map((line) => {
      if (!line)
        return line;
      const event = parseJsonObject(line);
      const payload = event?.type === "response_item" ? event.payload : undefined;
      if (!isTogetherLinkReasoningPayload(payload)) {
        return line;
      }
      const sanitized = sanitizeNativeResponsesReplay({ store: false, input: [payload] });
      const safePayload = sanitized.input?.[0];
      if (safePayload === payload || !isJsonObject2(safePayload)) {
        return line;
      }
      fileItemsRepaired += 1;
      return JSON.stringify({ ...event, payload: safePayload });
    }).join(`
`);
    if (fileItemsRepaired === 0) {
      continue;
    }
    const relativePath = path18.relative(codexHome, sourcePath);
    const backupPath = path18.join(backupRoot, relativePath);
    await mkdir14(path18.dirname(backupPath), { recursive: true });
    await copyFile(sourcePath, backupPath);
    await writeTextAtomic3(sourcePath, repaired);
    result.filesRepaired += 1;
    result.itemsRepaired += fileItemsRepaired;
    result.backups.push({ sourcePath, backupPath });
  }
  return result;
}
function isTogetherLinkReasoningPayload(value) {
  return isJsonObject2(value) && value.type === "reasoning" && isTogetherLinkReasoningId(value.id);
}
async function jsonlFiles(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isNodeError4(error) && error.code === "ENOENT")
      return [];
    throw error;
  }
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path18.join(root, entry.name);
    if (entry.isDirectory())
      return jsonlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".jsonl") ? [entryPath] : [];
  }));
  return nested.flat();
}
async function writeTextAtomic3(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile12(temporary, value, { encoding: "utf8", mode: 384 });
  await rename8(temporary, file);
}
function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value);
    return isJsonObject2(parsed) ? parsed : undefined;
  } catch {
    return;
  }
}
function isJsonObject2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isNodeError4(error) {
  return error instanceof Error && "code" in error;
}
var init_session_repair = __esm(() => {
  init_native_replay();
});

// packages/cli/src/lib/codex-app/catalog.ts
import { execFile as execFile4 } from "child_process";
import { readFile as readFile10, rename as rename9, writeFile as writeFile13, mkdir as mkdir15 } from "fs/promises";
import path19 from "path";
import { promisify as promisify2 } from "util";
function mergedCodexAppCatalogJson(nativeCatalog) {
  return JSON.stringify(mergeCodexModelCatalog(nativeCatalog));
}
async function writeMergedCodexAppCatalog(home, outputPath, nativeSnapshotPath) {
  const nativeCatalog = await loadNativeCatalog(home, nativeSnapshotPath);
  await writeTextAtomic4(nativeSnapshotPath, `${JSON.stringify(nativeCatalog, null, 2)}
`);
  const merged = mergeCodexModelCatalog(nativeCatalog);
  await writeTextAtomic4(outputPath, `${JSON.stringify(merged)}
`);
  return merged.models.length;
}
async function loadNativeCatalog(home, nativeSnapshotPath) {
  const authenticated = await commandNativeCatalog(home, []);
  if (authenticated && hasLikelyNativeModels(authenticated))
    return authenticated;
  const bundled = await bundledNativeCatalog(home);
  if (bundled)
    return bundled;
  const cached = nativeOnly(await readCatalog(path19.join(home, ".codex", "models_cache.json")));
  if (cached && hasLikelyNativeModels(cached))
    return cached;
  const snapshot = await readCatalog(nativeSnapshotPath);
  if (snapshot && hasLikelyNativeModels(snapshot))
    return snapshot;
  throw new Error("Could not read the native Codex model catalog. Open ChatGPT Desktop once while signed in, or install/update the Codex CLI, then rerun `togetherlink chatgpt`.");
}
async function bundledNativeCatalog(home) {
  return commandNativeCatalog(home, ["--bundled"]);
}
async function commandNativeCatalog(home, extraArgs) {
  try {
    const { stdout } = await execFileAsync2("codex", ["debug", "models", ...extraArgs], {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, CODEX_HOME: path19.join(home, ".codex") }
    });
    return nativeOnly(parseCatalog(stdout));
  } catch {
    return;
  }
}
function nativeOnly(catalog) {
  if (!catalog)
    return;
  const models = catalog.models.filter((entry) => !findModelById(String(entry.slug)));
  return models.length > 0 ? { models } : undefined;
}
async function readCatalog(file) {
  try {
    return parseCatalog(await readFile10(file, "utf8"));
  } catch {
    return;
  }
}
function parseCatalog(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.models) || parsed.models.length === 0)
      return;
    const models = parsed.models.filter((entry) => typeof entry === "object" && entry !== null && typeof entry.slug === "string");
    return models.length > 0 ? { models } : undefined;
  } catch {
    return;
  }
}
function hasLikelyNativeModels(catalog) {
  return catalog.models.some((entry) => /^gpt-|^o\d/.test(String(entry.slug)));
}
async function writeTextAtomic4(file, value) {
  await mkdir15(path19.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile13(temporary, value, { encoding: "utf8", mode: 384 });
  await rename9(temporary, file);
}
var execFileAsync2;
var init_catalog2 = __esm(() => {
  init_dist3();
  init_catalog();
  execFileAsync2 = promisify2(execFile4);
});

// packages/cli/src/lib/codex-app.ts
var exports_codex_app = {};
__export(exports_codex_app, {
  runCodexAppCommand: () => runCodexAppCommand,
  codexAppModelCatalogJson: () => codexAppModelCatalogJson,
  buildCodexAppConfig: () => buildCodexAppConfig
});
import { constants as fsConstants } from "fs";
import { access as access3, copyFile as copyFile2, mkdir as mkdir16, readFile as readFile11, rename as rename10, rm as rm2, writeFile as writeFile14 } from "fs/promises";
import path20 from "path";
async function runCodexAppCommand(ctx) {
  if (ctx.restore) {
    return restoreCodexApp(ctx.home);
  }
  const apiKey = await resolveTogetherApiKey({
    apiKey: ctx.apiKey,
    home: ctx.home
  });
  if (!apiKey) {
    throw new Error("No Together API key found. Pass --api-key, run `togetherlink configure`, or set TOGETHER_API_KEY.");
  }
  const selectedModel = resolveCodexModel(ctx.main);
  const authToken = await localProxyAuthToken();
  const sessionToken = codexAppSessionToken(authToken);
  const telemetrySessionId = sessionToken;
  const startedAt = Date.now();
  const configPath = codexConfigPath2(ctx.home);
  const currentConfig = await readTextIfExists3(configPath) ?? "";
  const configBase = await originalCodexAppConfig(ctx.home, configPath, currentConfig);
  const nativeBaseUrl = nativeCodexBaseUrl(configBase);
  const { url: proxyUrl } = await ensureDaemon();
  const agentProxyUrl = daemonSessionUrl(proxyUrl, sessionToken);
  const { path: catalogPath, modelCount } = await writePersistentModelCatalog(ctx.home);
  const registration = {
    token: sessionToken,
    authToken,
    agent: "codex-app",
    apiKey,
    baseUrl: resolveTogetherBaseUrl(),
    modelLabel: `${selectedModel.definition.name} (ChatGPT App alpha)`,
    modelId: selectedModel.definition.id,
    targetModelId: selectedModel.definition.id,
    modelName: selectedModel.definition.name,
    modelDefinition: selectedModel.definition,
    nativeBaseUrl,
    ...process.env.TOGETHERLINK_DEBUG === "1" ? { debug: true } : {}
  };
  await registerDaemonSession(proxyUrl, registration);
  await writeAppRegistration(registration, togetherlinkHomeDir2(ctx.home));
  const backup = await backupCodexAppConfig(ctx.home, configPath);
  const next = buildCodexAppConfig(configBase, {
    ...ctx.main ? { modelId: selectedModel.definition.id } : {},
    providerId: CODEX_APP_PROVIDER_ID,
    providerName: "Togetherlink",
    baseUrl: `${agentProxyUrl}/v1`,
    bearerToken: authToken,
    catalogPath,
    nativeBaseUrl
  });
  await writeTextAtomic5(configPath, next);
  await bustStaleModelsCache(ctx.home);
  await writeAppSessionLock(ctx.home, {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    sessionToken,
    configPath,
    catalogPath
  });
  const launch = await launchCodexApp({ reason: "configured", openIfClosed: true });
  sendTelemetryEvent({
    event: "session_started",
    sessionId: telemetrySessionId,
    agent: "codex-app",
    initialModel: selectedModel.definition.id,
    startedAt,
    metadata: {
      integration: "codex-app",
      providerId: CODEX_APP_PROVIDER_ID,
      additiveModelRouter: true,
      catalogModelCount: modelCount,
      proxySessionRegistered: true,
      launchAttempted: launch.launchAttempted,
      launched: launch.launched,
      wasRunning: launch.wasRunning,
      restarted: launch.restarted,
      restartDeclined: launch.restartDeclined,
      restartUnsupported: launch.restartUnsupported
    }
  });
  const intro = [
    "Together AI models added to the ChatGPT App picker. (alpha)",
    ctx.main ? `Default model changed to: ${selectedModel.definition.name}` : `Native GPT default preserved; Together default available: ${selectedModel.definition.name}`,
    "Start a task or open a repository in ChatGPT App as usual.",
    "Restore your previous ChatGPT App profile with: togetherlink chatgpt --restore",
    `Backup: ${backup}`,
    codexAppLaunchMessage(launch)
  ].filter(Boolean).join(`
`);
  return { message: intro };
}
function buildCodexAppConfig(rawConfig, options) {
  const withoutManagedBlock = removeManagedBlock(rawConfig, CODEX_APP_CONFIG_MARKER_START, CODEX_APP_CONFIG_MARKER_END);
  const withoutLegacyTables = removeTomlSections(withoutManagedBlock, [
    `profiles.${options.providerId}`,
    `profiles."${options.providerId}"`,
    `model_providers.${options.providerId}`,
    `model_providers."${options.providerId}"`,
    "model_providers.openai",
    'model_providers."openai"'
  ]);
  const withGenericDefaults = applyCodexGenericUserDefaults(withoutLegacyTables);
  const [preamble, rest] = splitTomlPreamble(withGenericDefaults);
  const managedValues = {
    openai_base_url: tomlString2(options.baseUrl),
    model_catalog_json: tomlString2(options.catalogPath)
  };
  if (options.modelId)
    managedValues.model = tomlString2(options.modelId);
  const managedPreamble = upsertTopLevelTomlKeys(preamble, managedValues);
  const withNativeRealtime = insertTopLevelTomlKeys(managedPreamble, {
    experimental_realtime_webrtc_call_base_url: tomlString2(options.nativeBaseUrl ?? DEFAULT_CODEX_NATIVE_BASE_URL),
    experimental_realtime_ws_base_url: tomlString2("https://api.openai.com/v1")
  });
  const cleanedPreamble = removeTopLevelTomlKeys(withNativeRealtime, [
    "profile",
    "model_context_window",
    "model_auto_compact_token_limit"
  ]);
  const providerBlock = [
    CODEX_APP_CONFIG_MARKER_START,
    "# TogetherLink keeps the built-in OpenAI provider active and routes by model slug.",
    `[model_providers.${options.providerId}]`,
    `name = ${tomlString2(options.providerName)}`,
    `base_url = ${tomlString2(options.baseUrl)}`,
    'wire_api = "responses"',
    "# This table is inert while model_provider remains openai; it documents the",
    "# local external-model route without replacing ChatGPT authentication.",
    CODEX_APP_CONFIG_MARKER_END,
    ""
  ].join(`
`);
  const body = `${cleanedPreamble}${rest}`;
  const trimmedBody = body.endsWith(`
`) ? body : `${body}
`;
  return `${trimmedBody}
${providerBlock}`;
}
async function restoreCodexApp(home) {
  if (await isCodexAppRunning()) {
    throw new Error("Quit ChatGPT App before restoring TogetherLink so affected task history can be backed up and repaired safely.");
  }
  const manifestPath = path20.join(backupDir(home), BACKUP_MANIFEST);
  const raw = await readTextIfExists3(manifestPath);
  if (!raw) {
    throw new Error(`No ChatGPT App backup found at ${manifestPath}.`);
  }
  const manifest = JSON.parse(raw);
  const repair = await repairCodexSessionHistory(home);
  for (const entry of manifest.files) {
    if (entry.existed) {
      if (!entry.backupPath) {
        throw new Error(`Backup manifest is missing backupPath for ${entry.path}.`);
      }
      await mkdir16(path20.dirname(entry.path), { recursive: true });
      await copyFile2(entry.backupPath, entry.path);
    } else {
      await rm2(entry.path, { force: true });
    }
  }
  await rm2(modelCatalogPath(home), { force: true });
  await rm2(nativeModelCatalogPath(home), { force: true });
  await rm2(appSessionLockPath(home), { force: true });
  await clearAppRegistration(togetherlinkHomeDir2(home));
  await bustStaleModelsCache(home);
  try {
    const authToken = await localProxyAuthToken();
    const { url } = await ensureDaemon();
    await daemonFetch(`${url}/internal/sessions/${encodeURIComponent(codexAppSessionToken(authToken))}`, { method: "DELETE" });
  } catch {
  }
  const launch = await launchCodexApp({ reason: "restored", openIfClosed: false });
  return {
    message: [
      "ChatGPT App restored to your previous profile.",
      `Backup date: ${manifest.createdAt}`,
      repair.itemsRepaired > 0 ? `Repaired ${repair.itemsRepaired} replay-unsafe reasoning item(s) across ${repair.filesRepaired} task file(s); originals were backed up.` : "No replay-unsafe reasoning history needed repair.",
      codexAppLaunchMessage(launch)
    ].join(`
`)
  };
}
async function backupFiles(home, files) {
  const dir = backupDir(home);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotDir = path20.join(dir, stamp);
  await mkdir16(snapshotDir, { recursive: true });
  const entries = [];
  for (const file of files) {
    if (await exists(file)) {
      const backupPath = path20.join(snapshotDir, backupNameFor(file));
      await mkdir16(path20.dirname(backupPath), { recursive: true });
      await copyFile2(file, backupPath);
      entries.push({ path: file, backupPath, existed: true });
    } else {
      entries.push({ path: file, existed: false });
    }
  }
  const manifest = { createdAt: new Date().toISOString(), files: entries };
  await writeTextAtomic5(path20.join(dir, BACKUP_MANIFEST), `${JSON.stringify(manifest, null, 2)}
`);
  return snapshotDir;
}
async function backupCodexAppConfig(home, configPath) {
  const manifestPath = path20.join(backupDir(home), BACKUP_MANIFEST);
  if (await isManagedCodexAppConfig(home, codexConfigPath2(home), CODEX_APP_CONFIG_MARKER_START, modelCatalogPath(home))) {
    const existing = await readTextIfExists3(manifestPath);
    if (existing) {
      try {
        const manifest = JSON.parse(existing);
        if (manifest.files.some((entry) => entry.path === configPath)) {
          return path20.dirname(manifest.files.find((entry) => entry.path === configPath)?.backupPath ?? manifestPath);
        }
      } catch {
      }
    }
  }
  return backupFiles(home, [configPath]);
}
async function originalCodexAppConfig(home, configPath, current) {
  if (!await isManagedCodexAppConfig(home, configPath, CODEX_APP_CONFIG_MARKER_START, modelCatalogPath(home))) {
    return current;
  }
  const rawManifest = await readTextIfExists3(path20.join(backupDir(home), BACKUP_MANIFEST));
  if (!rawManifest)
    return current;
  try {
    const manifest = JSON.parse(rawManifest);
    const entry = manifest.files.find((candidate) => candidate.path === configPath);
    if (entry?.existed && entry.backupPath) {
      return await readTextIfExists3(entry.backupPath) ?? current;
    }
    return entry && !entry.existed ? "" : current;
  } catch {
    return current;
  }
}
async function writePersistentModelCatalog(home) {
  const file = modelCatalogPath(home);
  const modelCount = await writeMergedCodexAppCatalog(home, file, nativeModelCatalogPath(home));
  return { path: file, modelCount };
}
function codexAppModelCatalogJson(nativeCatalog) {
  return nativeCatalog ? mergedCodexAppCatalogJson(nativeCatalog) : codexModelCatalogJson();
}
function codexConfigPath2(home) {
  return path20.join(home, ".codex", "config.toml");
}
function backupDir(home) {
  return path20.join(process.env.TOGETHERLINK_HOME || path20.join(home, ".togetherlink"), "backup", "codex-app");
}
function modelCatalogPath(home) {
  return path20.join(home, ".codex", "togetherlink-codex-app-models.json");
}
function nativeModelCatalogPath(home) {
  return path20.join(home, ".codex", "togetherlink-codex-app-native-models.json");
}
async function bustStaleModelsCache(home) {
  const cachePath = path20.join(home, ".codex", "models_cache.json");
  try {
    await rm2(cachePath, { force: true });
  } catch {
  }
}
function togetherlinkHomeDir2(home) {
  return process.env.TOGETHERLINK_HOME || path20.join(home, ".togetherlink");
}
function codexAppSessionToken(authToken) {
  return authToken;
}
function backupNameFor(file) {
  return file.replace(/^[a-zA-Z]:/, "").split(path20.sep).filter(Boolean).join("__") || "file";
}
async function readTextIfExists3(file) {
  try {
    return await readFile11(file, "utf8");
  } catch (err) {
    if (isNodeError5(err) && err.code === "ENOENT") {
      return;
    }
    throw err;
  }
}
async function writeTextAtomic5(file, value) {
  await mkdir16(path20.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile14(tmp, value, { encoding: "utf8", mode: 384 });
  await rename10(tmp, file);
}
async function exists(file) {
  try {
    await access3(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}
function isNodeError5(err) {
  return err instanceof Error && "code" in err;
}
var CODEX_APP_PROVIDER_ID, CODEX_APP_CONFIG_MARKER_START = "# >>> togetherlink codex-app alpha >>>", CODEX_APP_CONFIG_MARKER_END = "# <<< togetherlink codex-app alpha <<<", BACKUP_MANIFEST = "latest.json";
var init_codex_app = __esm(() => {
  init_defaults2();
  init_catalog();
  init_user_config();
  init_app_registration();
  init_launch();
  init_telemetry();
  init_together_core();
  init_session_lock();
  init_process();
  init_session_repair();
  init_catalog2();
  init_native_router();
  CODEX_APP_PROVIDER_ID = `${CODEX_PROVIDER_ID}_codex_app`;
});

// packages/cli/src/lib/usage-report.ts
var exports_usage_report = {};
__export(exports_usage_report, {
  summarizeUsageSessions: () => summarizeUsageSessions,
  parseUsageWindow: () => parseUsageWindow,
  formatUsageReport: () => formatUsageReport,
  buildUsageReport: () => buildUsageReport
});
function parseUsageWindow(value = "7d", now = Date.now()) {
  const match = /^(\d+)([hdw])$/i.exec(value.trim());
  if (!match) {
    throw invalidWindow(value);
  }
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const definition = WINDOW_UNITS[unit];
  const duration = amount * definition.milliseconds;
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(duration)) {
    throw invalidWindow(value);
  }
  return {
    label: `Last ${amount} ${amount === 1 ? definition.singular : definition.plural}`,
    since: now - duration
  };
}
function summarizeUsageSessions(sessions2) {
  const models = new Map;
  const harnesses = new Map;
  const totals = emptyUsage();
  let totalCostUsd = 0;
  for (const session of sessions2) {
    totalCostUsd += session.costUsd;
    for (const usage of session.usageByModel) {
      addUsage(totals, usage);
      addUsage(getUsageBucket(models, usage.model), usage);
      addUsage(getUsageBucket(harnesses, session.agent), usage);
    }
  }
  return {
    completedSessions: sessions2.length,
    promptTokens: totals.promptTokens,
    cachedTokens: totals.cachedTokens,
    completionTokens: totals.completionTokens,
    totalCostUsd,
    models: [...models.entries()].map(([model, usage]) => ({ model, ...usage })).sort(byCostThenKey("model")),
    harnesses: [...harnesses.entries()].map(([agent, usage]) => ({ agent, ...usage })).sort(byCostThenKey("agent"))
  };
}
function formatUsageReport(summary, periodLabel) {
  const coverage = "Other harnesses aren't tracked yet.";
  const lines = [`TogetherLink usage \xB7 ${periodLabel.toLowerCase()}`];
  if (summary.models.length === 0) {
    lines.push("", "No completed usage.", coverage);
    return lines.join(`
`);
  }
  lines.push("", ...formatSummaryRows([
    { label: "Cost", value: formatUsd(summary.totalCostUsd) },
    { label: "Total tokens", value: formatCompactNumber(totalTokens(summary)) },
    { label: "Input", value: formatCompactNumber(summary.promptTokens) },
    { label: "Output", value: formatCompactNumber(summary.completionTokens) },
    { label: "Cached input", value: formatCompactNumber(summary.cachedTokens) },
    { label: "Sessions", value: formatTokens(summary.completedSessions) }
  ]));
  const models = summary.models.map(({ model, ...usage }) => ({
    label: modelLabel(model),
    ...usage
  }));
  const harnesses = summary.harnesses.map(({ agent, ...usage }) => ({
    label: AGENT_LABEL[agent],
    ...usage
  }));
  lines.push("", ...formatBreakdownTable("Models", models));
  lines.push("", ...formatBreakdownTable("Harnesses", harnesses));
  lines.push("", coverage);
  return lines.join(`
`);
}
async function buildUsageReport(last = "7d", options = {}) {
  const window = parseUsageWindow(last, options.now);
  const store = await createSessionStore(options.home);
  try {
    return formatUsageReport(summarizeUsageSessions(store.queryUsageSince(window.since)), window.label);
  } finally {
    store.close();
  }
}
function emptyUsage() {
  return { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 };
}
function getUsageBucket(map, key) {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const bucket = emptyUsage();
  map.set(key, bucket);
  return bucket;
}
function addUsage(target, usage) {
  target.promptTokens += usage.promptTokens;
  target.cachedTokens += usage.cachedTokens;
  target.completionTokens += usage.completionTokens;
  target.costUsd += usage.costUsd;
}
function totalTokens(usage) {
  return usage.promptTokens + usage.completionTokens;
}
function formatSummaryRows(rows) {
  const labelWidth = Math.max(...rows.map((row) => row.label.length));
  const valueWidth = Math.max(...rows.map((row) => row.value.length));
  return rows.map((row) => `${row.label.padEnd(labelWidth)}  ${row.value.padStart(valueWidth)}`);
}
function formatBreakdownTable(title, rows) {
  const rendered = rows.map((row) => ({
    label: `  ${row.label}`,
    tokens: formatCompactNumber(totalTokens(row)),
    cost: formatUsd(row.costUsd)
  }));
  const labelWidth = Math.max(title.length, ...rendered.map((row) => row.label.length));
  const tokenWidth = Math.max("Tokens".length, ...rendered.map((row) => row.tokens.length));
  const costWidth = Math.max("Cost".length, ...rendered.map((row) => row.cost.length));
  return [
    `${title.padEnd(labelWidth)}  ${"Tokens".padStart(tokenWidth)}  ${"Cost".padStart(costWidth)}`,
    ...rendered.map((row) => `${row.label.padEnd(labelWidth)}  ${row.tokens.padStart(tokenWidth)}  ${row.cost.padStart(costWidth)}`)
  ];
}
function formatUsd(value) {
  return `$${value.toFixed(2)}`;
}
function formatTokens(value) {
  return Math.round(value).toLocaleString("en-US");
}
function formatCompactNumber(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(Math.round(value));
}
function modelLabel(model) {
  const known = findModelById(model)?.name;
  if (known) {
    return known;
  }
  return (model.split("/").at(-1) ?? model).replaceAll("-", " ");
}
function byCostThenKey(key) {
  return (a3, b3) => b3.costUsd - a3.costUsd || a3[key].localeCompare(b3[key]);
}
function invalidWindow(value) {
  return new Error(`Invalid --last value "${value}". Use a number followed by h, d, or w (for example: 7d).`);
}
var WINDOW_UNITS, AGENT_LABEL;
var init_usage_report = __esm(() => {
  init_dist3();
  init_storage();
  WINDOW_UNITS = {
    h: { milliseconds: 60 * 60 * 1000, singular: "hour", plural: "hours" },
    d: { milliseconds: 24 * 60 * 60 * 1000, singular: "day", plural: "days" },
    w: { milliseconds: 7 * 24 * 60 * 60 * 1000, singular: "week", plural: "weeks" }
  };
  AGENT_LABEL = {
    claude: "Claude Code",
    codex: "Codex",
    "codex-app": "ChatGPT Desktop"
  };
});

// packages/cli/src/bin/togetherlink.ts
import os9 from "os";

// packages/cli/src/lib/load-env.ts
import { readFileSync, existsSync } from "fs";
import path from "path";
var LOADABLE_ENV_KEYS = new Set(["TOGETHER_API_KEY"]);
function loadEnvFile(startDir = process.cwd()) {
  const file = findEnvFile(startDir);
  if (!file) {
    return;
  }
  const raw = readFileSync(file, "utf8");
  for (const entry of parseEnv(raw)) {
    if (!LOADABLE_ENV_KEYS.has(entry.key)) {
      continue;
    }
    if (process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
    }
  }
}
function findEnvFile(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0;i < 20; i += 1) {
    const candidate = path.join(dir, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}
function parseEnv(raw) {
  const entries = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = withoutExport.slice(0, eq).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    let value = withoutExport.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else if (value.includes(" #")) {
      value = (value.split(" #")[0] ?? value).trim();
    }
    entries.push({ key, value });
  }
  return entries;
}

// packages/cli/src/lib/parse-args.ts
init_harness();
var FLAG_ALIASES = {
  "--api-key": "apiKey",
  "--main": "main",
  "--model": "main",
  "--search": "search",
  "--slot": "slot",
  "--last": "last"
};
var BOOLEAN_FLAGS = new Set(["--json", "--restore"]);
var BOOLEAN_FLAG_KEYS = {
  "--json": "json",
  "--restore": "restore"
};
function parseArgs(argv) {
  const positional = [];
  const flags = { json: false, restore: false };
  for (let i = 0;i < argv.length; i += 1) {
    const token = argv[i];
    if (token === undefined) {
      continue;
    }
    if (token === "--") {
      flags.passthrough = argv.slice(i + 1);
      break;
    }
    if (BOOLEAN_FLAGS.has(token)) {
      flags[BOOLEAN_FLAG_KEYS[token]] = true;
      continue;
    }
    if (token in FLAG_ALIASES) {
      const key = FLAG_ALIASES[token];
      const value = argv[i + 1];
      if (value === undefined) {
        throw new Error(`Flag ${token} expects a value`);
      }
      flags[key] = value;
      i += 1;
      continue;
    }
    positional.push(token);
    if (isHarnessToken(token)) {
      flags.passthrough = argv.slice(i + 1);
      break;
    }
  }
  if (flags.apiKey) {
    flags.apiKeyFromFlag = true;
  }
  return { positional, flags };
}
function isHarnessToken(value) {
  return value === "picode" || ALL_HARNESSES.includes(value);
}

// packages/cli/src/lib/commands/global.ts
init_dist2();
init_harness();
import os6 from "os";

// packages/cli/src/lib/harness-registry.ts
init_harness();
var LOADERS = {
  [HARNESS.CLAUDE]: () => Promise.resolve().then(() => (init_claude(), exports_claude)),
  [HARNESS.CODEX]: () => Promise.resolve().then(() => (init_codex(), exports_codex)),
  [HARNESS.DEEPSEEK]: () => Promise.resolve().then(() => (init_deepseek(), exports_deepseek)),
  [HARNESS.GROK]: () => Promise.resolve().then(() => (init_grok(), exports_grok)),
  [HARNESS.HERMES]: () => Promise.resolve().then(() => (init_hermes(), exports_hermes)),
  [HARNESS.OPENCODE]: () => Promise.resolve().then(() => (init_opencode(), exports_opencode)),
  [HARNESS.PI]: () => Promise.resolve().then(() => (init_pi(), exports_pi)),
  [HARNESS.PRIME]: () => Promise.resolve().then(() => (init_prime(), exports_prime))
};
async function loadHarness(harness) {
  const loader = LOADERS[harness];
  if (!loader) {
    throw new Error(`Harness "${harness}" is not implemented yet.`);
  }
  const mod = await loader();
  return mod.default;
}
function isHarnessImplemented(harness) {
  return harness in LOADERS;
}

// packages/cli/src/lib/detect.ts
init_harness();
import { spawnSync } from "child_process";
function resolveBinPath(bin) {
  const isWindows = process.platform === "win32";
  const result = spawnSync(isWindows ? "where" : "which", [bin], { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  const path16 = result.stdout.trim().split(`
`)[0]?.trim();
  return path16 || null;
}
function detectInstalledHarnesses(harnesses = ALL_HARNESSES) {
  const result = {};
  for (const harness of harnesses) {
    const path16 = resolveBinPath(HARNESS_BIN[harness]);
    result[harness] = { installed: Boolean(path16), path: path16 };
  }
  return result;
}
function detectInstalledHarness(harness) {
  const path16 = resolveBinPath(HARNESS_BIN[harness]);
  return { installed: Boolean(path16), path: path16 };
}
function missingHarnessMessage(harness) {
  const install = HARNESS_INSTALL[harness];
  return [
    `${HARNESS_LABEL[harness]} is not installed or "${HARNESS_BIN[harness]}" is not on PATH.`,
    `Install it with: ${install.command}`,
    `Docs: ${install.url}`,
    `Then re-run: togetherlink ${harness}`
  ].join(`
`);
}

// packages/cli/src/lib/commands/global.ts
init_global_config();
init_version();
function printHelp() {
  console.log(`togetherlink v${VERSION} \u2014 Together AI for coding CLIs

Usage:
  togetherlink configure
  togetherlink update           update to the latest release
  togetherlink whoami
  togetherlink usage [--last 7d]  tracked spend for Claude, Codex, and ChatGPT
  togetherlink chatgpt [--model <model>] [--restore]  (alpha)
  togetherlink daemon install    enable daemon auto-start at login (macOS/Linux)
  togetherlink daemon uninstall  disable daemon auto-start at login (macOS/Linux)
  togetherlink daemon status     show auto-start service status
  togetherlink codex [...]       (alias: tcodex)
  togetherlink deepseek [...]    (alpha, alias: tdeepseek)
  togetherlink grok [...]        (alias: tgrok)
  togetherlink hermes [...]      (alias: thermes)
  togetherlink hermes desktop [...]
  togetherlink claude [...]      (alias: tclaude)
  togetherlink pi [...]          (alias: tpi)
  togetherlink prime [...]       (alias: tprime)
  togetherlink opencode [...]    (alias: topencode)

Extra args after codex/deepseek/claude/grok/hermes/pi/prime/opencode are passed through.
DeepSeek Harness support is alpha and launches its web profile with ephemeral Together settings.
ChatGPT App support is alpha; run \`togetherlink chatgpt --restore\` (alias: codex-app) to restore the previous desktop config.

Docs: https://togetherlink.vercel.app/llms.txt
  LLM-readable documentation \u2014 if you are an AI agent asked to install, configure,
  or use togetherlink (including headless use), read that file first.
`);
}
async function runConfigure(home = os6.homedir()) {
  pe("togetherlink configure");
  const detected = detectInstalledHarnesses();
  const notImplemented = ALL_HARNESSES.filter((h2) => !isHarnessImplemented(h2));
  const lines = ALL_HARNESSES.map((h2) => {
    const found = detected[h2].installed ? "found" : "not found";
    const support = isHarnessImplemented(h2) ? " (ephemeral settings)" : " (support coming later)";
    return `  ${HARNESS_LABEL[h2]}: ${found}${support}`;
  });
  v2.info(`Detected tools:
${lines.join(`
`)}`);
  const existing = resolveStoredApiKey((await readGlobalConfig(home)).apiKey);
  let apiKey = existing || process.env.TOGETHER_API_KEY || "";
  if (!apiKey) {
    const entered = await oe({
      message: "Together API key (from https://api.together.ai/settings/api-keys):",
      validate: (value) => value.trim() ? undefined : "An API key is required"
    });
    if (lD(entered)) {
      he("Cancelled.");
      return false;
    }
    apiKey = entered.trim();
  }
  await setGlobalApiKey(home, apiKey);
  const existingExa = resolveStoredExaApiKey((await readGlobalConfig(home)).exaApiKey);
  let exaApiKey = existingExa || process.env.EXA_API_KEY || "";
  if (!exaApiKey) {
    const enteredExa = await oe({
      message: "Exa API key for web search (from https://exa.ai \u2014 press Enter to skip; web search will be disabled):",
      validate: (value) => value.trim() || value === "" ? undefined : undefined
    });
    if (lD(enteredExa)) {
      he("Cancelled.");
      return false;
    }
    exaApiKey = enteredExa.trim();
  }
  await setGlobalExaApiKey(home, exaApiKey);
  if (exaApiKey) {
    v2.success("Exa web search enabled.");
  } else {
    v2.info("Exa key skipped \u2014 web search will be unavailable in Claude Code.");
  }
  const launchable = ALL_HARNESSES.filter((h2) => isHarnessImplemented(h2) && detected[h2].installed);
  if (launchable.length > 0) {
    v2.info(`Ready to launch: ${launchable.map((h2) => HARNESS_LABEL[h2]).join(", ")}. Run \`togetherlink <harness>\` to start \u2014 nothing is written to disk.`);
  }
  if (notImplemented.length > 0) {
    v2.info(`${notImplemented.map((h2) => HARNESS_LABEL[h2]).join(" and ")} support is coming in a later phase (needs a local translation proxy).`);
  }
  ge("Done.");
  return true;
}

// packages/cli/src/lib/commands/harness.ts
init_harness();
import os7 from "os";

// packages/cli/src/lib/install-harness.ts
import { spawn as spawn4 } from "child_process";
init_harness();
var DEMAND_INSTALLERS = {
  [HARNESS.DEEPSEEK]: {
    command: "npm",
    args: ["install", "-g", "@deepseek-ai/dsh"]
  }
};
function runInstaller(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn4(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (status) => resolve(status));
  });
}
async function ensureHarnessInstalled(harness, options = {}) {
  const detect = options.detect ?? detectInstalledHarness;
  if (detect(harness).installed) {
    return false;
  }
  const installer = DEMAND_INSTALLERS[harness];
  if (!installer) {
    throw new Error(missingHarnessMessage(harness));
  }
  const run = options.run ?? runInstaller;
  process.stderr.write(`togetherlink \u25B8 ${HARNESS_LABEL[harness]} is not installed; installing it now\u2026
`);
  const status = await run(installer.command, [...installer.args]);
  if (status !== 0) {
    throw new Error(`Could not install ${HARNESS_LABEL[harness]} (npm exited with status ${status ?? "unknown"}).
${missingHarnessMessage(harness)}`);
  }
  if (!detect(harness).installed) {
    throw new Error(`${HARNESS_LABEL[harness]} installed, but "${HARNESS_BIN[harness]}" is still not on PATH. Open a new shell and re-run: togetherlink ${harness}`);
  }
  process.stderr.write(`togetherlink \u25B8 ${HARNESS_LABEL[harness]} installed. Launching\u2026
`);
  return true;
}

// packages/cli/src/lib/commands/harness.ts
async function dispatchHarnessCommand(harnessName, verb, flags) {
  if (!isKnownHarness(harnessName)) {
    throw new Error(`Unknown harness "${harnessName}". Expected one of: ${ALL_HARNESSES.join(", ")}`);
  }
  if (!isHarnessImplemented(harnessName)) {
    throw new Error(`${HARNESS_LABEL[harnessName]} support isn't built yet (coming in a later phase \u2014 it needs a local translation proxy).`);
  }
  const harnessModule = await loadHarness(harnessName);
  if (verb !== undefined && verb !== "run") {
    throw new Error(`Unknown command "${harnessName} ${verb}". Expected: run.`);
  }
  if (!detectInstalledHarness(harnessName).installed) {
    await ensureHarnessInstalled(harnessName);
  }
  const ctx = { home: os7.homedir(), ...flags };
  const result = await harnessModule.run(ctx);
  renderResult(result, flags);
}
function isKnownHarness(value) {
  return value !== undefined && ALL_HARNESSES.includes(value);
}
function renderResult(result, flags) {
  if (!result) {
    return;
  }
  if (result.message) {
    console.log(result.message);
  }
  if (result.payload) {
    if (flags.json) {
      console.log(JSON.stringify(result.payload, null, 2));
    } else {
      for (const [key, value] of Object.entries(result.payload)) {
        console.log(`${key}: ${value ?? "(unset)"}`);
      }
    }
  }
}

// packages/cli/src/lib/commands/harness-invocation.ts
init_harness();
function resolveHarnessInvocation(positional, flags) {
  const [rawCommand, ...passthrough] = positional;
  const command = rawCommand === "picode" ? "pi" : rawCommand;
  return isHarnessCommand(command) ? { command, flags: withPrependedPassthrough(flags, passthrough) } : { command, flags };
}
function isHarnessCommand(value) {
  return value !== undefined && ALL_HARNESSES.includes(value);
}
function withPrependedPassthrough(flags, args) {
  const passthrough = [...args, ...flags.passthrough ?? []];
  if (passthrough.length === 0) {
    return flags;
  }
  const hasSeparator = passthrough[0] === "--";
  return {
    ...flags,
    passthrough: hasSeparator ? passthrough.slice(1) : passthrough,
    ...hasSeparator ? { passthroughSeparator: true } : {}
  };
}

// packages/cli/src/bin/togetherlink.ts
init_global_config();

// packages/cli/src/lib/autoupdate.ts
init_version();
import { constants } from "fs";
import { access, mkdir as mkdir12, writeFile as writeFile10, rename as rename6, stat as stat2, symlink } from "fs/promises";
import path16 from "path";
import os8 from "os";
var UPDATE_ORIGIN = "https://togetherlink.vercel.app";
function resolveManifestUrl() {
  return process.env.TOGETHERLINK_MANIFEST_URL ?? `${UPDATE_ORIGIN}/latest.json`;
}
var THROTTLE_MS = 60 * 60 * 1000;
var OVERALL_TIMEOUT_MS = 1e4;
var FETCH_TIMEOUT_MS = 5000;
function resolveInstallDir() {
  return process.env.TOGETHERLINK_HOME || path16.join(os8.homedir(), ".togetherlink");
}
function installedBundlePath() {
  return path16.join(resolveInstallDir(), "bin", "togetherlink.js");
}
var INSTALLED_WRAPPERS = [
  ["togetherlink", undefined],
  ["tclaude", "claude"],
  ["topencode", "opencode"],
  ["tcodex", "codex"],
  ["tdeepseek", "deepseek"],
  ["tgrok", "grok"],
  ["thermes", "hermes"],
  ["tpi", "pi"],
  ["tprime", "prime"]
];
function quoteForSh(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
async function findWritablePathDir(binDir, env) {
  if (process.platform === "win32") {
    return;
  }
  for (const candidate of (env.PATH ?? "").split(path16.delimiter)) {
    if (!candidate || path16.resolve(candidate) === path16.resolve(binDir)) {
      continue;
    }
    try {
      if (!(await stat2(candidate)).isDirectory()) {
        continue;
      }
      await access(candidate, constants.W_OK);
      return candidate;
    } catch {
    }
  }
  return;
}
async function ensureInstalledWrappers(installDir = resolveInstallDir(), env = process.env) {
  const binDir = path16.join(installDir, "bin");
  const bundle = quoteForSh(path16.join(binDir, "togetherlink.js"));
  await mkdir12(binDir, { recursive: true });
  await Promise.all(INSTALLED_WRAPPERS.map(async ([name, harness]) => {
    const harnessArg = harness ? ` ${harness}` : "";
    const contents = `#!/usr/bin/env sh
exec bun ${bundle}${harnessArg} "$@"
`;
    try {
      await writeFile10(path16.join(binDir, name), contents, { flag: "wx", mode: 493 });
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }));
  const linkDir = await findWritablePathDir(binDir, env);
  if (!linkDir) {
    return;
  }
  await Promise.all(INSTALLED_WRAPPERS.map(async ([name]) => {
    try {
      await symlink(path16.join(binDir, name), path16.join(linkDir, name));
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }));
}
function isInstalledBundle() {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  try {
    const resolved = path16.resolve(argv1);
    const installed = installedBundlePath();
    return realpathSafe(resolved) === realpathSafe(installed);
  } catch {
    return false;
  }
}
function realpathSafe(p) {
  try {
    return __require("fs").realpathSync(p);
  } catch {
    return p;
  }
}
function throttleFile() {
  return path16.join(resolveInstallDir(), ".update-check");
}
async function throttled() {
  try {
    const s = await stat2(throttleFile());
    return Date.now() - s.mtimeMs < THROTTLE_MS;
  } catch {
    return false;
  }
}
async function touchThrottle() {
  try {
    await writeFile10(throttleFile(), "", { flag: "w" });
  } catch {
  }
}
function parseSemver(v3) {
  const m2 = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v3.trim());
  if (!m2) {
    return null;
  }
  return [Number(m2[1]), Number(m2[2]), Number(m2[3])];
}
function isNewer(latest, current) {
  const a3 = parseSemver(latest);
  const b3 = parseSemver(current);
  if (!a3 || !b3) {
    return false;
  }
  for (let i = 0;i < 3; i += 1) {
    const av = a3[i];
    const bv = b3[i];
    if (av !== bv && av !== undefined && bv !== undefined) {
      return av > bv;
    }
  }
  return false;
}
async function withTimeout(p, ms) {
  let timer;
  const guard = new Promise((_3, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([p, guard]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
async function fetchManifest() {
  const res = await withTimeout(fetch(resolveManifestUrl(), {
    headers: { "User-Agent": `togetherlink/${VERSION}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  }), FETCH_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`manifest ${res.status}`);
  }
  const data = await res.json();
  if (!data?.version) {
    throw new Error("manifest missing version");
  }
  return data;
}
async function downloadTo(url, dest) {
  const res = await withTimeout(fetch(url, {
    headers: { "User-Agent": `togetherlink/${VERSION}` },
    signal: AbortSignal.timeout(OVERALL_TIMEOUT_MS)
  }), OVERALL_TIMEOUT_MS);
  if (!res.ok || !res.body) {
    throw new Error(`download ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) {
    throw new Error("empty download");
  }
  const tmp = `${dest}.new-${process.pid}`;
  await writeFile10(tmp, buf, { mode: 420 });
  await rename6(tmp, dest);
}
async function forceSelfUpdate() {
  if (!isInstalledBundle()) {
    return { status: "not-installed", version: VERSION };
  }
  try {
    await ensureInstalledWrappers();
  } catch {
  }
  const manifest = await withTimeout(fetchManifest(), OVERALL_TIMEOUT_MS);
  if (!isNewer(manifest.version, VERSION)) {
    return { status: "up-to-date", version: VERSION };
  }
  const dest = installedBundlePath();
  const url = manifest.url ?? `${UPDATE_ORIGIN}/togetherlink.js`;
  await downloadTo(url, dest);
  await touchThrottle();
  return { status: "updated", version: manifest.version };
}
async function maybeSelfUpdate() {
  if (!isInstalledBundle()) {
    return;
  }
  try {
    await ensureInstalledWrappers();
  } catch {
  }
  if (await throttled()) {
    return;
  }
  await touchThrottle();
  try {
    const manifest = await withTimeout(fetchManifest(), OVERALL_TIMEOUT_MS);
    if (!isNewer(manifest.version, VERSION)) {
      return;
    }
    const dest = installedBundlePath();
    const url = manifest.url ?? `${UPDATE_ORIGIN}/togetherlink.js`;
    await downloadTo(url, dest);
    process.stderr.write(`togetherlink: updated to v${manifest.version} (next run uses it)
`);
  } catch {
  }
}

// packages/cli/src/bin/togetherlink.ts
init_telemetry();
init_version();

// packages/cli/src/lib/interactive-launcher-options.ts
var COMMON_HARNESSES = [
  { value: "chatgpt", label: "ChatGPT Desktop", hint: "chatgpt" },
  { value: "claude", label: "Claude Code", hint: "tclaude" },
  { value: "codex", label: "Codex", hint: "tcodex" },
  { value: "opencode", label: "OpenCode", hint: "topencode" },
  { value: "pi", label: "Pi Code", hint: "tpi" }
];
var LESS_COMMON_HARNESSES = [
  { value: "deepseek", label: "DeepSeek Harness (alpha)", hint: "tdeepseek" },
  { value: "grok", label: "Grok Build", hint: "tgrok" },
  { value: "hermes", label: "Hermes Agent", hint: "thermes" },
  { value: "prime", label: "Prime Agent", hint: "tprime" }
];
var CONFIGURE = {
  value: "configure",
  label: "Configure",
  hint: "API keys and detected tools"
};
var SHOW_MORE = {
  value: "show-more",
  label: "Show more",
  hint: "DeepSeek, Grok, Hermes, and Prime"
};
function interactiveLauncherOptions(expanded = false) {
  if (expanded) {
    return [...COMMON_HARNESSES, ...LESS_COMMON_HARNESSES, CONFIGURE];
  }
  return [...COMMON_HARNESSES, CONFIGURE, SHOW_MORE];
}

// packages/cli/src/bin/togetherlink.ts
async function daemonStop() {
  const { autoStartStatus: autoStartStatus2, stopAutoStart: stopAutoStart2 } = await Promise.resolve().then(() => (init_platform_auto_start(), exports_platform_auto_start));
  const supervisor = await autoStartStatus2();
  if (supervisor.installed && supervisor.loaded && await stopAutoStart2()) {
    console.log("togetherlink daemon: stopped via the OS supervisor. It will start again on the next daemon-backed command or login.");
    return;
  }
  const { resolveDaemonPort: resolveDaemonPort2, daemonUrl: daemonUrl2, daemonPidPath: daemonPidPath2 } = await Promise.resolve().then(() => (init_server(), exports_server));
  const { readFile: readFile12, unlink: unlink5 } = await import("fs/promises");
  const pidPath = daemonPidPath2();
  const port = resolveDaemonPort2();
  let pid;
  try {
    const raw = (await readFile12(pidPath, "utf8")).trim();
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    pid = Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    pid = undefined;
  }
  if (pid === undefined) {
    console.log(`togetherlink daemon: not running (no pid file at ${pidPath}).`);
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch (err) {
    const code = err.code;
    if (code === "ESRCH") {
      try {
        await unlink5(pidPath);
      } catch {
      }
      console.log(`togetherlink daemon: not running (stale pid file removed).`);
      return;
    }
    throw err;
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  try {
    await unlink5(pidPath);
  } catch {
  }
  console.log(`togetherlink daemon: stopped (pid ${pid}) on ${daemonUrl2(port)}.`);
}
async function loadStoredExaKey() {
  if (process.env.EXA_API_KEY) {
    return;
  }
  try {
    const { exaApiKey } = await readGlobalConfig(process.env.HOME);
    const resolved = resolveStoredExaApiKey(exaApiKey);
    if (resolved) {
      process.env.EXA_API_KEY = resolved;
    }
  } catch {
  }
}
async function hasTogetherApiKey() {
  try {
    const home = process.env.HOME;
    if (!home) {
      return Boolean(process.env.TOGETHER_API_KEY?.trim());
    }
    const existing = resolveStoredApiKey((await readGlobalConfig(home)).apiKey);
    return Boolean(existing || process.env.TOGETHER_API_KEY?.trim());
  } catch {
    return Boolean(process.env.TOGETHER_API_KEY?.trim());
  }
}
async function ensureConfiguredForInteractiveLaunch() {
  if (await hasTogetherApiKey()) {
    return true;
  }
  if (!isInteractive2()) {
    return false;
  }
  const configured = await runConfigure();
  await loadStoredExaKey();
  return configured && await hasTogetherApiKey();
}
async function runInteractiveLauncher() {
  if (!isInteractive2()) {
    printHelp();
    return;
  }
  if (!await ensureConfiguredForInteractiveLaunch()) {
    return;
  }
  const clack = await Promise.resolve().then(() => (init_dist2(), exports_dist));
  let choice = await clack.select({
    message: "What do you want to run?",
    options: interactiveLauncherOptions()
  });
  if (clack.isCancel(choice)) {
    clack.cancel("Cancelled.");
    return;
  }
  if (choice === "show-more") {
    choice = await clack.select({
      message: "What do you want to run?",
      options: interactiveLauncherOptions(true)
    });
    if (clack.isCancel(choice)) {
      clack.cancel("Cancelled.");
      return;
    }
  }
  if (choice === "configure") {
    await runConfigure();
    return;
  }
  if (choice === "chatgpt") {
    const { runCodexAppCommand: runCodexAppCommand2 } = await Promise.resolve().then(() => (init_codex_app(), exports_codex_app));
    const result = await runCodexAppCommand2({ home: os9.homedir() });
    if (result.message) {
      console.log(result.message);
    }
    if (result.payload) {
      console.log(JSON.stringify(result.payload, null, 2));
    }
    return;
  }
  await dispatchHarnessCommand(choice, undefined, {});
}
function isInteractive2() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
async function main() {
  if (process.argv[2] === "update") {
    const result = await forceSelfUpdate();
    if (result.status === "not-installed") {
      throw new Error("This copy is not managed by the TogetherLink installer and cannot self-update.");
    }
    if (result.status === "up-to-date") {
      console.log(`togetherlink v${result.version} is already the latest version.`);
      return;
    }
    console.log(`togetherlink: updated to v${result.version}.`);
    return;
  }
  await maybeSelfUpdate();
  loadEnvFile();
  await loadStoredExaKey();
  const parsed = parseArgs(process.argv.slice(2));
  const [rawCommand, rawVerb] = parsed.positional;
  const command = rawCommand === "picode" ? "pi" : rawCommand === "chatgpt" || rawCommand === "chatgpt-app" ? "codex-app" : rawCommand;
  if (!command) {
    await runInteractiveLauncher();
    return;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    process.stdout.write(`togetherlink v${VERSION}
`);
    return;
  }
  if (command === "whoami") {
    process.stdout.write(`${await getInstallId()}
`);
    return;
  }
  if (command === "configure") {
    await runConfigure();
    return;
  }
  if (command === "usage") {
    if (rawVerb !== undefined) {
      throw new Error('Unknown "usage" argument. Expected: togetherlink usage --last 7d.');
    }
    const { buildUsageReport: buildUsageReport2 } = await Promise.resolve().then(() => (init_usage_report(), exports_usage_report));
    process.stdout.write(`${await buildUsageReport2(parsed.flags.last)}
`);
    return;
  }
  if (command === "__telemetry-install-completed") {
    await sendTelemetryEvent({ event: "install_completed" });
    return;
  }
  if (command === "--daemon") {
    const { runDaemon: runDaemon2 } = await Promise.resolve().then(() => (init_server(), exports_server));
    await runDaemon2();
    return;
  }
  if (command === "daemon") {
    const verb = rawVerb;
    if (verb === undefined) {
      throw new Error('Unknown "daemon" command. Expected: stop, install, uninstall, status.');
    }
    if (verb === "stop") {
      await daemonStop();
      return;
    }
    if (verb === "serve") {
      const { runDaemon: runDaemon2 } = await Promise.resolve().then(() => (init_server(), exports_server));
      await runDaemon2();
      return;
    }
    if (verb === "install" || verb === "uninstall" || verb === "status") {
      const { installAutoStart: installAutoStart2, uninstallAutoStart: uninstallAutoStart2, autoStartStatus: autoStartStatus2 } = await Promise.resolve().then(() => (init_platform_auto_start(), exports_platform_auto_start));
      if (verb === "install") {
        const { installed, message } = await installAutoStart2();
        console.log(message);
        process.exit(installed ? 0 : 1);
      }
      if (verb === "uninstall") {
        const { removed, message } = await uninstallAutoStart2();
        console.log(message);
        process.exit(removed ? 0 : 1);
      }
      const status = await autoStartStatus2();
      console.log(status.message);
      process.exit(status.installed && status.loaded ? 0 : 1);
    }
    throw new Error(`Unknown "daemon ${verb}" command. Expected: stop.`);
  }
  if (command === "codex-app") {
    if (!parsed.flags.restore && !await ensureConfiguredForInteractiveLaunch()) {
      throw new Error("No Together API key found. Run `togetherlink configure` or set TOGETHER_API_KEY.");
    }
    const { runCodexAppCommand: runCodexAppCommand2 } = await Promise.resolve().then(() => (init_codex_app(), exports_codex_app));
    const result = await runCodexAppCommand2({ home: os9.homedir(), ...parsed.flags });
    if (result.message) {
      console.log(result.message);
    }
    if (result.payload) {
      console.log(JSON.stringify(result.payload, null, 2));
    }
    return;
  }
  const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);
  if (isHarnessCommand(invocation.command)) {
    if (!await ensureConfiguredForInteractiveLaunch()) {
      throw new Error("No Together API key found. Run `togetherlink configure` or set TOGETHER_API_KEY.");
    }
  }
  if (isHarnessCommand(invocation.command)) {
    sendTelemetryEvent({ event: "cli_started", agent: invocation.command });
  }
  await dispatchHarnessCommand(invocation.command, undefined, invocation.flags);
}
main().catch((err) => {
  if (!(err instanceof Error)) {
    console.error(`Error: ${String(err)}`);
    process.exitCode = 1;
    return;
  }
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
});
