import { prisma } from './prisma'

export type AiProvider = 'anthropic' | 'openai' | 'gemini'

// Model rẻ mặc định cho từng provider (managed luôn khóa model rẻ để chi phí thấp).
export const CHEAP_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
}

const KEYS = {
  provider: 'ai_provider',
  model: 'ai_model',
  key: (p: AiProvider) => `ai_key_${p}`,
} as const

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } })
  return row?.value ?? null
}
async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
}

export interface AiConfig {
  provider: AiProvider
  model: string
  key: string // key của provider đang chọn (rỗng nếu chưa cấu hình)
}

// Cấu hình AI hệ thống đang dùng (DB ưu tiên, .env làm fallback).
export async function getAiConfig(): Promise<AiConfig> {
  const provider = ((await getSetting(KEYS.provider)) || process.env.AI_PROVIDER || 'gemini') as AiProvider
  const model = (await getSetting(KEYS.model)) || process.env.AI_MODEL || CHEAP_MODELS[provider] || CHEAP_MODELS.gemini
  const envKey =
    provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY :
    provider === 'openai' ? process.env.OPENAI_API_KEY :
    process.env.GEMINI_API_KEY
  const key = (await getSetting(KEYS.key(provider))) || envKey || ''
  return { provider, model, key }
}

// Trạng thái để hiện trong admin (KHÔNG lộ key — chỉ báo đã cấu hình + 4 ký tự cuối).
export async function getAiConfigStatus() {
  const provider = ((await getSetting(KEYS.provider)) || process.env.AI_PROVIDER || 'gemini') as AiProvider
  const model = (await getSetting(KEYS.model)) || process.env.AI_MODEL || ''
  const providers: AiProvider[] = ['anthropic', 'openai', 'gemini']
  const keys: Record<string, { set: boolean; hint: string }> = {}
  for (const p of providers) {
    const v = (await getSetting(KEYS.key(p))) || ''
    keys[p] = { set: !!v, hint: v ? '••••' + v.slice(-4) : '' }
  }
  return { provider, model: model || CHEAP_MODELS[provider], keys }
}

// Lưu cấu hình từ admin. Key rỗng = GIỮ NGUYÊN key cũ (không xoá nhầm).
export async function saveAiConfig(input: {
  provider?: AiProvider
  model?: string
  keys?: Partial<Record<AiProvider, string>>
}) {
  if (input.provider) await setSetting(KEYS.provider, input.provider)
  if (typeof input.model === 'string') await setSetting(KEYS.model, input.model.trim())
  for (const p of ['anthropic', 'openai', 'gemini'] as AiProvider[]) {
    const v = input.keys?.[p]
    if (typeof v === 'string' && v.trim()) await setSetting(KEYS.key(p), v.trim())
  }
}
