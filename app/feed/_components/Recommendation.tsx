"use client";

import { useState, useEffect, useCallback } from "react";

export default function Recommendation() {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [mode, setMode] = useState<"survey" | "recommend">("survey");

  const init = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recommend/videos');
      const data = await res.json();
      if (data.mode === "survey") {
        setTags(data.tags || []);
        setMode("survey");
      } else {
        setGenres(data.genres || []);
        setMode("recommend");
      }
    } catch (e) {
      console.error("Initialization failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : prev.length < 5 ? [...prev, tag] : prev
    );
  };

  const saveAndFetch = async () => {
    if (selectedTags.length === 0) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/recommend/videos?tags=${encodeURIComponent(selectedTags.join(","))}`);
      const data = await res.json();
      setGenres(data.genres || []);
      setMode("recommend");
    } catch (e) {
      console.error("Save preferences failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleVideoClick = (video: any) => {
    const videoId = video.id;
    if (!videoId) return;
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
        <p className="text-zinc-500 text-sm">読み込み中...</p>
      </div>
    );
  }

  return (
    <section className="min-h-[400px]">
      {mode === "survey" ? (
        <div className="bg-zinc-900 p-10 rounded-2xl border border-zinc-800">
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-white mb-6 text-center tracking-tight">
              WHAT'S YOUR MOOD?
            </h2>
            <div className="flex flex-wrap justify-center gap-3 mb-10 max-w-2xl mx-auto">
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    selectedTags.includes(tag)
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
            <button
              onClick={saveAndFetch}
              disabled={selectedTags.length === 0 || isSearching}
              className="w-full max-w-sm mx-auto flex items-center justify-center py-4 bg-white text-black font-black rounded-2xl disabled:opacity-20"
            >
              {isSearching ? "作成中..." : `おすすめを表示する (${selectedTags.length}/5)`}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {genres.map((section) => (
            <div key={section.genre} className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <div className="w-1 h-6 bg-blue-500 rounded-full" />
                <h2 className="text-xl font-black text-white uppercase">
                  {section.genre}
                </h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {section.items.map((video: any) => (
                  <div
                    key={video.id + section.genre}
                    onClick={() => handleVideoClick(video)}
                    className="cursor-pointer"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-900">
                      <img
                        src={video.thumbnail}
                        alt=""
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div className="mt-3 px-1">
                      <h3
                        className="text-sm font-bold text-zinc-200 line-clamp-2 leading-snug"
                        dangerouslySetInnerHTML={{ __html: video.title }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-center pt-10 pb-20">
            <button
              onClick={() => {
                setMode("survey");
                init();
              }}
              className="text-zinc-600 text-xs font-bold hover:text-zinc-400"
            >
              やり直す
            </button>
          </div>
        </div>
      )}
    </section>
  );
}