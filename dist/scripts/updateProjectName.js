"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_js_1 = require("../config/prisma.js");
async function updateProjectName() {
    console.log('🔄 Setting default sequential project name in PostgreSQL...');
    try {
        const user = await prisma_js_1.prisma.user.findFirst({
            where: { email: 'luckyonoja2020@gmail.com' },
            include: { projects: true },
        });
        if (user && user.projects.length > 0) {
            for (const p of user.projects) {
                if (p.name === 'First Album' || p.name.includes('Primary Project')) {
                    const updated = await prisma_js_1.prisma.project.update({
                        where: { id: p.id },
                        data: { name: 'Untitled Project 1' },
                    });
                    console.log(`✅ Updated project (${updated.id}) to "${updated.name}"`);
                }
            }
        }
    }
    catch (err) {
        console.error('Error updating project name:', err);
    }
    finally {
        await prisma_js_1.prisma.$disconnect();
    }
}
updateProjectName();
