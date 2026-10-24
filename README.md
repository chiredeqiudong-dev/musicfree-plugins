# MusicFree Plugins

常用的 MusicFree 插件开发与维护仓库。

## 插件列表

**GDStudio 音源播放插件**

- 基于 [GD 音乐台](https://music.gdstudio.xyz/) API，提供多品质在线音频流播放（128k 至 FLAC 无损），支持原版/翻译 LRC 歌词解析与专辑高清封面展示。遵循 CC BY-NC 4.0 协议，仅供学习研究使用。

**lrclib 歌词搜索插件**

- 基于开源歌词库 [lrclib](https://lrclib.net/)，提供精准匹配与模糊搜索双通道机制，支持时间轴打点滚动 LRC 歌词与纯文本歌词解析。

**MusicBrainz 音乐元数据搜索插件**

- 基于开放音乐百科 [MusicBrainz](https://musicbrainz.org/) 与 [Cover Art Archive](https://coverartarchive.org/)，提供全球录音、发行专辑与艺术家资料搜索，支持专辑完整曲目单展开及官方高清封面获取。

## 安装方式

1. **网络导入**：复制对应插件的 GitHub Raw 直链，在 MusicFree 中进入「插件管理」选择「从网络安装」。
2. **本地导入**：下载对应插件的 `index.js` 文件，在 MusicFree 中进入「插件管理」选择「从本地安装」。

## 致谢

特别鸣谢 musicfree 项目作者 [maotoumao](https://github.com/maotoumao)

- [musicfree](https://github.com/maotoumao/musicfree) - 插件化、定制化音乐播放器
- [musicfree-skills](https://github.com/maotoumao/musicfree-skills) - MusicFree 插件与主题包开发规范技能库
