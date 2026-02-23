import { stopTestDatabase } from "./setup/setup-testcontainers";

export default async function globalTeardown() {
  await stopTestDatabase();

  if (process.env.WTF_NODE === "1") {
    const wtfnode = await import("wtfnode");
    wtfnode.dump();
  }
}
