import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY is not configured in environment variables" }, { status: 500 });
  }

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`, {
      next: { revalidate: 3600 } // cache for 1 hour
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("YouTube API error:", errorData);
      return NextResponse.json({ error: "Failed to fetch data from YouTube API" }, { status: 500 });
    }

    const data = await res.json();
    const items = data.items;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const description = items[0].snippet?.description || "";
    const chapters: { time: number; title: string }[] = [];

    if (description) {
      // Hỗ trợ định dạng: 00:00 - Title hoặc 00:00 Title (có hoặc không có dấu gạch ngang)
      const regex = /(?:^|\n)\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+-(?:\s+)?(.+)|(?:^|\n)\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)/g;
      let m;
      while ((m = regex.exec(description)) !== null) {
        const hasDash = !!m[4];
        const h = parseInt(m[hasDash ? 1 : 5] || "0", 10);
        const min = parseInt(m[hasDash ? 2 : 6] || "0", 10);
        const sec = parseInt(m[hasDash ? 3 : 7] || "0", 10);
        const title = (m[hasDash ? 4 : 8] || "").trim();
        
        if (title) {
          chapters.push({
            time: h * 3600 + min * 60 + sec,
            title
          });
        }
      }
    }

    return NextResponse.json({ chapters, description });
  } catch (error) {
    console.error("Error fetching from YouTube API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
