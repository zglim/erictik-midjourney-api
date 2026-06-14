/**
 * Unit tests for the CustomPan / CustomButton feature.
 *
 * These tests validate the pure logic (direction validation, content generation,
 * option lookup) without requiring a live Discord/Midjourney connection.
 *
 * Run with:
 * ```
 * npx tsx test/custompan.test.ts
 * ```
 */
import assert from "assert";
import {
  isValidPanDirection,
  buildPanContent,
  findOptionByLabel,
  PAN_DIRECTION_LABEL,
  PAN_DIRECTION_FLAG,
} from "../src/utils";
import { MJOptions } from "../src/interfaces";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

// ─── Direction validation ────────────────────────────────────────────
console.log("\n--- isValidPanDirection ---");

test("accepts 'left'", () => {
  assert.strictEqual(isValidPanDirection("left"), true);
});

test("accepts 'right'", () => {
  assert.strictEqual(isValidPanDirection("right"), true);
});

test("accepts 'up'", () => {
  assert.strictEqual(isValidPanDirection("up"), true);
});

test("accepts 'down'", () => {
  assert.strictEqual(isValidPanDirection("down"), true);
});

test("rejects invalid direction 'diagonal'", () => {
  assert.strictEqual(isValidPanDirection("diagonal"), false);
});

test("rejects empty string", () => {
  assert.strictEqual(isValidPanDirection(""), false);
});

// ─── Content generation ──────────────────────────────────────────────
console.log("\n--- buildPanContent ---");

test("generates correct content for right pan", () => {
  const result = buildPanContent("a cat", "right", 2);
  assert.strictEqual(result, "a cat --pan_right 2");
});

test("generates correct content for left pan", () => {
  const result = buildPanContent("a cat", "left", 2);
  assert.strictEqual(result, "a cat --pan_left 2");
});

test("generates correct content for up pan", () => {
  const result = buildPanContent("a cat", "up", 3);
  assert.strictEqual(result, "a cat --pan_up 3");
});

test("generates correct content for down pan", () => {
  const result = buildPanContent("a cat", "down", 1);
  assert.strictEqual(result, "a cat --pan_down 1");
});

test("defaults amount to 2", () => {
  const result = buildPanContent("a cat", "right");
  assert.strictEqual(result, "a cat --pan_right 2");
});

test("throws on invalid direction", () => {
  assert.throws(() => {
    buildPanContent("a cat", "diagonal" as any, 2);
  }, /Invalid pan direction/);
});

test("throws on zero amount", () => {
  assert.throws(() => {
    buildPanContent("a cat", "right", 0);
  }, /Invalid pan amount/);
});

test("throws on negative amount", () => {
  assert.throws(() => {
    buildPanContent("a cat", "right", -1);
  }, /Invalid pan amount/);
});

test("throws on NaN amount", () => {
  assert.throws(() => {
    buildPanContent("a cat", "right", NaN);
  }, /Invalid pan amount/);
});

// ─── Option lookup ──────────────────────────────────────────────────
console.log("\n--- findOptionByLabel ---");

const sampleOptions: MJOptions[] = [
  { label: "U1", type: 2, style: 2, custom: "MJ::JOB::upsample::1::abc" },
  { label: "U2", type: 2, style: 2, custom: "MJ::JOB::upsample::2::abc" },
  { label: "\u27a1\ufe0f", type: 2, style: 2, custom: "MJ::JOB::pan_right::abc" },
  { label: "\u2b05\ufe0f", type: 2, style: 2, custom: "MJ::JOB::pan_left::abc" },
  { label: "\u2b06\ufe0f", type: 2, style: 2, custom: "MJ::JOB::pan_up::abc" },
  { label: "\u2b07\ufe0f", type: 2, style: 2, custom: "MJ::JOB::pan_down::abc" },
  { label: "Custom Zoom", type: 2, style: 2, custom: "MJ::CustomZoom::abc" },
];

test("finds U1 option", () => {
  const result = findOptionByLabel(sampleOptions, "U1");
  assert.ok(result);
  assert.strictEqual(result.custom, "MJ::JOB::upsample::1::abc");
});

test("finds right pan button by emoji label", () => {
  const result = findOptionByLabel(sampleOptions, PAN_DIRECTION_LABEL.right);
  assert.ok(result);
  assert.strictEqual(result.custom, "MJ::JOB::pan_right::abc");
});

test("finds left pan button by emoji label", () => {
  const result = findOptionByLabel(sampleOptions, PAN_DIRECTION_LABEL.left);
  assert.ok(result);
  assert.strictEqual(result.custom, "MJ::JOB::pan_left::abc");
});

test("finds up pan button by emoji label", () => {
  const result = findOptionByLabel(sampleOptions, PAN_DIRECTION_LABEL.up);
  assert.ok(result);
  assert.strictEqual(result.custom, "MJ::JOB::pan_up::abc");
});

test("finds down pan button by emoji label", () => {
  const result = findOptionByLabel(sampleOptions, PAN_DIRECTION_LABEL.down);
  assert.ok(result);
  assert.strictEqual(result.custom, "MJ::JOB::pan_down::abc");
});

test("finds Custom Zoom option", () => {
  const result = findOptionByLabel(sampleOptions, "Custom Zoom");
  assert.ok(result);
  assert.strictEqual(result.custom, "MJ::CustomZoom::abc");
});

test("returns undefined for missing label", () => {
  const result = findOptionByLabel(sampleOptions, "Nonexistent");
  assert.strictEqual(result, undefined);
});

test("returns undefined for undefined options", () => {
  const result = findOptionByLabel(undefined, "U1");
  assert.strictEqual(result, undefined);
});

test("returns undefined for empty options array", () => {
  const result = findOptionByLabel([], "U1");
  assert.strictEqual(result, undefined);
});

// ─── PAN_DIRECTION maps consistency ─────────────────────────────────
console.log("\n--- PAN_DIRECTION maps ---");

test("all directions have labels", () => {
  for (const dir of ["left", "right", "up", "down"] as const) {
    assert.ok(PAN_DIRECTION_LABEL[dir], `missing label for ${dir}`);
  }
});

test("all directions have flags", () => {
  for (const dir of ["left", "right", "up", "down"] as const) {
    assert.ok(PAN_DIRECTION_FLAG[dir], `missing flag for ${dir}`);
  }
});

// ─── Verify Custom/ZoomOut not broken (type-level check) ────────────
console.log("\n--- Existing API backward compatibility ---");

test("Midjourney class has Custom, ZoomOut, CustomPan, CustomButton", () => {
  // We import the class to verify the methods exist at the prototype level.
  // This is a structural check, not a runtime integration test.
  const { Midjourney } = require("../src/midjourney");
  assert.strictEqual(typeof Midjourney.prototype.Custom, "function");
  assert.strictEqual(typeof Midjourney.prototype.ZoomOut, "function");
  assert.strictEqual(typeof Midjourney.prototype.Variation, "function");
  assert.strictEqual(typeof Midjourney.prototype.Upscale, "function");
  assert.strictEqual(typeof Midjourney.prototype.CustomPan, "function");
  assert.strictEqual(typeof Midjourney.prototype.CustomButton, "function");
});

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
