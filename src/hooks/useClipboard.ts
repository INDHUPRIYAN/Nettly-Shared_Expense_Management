import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

/** Copy text with the Clipboard API, with a textarea fallback for older/insecure contexts. */
export function useClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    async (text: string, successMessage = 'Copied to clipboard') => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text)
        } else {
          const area = document.createElement('textarea')
          area.value = text
          area.setAttribute('readonly', '')
          area.style.position = 'fixed'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          const ok = document.execCommand('copy')
          document.body.removeChild(area)
          if (!ok) throw new Error('copy failed')
        }
        setCopied(true)
        toast.success(successMessage)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), resetMs)
        return true
      } catch {
        toast.error("Couldn't copy automatically. Please copy the text manually.")
        return false
      }
    },
    [resetMs],
  )

  return { copy, copied }
}
