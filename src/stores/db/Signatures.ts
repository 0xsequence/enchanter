import { useEffect, useState } from "react"
import { mainDB } from "./Main"
import { notify, useNotifier } from "./Notifier"

export type SignatureEntry = {
  subdigest: string
  signature: string
}

export async function addSignature(signature: SignatureEntry) {
  const db = await mainDB()

  const found = await db.getAllFromIndex("signatures", "subdigest", signature.subdigest)
  if ((found as SignatureEntry[]).find(s => s.signature === signature.signature)) {
    db.close()
    return false
  }

  await db.add("signatures", signature)
  db.close()
  notify()

  return true
}

export async function getSignaturesForSubdigest(subdigest: string) {
  const db = await mainDB()

  const signatures = await db.getAllFromIndex("signatures", "subdigest", subdigest)
  db.close()
  
  return signatures
}

export function useSignatures(args: { subdigest?: string }) {
  const notifier = useNotifier()

  const [signatures, setSignatures] = useState<SignatureEntry[]>([])
  
  useEffect(() => {
    async function fetchSignatures() {
      if (!args.subdigest) return
      const signatures = await getSignaturesForSubdigest(args.subdigest)
      setSignatures(signatures)
    }

    fetchSignatures()
  }, [notifier.flag, args.subdigest])

  return {
    signatures,
    addSignature
  }
}