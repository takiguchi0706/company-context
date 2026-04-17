export default function ExplainLoading() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Header skeleton */}
      <header
        className="flex-none flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
          <div className="w-24 h-6 bg-gray-200 rounded animate-pulse" />
          <div className="w-16 h-6 bg-gray-100 rounded-full animate-pulse" />
          <div className="w-20 h-6 bg-gray-100 rounded-full animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-8 bg-gray-200 rounded animate-pulse" />
          <div className="w-28 h-8 bg-gray-200 rounded animate-pulse" />
        </div>
      </header>

      {/* Main layout skeleton */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Left: Code viewer skeleton */}
        <div
          className="flex flex-col overflow-hidden border-r"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="flex-none px-4 py-2 border-b flex items-center justify-between text-xs"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
            <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
          </div>
          
          <div className="flex-1 p-4 space-y-3">
            {/* Code lines skeleton */}
            {Array.from({ length: 15 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-4 bg-gray-100 rounded text-right animate-pulse" />
                <div 
                  className={`h-4 bg-gray-200 rounded animate-pulse`}
                  style={{ width: `${Math.random() * 40 + 20}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Explanation skeleton */}
        <div className="flex flex-col overflow-hidden">
          {/* Meta info skeleton */}
          <div
            className="flex-none px-4 py-2 border-b flex items-center gap-4 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="w-12 h-4 bg-gray-200 rounded animate-pulse" />
            <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
            <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Explanation content skeleton */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Loading indicator */}
            <div className="flex items-center gap-3 py-8">
              <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <span style={{ color: "var(--muted)" }}>AIが解説を生成しています...</span>
            </div>

            {/* Content skeleton */}
            <div className="space-y-4">
              {/* Header */}
              <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              
              {/* Paragraphs */}
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6 animate-pulse"></div>
              </div>
              
              {/* Code block */}
              <div className="h-32 bg-gray-100 rounded-lg border animate-pulse"></div>
              
              {/* More paragraphs */}
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              </div>
              
              {/* List items */}
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-gray-200 rounded-full mt-2 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded flex-1 animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Question bar skeleton */}
          <div
            className="flex-none px-4 py-3 border-t"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            <div className="flex gap-2">
              <div className="flex-1 h-10 bg-gray-100 rounded-lg animate-pulse" />
              <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
            </div>
            <div className="mt-1">
              <div className="w-16 h-3 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}