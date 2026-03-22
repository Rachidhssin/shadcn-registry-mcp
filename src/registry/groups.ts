export interface ComponentGroup {
  description: string;
  components: string[];
}

/**
 * Predefined component groups for bulk installation.
 * Each group maps a short name to a curated list of related components.
 */
export const COMPONENT_GROUPS: Record<string, ComponentGroup> = {
  form: {
    description: 'Form inputs and controls',
    components: ['input', 'textarea', 'select', 'checkbox', 'radio-group', 'switch', 'slider', 'label', 'form'],
  },
  layout: {
    description: 'Layout and structural components',
    components: ['card', 'separator', 'aspect-ratio', 'scroll-area', 'resizable'],
  },
  navigation: {
    description: 'Navigation and routing components',
    components: ['navigation-menu', 'breadcrumb', 'pagination', 'tabs', 'sidebar'],
  },
  overlay: {
    description: 'Modals, drawers, popovers, and tooltips',
    components: [
      'dialog',
      'alert-dialog',
      'sheet',
      'drawer',
      'popover',
      'tooltip',
      'hover-card',
      'dropdown-menu',
      'context-menu',
    ],
  },
  data: {
    description: 'Data display and visualization',
    components: ['table', 'badge', 'avatar', 'calendar', 'chart'],
  },
  feedback: {
    description: 'Feedback, status, and loading indicators',
    components: ['alert', 'sonner', 'progress', 'skeleton'],
  },
  typography: {
    description: 'Text, disclosure, and toggle components',
    components: ['accordion', 'collapsible', 'toggle', 'toggle-group'],
  },
};

/**
 * Resolves a group name to its ComponentGroup definition.
 * Returns null if the group name is not recognized.
 */
export function resolveGroup(name: string): ComponentGroup | null {
  return COMPONENT_GROUPS[name.toLowerCase()] ?? null;
}

/**
 * Returns a formatted string listing all available groups.
 */
export function listGroups(): string {
  const lines = ['Available component groups:\n'];
  for (const [name, group] of Object.entries(COMPONENT_GROUPS)) {
    lines.push(`  ${name.padEnd(12)} — ${group.description}`);
    lines.push(`               ${group.components.join(', ')}`);
  }
  return lines.join('\n');
}
