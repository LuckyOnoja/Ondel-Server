"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_js_1 = require("../config/prisma.js");
async function migrateProjects() {
    console.log('🚀 Starting Database Migration: Project Scoped Data Backfill...\n');
    try {
        const users = await prisma_js_1.prisma.user.findMany({
            include: {
                artists: {
                    include: {
                        songs: true,
                    },
                },
                campaigns: true,
                projects: true,
            },
        });
        console.log(`Found ${users.length} user accounts to process.`);
        for (const user of users) {
            console.log(`\n👤 Processing User: ${user.email} (${user.id})`);
            let primaryProject = user.projects[0];
            if (!primaryProject) {
                const artistName = user.artists[0]?.name || user.name || 'Artist';
                const projectName = `${artistName} Primary Project`;
                primaryProject = await prisma_js_1.prisma.project.create({
                    data: {
                        userId: user.id,
                        name: projectName,
                        gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #3B82F6 100%)',
                        status: 'ACTIVE',
                    },
                });
                console.log(`   ✨ Created default project "${primaryProject.name}" (${primaryProject.id})`);
            }
            else {
                console.log(`   📁 Using existing primary project "${primaryProject.name}" (${primaryProject.id})`);
            }
            // Link unassigned songs to primary project
            for (const artist of user.artists) {
                const unassignedSongs = artist.songs.filter((s) => !s.projectId);
                if (unassignedSongs.length > 0) {
                    const songIds = unassignedSongs.map((s) => s.id);
                    await prisma_js_1.prisma.song.updateMany({
                        where: { id: { in: songIds } },
                        data: { projectId: primaryProject.id },
                    });
                    console.log(`   🎵 Migrated ${unassignedSongs.length} songs into project "${primaryProject.name}"`);
                }
            }
            // Link unassigned campaigns to primary project
            const unassignedCampaigns = user.campaigns.filter((c) => !c.projectId);
            if (unassignedCampaigns.length > 0) {
                const campaignIds = unassignedCampaigns.map((c) => c.id);
                await prisma_js_1.prisma.campaign.updateMany({
                    where: { id: { in: campaignIds } },
                    data: { projectId: primaryProject.id },
                });
                console.log(`   🚀 Migrated ${unassignedCampaigns.length} campaigns into project "${primaryProject.name}"`);
            }
        }
        console.log('\n✅ Migration complete! All users, songs, and campaigns are now mapped to real PostgreSQL projects.');
    }
    catch (err) {
        console.error('❌ Migration failed:', err);
    }
    finally {
        await prisma_js_1.prisma.$disconnect();
    }
}
migrateProjects();
