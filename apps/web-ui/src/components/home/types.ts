export interface Worktree {
  path: string;
  branch: string;
  bare: boolean;
  head: string;
}

export interface Repo {
  repo: string;
  path: string;
  scanRoot: string;
  description?: string;
  lane?: string;
  slug?: string;
  lastModified?: number;
  worktrees?: Worktree[];
}

export interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  subCategories: string[];
}

export interface RepoTag {
  categoryId: string;
  subCategory?: string;
}
