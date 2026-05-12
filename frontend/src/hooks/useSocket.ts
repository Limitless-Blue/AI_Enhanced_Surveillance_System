import { useEffect, useRef } from 'react'
import { getSocket } from '../lib/socket'

export function useDetectionSocket(onDetection: (data: any) => void) {
  const cbRef = useRef(onDetection)
  cbRef.current = onDetection

  useEffect(() => {
    const socket = getSocket()
    const handler = (data: any) => cbRef.current(data)
    socket.on('detection', handler)
    return () => { socket.off('detection', handler) }
  }, [])
}
