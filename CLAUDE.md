# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `pnpm run dev` - Start development server (will use available port, typically 8080)
- `pnpm run build` - Build for production  
- `pnpm install` - Install dependencies (project uses pnpm)

## Architecture

This is a React application built with:
- **Rsbuild** as the build tool (Rspack-based)
- **TanStack Router** for file-based routing with type safety
- **Tailwind CSS** for styling
- **shadcn/ui** components (New York style, configured in components.json)
- **js-yaml** for YAML parsing
- **react-dropzone** for file upload functionality

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
- **UI components**: shadcn/ui patterns in `@/components/ui`
- **Application components**:
  - `file-upload.tsx`: Drag & drop file upload with validation
  - `message-item.tsx`: Individual message display with attachments
  - `conversation-viewer.tsx`: Single conversation analysis with search/filter
  - `conversations-list.tsx`: Multiple conversations overview
- **Utilities**: `@/lib/utils` using class-variance-authority and tailwind-merge
- **Data parsing**: `@/lib/parser.ts` for JSON/YAML analysis and type detection
- **Type definitions**: `@/types/data.ts` for Claude and ChatGPT conversation structures
- **Global styles**: `src/globals.css`

When adding new routes, create files in `src/routes/` and the route tree will be auto-generated.

## Project Purpose

SkimaLens is a data visualization tool for JSON and YAML data, specifically designed to view and analyze Claude and ChatGPT conversation logs. It supports Claude conversation.json files and ChatGPT export files, with future plans to support CloudWatch logs.

## Implementation Status

### ✅ Completed Features (MVP - Priority 1)
- **File upload/drop functionality**: Drag & drop and file selection for JSON/YAML files
- **Data parsing and validation**: Automatic format detection with robust Claude conversation.json support
- **Claude conversation log viewer**: Complete viewer with message threading and metadata display
- **Search and filter capabilities**: Full-text search, sender filtering, conversation navigation
- **Multiple conversation support**: Handle both single conversations and conversation arrays
- **Responsive design**: Mobile-friendly interface with proper responsive layout

### 🔄 Current Capabilities
- **Supported formats**: 
  - Claude conversation.json (single or multiple conversations)
  - ChatGPT conversation export files (single or multiple conversations)
  - Generic JSON/YAML
- **Conversation features**:
  - Full conversation metadata display (name/title, dates, message counts)
  - Message threading with proper sender identification (human/user, assistant)
  - Universal message viewer supporting both Claude and ChatGPT formats
  - Real-time search and filtering across messages
  - Message statistics and conversation overview
  - Claude-specific: Attachment and file display, feedback indicators
- **File processing**: Client-side only, no server communication required

### 📋 Remaining Tasks (Priority 2+)

#### Priority 2 - Enhanced Features
- [ ] **Advanced search**: Date range filtering, regex search
- [ ] **Message display options**: 
  - [ ] Collapsible/expandable messages
  - [ ] Display themes (light/dark mode)
  - [ ] Font size adjustment
  - [ ] Message export (individual or selection)
- [ ] **Conversation analysis**:
  - [ ] Word count statistics
  - [ ] Response time analysis
  - [ ] Conversation flow visualization

#### Priority 3 - Additional Format Support
- [x] **ChatGPT conversation format**: Support for ChatGPT export files ✅ **COMPLETED**
- [ ] **CloudWatch logs format**: Basic log viewing and filtering
- [ ] **Generic JSON/YAML viewer**: Enhanced view for arbitrary structured data
- [ ] **CSV export**: Convert conversation data to spreadsheet format

#### Future Enhancements
- [ ] **Bulk file processing**: Handle multiple files simultaneously
- [ ] **Advanced analytics**: Conversation insights and patterns
- [ ] **Bookmark system**: Save interesting conversations or messages
- [ ] **Share functionality**: Generate shareable links for conversations (privacy-safe)

### Data Structure Support

#### Claude conversation.json (Fully Supported)
- **Structure**: Array of conversation objects or single conversation object
- **Key fields**: `uuid`, `name`, `created_at`, `updated_at`, `chat_messages`, `account`
- **Message fields**: `uuid`, `text`, `content`, `sender`, `created_at`, `attachments`, `files`
- **Special handling**: Content blocks (text/thinking), message attachments, feedback

#### ChatGPT export format (Fully Supported)
- **Structure**: Array of conversation objects or single conversation object
- **Key fields**: `id`, `title`, `create_time`, `update_time`, `mapping`, `conversation_id`
- **Message structure**: Tree-based mapping with message nodes containing `id`, `author`, `content`, `create_time`
- **Author roles**: `user`, `assistant`, `system`
- **Special handling**: Message mapping tree flattened to chronological order, timestamp conversion from Unix time

#### Future formats (Planned)
- **CloudWatch logs**: Basic log entry parsing and display
- **Generic JSON/YAML**: Free-form structured data with intelligent display

### Development Notes
- All data processing happens client-side (no backend required)
- File API used for secure local file handling
- TypeScript types ensure data structure integrity
- Modular component design allows easy feature extension
- Performance optimized for large conversation files