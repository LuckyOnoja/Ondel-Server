import fs from 'fs'
import path from 'path'
import { prisma } from '../config/prisma.js'
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js'

async function clearWaitlistData() {
  console.log('🧹 Starting Ondel Waitlist Data & Storage Cleanup...\n')

  try {
    // 1. Database Cleanup
    console.log('1️⃣ Cleaning Prisma Database tables...')

    const deletedLogs = await prisma.waitlistStepLog.deleteMany({})
    console.log(`   - Deleted ${deletedLogs.count} WaitlistStepLog records.`)

    const deletedStrategies = await prisma.releaseStrategy.deleteMany({})
    console.log(`   - Deleted ${deletedStrategies.count} ReleaseStrategy records.`)

    const deletedOpps = await prisma.weeklyOpportunity.deleteMany({})
    console.log(`   - Deleted ${deletedOpps.count} WeeklyOpportunity records.`)

    const deletedWaitlist = await prisma.waitlistSubmission.deleteMany({})
    console.log(`   - Deleted ${deletedWaitlist.count} WaitlistSubmission records.`)

    // Clear waitlist-generated songs
    const deletedSongs = await prisma.song.deleteMany({
      where: {
        OR: [
          { metadata: { path: ['source'], equals: 'WAITLIST_SUBMISSION' } },
          { soundVibe: 'Waitlist Demo' },
        ],
      },
    })
    console.log(`   - Deleted ${deletedSongs.count} Waitlist Song records.`)

    // 2. Local Disk Audio Uploads Cleanup
    console.log('\n2️⃣ Cleaning Local Disk Uploads...')
    const uploadDirs = [
      path.join(process.cwd(), 'uploads', 'demos'),
      path.join(process.cwd(), 'uploads'),
    ]

    for (const dir of uploadDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir)
        let removedCount = 0
        for (const file of files) {
          const filePath = path.join(dir, file)
          const stat = fs.statSync(filePath)
          if (stat.isFile()) {
            fs.unlinkSync(filePath)
            removedCount++
          }
        }
        console.log(`   - Removed ${removedCount} files from ${dir}`)
      }
    }

    // 3. Cloudinary Assets Cleanup
    console.log('\n3️⃣ Cleaning Cloudinary CDN Remote Audio/Media Assets...')
    if (isCloudinaryConfigured()) {
      const folders = ['ondel_songs', 'song_demos', 'submission_proofs']
      const resourceTypes: ('image' | 'video' | 'raw')[] = ['image', 'video', 'raw']

      for (const folder of folders) {
        for (const resType of resourceTypes) {
          try {
            const res = await cloudinary.api.delete_resources_by_prefix(`${folder}/`, {
              resource_type: resType,
            })
            console.log(`   - Cloudinary prefix delete [${folder} / ${resType}]:`, res.deleted || 'No files found')
          } catch (cErr: any) {
            // Log notice if no resources found or folder empty
            if (cErr?.error?.message) {
              console.log(`   - Cloudinary delete notice [${folder}/${resType}]: ${cErr.error.message}`)
            }
          }
        }
      }
    } else {
      console.log('   - Cloudinary environment variables not set. Skipping remote CDN deletion.')
    }

    console.log('\n✅ All waitlist data, accounts, database entries, and Cloudinary media cleared successfully!')
  } catch (err) {
    console.error('❌ Error during waitlist cleanup:', err)
  } finally {
    await prisma.$disconnect()
  }
}

clearWaitlistData()
