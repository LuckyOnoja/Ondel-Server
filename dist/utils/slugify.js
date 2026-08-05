"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSongSlug = generateSongSlug;
function generateSongSlug(title) {
    const baseSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // remove non-word chars
        .replace(/[\s_-]+/g, '-') // replace spaces & underscores with single dash
        .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes
    const safeBase = baseSlug || 'song';
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let rand = '';
    for (let i = 0; i < 3; i++) {
        rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${safeBase}-${rand}`;
}
