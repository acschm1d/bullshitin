import { NextRequest, NextResponse } from "next/server";
import { NewPostPayload, EnrichedPostPayload } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import * as cheerio from "cheerio";
import { francAll } from "franc";
import ISO6391 from "iso-639-1";
import { iso6393To1 } from "iso-639-3/iso6393-to-1";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
    return NextResponse.json(
      { message: "Invalid page or limit parameter" },
      { status: 400 }
    );
  }

  try {
    const {
      data: posts,
      error,
      count,
    } = await supabase
      .from("posts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error("Error fetching posts:", error);
      return NextResponse.json(
        { message: "Error fetching posts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      posts: posts || [],
      totalPosts: count || 0,
      page,
      limit,
    });
  } catch (e) {
    console.error("Unexpected error fetching posts:", e);
    return NextResponse.json(
      { message: "Unexpected error fetching posts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NewPostPayload;
    const { url: initialUrl } = body;

    if (!initialUrl) {
      return NextResponse.json(
        { message: "Missing required field: url" },
        { status: 400 }
      );
    }

    const originalUrlFromUser = body.url;
    let processedUrl = originalUrlFromUser.split("?")[0];

    if (processedUrl.endsWith("/") && processedUrl.length > 1) {
      processedUrl = processedUrl.slice(0, -1);
    }

    let cleanedUrl = processedUrl;

    try {
      const parsedUrl = new URL(processedUrl);
      const hostname = parsedUrl.hostname.toLowerCase();
      const pathname = parsedUrl.pathname;
      cleanedUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${pathname}`;

      if (hostname !== "www.linkedin.com" && hostname !== "linkedin.com") {
        return NextResponse.json(
          {
            message:
              "Invalid URL: Hostname must be linkedin.com or www.linkedin.com.",
          },
          { status: 400 }
        );
      }

      const linkedInPostPatterns = [
        /^\/feed\/update\/.+$/,
        /^\/posts\/.+$/,
        /^\/pulse\/.+$/,
        /^\/embed\/feed\/update\/.+$/,
      ];
      const isValidPath = linkedInPostPatterns.some((pattern) =>
        pattern.test(pathname)
      );
      if (!isValidPath) {
        return NextResponse.json(
          {
            message:
              "Invalid LinkedIn post URL format. Please provide a direct link to a LinkedIn post or article.",
          },
          { status: 400 }
        );
      }
    } catch (e) {
      console.error("Error parsing or validating URL:", e);
      return NextResponse.json(
        {
          message:
            "Invalid URL provided. Please ensure it is a complete and valid web address.",
        },
        { status: 400 }
      );
    }

    const { data: existingPostData, error: fetchExistingError } = await supabase
      .from("posts")
      .select("id, url")
      .eq("url", cleanedUrl)
      .maybeSingle();

    if (fetchExistingError) {
      console.error(
        `Error checking for existing post with URL ${cleanedUrl}:`,
        fetchExistingError
      );
      return NextResponse.json(
        { message: "Error checking for existing post" },
        { status: 500 }
      );
    }

    if (existingPostData) {
      return NextResponse.json(
        {
          message: "This post has already been submitted.",
          existingPostId: existingPostData.id,
        },
        { status: 409 }
      );
    }

    let fetchedTitle: string | undefined;
    let scrapedMainContentForDetection: string | undefined;
    let detectedLanguage: string | undefined = "en";

    if (body.title === undefined) {
      try {
        const metadataResponse = await fetch(cleanedUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "follow",
        });

        if (metadataResponse.ok) {
          const html = await metadataResponse.text();
          const $ = cheerio.load(html);
          let tempTitle =
            $('meta[property="og:title"]').attr("content")?.trim() ||
            $("title").text()?.trim();

          if (tempTitle && tempTitle.includes(" | LinkedIn")) {
            tempTitle = tempTitle
              .substring(0, tempTitle.lastIndexOf(" | LinkedIn"))
              .trim();
          }
          if (tempTitle && tempTitle.includes(": ")) {
            const parts = tempTitle.split(": ");
            const potentialAuthorCandidate = parts[0];
            const nameParts = potentialAuthorCandidate.split(" ");
            if (
              nameParts.length >= 1 &&
              nameParts.length <= 5 &&
              nameParts.every(
                (p) => p.length > 0 && p[0] === p[0].toUpperCase()
              )
            ) {
              tempTitle = parts.slice(1).join(": ").trim();
            }
          }
          if (tempTitle) {
            tempTitle = tempTitle
              .replace(/\s*\|\s*[^|]+\s*\|\s*\d+\s*comments\s*$/i, "")
              .trim();
          }
          fetchedTitle = tempTitle;

          const mainContentElements = $(
            ".attributed-text-segment-list__content"
          );
          if (mainContentElements.length > 0) {
            scrapedMainContentForDetection = mainContentElements
              .map((i, el) => $(el).text())
              .get()
              .join(" \n\n ")
              .trim();
          }
        } else {
          console.warn(
            `Failed to fetch metadata from ${cleanedUrl}. Status: ${metadataResponse.status}`
          );
        }
      } catch (metaError) {
        console.error(`Error fetching metadata for ${cleanedUrl}:`, metaError);
      }
    }

    const textToDetect = scrapedMainContentForDetection || fetchedTitle || "";
    if (textToDetect) {
      const detections = francAll(textToDetect, { minLength: 3 });
      if (detections && detections.length > 0 && detections[0][0] !== "und") {
        const langCode3 = detections[0][0];
        const langCode2 = iso6393To1[langCode3] || ISO6391.getCode(langCode3);
        if (langCode2) {
          detectedLanguage = langCode2;
        } else {
          console.warn(
            `Could not map detected language code ${langCode3} to a 2-letter code. Defaulting to 'en'.`
          );
        }
      } else {
        console.warn(
          `Language detection yielded no conclusive results for text (first 100 chars): "${textToDetect.substring(
            0,
            100
          )}...". Defaulting to 'en'.`
        );
      }
    } else {
      console.warn(
        "No text available for language detection. Defaulting to 'en'."
      );
    }

    const finalTitle = body.title ?? fetchedTitle ?? "Untitled";
    const finalLanguage = detectedLanguage;

    const newPostForDb: Omit<
      EnrichedPostPayload,
      "id" | "created_at" | "upvotes" | "author"
    > = {
      title: finalTitle,
      url: cleanedUrl,
      language: finalLanguage,
      content: body.content ?? scrapedMainContentForDetection,
    };

    const { data: newPost, error: insertError } = await supabase
      .from("posts")
      .insert(newPostForDb)
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting new post:", insertError);
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            message:
              "This post has already been submitted (detected during insert).",
            existingPostId: "N/A - conflict during insert",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { message: "Failed to save the new post." },
        { status: 500 }
      );
    }

    if (!newPost) {
      return NextResponse.json(
        { message: "Failed to save the new post or retrieve it after saving." },
        { status: 500 }
      );
    }

    return NextResponse.json(newPost as Omit<EnrichedPostPayload, "author">, {
      status: 201,
      headers: { "Content-Language": newPost.language || "en" },
    });
  } catch (error) {
    console.error("Failed to create post (outer catch):", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { message: `Failed to process the request: ${message}` },
      { status: 500 }
    );
  }
}
