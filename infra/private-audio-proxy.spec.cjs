const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const { createRequire } = require("node:module");

const projectRoot = process.env.PROJECT_ROOT;
if (!projectRoot) throw new Error("PROJECT_ROOT is required");
const projectRequire = createRequire(`${projectRoot}/backend/package.json`);
const {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = projectRequire("@aws-sdk/client-s3");
const { getSignedUrl } = projectRequire("@aws-sdk/s3-request-presigner");

const mode = process.argv[2];
const proxyPort = Number(process.env.E13_PROXY_PORT ?? "18080");
const minioPort = Number(process.env.E13_MINIO_PORT ?? "19000");
const signedUrlFile = process.env.E13_SIGNED_URL_FILE;
const contentBucket = process.env.S3_BUCKET_CONTENT ?? "sq-content-e13";
const otherBucket = "sq-other-e13";
const key = "fixtures/audio.mp3";
const credentials = {
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
};
const common = { region: "us-east-1", forcePathStyle: true, credentials };

function rawGet(path) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { host: "127.0.0.1", port: proxyPort, path },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    request.on("error", reject);
  });
}

async function healthy() {
  assert.ok(signedUrlFile, "E13_SIGNED_URL_FILE is required");
  const internal = new S3Client({
    ...common,
    endpoint: `http://127.0.0.1:${minioPort}`,
  });
  const external = new S3Client({
    ...common,
    endpoint: `http://127.0.0.1:${proxyPort}`,
  });
  for (const bucket of [contentBucket, otherBucket]) {
    await internal.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  const audio = Buffer.alloc(8192);
  for (let i = 0; i < audio.length; i += 1) audio[i] = i % 251;
  await internal.send(
    new PutObjectCommand({
      Bucket: contentBucket,
      Key: key,
      Body: audio,
      ContentType: "audio/mpeg",
    }),
  );
  await internal.send(
    new PutObjectCommand({
      Bucket: otherBucket,
      Key: "secret.txt",
      Body: "other-bucket-secret",
      ContentType: "text/plain",
    }),
  );

  const signed = await getSignedUrl(
    external,
    new GetObjectCommand({ Bucket: contentBucket, Key: key }),
    { expiresIn: 60 },
  );
  const parsed = new URL(signed);
  assert.equal(parsed.pathname, `/${contentBucket}/${key}`);
  assert.equal(parsed.pathname.split(contentBucket).length - 1, 1);
  fs.writeFileSync(signedUrlFile, signed, { mode: 0o600 });

  const full = await fetch(signed);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-type"), "audio/mpeg");
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), audio);

  for (const [range, start, end] of [
    ["bytes=0-255", 0, 255],
    ["bytes=4096-4351", 4096, 4351],
  ]) {
    const response = await fetch(signed, { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("accept-ranges"), "bytes");
    assert.equal(
      response.headers.get("content-range"),
      `bytes ${start}-${end}/${audio.length}`,
    );
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      audio.subarray(start, end + 1),
    );
  }

  assert.equal(
    (await fetch(`http://127.0.0.1:${proxyPort}/${contentBucket}/${key}`))
      .status,
    403,
  );
  const tampered = new URL(signed);
  const signature = tampered.searchParams.get("X-Amz-Signature");
  tampered.searchParams.set(
    "X-Amz-Signature",
    `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`,
  );
  assert.equal((await fetch(tampered)).status, 403);

  const short = await getSignedUrl(
    external,
    new GetObjectCommand({ Bucket: contentBucket, Key: key }),
    { expiresIn: 1 },
  );
  await new Promise((resolve) => setTimeout(resolve, 2500));
  assert.equal((await fetch(short)).status, 403);

  const signedHead = await getSignedUrl(
    external,
    new HeadObjectCommand({ Bucket: contentBucket, Key: key }),
    { expiresIn: 60 },
  );
  assert.equal((await fetch(signedHead, { method: "HEAD" })).status, 405);
  const signedPut = await getSignedUrl(
    external,
    new PutObjectCommand({ Bucket: contentBucket, Key: "blocked.mp3" }),
    { expiresIn: 60 },
  );
  assert.equal(
    (await fetch(signedPut, { method: "PUT", body: "blocked" })).status,
    405,
  );
  const signedDelete = await getSignedUrl(
    external,
    new DeleteObjectCommand({ Bucket: contentBucket, Key: key }),
    { expiresIn: 60 },
  );
  assert.equal((await fetch(signedDelete, { method: "DELETE" })).status, 405);
  const signedList = await getSignedUrl(
    external,
    new ListObjectsV2Command({ Bucket: contentBucket }),
    { expiresIn: 60 },
  );
  assert.equal((await fetch(signedList)).status, 404);

  console.log(
    JSON.stringify({
      signedGet: 200,
      ranges: [206, 206],
      unsigned: 403,
      tampered: 403,
      expired: 403,
      head: 405,
      put: 405,
      delete: 405,
      listing: 404,
    }),
  );
}

async function upstreamFailure() {
  assert.ok(signedUrlFile, "E13_SIGNED_URL_FILE is required");
  const signed = fs.readFileSync(signedUrlFile, "utf8");
  const response = await fetch(signed);
  assert.ok([502, 504].includes(response.status));
  console.log(`upstream_failure_status=${response.status}`);
}

async function isolation() {
  const internal = new S3Client({
    ...common,
    endpoint: `http://127.0.0.1:${minioPort}`,
  });
  const external = new S3Client({
    ...common,
    endpoint: `http://127.0.0.1:${proxyPort}`,
  });
  const directOtherUrl = await getSignedUrl(
    internal,
    new GetObjectCommand({ Bucket: otherBucket, Key: "secret.txt" }),
    { expiresIn: 60 },
  );
  const directOther = await fetch(directOtherUrl);
  assert.equal(directOther.status, 200);
  assert.equal(await directOther.text(), "other-bucket-secret");

  const edgeOtherUrl = await getSignedUrl(
    external,
    new GetObjectCommand({ Bucket: otherBucket, Key: "secret.txt" }),
    { expiresIn: 60 },
  );
  const edgeOther = await fetch(edgeOtherUrl);
  const edgeOtherBody = await edgeOther.text();

  const signedContentUrl = new URL(
    await getSignedUrl(
      external,
      new GetObjectCommand({ Bucket: contentBucket, Key: key }),
      { expiresIn: 60 },
    ),
  );
  // The query is valid for the original content-object URI. Mutating the path
  // invalidates SigV4; exact catch-all 502 vs an S3 response carrying a
  // request ID tests nginx route selection, not traversal-signature validity.
  const traversalResponses = [];
  for (const path of [
    `/${contentBucket}/../${otherBucket}/secret.txt${signedContentUrl.search}`,
    `/${contentBucket}/%2e%2e/${otherBucket}/secret.txt${signedContentUrl.search}`,
  ]) {
    const traversal = await rawGet(path);
    traversalResponses.push(traversal);
    assert.equal(traversal.body.includes("other-bucket-secret"), false);
  }
  const traversalStatuses = traversalResponses.map(({ status }) => status);

  const wildcardNegativeControl = process.env.E13_EXPECT_WILDCARD === "true";
  if (wildcardNegativeControl) {
    assert.equal(edgeOther.status, 200);
    assert.equal(edgeOtherBody, "other-bucket-secret");
    assert.equal(
      traversalStatuses.every((status) => status !== 502),
      true,
    );
    assert.equal(
      traversalResponses.every(
        ({ headers }) => typeof headers["x-amz-request-id"] === "string",
      ),
      true,
    );
  } else {
    // The test override maps the non-S3 catch-all upstream to a closed port,
    // so 502 proves these normalized paths did not reach MinIO. A wildcard S3
    // route produces the negative-control statuses asserted above.
    assert.equal(edgeOther.status, 502);
    assert.equal(edgeOtherBody.includes("other-bucket-secret"), false);
    assert.deepEqual(traversalStatuses, [502, 502]);
  }

  console.log(
    JSON.stringify({
      directInternalOtherBucket: directOther.status,
      signedOtherBucketThroughEdge: edgeOther.status,
      mutatedSignedTraversalRouteStatuses: traversalStatuses,
      mutatedSignedTraversalReachedMinio: traversalResponses.every(
        ({ headers }) => typeof headers["x-amz-request-id"] === "string",
      ),
      wildcardNegativeControl,
    }),
  );
}

const operation =
  mode === "healthy"
    ? healthy
    : mode === "upstream-failure"
      ? upstreamFailure
      : mode === "isolation"
        ? isolation
        : null;
if (!operation) throw new Error(`unknown mode: ${mode}`);
operation().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
