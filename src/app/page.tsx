"use client";

import Header from "./components/Header";
import SubmitForm from "./components/SubmitForm";
import PostList from "./components/PostList";
import TopPostDisplay from "./components/TopPostDisplay";
import { useState } from "react";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [newlySubmittedPostId, setNewlySubmittedPostId] = useState<
    string | null
  >(null);

  const handlePostSubmitted = (newPostId: string) => {
    setRefreshKey((prevKey) => prevKey + 1);
    setNewlySubmittedPostId(newPostId); // Store the ID of the new post
  };

  const handleVoteSuccess = () => {
    setRefreshKey((prevKey) => prevKey + 1);
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 font-[family-name:var(--font-geist-sans)]">
      <Header />
      <main className="container mx-auto px-4 py-8 flex-grow w-full max-w-4xl">
        <section
          id="submit-post"
          className="mb-12 p-6 bg-slate-800/50 rounded-xl shadow-2xl"
        >
          <h2 className="text-3xl font-bold mb-6 text-center text-sky-400">
            Spotted some BS? Share it!
          </h2>
          <SubmitForm onPostSubmitted={handlePostSubmitted} />
        </section>

        <section
          id="top-posts"
          className="mb-16 p-6 bg-slate-800/50 rounded-xl shadow-2xl"
        >
          <h2 className="text-4xl font-extrabold text-center text-sky-300 mb-10 tracking-tight">
            The Bullshit-o-Meter
          </h2>
          <TopPostDisplay
            key={`top-${refreshKey}`}
            onPostVoted={handleVoteSuccess}
          />
        </section>

        <section
          id="latest-posts"
          className="p-6 bg-slate-800/50 rounded-xl shadow-2xl"
        >
          <h2 className="text-4xl font-extrabold text-center text-sky-300 mb-10 tracking-tight">
            Vote on Recent Posts
          </h2>
          <PostList
            key={`list-${refreshKey}`}
            listKey={`list-${refreshKey}`}
            onPostVoted={handleVoteSuccess}
            newlySubmittedPostId={newlySubmittedPostId}
            onScrolledToNewPost={() => setNewlySubmittedPostId(null)}
          />
        </section>
      </main>
      <footer className="w-full text-center py-6 text-slate-500">
        <p>
          &copy; {new Date().getFullYear()} Bullshitin. All rights reserved
          (probably).
        </p>
      </footer>
    </div>
  );
}
