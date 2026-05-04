import { getDb } from "./db.js";

export interface PlaybackState {
    currentSongId: string | null;
    currentSongName: string | null;
    currentSongArtist: string | null;
    currentSongAlbum: string | null;
    currentSongCover: string | null;
    progressSeconds: number;
    queueData: string | null;
    queueIndex: number;
    playMode: string;
}

interface PlaybackRow {
    current_song_id: string | null;
    current_song_name: string | null;
    current_song_artist: string | null;
    current_song_album: string | null;
    current_song_cover: string | null;
    progress_seconds: number;
    queue_data: string | null;
    queue_index: number;
    play_mode: string;
}

export function getPlaybackState(): PlaybackState {
    const row = getDb()
        .prepare(
            `SELECT current_song_id, current_song_name, current_song_artist,
                    current_song_album, current_song_cover, progress_seconds,
                    queue_data, queue_index, play_mode
             FROM playback_state WHERE id = 1`
        )
        .get() as PlaybackRow | undefined;

    if (!row) {
        return {
            currentSongId: null,
            currentSongName: null,
            currentSongArtist: null,
            currentSongAlbum: null,
            currentSongCover: null,
            progressSeconds: 0,
            queueData: null,
            queueIndex: 0,
            playMode: "off",
        };
    }

    return {
        currentSongId: row.current_song_id,
        currentSongName: row.current_song_name,
        currentSongArtist: row.current_song_artist,
        currentSongAlbum: row.current_song_album,
        currentSongCover: row.current_song_cover,
        progressSeconds: row.progress_seconds,
        queueData: row.queue_data,
        queueIndex: row.queue_index,
        playMode: row.play_mode,
    };
}

export function updatePlaybackState(state: Partial<PlaybackState>): void {
    const current = getPlaybackState();
    const merged = { ...current, ...state };

    getDb()
        .prepare(
            `UPDATE playback_state SET
                current_song_id = ?,
                current_song_name = ?,
                current_song_artist = ?,
                current_song_album = ?,
                current_song_cover = ?,
                progress_seconds = ?,
                queue_data = ?,
                queue_index = ?,
                play_mode = ?,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = 1`
        )
        .run(
            merged.currentSongId,
            merged.currentSongName,
            merged.currentSongArtist,
            merged.currentSongAlbum,
            merged.currentSongCover,
            merged.progressSeconds,
            merged.queueData,
            merged.queueIndex,
            merged.playMode
        );
}
