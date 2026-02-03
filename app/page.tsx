'use client';

import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  // Javaの変数のようなもの。statusが変わると画面が自動で書き換わる
  const [status, setStatus] = useState('ボタンを押して確認してください');
  const [loading, setLoading] = useState(false);

  const checkLive = async () => {
    setLoading(true);
    setStatus('確認中...');
    
    try {
      // APIキーは.env.localから読み込む（Next.jsのルールでNEXT_PUBLIC_を付ける）
      const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      const CHANNEL_ID = 'UCZf_7m96pylvgOOIDaccEnA';
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&type=video&eventType=live&key=${API_KEY}`;
      
      const response = await axios.get(url);
      
      if (response.data.items && response.data.items.length > 0) {
        setStatus(`🔴 ライブ配信中！: ${response.data.items[0].snippet.title}`);
      } else {
        setStatus('⚪️ 現在、配信は行われていません。');
      }
    } catch (error) {
      setStatus('エラーが発生しました');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f0f2f5] p-24">
      <div className="z-10 w-full max-w-md items-center justify-between font-mono text-sm lg:flex flex-col bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-[#2c4391] mb-8">Niji-Watch</h1>
        
        <div className="text-lg font-medium text-gray-700 mb-8 p-4 bg-gray-50 rounded-lg w-full text-center">
          {status}
        </div>

        <button
          onClick={checkLive}
          disabled={loading}
          className="bg-[#2c4391] hover:bg-[#1e2d63] text-white font-bold py-3 px-6 rounded-full transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-gray-400"
        >
          {loading ? '通信中...' : '配信状況をチェック'}
        </button>
      </div>
    </main>
  );
}