const axios = require('axios');

const BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'MusicFree-MusicBrainz-Plugin/1.0.0 (https://github.com/turingzy/musicfree-plugins)';
const PAGE_SIZE = 20;

const http = axios.create({
    baseURL: BASE_URL,
    timeout: 12000,
    headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
    },
});

/**
 * 封装带 503/429 频控退避重试的请求方法 (兼容 ES8)
 */
async function requestWithRetry(url, config, retries) {
    const maxRetries = typeof retries === 'number' ? retries : 2;
    try {
        return await http.get(url, config);
    } catch (err) {
        const status = err.response ? err.response.status : 0;
        if (maxRetries > 0 && (status === 503 || status === 429)) {
            // 等待 1.2 秒后重试
            await new Promise(function (resolve) {
                setTimeout(resolve, 1200);
            });
            return requestWithRetry(url, config, maxRetries - 1);
        }
        throw err;
    }
}

/**
 * 辅助函数：安全提取艺术家名称
 */
function extractArtistName(creditList) {
    if (!Array.isArray(creditList) || creditList.length === 0) {
        return '未知歌手';
    }
    return creditList
        .map(function (item) {
            return item.name || (item.artist && item.artist.name) || '';
        })
        .filter(Boolean)
        .join(' / ');
}

/**
 * 辅助函数：生成 Cover Art Archive 封面链接
 */
function getCoverUrl(releaseId) {
    if (!releaseId) {
        return undefined;
    }
    return 'https://coverartarchive.org/release/' + releaseId + '/front-500';
}

module.exports = {
    platform: 'MusicBrainz',
    version: '1.0.0',
    author: 'turingzy',
    description: '基于 MusicBrainz 全球开放音乐数据库的元数据检索插件',
    supportedSearchType: ['music', 'album', 'artist'],

    /**
     * 搜索方法
     * @param {string} query 搜索词
     * @param {number} page 页码（从 1 开始）
     * @param {string} type 搜索类型：'music' | 'album' | 'artist'
     */
    async search(query, page, type) {
        const offset = Math.max(0, (page - 1) * PAGE_SIZE);

        if (type === 'music') {
            try {
                const res = await requestWithRetry('/recording', {
                    params: {
                        query: query,
                        fmt: 'json',
                        limit: PAGE_SIZE,
                        offset: offset,
                    },
                });

                const count = res.data && typeof res.data.count === 'number' ? res.data.count : 0;
                const recordings = res.data && Array.isArray(res.data.recordings) ? res.data.recordings : [];

                const data = recordings.map(function (rec) {
                    const firstRelease = rec.releases && rec.releases[0];
                    const releaseId = firstRelease ? firstRelease.id : undefined;
                    const durationSec = typeof rec.length === 'number' && rec.length > 0 ? Math.round(rec.length / 1000) : undefined;

                    return {
                        id: String(rec.id),
                        title: rec.title || '',
                        artist: extractArtistName(rec['artist-credit']),
                        album: firstRelease ? firstRelease.title : '',
                        duration: durationSec,
                        artwork: getCoverUrl(releaseId),
                        releaseId: releaseId,
                    };
                });

                return {
                    isEnd: offset + recordings.length >= count || recordings.length === 0,
                    data: data,
                };
            } catch (err) {
                console.error('MusicBrainz 单曲搜索失败:', err.message);
                return { isEnd: true, data: [] };
            }
        }

        if (type === 'album') {
            try {
                const res = await requestWithRetry('/release', {
                    params: {
                        query: query,
                        fmt: 'json',
                        limit: PAGE_SIZE,
                        offset: offset,
                    },
                });

                const count = res.data && typeof res.data.count === 'number' ? res.data.count : 0;
                const releases = res.data && Array.isArray(res.data.releases) ? res.data.releases : [];

                const data = releases.map(function (rel) {
                    const descList = [];
                    if (rel.date) descList.push('发行日期: ' + rel.date);
                    if (rel.country) descList.push('国家/地区: ' + rel.country);
                    if (rel.disambiguation) descList.push(rel.disambiguation);

                    return {
                        id: String(rel.id),
                        title: rel.title || '',
                        artist: extractArtistName(rel['artist-credit']),
                        artwork: getCoverUrl(rel.id),
                        worksNum: typeof rel['track-count'] === 'number' ? rel['track-count'] : undefined,
                        description: descList.join(' | '),
                    };
                });

                return {
                    isEnd: offset + releases.length >= count || releases.length === 0,
                    data: data,
                };
            } catch (err) {
                console.error('MusicBrainz 专辑搜索失败:', err.message);
                return { isEnd: true, data: [] };
            }
        }

        if (type === 'artist') {
            try {
                const res = await requestWithRetry('/artist', {
                    params: {
                        query: query,
                        fmt: 'json',
                        limit: PAGE_SIZE,
                        offset: offset,
                    },
                });

                const count = res.data && typeof res.data.count === 'number' ? res.data.count : 0;
                const artists = res.data && Array.isArray(res.data.artists) ? res.data.artists : [];

                const data = artists.map(function (art) {
                    const descList = [];
                    if (art.type) descList.push('类型: ' + art.type);
                    if (art.country) descList.push('国家: ' + art.country);
                    if (art.disambiguation) descList.push(art.disambiguation);

                    return {
                        id: String(art.id),
                        name: art.name || '',
                        description: descList.join(' | '),
                    };
                });

                return {
                    isEnd: offset + artists.length >= count || artists.length === 0,
                    data: data,
                };
            } catch (err) {
                console.error('MusicBrainz 歌手搜索失败:', err.message);
                return { isEnd: true, data: [] };
            }
        }

        return { isEnd: true, data: [] };
    },

    /**
     * 获取歌曲详情（播放时补全封面、时长、专辑等）
     * @param {object} musicItem 歌曲对象
     */
    async getMusicInfo(musicItem) {
        if (!musicItem || !musicItem.id) {
            return {};
        }

        try {
            const res = await requestWithRetry('/recording/' + musicItem.id, {
                params: {
                    inc: 'artists+releases',
                    fmt: 'json',
                },
            });

            const data = res.data;
            if (!data) return {};

            const firstRelease = data.releases && data.releases[0];
            const releaseId = firstRelease ? firstRelease.id : undefined;
            const durationSec = typeof data.length === 'number' && data.length > 0 ? Math.round(data.length / 1000) : undefined;

            const partial = {};
            if (firstRelease && firstRelease.title) {
                partial.album = firstRelease.title;
            }
            if (releaseId) {
                partial.artwork = getCoverUrl(releaseId);
            }
            if (durationSec) {
                partial.duration = durationSec;
            }
            const artistName = extractArtistName(data['artist-credit']);
            if (artistName && artistName !== '未知歌手') {
                partial.artist = artistName;
            }

            return partial;
        } catch (err) {
            console.error('MusicBrainz 获取歌曲详情失败:', err.message);
            return {};
        }
    },

    /**
     * 获取专辑详情（曲目列表及补充信息）
     * @param {object} albumItem 专辑对象
     * @param {number} page 页码
     */
    async getAlbumInfo(albumItem, page) {
        if (!albumItem || !albumItem.id || page > 1) {
            return { isEnd: true, musicList: [] };
        }

        try {
            const res = await requestWithRetry('/release/' + albumItem.id, {
                params: {
                    inc: 'recordings+artists',
                    fmt: 'json',
                },
            });

            const data = res.data;
            if (!data) {
                return { isEnd: true, musicList: [] };
            }

            const mediaList = Array.isArray(data.media) ? data.media : [];
            const musicList = [];
            const defaultArtist = extractArtistName(data['artist-credit']) || albumItem.artist || '未知歌手';
            const albumArtwork = getCoverUrl(albumItem.id);

            for (let m = 0; m < mediaList.length; m++) {
                const tracks = Array.isArray(mediaList[m].tracks) ? mediaList[m].tracks : [];
                for (let t = 0; t < tracks.length; t++) {
                    const track = tracks[t];
                    const recording = track.recording;
                    const trackId = recording && recording.id ? recording.id : track.id || String(m + 1) + '-' + String(t + 1);
                    const trackDuration = typeof track.length === 'number' && track.length > 0 ? Math.round(track.length / 1000) : undefined;
                    const trackArtist = extractArtistName(track['artist-credit']) || defaultArtist;

                    musicList.push({
                        id: String(trackId),
                        title: track.title || (recording && recording.title) || '未知曲目',
                        artist: trackArtist,
                        album: data.title || albumItem.title || '',
                        duration: trackDuration,
                        artwork: albumArtwork,
                    });
                }
            }

            const result = {
                isEnd: true,
                musicList: musicList,
            };

            if (page === 1) {
                const descList = [];
                if (data.date) descList.push('发行日期: ' + data.date);
                if (data.country) descList.push('国家/地区: ' + data.country);
                if (data.barcode) descList.push('条形码: ' + data.barcode);
                if (data.disambiguation) descList.push(data.disambiguation);

                result.albumItem = {
                    title: data.title || albumItem.title,
                    artist: defaultArtist,
                    artwork: albumArtwork,
                    description: descList.join(' | '),
                };
            }

            return result;
        } catch (err) {
            console.error('MusicBrainz 获取专辑详情失败:', err.message);
            return { isEnd: true, musicList: [] };
        }
    },

    /**
     * 获取歌手作品（单曲或专辑列表）
     * @param {object} artistItem 歌手对象
     * @param {number} page 页码
     * @param {string} type 作品类型：'music' | 'album'
     */
    async getArtistWorks(artistItem, page, type) {
        if (!artistItem || !artistItem.id) {
            return { isEnd: true, data: [] };
        }

        const offset = Math.max(0, (page - 1) * PAGE_SIZE);

        if (type === 'music') {
            try {
                const res = await requestWithRetry('/recording', {
                    params: {
                        query: 'arid:' + artistItem.id,
                        fmt: 'json',
                        limit: PAGE_SIZE,
                        offset: offset,
                    },
                });

                const count = res.data && typeof res.data.count === 'number' ? res.data.count : 0;
                const recordings = res.data && Array.isArray(res.data.recordings) ? res.data.recordings : [];

                const data = recordings.map(function (rec) {
                    const firstRelease = rec.releases && rec.releases[0];
                    const releaseId = firstRelease ? firstRelease.id : undefined;
                    const durationSec = typeof rec.length === 'number' && rec.length > 0 ? Math.round(rec.length / 1000) : undefined;

                    return {
                        id: String(rec.id),
                        title: rec.title || '',
                        artist: extractArtistName(rec['artist-credit']) || artistItem.name || '未知歌手',
                        album: firstRelease ? firstRelease.title : '',
                        duration: durationSec,
                        artwork: getCoverUrl(releaseId),
                    };
                });

                return {
                    isEnd: offset + recordings.length >= count || recordings.length === 0,
                    data: data,
                };
            } catch (err) {
                console.error('MusicBrainz 获取歌手单曲失败:', err.message);
                return { isEnd: true, data: [] };
            }
        }

        if (type === 'album') {
            try {
                const res = await requestWithRetry('/release', {
                    params: {
                        query: 'arid:' + artistItem.id,
                        fmt: 'json',
                        limit: PAGE_SIZE,
                        offset: offset,
                    },
                });

                const count = res.data && typeof res.data.count === 'number' ? res.data.count : 0;
                const releases = res.data && Array.isArray(res.data.releases) ? res.data.releases : [];

                const data = releases.map(function (rel) {
                    return {
                        id: String(rel.id),
                        title: rel.title || '',
                        artist: extractArtistName(rel['artist-credit']) || artistItem.name || '未知歌手',
                        artwork: getCoverUrl(rel.id),
                        worksNum: typeof rel['track-count'] === 'number' ? rel['track-count'] : undefined,
                        description: rel.date ? '发行日期: ' + rel.date : '',
                    };
                });

                return {
                    isEnd: offset + releases.length >= count || releases.length === 0,
                    data: data,
                };
            } catch (err) {
                console.error('MusicBrainz 获取歌手专辑失败:', err.message);
                return { isEnd: true, data: [] };
            }
        }

        return { isEnd: true, data: [] };
    },
};
