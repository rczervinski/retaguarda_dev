"use client";
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConexaoNuvemshopPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/integracoes/nuvemshop/configuracoes') }, [router])
  return null
}
