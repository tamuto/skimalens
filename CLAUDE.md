# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server on port 8080
- `npm run build` - Build for production
- `npm install` - Install dependencies

## Architecture

This is a React application built with:
- **Rsbuild** as the build tool (Rspack-based)
- **TanStack Router** for file-based routing with type safety
- **Tailwind CSS** for styling
- **shadcn/ui** components (New York style, configured in components.json)

### Key Architecture Points

- **Entry point**: `src/main.tsx` creates the router and renders the app
- **Routing**: File-based routing with TanStack Router
  - Routes are defined in `src/routes/` directory
  - Route tree is auto-generated in `src/routeTree.gen.ts`
  - Root layout in `src/routes/__root.tsx` provides navigation and devtools
- **Build configuration**: `rsbuild.config.ts` with React plugin and TanStack Router plugin
- **Path aliases**: `@/*` maps to `src/*` (configured in tsconfig.json and components.json)
- **Styling**: Tailwind CSS with shadcn/ui component system

### Component Structure
- UI components follow shadcn/ui patterns in `@/components/ui`
- Utilities in `@/lib/utils` using class-variance-authority and tailwind-merge
- Global styles in `src/globals.css`

When adding new routes, create files in `src/routes/` and the route tree will be auto-generated.