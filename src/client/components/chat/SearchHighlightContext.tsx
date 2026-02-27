import { createContext, useContext } from 'react'

/**
 * Context that carries the current in-conversation search query.
 * Used by MarkdownContent to highlight matching text within messages.
 */
const SearchHighlightContext = createContext<string>('')

export const SearchHighlightProvider = SearchHighlightContext.Provider

export function useSearchHighlight(): string {
  return useContext(SearchHighlightContext)
}
