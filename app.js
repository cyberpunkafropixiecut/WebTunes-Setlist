/* ------------------------------------------------------------
   CORE ELEMENTS
------------------------------------------------------------ */
const audio = document.getElementById("audioPlayer");
const video = document.getElementById("videoPlayer");
const videoContainer = document.getElementById("videoContainer");

const folderView = document.getElementById("folderView");
const trackView = document.getElementById("trackView");
const panelTitle = document.getElementById("panelTitle");

const bandNameEl = document.getElementById("bandName");
const trackTitleEl = document.getElementById("trackTitle");

const playBtn = document.getElementById("playBtn");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const repeatBtn = document.getElementById("repeatBtn");

const progressBar = document.getElementById("progressBar");
const progressContainer = document.getElementById("progressContainer");

const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");

const downloadBtn = document.getElementById("downloadBtn");
const attachmentMenu = document.getElementById("attachmentMenu");
const attachmentsOverlay = document.getElementById("attachmentsOverlay");

const pagination = document.getElementById("pagination");
/* ------------------------------------------------------------
   GLOBAL STATE
------------------------------------------------------------ */
let bands = [];
let currentTracks = [];
let currentAttachments = [];
let currentIndex = 0;

let currentBandIndex = null;
let currentAlbumIndex = null;

let shuffleOn = false;
let repeatOn = false;

let relatedTracks = [];

let playQueue = [];
let playQueueIndex = -1;

const audioExts = [".mp3", ".flac", ".wav", ".ogg", ".m4a"];
const videoExts = [".mp4", ".webm", ".ogv", ".mov", ".mkv", ".avi"];
const attachmentExts = [".rar"];

const BANDS_PER_PAGE = 20;
let bandPage = 0;

let coverCache = {};
try {
    const saved = localStorage.getItem("coverCache");
    if (saved) coverCache = JSON.parse(saved) || {};
} catch (e) {
    coverCache = {};
}

let isRelatedView = false;

/* ------------------------------------------------------------
   OVERLAYS
------------------------------------------------------------ */
const trackContextMenu = document.createElement("div");
trackContextMenu.className = "context-menu";
trackContextMenu.id = "trackContextMenu";
document.body.appendChild(trackContextMenu);

const lyricsOverlay = document.createElement("div");
lyricsOverlay.id = "lyricsOverlay";
lyricsOverlay.className = "overlay";
document.body.appendChild(lyricsOverlay);

const subtitleOverlay = document.createElement("div");
subtitleOverlay.id = "subtitleOverlay";
subtitleOverlay.className = "overlay";
document.body.appendChild(subtitleOverlay);

/* Subtitle wrapper */
let subtitleWrapper = null;
if (videoContainer) {
    subtitleWrapper = document.createElement("div");
    subtitleWrapper.className = "subtitle-wrapper";
    subtitleWrapper.id = "subtitleWrapper";
    videoContainer.appendChild(subtitleWrapper);
}

/* ------------------------------------------------------------
   SUBTITLE ENGINE STATE
------------------------------------------------------------ */
let subtitleTracks = [];
let subtitleSettings = null;

/* ------------------------------------------------------------
   LOAD JSON
------------------------------------------------------------ */
fetch("Setlist/Setlist.json")
    .then(res => res.json())
    .then(data => {
        bands = data.bands || [];
        showBands();
    });

loadSubtitleSettings();

/* ------------------------------------------------------------
   HELPERS
------------------------------------------------------------ */
function parseTrackMeta(filename) {
    const clean = filename.replace(/\.[^/.]+$/, "").trim();
    const numberOnly = /^(\d+[\.\-\s]*)+$/;
    const parts = clean.split(" - ");

    if (parts.length >= 2 && numberOnly.test(parts[0].trim())) {
        return { band: "", title: parts.slice(1).join(" - ").trim() };
    }
    if (parts.length >= 2) {
        return { band: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
    }
    return { band: "", title: clean };
}

function isVideoFile(name) {
    const lower = name.toLowerCase();
    return videoExts.some(ext => lower.endsWith(ext));
}

function isAudioFile(name) {
    const lower = name.toLowerCase();
    return audioExts.some(ext => lower.endsWith(ext));
}

function isVideoMode() {
    return videoContainer && videoContainer.style.display === "block";
}

function randomGradient() {
    const h1 = Math.floor(Math.random() * 360);
    const h2 = (h1 + 90) % 360;
    return `linear-gradient(135deg,
        hsl(${h1}, 75%, 45%),
        hsl(${h2}, 75%, 35%)
    )`;
}

function applyFallbackCover(div, title, key) {
    if (!coverCache[key]) {
        coverCache[key] = randomGradient();
        try {
            localStorage.setItem("coverCache", JSON.stringify(coverCache));
        } catch (e) {}
    }
    div.style.background = coverCache[key];
    div.textContent = title;
}

/* ------------------------------------------------------------
   PAGINATION
------------------------------------------------------------ */
function renderBandPagination() {
    if (!pagination) return;

    const totalPages = Math.ceil(bands.length / BANDS_PER_PAGE);
    if (totalPages <= 1) {
        pagination.style.display = "none";
        pagination.innerHTML = "";
        return;
    }

    pagination.style.display = "flex";
    pagination.innerHTML = "";

    const prev = document.createElement("span");
    prev.textContent = "<";
    if (bandPage > 0) {
        prev.addEventListener("click", () => {
            bandPage--;
            showBands();
        });
    } else {
        prev.classList.add("disabled");
    }

    const current = document.createElement("span");
    current.textContent = (bandPage + 1).toString();

    const next = document.createElement("span");
    next.textContent = ">";
    if (bandPage < totalPages - 1) {
        next.addEventListener("click", () => {
            bandPage++;
            showBands();
        });
    } else {
        next.classList.add("disabled");
    }

    pagination.appendChild(prev);
    pagination.appendChild(current);
    pagination.appendChild(next);
}

/* ------------------------------------------------------------
   SHOW BANDS
------------------------------------------------------------ */
function showBands() {
    isRelatedView = false;

    panelTitle.textContent = "";
    folderView.style.display = "grid";
    trackView.style.display = "none";
    downloadBtn.style.display = "none";
    attachmentMenu.style.display = "none";

    folderView.innerHTML = "";

    const totalPages = Math.ceil(bands.length / BANDS_PER_PAGE);
    if (bandPage >= totalPages) bandPage = Math.max(0, totalPages - 1);

    const start = bandPage * BANDS_PER_PAGE;
    const pageBands = bands.slice(start, start + BANDS_PER_PAGE);

    pageBands.forEach((band, indexOnPage) => {
        const realIndex = start + indexOnPage;

        const div = document.createElement("div");
        div.className = "folder-item";

        const ph = document.createElement("div");
        ph.className = "folder-thumb-placeholder";

        const cacheKey = "band_" + band.name;

        if (band.cover && band.cover.trim() !== "") {
            const img = document.createElement("img");
            img.src = band.cover;
            img.alt = band.name;
            img.onerror = () => applyFallbackCover(ph, band.name, cacheKey);
            ph.appendChild(img);
        } else {
            applyFallbackCover(ph, band.name, cacheKey);
        }

        div.appendChild(ph);

        const label = document.createElement("div");
        label.className = "folder-label";
        label.textContent = "";
        div.appendChild(label);

        div.addEventListener("click", () => openBand(realIndex));

        folderView.appendChild(div);
    });

    renderBandPagination();

    history.replaceState({ band: null, album: null }, "", "?");
}

/* ------------------------------------------------------------
   OPEN BAND
------------------------------------------------------------ */
function openBand(bandIndex, fromHistory = false) {
    const isHistory = fromHistory;

    currentBandIndex = bandIndex;
    currentAlbumIndex = null;
    isRelatedView = false;

    const band = bands[bandIndex];
    const bandPath = "Setlist/" + band.name + "/";
    const albums = band.albums || [];
    const hasAlbums = albums.length > 0;

    panelTitle.textContent = band.name;

    folderView.innerHTML = "";
    trackView.innerHTML = "";
    attachmentMenu.style.display = "none";

    currentTracks = [];
    currentAttachments = [];

    if (pagination) {
        pagination.style.display = "none";
        pagination.innerHTML = "";
    }

    // ⭐ Only clear highlight on fresh navigation
    if (!isHistory) {
        currentIndex = -1;
        document.querySelectorAll(".track-row.active").forEach(el => el.classList.remove("active"));
        document.querySelectorAll(".folder-item.active").forEach(el => el.classList.remove("active"));
    }

    // ⭐ BAND WITH NO ALBUMS → show tracks directly
    if (!hasAlbums) {
        folderView.style.display = "none";
        trackView.style.display = "block";

        fetch(bandPath + "setlist.txt")
            .then(res => res.ok ? res.text() : "")
            .then(text => {
                if (text) {
                    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

                    lines.forEach(line => {
                        const lower = line.toLowerCase();
                        if (isAudioFile(lower) || isVideoFile(lower)) {
                            currentTracks.push({ file: line, path: bandPath });
                        } else if (attachmentExts.some(ext => lower.endsWith(ext))) {
                            currentAttachments.push({ file: line, path: bandPath });
                        }
                    });
                }

                downloadBtn.style.display = currentAttachments.length > 0 ? "inline-flex" : "none";

                trackView.innerHTML = "";
                currentTracks.forEach((t, i) => {
                    const li = document.createElement("li");
                    li.className = "track-row";

                    const clean = t.file.replace(/\.[^/.]+$/, "");
                    li.innerHTML = `
                        <span class="track-title">${clean}</span>
                        <span class="track-menu-btn">...</span>
                    `;

                    li.addEventListener("click", () => loadTrack(i, true));

                    li.querySelector(".track-menu-btn").addEventListener("click", (e) => {
                        e.stopPropagation();
                        openTrackMenu(e, i, t);
                    });

                    // ⭐ Restore highlight when coming from history
                    if (isHistory && currentIndex >= 0 && i === currentIndex) {
                        li.classList.add("active");
                    }

                    trackView.appendChild(li);
                });

                // ⭐⭐⭐ SYNC HIGHLIGHT WITH PLAYBACK QUEUE (NO ALBUMS) ⭐⭐⭐
                if (currentTracks.length && playQueue.length) {
                    const sameList =
                        currentTracks.length === playQueue.length &&
                        currentTracks.every((t, i) =>
                            t.file === playQueue[i].file && t.path === playQueue[i].path
                        );

                    if (sameList) {
                        currentIndex = playQueueIndex;
                        highlightTrack(currentIndex);
                    } else {
                        currentIndex = -1;
                    }
                }

                // ⭐ Save history only on fresh navigation
                if (!isHistory) {
                    history.pushState(
                        { band: bandIndex, album: null, currentIndex: currentIndex },
                        "",
                        "?band=" + encodeURIComponent(band.name)
                    );
                }
            });

        return;
    }

    // ⭐ BAND WITH ALBUMS → show albums + band-level tracks
    folderView.style.display = "grid";
    trackView.style.display = "block";

    fetch(bandPath + "setlist.txt")
        .then(res => res.ok ? res.text() : "")
        .then(text => {
            if (text) {
                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

                lines.forEach(line => {
                    const lower = line.toLowerCase();
                    if (isAudioFile(lower) || isVideoFile(lower)) {
                        currentTracks.push({ file: line, path: bandPath });
                    } else if (attachmentExts.some(ext => lower.endsWith(ext))) {
                        currentAttachments.push({ file: line, path: bandPath });
                    }
                });
            }

            downloadBtn.style.display = currentAttachments.length > 0 ? "inline-flex" : "none";

            trackView.innerHTML = "";
            currentTracks.forEach((t, i) => {
                const li = document.createElement("li");
                li.className = "track-row";

                const clean = t.file.replace(/\.[^/.]+$/, "");
                li.innerHTML = `
                    <span class="track-title">${clean}</span>
                    <span class="track-menu-btn">...</span>
                `;

                li.addEventListener("click", () => loadTrack(i, true));

                li.querySelector(".track-menu-btn").addEventListener("click", (e) => {
                    e.stopPropagation();
                    openTrackMenu(e, i, t);
                });

                // ⭐ Restore highlight when coming from history
                if (isHistory && currentIndex >= 0 && i === currentIndex) {
                    li.classList.add("active");
                }

                trackView.appendChild(li);
            });

            // ⭐⭐⭐ SYNC HIGHLIGHT WITH PLAYBACK QUEUE (BAND WITH ALBUMS) ⭐⭐⭐
            if (currentTracks.length && playQueue.length) {
                const sameList =
                    currentTracks.length === playQueue.length &&
                    currentTracks.every((t, i) =>
                        t.file === playQueue[i].file && t.path === playQueue[i].path
                    );

                if (sameList) {
                    currentIndex = playQueueIndex;
                    highlightTrack(currentIndex);
                } else {
                    currentIndex = -1;
                }
            }
        });

    // ⭐ Render albums
    albums.forEach((album, ai) => {
        const div = document.createElement("div");
        div.className = "folder-item";

        const ph = document.createElement("div");
        ph.className = "folder-thumb-placeholder";

        const cacheKey = "album_" + band.name + "_" + album.title;

        if (album.cover && album.cover.trim() !== "") {
            const img = document.createElement("img");
            img.src = album.cover;
            img.alt = album.title;
            img.onerror = () => applyFallbackCover(ph, album.title, cacheKey);
            ph.appendChild(img);
        } else {
            applyFallbackCover(ph, album.title, cacheKey);
        }

        div.appendChild(ph);

        const label = document.createElement("div");
        label.className = "folder-label";
        label.textContent = "";
        div.appendChild(label);

        div.addEventListener("click", () => openAlbum(bandIndex, ai));

        folderView.appendChild(div);
    });

    // ⭐ Save history only on fresh navigation
    if (!isHistory) {
        history.pushState(
            { band: bandIndex, album: null, currentIndex: currentIndex },
            "",
            "?band=" + encodeURIComponent(band.name)
        );
    }
}

/* ------------------------------------------------------------
   OPEN ALBUM
------------------------------------------------------------ */
function openAlbum(bandIndex, albumIndex, fromHistory = false) {
    const isHistory = fromHistory;

    currentBandIndex = bandIndex;
    currentAlbumIndex = albumIndex;
    isRelatedView = false;

    const band = bands[bandIndex];
    const album = band.albums[albumIndex];

    // ⭐ Fresh navigation (click from band/albums) should NOT reuse old index
    // Only history restores are allowed to keep currentIndex.
    if (!isHistory) {
        currentIndex = -1; // no track selected yet for this album
    }

    // ⭐ CLEAR ALL HIGHLIGHTS (tracks, albums, related, bands)
    document.querySelectorAll(".track-row.active").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".folder-item.active").forEach(el => el.classList.remove("active"));

    panelTitle.textContent = band.name + " – " + album.title;

    folderView.style.display = "none";
    trackView.style.display = "block";
    trackView.innerHTML = "";
    attachmentMenu.style.display = "none";

    currentTracks = [];
    currentAttachments = [];

    if (pagination) {
        pagination.style.display = "none";
        pagination.innerHTML = "";
    }

    fetch(album.path + "setlist.txt")
        .then(res => res.text())
        .then(text => {
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

            lines.forEach(line => {
                const lower = line.toLowerCase();
                if (isAudioFile(lower) || isVideoFile(lower)) {
                    currentTracks.push({ file: line, path: album.path });
                } else if (attachmentExts.some(ext => lower.endsWith(ext))) {
                    currentAttachments.push({ file: line, path: album.path });
                }
            });

            downloadBtn.style.display = currentAttachments.length > 0 ? "inline-flex" : "none";

            currentTracks.forEach((t, i) => {
                const li = document.createElement("li");
                li.className = "track-row";

                const clean = t.file.replace(/\.[^/.]+$/, "");
                li.innerHTML = `
                    <span class="track-title">${clean}</span>
                    <span class="track-menu-btn">...</span>
                `;

                li.addEventListener("click", () => loadTrack(i, true));

                li.querySelector(".track-menu-btn").addEventListener("click", (e) => {
                    e.stopPropagation();
                    openTrackMenu(e, i, t);
                });

                // ⭐ Highlight only if a valid index exists (set by history or playback)
                if (currentIndex >= 0 && i === currentIndex) {
                    li.classList.add("active");
                }

                trackView.appendChild(li);
            });

            // ⭐ Save album state with currentIndex (for Back/Forward restore)
            if (!isHistory) {
                history.pushState(
                    { 
                        band: bandIndex, 
                        album: albumIndex,
                        currentIndex: currentIndex   // -1 on fresh open, or restored value
                    },
                    "",
                    "?band=" + encodeURIComponent(band.name) +
                    "&album=" + encodeURIComponent(album.title)
                );
            }

            // ⭐⭐⭐ FIX: SYNC HIGHLIGHT WITH PLAYBACK QUEUE WHEN OPENING ALBUM ⭐⭐⭐
            if (currentTracks.length && playQueue.length) {
                const sameList =
                    currentTracks.length === playQueue.length &&
                    currentTracks.every((t, i) =>
                        t.file === playQueue[i].file && t.path === playQueue[i].path
                    );

                if (sameList) {
                    currentIndex = playQueueIndex;
                    highlightTrack(currentIndex);
                } else {
                    currentIndex = -1;
                }
            }
        });
}

/* ------------------------------------------------------------
   LOAD TRACK
------------------------------------------------------------ */
function loadTrack(index, autoplay = true, fromQueue = false) {
    if (!currentTracks.length && !playQueue.length) return;

    // ⭐ Update global playing index
    if (!fromQueue) currentIndex = index;

    // ⭐ BUILD OR USE PLAYBACK QUEUE
    if (!fromQueue) {
        playQueue = currentTracks.slice();
        playQueueIndex = index;
    } else {
        playQueueIndex = index;
    }

    // ⭐ CLEAR ALL HIGHLIGHTS
    document.querySelectorAll(".track-row.active")
        .forEach(el => el.classList.remove("active"));

    // ⭐ APPLY NEW HIGHLIGHT
    let sameList = false;
    if (currentTracks.length === playQueue.length) {
        sameList = currentTracks.every((t, i) =>
            t.file === playQueue[i].file &&
            t.path === playQueue[i].path
        );
    }
    if (sameList) {
        currentIndex = playQueueIndex;
        highlightTrack(playQueueIndex);
    }

    // ⭐ UPDATE HISTORY STATE
    if (history.state) {
        const s = history.state;

        if (!isRelatedView && s.album != null) {
            history.replaceState({ ...s, currentIndex }, "", window.location.href);
        }

        if (isRelatedView && s.related) {
            history.replaceState({ ...s, currentIndex }, "", window.location.href);
        }
    }

    // ⭐ LOAD MEDIA
    const t = playQueue[playQueueIndex];
    const lower = t.file.toLowerCase();

    // ------------------------------------------------------------
    // ⭐ FOOTER BAND + TITLE
    // ------------------------------------------------------------
    const parts = t.path.split("/");
    const footerBand = parts[1] || "";

    const clean = t.file.replace(/\.[^/.]+$/, "");
    let title = clean;

    const dashIndex = clean.indexOf(" - ");
    if (dashIndex !== -1) {
        const firstPart = clean.substring(0, dashIndex).trim();
        const rest = clean.substring(dashIndex + 3).trim();
        title = !/^\d+(\.|-)?$/.test(firstPart) ? rest : clean;
    }

    bandNameEl.textContent = footerBand;
    trackTitleEl.textContent = title;

    // ------------------------------------------------------------
    // ⭐ VIDEO MODE
    // ------------------------------------------------------------
    if (isVideoFile(lower)) {

        // stop audio
        audio.pause();
        audio.src = "";

        // ⭐ SHOW VIDEO CLEANLY
        videoContainer.style.display = "block";
        videoContainer.style.opacity = "1";
        videoContainer.style.height = "auto";

        // ⭐ LOAD VIDEO
        video.pause();
        video.src = t.path + t.file;
        video.load();
        if (autoplay) video.play();

        // subtitles
        try { loadSubtitlesForCurrentVideo(t); } catch(e) {}

        updatePlayPauseIcon?.();

        if (lyricsOverlay.style.display === "block") showLyricsPopup(t);

        return;
    }

    // ------------------------------------------------------------
    // ⭐ AUDIO MODE
    // ------------------------------------------------------------

    // ⭐ FULLY STOP VIDEO (prevents flash)
    video.pause();
    video.removeAttribute("src");
    video.load();

    // ⭐ HIDE VIDEO CLEANLY
    videoContainer.style.display = "none";
    videoContainer.style.opacity = "0";
    videoContainer.style.height = "0";

    // load audio
    audio.src = t.path + t.file;
    audio.load();
    if (autoplay) audio.play();

    // clear subtitles
    subtitleTracks = [];
    document.querySelectorAll(".subtitle").forEach(el => el.remove());

    updatePlayPauseIcon?.();

    if (lyricsOverlay.style.display === "block") showLyricsPopup(t);
}

function highlightTrack(index) {
    [...trackView.children].forEach((li, i) => {
        li.classList.toggle("active", i === index);
    });
}

function updatePlayPauseIcon() {
    const playing = isVideoMode()
        ? (video && !video.paused && !video.ended)
        : (audio && !audio.paused && !audio.ended);

    if (playing) {
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
    } else {
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
    }
}

/* ------------------------------------------------------------
   FOOTER CONTROLS
------------------------------------------------------------ */
playBtn.addEventListener("click", () => {
    togglePlay();          // play/pause the correct media
    updatePlayPauseIcon(); // update icons
});


prevBtn.addEventListener("click", () => {
    previousTrack();
});

nextBtn.addEventListener("click", () => {
    nextTrack();
});

/* ------------------------------------------------------------
   PROGRESS + TIME
------------------------------------------------------------ */
function updateProgressFrom(media) {
    if (!media || !media.duration) return;
    progressBar.style.width = (media.currentTime / media.duration) * 100 + "%";
    currentTimeEl.textContent = formatTime(media.currentTime);
    durationEl.textContent = formatTime(media.duration);
}

if (audio) {
    audio.addEventListener("timeupdate", () => {
        if (!isVideoMode()) updateProgressFrom(audio);
    });
}

if (video) {
    video.addEventListener("timeupdate", () => {
        if (isVideoMode()) updateProgressFrom(video);
        updateSubtitleTime(video.currentTime);
    });
}

progressContainer.addEventListener("click", (e) => {
    const width = progressContainer.clientWidth;
    const ratio = e.offsetX / width;

    if (isVideoMode()) {
        if (!video || !video.duration) return;
        video.currentTime = ratio * video.duration;
        updateProgressFrom(video);
        updateSubtitleTime(video.currentTime);
    } else {
        if (!audio || !audio.duration) return;
        audio.currentTime = ratio * audio.duration;
        updateProgressFrom(audio);
    }
});

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

async function buildRelatedPlaylistFromBand(band, fromHistory = false) {
    const genres = band.genre || [];
    if (!genres.length) return;

    let relatedTracks = [];
    const fetches = [];

    // ⭐ CLEAR ALL HIGHLIGHTS (tracks, albums, bands, related)
    document.querySelectorAll(".track-row.active").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".folder-item.active").forEach(el => el.classList.remove("active"));

    // ⭐ Build related list
    bands.forEach((b) => {
        const g = b.genre || [];
        const match = genres.some(genre => g.includes(genre));

        if (match) {
            // Album-level tracks
            (b.albums || []).forEach((album) => {
                fetches.push(
                    fetch(album.path + "setlist.txt")
                        .then(res => res.text())
                        .then(text => {
                            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                            lines.forEach(line => {
                                const lower = line.toLowerCase();
                                if (isAudioFile(lower) || isVideoFile(lower)) {
                                    relatedTracks.push({ file: line, path: album.path });
                                }
                            });
                        })
                );
            });

            // Band-level tracks
            const bandPath = "Setlist/" + b.name + "/";
            fetches.push(
                fetch(bandPath + "setlist.txt")
                    .then(res => res.ok ? res.text() : "")
                    .then(text => {
                        if (!text) return;
                        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                        lines.forEach(line => {
                            const lower = line.toLowerCase();
                            if (isAudioFile(lower) || isVideoFile(lower)) {
                                relatedTracks.push({ file: line, path: bandPath });
                            }
                        });
                    })
            );
        }
    });

    await Promise.all(fetches);

    if (!relatedTracks.length) return;

    shuffleArray(relatedTracks);
    relatedTracks = relatedTracks.slice(0, 20);

    // ⭐ Enter Related View
    isRelatedView = true;
    currentTracks = relatedTracks;
    currentAttachments = [];

    // ⭐ UI Reset
    folderView.style.display = "none";
    trackView.style.display = "block";
    trackView.innerHTML = "";
    downloadBtn.style.display = "none";

    if (pagination) {
        pagination.style.display = "none";
        pagination.innerHTML = "";
    }

    // ⭐ Title
    panelTitle.textContent = "Related – " + genres.join(", ");

    // ⭐ Render Related Tracks
    currentTracks.forEach((t, i) => {
        const li = document.createElement("li");
        li.className = "track-row";

        const clean = t.file.replace(/\.[^/.]+$/, "");
        li.innerHTML = `
            <span class="track-title">${clean}</span>
            <span class="track-menu-btn">...</span>
        `;

        // ⭐ Highlight only if history restored a valid index
        if (fromHistory && currentIndex >= 0 && i === currentIndex) {
            li.classList.add("active");
        }

        li.addEventListener("click", () => loadTrack(i, true));

        li.querySelector(".track-menu-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            openTrackMenu(e, i, t);
        });

        trackView.appendChild(li);
    });

    // ⭐ Save Related state (ONLY when user clicks Related)
    if (!fromHistory) {
        history.pushState(
            {
                band: currentBandIndex,
                album: currentAlbumIndex,
                related: true,
                relatedTracks: currentTracks.slice(),
                currentIndex: -1
            },
            "",
            "?related=1"
        );
    }
}

/* ------------------------------------------------------------
   SHUFFLE
------------------------------------------------------------ */
function shuffleArray(arr) {
    if (!arr || arr.length < 2) return;

    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    // keep playback queue synced if this is the active queue
    if (arr === playQueue) {
        playQueue = arr.slice();
    }
}

/* ------------------------------------------------------------
   BROWSER BACK/FORWARD
------------------------------------------------------------ */
window.addEventListener("popstate", (event) => {
    const state = event.state;
    attachmentMenu.style.display = "none";
    trackContextMenu.style.display = "none";

    // No state → root bands page
    if (!state) {
        isRelatedView = false;
        showBands(true);
        return;
    }

    const { 
        band, 
        album, 
        related, 
        relatedTracks: savedList, 
        currentIndex: savedIndex 
    } = state;

    // ⭐ RESTORE RELATED PAGE EXACTLY
    if (related) {
        isRelatedView = true;

        currentBandIndex = band;
        currentAlbumIndex = album;

        relatedTracks = savedList.slice();
        currentTracks = relatedTracks.slice();

        currentIndex = (typeof savedIndex === "number") ? savedIndex : -1;

        restoreRelatedPage();

        // ⭐ SYNC HIGHLIGHT WITH PLAYBACK QUEUE
        if (currentTracks.length && playQueue.length) {
            const sameList =
                currentTracks.length === playQueue.length &&
                currentTracks.every((t, i) =>
                    t.file === playQueue[i].file && t.path === playQueue[i].path
                );

            if (sameList) {
                currentIndex = playQueueIndex;
                highlightTrack(currentIndex);
            }
        } else if (currentIndex >= 0) {
            highlightTrack(currentIndex);
        }

        return;
    }

    // ⭐ We are leaving Related (if we were in it)
    const comingFromRelated = isRelatedView;
    isRelatedView = false;

    // ⭐ RESTORE ALBUM
    if (band != null && album != null) {

        if (comingFromRelated) {
            // 🔥 When coming BACK from Related → Album highlight must be OFF
            currentIndex = -1;

            // 🔥 CRITICAL: overwrite album history so Forward does NOT resurrect old highlight
            history.replaceState(
                {
                    band,
                    album,
                    currentIndex: -1
                },
                "",
                window.location.href
            );

        } else {
            // Normal album navigation (Back/Forward inside albums)
            currentIndex = (typeof savedIndex === "number") ? savedIndex : -1;
        }

        openAlbum(band, album, true);

        // ⭐ SYNC HIGHLIGHT WITH PLAYBACK QUEUE
        if (currentTracks.length && playQueue.length) {
            const sameList =
                currentTracks.length === playQueue.length &&
                currentTracks.every((t, i) =>
                    t.file === playQueue[i].file && t.path === playQueue[i].path
                );

            if (sameList) {
                currentIndex = playQueueIndex;
                highlightTrack(currentIndex);
            }
        }

        return;
    }

    // ⭐ RESTORE BAND
    if (band != null && album == null) {
        openBand(band, true);

        // ⭐ SYNC HIGHLIGHT WITH PLAYBACK QUEUE
        if (currentTracks.length && playQueue.length) {
            const sameList =
                currentTracks.length === playQueue.length &&
                currentTracks.every((t, i) =>
                    t.file === playQueue[i].file && t.path === playQueue[i].path
                );

            if (sameList) {
                currentIndex = playQueueIndex;
                highlightTrack(currentIndex);
            }
        }

        return;
    }

    // fallback
    showBands(true);
});

shuffleBtn.addEventListener("click", () => {
    shuffleOn = !shuffleOn;
    if (shuffleOn) repeatOn = false;
    updateModeButtons();
});

repeatBtn.addEventListener("click", () => {
    repeatOn = !repeatOn;
    if (repeatOn) shuffleOn = false;
    updateModeButtons();
});

function updateModeButtons() {
    shuffleBtn.classList.toggle("active", shuffleOn);
    repeatBtn.classList.toggle("active", repeatOn);
}

/* ------------------------------------------------------------
   RESTORE BAND PAGE
------------------------------------------------------------ */
function restoreBandPage(bandIndex) {
    currentBandIndex = bandIndex;
    currentAlbumIndex = null;
    isRelatedView = false;

    const band = bands[bandIndex];
    panelTitle.textContent = band.name;

    // Band restore = SHOW folder grid
    folderView.style.display = "grid";
    trackView.style.display = "block";

    trackView.innerHTML = "";

    currentTracks.forEach((t, i) => {
        const li = document.createElement("li");
        li.className = "track-row";

        const clean = t.file.replace(/\.[^/.]+$/, "");
        li.innerHTML = `
            <span class="track-title">${clean}</span>
            <span class="track-menu-btn">...</span>
        `;

        li.addEventListener("click", () => loadTrack(i, true));

        li.querySelector(".track-menu-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            openTrackMenu(e, i, t);
        });

        trackView.appendChild(li);
    });

    if (isVideoMode()) {
        videoContainer.style.display = "block";
    } else {
        videoContainer.style.display = "none";
    }
}

/* ------------------------------------------------------------
   RESTORE ALBUM PAGE
------------------------------------------------------------ */
function restoreAlbumPage(bandIndex, albumIndex) {
    currentBandIndex = bandIndex;
    currentAlbumIndex = albumIndex;
    isRelatedView = false;

    const band = bands[bandIndex];
    const album = band.albums[albumIndex];

    panelTitle.textContent = band.name + " – " + album.title;

    // CORRECT: Album restore = TRACK PAGE ONLY
    folderView.style.display = "none";
    trackView.style.display = "block";

    // Rebuild track list
    trackView.innerHTML = "";

    currentTracks.forEach((t, i) => {
        const li = document.createElement("li");
        li.className = "track-row";

        const clean = t.file.replace(/\.[^/.]+$/, "");
        li.innerHTML = `
             <span class="track-title">${clean}</span>
            <span class="track-menu-btn">...</span>
        `;

        li.addEventListener("click", () => loadTrack(i, true));

        li.querySelector(".track-menu-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            openTrackMenu(e, i, t);
        });

        trackView.appendChild(li);
    });

    // Video visibility depends on current track
    if (isVideoMode()) {
        videoContainer.style.display = "block";
    } else {
        videoContainer.style.display = "none";
    }
}

function openRelated(fromHistory = false) {
    isRelatedView = true;

    folderView.style.display = "none";
    trackView.style.display = "block";
    trackView.innerHTML = "";
    attachmentMenu.style.display = "none";

    // use the dedicated stash
    currentTracks = relatedTracks.slice();

    currentTracks.forEach((t, i) => {
        const li = document.createElement("li");
        li.className = "track-row";

        const clean = t.file.replace(/\.[^/.]+$/, "");
        li.innerHTML = `
            <span class="track-title">${clean}</span>
            <span class="track-menu-btn">...</span>
        `;

        li.addEventListener("click", () => loadTrack(i, true));

        li.querySelector(".track-menu-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            openTrackMenu(e, i, t);
        });

        trackView.appendChild(li);
    });

    if (!fromHistory) {
        history.pushState(
            {
                band: currentBandIndex,
                album: currentAlbumIndex,
                related: true
            },
            "",
            "?band=" + encodeURIComponent(bands[currentBandIndex].name) +
            (currentAlbumIndex != null
                ? "&album=" + encodeURIComponent(bands[currentBandIndex].albums[currentAlbumIndex].title)
                : "") +
            "&related=1"
        );
    }
}

function restoreRelatedPage() {
    isRelatedView = true;

    folderView.style.display = "none";
    trackView.style.display = "block";
    trackView.innerHTML = "";
    attachmentMenu.style.display = "none";

    // ⭐ Always use saved list
    const list = relatedTracks.slice();

    // ⭐ Restore title using band genres
    const band = bands[currentBandIndex];
    const genres = band.genre || [];
    panelTitle.textContent = "Related – " + genres.join(", ");

    list.forEach((t, i) => {
        const li = document.createElement("li");
        li.className = "track-row";

        const clean = t.file.replace(/\.[^/.]+$/, "");
        li.innerHTML = `
            <span class="track-title">${clean}</span>
            <span class="track-menu-btn">...</span>
        `;

        // ⭐ highlight correct track
        if (i === currentIndex) {
            li.classList.add("active");
        }

        li.addEventListener("click", () => loadTrack(i, true));

        li.querySelector(".track-menu-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            openTrackMenu(e, i, t);
        });

        trackView.appendChild(li);
    });

    if (isVideoMode()) {
        videoContainer.style.display = "block";
    } else {
        videoContainer.style.display = "none";
    }
}

/* ------------------------------------------------------------
   TRACK CONTEXT MENU
------------------------------------------------------------ */
function openTrackMenu(event, index, track) {
    const isVideo = isVideoFile(track.file.toLowerCase());

    trackContextMenu.innerHTML = "";

    const lyricsItem = document.createElement("div");
    lyricsItem.className = "context-item";
    lyricsItem.textContent = "Lyrics";
    lyricsItem.addEventListener("click", () => {
        trackContextMenu.style.display = "none";
        showLyricsPopup(track);
    });
    trackContextMenu.appendChild(lyricsItem);

    if (!isRelatedView) {
        const relatedItem = document.createElement("div");
        relatedItem.className = "context-item";
        relatedItem.textContent = "Related";
        relatedItem.addEventListener("click", () => {
            trackContextMenu.style.display = "none";
            buildRelatedFromCurrentTrack(track);
        });
        trackContextMenu.appendChild(relatedItem);
    }

    if (!isRelatedView && isVideo) {
        const subtitleItem = document.createElement("div");
        subtitleItem.className = "context-item";
        subtitleItem.textContent = "Subtitle";
        subtitleItem.addEventListener("click", () => {
            trackContextMenu.style.display = "none";
            showSubtitleOverlay();
        });
        trackContextMenu.appendChild(subtitleItem);

        const fullscreenItem = document.createElement("div");
        fullscreenItem.className = "context-item";
        fullscreenItem.textContent = "Fullscreen";
        fullscreenItem.addEventListener("click", () => {
            trackContextMenu.style.display = "none";
            enterFullscreen();
        });
        trackContextMenu.appendChild(fullscreenItem);
    }

    const rect = event.target.getBoundingClientRect();
    trackContextMenu.style.left = rect.right - 180 + "px";
    trackContextMenu.style.top = rect.bottom + 4 + "px";
    trackContextMenu.style.display = "block";
}

audio.addEventListener("ended", () => {
    nextTrack();
});

video.addEventListener("ended", () => {
    nextTrack();
});

function nextTrack() {
    if (!playQueue.length) return;

    if (repeatOn) {
        loadTrack(playQueueIndex, true, true);
        return;
    }

    if (shuffleOn) {
        let newIndex = playQueueIndex;
        while (newIndex === playQueueIndex && playQueue.length > 1) {
            newIndex = Math.floor(Math.random() * playQueue.length);
        }
        loadTrack(newIndex, true, true);
        return;
    }

    let newIndex = playQueueIndex + 1;
    if (newIndex >= playQueue.length) newIndex = 0;

    loadTrack(newIndex, true, true);
}

function previousTrack() {
    if (!playQueue.length) return;

    if (repeatOn) {
        loadTrack(playQueueIndex, true, true);
        return;
    }

    if (shuffleOn) {
        let newIndex = playQueueIndex;
        while (newIndex === playQueueIndex && playQueue.length > 1) {
            newIndex = Math.floor(Math.random() * (playQueue.length));
        }
        loadTrack(newIndex, true, true);
        return;
    }

    let newIndex = playQueueIndex - 1;
    if (newIndex < 0) newIndex = playQueue.length - 1;

    loadTrack(newIndex, true, true);
}

/* ------------------------------------------------------------
   LYRICS
------------------------------------------------------------ */
function showLyricsPopup(track) {
    const base = track.file.replace(/\.[^/.]+$/, "");
    const lyricsPath = track.path + base + ".txt";

    lyricsOverlay.innerHTML = `
        <div style="position:relative; text-align:left;">
            <div style="position:absolute; top:0; right:0; cursor:pointer; padding:4px 8px;" id="lyricsCloseBtn">✕</div>
            <h3 style="margin-top:0; margin-bottom:10px; font-size:16px;">Lyrics – ${base}</h3>
        </div>

        <div style="max-height:60vh; overflow:auto;">
            <pre id="lyricsContent" style="white-space:pre-wrap; font-family:'Segoe UI', Arial, sans-serif; font-size:13px; line-height:1.4;"></pre>
        </div>
    `;

    lyricsOverlay.style.display = "block";
    lyricsOverlay.style.paddingTop = "20px";

    document.getElementById("lyricsCloseBtn").addEventListener("click", () => {
        lyricsOverlay.style.display = "none";
    });

    fetch(lyricsPath)
        .then(res => res.ok ? res.text() : "Lyrics not found.")
        .then(text => {
            document.getElementById("lyricsContent").textContent = text;
        })
        .catch(() => {
            document.getElementById("lyricsContent").textContent = "Lyrics not found.";
        });
}



/* ------------------------------------------------------------
   RELATED FROM CURRENT TRACK
------------------------------------------------------------ */
async function buildRelatedFromCurrentTrack(track, fromHistory = false) {
    if (currentBandIndex === null) return;

    const band = bands[currentBandIndex];
    const genres = band.genre || [];
    if (!genres.length) return;

    const mainGenre = genres[0];

    let temp = [];
    const fetches = [];

    // Collect related tracks by genre
    bands.forEach((b) => {
        const g = b.genre || [];
        if (g.includes(mainGenre)) {

            // Album-level tracks
            (b.albums || []).forEach((album) => {
                fetches.push(
                    fetch(album.path + "setlist.txt")
                        .then(res => res.text())
                        .then(text => {
                            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                            lines.forEach(line => {
                                const lower = line.toLowerCase();
                                if (isAudioFile(lower) || isVideoFile(lower)) {
                                    temp.push({ file: line, path: album.path });
                                }
                            });
                        })
                );
            });

            // Band-level tracks
            const bandPath = "Setlist/" + b.name + "/";
            fetches.push(
                fetch(bandPath + "setlist.txt")
                    .then(res => res.ok ? res.text() : "")
                    .then(text => {
                        if (!text) return;
                        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                        lines.forEach(line => {
                            const lower = line.toLowerCase();
                            if (isAudioFile(lower) || isVideoFile(lower)) {
                                temp.push({ file: line, path: bandPath });
                            }
                        });
                    })
            );
        }
    });

    await Promise.all(fetches);

    if (!temp.length) return;

    // ⭐ Shuffle ONLY when user opens Related (not on restore)
    if (!fromHistory) shuffleArray(temp);

    temp = temp.slice(0, 20);

    // ⭐ Save exact list globally for restore
    relatedTracks = temp.slice();

    // ⭐ Switch UI to Related view
    isRelatedView = true;
    currentTracks = relatedTracks.slice();
    currentAttachments = [];

    folderView.style.display = "none";
    trackView.style.display = "block";
    trackView.innerHTML = "";
    downloadBtn.style.display = "none";

    if (pagination) {
        pagination.style.display = "none";
        pagination.innerHTML = "";
    }

    // ⭐ Correct title
    panelTitle.textContent = "Related – " + genres.join(", ");

    // Render list
    currentTracks.forEach((t, i) => {
        const li = document.createElement("li");
        li.className = "track-row";

        const clean = t.file.replace(/\.[^/.]+$/, "");
        li.innerHTML = `
             <span class="track-title">${clean}</span>
            <span class="track-menu-btn">...</span>
        `;

        li.addEventListener("click", () => loadTrack(i, true));

        li.querySelector(".track-menu-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            openTrackMenu(e, i, t);
        });

        trackView.appendChild(li);
    });

    // ⭐ NEW LOGIC:
    // Fresh Related → no highlight
    // History restore → highlight saved index
    if (!fromHistory) {
        currentIndex = -1; // ⭐ nothing selected yet
    } else {
        if (currentIndex >= 0) {
            highlightTrack(currentIndex);
        }
    }

    // ⭐ Save exact Related playlist + playing index into browser history
    if (!fromHistory) {
        history.pushState(
            {
                band: currentBandIndex,
                album: currentAlbumIndex,
                related: true,
                relatedTracks: relatedTracks.slice(),   // exact list
                currentIndex: currentIndex              // -1 for fresh, real index for restore
            },
            "",
            "?related=1"
        );
    }
}

/* ------------------------------------------------------------
   ATTACHMENT MENU (UNDER BUTTON)
------------------------------------------------------------ */
downloadBtn.addEventListener("click", () => {
    if (!currentAttachments.length) return;
    openAttachmentMenu();
});

function openAttachmentMenu() {
    if (!currentAttachments.length) return;

    attachmentMenu.innerHTML = "";
    attachmentMenu.style.display = "block";

    currentAttachments.forEach(att => {
        const item = document.createElement("div");
        item.className = "context-item";
        item.textContent = att.file;

        item.addEventListener("click", () => {
            const url = att.path + att.file;
            const a = document.createElement("a");
            a.href = url;
            a.download = att.file;
            a.click();
            attachmentMenu.style.display = "none";
        });

        attachmentMenu.appendChild(item);
    });

    const rect = downloadBtn.getBoundingClientRect();

    if (window.innerWidth > 900) {
        // DESKTOP: dropdown under button (restored behavior)
        const extraStretch = 40;

        attachmentMenu.style.left = rect.left + "px";
        attachmentMenu.style.right = "auto";
        attachmentMenu.style.width = (rect.width + extraStretch) + "px";
        attachmentMenu.style.top = rect.bottom + 6 + "px";
        attachmentMenu.style.bottom = "auto";
        attachmentMenu.style.transform = "none";

    } else {
        // ⭐ MOBILE → full overlay like lyrics
        openAttachmentOverlay();
    }
}

function openAttachmentOverlay() {
   attachmentMenu.classList.add("hidden");

   attachmentsOverlay.innerHTML = `
        <div style="position:relative; text-align:left; padding-top: 32px;">
            <div id="attachmentsCloseBtn" style="
                position:absolute;
                top:10px;
                right:14px;
                font-size:22px;
                color:#88dfff;
                cursor:pointer;
                z-index:10001;
            ">✕</div>
        </div>

        <div id="attachmentsContent"></div>
    `;

    // Show overlay
    attachmentsOverlay.style.display = "block";
    attachmentsOverlay.style.position = "fixed";
    attachmentsOverlay.style.zIndex = "999999";

    // Close button
    document.getElementById("attachmentsCloseBtn").onclick = () => {
        attachmentsOverlay.style.display = "none";
        attachmentMenu.classList.remove("hidden");
    };

    // Build plain hyperlinks 
    let html = "";
    currentAttachments.forEach(att => {
        const url = att.path + att.file;
        html += `
            <a href="${url}" download="${att.file}" class="attachment-item" style="
                display:block;
                color:#cceeff;
                text-decoration:none;
                margin: 8px 0;
                font-family:'Segoe UI', Arial, sans-serif;
                font-size:0.9rem;
            ">
                ${att.file}
            </a>
        `;
    });

    document.getElementById("attachmentsContent").innerHTML = html;
}


document.addEventListener("click", (e) => {
    if (!attachmentMenu.contains(e.target) && e.target !== downloadBtn) {
        attachmentMenu.style.display = "none";
    }
});

document.addEventListener("click", (e) => {
    if (!trackContextMenu.contains(e.target)) {
        trackContextMenu.style.display = "none";
    }
});

/* ------------------------------------------------------------
   GLOBAL SUBTITLE STATE
------------------------------------------------------------ */
let subtitleSRTList = [];         // SRT files found
let subtitleBasePath = "";        // folder path for SRT/VTT

/* ------------------------------------------------------------
   LOAD SUBTITLE SETTINGS
------------------------------------------------------------ */
async function loadSubtitleSettings() {
    try {
        const saved = localStorage.getItem("Caption.json");
        if (saved) {
            subtitleSettings = JSON.parse(saved);
            return;
        }

        const res = await fetch("Caption/Caption.json");
        if (!res.ok) {
            subtitleSettings = null;
            return;
        }
        subtitleSettings = await res.json();
    } catch {
        subtitleSettings = null;
    }
}

function buildSubtitleDataFromTrack(track) {
    return {
        color: track.color,
        size: track.size,
        bgColor: track.bgColor,
        bgOpacity: track.bgOpacity,
        fontFamily: track.fontFamily,
        visible: track.visible
    };
}

async function saveSubtitleSettings() {
    if (!subtitleTracks.length) return;

    const updated = {};
    if (subtitleTracks.length >= 1) updated.subtitle1 = buildSubtitleDataFromTrack(subtitleTracks[0]);
    if (subtitleTracks.length >= 2) updated.subtitle2 = buildSubtitleDataFromTrack(subtitleTracks[1]);

    subtitleSettings = updated;
    localStorage.setItem("Caption.json", JSON.stringify(updated, null, 2));
}

function applySubtitleSettingsToTracks() {
    if (!subtitleSettings || !subtitleTracks.length) return;

    if (subtitleTracks.length >= 1 && subtitleSettings.subtitle1)
        Object.assign(subtitleTracks[0], subtitleSettings.subtitle1);

    if (subtitleTracks.length >= 2 && subtitleSettings.subtitle2)
        Object.assign(subtitleTracks[1], subtitleSettings.subtitle2);
}

/* ------------------------------------------------------------
   LOAD SUBTITLES
------------------------------------------------------------ */
async function loadSubtitlesForCurrentVideo(track) {
    subtitleTracks = [];
    subtitleSRTList = [];
    subtitleBasePath = track.path;

    document.querySelectorAll(".subtitle").forEach(el => el.remove());

    const setlistUrl = track.path + "setlist.txt";

    let text = "";
    try {
        const res = await fetch(setlistUrl);
        if (!res.ok) return;
        text = await res.text();
    } catch {
        return;
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const vtts = lines.filter(l => l.toLowerCase().endsWith(".vtt"));
    const srts = lines.filter(l => l.toLowerCase().endsWith(".srt"));

    // Store SRT list for overlay
    subtitleSRTList = srts.slice();

    // If VTT exists → load normally
    if (vtts.length > 0) {
        for (let sub of vtts) {
            const cues = await parseVTT(track.path + sub);
            subtitleTracks.push({
                file: sub.replace(/\.vtt$/i, ''),
                cues,
                color: "#ffffff",
                size: 24,
                visible: false,
                bgColor: "#000000",
                bgOpacity: 0,
                fontFamily: "Sans Proportional"
            });
        }

        subtitleTracks.sort((a, b) => a.file.localeCompare(b.file));
        renderSubtitleContainers();
        applySubtitleSettingsToTracks();
    }
}

/* ------------------------------------------------------------
   FONT MAP
------------------------------------------------------------ */
const FONT_MAP = {
  "Serif Proportional": "Times New Roman",
  "Serif Monospace": "Courier New",
  "Sans Proportional": "Segoe UI",
  "Sans Monospace": "Consolas",
  "Classical Serif": "Georgia",
  "Handwriting": "Comic Sans MS",
  "Modern Sans": "Arial",
  "Clean Sans": "Verdana",
  "UI Sans": "Tahoma",
  "Soft Sans": "Calibri",
  "Book Serif": "Cambria",
  "Trebuchet": "Trebuchet MS",
  "Roboto": "Roboto"
};

/* ------------------------------------------------------------
   VTT PARSER
------------------------------------------------------------ */
async function parseVTT(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const text = await res.text();

        const pattern =
            /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\s([\s\S]*?)(?=\n\n|\r\n\r\n|$)/g;

        let cues = [];
        let match;

        while ((match = pattern.exec(text)) !== null) {
            cues.push({
                start: toSeconds(match[1]),
                end: toSeconds(match[2]),
                text: match[3].trim()
            });
        }

        return cues;
    } catch {
        return [];
    }
}

function toSeconds(ts) {
    const [h, m, s] = ts.split(':');
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
}


/* ------------------------------------------------------------
   RENDER SUBTITLE CONTAINERS (VTT ONLY)
------------------------------------------------------------ */
function renderSubtitleContainers() {
    document.querySelectorAll('.subtitle').forEach(el => el.remove());

    subtitleTracks.forEach((track, i) => {
        const div = document.createElement("div");
        div.id = `subtitle${i}`;
        div.className = "subtitle";
        subtitleWrapper.appendChild(div);
    });
}

/* ------------------------------------------------------------
   UPDATE SUBTITLES EACH FRAME
------------------------------------------------------------ */
function updateSubtitleTime(t) {
    if (!subtitleTracks.length) return;

    subtitleTracks.forEach((track, i) => {
        const el = document.getElementById(`subtitle${i}`);
        if (!el) return;

        const text = (getCueText(track.cues, t) || '').trim();

        if (track.visible && text !== "") {
            el.innerHTML = `<span class="subtitle-bg">${text}</span>`;
            el.style.display = "block";
        } else {
            el.innerHTML = "";
            el.style.display = "none";
        }

        el.style.fontSize = track.size + 'px';
        el.style.color = track.color;
        el.style.fontFamily = FONT_MAP[track.fontFamily] || track.fontFamily;

        const bg = el.querySelector(".subtitle-bg");
        if (bg) {
            const rgb = hexToRgb(track.bgColor);
            bg.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${track.bgOpacity})`;
        }
    });
}

function getCueText(cues, time) {
    for (let cue of cues) {
        if (time >= cue.start && time <= cue.end) return cue.text;
    }
    return '';
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    const bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}
/* ------------------------------------------------------------
   SHOW SUBTITLE OVERLAY (FINAL WORKING VERSION)
------------------------------------------------------------ */
function showSubtitleOverlay() {
    const overlay = document.getElementById("subtitleOverlay");

    // RESET
    overlay.innerHTML = "";
    overlay.style.display = "block";

    // ------------------------------------------
    // FIXED HEADER (X + TITLE)
    // ------------------------------------------
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.position = "sticky";
    header.style.top = "0";
    header.style.background = "transparent";
    header.style.backdropFilter = "none";
    header.style.zIndex = "10";
    header.style.paddingBottom = "10px";

    const title = document.createElement("h3");
    title.textContent = "Subtitle";
    title.style.margin = "0";

    const closeBtn = document.createElement("div");
    closeBtn.id = "subtitleCloseBtn";
    closeBtn.textContent = "✕";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "20px";
    closeBtn.onclick = () => overlay.style.display = "none";

    header.appendChild(title);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    // ------------------------------------------
    // SCROLL AREA 
    // ------------------------------------------
    const scrollArea = document.createElement("div");
    scrollArea.style.maxHeight = "60vh";
    scrollArea.style.overflowY = "auto";
    scrollArea.style.paddingRight = "4px";
    overlay.appendChild(scrollArea);

    // ------------------------------------------
    // CASE A — VTT EXISTS
    // ------------------------------------------
    if (subtitleTracks.length > 0) {
        applySubtitleSettingsToTracks();

        subtitleTracks.forEach((track, i) => {
            const block = document.createElement("div");
            block.style.marginBottom = "16px";

            let fontOptions = "";
            Object.keys(FONT_MAP).forEach(name => {
                fontOptions += `<option value="${name}">${name}</option>`;
            });

            block.innerHTML = `
                <button id="toggle${i}">${track.file}</button><br><br>

                <span>Font family:</span><br>
                <select id="fontFamily${i}">
                    ${fontOptions}
                </select><br><br>

                <span>Font color:</span><br>
                <input id="color${i}" type="color" value="${track.color}"><br>

                <span>Font size:</span><br>
                <input id="size${i}" type="range" min="14" max="72" value="${track.size}"><br>

                <span>Background color:</span><br>
                <input id="bgColor${i}" type="color" value="${track.bgColor}"><br>

                <span>Background opacity:</span><br>
                <input id="bgOpacity${i}" type="range" min="0" max="1" step="0.05" value="${track.bgOpacity}"><br>
            `;

            scrollArea.appendChild(block);
        });

        // EVENT BINDINGS
        subtitleTracks.forEach((track, i) => {
            document.getElementById(`toggle${i}`).onclick = () => {
                track.visible = !track.visible;
                saveSubtitleSettings();
            };

            document.getElementById(`fontFamily${i}`).oninput = e => {
                track.fontFamily = e.target.value;
                saveSubtitleSettings();
            };
            document.getElementById(`color${i}`).oninput = e => {
                track.color = e.target.value;
                saveSubtitleSettings();
            };
            document.getElementById(`size${i}`).oninput = e => {
                track.size = parseInt(e.target.value);
                saveSubtitleSettings();
            };
            document.getElementById(`bgColor${i}`).oninput = e => {
                track.bgColor = e.target.value;
                saveSubtitleSettings();
            };
            document.getElementById(`bgOpacity${i}`).oninput = e => {
                track.bgOpacity = parseFloat(e.target.value);
                saveSubtitleSettings();
            };
        });

const downloadBtn = document.createElement("button");
downloadBtn.textContent = "Download";
downloadBtn.style.width = "100%";
downloadBtn.style.marginTop = "20px";

downloadBtn.onclick = () => {
    downloadSubtitleSettings(); // call function below
};

scrollArea.appendChild(downloadBtn);

        return;
    }

    // ------------------------------------------
    // CASE B — ONLY SRT EXISTS
    // ------------------------------------------
    if (subtitleSRTList.length > 0) {
        const info = document.createElement("div");
        info.textContent = "Download VTT:";
        info.style.marginBottom = "10px";
        scrollArea.appendChild(info);

        subtitleSRTList.forEach(name => {
            const clean = name.replace(/\.srt$/i, "");
            const btn = document.createElement("button");
            btn.textContent = clean;
            btn.style.width = "100%";
            btn.style.marginBottom = "10px";

            btn.onclick = async () => {
                try {
                    const res = await fetch(subtitleBasePath + name);
                    if (!res.ok) return;
                    const srtText = await res.text();

                    const vtt = convertSRTtoVTT(srtText);

                    const blob = new Blob([vtt], { type: "text/vtt" });
                    const url = URL.createObjectURL(blob);

                    const a = document.createElement("a");
                    a.href = url;
                    a.download = clean + ".vtt";
                    a.click();

                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.error("Failed to convert/download VTT:", e);
                }
            };

            scrollArea.appendChild(btn);
        });

        return;
    }

    // ------------------------------------------
    // CASE C — NO SUBTITLES
    // ------------------------------------------
    const msg = document.createElement("div");
    msg.textContent = "No subtitles found.";
    msg.style.padding = "10px 0";
    scrollArea.appendChild(msg);
}

function downloadSubtitleSettings() {

    // ⭐ Build JSON from current subtitleTracks
    const settings = {};

    subtitleTracks.forEach((track, i) => {
        settings[`subtitle${i + 1}`] = {
            color: track.color,
            size: track.size,
            bgColor: track.bgColor,
            bgOpacity: track.bgOpacity,
            fontFamily: track.fontFamily,
            visible: track.visible
        };
    });

    // ⭐ Save to Caption.json 
    saveSubtitleSettings(); // your existing function

    // ⭐ Convert to JSON text
    const json = JSON.stringify(settings, null, 2);

    // ⭐ Download file
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "Caption.json";
    a.click();

    URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------
   SRT → VTT CONVERTER
------------------------------------------------------------ */
function convertSRTtoVTT(srt) {
    let vtt = "WEBVTT\n\n";

    vtt += srt
        .replace(/\r+/g, "")
        .replace(/^\s+|\s+$/g, "")
        .replace(
            /(\d+)\n(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})/g,
            "$1\n$2.$3 --> $4.$5"
        );

    return vtt;
}

/* ------------------------------------------------------------
   FULLSCREEN
------------------------------------------------------------ */
function enterFullscreen() {
    videoContainer.style.display = "block";

    // FIX: apply fullscreen class to the CONTAINER
    videoContainer.classList.add("fs-fullscreen");

    if (videoContainer.requestFullscreen) videoContainer.requestFullscreen();
    else if (videoContainer.webkitRequestFullscreen) videoContainer.webkitRequestFullscreen();
    else if (videoContainer.msRequestFullscreen) videoContainer.msRequestFullscreen();
}

function exitFullscreen() {
    videoContainer.classList.remove("fs-fullscreen");

    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
}

document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
        // Browser exited fullscreen (Esc, UI button, gesture)
        videoContainer.classList.remove("fs-fullscreen");
    }
});

document.addEventListener("webkitfullscreenchange", () => {
    if (!document.webkitFullscreenElement) {
        videoContainer.classList.remove("fs-fullscreen");
    }
});

function togglePlay() {
    const media = getActiveMedia();
    if (!media) return;

    if (!media.src || media.src === "") return;

    if (media.paused) media.play();
    else media.pause();
}

    // ------------------------------------------------------------
    // ACTIVE MEDIA DETECTION 
    // ------------------------------------------------------------
function getActiveMedia() {
    if (video && video.src && video.src !== "" && videoContainer.style.display !== "none") {
        return video;
    }
    if (audio && audio.src && audio.src !== "") {
        return audio;
    }
    return null;
}

// --- MOBILE FOOTER + VIDEO OVERLAY + ICON SYNC ---
document.addEventListener("DOMContentLoaded", () => {

    const audio = document.getElementById("audioPlayer");
    const video = document.getElementById("videoPlayer");
    const mobileVideo = document.getElementById("mobileVideoPlayer");

    const mobileOverlay = document.querySelector(".mobile-video-overlay");
    const mobileClose = document.querySelector(".mobile-video-close");

    const playIcon = document.getElementById("playIcon");
    const pauseIcon = document.getElementById("pauseIcon");

    const mPlay = document.querySelector(".mobile-play-icon");
    const mPause = document.querySelector(".mobile-pause-icon");

    // ------------------------------------------------------------
    // MOBILE BUTTONS → DESKTOP BUTTONS
    // ------------------------------------------------------------
    const map = {
        ".mobile-prev": "#prevBtn",
        // ".mobile-play": "#playBtn",   // ❌ KEEP REMOVED
        ".mobile-next": "#nextBtn",
        ".mobile-shuffle": "#shuffleBtn",
        ".mobile-repeat": "#repeatBtn"
    };

    Object.entries(map).forEach(([mobileSel, desktopSel]) => {
        const mobileBtn = document.querySelector(mobileSel);
        const desktopBtn = document.querySelector(desktopSel);
        if (mobileBtn && desktopBtn) {
            mobileBtn.addEventListener("click", () => desktopBtn.click());
        }
    });

    // ------------------------------------------------------------
    // ICON SYNC
    // ------------------------------------------------------------
    function updateIcons() {
        const media = getActiveMedia();
        const isPlaying = media && !media.paused && !media.ended;

        playIcon.style.display = isPlaying ? "none" : "block";
        pauseIcon.style.display = isPlaying ? "block" : "none";

        mPlay.style.display = isPlaying ? "none" : "block";
        mPause.style.display = isPlaying ? "block" : "none";
    }

    [audio, video, mobileVideo].forEach(m => {
        if (!m) return;
        m.addEventListener("play", updateIcons);
        m.addEventListener("pause", updateIcons);
        m.addEventListener("ended", updateIcons);
    });

document.querySelector(".mobile-play").addEventListener("click", () => {
    togglePlay();
    updatePlayPauseIcon();
});

    // ------------------------------------------------------------
    // TIME + PROGRESS UPDATE
    // ------------------------------------------------------------
    function formatTime(sec) {
        if (!sec || isNaN(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    }

    function updateFooterFromMedia(media) {
        if (!media || !media.duration) return;

        const pct = (media.currentTime / media.duration) * 100;

        document.getElementById("progressBar").style.width = pct + "%";
        document.getElementById("currentTime").textContent = formatTime(media.currentTime);
        document.getElementById("duration").textContent = formatTime(media.duration);

        document.querySelector(".mobile-bar").style.width = pct + "%";
        document.querySelector(".mobile-current").textContent = formatTime(media.currentTime);
        document.querySelector(".mobile-duration").textContent = formatTime(media.duration);
    }

    [audio, video, mobileVideo].forEach(m => {
        if (!m) return;
        m.addEventListener("timeupdate", () => {
            updateFooterFromMedia(getActiveMedia());
        });
    });

    // ------------------------------------------------------------
    // SEEK BAR
    // ------------------------------------------------------------
    function seekMedia(e, container) {
        const media = getActiveMedia();
        if (!media || !media.duration) return;

        const rect = container.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        media.currentTime = (clickX / rect.width) * media.duration;
    }

    const desktopProgress = document.getElementById("progressContainer");
    if (desktopProgress) {
        desktopProgress.addEventListener("click", (e) => seekMedia(e, desktopProgress));
    }

    const mobileProgress = document.querySelector(".mobile-progress");
    if (mobileProgress) {
        mobileProgress.addEventListener("click", (e) => seekMedia(e, mobileProgress));
    }

    // ------------------------------------------------------------
    // MOBILE VIDEO OVERLAY CLOSE
    // ------------------------------------------------------------
    if (mobileClose) {
    mobileClose.addEventListener("click", () => {
        mobileOverlay.classList.remove("active");
        mobileVideo.pause();
        mobileVideo.src = "";

        // ⭐ Clear any active track highlight
        document.querySelectorAll(".track-row.active")
            .forEach(el => el.classList.remove("active"));

        updateIcons();
    });
}

    // ------------------------------------------------------------
    // MOBILE UI
    // ------------------------------------------------------------
    const syncUI = () => {

        document.querySelector(".mobile-band").textContent =
            document.querySelector("#bandName")?.textContent || "";

        document.querySelector(".mobile-title").textContent =
            document.querySelector("#trackTitle")?.textContent || "";

        document.querySelector(".mobile-current").textContent =
            document.querySelector("#currentTime")?.textContent || "0:00";

        document.querySelector(".mobile-duration").textContent =
            document.querySelector("#duration")?.textContent || "0:00";

        document.querySelector(".mobile-bar").style.width =
            document.querySelector("#progressBar")?.style.width || "0%";

        const desktopShuffle = document.getElementById("shuffleBtn");
        const desktopRepeat = document.getElementById("repeatBtn");

        document.querySelector(".mobile-shuffle").classList.toggle(
            "active",
            desktopShuffle.classList.contains("active")
        );

        document.querySelector(".mobile-repeat").classList.toggle(
            "active",
            desktopRepeat.classList.contains("active")
        );
    };

    setInterval(syncUI, 500);
});