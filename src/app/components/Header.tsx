export default function Header() {
  return (
    <header className="w-full py-6 bg-slate-900/70 backdrop-blur-md shadow-lg">
      <div className="container mx-auto px-4 flex justify-between items-center max-w-4xl">
        <h1 className="text-5xl font-extrabold tracking-tight text-sky-400">
          Bullshit<span className="text-slate-100">.in</span>
        </h1>
      </div>
    </header>
  );
}
