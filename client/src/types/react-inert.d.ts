// `inert` is a standard HTML boolean attribute (supported in all modern
// browsers) that isn't in @types/react's `HTMLAttributes` until React 19's
// type definitions. We're on React 18, so augment it here rather than
// casting at every call site.
import "react";

declare module "react" {
  interface HTMLAttributes<T> {
    inert?: boolean;
  }
}
