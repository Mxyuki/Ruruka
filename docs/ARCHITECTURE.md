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
girl in 1999 (see `docs/concept/`). Light by default, with a dark « carnet de nuit » (Settings →
Apparence). Every colour, font, spacing and radius lives in `web/src/styles/tokens.css` as a
camelCase custom property; the dark palette only redefines them under `prefers-color-scheme: dark`. Reuse these shared pieces rather
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
  Windowing/                 Windows 11 title-bar theming (DWM), tray icon, startup with Windows (StartupRegistration)
  Updates/                   GitHub release check + installer download (UpdateService)
  Manga/                     read-only gateway to the manga site API chosen in Settings (MangaSiteClient): allow-listed paths, ≤ 4 requests/s

tests/Ruruka.Desktop.Tests/  xUnit: filename parsing, watch tracking
Directory.Build.targets      drops the WPF assembly the WebView2 package always references

web/src/
  main.ts, App.svelte        bootstrap, shell layout, router outlet
  styles/                    tokens.css (theme), base.css (reset + primitives)
  lib/                       helpers with no app state: bridge, router, routes, format, html, markdown, aboutTemplate, spoilers, searchSite, titleMatch
  api/                       client.ts (fetch, throttle, errors), cache.ts, types.ts, anisongdb.ts (anime songs, not AniList)
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
| `settings.get` / `settings.update` | Public settings (no token), including interface scale and theme |
| `auth.login` / `auth.setToken` / `auth.getToken` / `auth.logout` | AniList OAuth + token storage |
| `library.scan` | Scan the library root, return folders + parsed episodes |
| `library.getLinks` / `library.setLink` / `library.removeLink` | Folder ↔ media links |
| `player.detect` / `player.setPath` / `player.play` | Find or pick mpv, launch an episode with tracking |
| `shell.openUrl` | Open an http(s) link in the default browser |
| `shell.openPath` | Open a folder in Explorer or a video in its default app (nothing else, by design) |
| `shell.pickFolder` / `shell.pickFile` | Native dialogs |
| `update.check` | Latest GitHub release if newer than this build and it ships a `Ruruka-Setup-*.exe`, else null |
| `manga.get` | Read-only call to the manga site API (`/manga…`, `/manga/{id}/feed`, `/at-home/server/{id}`). That API sends no CORS headers, so the host fetches it |
| `update.install` | Download that installer, quit, then run it silently once the instance mutex is released |

| Event | Payload |
|---|---|
| `player.started` | `{ mediaId, episode }` |
| `player.watched` | `{ mediaId, episode }`. Fired once the episode counts as watched (see Watch tracking) |
| `player.progress` | `{ mediaId, episode, positionSeconds, durationSeconds }`. At most every 15 s while mpv plays, plus once as soon as the duration is known |
| `player.ended` | `{ mediaId, episode }`. The episode reached its end (mpv's `eof-reached`); with « garder mpv ouvert », mpv stays on the last frame instead of closing |
| `player.closed` | `{ mediaId, episode, watchedRatio }`. mpv quit; an episode replaced in the same window never gets one |
| `window.closing` | `{}`. The app is really quitting; the UI answers with `window.readyToQuit` (the host waits 5 s at most) |

The UI never navigates away from the app page. `MainForm` sends every outbound navigation
and every `target="_blank"` link to the default browser. A middle click or Ctrl+click on an in-app link opens the
matching anilist.co page instead (`App.svelte`, `anilistUrlFor` in `lib/routes.ts`; media pages ask
AniList for their `siteUrl`), and the host never sends an app page to the browser.

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

**Same mpv window.** `PlayerService` keeps the last `MpvSession`. While that mpv is still open and its
pipe connected, `player.play` sends `loadfile … replace` (plus the window title and `pause=no`, since
mpv pauses at the end of a kept-open file) instead of starting a new process, so a Discord screen share
keeps the same window. The session swaps in a fresh `WatchTracker` and ignores property changes until
mpv reports `file-loaded`, then asks for `duration` once (mpv only notifies changed values). With
`AppSettings.IsPlayerKeptOpen` (default on), mpv gets `--keep-open=yes`, and the UI offers the next
episode on `player.ended` rather than waiting for `player.closed`.

**Startup with Windows.** `AppSettings.IsLaunchedAtStartup` writes or removes the `Ruruka` value under
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (`Windowing/StartupRegistration.cs`, called by
`SettingsModule` before the setting is saved). Windows then passes `--startup`, and `MainForm` keeps
the window hidden in the notification area: WebView2 only loads when the window is first opened.
The uninstaller removes the value.

**Live profile.** An about that uses live tags (`[watching]…[/watching]`, `[idle]…[/idle]`,
`${anime}`, `${episode}`, `${time}`… see `lib/aboutTemplate.ts`) is a *template*: it is saved in
`AppSettings.AboutTemplate` on this PC and never sent to AniList as such. `state/liveAbout.svelte.ts`
fills it from the current playback (`player.progress` / `player.closed`) and
publishes the result with `UpdateUser(about)`, at most every 15 s (4 requests per minute, well under
AniList's 30–90 per minute), and only when the text changed. While idle, the tags describe the anime
most recently advanced in the list. Quitting the app publishes the idle version first. Editing the about on anilist.co is overwritten by the next update.

**Anime songs.** The media page's « La bande-son » menu calls AnisongDB (`api/anisongdb.ts`, plain
`fetch`, CORS allowed) only when it is first opened. It looks songs up by MyAnimeList id
(`mal_ids_request`, exact), then by romaji and English title (`search_request`), and keeps only songs
whose `linked_ids.anilist` is this media. AnisongDB only gives file names: `SongRow` puts
`AppSettings.SongFileHostUrl` in front of them, and shows no player while that setting is empty.
A player element is created only for the song the user clicks.
From two songs on, `pages/media/songFilters.ts` filters by kind, title, artist (a group member counts,
with a cap on how many other singers share the song; -1 = any), composer and arranger.

**Manga reading.** Only with a manga site in Settings (`AppSettings.MangaSiteUrl`, empty by default):
the host calls the `api.` subdomain of that site (`MangaSiteClient.ApiBaseFor`), and the UI uses its
`uploads.` subdomain as the image fallback and `<site>/title/<id>` for the manga page. Without it, the
« Chapitres » button and section stay hidden and manga get the search button instead.
On a manga page, the « Chapitres » button opens « Les chapitres ».
`api/mangaSite.ts` finds the site's entry whose `links.al` is this AniList id (then `links.mal`),
lists every version of every chapter in `AppSettings.MangaLanguage` (falling back to English).
`pages/media/chapterGroups.ts` groups them by chapter number with one chip per scanlation team;
turning to the next or previous chapter keeps the current team when it translated that chapter too. `MangaReader` shows one page at a time (right half / → forward, left half / ← back,
crossing into the next or previous chapter at the ends; images load straight from the image
servers the API names, two pages ahead); reaching a chapter's last page calls
`mediaList.recordRead`, which raises the chapter and volume progress only when they go forward.
Publisher-hosted chapters (`externalUrl`) open in the browser.

**Voice actors.** `fetchStaff` walks all `characterMedia` (25 per page, 5 pages per request through
aliases, oldest first) and keeps each character once, at its first dated appearance.

**People search.** `/people` (sidebar « Personnes ») searches characters and staff in one query;
« Seiyuu » are staff whose primary occupation is voice acting.

**Section order.** `lib/mediaSections.ts` lists the media page sections in their default order;
`AppSettings.MediaSectionOrder` holds the user's order (Settings → Page d'un anime ou d'un manga)
and `orderSections` appends any section added later.

**New downloads.** Opening a media page runs `library.refresh()`, so episodes downloaded since
the last scan show up. Clicking an episode that isn't on disk first runs `library.rescan()`
(disk only, no matching) and plays the file if it has appeared; otherwise it opens the search site from Settings (or just says the file is missing when none is set).

**Theme.** `AppSettings.Theme` is `light` (default), `dark`, `system` or `schedule`. `MainForm.ApplyTheme`
resolves it (`Windowing/AppTheme.cs`; `system` reads the Windows app mode and re-applies on
`SystemEvents.UserPreferenceChanged`; `schedule` is light from `ThemeLightFromMinute` to `ThemeDarkFromMinute`
and arms one timer for the next switch, re-checked on wake from sleep), colours the native frame and sets WebView2's
`PreferredColorScheme`, so the UI's `prefers-color-scheme` media query matches from the first paint.

**Sites.** No site ships with the app: the episode search site, the manga site and the song file host
are typed by the user in Settings → Sites (`SearchSiteUrl`, `MangaSiteUrl`, `SongFileHostUrl`), all empty
by default. While one is empty, `session.searchSite` / `mangaSite` / `songFileHost` is null and the
feature behind it stays hidden. `lib/siteAddress.ts` (and `Settings/SiteAddress.cs` on the host) adds
`https://` when missing; the host only checks length and spaces, so a wrong address is saved and simply
finds nothing. Search links are `<site>/?f=0&c=<category>&q=<query>` (`lib/searchSite.ts`).

**Home hero.** The « affaire du jour » is the newest AniList airing notification from the last 12 hours
whose episode the viewer hasn't watched yet (`fetchRecentAirings`, read with
`resetNotificationCount: false` so the unread badge stays). Without one, it falls back to the
most advanced ready-to-play anime. The hero is left out of the lists below, so the former one goes back there.

**Other users' lists.** `/user/:name/list/:type` reuses `ListPage` read-only (no +1, play or
editor). `fetchUserList` asks AniList for scores already in the viewer's format.

**Explorer filters.** Genres and tags are picked several at a time (`pages/search/filterPicks.ts`);
each pick is required or excluded (`genre_in` / `genre_not_in`, `tag_in` / `tag_not_in`, all
ANDed by AniList). AniList takes one `minimumTagRank` for every tag, so `browseMedia` sends the
lowest chosen percentage and checks stricter tags on the returned `tags { rank }`, reading up to
three AniList pages to fill one page of results. Cards show the viewer's list status, and « Ma liste »
keeps chosen statuses and/or media not on the list: AniList filters `onList` itself, the statuses are
checked against `state/mediaList` through `browseMedia`'s `keep` test, with the same page filling.

**Going back.** `lib/router.svelte.ts` numbers each history entry (`history.state.depth`), so the
title bar's « Retour » button (and the mouse back button) appear only when there is a page to go
back to, and it remembers each entry's scroll offset. Explorer writes its filters and its last loaded
page into its own address with `replaceQuery` (`pages/search/searchQuery.ts`); coming back reloads
those pages from the API cache and restores the scroll offset.

**Skip warning.** Before playing, `playback.requestPlay` compares the episode to the list
progress. If it's more than one ahead, it shows a dialog suggesting `progress + 1`. The user
can still play the episode they picked, or chain from `progress + 1` to it: the store keeps a
playlist and, on `player.ended` (or on `player.closed` once the episode counted as watched, for
mpv without keep-open), plays the next file in the same mpv window until the picked episode.
Closing mpv earlier, a missing file or playing anything else ends the playlist.

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
| Add a section to the media page | Component in `pages/media/` → an entry in `lib/mediaSections.ts` → a branch in `MediaPage.svelte` |
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
| Change how search links are built | `lib/searchSite.ts` (the site itself is `AppSettings.SearchSiteUrl`) → `components/SearchSiteButton.svelte` |

## Feature map

| AniList area | Status |
|---|---|
| Login (OAuth implicit grant) | ✅ |
| Home: continue watching (ready-to-play first), random pick (watching / planning / any popular anime not completed), airing soon (watching, or planned when episode 1 airs), season trends linking to a filtered Explorer, friends' activity | ✅ |
| Anime / manga list with status tabs, filter, sort, inline +1, airing anime grouped first | ✅ |
| Media page (restructured header, relations, characters, staff, stats, friends, tags, trailer, recommendations) | ✅ |
| List entry editor (status, progress, score, dates, repeat, notes, private) | ✅ |
| Browse / search with filters, several genres / tags (required or excluded), minimum % per tag, list status labels and filter | ✅ |
| Character, staff (every voiced character once, first appearance), studio pages | ✅ |
| People search (characters, seiyuu, staff) | ✅ |
| Notifications with search buttons | ✅ |
| Profile overview, favourites, rich "about" (images, centered blocks, click-to-reveal spoilers, YouTube players), recent activity | ✅ |
| About editor (`/about/edit`): markdown/HTML draft, live preview, tag guide with insert buttons | ✅ |
| Live profile: about updated from mpv playback through local template tags | ✅ |
| Anime songs (openings, endings, inserts) from AnisongDB with audio / HQ / MQ players | ✅ |
| Manga chapters from the manga site chosen in Settings, in a chosen language, in-app reader that updates chapter / volume progress | ✅ |
| Media page section order (Settings) | ✅ |
| Social: following feed, following / followers with mutual badges, follow / unfollow | ✅ |
| Activity likes, replies (read, write, like), posting a status | ✅ |
| Local library + mpv playback + auto-sync | ✅ |
| Editing / deleting your own activity and replies, activity subscriptions | 🔜 next: `api/queries/activity.ts` + `components/ActivityCard.svelte` |
| Reviews, forum, recommendations voting | 🔜 |
| User stats deep-dive (genres, staff, years) | 🔜 |
| Account settings editing (score format, title language) | 🔜. Still done on anilist.co for now |
