import { generateText } from 'ai'
import { eq } from 'drizzle-orm'
import { db, sqlite } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { memories } from '@/server/db/schema'
import { generateEmbedding } from '@/server/services/embeddings'
import { config } from '@/server/config'
import { deleteMemory, createMemory } from '@/server/services/memory'

const log = createLogger('consolidation')

interface MemoryRow {
  id: string
  content: string
  category: string
  subject: string | null
  importance: number | null
  consolidationGeneration: number
  embedding: Buffer | null
}

/**
 * Find clusters of near-duplicate memories using pairwise cosine similarity.
 * Only compares memories that haven't reached the generation ceiling.
 */
function findSimilarClusters(
  mems: MemoryRow[],
  threshold: number,
): Array<[MemoryRow, MemoryRow]> {
  const pairs: Array<[MemoryRow, MemoryRow]> = []

  for (let i = 0; i < mems.length; i++) {
    const a = mems[i]!
    if (!a.embedding) continue

    const vecA = new Float32Array(a.embedding.buffer, a.embedding.byteOffset, a.embedding.byteLength / 4)

    for (let j = i + 1; j < mems.length; j++) {
      const b = mems[j]!
      if (!b.embedding) continue

      const vecB = new Float32Array(b.embedding.buffer, b.embedding.byteOffset, b.embedding.byteLength / 4)

      const similarity = cosineSimilarity(vecA, vecB)
      if (similarity >= threshold) {
        pairs.push([a, b])
      }
    }
  }

  return pairs
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * Group overlapping pairs into clusters using union-find.
 */
function clusterPairs(pairs: Array<[MemoryRow, MemoryRow]>): MemoryRow[][] {
  const parent = new Map<string, string>()
  const memMap = new Map<string, MemoryRow>()

  function find(id: string): string {
    if (!parent.has(id)) parent.set(id, id)
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!))
    return parent.get(id)!
  }

  function union(a: string, b: string) {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const [a, b] of pairs) {
    memMap.set(a.id, a)
    memMap.set(b.id, b)
    union(a.id, b.id)
  }

  const groups = new Map<string, MemoryRow[]>()
  for (const [id, mem] of memMap) {
    const root = find(id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(mem)
  }

  return Array.from(groups.values()).filter((g) => g.length >= 2)
}

/**
 * Use LLM to merge a cluster of similar memories into a single, richer memory.
 */
async function mergeCluster(
  cluster: MemoryRow[],
  model: Awaited<ReturnType<typeof import('@/server/services/kin-engine').resolveLLMModel>>,
): Promise<{ content: string; category: string; subject: string | null; importance: number } | null> {
  if (!model) return null

  const memoriesText = cluster
    .map((m, i) => `${i + 1}. [${m.category}${m.subject ? `, subject: ${m.subject}` : ''}${m.importance ? `, importance: ${m.importance}` : ''}] ${m.content}`)
    .join('\n')

  const prompt =
    `You are merging near-duplicate memories into a single, richer memory.\n\n` +
    `## Memories to merge\n\n${memoriesText}\n\n` +
    `Rules:\n` +
    `- Combine all information into ONE clear, standalone sentence (or two if truly needed)\n` +
    `- Preserve ALL unique details from each memory — don't lose information\n` +
    `- If memories contradict, keep the most specific/recent version\n` +
    `- Pick the most appropriate category and subject\n` +
    `- Rate importance 1-10 (use the max importance from the sources, or higher if the merged result is richer)\n\n` +
    `Return exactly one JSON object:\n` +
    `{"content": "...", "category": "fact|preference|decision|knowledge", "subject": "...", "importance": N}`

  try {
    const result = await generateText({
      model,
      messages: [{ role: 'user', content: prompt }],
    })

    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as {
      content: string
      category: string
      subject: string
      importance: number
    }

    if (!parsed.content || !parsed.category) return null

    return {
      content: parsed.content,
      category: parsed.category,
      subject: parsed.subject || cluster[0]!.subject,
      importance: Math.max(1, Math.min(10, Math.round(parsed.importance ?? 5))),
    }
  } catch (err) {
    log.error({ err }, 'Merge LLM error')
    return null
  }
}

/**
 * Run memory consolidation for a Kin.
 * Finds near-duplicate memories, merges them via LLM, replaces originals.
 * Returns the number of memories consolidated (removed).
 */
export async function consolidateMemories(kinId: string): Promise<number> {
  const maxGen = config.memory.consolidationMaxGeneration
  const threshold = config.memory.consolidationSimilarityThreshold

  // Load all memories with embeddings that haven't reached the generation ceiling
  const allMemories = await db
    .select()
    .from(memories)
    .where(eq(memories.kinId, kinId))
    .all()

  const eligible = allMemories.filter(
    (m) => m.embedding && m.consolidationGeneration < maxGen
  ) as MemoryRow[]

  if (eligible.length < 2) {
    log.debug({ kinId, count: eligible.length }, 'Not enough eligible memories for consolidation')
    return 0
  }

  log.info({ kinId, eligible: eligible.length }, 'Starting memory consolidation')

  // Phase 1: Find similar pairs (pure computation, no LLM calls)
  const pairs = findSimilarClusters(eligible, threshold)
  if (pairs.length === 0) {
    log.info({ kinId }, 'No near-duplicate memories found')
    return 0
  }

  // Group overlapping pairs into clusters
  const clusters = clusterPairs(pairs)
  log.info({ kinId, clusters: clusters.length, pairs: pairs.length }, 'Found memory clusters')

  // Phase 2: Merge each cluster via LLM
  const { resolveLLMModel } = await import('@/server/services/kin-engine')
  const model = await resolveLLMModel(config.memory.consolidationModel ?? config.compacting.model ?? 'gpt-4.1-nano', null)

  let totalRemoved = 0

  for (const cluster of clusters) {
    const merged = await mergeCluster(cluster, model)
    if (!merged) continue

    // Compute the new generation: max of sources + 1
    const newGen = Math.min(
      maxGen,
      Math.max(...cluster.map((m) => m.consolidationGeneration)) + 1,
    )

    const sourceIds = cluster.map((m) => m.id)

    // Create the merged memory
    const newMemory = await createMemory(kinId, {
      content: merged.content,
      category: merged.category as 'fact' | 'preference' | 'decision' | 'knowledge',
      subject: merged.subject,
      importance: merged.importance,
      sourceChannel: 'automatic',
    })

    if (!newMemory) continue

    // Update generation and lineage on the new memory
    await db
      .update(memories)
      .set({
        consolidationGeneration: newGen,
        consolidatedFromIds: JSON.stringify(sourceIds),
      })
      .where(eq(memories.id, newMemory.id))

    // Delete the source memories
    for (const sourceId of sourceIds) {
      await deleteMemory(sourceId, kinId)
    }

    totalRemoved += cluster.length - 1 // net reduction (cluster.length removed, 1 added)
    log.info(
      { kinId, merged: cluster.length, newGen, newMemoryId: newMemory.id },
      'Consolidated memory cluster',
    )
  }

  log.info({ kinId, totalRemoved, clusters: clusters.length }, 'Memory consolidation complete')
  return totalRemoved
}
