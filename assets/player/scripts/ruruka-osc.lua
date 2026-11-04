-- <-- Interface du lecteur Ruruka : une barre flottante dessinée dans la vidéo, qui disparaît seule -->
-- Tout est du dessin ASS en pixels d'écran. Rien ne tourne tant que l'interface est cachée.

local hideDelaySeconds = 2
local refreshSeconds = 0.5
local seekStepSeconds = 10

local colors = {
    ink = '301E2B',
    surface = '302028',
    surfaceHover = '4A3440',
    text = 'EFF7FB',
    soft = 'E3BDD4',
    star = '42C5F4',
    sky = 'E6CB8F',
    track = '5C4652',
    cached = '8A7480',
}

local icons = {
    play = 'm 6 4 l 20 12 l 6 20',
    pause = 'm 6 4 l 10 4 l 10 20 l 6 20 m 14 4 l 18 4 l 18 20 l 14 20',
    volume = 'm 3 9 l 7 9 l 12 4 l 12 20 l 7 15 l 3 15 m 15 8 l 17 8 l 17 16 l 15 16 m 19 5 l 21 5 l 21 19 l 19 19',
    muted = 'm 3 9 l 7 9 l 12 4 l 12 20 l 7 15 l 3 15 m 14 9 l 15.5 7.5 l 22 15 l 20.5 16.5 m 14 15 l 20.5 7.5 l 22 9 l 15.5 16.5',
    fullscreen = 'm 3 3 l 10 3 l 10 6 l 6 6 l 6 10 l 3 10 m 14 3 l 21 3 l 21 10 l 18 10 l 18 6 l 14 6 m 3 14 l 6 14 l 6 18 l 10 18 l 10 21 l 3 21 m 18 14 l 21 14 l 21 21 l 14 21 l 14 18 l 18 18',
    minimize = 'm 5 17 l 19 17 l 19 20 l 5 20',
    maximize = 'm 4 4 l 20 4 l 20 20 l 4 20 m 7 7 l 7 17 l 17 17 l 17 7',
    close = 'm 5 7 l 7 5 l 12 10 l 17 5 l 19 7 l 14 12 l 19 17 l 17 19 l 12 14 l 7 19 l 5 17 l 10 12',
}

local overlay = mp.create_osd_overlay('ass-events')
local state = {
    isVisible = false,
    isInputActive = false,
    isRemainingShown = true,
    menu = nil,
    menuScroll = 0,
    mouseX = -1,
    mouseY = -1,
    drag = nil,
    zones = {},
    tracks = {},
    chapters = {},
}
local hideTimer
local refreshTimer

local function clamp(value, low, high)
    return math.max(low, math.min(high, value))
end

local function escapeAss(text)
    return (tostring(text):gsub('\\', '\\\\'):gsub('{', '\\{'):gsub('}', '\\}'):gsub('\n', ' '))
end

local function formatTime(seconds)
    seconds = math.max(0, math.floor(seconds or 0))
    local hours = math.floor(seconds / 3600)
    local minutes = math.floor(seconds / 60) % 60
    if hours > 0 then return string.format('%d:%02d:%02d', hours, minutes, seconds % 60) end
    return string.format('%02d:%02d', minutes, seconds % 60)
end

local function truncate(text, maxCharacters)
    text = tostring(text)
    local length = 0
    local stopAt
    for position in text:gmatch('()[%z\1-\127\194-\244][\128-\191]*') do
        length = length + 1
        if length == maxCharacters then stopAt = position end
    end
    if length <= maxCharacters or not stopAt then return text end
    return text:sub(1, stopAt - 1) .. '…'
end

-- <-- Fabrique de dessin : chaque élément devient une ligne ASS -->
local function newCanvas()
    local lines = {}
    local canvas = {}

    function canvas.path(path, color, alpha)
        lines[#lines + 1] = string.format('{\\an7\\pos(0,0)\\bord0\\shad0\\1c&H%s&\\1a&H%s&\\p1}%s{\\p0}', color, alpha or '00', path)
    end

    function canvas.text(x, y, text, size, color, align, font)
        lines[#lines + 1] = string.format('{\\an%d\\pos(%.1f,%.1f)\\bord0\\shad0\\fn%s\\fs%.1f\\1c&H%s&}%s',
            align or 4, x, y, font or 'Nunito ExtraBold', size, color, escapeAss(text))
    end

    function canvas.result()
        return table.concat(lines, '\n')
    end

    return canvas
end

local function roundedPath(x0, y0, x1, y1, radius)
    radius = math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2)
    local k = radius * 0.45
    return string.format(
        'm %.1f %.1f l %.1f %.1f b %.1f %.1f %.1f %.1f %.1f %.1f l %.1f %.1f b %.1f %.1f %.1f %.1f %.1f %.1f ' ..
        'l %.1f %.1f b %.1f %.1f %.1f %.1f %.1f %.1f l %.1f %.1f b %.1f %.1f %.1f %.1f %.1f %.1f',
        x0 + radius, y0, x1 - radius, y0,
        x1 - k, y0, x1, y0 + k, x1, y0 + radius,
        x1, y1 - radius,
        x1, y1 - k, x1 - k, y1, x1 - radius, y1,
        x0 + radius, y1,
        x0 + k, y1, x0, y1 - k, x0, y1 - radius,
        x0, y0 + radius,
        x0, y0 + k, x0 + k, y0, x0 + radius, y0)
end

local function iconPath(name, x, y, size)
    local scale = size / 24
    local isHorizontal = true
    return (icons[name]:gsub('[%d%.]+', function(number)
        local origin = isHorizontal and x or y
        isHorizontal = not isHorizontal
        return string.format('%.1f', origin + tonumber(number) * scale)
    end))
end

-- <-- Le motif du carnet : contour d'encre et ombre pleine décalée, jamais de flou -->
local function drawSticker(canvas, x0, y0, x1, y1, radius, unit, fill)
    local shadow = 3 * unit
    local border = 2 * unit
    canvas.path(roundedPath(x0 + shadow, y0 + shadow, x1 + shadow, y1 + shadow, radius), colors.ink)
    canvas.path(roundedPath(x0 - border, y0 - border, x1 + border, y1 + border, radius + border), colors.ink)
    canvas.path(roundedPath(x0, y0, x1, y1, radius), fill or colors.surface)
end

local function addZone(x0, y0, x1, y1, zone)
    zone.x0, zone.y0, zone.x1, zone.y1 = x0, y0, x1, y1
    state.zones[#state.zones + 1] = zone
    return state.mouseX >= x0 and state.mouseX <= x1 and state.mouseY >= y0 and state.mouseY <= y1
end

local function closeMenu()
    state.menu = nil
    state.menuScroll = 0
end

local function toggleMenu(name)
    if state.menu == name then
        closeMenu()
    else
        state.menu = name
        state.menuScroll = 0
    end
end

local function iconButton(canvas, x, y, size, name, onClick, color)
    local isHovered = addZone(x, y, x + size, y + size, { onClick = onClick })
    if isHovered then canvas.path(roundedPath(x, y, x + size, y + size, size / 2), colors.surfaceHover) end
    local padding = size * 0.2
    canvas.path(iconPath(name, x + padding, y + padding, size - 2 * padding), color or colors.text)
end

local function labelWidth(text, size)
    return #text * size * 0.56
end

local function labelButton(canvas, x, y, height, text, unit, onClick, isActive)
    local size = 21 * unit
    local width = labelWidth(text, size) + 24 * unit
    local isHovered = addZone(x, y, x + width, y + height, { onClick = onClick })
    if isActive or isHovered then
        canvas.path(roundedPath(x, y, x + width, y + height, height / 2), isActive and colors.star or colors.surfaceHover)
    end
    canvas.text(x + width / 2, y + height / 2, text, size, isActive and colors.ink or colors.text, 5)
    return width
end

local function seekToRatio(ratio, isFinal)
    local duration = mp.get_property_number('duration')
    if not duration then return end
    mp.commandv('seek', clamp(ratio, 0, 1) * 100, isFinal and 'absolute-percent+exact' or 'absolute-percent+keyframes')
end

local function setVolumeRatio(ratio)
    local maximum = mp.get_property_number('volume-max', 130)
    mp.set_property_number('volume', math.floor(clamp(ratio, 0, 1) * maximum + 0.5))
end

local function drawProgress(canvas, x0, x1, y, unit)
    local position = mp.get_property_number('time-pos', 0)
    local duration = mp.get_property_number('duration', 0)
    local cachedTo = mp.get_property_number('demuxer-cache-time', 0)
    local height = 10 * unit
    local width = x1 - x0
    local ratio = duration > 0 and clamp(position / duration, 0, 1) or 0

    local isHovered = addZone(x0, y - 12 * unit, x1, y + height + 12 * unit, { drag = 'seek', dragX0 = x0, dragX1 = x1 })
    canvas.path(roundedPath(x0, y, x1, y + height, height / 2), colors.track)
    if duration > 0 and cachedTo > position then
        canvas.path(roundedPath(x0, y, x0 + width * clamp(cachedTo / duration, 0, 1), y + height, height / 2), colors.cached)
    end
    if ratio > 0 then canvas.path(roundedPath(x0, y, x0 + width * ratio, y + height, height / 2), colors.star) end

    for _, chapter in ipairs(state.chapters) do
        if duration > 0 and (chapter.time or 0) > 0 then
            local tick = x0 + width * chapter.time / duration
            canvas.path(roundedPath(tick - unit, y, tick + unit, y + height, 0), colors.ink)
        end
    end

    local knob = x0 + width * ratio
    local knobRadius = (isHovered or state.drag == 'seek') and 11 * unit or 8 * unit
    local middle = y + height / 2
    canvas.path(roundedPath(knob - knobRadius - 2 * unit, middle - knobRadius - 2 * unit, knob + knobRadius + 2 * unit, middle + knobRadius + 2 * unit, knobRadius), colors.ink)
    canvas.path(roundedPath(knob - knobRadius, middle - knobRadius, knob + knobRadius, middle + knobRadius, knobRadius), colors.star)

    if (isHovered or state.drag == 'seek') and duration > 0 then
        local hoverRatio = clamp((state.mouseX - x0) / width, 0, 1)
        local tipX = clamp(state.mouseX, x0 + 36 * unit, x1 - 36 * unit)
        drawSticker(canvas, tipX - 36 * unit, y - 44 * unit, tipX + 36 * unit, y - 14 * unit, 8 * unit, unit)
        canvas.text(tipX, y - 29 * unit, formatTime(hoverRatio * duration), 20 * unit, colors.text, 5, 'Courier Prime')
    end
end

local function drawVolume(canvas, x, y, width, unit)
    local isMuted = mp.get_property_bool('mute', false)
    local volume = mp.get_property_number('volume', 100)
    local maximum = mp.get_property_number('volume-max', 130)
    local buttonSize = 40 * unit
    iconButton(canvas, x, y, buttonSize, isMuted and 'muted' or 'volume', function() mp.commandv('cycle', 'mute') end)

    local x0 = x + buttonSize + 6 * unit
    local x1 = x + width
    local middle = y + buttonSize / 2
    local height = 8 * unit
    addZone(x0, y, x1, y + buttonSize, { drag = 'volume', dragX0 = x0, dragX1 = x1 })
    canvas.path(roundedPath(x0, middle - height / 2, x1, middle + height / 2, height / 2), colors.track)
    local ratio = isMuted and 0 or clamp(volume / maximum, 0, 1)
    if ratio > 0 then canvas.path(roundedPath(x0, middle - height / 2, x0 + (x1 - x0) * ratio, middle + height / 2, height / 2), colors.sky) end
end

local function trackRows(trackType, property, emptyLabel)
    local rows = {}
    if emptyLabel then
        rows[1] = {
            label = emptyLabel,
            isSelected = mp.get_property(property) == 'no',
            onClick = function() mp.set_property(property, 'no') end,
        }
    end
    for _, track in ipairs(state.tracks) do
        if track.type == trackType then
            local parts = {}
            if track.lang then parts[#parts + 1] = track.lang:upper() end
            if track.title then parts[#parts + 1] = track.title end
            if #parts == 0 then parts[1] = 'Piste ' .. track.id end
            rows[#rows + 1] = {
                label = table.concat(parts, ' · '),
                isSelected = track.selected,
                onClick = function() mp.set_property_number(property, track.id) end,
            }
        end
    end
    return rows
end

local function chapterRows()
    local rows = {}
    local current = mp.get_property_number('chapter', -1)
    for index, chapter in ipairs(state.chapters) do
        rows[#rows + 1] = {
            label = formatTime(chapter.time) .. '  ' .. (chapter.title or ('Chapitre ' .. index)),
            isSelected = index - 1 == current,
            onClick = function() mp.set_property_number('chapter', index - 1) end,
        }
    end
    return rows
end

local function stepperRow(label, property, step, low, high, format)
    local value = mp.get_property_number(property, 0)
    return {
        label = label,
        value = string.format(format, value),
        onDecrease = function() mp.set_property_number(property, clamp(value - step, low, high)) end,
        onIncrease = function() mp.set_property_number(property, clamp(value + step, low, high)) end,
    }
end

local function settingsRows()
    return {
        stepperRow('Vitesse', 'speed', 0.25, 0.25, 3, '%.2f×'),
        stepperRow('Décalage sous-titres', 'sub-delay', 0.1, -30, 30, '%+.1f s'),
        stepperRow('Décalage audio', 'audio-delay', 0.1, -30, 30, '%+.1f s'),
        stepperRow('Taille sous-titres', 'sub-scale', 0.1, 0.3, 3, '%.1f'),
        stepperRow('Hauteur sous-titres', 'sub-pos', 2, 0, 150, '%.0f'),
        {
            label = 'Toujours au-dessus',
            isSelected = mp.get_property_bool('ontop', false),
            onClick = function() mp.commandv('cycle', 'ontop') end,
        },
    }
end

local menus = {
    subtitles = { title = 'Sous-titres', rows = function() return trackRows('sub', 'sid', 'Désactivés') end },
    audio = { title = 'Audio', rows = function() return trackRows('audio', 'aid', nil) end },
    chapters = { title = 'Chapitres', rows = chapterRows },
    settings = { title = 'Réglages', rows = settingsRows },
}

local function drawStepper(canvas, row, x0, x1, y, height, unit)
    local buttonSize = height - 6 * unit
    local buttonY = y + 3 * unit
    canvas.text(x0 + 8 * unit, y + height / 2, row.label, 20 * unit, colors.text, 4)
    labelButton(canvas, x1 - 140 * unit, buttonY, buttonSize, '-', unit, row.onDecrease)
    canvas.text(x1 - 74 * unit, y + height / 2, row.value, 19 * unit, colors.soft, 5, 'Courier Prime')
    labelButton(canvas, x1 - 38 * unit, buttonY, buttonSize, '+', unit, row.onIncrease)
end

local function drawMenuRow(canvas, row, x0, x1, y, height, unit)
    if row.onDecrease then
        drawStepper(canvas, row, x0, x1, y, height, unit)
        return
    end
    local isHovered = addZone(x0, y, x1, y + height, { onClick = row.onClick })
    if row.isSelected or isHovered then
        canvas.path(roundedPath(x0, y, x1, y + height, 10 * unit), row.isSelected and colors.star or colors.surfaceHover)
    end
    local maxCharacters = math.floor((x1 - x0) / (20 * unit * 0.52))
    canvas.text(x0 + 12 * unit, y + height / 2, truncate(row.label, maxCharacters), 20 * unit, row.isSelected and colors.ink or colors.text, 4)
end

local function drawMenu(canvas, x1, bottom, unit)
    local menu = menus[state.menu]
    if not menu then return end
    local rows = menu.rows()
    local rowHeight = 42 * unit
    local width = 420 * unit
    local maxRows = math.max(3, math.floor((bottom - 100 * unit) / rowHeight))
    local shownRows = math.min(#rows, maxRows)
    local hasScroll = #rows > shownRows
    local maxScroll = #rows - shownRows
    state.menuScroll = clamp(state.menuScroll, 0, maxScroll)

    local height = (shownRows + 1) * rowHeight + 16 * unit
    local x0 = x1 - width
    local y0 = bottom - height
    addZone(x0, y0, x1, bottom, { isMenu = true })
    drawSticker(canvas, x0, y0, x1, bottom, 16 * unit, unit)
    canvas.text(x0 + 16 * unit, y0 + rowHeight / 2 + 6 * unit, menu.title, 23 * unit, colors.soft, 4)
    if hasScroll then
        canvas.text(x1 - 16 * unit, y0 + rowHeight / 2 + 6 * unit, (state.menuScroll + 1) .. '/' .. (maxScroll + 1), 18 * unit, colors.soft, 6, 'Courier Prime')
    end
    if #rows == 0 then
        canvas.text(x0 + 16 * unit, y0 + rowHeight * 1.5, 'Rien à choisir dans ce fichier.', 20 * unit, colors.text, 4)
        return
    end
    for index = 1, shownRows do
        local rowY = y0 + rowHeight * index + 8 * unit
        drawMenuRow(canvas, rows[index + state.menuScroll], x0 + 8 * unit, x1 - 8 * unit, rowY, rowHeight, unit)
    end
end

local function drawBar(canvas, width, height, unit)
    local margin = 22 * unit
    local barWidth = math.min(1040 * unit, width - 2 * margin)
    local barHeight = 104 * unit
    local x0 = (width - barWidth) / 2
    local x1 = x0 + barWidth
    local y0 = height - barHeight - margin
    local isCompact = barWidth < 760 * unit

    addZone(x0, y0, x1, y0 + barHeight, { isBar = true })
    drawSticker(canvas, x0, y0, x1, y0 + barHeight, 22 * unit, unit)

    -- Première ligne : le temps et la frise de l'épisode
    local padding = 20 * unit
    local position = mp.get_property_number('time-pos', 0)
    local duration = mp.get_property_number('duration', 0)
    local timeY = y0 + 26 * unit
    local timeSize = 21 * unit
    local timeWidth = 96 * unit
    canvas.text(x0 + padding, timeY, formatTime(position), timeSize, colors.text, 4, 'Courier Prime')
    local rightText = state.isRemainingShown and ('-' .. formatTime(duration - position)) or formatTime(duration)
    addZone(x1 - padding - timeWidth, timeY - 14 * unit, x1 - padding, timeY + 14 * unit, {
        onClick = function() state.isRemainingShown = not state.isRemainingShown end,
    })
    canvas.text(x1 - padding, timeY, rightText, timeSize, colors.text, 6, 'Courier Prime')
    drawProgress(canvas, x0 + padding + timeWidth, x1 - padding - timeWidth, timeY - 5 * unit, unit)

    -- Deuxième ligne : lecture à gauche, réglages à droite
    local rowY = y0 + 52 * unit
    local rowHeight = 42 * unit
    local cursor = x0 + padding - 6 * unit
    cursor = cursor + labelButton(canvas, cursor, rowY, rowHeight, '-10', unit, function()
        mp.commandv('seek', -seekStepSeconds, 'relative', 'exact')
    end) + 4 * unit
    iconButton(canvas, cursor, rowY, rowHeight, mp.get_property_bool('pause', false) and 'play' or 'pause', function()
        mp.commandv('cycle', 'pause')
    end, colors.star)
    cursor = cursor + rowHeight + 4 * unit
    cursor = cursor + labelButton(canvas, cursor, rowY, rowHeight, '+10', unit, function()
        mp.commandv('seek', seekStepSeconds, 'relative', 'exact')
    end) + 12 * unit
    if not isCompact then
        drawVolume(canvas, cursor, rowY, 170 * unit, unit)
    end

    iconButton(canvas, x1 - padding - rowHeight, rowY, rowHeight, 'fullscreen', function() mp.commandv('cycle', 'fullscreen') end)

    local right = x1 - padding - rowHeight - 8 * unit
    local entries = {
        { name = 'settings', label = 'Réglages' },
        { name = 'audio', label = 'Audio' },
        { name = 'subtitles', label = isCompact and 'ST' or 'Sous-titres' },
    }
    if #state.chapters > 0 and not isCompact then entries[#entries + 1] = { name = 'chapters', label = 'Chapitres' } end
    for _, entry in ipairs(entries) do
        local labelSize = 21 * unit
        right = right - (labelWidth(entry.label, labelSize) + 24 * unit)
        labelButton(canvas, right, rowY, rowHeight, entry.label, unit, function() toggleMenu(entry.name) end, state.menu == entry.name)
        right = right - 6 * unit
    end

    drawMenu(canvas, x1, y0 - 16 * unit, unit)
end

local function drawWindowControls(canvas, width, unit)
    local size = 42 * unit
    local gap = 6 * unit
    local x = width - size - 14 * unit
    local y = 14 * unit
    iconButton(canvas, x, y, size, 'close', function() mp.commandv('quit') end)
    x = x - size - gap
    iconButton(canvas, x, y, size, 'maximize', function() mp.commandv('cycle', 'window-maximized') end)
    x = x - size - gap
    iconButton(canvas, x, y, size, 'minimize', function() mp.set_property_bool('window-minimized', true) end)
    return x - gap
end

local function drawHeader(canvas, width, unit)
    local isFullscreen = mp.get_property_bool('fullscreen', false)
    local rightLimit = isFullscreen and width or drawWindowControls(canvas, width, unit)
    local title = mp.get_property('media-title', '')
    local size = 24 * unit
    local maxCharacters = math.floor(math.max(100 * unit, rightLimit - 60 * unit) / (size * 0.56))
    title = truncate(title, maxCharacters)
    local titleWidth = labelWidth(title, size) + 32 * unit
    addZone(18 * unit, 16 * unit, 18 * unit + titleWidth, 58 * unit, { isHeader = true })
    drawSticker(canvas, 18 * unit, 16 * unit, 18 * unit + titleWidth, 58 * unit, 14 * unit, unit)
    canvas.text(34 * unit, 37 * unit, title, size, colors.text, 4)
end

local function drawBuffering(canvas, width, height, unit)
    if not mp.get_property_bool('paused-for-cache', false) then return end
    local label = 'Ça charge…'
    local halfWidth = 90 * unit
    drawSticker(canvas, width / 2 - halfWidth, height / 2 - 26 * unit, width / 2 + halfWidth, height / 2 + 26 * unit, 14 * unit, unit)
    canvas.text(width / 2, height / 2, label, 24 * unit, colors.text, 5)
end

local function hitZone()
    for index = #state.zones, 1, -1 do
        local zone = state.zones[index]
        if state.mouseX >= zone.x0 and state.mouseX <= zone.x1 and state.mouseY >= zone.y0 and state.mouseY <= zone.y1 then
            return zone
        end
    end
    return nil
end

local function isPointerOverInterface()
    return hitZone() ~= nil
end

local function isAlwaysVisible()
    return mp.get_property_bool('pause', false) or state.menu ~= nil or state.drag ~= nil or isPointerOverInterface()
end

local function setInputActive(isActive)
    if isActive == state.isInputActive then return end
    state.isInputActive = isActive
    if isActive then
        mp.enable_key_bindings('ruruka-input')
    else
        mp.disable_key_bindings('ruruka-input')
    end
end

local function render()
    state.zones = {}
    if not state.isVisible then
        overlay.data = ''
        overlay:update()
        setInputActive(false)
        return
    end
    local width, height = mp.get_osd_size()
    if not width or width == 0 then return end
    overlay.res_x = width
    overlay.res_y = height
    local unit = clamp(height / 1080, 0.65, 1.8)
    local canvas = newCanvas()
    drawHeader(canvas, width, unit)
    drawBar(canvas, width, height, unit)
    drawBuffering(canvas, width, height, unit)
    overlay.data = canvas.result()
    overlay:update()
    setInputActive(isPointerOverInterface() or state.menu ~= nil or state.drag ~= nil)
end

local function renderIfVisible()
    if state.isVisible then render() end
end

local function hide()
    if isAlwaysVisible() then return end
    state.isVisible = false
    refreshTimer:stop()
    render()
end

local function show()
    if not state.isVisible then
        state.isVisible = true
        refreshTimer:resume()
    end
    hideTimer:kill()
    hideTimer:resume()
    render()
end

local function applyDrag()
    local zone = state.dragZone
    if not zone then return end
    local ratio = (state.mouseX - zone.dragX0) / (zone.dragX1 - zone.dragX0)
    if state.drag == 'seek' then
        seekToRatio(ratio, false)
    else
        setVolumeRatio(ratio)
    end
end

local function onPress()
    local zone = hitZone()
    if not zone then
        closeMenu()
        render()
        return
    end
    if zone.drag then
        state.drag = zone.drag
        state.dragZone = zone
        applyDrag()
    end
    render()
end

local function onRelease()
    if state.drag == 'seek' and state.dragZone then
        seekToRatio((state.mouseX - state.dragZone.dragX0) / (state.dragZone.dragX1 - state.dragZone.dragX0), true)
    end
    if state.drag then
        state.drag = nil
        state.dragZone = nil
        render()
        return
    end
    local zone = hitZone()
    if zone and zone.onClick then zone.onClick() end
    render()
end

-- <-- Molette : défile dans un menu, règle le volume ailleurs -->
local function onWheel(direction)
    if state.menu then
        state.menuScroll = state.menuScroll - direction
    else
        mp.commandv('add', 'volume', direction * 2)
    end
    render()
end

mp.set_key_bindings({
    { 'mbtn_left', onRelease, onPress },
    { 'mbtn_left_dbl', function() end },
    { 'wheel_up', function() onWheel(1) end },
    { 'wheel_down', function() onWheel(-1) end },
}, 'ruruka-input', 'force')

hideTimer = mp.add_timeout(hideDelaySeconds, hide)
hideTimer:kill()
refreshTimer = mp.add_periodic_timer(refreshSeconds, function()
    if isAlwaysVisible() then
        hideTimer:kill()
        hideTimer:resume()
    end
    render()
end)
refreshTimer:stop()

mp.observe_property('mouse-pos', 'native', function(_, position)
    if not position then return end
    local hasMoved = position.x ~= state.mouseX or position.y ~= state.mouseY
    state.mouseX, state.mouseY = position.x, position.y
    if not position.hover then
        state.mouseX, state.mouseY = -1, -1
        if state.drag == nil then
            hideTimer:kill()
            hideTimer.timeout = 0.3
            hideTimer:resume()
            hideTimer.timeout = hideDelaySeconds
        end
        return
    end
    if state.drag then
        applyDrag()
        render()
        return
    end
    if hasMoved then show() end
end)

mp.observe_property('track-list', 'native', function(_, tracks)
    state.tracks = tracks or {}
    renderIfVisible()
end)

mp.observe_property('chapter-list', 'native', function(_, chapters)
    state.chapters = chapters or {}
    renderIfVisible()
end)

for _, property in ipairs({ 'pause', 'fullscreen', 'mute', 'volume', 'speed', 'sub-delay', 'audio-delay', 'sub-scale', 'sub-pos', 'sid', 'aid', 'paused-for-cache', 'ontop' }) do
    mp.observe_property(property, 'native', function(name)
        if name == 'paused-for-cache' and mp.get_property_bool('paused-for-cache', false) then
            show()
            return
        end
        renderIfVisible()
    end)
end

mp.observe_property('osd-dimensions', 'native', renderIfVisible)

mp.observe_property('pause', 'bool', function(_, isPaused)
    if isPaused then show() end
end)

mp.register_event('file-loaded', show)
