import { NextRequest, NextResponse } from "next/server";
import { NewPostPayload, EnrichedPostPayload } from "@/types";
import { getPostsPaginated, addPost, findPostByUrl } from "@/lib/dataStore";
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

  const { posts, totalPosts } = getPostsPaginated({
    page,
    limit,
    sortBy: "latest",
  });
  return NextResponse.json({ posts, totalPosts, page, limit });
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
        /^\/feed\/update\/urn:li:activity:\d+$/,
        /^\/posts\/([a-zA-Z0-9_-]+-)?activity-\d+-\w+$/,
        /^\/posts\/(urn:li:ugcPost|urn:li:share):\d+$/,
        /^\/pulse\/.+$/,
        /^\/embed\/feed\/update\/urn:li:share:\d+$/,
        /^\/embed\/feed\/update\/urn:li:ugcPost:\d+$/,
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

    const existingPost = findPostByUrl(cleanedUrl);
    if (existingPost) {
      return NextResponse.json(
        {
          message: "This post has already been submitted.",
          existingPostId: existingPost.id,
        },
        { status: 409 }
      );
    }

    let fetchedTitle: string | undefined;
    let fetchedAuthor: string | undefined;
    let scrapedMainContentForDetection: string | undefined;

    if (body.title === undefined || body.author === undefined) {
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
          let tempAuthor =
            $('meta[property="article:author"]').attr("content")?.trim() ||
            $('meta[name="author"]').attr("content")?.trim();

          if (tempTitle && tempTitle.includes(" | LinkedIn")) {
            tempTitle = tempTitle
              .substring(0, tempTitle.lastIndexOf(" | LinkedIn"))
              .trim();
          }
          if (!tempAuthor && tempTitle && tempTitle.includes(": ")) {
            const parts = tempTitle.split(": ");
            const potentialAuthor = parts[0];
            const nameParts = potentialAuthor.split(" ");
            if (
              nameParts.length >= 1 &&
              nameParts.length <= 5 &&
              nameParts.every(
                (p) => p.length > 0 && p[0] === p[0].toUpperCase()
              )
            ) {
              tempAuthor = potentialAuthor;
              tempTitle = parts.slice(1).join(": ").trim();
            }
          }
          if (tempTitle) {
            tempTitle = tempTitle
              .replace(/\s*\|\s*[^|]+\s*\|\s*\d+\s*comments\s*$/i, "")
              .trim();
          }
          fetchedTitle = tempTitle;
          fetchedAuthor = tempAuthor;

          const mainContentElements = $(
            ".attributed-text-segment-list__content"
          );
          if (mainContentElements.length > 0) {
            scrapedMainContentForDetection = mainContentElements
              .map((i, el) => $(el).text())
              .get()
              .join(" \n\n ")
              .trim();
            console.log(
              `Scraped main content for detection (first 200 chars): "${scrapedMainContentForDetection.substring(
                0,
                200
              )}..."`
            );
          } else {
            console.log(
              "Class 'attributed-text-segment-list__content' not found, using title for detection."
            );
          }
        } else {
          console.warn(
            `Failed to fetch LinkedIn URL ${cleanedUrl} for metadata: Status ${metadataResponse.status}`
          );
        }
      } catch (fetchError) {
        console.error(
          `Error fetching or parsing LinkedIn URL ${cleanedUrl} for metadata:`,
          fetchError
        );
      }
    }

    let detectedLanguage = "en";
    const textToDetect = scrapedMainContentForDetection || fetchedTitle || "";
    console.log(
      `Final text for language detection (first 200 chars): "${textToDetect.substring(
        0,
        200
      )}..."`
    );

    if (textToDetect) {
      const detections = francAll(textToDetect, { minLength: 3 });
      console.log("FrancAll detections (top 5):", detections.slice(0, 5));
      let foundMapping = false;
      if (detections && detections.length > 0) {
        for (const [langCode3, probability] of detections) {
          if (langCode3 === "und") {
            console.log(
              `  [Loop] Skipping 'und' (undetermined) with probability ${probability}`
            );
            continue;
          }
          let langCode2_current_iteration: string | undefined;
          if (langCode3.length === 3) {
            langCode2_current_iteration = iso6393To1[langCode3];
            console.log(
              `  [Loop] For ${langCode3} (Prob: ${probability}): Mapped via iso-639-3/iso6393-to-1.js -> "${langCode2_current_iteration}"`
            );
            if (!langCode2_current_iteration) {
              console.log(
                `    [Loop] For ${langCode3}: No 2-letter code found in iso-639-3/iso6393-to-1.js mapping.`
              );
            }
          } else if (langCode3.length === 2) {
            if (ISO6391.validate(langCode3)) {
              langCode2_current_iteration = langCode3;
              console.log(
                `  [Loop] For ${langCode3} (Prob: ${probability}): Already a valid 2-letter code.`
              );
            } else {
              console.log(
                `  [Loop] For ${langCode3} (Prob: ${probability}): Is 2-letters, but not a valid ISO639-1 code according to ISO6391.validate().`
              );
            }
          } else {
            console.log(
              `  [Loop] For ${langCode3} (Prob: ${probability}): Unexpected code length (${langCode3.length}). Not 2 or 3 letters.`
            );
          }
          if (langCode2_current_iteration) {
            detectedLanguage = langCode2_current_iteration;
            console.log(
              `Successfully detected and mapped language: ${detectedLanguage} from ${langCode3} (Prob: ${probability})`
            );
            foundMapping = true;
            break;
          }
        }
        if (!foundMapping) {
          const topDetection = detections[0] ? detections[0][0] : "N/A";
          console.warn(
            `Could not map any detected languages to a valid 2-letter code. Top francAll detection: ${topDetection}. Defaulting to 'en'.`
          );
        }
      } else {
        console.warn(
          `Language detection by francAll yielded no results. Text: "${textToDetect.substring(
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

    const newPostPayload: EnrichedPostPayload = {
      url: cleanedUrl,
      language: detectedLanguage,
      title: fetchedTitle || "",
      author: fetchedAuthor || "",
    };

    const newPost = await addPost(newPostPayload);
    return NextResponse.json(newPost, { status: 201 });
  } catch (error) {
    console.error("Failed to create post:", error);
    return NextResponse.json(
      {
        message:
          "An internal server error occurred while processing your request.",
      },
      { status: 500 }
    );
  }
}
