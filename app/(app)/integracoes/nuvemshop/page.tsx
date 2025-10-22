 "use client";
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NuvemshopIndexPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/integracoes/nuvemshop/painel') }, [router])
  return null
}
