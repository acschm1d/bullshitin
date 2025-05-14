import { Post, EnrichedPostPayload } from "@/types";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";

const GRAVITY_CONSTANT = 1.8;
const HOURS_OFFSET_FOR_NEW_POSTS = 2; // Prevents division by zero and softens initial decay

const DATA_DIR = path.join(process.cwd(), "data");
const POSTS_FILE_PATH = path.join(DATA_DIR, "posts.json");

let posts: Post[] = [];

async function ensureDataDirExists() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function loadPostsFromFile(): Promise<void> {
  await ensureDataDirExists();
  try {
    const fileContent = await fs.readFile(POSTS_FILE_PATH, "utf-8");
    if (fileContent) {
      posts = JSON.parse(fileContent);
      console.log("Posts loaded from file:", POSTS_FILE_PATH);
    }
  } catch (e: unknown) {
    const error = e as { code?: string; message?: string };
    if (error.code === "ENOENT") {
      console.log("posts.json not found. Initializing with empty posts array.");
      posts = [];
      await savePostsToFile();
    } else {
      console.error("Error loading posts from file:", e);
      posts = [];
    }
  }
}

async function savePostsToFile(): Promise<void> {
  await ensureDataDirExists();
  try {
    const jsonData = JSON.stringify(posts, null, 2);
    await fs.writeFile(POSTS_FILE_PATH, jsonData, "utf-8");
    console.log("Posts saved to file:", POSTS_FILE_PATH);
  } catch (error) {
    console.error("Error saving posts to file:", error);
  }
}

function calculateScore(post: Post): number {
  const now = new Date().getTime();
  const postTime = new Date(post.timestamp).getTime();
  const ageInMilliseconds = Math.max(0, now - postTime);
  const ageInHours = ageInMilliseconds / (1000 * 60 * 60);

  const denominator = Math.pow(
    ageInHours + HOURS_OFFSET_FOR_NEW_POSTS,
    GRAVITY_CONSTANT
  );

  // Handle cases where denominator might be 0 or votes are negative to prevent NaN or Infinity
  if (denominator === 0) {
    return post.votes > 0 ? Infinity : 0;
  }
  if (post.votes < 0 && denominator > 0) {
    // If votes are negative, score should also be negative or very low
    return post.votes / denominator;
  }
  if (post.votes <= 0) {
    // If votes are zero or negative with non-positive denominator (shouldn't happen with offset)
    return 0;
  }

  return post.votes / denominator;
}

(async () => {
  await loadPostsFromFile();
})();

export function getAllPostsSorted(): Post[] {
  posts.forEach((post) => (post.score = calculateScore(post)));
  return posts.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function getPostsPaginated({
  page,
  limit,
  sortBy = "score",
}: {
  page: number;
  limit: number;
  sortBy?: "score" | "latest";
}): { posts: Post[]; totalPosts: number } {
  let sortedPosts: Post[];

  if (sortBy === "latest") {
    sortedPosts = posts
      .slice()
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  } else {
    posts.forEach((post) => (post.score = calculateScore(post)));
    sortedPosts = posts.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  const offset = (page - 1) * limit;
  const paginatedPosts = sortedPosts.slice(offset, offset + limit);

  return {
    posts: paginatedPosts,
    totalPosts: sortedPosts.length,
  };
}

export function getAllPosts(): Post[] {
  return posts.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function getTopPostByPeriod(
  period: "day" | "week" | "month"
): Post | null {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "day":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 1);
      break;
    case "week":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    default:
      return null;
  }

  const postsInPeriod = posts.filter((post) => {
    const postDate = new Date(post.timestamp);
    return postDate >= startDate && postDate <= now;
  });

  if (postsInPeriod.length === 0) {
    return null;
  }

  // Sort by score descending to find the top post
  postsInPeriod.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return postsInPeriod[0];
}

export function findPostById(id: string): Post | undefined {
  return posts.find((post) => post.id === id);
}

export function findPostByUrl(url: string): Post | undefined {
  // It's assumed the URL passed here is already cleaned/canonicalized by the API layer
  return posts.find((post) => post.url === url);
}

export async function addPost(payload: EnrichedPostPayload): Promise<Post> {
  const newPost: Post = {
    id: uuidv4(),
    url: payload.url,
    language: payload.language,
    title: payload.title,
    author: payload.author,
    votes: 0,
    timestamp: new Date().toISOString(),
    score: 0,
  };
  newPost.score = calculateScore(newPost);
  posts.push(newPost);
  await savePostsToFile();
  return newPost;
}

export async function upvotePost(id: string): Promise<Post | null> {
  const post = findPostById(id);
  if (post) {
    post.votes += 1;
    post.score = calculateScore(post);
    await savePostsToFile();
    return post;
  }
  return null;
}

export async function downvotePost(id: string): Promise<Post | null> {
  const post = findPostById(id);
  if (post) {
    post.votes -= 1;
    post.score = calculateScore(post);
    await savePostsToFile();
    return post;
  }
  return null;
}
