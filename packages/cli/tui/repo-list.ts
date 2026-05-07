import { readFileSync } from "node:fs";
import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  ScrollBoxRenderable,
  TextTableRenderable,
  bold,
  brightBlue,
  brightWhite,
  brightCyan,
  brightYellow,
  brightGreen,
  fg,
  stringToStyledText,
} from "@opentui/core";

interface ProjectListItem {
  slug: string;
  description: string;
  lane?: string;
  owner?: string;
  projectPath?: string;
  repositoryUrl?: string;
  initFrom?: string;
  createdAt: string;
}

interface ProjectListData {
  projects: ProjectListItem[];
}

function styleHeader(text: string) {
  return [bold(brightBlue(text))];
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

const DESC_MAX = 36;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

const filePath = process.argv[2];
if (!filePath) {
  process.stderr.write("Usage: bun run repo-list.ts <data-json-file>\n");
  process.exit(1);
}

let data: ProjectListData;
try {
  data = JSON.parse(readFileSync(filePath, "utf-8"));
} catch {
  process.stderr.write("Failed to read project list data.\n");
  process.exit(1);
}

const { projects } = data;

if (projects.length === 0) {
  process.stdout.write("暂无已启动项目。\n");
  process.exit(0);
}

function buildRow(
  p: ProjectListItem,
  selected: boolean,
): ReturnType<typeof stringToStyledText>["chunks"][] {
  const slug = selected ? brightWhite(p.slug) : brightCyan(p.slug);
  const lane = selected ? fg("#DDDDDD")(p.lane ?? "-") : brightYellow(p.lane ?? "-");
  const owner = selected ? fg("#DDDDDD")(p.owner ?? "-") : fg("#AAAAAA")(p.owner ?? "-");
  const desc = selected
    ? fg("#DDDDDD")(truncate(p.description, DESC_MAX))
    : fg("#CCCCCC")(truncate(p.description, DESC_MAX));
  const created = selected
    ? fg("#DDDDDD")(formatDate(p.createdAt))
    : brightGreen(formatDate(p.createdAt));

  return [
    [slug],
    [lane],
    [owner],
    [desc],
    [created],
  ];
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  clearOnShutdown: true,
});

const header = new TextRenderable(renderer, {
  content: stringToStyledText(
    `  Foyer 项目列表  |  ${projects.length} 个项目  |  q 退出  ↑↓/jk 滚动`,
  ),
  fg: "#FFFFFF",
  bg: "#333333",
});

header.height = 1;

const table = new TextTableRenderable(renderer, {
  columnWidthMode: "content",
  showBorders: true,
  borderStyle: "rounded",
  borderColor: "#555555",
  cellPadding: 1,
  fg: "#CCCCCC",
});

const headerRow = [
  styleHeader("Slug"),
  styleHeader("Lane"),
  styleHeader("Owner"),
  styleHeader("Description"),
  styleHeader("Created"),
];

table.content = [headerRow, ...projects.map((p) => buildRow(p, false))];

const scrollBox = new ScrollBoxRenderable(renderer, {
  flexGrow: 1,
  scrollY: true,
  border: false,
  scrollbarOptions: {
    visible: true,
  },
});

scrollBox.content.add(table);

const footer = new TextRenderable(renderer, {
  content: stringToStyledText("  ↑↓/j/k 滚动  g 顶部  G 底部  q 退出  / 搜索"),
  fg: "#888888",
  bg: "#333333",
});
footer.height = 1;

const main = new BoxRenderable(renderer, {
  flexDirection: "column",
  width: "100%",
  height: "100%",
  backgroundColor: "#1a1a2e",
});

main.add(header);
main.add(scrollBox);
main.add(footer);

renderer.root.add(main);

let searchMode = false;
let searchQuery = "";

function applyFilter() {
  const q = searchQuery.toLowerCase();
  const filtered = q
    ? projects.filter(
        (p) =>
          p.slug.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      )
    : projects;
  table.content = [headerRow, ...filtered.map((p) => buildRow(p, false))];
  header.content = stringToStyledText(
    q
      ? `  Foyer 项目列表  |  ${filtered.length}/${projects.length} 个项目  |  搜索: ${q}  ESC 清除`
      : `  Foyer 项目列表  |  ${projects.length} 个项目  |  q 退出  ↑↓/jk 滚动`,
  );
}

renderer.keyInput.on("keypress", (key) => {
  if (searchMode) {
    if (key.name === "escape") {
      searchMode = false;
      searchQuery = "";
      applyFilter();
      return;
    }
    if (key.name === "backspace") {
      searchQuery = searchQuery.slice(0, -1);
      applyFilter();
      return;
    }
    if (key.name === "return") {
      searchMode = false;
      return;
    }
    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      searchQuery += key.sequence;
      applyFilter();
      return;
    }
    return;
  }

  if (key.name === "q" || key.name === "escape") {
    renderer.destroy();
    return;
  }

  if (key.name === "/") {
    searchMode = true;
    searchQuery = "";
    header.content = stringToStyledText(
      `  搜索: _  |  ESC 取消`,
    );
    return;
  }

  if (key.name === "g") {
    scrollBox.scrollTo({ x: 0, y: 0 });
    return;
  }

  if (key.name === "G" || (key.shift && key.name === "g")) {
    scrollBox.scrollTo({ x: 0, y: scrollBox.scrollHeight });
    return;
  }

  if (key.name === "j" || key.name === "arrowdown") {
    scrollBox.scrollBy({ x: 0, y: 1 });
    return;
  }

  if (key.name === "k" || key.name === "arrowup") {
    scrollBox.scrollBy({ x: 0, y: -1 });
    return;
  }
});
