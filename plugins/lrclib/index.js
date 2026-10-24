const axios = require('axios');

const BASE_URL = 'https://lrclib.net/api';
const USER_AGENT = 'MusicFree-LRCLIB-Plugin/1.0.0 (https://github.com/turingzy/musicfree-plugins)';

const http = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'User-Agent': USER_AGENT,
    },
});

module.exports = {
    platform: 'lrclib',
    version: '1.0.0',
    author: 'turingzy',
    description: '基于开源歌词库 lrclib 的歌词搜索插件',
    supportedSearchType: ['lyric'],

    /**
     * 搜索歌词
     * @param {string} query 搜索关键词（歌曲名 / 歌手）
     * @param {number} page 页码（从 1 开始）
     * @param {string} type 搜索类型，支持 'lyric'
     */
    async search(query, page, type) {
        if (type !== 'lyric' || page > 1) {
            return { isEnd: true, data: [] };
        }

        try {
            const res = await http.get('/search', {
                params: { q: query },
            });

            const list = Array.isArray(res.data) ? res.data : [];

            const data = list.map((item) => ({
                id: String(item.id),
                title: item.trackName || item.name || '',
                artist: item.artistName || '未知歌手',
                album: item.albumName || '',
                duration: typeof item.duration === 'number' ? Math.round(item.duration) : undefined,
                rawLrc: item.syncedLyrics || item.plainLyrics || '',
                rawLrcTxt: item.plainLyrics || '',
            }));

            return {
                isEnd: true,
                data,
            };
        } catch (err) {
            console.error('LRCLIB 搜索失败:', err.message);
            return { isEnd: true, data: [] };
        }
    },

    /**
     * 获取歌词
     * @param {object} musicItem 歌曲对象
     */
    async getLyric(musicItem) {
        // 1. 若歌曲对象中已缓存了歌词（例如刚在插件内搜索出来），直接返回
        if (musicItem.rawLrc) {
            return { rawLrc: musicItem.rawLrc };
        }

        // 2. 如果带有 LRCLIB 的数字 ID，直接通过 ID 查询
        if (musicItem.id && /^\d+$/.test(String(musicItem.id))) {
            try {
                const res = await http.get(`/get/${musicItem.id}`);
                if (res.data) {
                    return {
                        rawLrc: res.data.syncedLyrics || res.data.plainLyrics || '',
                    };
                }
            } catch (e) {
                // ID 查询失败则继续走后续名称匹配逻辑
            }
        }

        const title = (musicItem.title || musicItem.name || '').trim();
        const artist = (musicItem.artist || musicItem.singer || '').trim();

        if (!title) {
            return { rawLrc: '' };
        }

        // 3. 优先尝试精准匹配 (/api/get)
        try {
            const params = {
                track_name: title,
            };
            if (artist) {
                params.artist_name = artist;
            }
            if (musicItem.album) {
                params.album_name = musicItem.album;
            }
            if (typeof musicItem.duration === 'number' && musicItem.duration > 0) {
                params.duration = Math.round(musicItem.duration);
            }

            const res = await http.get('/get', {
                params,
                validateStatus: (status) => status < 500,
            });

            if (res.status === 200 && res.data) {
                return {
                    rawLrc: res.data.syncedLyrics || res.data.plainLyrics || '',
                };
            }
        } catch (e) {
            // 继续降级到搜索
        }

        // 4. 降级：模糊搜索匹配 (/api/search)
        try {
            const q = artist ? `${title} ${artist}` : title;
            const res = await http.get('/search', {
                params: { q },
            });

            const list = Array.isArray(res.data) ? res.data : [];
            const matched = list.find((item) => item.syncedLyrics || item.plainLyrics);

            if (matched) {
                return {
                    rawLrc: matched.syncedLyrics || matched.plainLyrics || '',
                };
            }
        } catch (e) {
            console.error('LRCLIB 模糊匹配歌词失败:', e.message);
        }

        return { rawLrc: '' };
    },
};
