import { cp, mkdir } from "node:fs/promises";

const output = new URL("../docs/", import.meta.url);
await mkdir(output, { recursive: true });
for (const file of ["index.html", "styles.css", "app.js", "game.js", "CNAME"]) {
  await cp(new URL(`../src/${file}`, import.meta.url), new URL(file, output));
}
console.log("Built static site in docs/");
