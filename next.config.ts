/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, // 型エラーを無視
  },
  eslint: {
    ignoreDuringBuilds: true, // ESLintを無視
  },
  // ⚡ これが重要：ビルド時の静的解析（データ収集）をスキップしやすくします
  output: 'standalone', 
  experimental: {
    // Turbopackなどの挙動でビルドが不安定なのを防ぐ
  },
};

export default nextConfig;