import { create } from 'zustand'

/**
 * Whether VeloxVerse is currently refusing the CRM's connection (the backend answers
 * 502 + code VELOXVERSE_BRIDGE_REJECTED after re-signing and retrying once — see
 * backend veloxverseProxy.js). Set by the axios interceptor, shown as a banner in the layout,
 * so a VeloxVerse screen never just looks empty when the two systems can't talk.
 */
interface BridgeStatusState {
  rejectedMessage: string | null
  setRejected: (message: string) => void
  clear: () => void
}

export const useBridgeStatusStore = create<BridgeStatusState>((set, get) => ({
  rejectedMessage: null,
  setRejected: (message) => {
    if (get().rejectedMessage !== message) set({ rejectedMessage: message })
  },
  clear: () => {
    if (get().rejectedMessage !== null) set({ rejectedMessage: null })
  },
}))

export const BRIDGE_REJECTED_CODE = 'VELOXVERSE_BRIDGE_REJECTED'
