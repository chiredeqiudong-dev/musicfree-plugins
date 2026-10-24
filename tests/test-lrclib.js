const plugin = require('../plugins/lrclib/index.js');

async function runTests() {
    console.log('========================================');
    console.log(`正在测试插件: ${plugin.platform} v${plugin.version} by ${plugin.author}`);
    console.log('========================================\n');

    // 1. 测试 search (仅 lyric 类型)
    console.log('--- 1. 测试 search(type: lyric) 方法 ---');
    try {
        const query = 'Hotel California';
        const resultLyric = await plugin.search(query, 1, 'lyric');
        console.log(`搜索歌词类型(MusicFree 专有) "${query}" 数量: ${resultLyric.data?.length || 0}`);

        if (resultLyric.data && resultLyric.data.length > 0) {
            const first = resultLyric.data[0];
            console.log('首条歌词项详情:', {
                id: first.id,
                title: first.title,
                artist: first.artist,
                album: first.album,
                duration: first.duration,
                hasLrc: !!first.rawLrc,
                hasRawLrcTxt: !!first.rawLrcTxt,
            });

            // 2. 测试 getLyric (利用已有 rawLrc 的缓存)
            console.log('\n--- 2. 测试 getLyric (来自搜索结果的已缓存歌词) ---');
            const lyricCached = await plugin.getLyric(first);
            console.log('获取成功, 歌词字符数:', lyricCached.rawLrc?.length || 0);
            console.log('歌词片段预览:\n' + lyricCached.rawLrc.split('\n').slice(0, 3).join('\n'));
        }
    } catch (e) {
        console.error('search 测试失败:', e);
    }

    // 3. 测试 getLyric (外部歌曲精确匹配: title + artist)
    console.log('\n--- 3. 测试 getLyric (外部歌曲精准匹配: title + artist) ---');
    try {
        const externalMusic = {
            title: 'Hotel California',
            artist: 'Eagles',
            duration: 391,
        };
        const lyricExact = await plugin.getLyric(externalMusic);
        console.log('精确匹配成功, 歌词字符数:', lyricExact.rawLrc?.length || 0);
        console.log('歌词片段预览:\n' + lyricExact.rawLrc.split('\n').slice(0, 3).join('\n'));
    } catch (e) {
        console.error('精确匹配测试失败:', e);
    }

    // 4. 测试 getLyric (仅有 title 时的模糊降级匹配)
    console.log('\n--- 4. 测试 getLyric (仅有歌曲名的模糊匹配降级) ---');
    try {
        const titleOnly = {
            title: 'Bohemian Rhapsody',
        };
        const lyricFuzzy = await plugin.getLyric(titleOnly);
        console.log('模糊匹配成功, 歌词字符数:', lyricFuzzy.rawLrc?.length || 0);
        console.log('歌词片段预览:\n' + lyricFuzzy.rawLrc.split('\n').slice(0, 3).join('\n'));
    } catch (e) {
        console.error('模糊匹配测试失败:', e);
    }

    // 5. 测试 getLyric (不存在的歌曲)
    console.log('\n--- 5. 测试 getLyric (查不到的异常歌曲) ---');
    try {
        const notFound = {
            title: 'NonExistentTitleX999Y888Z777',
            artist: 'NoSuchArtistEver',
        };
        const emptyLyric = await plugin.getLyric(notFound);
        console.log('未命中时安全返回空歌词:', emptyLyric.rawLrc === '');
    } catch (e) {
        console.error('异常歌曲测试失败:', e);
    }

    console.log('\n========================================');
    console.log('lrclib 插件所有测试场景运行完成！');
    console.log('========================================');
}

runTests();
