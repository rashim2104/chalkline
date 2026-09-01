/**
 * Minimal ambient types for the WebMCP Document interface, transcribed from
 * the W3C draft IDL (webmachinelearning/webmcp, index.bs). Not yet in lib.dom.
 */
export {}

declare global {
  interface ToolAnnotations {
    readOnlyHint?: boolean
    untrustedContentHint?: boolean
  }

  interface ModelContextTool {
    name: string
    title?: string
    description: string
    inputSchema?: object
    annotations?: ToolAnnotations
    execute: (input: never, options: { signal: AbortSignal }) => Promise<unknown>
  }

  interface RegisteredTool {
    name: string
    title?: string
    description: string
    inputSchema?: object
    annotations?: ToolAnnotations
    origin: string
    window: Window
  }

  interface ModelContext extends EventTarget {
    registerTool(
      tool: ModelContextTool,
      options?: { exposedTo?: string[]; signal?: AbortSignal },
    ): Promise<void>
    getTools(options?: { fromOrigins?: string[] }): Promise<RegisteredTool[]>
    executeTool(
      tool: RegisteredTool,
      input?: object,
      options?: { signal?: AbortSignal },
    ): Promise<string | null>
    ontoolchange: ((this: ModelContext, ev: Event) => unknown) | null
  }

  interface Document {
    readonly modelContext?: ModelContext
  }
}
