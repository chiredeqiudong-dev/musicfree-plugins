const plugin = require('../plugins/musicbrainz/index.js');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('========================================');
    console.log(`正在测试插件: ${plugin.platform} v${plugin.version} by ${plugin.author}`);
    console.log('========================================\n');

    let sampleMusic = null;
    let sampleAlbum = null;
    let sampleArtist = null;

    // 1. 测试 search (单曲)
    console.log('--- 1. 测试 search(type: music) ---');
    try {
        const resMusic = await plugin.search('Hotel California', 1, 'music');
        console.log(`搜索单曲数量: ${resMusic.data.length}, isEnd: ${resMusic.isEnd}`);
        if (resMusic.data.length > 0) {
            sampleMusic = resMusic.data[0];
            console.log('首条单曲:', {
                id: sampleMusic.id,
                title: sampleMusic.title,
                artist: sampleMusic.artist,
                album: sampleMusic.album,
                duration: sampleMusic.duration,
                artwork: sampleMusic.artwork,
            });
        }
    } catch (e) {
        console.error('单曲搜索失败:', e);
    }

    await sleep(1000); // 遵从 MusicBrainz 频控

    // 2. 测试 search (专辑)
    console.log('\n--- 2. 测试 search(type: album) ---');
    try {
        const resAlbum = await plugin.search('Hotel California', 1, 'album');
        console.log(`搜索专辑数量: ${resAlbum.data.length}, isEnd: ${resAlbum.isEnd}`);
        if (resAlbum.data.length > 0) {
            sampleAlbum = resAlbum.data[0];
            console.log('首条专辑:', {
                id: sampleAlbum.id,
                title: sampleAlbum.title,
                artist: sampleAlbum.artist,
                worksNum: sampleAlbum.worksNum,
                description: sampleAlbum.description,
                artwork: sampleAlbum.artwork,
            });
        }
    } catch (e) {
        console.error('专辑搜索失败:', e);
    }

    await sleep(1000);

    // 3. 测试 search (歌手)
    console.log('\n--- 3. 测试 search(type: artist) ---');
    try {
        const resArtist = await plugin.search('Eagles', 1, 'artist');
        console.log(`搜索歌手数量: ${resArtist.data.length}, isEnd: ${resArtist.isEnd}`);
        if (resArtist.data.length > 0) {
            sampleArtist = resArtist.data[0];
            console.log('首条歌手:', {
                id: sampleArtist.id,
                name: sampleArtist.name,
                description: sampleArtist.description,
            });
        }
    } catch (e) {
        console.error('歌手搜索失败:', e);
    }

    await sleep(1000);

    // 4. 测试 getMusicInfo
    if (sampleMusic) {
        console.log('\n--- 4. 测试 getMusicInfo ---');
        try {
            const musicInfo = await plugin.getMusicInfo(sampleMusic);
            console.log('补全歌曲详情:', musicInfo);
        } catch (e) {
            console.error('getMusicInfo 失败:', e);
        }
        await sleep(1000);
    }

    // 5. 测试 getAlbumInfo
    if (sampleAlbum) {
        console.log('\n--- 5. 测试 getAlbumInfo ---');
        try {
            const albumInfo = await plugin.getAlbumInfo(sampleAlbum, 1);
            console.log(`专辑曲目数量: ${albumInfo.musicList.length}, isEnd: ${albumInfo.isEnd}`);
            console.log('补充专辑信息:', albumInfo.albumItem);
            if (albumInfo.musicList.length > 0) {
                console.log('第 1 首曲目:', albumInfo.musicList[0]);
            }
        } catch (e) {
            console.error('getAlbumInfo 失败:', e);
        }
        await sleep(1000);
    }

    // 6. 测试 getArtistWorks
    if (sampleArtist) {
        console.log('\n--- 6. 测试 getArtistWorks(type: album) ---');
        try {
            const artistAlbums = await plugin.getArtistWorks(sampleArtist, 1, 'album');
            console.log(`歌手专辑总览数量: ${artistAlbums.data.length}, isEnd: ${artistAlbums.isEnd}`);
            if (artistAlbums.data.length > 0) {
                console.log('第 1 张专辑:', artistAlbums.data[0]);
            }
        } catch (e) {
            console.error('getArtistWorks 失败:', e);
        }
    }

    console.log('\n========================================');
    console.log('MusicBrainz 插件所有测试场景运行完成！');
    console.log('========================================');
}

runTests();
