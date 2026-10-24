const plugin = require('../plugins/gdstudio/index.js');
const axios = require('axios');

async function run() {
    console.log('====================================');
    console.log('   GDStudio 音源插件全面自动化测试   ');
    console.log('====================================\n');

    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
        if (cond) {
            console.log(`  ✅ [PASS] ${msg}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${msg}`);
            failed++;
        }
    }

    // 1. 元数据校验
    console.log('1. 元数据协议规范校验');
    assert(plugin.platform === 'GDStudio', 'platform 为 GDStudio');
    assert(plugin.version === '1.0.0', 'version 为 1.0.0');
    assert(plugin.author === 'turingzy', 'author 为 turingzy');
    assert(
        Array.isArray(plugin.supportedSearchType) &&
            plugin.supportedSearchType.length === 2 &&
            plugin.supportedSearchType.includes('music') &&
            plugin.supportedSearchType.includes('lyric'),
        'supportedSearchType 包含 [music, lyric]'
    );
    assert(typeof plugin.search === 'function', '实现 search 方法');
    assert(typeof plugin.getMediaSource === 'function', '实现 getMediaSource 方法');
    assert(typeof plugin.getLyric === 'function', '实现 getLyric 方法');
    assert(typeof plugin.getMusicInfo === 'function', '实现 getMusicInfo 方法');

    // 2. 搜索测试
    console.log('\n2. search(query, page, type) 接口测试');
    let firstTrack = null;
    try {
        const searchRes = await plugin.search('Hotel California', 1, 'music');
        assert(searchRes && Array.isArray(searchRes.data), '单曲搜索返回数据包含 data 数组');
        assert(searchRes.data.length > 0, `单曲搜索结果数量大于 0 (当前: ${searchRes.data.length})`);

        firstTrack = searchRes.data[0];
        console.log('   示例单曲:', {
            id: firstTrack.id,
            title: firstTrack.title,
            artist: firstTrack.artist,
            album: firstTrack.album,
            pic_id: firstTrack.pic_id,
            lyric_id: firstTrack.lyric_id,
        });

        assert(typeof firstTrack.id === 'string' && firstTrack.id.length > 0, '单曲 id 为非空字符串');
        assert(typeof firstTrack.title === 'string' && firstTrack.title.length > 0, '单曲 title 为非空字符串');
        assert(typeof firstTrack.artist === 'string', '单曲 artist 字段正常');

        // 测试歌词搜索类型 (lyric)
        const lyricSearchRes = await plugin.search('Hotel California', 1, 'lyric');
        assert(
            lyricSearchRes && Array.isArray(lyricSearchRes.data) && lyricSearchRes.data.length > 0,
            '歌词类型 (lyric) 搜索返回有效列表'
        );

        // 测试不支持的搜索类型
        const unsupportedRes = await plugin.search('test', 1, 'sheet');
        assert(
            unsupportedRes && unsupportedRes.isEnd && unsupportedRes.data.length === 0,
            '不支持的搜索类型 (sheet) 优雅返回空'
        );
    } catch (e) {
        assert(false, `search 测试异常: ${e.message}`);
    }

    // 3. getMediaSource 音源播放测试
    console.log('\n3. getMediaSource(musicItem, quality) 播放流直链测试');
    if (firstTrack) {
        try {
            // 标准音质
            const mediaRes = await plugin.getMediaSource(firstTrack, 'standard');
            assert(
                mediaRes && typeof mediaRes.url === 'string' && mediaRes.url.startsWith('http'),
                `获取标准音质 (320k) 播放链接成功: ${mediaRes.url ? mediaRes.url.substring(0, 60) + '...' : ''}`
            );

            // 验证直链连通性 (HEAD/GET range)
            if (mediaRes && mediaRes.url) {
                const headRes = await axios.get(mediaRes.url, {
                    headers: { Range: 'bytes=0-1024' },
                    timeout: 8000,
                });
                assert(
                    headRes.status === 200 || headRes.status === 206,
                    `音频真实流可访问 (HTTP ${headRes.status}, Content-Type: ${headRes.headers['content-type']})`
                );
            }
        } catch (e) {
            assert(false, `getMediaSource 测试异常: ${e.message}`);
        }
    } else {
        console.log('   ⚠️ 跳过 getMediaSource 测试 (无有效单曲)');
    }

    // 4. getLyric 歌词与翻译测试
    console.log('\n4. getLyric(musicItem) 歌词解析测试');
    if (firstTrack) {
        try {
            const lyricRes = await plugin.getLyric(firstTrack);
            assert(
                lyricRes && typeof lyricRes.rawLrc === 'string' && lyricRes.rawLrc.length > 0,
                `成功获取原版 LRC 歌词 (长度: ${lyricRes.rawLrc ? lyricRes.rawLrc.length : 0})`
            );
            if (lyricRes.translation) {
                console.log(`   💡 包含翻译歌词 (长度: ${lyricRes.translation.length})`);
            }
        } catch (e) {
            assert(false, `getLyric 测试异常: ${e.message}`);
        }
    } else {
        console.log('   ⚠️ 跳过 getLyric 测试 (无有效单曲)');
    }

    // 5. getMusicInfo 封面图补充测试
    console.log('\n5. getMusicInfo(musicItem) 专辑封面测试');
    if (firstTrack && firstTrack.pic_id) {
        try {
            const infoRes = await plugin.getMusicInfo(firstTrack);
            assert(
                infoRes && typeof infoRes.artwork === 'string' && infoRes.artwork.startsWith('http'),
                `成功获取大图封面: ${infoRes.artwork ? infoRes.artwork.substring(0, 60) + '...' : ''}`
            );
        } catch (e) {
            assert(false, `getMusicInfo 测试异常: ${e.message}`);
        }
    } else {
        console.log('   ⚠️ 跳过 getMusicInfo 测试 (无 pic_id)');
    }

    // 总结
    console.log('\n====================================');
    console.log(`测试完成: ${passed} 项通过, ${failed} 项失败`);
    console.log('====================================');

    if (failed > 0) {
        process.exit(1);
    }
}

run().catch((err) => {
    console.error('测试运行异常:', err);
    process.exit(1);
});
