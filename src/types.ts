export interface RegistryFile {
  path: string;
  content: string;
  type: string;
  target: string;
}

export interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
  tailwind?: Record<string, unknown>;
  cssVars?: {
    theme?: Record<string, string>;
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
  css?: Record<string, unknown>;
  meta?: {
    links?: {
      radix?: { docs?: string; examples?: string; api?: string };
      base?: { docs?: string; examples?: string; api?: string };
    };
  };
  categories?: string[];
}

export interface ComponentsConfig {
  $schema?: string;
  style: 'default' | 'new-york';
  rsc?: boolean;
  tsx?: boolean;
  tailwind?: {
    config?: string;
    css: string;
    baseColor?: string;
    cssVariables?: boolean;
    prefix?: string;
  };
  aliases?: {
    components?: string;
    utils?: string;
    ui?: string;
    lib?: string;
    hooks?: string;
  };
  iconLibrary?: string;
}

export interface ProjectInfo {
  projectRoot: string;
  configPath: string;
  config: ComponentsConfig;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  framework: 'nextjs-app' | 'nextjs-pages' | 'vite' | 'unknown';
  srcDir: string | null;
  uiDir: string;
  hooksDir: string;
  libDir: string;
  cssPath: string | null;
}

export interface InstalledComponent {
  name: string;
  filePath: string;
}

export interface ResolvedDep {
  item: RegistryItem;
  alreadyInstalled: boolean;
}

export interface InstallResult {
  installed: Array<{
    name: string;
    files: string[];
    skipped: boolean;
  }>;
  failed: Array<{
    name: string;
    error: string;
  }>;
  npmPackagesInstalled: string[];
  npmPackagesFailed: string[];
  cssVarsAdded: number;
  dryRun: boolean;
}

export class RegistryError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'RegistryError';
  }
}

export class ComponentNotFoundError extends Error {
  constructor(public readonly componentName: string) {
    super(`Component '${componentName}' not found in the shadcn registry`);
    this.name = 'ComponentNotFoundError';
  }
}

export class ProjectNotInitializedError extends Error {
  constructor(public readonly searchRoot: string) {
    super(`No shadcn config (components.json) found starting from '${searchRoot}'. Run: npx shadcn@latest init`);
    this.name = 'ProjectNotInitializedError';
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class CircularDepError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CircularDepError';
  }
}
