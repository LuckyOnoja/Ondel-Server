"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_js_1 = require("../config/prisma.js");
async function renameProject() {
    console.log('🔄 Renaming user project in PostgreSQL...');
    try {
        const user = await prisma_js_1.prisma.user.findFirst({
            where: { email: 'luckyonoja2020@gmail.com' },
            include: { projects: true },
        });
        if (user && user.projects.length > 0) {
            for (const p of user.projects) {
                if (p.name.includes('Primary Project') || p.name.includes('BeatboyJW')) {
                    const updated = await prisma_js_1.prisma.project.update({
                        where: { id: p.id },
                        data: { name: 'First Album' },
                    });
                    console.log(`✅ Renamed project (${updated.id}) to "${updated.name}"`);
                }
            }
        }
    }
    catch (err) {
        console.error('Error renaming project:', err);
    }
    finally {
        await prisma_js_1.prisma.$disconnect();
    }
}
renameProject();
