export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Niji-Watch: 開発1日目
        </p>
      </div>

      <div className="flex flex-col items-center mt-20">
        <h1 className="text-5xl font-extrabold text-[#2c4391] mb-8">
          Niji-Watch
        </h1>
        <p className="text-xl text-gray-700 text-center max-w-md">
          YouTube Data APIを活用した、<br />
          にじさんじファンのための配信管理アプリ
        </p>
        
        <div className="mt-12 p-6 bg-white rounded-2xl shadow-xl border border-blue-100">
          <p className="text-blue-600 font-semibold">
            Status: プロトタイプ構築中...
          </p>
        </div>
      </div>

      <footer className="mt-auto text-gray-400 text-sm">
        &copy; 2026 27卒就活プロジェクト - ANYCOLOR志望
      </footer>
    </main>
  );
}