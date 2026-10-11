import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";

const zip = promisify(gzip);
const unzip = promisify(gunzip);

export async function encodeBlob(value: unknown): Promise<Buffer> {
  return zip(Buffer.from(JSON.stringify(value), "utf8"));
}

export async function decodeBlob<T>(data: Buffer): Promise<T> {
  const gzipped = data[0] === 0x1f && data[1] === 0x8b;
  return JSON.parse((gzipped ? await unzip(data) : data).toString("utf8")) as T;
}
