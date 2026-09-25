import { getStore } from "@netlify/blobs";

const postTypes = new Set(["blog", "project"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function response(data, status = 200) {
    return Response.json(data, {
        status,
        headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
}

function getTarget(url) {
    const type = url.searchParams.get("type") || "";
    const slug = url.searchParams.get("slug") || "";
    if (!postTypes.has(type) || !slugPattern.test(slug)) return null;
    return { type, slug, prefix: `${type}/${slug}/` };
}

export default async request => {
    const store = getStore("loxspace-comments");
    const url = new URL(request.url);
    const target = getTarget(url);
    if (!target) return response({ error: "Invalid article." }, 400);

    if (request.method === "GET") {
        const { blobs } = await store.list({ prefix: target.prefix });
        const keys = blobs.map(blob => blob.key).sort().slice(-100);
        const comments = (await Promise.all(keys.map(key => store.get(key, { type: "json" }))))
            .filter(Boolean);
        return response(comments);
    }

    if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

    try {
        const data = await request.json();
        if (String(data.website || "").trim()) return response({ ok: true }, 201);

        const name = String(data.name || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 48);
        const message = String(data.message || "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
        if (!name || !message) return response({ error: "Name and comment are required." }, 400);
        if (message.length > 1200) return response({ error: "Comment is too long." }, 400);

        const createdAt = new Date().toISOString();
        const comment = { name, message, createdAt };
        const key = `${target.prefix}${createdAt}-${crypto.randomUUID()}`;
        await store.setJSON(key, comment);
        return response({ ok: true, comment }, 201);
    } catch {
        return response({ error: "Could not save the comment." }, 400);
    }
};
