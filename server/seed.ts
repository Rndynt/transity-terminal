export { seedAll as seedData } from "./seeds/index";

if (import.meta.url === `file://${process.argv[1]}`) {
  import("./seeds/index").then(m => m.seedAll()).catch(console.error).finally(() => process.exit(0));
}
