import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 実験的機能でパフォーマンス向上
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'react-syntax-highlighter',
      'react-markdown'
    ],
  },

  // 画像最適化（将来的に使用する可能性）
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // バンドルサイズ最適化
  webpack: (config, { dev, isServer }) => {
    // 本番環境でのバンドル最適化
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
            syntax: {
              test: /[\\/]node_modules[\\/]react-syntax-highlighter[\\/]/,
              name: 'syntax-highlighter',
              chunks: 'all',
            },
          },
        },
      };
    }
    return config;
  },

  // コンパイル高速化
  swcMinify: true,
  
  // 静的ファイルの圧縮
  compress: true,

  // 不要なランタイムコードを削除
  poweredByHeader: false,
};

export default nextConfig;