// Utility functions
// Will be expanded as needed in subsequent tasks

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
