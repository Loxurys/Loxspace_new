const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = __dirname;
const pageDir = path.join(root, "Page");
const blogDir = path.join(pageDir, "blogs");
const postsFile = path.join(pageDir, "blog-posts.json");
const port = Number(process.env.LOCAL_SERVER_PORT) || 4173;

const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
};

function send(response, status, body, contentType = "application/json; charset=utf-8") {
    response.writeHead(status, {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store"
    });
    response.end(body);
}

function json(response, status, value) {
    send(response, status, JSON.stringify(value));
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function formatDate(value) {
    if (!value) return "Undated";
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.valueOf())) return "Undated";
    return new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function readingTime(content) {
    return Math.max(1, Math.ceil(String(content || "").trim().split(/\s+/).filter(Boolean).length / 200));
}

function getYouTubeEmbedUrl(value) {
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase().replace(/^www\./, "");
        let id = "";
        if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
        else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
            const parts = url.pathname.split("/").filter(Boolean);
            if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
            else if (["shorts", "embed", "live"].includes(parts[0])) id = parts[1] || "";
        }
        return /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    } catch { return ""; }
}

function renderContent(content) {
    const lines = String(content || "").trim().split(/\r?\n/);
    const blocks = [];
    let paragraph = [];
    const flushParagraph = () => {
        if (paragraph.length) blocks.push(`<p>${escapeHtml(paragraph.join("\n")).replace(/\n/g, "<br>")}</p>`);
        paragraph = [];
    };

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim();
        if (!line) { flushParagraph(); continue; }
        const fence = line.match(/^(```|''')([\w+-]*)$/);
        if (fence) {
            flushParagraph();
            const codeLines = [];
            while (++index < lines.length && lines[index].trim() !== fence[1]) codeLines.push(lines[index]);
            blocks.push(`<pre><code class="language-${escapeHtml(fence[2] || "plaintext")}">${escapeHtml(codeLines.join("\n"))}</code></pre>`);
            continue;
        }
        if (line.startsWith("## ")) { flushParagraph(); blocks.push(`<h3>${escapeHtml(line.slice(3))}</h3>`); continue; }
        const image = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/i);
        if (image) { flushParagraph(); blocks.push(`<figure class="blog-media"><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy">${image[1] ? `<figcaption>${escapeHtml(image[1])}</figcaption>` : ""}</figure>`); continue; }
        const video = line.match(/^@\[video\]\((https?:\/\/[^\s)]+)\)$/i);
        if (video) {
            flushParagraph();
            const youtube = getYouTubeEmbedUrl(video[1]);
            blocks.push(youtube
                ? `<figure class="blog-media blog-video-embed"><iframe src="${escapeHtml(youtube)}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></figure>`
                : `<figure class="blog-media"><video controls preload="metadata"><source src="${escapeHtml(video[1])}">Your browser does not support video.</video></figure>`);
            continue;
        }
        paragraph.push(lines[index]);
    }
    flushParagraph();
    return blocks.join("\n");
}

function collectionConfig(type = "blogs") {
    const isProject = type === "projects";
    return {
        type: isProject ? "projects" : "blogs",
        label: isProject ? "PROJECTS" : "BLOG LIBRARY",
        title: isProject ? "Projects" : "Blog library",
        slug: isProject ? "projects" : "blogs",
        directory: isProject ? path.join(pageDir, "projects") : blogDir,
        postsFile: isProject ? path.join(pageDir, "project-posts.json") : postsFile,
        indexFile: isProject ? path.join(pageDir, "projects.html") : path.join(pageDir, "blog.html"),
        indexHref: isProject ? "projects.html" : "blog.html"
    };
}

function commentSection(post, type) {
    const kind = type === "projects" ? "project" : "blog";
    return `<section class="comments-section" id="comments" data-type="${kind}" data-slug="${escapeHtml(post.slug)}">
<div class="comments-heading"><div><span class="comments-eyebrow">JOIN THE CONVERSATION</span><h2>Comments <span class="comments-count" id="comments-count">0</span></h2><p class="comments-description">Got a thought? Drop it here.</p></div><span class="comments-note">NO ACCOUNT NEEDED</span></div>
<form class="comments-form" id="comments-form">
<div class="comments-form-fields"><label class="comments-field">Name<input name="name" maxlength="48" autocomplete="nickname" placeholder="Your name" required></label>
<label class="comments-field">Comment<textarea name="message" maxlength="1200" rows="4" placeholder="Write something…" required></textarea></label></div>
<label class="comments-honeypot" aria-hidden="true">Leave this blank<input name="website" tabindex="-1" autocomplete="off"></label>
<div class="comments-form-footer"><p class="comments-status" id="comments-status" role="status">Keep it kind, keep it real.</p><div class="comments-form-actions"><span class="comments-char-count"><span id="comments-char-count">0</span> / 1200</span><button class="comments-submit" type="submit">POST COMMENT <span aria-hidden="true">↗</span></button></div></div>
</form>
<ol class="comments-list" id="comments-list" aria-label="Comments"></ol>
</section>
<script>
(() => {
    const section = document.getElementById("comments");
    const form = document.getElementById("comments-form");
    const list = document.getElementById("comments-list");
    const status = document.getElementById("comments-status");
    const count = document.getElementById("comments-count");
    const messageField = form.elements.message;
    const characterCount = document.getElementById("comments-char-count");
    let displayedComments = 0;
    let renderVersion = 0;
    const query = new URLSearchParams({ type: section.dataset.type, slug: section.dataset.slug });
    const endpoint = "/.netlify/functions/comments?" + query;

    function appendComment(comment) {
        const item = document.createElement("li");
        item.className = "comment-item";
        const meta = document.createElement("div");
        meta.className = "comment-meta";
        const name = document.createElement("span");
        name.textContent = comment.name;
        const date = document.createElement("time");
        date.dateTime = comment.createdAt;
        date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(comment.createdAt));
        meta.append(name, date);
        const message = document.createElement("p");
        message.textContent = comment.message;
        item.append(meta, message);
        list.append(item);
    }

    async function loadComments() {
        const version = ++renderVersion;
        try {
            const response = await fetch(endpoint, { cache: "no-store" });
            if (!response.ok) throw new Error();
            const comments = await response.json();
            if (version !== renderVersion) return;
            list.replaceChildren();
            displayedComments = comments.length;
            count.textContent = String(displayedComments);
            if (!comments.length) {
                const empty = document.createElement("li");
                empty.className = "comments-empty";
                empty.textContent = "Nothing here yet. Start the conversation.";
                list.append(empty);
                return;
            }
            comments.forEach(appendComment);
        } catch {
            if (version === renderVersion) status.textContent = "Comments are unavailable right now.";
        }
    }

    messageField.addEventListener("input", () => {
        characterCount.textContent = String(messageField.value.length);
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector("button[type=submit]");
        const data = new FormData(form);
        button.disabled = true;
        status.textContent = "Sending…";
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: data.get("name"), message: data.get("message"), website: data.get("website") })
            });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || "Could not send comment.");
            form.reset();
            characterCount.textContent = "0";
            status.textContent = "Comment posted.";
            renderVersion++;
            list.querySelector(".comments-empty")?.remove();
            appendComment(result.comment);
            displayedComments++;
            count.textContent = String(displayedComments);
        } catch (error) {
            status.textContent = error.message || "Could not send comment.";
        } finally {
            button.disabled = false;
        }
    });

    loadComments();
})();
<\/script>`;
}

function articlePage(post, index, type = "blogs") {
    const collection = collectionConfig(type);
    const title = escapeHtml(post.title);
    const metaDescription = escapeHtml(post.excerpt || post.title);
    const date = escapeHtml(formatDate(post.date));
    const category = escapeHtml(post.category || "Notes");
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="description" content="${metaDescription}"><title>SPACE — ${title}</title><link rel="stylesheet" href="../../assets/tailwind.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css"></head>
<body><div class="bg"><canvas id="particles"></canvas><div class="bg-grid"></div><div class="bg-vignette"></div><div class="bg-noise"></div></div>
<div class="page"><header class="site-header article-header"><a href="../../index.html" class="logo">SPACE</a><a href="../${collection.indexHref}" class="header-link">← ${collection.label}</a></header>
<main class="blog-page"><article class="blog-post"><div class="blog-meta"><span>${String(index + 1).padStart(2, "0")}</span><span>${category}</span><span>${date}</span><span>${readingTime(post.content)} min read</span></div><h1 class="blog-title">${title}</h1><div class="blog-copy">${renderContent(post.content)}</div></article>${commentSection(post, collection.type)}</main>
<footer class="site-footer article-footer"><span>SPACE / ${collection.type.toUpperCase()}</span><a href="../${collection.indexHref}" class="footer-archive">← ALL ${collection.type.toUpperCase()}</a><span>EST. 2026</span></footer></div>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script><script src="../../assets/particles.js"><\/script><script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"><\/script><script>document.querySelectorAll('.blog-copy pre code').forEach(block => window.hljs?.highlightElement(block));<\/script></body></html>`;
}

function libraryPage(posts, type = "blogs") {
    const collection = collectionConfig(type);
    const entries = posts.map((post, index) => `<a class="blog-entry" href="${collection.slug}/${post.slug}.html"><div class="blog-meta"><span>${String(index + 1).padStart(2, "0")}</span><span>${escapeHtml(post.category || "Notes")}</span><span>${escapeHtml(formatDate(post.date))}</span><span>${readingTime(post.content)} min read</span></div><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(post.excerpt || "Read this article.")}</p><span class="blog-entry-arrow">OPEN ${collection.type === "projects" ? "PROJECT" : "ARTICLE"} ↗</span></a>`).join("\n");
    const heading = collection.type === "projects" ? "Projects" : "Blog";
    const intro = collection.type === "projects" ? "A random project I made." : "A random blog I made.";
    const backLink = "library.html";
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="description" content="${intro}"><title>SPACE — ${collection.title}</title><link rel="stylesheet" href="../assets/tailwind.css"></head>
<body><div class="bg"><canvas id="particles"></canvas><div class="bg-grid"></div><div class="bg-vignette"></div><div class="bg-noise"></div></div>
<div class="page"><header class="site-header"><a href="../index.html" class="logo">SPACE</a><div class="blog-header-links"><a href="blog-maker.html" class="header-link">BLOG MAKER ↗</a><a href="${backLink}" class="header-link">← LIBRARY</a></div></header>
<main class="blog-page"><section class="blog-hero"><span class="eyebrow">${collection.type === "projects" ? "PROJECT" : "BLOG"} DIRECTORY / 001</span><h1 class="blog-title">${heading} <span>${collection.type === "projects" ? "archive." : "library."}</span></h1><p class="blog-intro">${intro}</p></section><section class="blog-list" aria-label="${collection.title}">${entries || '<p class="blog-intro">No entries yet.</p>'}</section><a href="${backLink}" class="blog-back">← Back to Library</a></main>
<footer class="site-footer"><span>SPACE / ${collection.type.toUpperCase()}</span><span>EST. 2026</span></footer></div>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script><script src="../assets/particles.js"><\/script></body></html>`;
}

async function getAvailablePosts(type = "blogs") {
    const collection = collectionConfig(type);
    let posts;
    try {
        posts = JSON.parse(await fs.readFile(collection.postsFile, "utf8"));
    } catch {
        return [];
    }
    let files;
    try {
        files = new Set((await fs.readdir(collection.directory)).filter(name => name.endsWith(".html")));
    } catch {
        return [];
    }
    const available = posts.filter(post => files.has(`${post.slug}.html`));
    if (available.length !== posts.length) {
        await fs.writeFile(collection.postsFile, `${JSON.stringify(available, null, 2)}\n`, "utf8");
    }
    return available.sort((left, right) => (right.date || "").localeCompare(left.date || ""));
}

async function readJsonBody(request) {
    let body = "";
    for await (const chunk of request) {
        body += chunk;
        if (body.length > 2_000_000) throw new Error("Request is too large.");
    }
    return JSON.parse(body || "{}");
}

async function sendNotFound(request, response) {
    try {
        const notFoundPage = await fs.readFile(path.join(root, "404.html"), "utf8");
        response.writeHead(404, {
            "Content-Type": "text/html; charset=utf-8",
            "X-Content-Type-Options": "nosniff"
        });
        if (request.method === "HEAD") response.end();
        else response.end(notFoundPage);
    } catch {
        send(response, 404, "Not found", "text/plain; charset=utf-8");
    }
}

function normalizePosts(value) {
    if (!Array.isArray(value) || value.length > 500) throw new Error("Expected a list of up to 500 posts.");
    const seen = new Set();
    return value.map(post => {
        const slug = String(post.slug || "").trim();
        const title = String(post.title || "").trim();
        const content = String(post.content || "").trim();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Page name must use lowercase letters, numbers, and dashes.");
        if (!title || title.length > 120) throw new Error("Each post needs a title of 120 characters or less.");
        if (!content) throw new Error(`“${title}” has no article text yet.`);
        if (seen.has(slug)) throw new Error(`Duplicate page name: ${slug}`);
        seen.add(slug);
        return {
            slug,
            title,
            date: String(post.date || ""),
            category: String(post.category || "Notes").trim().slice(0, 40),
            readingTime: readingTime(content),
            excerpt: String(post.excerpt || "").trim().slice(0, 220),
            content
        };
    }).sort((left, right) => right.date.localeCompare(left.date));
}

async function savePosts(request, response, type = "blogs") {
    try {
        const collection = collectionConfig(type);
        const data = await readJsonBody(request);
        const submitted = normalizePosts(data.posts);
        let previous = [];
        try { previous = JSON.parse(await fs.readFile(collection.postsFile, "utf8")); } catch {}
        let existingFiles = new Set();
        try { existingFiles = new Set(await fs.readdir(collection.directory)); } catch {}
        const previousSlugs = new Set(previous.map(post => post.slug));
        const posts = submitted.filter(post => existingFiles.has(`${post.slug}.html`) || !previousSlugs.has(post.slug));
        await fs.mkdir(collection.directory, { recursive: true });
        await fs.writeFile(collection.postsFile, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
        for (let index = 0; index < posts.length; index++) {
            await fs.writeFile(path.join(collection.directory, `${posts[index].slug}.html`), articlePage(posts[index], index, collection.type), "utf8");
        }
        await fs.writeFile(collection.indexFile, libraryPage(posts, collection.type), "utf8");
        json(response, 200, { ok: true, count: posts.length });
    } catch (error) {
        json(response, 400, { ok: false, error: error.message || "Could not generate blog files." });
    }
}

async function serveFile(request, response, pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        send(response, 400, "Bad request", "text/plain; charset=utf-8");
        return;
    }
    const requested = decoded === "/" ? "/index.html" : decoded;
    const filePath = path.resolve(root, `.${requested}`);
    const relative = path.relative(root, filePath);
    const topLevel = relative.split(path.sep)[0];
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        send(response, 404, "Not found", "text/plain; charset=utf-8");
        return;
    }
    if (!["index.html", "404.html", "Page", "assets"].includes(topLevel)) {
        await sendNotFound(request, response);
        return;
    }
    try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) throw new Error("Not a file");
        const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
        response.writeHead(200, { "Content-Type": contentType, "X-Content-Type-Options": "nosniff" });
        if (request.method === "HEAD") response.end();
        else response.end(await fs.readFile(filePath));
    } catch {
        await sendNotFound(request, response);
    }
}

const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    const collectionMatch = requestUrl.pathname.match(/^\/api\/(blogs|projects)$/);
    if (collectionMatch && request.method === "GET") {
        try {
            send(response, 200, JSON.stringify(await getAvailablePosts(collectionMatch[1])));
        } catch {
            json(response, 500, { error: "Could not read Page/blog-posts.json." });
        }
        return;
    }
    const saveMatch = requestUrl.pathname.match(/^\/api\/(blogs|projects)\/save$/);
    if (saveMatch && request.method === "POST") {
        await savePosts(request, response, saveMatch[1]);
        return;
    }
    if ((request.method === "GET" || request.method === "HEAD") && !requestUrl.pathname.startsWith("/api/")) {
        if (requestUrl.pathname === "/Page/blog.html" || requestUrl.pathname === "/Page/projects.html") {
            const type = requestUrl.pathname.endsWith("/projects.html") ? "projects" : "blogs";
            try {
                const collection = collectionConfig(type);
                await fs.writeFile(collection.indexFile, libraryPage(await getAvailablePosts(type), type), "utf8");
            } catch (error) {
                console.error("Could not refresh the Blog Library:", error.message);
            }
        }
        await serveFile(request, response, requestUrl.pathname);
        return;
    }
    send(response, 404, "Not found", "text/plain; charset=utf-8");
});

server.listen(port, "127.0.0.1", () => {
    console.log(`Loxspace is running at http://127.0.0.1:${port}`);
});
