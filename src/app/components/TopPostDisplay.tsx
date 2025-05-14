"use client";

import { useEffect, useState } from "react";
import { Post } from "@/types";
import PostCard from "./PostCard";

interface TopPostSectionProps {
  period: "day" | "week" | "month";
  title: string;
  onPostVoted?: () => void;
}

const TopPostSection: React.FC<TopPostSectionProps> = ({
  period,
  title,
  onPostVoted,
}) => {
  const [topPost, setTopPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopPost = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/posts/top?period=${period}`);
        if (!response.ok) {
          if (response.status === 404) {
            setTopPost(null);
          } else {
            const errorData = await response.json();
            throw new Error(
              errorData.message || `Failed to fetch top post for ${period}`
            );
          }
        } else {
          const data: Post = await response.json();
          setTopPost(data);
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred.");
        }
        console.error(`Error fetching top post for ${period}:`, err);
        setTopPost(null);
      }
      setIsLoading(false);
    };

    fetchTopPost();
  }, [period]);

  const handleVoteSuccess = (updatedPost: Post) => {
    if (topPost && updatedPost.id === topPost.id) {
      setTopPost(updatedPost);
    }
    if (onPostVoted) {
      onPostVoted();
    }
  };

  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold text-sky-400 mb-6 text-center">
        {title}
      </h2>
      {isLoading && <p className="text-center text-slate-400">Loading...</p>}
      {error && <p className="text-center text-red-500">Error: {error}</p>}
      {!isLoading && !error && !topPost && (
        <p className="text-center text-slate-500">
          No post found for this period.
        </p>
      )}
      {topPost && (
        <div className="max-w-2xl mx-auto">
          <PostCard post={topPost} onVoteSuccess={handleVoteSuccess} />
        </div>
      )}
    </div>
  );
};

interface TopPostDisplayProps {
  onPostVoted?: () => void;
}

export default function TopPostDisplay({ onPostVoted }: TopPostDisplayProps) {
  return (
    <>
      <TopPostSection
        period="day"
        title="🏆 Bullshit Post of the Day"
        onPostVoted={onPostVoted}
      />
      <TopPostSection
        period="week"
        title="🏆 Bullshit Post of the Week"
        onPostVoted={onPostVoted}
      />
      <TopPostSection
        period="month"
        title="🏆 Bullshit Post of the Month"
        onPostVoted={onPostVoted}
      />
    </>
  );
}
