"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const slugify_1 = require("../utils/slugify");
const prisma = new client_1.PrismaClient();
async function main() {
    const songs = await prisma.song.findMany();
    console.log(`Found ${songs.length} total songs. Checking & updating slugs...`);
    let updatedCount = 0;
    for (const song of songs) {
        if (!song.slug) {
            let slug = (0, slugify_1.generateSongSlug)(song.title);
            let exists = await prisma.song.findUnique({ where: { slug } });
            while (exists) {
                slug = (0, slugify_1.generateSongSlug)(song.title);
                exists = await prisma.song.findUnique({ where: { slug } });
            }
            await prisma.song.update({
                where: { id: song.id },
                data: { slug },
            });
            console.log(`Updated song "${song.title}" (${song.id}) -> slug: "${slug}"`);
            updatedCount++;
        }
    }
    console.log(`Finished! Updated ${updatedCount} song slugs.`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
