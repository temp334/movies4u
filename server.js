const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const BASE = "https://movies4u.kitchen";

const builder = new addonBuilder({
    id: "movies4u.ultra",
    version: "3.0.0",
    name: "Movies4u ULTRA",
    description: "Ultra Streaming Addon",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
});

// ================== HELPERS ==================

async function getHTML(url) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": BASE
        }
    });
    return await res.text();
}

// Try to extract m3u8 / mp4 directly
function extractVideo(html) {
    const m3u8 = html.match(/https?:\/\/[^"]+\.m3u8/);
    if (m3u8) return m3u8[0];

    const mp4 = html.match(/https?:\/\/[^"]+\.mp4/);
    if (mp4) return mp4[0];

    return null;
}

// ================== EXTRACTORS ==================

async function resolveHubCloud(url) {
    try {
        const html = await getHTML(url);
        const $ = cheerio.load(html);

        let link = $("#download").attr("href");

        if (!link) {
            const iframe = $("iframe").attr("src");
            if (iframe) link = iframe;
        }

        if (!link) return null;

        const inner = await getHTML(link);
        return extractVideo(inner) || link;

    } catch {
        return null;
    }
}

async function resolveGDFlix(url) {
    try {
        const html = await getHTML(url);
        return extractVideo(html);
    } catch {
        return null;
    }
}

async function resolveGeneric(url) {
    try {
        const html = await getHTML(url);
        return extractVideo(html);
    } catch {
        return null;
    }
}

// ================== MAIN ==================

builder.defineStreamHandler(async ({ id }) => {
    try {
        const searchUrl = `${BASE}/?s=${id}`;
        const html = await getHTML(searchUrl);

        const $ = cheerio.load(html);
        const first = $("article h2 a").attr("href");

        if (!first) return { streams: [] };

        const pageHTML = await getHTML(first);
        const $$ = cheerio.load(pageHTML);

        const rawLinks = [];

        $$(".downloads-btns-div a").each((i, el) => {
            const link = $$(el).attr("href");
            if (link) rawLinks.push(link);
        });

        const streams = [];

        for (let link of rawLinks) {
            let final = null;

            if (link.includes("hubcloud")) {
                final = await resolveHubCloud(link);
            } 
            else if (link.includes("gdflix")) {
                final = await resolveGDFlix(link);
            } 
            else {
                final = await resolveGeneric(link);
            }

            if (final) {
                streams.push({
                    title: "Movies4u ULTRA",
                    url: final
                });
            }
        }

        return { streams };

    } catch (e) {
        console.log("ERROR:", e.message);
        return { streams: [] };
    }
});

// ================== SERVER ==================
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
