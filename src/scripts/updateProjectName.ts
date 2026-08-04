import { prisma } from '../config/prisma.js'

async function updateProjectName() {
  console.log('🔄 Setting default sequential project name in PostgreSQL...')

  try {
    const user = await prisma.user.findFirst({
      where: { email: 'luckyonoja2020@gmail.com' },
      include: { projects: true },
    })

    if (user && user.projects.length > 0) {
      for (const p of user.projects) {
        if (p.name === 'First Album' || p.name.includes('Primary Project')) {
          const updated = await prisma.project.update({
            where: { id: p.id },
            data: { name: 'Untitled Project 1' },
          })
          console.log(`✅ Updated project (${updated.id}) to "${updated.name}"`)
        }
      }
    }
  } catch (err) {
    console.error('Error updating project name:', err)
  } finally {
    await prisma.$disconnect()
  }
}

updateProjectName()
