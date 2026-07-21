import { useLocation } from "react-router-dom"
import { useTransaction } from "../stores/db/Transactions"
import { useMessage } from "../stores/db/Messages"
import { useUpdate } from "../stores/db/Updates"

// Wallet-scoped list/form routes, keyed by path segment.
export const WALLET_SECTIONS = [
  "wallet",
  "new-transaction",
  "transactions",
  "update",
  "updates",
  "sign-message",
  "messages",
] as const

export type WalletSection = (typeof WALLET_SECTIONS)[number]

// Detail routes carry a subdigest instead of an address; the record it
// resolves to defines the wallet. Each maps to the list section it belongs to.
const DETAIL_SECTIONS: Record<string, WalletSection> = {
  "transaction": "transactions",
  "message": "messages",
  "do-update": "updates",
}

export type WalletRoute = {
  // Wallet the current URL refers to. The URL is the single source of truth:
  // there is no stored "selected wallet" anywhere else.
  address: string | undefined
  // Wallet section the current URL belongs to (detail pages map to their list)
  section: WalletSection | undefined
}

export function useWalletRoute(): WalletRoute {
  const { pathname } = useLocation()
  const [, root, param] = pathname.split("/")

  const detailSection = DETAIL_SECTIONS[root]
  const subdigest = detailSection && param ? param : undefined

  const transaction = useTransaction({ subdigest: root === "transaction" ? subdigest : undefined })
  const message = useMessage({ subdigest: root === "message" ? subdigest : undefined })
  const { update } = useUpdate({ subdigest: root === "do-update" ? subdigest : undefined })

  if ((WALLET_SECTIONS as readonly string[]).includes(root) && param) {
    return { address: param, section: root as WalletSection }
  }

  if (detailSection) {
    return {
      address: transaction?.wallet ?? message?.wallet ?? update?.wallet,
      section: detailSection,
    }
  }

  return { address: undefined, section: undefined }
}
