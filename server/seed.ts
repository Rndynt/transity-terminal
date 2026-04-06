export { seedAll as seedData } from "./seeds/index";

if (import.meta.url === `file://${process.argv[1]}`) {
  const set = (process.argv[2] || "buskita") as "nusa" | "buskita";
  import("./seeds/index").then(m => m.seedAll(set)).catch(console.error).finally(() => process.exit(0));
}
