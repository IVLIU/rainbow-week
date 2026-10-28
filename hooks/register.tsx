import type { Register } from 'claude-code'

/**
 * One colour per weekday. Each palette lists its days in Date#getDay() order:
 * index 0 is Sunday.
 */
type Palette = {
  label: string
  days: string[]
}

// Every palette runs the same rainbow order — 红 → 橙 → 黄 → 绿 → 蓝 → 靛 → 紫 —
// in its own key: Morandi dusty, Monet luminous, Vermeer deep, 宋瓷 in Chinese hues.
const PALETTES: Record<string, Palette> = {
  morandi: {
    label: '莫兰迪',
    days: ['#B29BB4', '#C2A2A0', '#C4A992', '#BDB58F', '#9FB49B', '#9DACBD', '#9C97B5'],
  },
  monet: {
    label: '莫奈',
    days: ['#C3A5D4', '#D9AFAE', '#D8AC96', '#CFC08D', '#A5C3A2', '#A6BCD6', '#A9A2CF'],
  },
  vermeer: {
    label: '维米尔',
    days: ['#977FA0', '#AE7269', '#BF9469', '#B9AA6B', '#77A48D', '#6889AF', '#767AA9'],
  },
  song: {
    label: '宋瓷',
    days: ['#967B99', '#AF6874', '#B08164', '#B9A156', '#789A86', '#7199AD', '#666E9C'],
  },
}

const DEFAULT_PALETTE = 'morandi'
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const SLUG = 'rainbow-week'
const THEME_VALUE = `custom:${SLUG}`
const THEME_NAME = 'Rainbow Week'

const PRESETS = new Set([
  'dark',
  'light',
  'light-daltonized',
  'dark-daltonized',
  'light-ansi',
  'dark-ansi',
])

type Paths = { theme: string; settings: string }

/** Lifts a colour toward white, for the shimmer partner. */
const lighten = (hex: string, by = 0.22): string => {
  const value = parseInt(hex.slice(1), 16)
  const channel = (part: number): number =>
    Math.round(part + (255 - part) * by).toString(16).padStart(2, '0')

  return `#${channel((value >> 16) & 255)}${channel((value >> 8) & 255)}${channel(value & 255)}`
}

/** A dot in the colour itself, then the hex: ● #789A86 */
const swatch = (hex: string): string => {
  const value = parseInt(hex.slice(1), 16)

  return `\x1b[38;2;${(value >> 16) & 255};${(value >> 8) & 255};${value & 255}m●\x1b[39m ${hex}`
}

const paletteOf = (key: unknown): [string, Palette] => {
  if (typeof key === 'string' && Object.hasOwn(PALETTES, key)) {
    return [key, PALETTES[key]]
  }

  return [DEFAULT_PALETTE, PALETTES[DEFAULT_PALETTE]]
}

const paths = async ($: any): Promise<Paths> => {
  const home = (await $.env.get('HOME')) ?? ''
  const configured = await $.env.get('CLAUDE_CONFIG_DIR')
  const root = configured && configured.length > 0 ? configured : `${home}/.claude`

  return { theme: `${root}/themes/${SLUG}.json`, settings: `${root}/settings.json` }
}

const readJson = async ($: any, path: string): Promise<Record<string, unknown> | null> => {
  try {
    return JSON.parse(await $.fs.read(path)) as Record<string, unknown>
  } catch {
    return null
  }
}

/** The preset a custom theme inherits from, so the user's palette is kept. */
const baseFor = (theme: string | undefined): string => {
  if (theme && PRESETS.has(theme)) return theme
  if (theme && /light/i.test(theme) && !/dark/i.test(theme)) return 'light'

  return 'dark'
}

const themeText = (color: string, base: string): string => {
  const shimmer = lighten(color)

  return `${JSON.stringify(
    {
      name: THEME_NAME,
      base,
      overrides: {
        claude: color,
        claudeShimmer: shimmer,
        clawd_body: color,
        briefLabelClaude: color,
        promptBorder: color,
        promptBorderShimmer: shimmer,
      },
    },
    null,
    2,
  )}\n`
}

/**
 * Writes the theme file for today and points settings.json at it.
 * Runs at session start, on a palette switch, and just past local midnight.
 */
const apply = async ($: any): Promise<{ day: number; color: string; palette: string }> => {
  const day = new Date().getDay()
  const [paletteKey, palette] = paletteOf(await $.store.get('palette'))
  const color = palette.days[day]
  const { theme: themePath, settings: settingsPath } = await paths($)

  const isEnabled = (await $.store.get('enabled')) !== false
  if (!isEnabled) return { day, color, palette: paletteKey }

  // Read settings first: it holds the theme (if any) this mod replaces.
  const hasSettings = await $.fs.exists(settingsPath).catch(() => false)
  const settings = await readJson($, settingsPath)
  const current =
    settings && typeof settings.theme === 'string' ? (settings.theme as string) : undefined

  if (settings && current !== THEME_VALUE) {
    // Remember what to restore on /rainbow off.
    if (current !== undefined) {
      await $.store.set('originalTheme', current)
      await $.store.set('originalHadTheme', true)
    } else if ((await $.store.get('originalHadTheme')) === undefined) {
      await $.store.set('originalHadTheme', false)
    }
  }

  const remembered = (await $.store.get('originalTheme')) as string | undefined
  const base = baseFor(current === THEME_VALUE ? remembered : (current ?? remembered))

  const text = themeText(color, base)
  const existing = await $.fs.read(themePath).catch(() => null)
  if (existing !== text) {
    await $.fs.write(themePath, text)
  }

  if (!hasSettings) {
    // No settings file yet: one holding just the theme.
    await $.fs.write(settingsPath, `${JSON.stringify({ theme: THEME_VALUE }, null, 2)}\n`)
  } else if (settings && settings.theme !== THEME_VALUE) {
    settings.theme = THEME_VALUE
    await $.fs.write(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
  }

  return { day, color, palette: paletteKey }
}

/** Stops the rotation and puts back the theme the person had. */
const disable = async ($: any): Promise<string> => {
  await $.store.set('enabled', false)

  const { settings: settingsPath } = await paths($)
  const settings = await readJson($, settingsPath)
  if (!settings || settings.theme !== THEME_VALUE) {
    return '彩虹周主题已关闭。'
  }

  const hadTheme = await $.store.get('originalHadTheme')
  const original = (await $.store.get('originalTheme')) as string | undefined

  if (hadTheme === false || original === undefined) {
    delete settings.theme
  } else {
    settings.theme = original
  }
  await $.fs.write(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)

  return `彩虹周主题已关闭，主题恢复为 ${hadTheme === false || original === undefined ? '默认' : original}。`
}

const paletteList = (current: string, day: number): string =>
  Object.entries(PALETTES)
    .map(
      ([key, palette]) =>
        `${key === current ? '●' : '○'} ${key}  ${palette.label}  ${swatch(palette.days[day])}`,
    )
    .join('\n')

const status = async ($: any): Promise<string> => {
  const day = new Date().getDay()
  const [paletteKey, palette] = paletteOf(await $.store.get('palette'))
  const isEnabled = (await $.store.get('enabled')) !== false
  let active = ''
  try {
    const row = (await $.config.list()).find(one => one.key === 'theme')
    active = String(row?.value ?? '')
  } catch {
    active = ''
  }

  return [
    `彩虹周主题 · ${WEEKDAY_NAMES[day]} ${swatch(palette.days[day])}（${palette.label}）`,
    `主题：${active === THEME_VALUE ? '已生效' : active ? `未生效（当前 ${active}）` : '未生效'}`,
    `开关：${isEnabled ? '开' : '关'}（/rainbow on | off）`,
    '',
    paletteList(paletteKey, day),
    '',
    '切换：/rainbow palette <名字>',
  ].join('\n')
}

let timer: { cancel: () => void } | undefined

/** Re-arms a timer just past the next local midnight. */
const schedule = ($: any): void => {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
  const ms = Math.max(1000, next.getTime() - now.getTime())

  timer?.cancel()
  timer = $.clock.after(ms, () => {
    void apply($).catch(() => {})
    schedule($)
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'rainbow',
      description: 'Rainbow week: one colour per weekday, Morandi by default',
      argumentHint: '[on|off|palette <名字>]',
    })

    await apply($).catch(() => {})
    schedule($)

    return next(e)
  })

  on('command.run', { command: 'rainbow' }, async ($, e) => {
    const [head = '', rest = ''] = e.args.trim().split(/\s+/, 2)
    const verb = head.toLowerCase()

    if (verb === 'off') {
      return { text: await disable($) }
    }
    if (verb === 'on') {
      await $.store.set('enabled', true)
      const { day, color, palette } = await apply($)
      return {
        text: `彩虹周主题已开启：${WEEKDAY_NAMES[day]} ${swatch(color)}（${PALETTES[palette].label}）。`,
      }
    }
    if (verb === 'palette') {
      const wanted = rest.trim().toLowerCase()
      if (wanted.length === 0) {
        const [key] = paletteOf(await $.store.get('palette'))
        return {
          text: [
            `当前：${key}  ${PALETTES[key].label}`,
            '',
            paletteList(key, new Date().getDay()),
          ].join('\n'),
        }
      }
      if (!Object.hasOwn(PALETTES, wanted)) {
        const [key] = paletteOf(await $.store.get('palette'))
        return {
          text: `没有这套配色：${wanted}\n\n${paletteList(key, new Date().getDay())}`,
        }
      }
      await $.store.set('palette', wanted)
      const { day, color } = await apply($)
      return {
        text: `已切换到 ${wanted}  ${PALETTES[wanted].label}：${WEEKDAY_NAMES[day]} ${swatch(color)}。`,
      }
    }

    return { text: await status($) }
  })
}
