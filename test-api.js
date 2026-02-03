const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const CHANNEL_ID = 'UCZf_7m96pylvgOOIDaccEnA'; // にじさんじ公式

async function checkLive() {
  try {
    // ライブ配信中の動画を探すAPIのURL
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&type=video&eventType=live&key=${API_KEY}`;
    
    const response = await axios.get(url);
    
    if (response.data.items && response.data.items.length > 0) {
      const liveVideo = response.data.items[0];
      console.log('🔴 ライブ配信中！');
      console.log('タイトル:', liveVideo.snippet.title);
      console.log('URL: https://www.youtube.com/watch?v=' + liveVideo.id.videoId);
    } else {
      console.log('⚪️ 現在、配信は行われていません。');
    }
  } catch (error) {
    // APIの制限（1日10,000ユニット）を超えた場合やエラーの表示
    console.error('エラー:', error.response ? error.response.data : error.message);
  }
}

checkLive();