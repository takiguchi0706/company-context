import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 実験的機能でパフォーマンス向上
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'react-syntax-highlighter',
      'react-markdown'
    ],
    // 部分的プリレンダリング（PPR）有効化
    ppr: true,
    // Next.js 16の新機能：React Compiler
    reactCompiler: true,
    // 静的生成の最適化
    staticGenerationAsyncStorage: true,
  },

  // 画像最適化
  images: {
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
              priority: 10,
            },
            syntax: {
              test: /[\\/]node_modules[\\/]react-syntax-highlighter[\\/]/,
              name: 'syntax-highlighter',
              chunks: 'all',
              priority: 20,
            },
            markdown: {
              test: /[\\/]node_modules[\\/](react-markdown|remark-)[\\/]/,
              name: 'markdown',
              chunks: 'all',
              priority: 15,
            },
          },
        },
        // Tree shaking強化
        usedExports: true,
        sideEffects: false,
      };
    }

    // Dynamic imports の最適化
    config.resolve.alias = {
      ...config.resolve.alias,
      // 重いライブラリを動的読み込みで最適化
      'react-syntax-highlighter/dist/esm/styles/prism': 'react-syntax-highlighter/dist/esm/styles/prism',
    };

    return config;
  },

  // コンパイル高速化
  swcMinify: true,
  
  // 静的ファイルの圧縮
  compress: true,

  // 不要なランタイムコードを削除
  poweredByHeader: false,

  // ヘッダー最適化
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // リソースヒント
          {
            key: 'Link',
            value: '</api/review>; rel=preconnect, </api/chat>; rel=preconnect'
          },
          // キャッシュ制御
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate'
          }
        ],
      },
    ];
  },

  // プリフェッチ設定
  async rewrites() {
    return [
      // API プリウォーム
      {
        source: '/api/preload/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

export default nextConfig;