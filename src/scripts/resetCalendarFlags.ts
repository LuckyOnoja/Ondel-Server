import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const songs = await prisma.song.findMany({
    include: {
      calendarEvents: true,
    },
  })

  let resetCount = 0
  for (const song of songs) {
    if (song.calendarEvents.length === 0 && song.calendarPlanGenerated) {
      await prisma.song.update({
        where: { id: song.id },
        data: { calendarPlanGenerated: false },
      })
      console.log(`Reset calendarPlanGenerated flag for song: "${song.title}" (${song.id})`)
      resetCount++
    }
  }

  console.log(`Done! Reset ${resetCount} song(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
