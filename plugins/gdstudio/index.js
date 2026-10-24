const axios = require('axios');

const API_BASE = 'https://music-api.gdstudio.xyz/api.php';
const HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate',
    Referer: 'https://music.gdstudio.xyz/',
};

const http = axios.create({
    baseURL: API_BASE,
    timeout: 12000,
    headers: HEADERS,
});

/**
 * 格式化歌手字段
 * @param {Array|string} artist
 * @returns {string}
 */
function formatArtist(artist) {
    if (Array.isArray(artist)) {
        return artist.join(' / ');
    }
    if (typeof artist === 'string' && artist.trim().length > 0) {
        return artist.trim();
    }
    return '未知歌手';
}

/**
 * 封装带 503/429 频控重试的请求方法 (ES8 兼容)
 * @param {object} params 查询参数
 * @param {number} [retries=2] 重试次数
 */
async function requestWithRetry(params, retries) {
    const maxRetries = typeof retries === 'number' ? retries : 2;
    try {
        return await http.get('', { params: params });
    } catch (err) {
        const status = err.response ? err.response.status : 0;
        if (maxRetries > 0 && (status === 503 || status === 429)) {
            await new Promise(function (resolve) {
                setTimeout(resolve, 1500);
            });
            return requestWithRetry(params, maxRetries - 1);
        }
        throw err;
    }
}

/**
 * 获取当前配置的默认音源
 */
function getDefaultSource() {
    try {
        if (typeof env !== 'undefined' && env && typeof env.getUserVariables === 'function') {
            const userVars = env.getUserVariables();
            if (userVars && userVars.source && typeof userVars.source === 'string') {
                const s = userVars.source.trim().toLowerCase();
                if (s) {
                    return s;
                }
            }
        }
    } catch (e) {
        // 忽略非沙箱环境异常
    }
    return 'netease';
}

module.exports = {
    platform: 'GDStudio',
    version: '1.0.0',
    author: 'turingzy',
    description:
        '基于 GD 音乐台 (music.gdstudio.xyz) 的多源流媒体播放插件，支持高品质音源播放、歌词与专辑封面展示。遵循 CC BY-NC 4.0 协议，仅供学习研究使用。',
    supportedSearchType: ['music', 'lyric'],
    cacheControl: 'no-cache',

    userVariables: [
        {
            key: 'source',
            name: '音乐源(netease/joox/bilibili)',
            hint: '默认 netease',
        },
    ],

    /**
     * 单曲及歌词搜索
     * @param {string} query 关键词
     * @param {number} page 页码（从 1 开始）
     * @param {string} type 搜索类型 ('music' | 'lyric')
     */
    async search(query, page, type) {
        if (type !== 'music' && type !== 'lyric') {
            return { isEnd: true, data: [] };
        }

        const pageSize = 20;
        const pageNum = typeof page === 'number' && page > 0 ? page : 1;
        const source = getDefaultSource();

        try {
            const res = await requestWithRetry({
                types: 'search',
                source: source,
                name: query,
                count: pageSize,
                pages: pageNum,
            });

            const list = Array.isArray(res.data) ? res.data : [];

            const data = list.map(function (item) {
                return {
                    id: String(item.id),
                    title: item.name || '',
                    artist: formatArtist(item.artist),
                    album: item.album || '',
                    source: item.source || source,
                    pic_id: item.pic_id ? String(item.pic_id) : '',
                    lyric_id: item.lyric_id ? String(item.lyric_id) : String(item.id),
                    url_id: item.url_id ? String(item.url_id) : String(item.id),
                };
            });

            return {
                isEnd: list.length < pageSize,
                data: data,
            };
        } catch (err) {
            console.error('GDStudio 搜索失败:', err.message);
            return { isEnd: true, data: [] };
        }
    },

    /**
     * 获取播放音频流直链
     * @param {object} musicItem 歌曲对象
     * @param {string} quality 音质 ('low' | 'standard' | 'high' | 'super')
     */
    async getMediaSource(musicItem, quality) {
        if (!musicItem || !musicItem.id) {
            throw new Error('歌曲参数无效');
        }

        let br = 320;
        if (quality === 'low') {
            br = 128;
        } else if (quality === 'standard') {
            br = 320;
        } else if (quality === 'high') {
            br = 740;
        } else if (quality === 'super') {
            br = 999;
        }

        const source = musicItem.source || getDefaultSource();

        const res = await requestWithRetry({
            types: 'url',
            source: source,
            id: musicItem.id,
            br: br,
        });

        if (res.data && res.data.url) {
            return {
                url: res.data.url,
            };
        }

        throw new Error('未获取到可播放的音频链接');
    },

    /**
     * 获取歌词（含原语种与中文翻译）
     * @param {object} musicItem 歌曲对象
     */
    async getLyric(musicItem) {
        if (!musicItem || (!musicItem.id && !musicItem.lyric_id)) {
            return {};
        }

        const source = musicItem.source || getDefaultSource();
        const lyricId = musicItem.lyric_id || musicItem.id;

        try {
            const res = await requestWithRetry({
                types: 'lyric',
                source: source,
                id: lyricId,
            });

            const result = {};
            if (res.data) {
                if (typeof res.data.lyric === 'string' && res.data.lyric.trim().length > 0) {
                    result.rawLrc = res.data.lyric;
                }
                if (typeof res.data.tlyric === 'string' && res.data.tlyric.trim().length > 0) {
                    result.translation = res.data.tlyric;
                }
            }
            return result;
        } catch (err) {
            console.error('GDStudio 获取歌词失败:', err.message);
            return {};
        }
    },

    /**
     * 播放时按需获取高清专辑封面
     * @param {object} musicItem 歌曲对象
     */
    async getMusicInfo(musicItem) {
        if (!musicItem || !musicItem.pic_id) {
            return {};
        }

        const source = musicItem.source || getDefaultSource();

        try {
            const res = await requestWithRetry({
                types: 'pic',
                source: source,
                id: musicItem.pic_id,
                size: 500,
            });

            if (res.data && res.data.url) {
                return {
                    artwork: res.data.url,
                };
            }
        } catch (err) {
            console.error('GDStudio 获取封面失败:', err.message);
        }

        return {};
    },
};
