import "dotenv/config";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertBlendImageCount,
  BlendDimensions,
  Command,
  DefaultMJConfig,
  DiscordImage,
} from "../src";

/**
 * Minimal, network-free verification for the `/blend` support:
 *   npx tsx test/blend.payload.test.ts
 *
 * Covers:
 *  - blend payload assembly (options / attachments / dimensions)
 *  - image-count validation (min 2, max 5)
 *  - anti-regression: the example/doc demonstrate real `Blend`, not an
 *    `Imagine`-simulated blend.
 */

// Stub the network-bound command lookup so we can assert payload shape offline.
class StubCommand extends Command {
  async cacheCommand(_name: any): Promise<any> {
    return {
      version: "v-test",
      id: "cmd-test",
      name: "blend",
      type: 1,
      application_id: "app-test",
    };
  }
}

const img = (n: number): DiscordImage => ({
  id: n,
  filename: `img${n}.png`,
  upload_filename: `uploads/img${n}.png`,
});

async function testPayloadAssembly() {
  const stub = new StubCommand(DefaultMJConfig);
  const payload: any = await stub.blendPayload(
    [img(0), img(1)],
    BlendDimensions.Landscape,
    "nonce-1"
  );

  assert.equal(payload.type, 2, "interaction payload type should be 2");
  assert.equal(payload.nonce, "nonce-1", "nonce should be forwarded");
  assert.equal(payload.data.name, "blend", "command name should be blend");

  const options = payload.data.options;
  assert.equal(options.length, 3, "2 image options + 1 dimensions option");

  assert.deepEqual(
    { type: options[0].type, name: options[0].name, value: options[0].value },
    { type: 11, name: "image1", value: 0 }
  );
  assert.deepEqual(
    { type: options[1].type, name: options[1].name, value: options[1].value },
    { type: 11, name: "image2", value: 1 }
  );
  assert.deepEqual(
    { type: options[2].type, name: options[2].name, value: options[2].value },
    { type: 3, name: "dimensions", value: "--ar 3:2" }
  );

  const attachments = payload.data.attachments;
  assert.equal(attachments.length, 2, "one attachment per image");
  assert.deepEqual(attachments[0], {
    id: "0",
    filename: "img0.png",
    uploaded_filename: "uploads/img0.png",
  });
  assert.deepEqual(attachments[1], {
    id: "1",
    filename: "img1.png",
    uploaded_filename: "uploads/img1.png",
  });

  console.log("ok - blend payload assembly");
}

async function testDefaultDimensions() {
  const stub = new StubCommand(DefaultMJConfig);
  const payload: any = await stub.blendPayload([img(0), img(1)]);
  const dim = payload.data.options[payload.data.options.length - 1];
  assert.equal(dim.value, "--ar 1:1", "default dimensions should be Square");
  console.log("ok - blend default dimensions (square)");
}

async function testImageCountValidation() {
  const stub = new StubCommand(DefaultMJConfig);

  await assert.rejects(
    stub.blendPayload([img(0)]),
    /at least 2 images/,
    "fewer than 2 images must be rejected"
  );
  await assert.rejects(
    stub.blendPayload([img(0), img(1), img(2), img(3), img(4), img(5)]),
    /at most 5 images/,
    "more than 5 images must be rejected"
  );

  assert.throws(() => assertBlendImageCount(1), /at least 2 images/);
  assert.throws(() => assertBlendImageCount(6), /at most 5 images/);
  assert.doesNotThrow(() => assertBlendImageCount(2));
  assert.doesNotThrow(() => assertBlendImageCount(5));

  console.log("ok - blend image-count validation");
}

function testExampleIsRealBlend() {
  const examplePath = join(process.cwd(), "example", "imagine-blend.ts");
  const example = readFileSync(examplePath, "utf8");

  assert.match(example, /\.Blend\s*\(/, "example must call client.Blend(...)");
  assert.ok(
    !/\.Imagine\s*\(/.test(example),
    "blend example must NOT simulate blend via Imagine(...)"
  );
  assert.match(
    example,
    /BlendDimensions/,
    "example should demonstrate BlendDimensions"
  );

  console.log("ok - example demonstrates real /blend");
}

function testDocIsFilled() {
  const docPath = join(
    process.cwd(),
    "doc",
    "getting-started",
    "api-reference",
    "blend.md"
  );
  const doc = readFileSync(docPath, "utf8");

  assert.match(doc, /client\.Blend/, "doc must document client.Blend");
  assert.ok(
    doc.replace(/#.*$/m, "").trim().length > 50,
    "doc must not be an empty stub"
  );

  console.log("ok - blend doc is filled in");
}

async function main() {
  await testPayloadAssembly();
  await testDefaultDimensions();
  await testImageCountValidation();
  testExampleIsRealBlend();
  testDocIsFilled();
  console.log("\nAll blend tests passed.");
}

main().catch((err) => {
  console.error("blend tests failed:");
  console.error(err);
  process.exit(1);
});
