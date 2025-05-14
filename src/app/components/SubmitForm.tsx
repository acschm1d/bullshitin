"use client";

import { useState, FormEvent } from "react";

interface SubmitFormProps {
  onPostSubmitted?: (newPostId: string) => void;
}

export default function SubmitForm({ onPostSubmitted }: SubmitFormProps) {
  const [postUrl, setPostUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    // Basic URL validation (can be improved)
    if (!postUrl.startsWith("https://www.linkedin.com/")) {
      setMessage("Please enter a valid LinkedIn post URL.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: postUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to submit post");
      }

      setMessage("Post submitted successfully!");
      if (onPostSubmitted) {
        onPostSubmitted(result.id);
      }
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage("An unknown error occurred.");
      }
      console.error("Submission error:", error);
    }
    setPostUrl("");
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="postUrl"
          className="block text-sm font-medium text-sky-300 mb-1"
        >
          LinkedIn Post URL
        </label>
        <input
          type="url"
          name="postUrl"
          id="postUrl"
          value={postUrl}
          onChange={(e) => setPostUrl(e.target.value)}
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 placeholder-slate-400 text-sm"
          placeholder="https://www.linkedin.com/feed/update/urn:li:activity:..."
          required
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 disabled:opacity-50 transition-opacity duration-150"
        >
          {isLoading ? "Submitting..." : "Submit Bullshit"}
        </button>
      </div>
      {message && (
        <p
          className={`text-sm text-center p-3 rounded-md ${
            message.includes("valid LinkedIn")
              ? "bg-red-500/20 text-red-300"
              : "bg-green-500/20 text-green-300"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
