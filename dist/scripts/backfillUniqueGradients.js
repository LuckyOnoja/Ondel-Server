"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_js_1 = require("../config/prisma.js");
const project_service_js_1 = require("../modules/projects/project.service.js");
async function backfillUniqueGradients() {
    console.log('🎨 Backfilling unique gradients for Projects and Songs in PostgreSQL...');
    try {
        // 1. Projects
        const users = await prisma_js_1.prisma.user.findMany({
            include: { projects: true },
        });
        for (const u of users) {
            let pIdx = 0;
            for (const p of u.projects) {
                const gradient = project_service_js_1.GRADIENT_PRESETS[pIdx % project_service_js_1.GRADIENT_PRESETS.length];
                await prisma_js_1.prisma.project.update({
                    where: { id: p.id },
                    data: { gradient },
                });
                console.log(`  ✅ Project "${p.name}" (${p.id}) -> ${gradient}`);
                pIdx++;
            }
        }
        // 2. Songs inside each Project
        const projects = await prisma_js_1.prisma.project.findMany({
            include: { songs: true },
        });
        for (const p of projects) {
            let sIdx = 0;
            for (const s of p.songs) {
                const gradient = project_service_js_1.GRADIENT_PRESETS[sIdx % project_service_js_1.GRADIENT_PRESETS.length];
                await prisma_js_1.prisma.song.update({
                    where: { id: s.id },
                    data: { gradient },
                });
                console.log(`  🎵 Song "${s.title}" in Project "${p.name}" -> ${gradient}`);
                sIdx++;
            }
        }
        console.log('✨ All projects and songs now have unique saved gradients in PostgreSQL!');
    }
    catch (err) {
        console.error('Error backfilling gradients:', err);
    }
    finally {
        await prisma_js_1.prisma.$disconnect();
    }
}
backfillUniqueGradients();
