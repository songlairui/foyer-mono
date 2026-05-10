export interface Repo {
  repo: string;
  path: string;
  scanRoot: string;
  description?: string;
  lane?: string;
  slug?: string;
  lastModified?: number;
}

export type Category = "goal" | "work" | "life" | "explore";

export interface RepoTag {
  category: Category;
  workDir?: string;
}
