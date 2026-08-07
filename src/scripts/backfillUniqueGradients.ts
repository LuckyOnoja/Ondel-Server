import { prisma } from '../config/prisma.js'
import { GRADIENT_PRESETS } from '../modules/projects/project.service.js'

async function backfillUniqueGradients() {
  console.log('🎨 Backfilling unique gradients for Projects and Songs in PostgreSQL...')

  try {
    // 1. Projects
    const users = await prisma.user.findMany({
      include: { projects: true },
    })

    for (const u of users) {
      let pIdx = 0
      for (const p of u.projects) {
        const gradient = GRADIENT_PRESETS[pIdx % GRADIENT_PRESETS.length]
        await prisma.project.update({
          where: { id: p.id },
          data: { gradient },
        })
        console.log(`  ✅ Project "${p.name}" (${p.id}) -> ${gradient}`)
        pIdx++
      }
    }

    // 2. Songs inside each Project
    const projects = await prisma.project.findMany({
      include: { songs: true },
    })

    for (const p of projects) {
      let sIdx = 0
      for (const s of p.songs) {
        const gradient = GRADIENT_PRESETS[sIdx % GRADIENT_PRESETS.length]
        await prisma.song.update({
          where: { id: s.id },
          data: { gradient },
        })
        console.log(`  🎵 Song "${s.title}" in Project "${p.name}" -> ${gradient}`)
        sIdx++
      }
    }

    console.log('✨ All projects and songs now have unique saved gradients in PostgreSQL!')
  } catch (err) {
    console.error('Error backfilling gradients:', err)
  } finally {
    await prisma.$disconnect()
  }
}

backfillUniqueGradients()
