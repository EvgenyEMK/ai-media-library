import http from "node:http";

export interface MockOllamaConfig {
  /** Fail the first N /api/chat requests with HTTP 503. */
  failFirstChatRequests?: number;
  /**
   * When true, parse `Filename: <basename>` from `/api/chat` JSON body and return deterministic
   * analysis JSON for E2E quick-filter tests. Otherwise use a generic test payload.
   */
  e2eFilenameBasedAnalysis?: boolean;
}

export interface MockOllamaServer {
  baseUrl: string;
  close: () => Promise<void>;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      out += chunk;
    });
    req.on("end", () => resolve(out));
    req.on("error", reject);
  });
}

function extractFilenameFromChatBody(bodyText: string): string | null {
  try {
    const parsed = JSON.parse(bodyText) as { messages?: Array<{ content?: string }> };
    const content = parsed.messages?.[0]?.content;
    if (typeof content !== "string") {
      return null;
    }
    const match = content.match(/Filename:\s*(\S+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Maps e2e-photos basenames to AI fields used by quick-filter tests. */
function e2eAnalysisFieldsForFilename(basename: string): {
  image_category: string;
  number_of_people: number | null;
  /** 1–10; mapped to AI Rating stars via ceil(quality/2) in quick filters. */
  photo_estetic_quality: number;
} {
  const map: Record<
    string,
    { image_category: string; number_of_people: number | null; photo_estetic_quality: number }
  > = {
    "mock_invoice_01_gemini.png": { image_category: "invoice_or_receipt", number_of_people: 0, photo_estetic_quality: 6 },
    "receipt-mock-02-french.jpg": { image_category: "invoice_or_receipt", number_of_people: 0, photo_estetic_quality: 6 },
    "Dutch_identity_card_front_specimen_issued_9_March_2014.jpg": { image_category: "document_id_or_passport", number_of_people: 0, photo_estetic_quality: 6 },
    /** Sports: low esthetic → AI stars 2 (< 4) for AI Rating ≥ 4 tests. */
    "20191013_142053.jpg": { image_category: "sports", number_of_people: 1, photo_estetic_quality: 4 },
    /** Nature: high esthetic → AI stars 5. */
    "20200910_151932.jpg": { image_category: "nature", number_of_people: 0, photo_estetic_quality: 10 },
    "20200821_101037.jpg": { image_category: "nature", number_of_people: 0, photo_estetic_quality: 10 },
  };
  return (
    map[basename] ?? {
      image_category: "person_or_people",
      number_of_people: 2,
      photo_estetic_quality: 6,
    }
  );
}

function e2eAnalysisPayloadForFilename(basename: string): Record<string, unknown> {
  const { image_category, number_of_people, photo_estetic_quality } = e2eAnalysisFieldsForFilename(basename);
  return {
    image_category,
    title: "E2E",
    description: "Automated test analysis for quick filter coverage.",
    number_of_people,
    has_children: false,
    people: [],
    location: null,
    date: null,
    time: null,
    weather: null,
    daytime: null,
    photo_estetic_quality,
    photo_star_rating_1_5: 3,
    is_low_quality: false,
    quality_issues: ["none"],
    edit_suggestions: null,
  };
}

const GENERIC_TEST_ANALYSIS: Record<string, unknown> = {
  image_category: "other",
  title: "test-title",
  description: "test-description",
  number_of_people: null,
  has_children: null,
  people: [],
  location: null,
  date: null,
  time: null,
  weather: null,
  daytime: null,
  photo_estetic_quality: null,
  photo_star_rating_1_5: null,
  is_low_quality: null,
  quality_issues: null,
  edit_suggestions: null,
};

export async function startMockOllamaServer(
  config: MockOllamaConfig = {},
): Promise<MockOllamaServer> {
  let chatCount = 0;
  const failFirst = Math.max(0, Math.floor(config.failFirstChatRequests ?? 0));
  const filenameBased = config.e2eFilenameBasedAnalysis === true;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (req.method !== "POST") {
        json(res, 404, { error: "not found" });
        return;
      }

      if (url.pathname === "/api/chat") {
        chatCount += 1;
        if (chatCount <= failFirst) {
          json(res, 503, { error: "model is loading" });
          return;
        }

        const bodyText = await readBody(req);

        let analysisPayload: Record<string, unknown> = GENERIC_TEST_ANALYSIS;
        if (filenameBased) {
          const basename = extractFilenameFromChatBody(bodyText);
          if (basename) {
            analysisPayload = e2eAnalysisPayloadForFilename(basename);
          }
        }

        json(res, 200, {
          message: {
            content: JSON.stringify(analysisPayload),
          },
        });
        return;
      }

      if (url.pathname === "/api/embed") {
        json(res, 200, { embedding: [0.1, 0.2, 0.3, 0.4] });
        return;
      }

      json(res, 404, { error: "not found" });
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock Ollama server failed to bind to a TCP port");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
