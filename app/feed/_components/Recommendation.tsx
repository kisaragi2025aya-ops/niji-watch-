"use client";

import { useState, useEffect } from "react";

export default function Recommendation() {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [hasPreferences, setHasPreferences] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // 1. タグ一覧を取得
        const tagRes = await fetch('/api/recommend/tags');
        const tagData = await tagRes.json();
        setTags(tagData.tags);

        // 2. ユーザーの設定を取得
        const prefRes = await fetch('/api/user/preferences');
        if (prefRes.ok) {
          const prefData = await prefRes.json();

          if (prefData && prefData.lastSurveyAt) {
            const lastSurvey = new Date(prefData.lastSurveyAt);
            const today = new Date();

            // 毎日アンケートを出すための判定
            const isSameDay =
              lastSurvey.getFullYear() === today.getFullYear() &&
              lastSurvey.getMonth() === today.getMonth() &&
              lastSurvey.getDate() === today.getDate();

            if (isSameDay) {
              setSelectedTags(prefData.interests || []);
              setHasPreferences(true);
              fetchVideos(); // すでに回答済みなら動画を取得
              return;
            }
          }
          setHasPreferences(false);
        }
      } catch (e) {
        console.error("初期化失敗", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchVideos = async () => {
    setIsSearching(true);
    try {
      const videoRes = await fetch('/api/recommend/videos');
      const videoData = await videoRes.json();
      setGenres(videoData.genres || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // 動画クリック時の処理
  const handleVideoClick = async (video: any, clickedTag: string) => {
    // videos APIから来た video.id は文字列、search APIから来た場合は id.videoId
    const videoId = typeof video.id === 'string' ? video.id : video.id?.videoId;
    if (!videoId) return;

    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    // 3. 表示されているすべてのジャンルをリスト化（減点計算用）
    const allDisplayedTags = genres.flatMap(g =>
      Array(g.items.length).fill(g.genre)
    );

    try {
      // 4. スコア更新APIを叩く
      await fetch('/api/recommend/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clickedTag, allDisplayedTags }),
      });
    } catch (e) {
      console.error("スコア更新失敗", e);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const savePreferences = async () => {
    setIsSearching(true);
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: selectedTags }),
      });
      if (res.ok) {
        setHasPreferences(true);
        fetchVideos();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <p className="text-zinc-500 animate-pulse">分析中...</p>
      </div>
    );
  }

  return (
    <section className="space-y-12">
      {!hasPreferences ? (
        <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-700 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-2 text-center">今の気分は？</h2>
          <p className="text-zinc-400 text-sm text-center mb-8">興味のあるタグを選んでください。</p>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${selectedTags.includes(tag)
                    ? "bg-blue-600 text-white scale-105"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
              >
                #{tag}
              </button>
            ))}
          </div>
          <button
            onClick={savePreferences}
            disabled={selectedTags.length === 0 || isSearching}
            className="w-full py-4 bg-white text-black font-black rounded-xl disabled:opacity-20 transition-all active:scale-95"
          >
            {isSearching ? "検索中..." : "おすすめ動画を生成"}
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {genres.length === 0 && isSearching ? (
            <div className="text-center text-zinc-500">動画を探しています...</div>
          ) : (
            genres.map((section) => (
              <div key={section.genre} className="space-y-4">
                <h2 className="text-lg font-bold text-white border-l-4 border-blue-600 pl-3">
                  #{section.genre} のおすすめ
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {section.items.map((video: any) => (
                    <div
                      key={video.id + section.genre}
                      onClick={() => handleVideoClick(video, section.genre)}
                      className="group cursor-pointer space-y-2"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-800">
                        <img src={video.thumbnail} className="object-cover w-full h-full group-hover:scale-110 transition duration-500" />
                      </div>
                      <h3 className="text-sm font-bold text-white line-clamp-2" dangerouslySetInnerHTML={{ __html: video.title }} />
                      <p className="text-xs text-zinc-500">{video.channelTitle}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          <div className="flex justify-center pb-10">
            <button
              onClick={() => setHasPreferences(false)}
              className="px-6 py-2 bg-zinc-800 text-zinc-400 rounded-full text-xs hover:text-white transition-colors border border-zinc-700"
            >
              好みを再設定する
            </button>
          </div>
        </div>
      )}
    </section>
  );
}