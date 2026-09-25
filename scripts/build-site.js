const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const excludedPageFiles = new Set([
    "blog-maker.html",
    "blog-posts.json",
    "project-posts.json"
]);

async function copyTree(source, destination, relative = "") {
    await fs.mkdir(destination, { recursive: true });
    for (const entry of await fs.readdir(source, { withFileTypes: true })) {
        const childRelative = path.join(relative, entry.name);
        if (relative === "Page" && excludedPageFiles.has(entry.name)) continue;
        const sourcePath = path.join(source, entry.name);
        const destinationPath = path.join(destination, entry.name);
        if (entry.isDirectory()) {
            await copyTree(sourcePath, destinationPath, childRelative);
        } else if (entry.isFile()) {
            await fs.copyFile(sourcePath, destinationPath);
        }
    }
}

async function main() {
    await fs.rm(output, { recursive: true, force: true });
    await fs.mkdir(output, { recursive: true });
    await fs.copyFile(path.join(root, "index.html"), path.join(output, "index.html"));
    await copyTree(path.join(root, "assets"), path.join(output, "assets"), "assets");
    await copyTree(path.join(root, "Page"), path.join(output, "Page"), "Page");

    for (const page of ["blog.html", "projects.html"]) {
        const file = path.join(output, "Page", page);
        let html = await fs.readFile(file, "utf8");
        html = html.replace(/<a href="blog-maker\.html" class="header-link">BLOG MAKER ↗<\/a>/g, "");
        await fs.writeFile(file, html, "utf8");
    }

    console.log("Netlify site built in dist/ (local Blog Maker excluded).");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
