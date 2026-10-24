# Architecture & update plan

## Why this stack

| Need | Choice | Reason |
|---|---|---|
| Native window, low RAM | .NET 8 WinForms host + WebView2 | WebView2 ships with Windows 11, so nothing extra is bundled. WinForms loads far less than WPF or Electron. |
| UI | Svelte 5 + TypeScript + Vite | Compiles to small vanilla JS with no virtual DOM; runes give simple, explicit state. |
| AniList | Plain `fetch` GraphQL client | Apollo/urql would add weight for features we don't need. |
| Profile markdown | `marked` (+ AniList shortcuts in `lib/markdown.ts`) | AniList's `about(asHtml: true)` is only half converted (raw markdown left in centered blocks and spoilers), and the about editor needs a live preview. Rendering the raw markdown client-side, like anilist.co does, gives the profile and the preview the same output. Loaded only with the profile and editor pages. |
| Fonts | `@fontsource/mochiy-pop-one`, `nunito`, `patrick-hand`, `courier-prime` (latin subsets) | Titles, body text, handwritten notes and case numbers, all bundled for offline use. |
| Secrets | Windows DPAPI (`ProtectedData`) | The AniList token is encrypted per Windows user at rest. |
| Playback | mpv + JSON IPC over a named pipe | mpv reports exact playback position, which watch tracking needs. Other players don't expose this reliably. |

Runtime memory levers already in place: workstation non-concurrent GC in the host,
WebView2 `MemoryUsageTargetLevel.Low` while minimized, pages loaded on demand, lazy images,
`content-visibility` on long lists, and a size-capped in-memory API cache.

Measured on the setup screen (private bytes): host ≈ 13 MB, WebView2 ≈ 165 MB across its
6 processes. WebView2 sets that floor, and it's shared with other WebView2 apps on Windows 11.
Disabling SmartScreen and out-of-process UI saved only ~3 MB, so those flags aren't used.

## Scaling and visual language

**Scaling.** `MainForm.ApplyInterfaceScale` sets the WebView2 zoom from the window width in
DIPs (`Windowing/InterfaceScale.cs`). It's 0.9 below 1600, 1.0 at 1080p, 1.12–1.25 at 1440p and
1.6 at 4K. A user choice in Settings → Interface size overrides it. Zooming WebView2 itself, not
CSS `zoom`, keeps `vh` units and media queries correct. Layout widths use `clamp()` so
pages fill wide screens without stretching text lines.

**Look and feel** is « Le carnet magique de Ruruka »: the investigation notebook of a magical
girl in 1999 (see `docs/concept/`). One light theme. Every colour, font, spacing and radius lives
in `web/src/styles/tokens.css` as a camelCase custom property. Reuse these shared pieces rather
than inventing new ones:

| Piece | Where |
|---|---|
| Notebook backdrop (dot grid, flat pastel blobs, a few twinkling kira) | `components/Backdrop.svelte` |
| Kira star glyph | `components/Kira.svelte` |
| Kira burst on `.btn-primary` and `[data-sparkle]` | `lib/sparkle.ts` |
| Page title with yellow marker highlight + handwritten note | `components/PageHeader.svelte` |
| Section header with roman numeral star pill | `components/Section.svelte` |
| Sticker buttons, ink-outlined `.card`, ruled `.notebook-page`, washi `.tape`, `.chip` | `styles/base.css` |
| Collectible card for any media | `components/MediaCard.svelte` |
| Mashutan speech bubbles | `components/Toasts.svelte`, `components/EmptyState.svelte` |
| Illustration slot (user image or empty notebook frame) | `components/ArtSlot.svelte` |
| Decorative corner sticker from `public/art/autocollants/` | `components/Sticker.svelte` |
| Custom list washi-tape toggles + « Nouvelle liste » | `components/CustomListPicker.svelte` |
| Ice-cream switch for on/off settings | `components/Toggle.svelte` |
| Score picker (stars / drawn faces / slider by score format) | `components/ScoreInput.svelte` |
| Score sticker badge | `components/ScoreRing.svelte` |
| Magnifier loading | `components/LoadingState.svelte` |

Illustrations come from `Exemple/` and are resized into `web/public/art/` by
`scripts/prepare-art.ps1`; see `docs/concept/concept-art.md` for the mapping.

All motion uses `transform`/`opacity` only, and a global `prefers-reduced-motion` rule in
`base.css` turns it off.

## Layout

```
src/Ruruka.Desktop/          C# host
  Program.cs, MainForm.cs    window, WebView2 setup, navigation policy
  AppPaths.cs                %APPDATA%/%LOCALAPPDATA% locations
  Bridge/                    JSON message router between UI and host
    Modules/                 one file per area: Settings, Auth, Library, Player, Shell
  Settings/                  settings.json persistence + token encryption
  Auth/                      AniList OAuth window
  Library/                   folder scanning, filename parsing, folder ↔ media links
  Player/                    mpv discovery (MpvLocator), process + IPC (MpvSession), watched-time maths (WatchTracker)
  Windowing/                 Windows 11 title-bar theming (DWM)
  Updates/                   GitHub release check + installer download (UpdateService)

tests/Ruruka.Desktop.Tests/  xUnit: filename parsing, watch tracking
Directory.Build.targets      drops the WPF assembly the WebView2 package always references

web/src/
  main.ts, App.svelte        bootstrap, shell layout, router outlet
  styles/                    tokens.css (theme), base.css (reset + primitives)
  lib/                       helpers with no app state: bridge, router, routes, format, html, markdown, aboutTemplate, spoilers, nyaa, titleMatch
  api/                       client.ts (fetch, throttle, errors), cache.ts, types.ts
    queries/                 GraphQL documents + typed fetchers, one file per domain
  state/                     .svelte.ts stores: session (viewer + settings), mediaList, library, playback, liveAbout, updates, toasts
  components/                UI used by 2+ features (MediaCard, Modal, ScoreBadge…)
  pages/<feature>/           a route's page and its private sections
```

## Dependency direction

```
pages ──▶ components ──▶ state ──▶ api ──▶ lib
   └──────────────┴────────┴──────▶ lib
```

`lib/bridge.ts` is the only file that touches `window.chrome.webview`. `lib/` may `import type`
from `api/types.ts` (pure shapes, no runtime code), but never imports runtime code from `api/`.

## Bridge contract

Request (UI → host): `{ id, method, params }`
Response (host → UI): `{ id, result }` or `{ id, error }`
Event (host → UI): `{ event, payload }`

Methods are typed in `web/src/lib/bridge.ts` (`BridgeApi`) and registered in
`src/Ruruka.Desktop/Bridge/Modules/*Module.cs`. Both sides use camelCase JSON.

| Method | Purpose |
|---|---|
| `settings.get` / `settings.update` | Public settings (no token), including interface scale |
| `auth.login` / `auth.setToken` / `auth.getToken` / `auth.logout` | AniList OAuth + token storage |
| `library.scan` | Scan the library root, return folders + parsed episodes |
| `library.getLinks` / `library.setLink` / `library.removeLink` | Folder ↔ media links |
| `player.detect` / `player.setPath` / `player.play` | Find or pick mpv, launch an episode with tracking |
| `shell.openUrl` | Open an http(s) link in the default browser |
| `shell.openPath` | Open a folder in Explorer or a video in its default app (nothing else, by design) |
| `shell.pickFolder` / `shell.pickFile` | Native dialogs |
| `update.check` | Latest GitHub release if newer than this build and it ships a `Ruruka-Setup-*.exe`, else null |
| `update.install` | Download that installer, quit, then run it silently once the instance mutex is released |

| Event | Payload |
|---|---|
| `player.started` | `{ mediaId, episode }` |
| `player.watched` | `{ mediaId, episode }`. Fired once the episode counts as watched (see Watch tracking) |
| `player.progress` | `{ mediaId, episode, positionSeconds, durationSeconds }`. At most every 15 s while mpv plays, plus once as soon as the duration is known |
| `player.closed` | `{ mediaId, episode, watchedRatio }` |
| `window.closing` | `{}`. The app is really quitting; the UI answers with `window.readyToQuit` (the host waits 5 s at most) |

The UI never navigates away from the app page. `MainForm` sends every outbound navigation
and every `target="_blank"` link to the default browser.

## Key flows

**Watch tracking.** `player.play` starts mpv with `--input-ipc-server=\\.\pipe\ruruka-mpv-<id>`.
`MpvSession` observes `time-pos` and `duration` and feeds them to `WatchTracker`. The tracker
keeps the played stretches of the episode, built from small forward steps (≤ 3 s) and merged, so
skipping ahead doesn't count and rewatching a scene counts once. Once playback reaches the
completion point (Settings, 85% by default) *and* the played stretches cover the minimum watched
share (50% by default), the session emits `player.watched`. Both values are percentages in
`AppSettings`, validated in `SettingsModule`. `state/playback.svelte.ts` then updates the AniList entry only if
`episode > progress`, using the same status rules as AniList: the first episode sets
Watching, the last episode sets Completed.

**Live profile.** An about that uses live tags (`[watching]…[/watching]`, `[idle]…[/idle]`,
`${anime}`, `${episode}`, `${time}`… see `lib/aboutTemplate.ts`) is a *template*: it is saved in
`AppSettings.AboutTemplate` on this PC and never sent to AniList as such. `state/liveAbout.svelte.ts`
fills it from the current playback (`player.progress` / `player.closed`) and
publishes the result with `UpdateUser(about)`, at most every 15 s (4 requests per minute, well under
AniList's 30–90 per minute), and only when the text changed. While idle, the tags describe the anime
most recently advanced in the list. Quitting the app publishes the idle version first. Editing the about on anilist.co is overwritten by the next update.

**New downloads.** Opening a media page runs `library.refresh()`, so episodes downloaded since
the last scan show up. Clicking an episode that isn't on disk first runs `library.rescan()`
(disk only, no matching) and plays the file if it has appeared; otherwise it opens Nyaa.

**Skip warning.** Before playing, `playback.requestPlay` compares the episode to the list
progress. If it's more than one ahead, it shows a dialog suggesting `progress + 1`. The user
can still play the episode they picked.

**Folder matching.** `library.scan` (host) returns each series folder with a cleaned title guess
and parsed episode numbers. A direct sub-folder of the root is one series, unless it's a
*collection*: no videos of its own and two or more sub-folders that have some ("Nanoha/" holding
each season). Each of those sub-folders becomes its own series, named `Collection/Season`.
Generic season names ("Season 2", "S3") and short ones ("StrikerS") borrow the collection's title. `state/library.svelte.ts` matches guesses against the user's own
list first, with no network cost. It then falls back to throttled AniList searches. A match
counts only if it scores ≥ 0.86 *and* leads the runner-up by ≥ 0.05. `lib/titleMatch.ts`
halves the score when two titles name different seasons, so "Season 2" never links to season 1.
It also scores a multi-word suffix ("Nanoha StrikerS" vs "Mahou Shoujo Lyrical Nanoha StrikerS")
as 0.9.
Links are saved as `auto` or `manual`, and manual links are never overwritten. A manual link
with no media means "ignored". Folders without a confident match are saved as `unmatched`
and appear on the Library page for manual linking.

## Where does my change go? (recipes)

| I want to… | Touch |
|---|---|
| Show a new AniList field on the media page | Add the field to `api/queries/media.ts` → render it in the right `pages/media/*Section.svelte` |
| Add a new page | `pages/<feature>/<Feature>Page.svelte` → add route in `lib/routes.ts` → sidebar link in `components/Sidebar.svelte` if top-level |
| Add a new host capability | Service class in the right host folder → method in a `Bridge/Modules/*Module.cs` → type in `BridgeApi` (`lib/bridge.ts`) → table above |
| Change list-editing behaviour | `state/mediaList.svelte.ts` (`statusChangesFor` holds the status rules) |
| Change how episodes are detected in filenames | `Library/ReleaseNameParser.cs` + a test case in `ReleaseNameParserTests.cs` |
| Change auto-matching strictness | `state/library.svelte.ts` (`AUTO_LINK_THRESHOLD`, `AUTO_LINK_MARGIN`) and `lib/titleMatch.ts` |
| Change what counts as "watched" | `Player/WatchTracker.cs` + `WatchTrackerTests.cs` |
| Change colours, fonts, spacing | `styles/tokens.css` only |
| Change automatic interface sizes | `Windowing/InterfaceScale.cs` + `InterfaceScaleTests.cs` |
| Add a setting | `AppSettings.cs` (+ `PublicSettings`) → `Settings` type in `lib/bridge.ts` → `pages/settings/` |
| Support another AniList markdown shortcut (like `img220(…)`) | `lib/markdown.ts` (`expandAniListSyntax`) → an entry in `pages/profile/aboutSyntax.ts` for the editor guide |
| Support another external search site (like Nyaa) | `lib/nyaa.ts` pattern → button component next to `NyaaButton.svelte` |

## Feature map

| AniList area | Status |
|---|---|
| Login (OAuth implicit grant) | ✅ |
| Home: continue watching (ready-to-play first), airing soon, friends' activity | ✅ |
| Anime / manga list with status tabs, filter, sort, inline +1 | ✅ |
| Media page (restructured header, relations, characters, staff, stats, friends, tags, trailer, recommendations) | ✅ |
| List entry editor (status, progress, score, dates, repeat, notes, private) | ✅ |
| Browse / search with filters | ✅ |
| Character, staff, studio pages | ✅ |
| Notifications with Nyaa buttons | ✅ |
| Profile overview, favourites, rich "about" (images, centered blocks, click-to-reveal spoilers, YouTube players), recent activity | ✅ |
| About editor (`/about/edit`): markdown/HTML draft, live preview, tag guide with insert buttons | ✅ |
| Live profile: about updated from mpv playback through local template tags | ✅ |
| Social: following feed, following / followers with mutual badges, follow / unfollow | ✅ |
| Activity likes, replies (read, write, like), posting a status | ✅ |
| Local library + mpv playback + auto-sync | ✅ |
| Editing / deleting your own activity and replies, activity subscriptions | 🔜 next: `api/queries/activity.ts` + `components/ActivityCard.svelte` |
| Reviews, forum, recommendations voting | 🔜 |
| User stats deep-dive (genres, staff, years) | 🔜 |
| Account settings editing (score format, title language) | 🔜. Still done on anilist.co for now |
