import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 実験的機能でパフォーマンス向上
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'react-syntax-highlighter',
      'react-markdown',
      'remark-gfm'
    ],
    // 部分的プリレンダリング（PPR）有効化
    ppr: true,
    // Next.js 16の新機能：React Compiler
    reactCompiler: true,
    // 静的生成の最適化
    staticGenerationAsyncStorage: true,
    // Turbopack (dev) の有効化
    turbo: {
      resolveAlias: {
        // 軽量版ライブラリのエイリアス
        'react-syntax-highlighter': 'react-syntax-highlighter/dist/esm/light',
      },
    },
  },

  // 画像最適化
  images: {
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // バンドルサイズ最適化
  webpack: (config, { dev, isServer, buildId }) => {
    // 本番環境でのバンドル最適化
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            // 基本的なReactライブラリ
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 40,
            },
            // Next.jsのコアモジュール
            nextjs: {
              test: /[\\/]node_modules[\\/]next[\\/]/,
              name: 'nextjs',
              chunks: 'all',
              priority: 35,
            },
            // UI関連ライブラリ
            ui: {
              test: /[\\/]node_modules[\\/](lucide-react|clsx|tailwind-merge)[\\/]/,
              name: 'ui-libs',
              chunks: 'all',
              priority: 30,
            },
            // 重いコードエディタ関連
            syntax: {
              test: /[\\/]node_modules[\\/]react-syntax-highlighter[\\/]/,
              name: 'syntax-highlighter',
              chunks: 'async', // 遅延読み込み
              priority: 20,
            },
            // Markdown関連
            markdown: {
              test: /[\\/]node_modules[\\/](react-markdown|remark-|unified|micromark)[\\/]/,
              name: 'markdown',
              chunks: 'async', // 遅延読み込み
              priority: 15,
            },
            // その他のvendor
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
        // Tree shaking強化
        usedExports: true,
        sideEffects: false,
        // 実行時最適化
        runtimeChunk: 'single',
      };

      // Production-only optimizations
      config.resolve.alias = {
        ...config.resolve.alias,
        // Syntax highlighterの軽量版を優先
        'react-syntax-highlighter': 'react-syntax-highlighter/dist/esm/light-async',
        // Markdown処理の最適化
        'remark-gfm': 'remark-gfm/lib/index.js',
      };

      // Bundle analysis in CI/CD
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: './analyze/client.html',
          })
        );
      }
    }

    // Development optimizations
    if (dev) {
      // 開発時のHot Reload最適化
      config.watchOptions = {
        poll: false,
        ignored: /node_modules/,
      };
    }

    // Universal optimizations
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

  // コンパイル高速化
  swcMinify: true,
  
  // 静的ファイルの圧縮
  compress: true,

  // 不要なランタイムコードを削除
  poweredByHeader: false,

  // ESLint設定の最適化
  eslint: {
    ignoreDuringBuilds: true, // ビルド時間短縮（CI/CDでチェック）
  },

  // TypeScript設定の最適化
  typescript: {
    tsconfigPath: './tsconfig.json',
  },

  // ヘッダー最適化
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // リソースヒント
          {
            key: 'Link',
            value: [
              '</api/review>; rel=preconnect',
              '</api/chat>; rel=preconnect',
              '</api/github>; rel=preconnect',
              '<https://fonts.googleapis.com>; rel=preconnect',
              '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
            ].join(', ')
          },
          // セキュリティヘッダー
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // パフォーマンスヒント
          {
            key: 'X-Robots-Tag',
            value: 'index, follow'
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ],
      },
      {
        source: '/api/github',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=60'
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

  // Rewrite rules for optimization
  async rewrites() {
    return [
      // API プリウォーム
      {
        source: '/api/preload/:path*',
        destination: '/api/:path*',
      },
    ];
  },

  // Redirects for performance
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },

  // Output configuration
  output: 'standalone',
  
  // Logging configuration
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },

  // DevIndicators optimization
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },
};

export default nextConfig;