# Rainbow Week

A Claude Code mod that paints Claude's accent colour — the `claude` token and the prompt border — in one muted colour per weekday, following rainbow order: red → orange → yellow → green → blue → indigo → violet.

Four palettes, all low-saturation: **Morandi** (default), **Monet**, **Vermeer**, and **Song porcelain**.

## Install

```
/plugin marketplace add IVLIU/rainbow-week
/plugin install rainbow-week@rainbow-week
```

Then restart Claude Code (or open `/theme` and pick "Rainbow Week").

## Palettes

Monday → Sunday. Every palette walks the same hue order in its own key.

| | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| **Morandi** (default) | `#C2A2A0` dusty rose | `#C4A992` clay | `#BDB58F` wheat | `#9FB49B` sage | `#9DACBD` mist blue | `#9C97B5` dusty indigo | `#B29BB4` grey violet |
| **Monet** | `#D9AFAE` water-lily | `#D8AC96` sunrise | `#CFC08D` hay | `#A5C3A2` iris | `#A6BCD6` Giverny blue | `#A9A2CF` dusk | `#C3A5D4` wisteria |
| **Vermeer** | `#AE7269` ochre red | `#BF9469` ochre | `#B9AA6B` olive gold | `#77A48D` celadon | `#6889AF` Delft blue | `#767AA9` blue violet | `#977FA0` pearl violet |
| **Song porcelain** | `#AF6874` rouge | `#B08164` ochre | `#B9A156` rattan yellow | `#789A86` bamboo | `#7199AD` sky blue | `#666E9C` indigo | `#967B99` lotus violet |

Shimmer partners (`claudeShimmer`, `promptBorderShimmer`) are derived automatically by lifting the main colour 22% toward white.

## Commands

- `/rainbow` — today's colour, active palette, on/off state
- `/rainbow palette` — list the four palettes, each with a true-colour dot preview
- `/rainbow palette morandi|monet|vermeer|song` — switch palette, applied immediately
- `/rainbow on` / `/rainbow off` — toggle the rotation and restore the previous theme

## How it works

Claude Code's `theme` setting only accepts built-in presets, so a plugin cannot switch a custom theme through `config.set`. This mod instead:

1. writes `~/.claude/themes/rainbow-week.json` — a custom theme whose `overrides` hold today's colour, inheriting `base` from whatever preset you had (light stays light);
2. points `theme` in `~/.claude/settings.json` at `custom:rainbow-week`;
3. re-applies just past local midnight, so a long-running session turns over by itself. The theme directory is watched, so the file rewrite repaints without a restart.

Your previous theme is remembered and restored by `/rainbow off`.

## Notes

- Writes only `~/.claude/themes/rainbow-week.json` and the `theme` key of `~/.claude/settings.json`.
- Requires a Claude Code build with custom themes (2.1.118+).
- Colour dots in command output use 24-bit ANSI escapes; terminals without true colour show them as plain white.
