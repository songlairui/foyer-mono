import { createServer } from "node:http";
import { execute, plan, type ProjectInitPayload } from "../../.flue/agents/project-init";

const port = parsePort(process.argv);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || !request.url) {
    send(response, 404, { ok: false, messageZh: "只支持 POST /plan 或 POST /execute。" });
    return;
  }

  try {
    const payload = JSON.parse(await readBody(request)) as ProjectInitPayload;
    if (request.url === "/plan") {
      send(response, 200, plan(payload));
      return;
    }
    if (request.url === "/execute") {
      send(response, 200, execute(payload));
      return;
    }
    send(response, 404, { ok: false, messageZh: "未知路径。" });
  } catch (error) {
    send(response, 400, {
      ok: false,
      messageZh: "请求 JSON 不合法。",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stderr.write(`foyer-mono Flue HTTP adapter listening on http://127.0.0.1:${port}\n`);
});

function readBody(request: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function send(
  response: {
    writeHead(status: number, headers: Record<string, string>): void;
    end(body: string): void;
  },
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function parsePort(argv: string[]): number {
  const index = argv.indexOf("--port");
  if (index >= 0 && argv[index + 1]) return Number.parseInt(argv[index + 1], 10);
  return 8787;
}
